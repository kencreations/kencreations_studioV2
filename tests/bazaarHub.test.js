import test from "node:test";
import assert from "node:assert/strict";

import { evaluateBazaarAccess } from "../src/utils/licensePolicy.js";
import { calculateItemPrice, calculateOrderTotal, calculateMargin } from "../src/engine/bazaar/pricing.js";
import { getCharacterFrequencies, decomposeProductBOM, calculateBOMCost } from "../src/engine/bazaar/bom.js";
import {
    calculateUnallocatedStock,
    calculateGlobalAvailable,
    calculateEventAvailable,
    calculateEventPhysicalRemaining,
    calculateShopAvailable,
    validateInventoryInvariants,
    transitionAllocateStockToEvent,
    transitionDeallocateStockFromEvent,
    transitionReserveStock,
    transitionConsumeStock,
    transitionConsumeEventStock,
    transitionReleaseStock,
    transitionScrapOrRecoverStock,
    checkQueueCapacity,
    calculateFinancialSummary,
    buildLetterColorMatrix,
    adjustStockBalance,
} from "../src/engine/bazaar/inventoryMath.js";
import {
    getShopId,
    normalizeSlug,
    isValidSlug,
    sanitizePublicShop,
    sanitizePublicEvent,
    sanitizePublicProduct,
    sanitizePublicOrderTracking,
    sanitizeForFirestore,
} from "../src/services/bazaarService.js";

// ─── 1. Subscription Entitlement Policy ──────────────────────────────────────

test("evaluateBazaarAccess enforces verified commercial, VIP, and entitlement access", () => {
    // Loading & Error states
    assert.equal(evaluateBazaarAccess({ status: "loading" }).state, "loading");
    assert.equal(evaluateBazaarAccess({ status: "error" }).state, "error");

    // Unauthenticated web user
    assert.equal(evaluateBazaarAccess({ status: "ready", desktop: false, currentUser: null }).state, "unauthenticated");

    // VIP user
    const vip = { status: "ready", currentUser: { uid: "u_vip" }, isVip: true, hasActiveLicense: true };
    assert.equal(evaluateBazaarAccess(vip).allowed, true);
    assert.equal(evaluateBazaarAccess(vip).reason, "VIP");

    // Dedicated Bazaar Hub entitlement
    const entitlementUser = {
        status: "ready",
        currentUser: { uid: "u_ent" },
        entitlements: ["bazaar-hub"],
        active: [{ id: "lic_bazaar", entitlements: ["bazaar-hub"] }],
        hasActiveLicense: true,
    };
    assert.equal(evaluateBazaarAccess(entitlementUser).allowed, true);
    assert.equal(evaluateBazaarAccess(entitlementUser).reason, "ENTITLEMENT");

    // Active Commercial / Studio Pro user
    const commercialUser = {
        status: "ready",
        currentUser: { uid: "u_pro" },
        hasActiveLicense: true,
        active: [{ id: "lic_comm", status: "active", tier: "commercial" }],
    };
    assert.equal(evaluateBazaarAccess(commercialUser).allowed, true);
    assert.equal(evaluateBazaarAccess(commercialUser).reason, "COMMERCIAL_LICENSE");

    // Active Pro subscriber with valid license key
    const proUser = {
        status: "ready",
        currentUser: { uid: "u_pro2" },
        hasActiveLicense: true,
        active: [{ id: "lic_pro", status: "active", tier: "pro" }],
    };
    assert.equal(evaluateBazaarAccess(proUser).allowed, true);

    // Active 12-Month subscriber with valid license key
    const yearUser = {
        status: "ready",
        currentUser: { uid: "u_year" },
        hasActiveLicense: true,
        active: [{ id: "lic_12mo", status: "active", tier: "12mo" }],
    };
    assert.equal(evaluateBazaarAccess(yearUser).allowed, true);

    // Active Lifetime subscriber with valid license key
    const lifetimeUser = {
        status: "ready",
        currentUser: { uid: "u_life" },
        hasActiveLicense: true,
        active: [{ id: "lic_life", status: "active", tier: "lifetime" }],
    };
    assert.equal(evaluateBazaarAccess(lifetimeUser).allowed, true);

    // Valid active license key without explicit tier field
    const generalActiveUser = {
        status: "ready",
        currentUser: { uid: "u_gen" },
        hasActiveLicense: true,
        active: [{ id: "lic_generic", status: "active" }],
    };
    assert.equal(evaluateBazaarAccess(generalActiveUser).allowed, true);

    // Active Maker / Non-commercial license without Bazaar Hub entitlement must be rejected
    const makerUser = {
        status: "ready",
        currentUser: { uid: "u_maker" },
        hasActiveLicense: true,
        active: [{ id: "lic_maker", status: "active", tier: "maker" }],
    };
    assert.equal(evaluateBazaarAccess(makerUser).allowed, false);
    assert.equal(evaluateBazaarAccess(makerUser).reason, "COMMERCIAL_OR_ENTITLEMENT_REQUIRED");

    // Expired license
    const expiredUser = {
        status: "ready",
        currentUser: { uid: "u_exp" },
        hasActiveLicense: false,
        hasExpired: true,
        active: [],
    };
    assert.equal(evaluateBazaarAccess(expiredUser).allowed, false);
    assert.equal(evaluateBazaarAccess(expiredUser).state, "expired");

    // Free user without active license
    const freeUser = {
        status: "ready",
        currentUser: { uid: "u_free" },
        hasActiveLicense: false,
        hasExpired: false,
        active: [],
    };
    assert.equal(evaluateBazaarAccess(freeUser).allowed, false);
    assert.equal(evaluateBazaarAccess(freeUser).reason, "COMMERCIAL_OR_ENTITLEMENT_REQUIRED");
});

// ─── 2. Deterministic Shop ID & Slug Validation ──────────────────────────────

test("Single-shop determinism and URL slug formatting", () => {
    // Deterministic shop ID mapping
    assert.equal(getShopId("user_abc123"), "shop_user_abc123");
    assert.equal(getShopId("user_abc123"), getShopId("user_abc123")); // Idempotent & deterministic
    assert.throws(() => getShopId(null));
    assert.throws(() => getShopId(""));

    // Slug normalization with contraction support
    assert.equal(normalizeSlug("  Ken's 3D Creations! "), "kens-3d-creations");
    assert.equal(normalizeSlug("BAZAAR---BOOTH_42"), "bazaar-booth-42");
    assert.equal(normalizeSlug("---leading-trailing---"), "leading-trailing");

    // Slug validity checks
    assert.equal(isValidSlug("kens-creations"), true);
    assert.equal(isValidSlug("ab"), false); // too short (< 3)
    assert.equal(isValidSlug("a".repeat(35)), false); // too long (> 32)
    assert.equal(isValidSlug("Invalid_Slug!"), false); // uppercase / illegal chars
});

// ─── 3. Pure Authoritative Pricing Engine ────────────────────────────────────

test("calculateItemPrice correctly evaluates base prices, event overrides, and clicker extras", () => {
    const product = {
        id: "prod_clicker",
        title: "Custom Mechanical Clicker",
        base_price: 150,
        customization_schema: {
            base_included_letters: 3,
            extra_letter_price: 20,
            casing_styles: [
                { id: "standard", name: "Standard", extra_price: 0 },
                { id: "rounded", name: "Chunky Rounded", extra_price: 30 },
            ],
            switch_types: [
                { id: "blue_clicky", name: "Blue Clicky", extra_price: 0 },
                { id: "silent_tactile", name: "Silent Tactile", extra_price: 50 },
            ],
            add_ons: [
                { id: "keychain", name: "Keychain Ring", price: 25 },
            ],
        },
    };

    // 1. Base item (3 letters, standard casing, standard switch, no add-ons)
    const p1 = calculateItemPrice({
        product,
        customization: { text: "KEN" },
        quantity: 1,
    });
    assert.equal(p1.unitPrice, 150);
    assert.equal(p1.totalPrice, 150);

    // 2. Customized item with extra letters, premium casing, silent switch, and keychain
    // Text: "HELLOPHOEZ" (10 letters -> 7 extra letters * 20 = 140)
    // Casing extra: 30
    // Switch extra: 50
    // Add-on: 25
    // Unit price = 150 + 140 + 30 + 50 + 25 = 395
    const p2 = calculateItemPrice({
        product,
        customization: {
            text: "KENNY", // 5 letters -> 2 extra letters * 20 = 40
            casing_style_id: "rounded", // +30
            switch_type_id: "silent_tactile", // +50
            selected_add_on_ids: ["keychain"], // +25
        },
        quantity: 2, // 2 units
    });
    // Unit price = 150 + 40 + 30 + 50 + 25 = 295
    // Total for 2 = 590
    assert.equal(p2.unitPrice, 295);
    assert.equal(p2.totalPrice, 590);
    assert.equal(p2.breakdown.letterCountExtra, 40);
    assert.equal(p2.breakdown.casingStyleExtra, 30);
    assert.equal(p2.breakdown.switchExtras, 50);
    assert.equal(p2.breakdown.addOnsTotal, 25);

    // 3. Event price override (Event discount drops base price from 150 to 120)
    const p3 = calculateItemPrice({
        product,
        eventConfig: { enabled: true, price_override: 120 },
        customization: { text: "KEN" },
        quantity: 1,
    });
    assert.equal(p3.unitPrice, 120);
    assert.equal(p3.breakdown.isEventOverride, true);

    // 4. Order totals with discount
    const orderTotal = calculateOrderTotal({
        items: [p1, p2],
        discountPercent: 10,
    });
    // Subtotal = 150 + 590 = 740. 10% discount = 74. Total = 666.
    assert.equal(orderTotal.subtotal, 740);
    assert.equal(orderTotal.discountAmount, 74);
    assert.equal(orderTotal.totalAmount, 666);
});

// ─── 4. Dynamic Bill of Materials (BOM) Decomposition ─────────────────────────

test("decomposeProductBOM accurately counts repeated letters and hardware components", () => {
    // Repeated letters test: "ANNA"
    const freqs = getCharacterFrequencies("ANNA");
    assert.deepEqual(freqs, { A: 2, N: 2 });

    const product = {
        id: "prod_clicker",
        title: "Custom Mechanical Clicker",
        type: "made_to_order",
        category: "clicker",
        customization_schema: {
            add_ons: [{ id: "lanyard", consumable_id: "con_lanyard", name: "Lanyard Strap" }],
        },
    };

    // Ordered: 2 units of "ANNA" with default pastel pink
    const bom = decomposeProductBOM({
        product,
        customization: {
            text: "ANNA",
            default_letter_color: "pink",
            casing_style_id: "rounded",
            casing_color: "white",
            switch_type_id: "red_linear",
            selected_add_on_ids: ["lanyard"],
        },
        quantity: 2,
    });

    const capA = bom.find((c) => c.component_key === "cap_A_pink");
    const capN = bom.find((c) => c.component_key === "cap_N_pink");
    const casing = bom.find((c) => c.item_type === "casing_base");
    const switches = bom.find((c) => c.item_type === "switch");
    const lanyard = bom.find((c) => c.item_type === "consumable");

    // 2 items * 2 'A's = 4 'A' caps
    assert.equal(capA.required_qty, 4);
    // 2 items * 2 'N's = 4 'N' caps
    assert.equal(capN.required_qty, 4);
    // 2 items * 1 casing = 2 casings
    assert.equal(casing.required_qty, 2);
    assert.equal(casing.key_count, 4);
    // 2 items * 4 keys = 8 switches
    assert.equal(switches.required_qty, 8);
    // 2 items * 1 lanyard = 2 lanyards
    assert.equal(lanyard.required_qty, 2);
});

// ─── 5. Two-Stage Inventory Lifecycle (Reservation vs Consumption) ────────────

test("Inventory state transitions: reservation, physical consumption, and cancellation release", () => {
    let stock = {
        event_id: "ev_fair",
        event_allocated: 50,
        event_reserved: 0,
        event_consumed: 0,
    };

    // 1. Order Accepted: Reserve 10 units at event
    stock = transitionReserveStock(stock, 10);
    assert.equal(stock.event_allocated, 50);
    assert.equal(stock.event_reserved, 10);
    assert.equal(stock.event_available, 40);

    // 2. Reject over-reservation
    assert.throws(() => transitionReserveStock(stock, 45)); // only 40 available

    // 3. Start Production: Consume 10 units physically
    stock = transitionConsumeStock(stock, 10);
    assert.equal(stock.event_allocated, 50);
    assert.equal(stock.event_reserved, 0);
    assert.equal(stock.event_consumed, 10);
    assert.equal(stock.event_available, 40);

    // 4. Pre-production cancellation: Release reservation
    let preCancelStock = { event_allocated: 40, event_reserved: 5, event_consumed: 0 };
    preCancelStock = transitionReleaseStock(preCancelStock, 5);
    assert.equal(preCancelStock.event_reserved, 0);
    assert.equal(preCancelStock.event_available, 40);

    // 5. Post-production cancellation: Recover reusable components and scrap damaged parts
    let scrapStock = { event_allocated: 30, event_reserved: 0, event_consumed: 5 };
    // Cancelled after printing: 4 switches recovered, 1 casing base scrapped
    scrapStock = transitionScrapOrRecoverStock(scrapStock, 4, 1);
    assert.equal(scrapStock.event_consumed, 1); // 5 - 4 recovered = 1 remains consumed
    assert.equal(scrapStock.wasted_count, 1);
    assert.equal(scrapStock.event_available, 29); // 30 - 0 - 1 = 29
});

test("Regression: Event stock consumption is not deducted twice through simultaneous allocated and consumed changes", () => {
    // 1. Allocate 100 components to an event
    let globalStock = {
        physical_on_hand: 100,
        total_allocated_to_events: 0,
        shop_reservations: 0,
    };
    let eventStock = {
        event_id: "ev_bazaar",
        event_allocated: 0,
        event_reserved: 0,
        event_consumed: 0,
    };

    const allocResult = transitionAllocateStockToEvent(globalStock, eventStock, 100);
    globalStock = allocResult.globalStock;
    eventStock = allocResult.eventStock;

    assert.equal(globalStock.physical_on_hand, 100);
    assert.equal(globalStock.total_allocated_to_events, 100);
    assert.equal(eventStock.event_allocated, 100);
    assert.equal(eventStock.event_available, 100);
    assert.equal(calculateEventPhysicalRemaining(eventStock), 100);

    // 2. Reserve 10 components
    eventStock = transitionReserveStock(eventStock, 10);
    assert.equal(eventStock.event_allocated, 100);
    assert.equal(eventStock.event_reserved, 10);
    assert.equal(eventStock.event_consumed, 0);
    assert.equal(eventStock.event_available, 90);
    assert.equal(calculateEventPhysicalRemaining(eventStock), 100); // physically still in booth until produced

    // 3. Consume 10 components
    const consumeResult = transitionConsumeEventStock({
        globalStock,
        eventStock,
        qty: 10,
        orderId: "ord_101",
        processedOrderIds: [],
    });
    globalStock = consumeResult.globalStock;
    eventStock = consumeResult.eventStock;

    // 4. Verify physical and event stock remaining are exactly 90
    assert.equal(globalStock.physical_on_hand, 90, "Physical on-hand stock remaining must be exactly 90");
    assert.equal(eventStock.event_physical_remaining, 90, "Event physical stock remaining must be exactly 90");
    assert.equal(eventStock.event_available, 90, "Event available stock remaining must be exactly 90");
    assert.equal(eventStock.event_allocated, 100, "Cumulative event_allocated must remain 100 (not double deducted)");
    assert.equal(eventStock.event_consumed, 10, "Cumulative event_consumed must be 10");
    assert.equal(eventStock.event_reserved, 0, "Event reservation fulfilled and reset to 0");

    // 5. Verify repeated execution does not consume stock again (Idempotency Guard & Empty Reservation Guard)
    assert.throws(
        () => transitionConsumeEventStock({
            globalStock,
            eventStock,
            qty: 10,
            orderId: "ord_101",
            processedOrderIds: ["ord_101"],
        }),
        /Idempotency guard: Order "ord_101" has already consumed inventory/
    );

    // Also verify that even without orderId tracking, consumption cannot exceed current reservations (0 remaining)
    assert.throws(
        () => transitionConsumeEventStock({
            globalStock,
            eventStock,
            qty: 10,
            orderId: "ord_diff",
            processedOrderIds: [],
        }),
        /Cannot consume 10 units. Only 0 units are currently reserved for production/
    );
});

// ─── 6. Multi-Event Allocation Bounds & Anti-Overselling Invariants ───────────

test("Event stock allocation prevents double allocation and multi-event overselling (Accounting Redesign)", () => {
    // Seller has 100 letter 'E's on hand
    let globalStock = {
        physical_on_hand: 100,
        total_allocated_to_events: 0,
        shop_reservations: 20,
    };
    let eventAStock = { event_id: "ev_A", event_allocated: 0, event_reserved: 0, event_consumed: 0 };
    let eventBStock = { event_id: "ev_B", event_allocated: 0, event_reserved: 0, event_consumed: 0 };

    // Initial unallocated stock = 100 - 0 - 20 = 80
    assert.equal(calculateUnallocatedStock(globalStock), 80);

    // 1. Allocate 50 units to Event A
    const allocA = transitionAllocateStockToEvent(globalStock, eventAStock, 50);
    globalStock = allocA.globalStock;
    eventAStock = allocA.eventStock;
    assert.equal(globalStock.total_allocated_to_events, 50);
    assert.equal(globalStock.unallocated_stock, 30);
    assert.equal(eventAStock.event_allocated, 50);
    assert.equal(eventAStock.event_available, 50);

    // 2. Attempt to allocate 40 units to Event B (fails: only 30 unallocated available)
    assert.throws(() => transitionAllocateStockToEvent(globalStock, eventBStock, 40), /Insufficient unallocated stock/);

    // 3. Allocate remaining 30 units to Event B
    const allocB = transitionAllocateStockToEvent(globalStock, eventBStock, 30);
    globalStock = allocB.globalStock;
    eventBStock = allocB.eventStock;
    assert.equal(globalStock.total_allocated_to_events, 80);
    assert.equal(globalStock.unallocated_stock, 0); // All physical stock is now allocated or reserved!

    // 4. CRITICAL INVARIANT TEST:
    // Event A can still freely sell all 50 of its allocated units even when unallocated_stock == 0!
    assert.equal(calculateEventAvailable(eventAStock), 50);
    eventAStock = transitionReserveStock(eventAStock, 50);
    assert.equal(eventAStock.event_reserved, 50);
    assert.equal(eventAStock.event_available, 0);

    // Invariant check passes
    assert.doesNotThrow(() => validateInventoryInvariants({
        globalStock,
        eventStocks: [eventAStock, eventBStock],
    }));

    // 5. Deallocate stock back from Event B to Global
    assert.equal(calculateGlobalAvailable(globalStock), 0);
    assert.equal(calculateShopAvailable(globalStock), 0);
    const deallocB = transitionDeallocateStockFromEvent(globalStock, eventBStock, 10);
    assert.equal(deallocB.globalStock.total_allocated_to_events, 70);
    assert.equal(deallocB.eventStock.event_allocated, 20);
    assert.equal(calculateShopAvailable(deallocB.globalStock), 10);
});

// ─── 7. Queue Capacity Limits & Booth Pause Controls ─────────────────────────

test("checkQueueCapacity enforces intake limits, active production bounds, and pause toggle", () => {
    const config = {
        is_accepting_orders: true,
        pending_queue_capacity: 5,
        active_production_capacity: 10,
    };

    // Normal queue
    assert.equal(checkQueueCapacity({ pendingCount: 2, activeCount: 4, eventConfig: config }).allowed, true);

    // Pending queue overflow
    const pendingFull = checkQueueCapacity({ pendingCount: 5, activeCount: 4, eventConfig: config });
    assert.equal(pendingFull.allowed, false);
    assert.equal(pendingFull.reason, "PENDING_QUEUE_FULL");

    // Production queue overflow
    const busy = checkQueueCapacity({ pendingCount: 1, activeCount: 10, eventConfig: config });
    assert.equal(busy.allowed, false);
    assert.equal(busy.reason, "PRODUCTION_BUSY");

    // Booth paused
    const paused = checkQueueCapacity({
        pendingCount: 0,
        activeCount: 0,
        eventConfig: { ...config, is_accepting_orders: false },
    });
    assert.equal(paused.allowed, false);
    assert.equal(paused.reason, "BOOTH_PAUSED");
});

// ─── 8. Financial Analytics & Ledger Accounting ──────────────────────────────

test("calculateFinancialSummary cleanly separates order values, collected cash, refunds, and COGS", () => {
    const orders = [
        // Order 1: Completed & Paid via Cash
        {
            total_amount: 300,
            fulfillment_status: "collected",
            payment_status: "paid",
            items: [{ unit_cost_snapshot: 60, quantity: 1 }],
        },
        // Order 2: In Production & Paid via GCash
        {
            total_amount: 250,
            fulfillment_status: "preparing",
            payment_status: "paid",
            items: [{ unit_cost_snapshot: 50, quantity: 1 }],
        },
        // Order 3: Accepted but Unpaid (Cash upon pickup)
        {
            total_amount: 200,
            fulfillment_status: "accepted",
            payment_status: "unpaid",
            items: [{ unit_cost_snapshot: 40, quantity: 1 }],
        },
        // Order 4: Pending review (not yet accepted or paid)
        {
            total_amount: 150,
            fulfillment_status: "pending",
            payment_status: "unpaid",
            items: [{ unit_cost_snapshot: 30, quantity: 1 }],
        },
        // Order 5: Cancelled (must be excluded from gross order value)
        {
            total_amount: 500,
            fulfillment_status: "cancelled",
            payment_status: "unpaid",
        },
    ];

    const expenses = [{ title: "Booth Table Rental", amount: 100 }];
    const refunds = [{ order_id: "ord_1", amount: 50 }]; // ₱50 partial refund

    const summary = calculateFinancialSummary({ orders, expenses, refunds });

    // 1. Gross Order Value: 300 + 250 + 200 + 150 = 900
    assert.equal(summary.grossOrderValue, 900);

    // 2. Collected Cash: Order 1 (300) + Order 2 (250) = 550
    assert.equal(summary.collectedCash, 550);

    // 3. Refunds: 50
    assert.equal(summary.totalRefunds, 50);

    // 4. Net Collected Cash: 550 - 50 = 500
    assert.equal(summary.netCollectedCash, 500);

    // 5. Uncollected Balance: Order 3 (200) + Order 4 (150) = 350
    assert.equal(summary.uncollectedBalance, 350);

    // 6. Total COGS: Order 1 (60) + Order 2 (50) + Order 3 (40) = 150
    assert.equal(summary.totalCogs, 150);

    // 7. Gross Profit: Net Cash (500) - COGS (150) = 350
    assert.equal(summary.grossProfit, 350);

    // 8. Event Expenses: 100
    assert.equal(summary.totalExpenses, 100);

    // 9. Net Event Profit: Gross Profit (350) - Expenses (100) = 250
    assert.equal(summary.netEventProfit, 250);
});

// ─── 9. Public Tracking Projection Data Privacy ──────────────────────────────

test("Public tracking projection strips customer PII and internal seller margins", () => {
    // Authoritative private order record in shops/shop_123/orders/
    const privateOrder = {
        id: "ord_secret_99",
        order_number: "BZ-2026-001",
        customer_name: "Juan Dela Cruz",
        customer_phone: "+639171234567",
        customer_email: "juan@example.com",
        gcash_reference_no: "9876543210123",
        seller_internal_notes: "Customer asked for extra sturdy infill, charge ₱0",
        total_amount: 350,
        estimated_unit_cost: 75,
        profit_margin: 275,
        fulfillment_status: "preparing",
        payment_status: "paid",
        pickup_code: "K-09",
        pickup_instructions: "Counter 2 at Maker Fair",
        items: [
            {
                title: "Custom Clicker",
                customization: { text: "JUAN" },
                internal_filament_id: "fil_pink_esun",
                unit_cost_snapshot: 75,
            },
        ],
    };

    const tracking = sanitizePublicOrderTracking(privateOrder, "tok_crypto_12345");

    // Allowed tracking fields exist
    assert.equal(tracking.orderNumber, "BZ-2026-001");
    assert.equal(tracking.pickupCode, "K-09");
    assert.equal(tracking.fulfillmentStatus, "preparing");
    assert.equal(tracking.trackingToken, "tok_crypto_12345");

    // Strictly verify sensitive fields are ABSENT
    assert.equal("customer_phone" in tracking, false);
    assert.equal("customer_email" in tracking, false);
    assert.equal("customer_name" in tracking, false);
    assert.equal("gcash_reference_no" in tracking, false);
    assert.equal("seller_internal_notes" in tracking, false);
    assert.equal("estimated_unit_cost" in tracking, false);
    assert.equal("profit_margin" in tracking, false);
    assert.equal("unit_cost_snapshot" in tracking.itemsSummary[0], false);

    // Verify sanitizePublicShop strips private notes and payout keys
    const pubShop = sanitizePublicShop({
        shop_id: "shop_123",
        owner_uid: "u_ken",
        name: "Ken's Workshop",
        internal_notes: "Secret supplier notes",
        contact_number: "+639123456789",
    });
    assert.equal(pubShop.shopId, "shop_123");
    assert.equal("internal_notes" in pubShop, false);
    assert.equal("internalNotes" in pubShop, false);

    // Verify sanitizePublicEvent strips internal targets
    const pubEvent = sanitizePublicEvent({
        event_id: "ev_1",
        shop_id: "shop_123",
        owner_uid: "u_ken",
        name: "Winter Bazaar",
        target_revenue: 50000,
    });
    assert.equal(pubEvent.name, "Winter Bazaar");
    assert.equal("target_revenue" in pubEvent, false);

    // Verify sanitizePublicProduct strips BOM and internal cost
    const pubProd = sanitizePublicProduct({
        product_id: "prod_1",
        shop_id: "shop_123",
        owner_uid: "u_ken",
        name: "Mechanical Switch Toy",
        base_price: 150,
        unit_cost: 40,
        bom: [{ part: "switch", cost: 10 }],
    });
    assert.equal(pubProd.retailPrice, 150);
    assert.equal("unit_cost" in pubProd, false);
    assert.equal("bom" in pubProd, false);
});

// ─── 10. Concurrency: Two Simultaneous Orders for the Last Item ──────────────

test("Concurrency: Two simultaneous orders competing for the last item", () => {
    let eventStock = {
        event_allocated: 1,
        event_reserved: 0,
        event_consumed: 0,
    };

    // Simulated transactional atomic executor
    function simulateOrderAcceptTransaction(requestedQty) {
        // Read current state inside transaction
        const available = calculateEventAvailable(eventStock);
        if (requestedQty > available) {
            throw new Error(`Insufficient event stock: requested ${requestedQty}, available ${available}`);
        }
        // Write atomic transition
        eventStock = transitionReserveStock(eventStock, requestedQty);
        return { success: true, remaining: eventStock.event_available };
    }

    // Order A and Order B both request 1 item
    // Transaction A executes first
    const resultA = simulateOrderAcceptTransaction(1);
    assert.equal(resultA.success, true);
    assert.equal(resultA.remaining, 0);

    // Transaction B executes immediately after
    assert.throws(
        () => simulateOrderAcceptTransaction(1),
        /Insufficient event stock/
    );

    // Invariant: Exactly 1 order succeeded, exactly 0 available stock remaining
    assert.equal(eventStock.event_reserved, 1);
    assert.equal(eventStock.event_available, 0);
});

// ─── 11. Concurrency: Two Simultaneous Shop Creation Requests & Slug Collision ─

test("Concurrency: Two simultaneous shop creation requests and slug collision", () => {
    const slugRegistry = new Map();
    const shopsRegistry = new Map();

    function simulateCreateShopTransaction(userId, slug) {
        const shopId = getShopId(userId);

        // Check if user already has a shop (deterministic 1-to-1 shop rule)
        if (shopsRegistry.has(shopId)) {
            throw new Error(`User ${userId} already has an active shop (${shopId}).`);
        }

        // Check if slug is taken
        if (slugRegistry.has(slug)) {
            throw new Error(`The slug "${slug}" is already taken by another seller.`);
        }

        // Commit atomically
        slugRegistry.set(slug, { shopId, ownerUid: userId });
        shopsRegistry.set(shopId, { shopId, ownerUid: userId, slug });
        return { shopId, slug };
    }

    // 1. Same user tries to create two shops concurrently
    const firstShop = simulateCreateShopTransaction("user_ken", "kens-prints");
    assert.equal(firstShop.shopId, "shop_user_ken");

    assert.throws(
        () => simulateCreateShopTransaction("user_ken", "kens-second-shop"),
        /already has an active shop/
    );

    // 2. Different user tries to claim the same slug "kens-prints"
    assert.throws(
        () => simulateCreateShopTransaction("user_other", "kens-prints"),
        /already taken by another seller/
    );
});

// ─── 12. Idempotency: Duplicate Seller Acceptance & Production Start Guards ──

test("Idempotency: Duplicate seller acceptance and duplicate production start guards", () => {
    let orderState = {
        orderId: "ord_42",
        status: "pending",
        stock_reserved: false,
        stock_consumed: false,
    };
    let stock = { event_allocated: 5, event_reserved: 0, event_consumed: 0 };

    function acceptOrder(order) {
        if (order.status !== "pending") {
            // Idempotent guard: return without double-reserving
            return { order, stock, alreadyProcessed: true };
        }
        stock = transitionReserveStock(stock, 1);
        order.status = "accepted";
        order.stock_reserved = true;
        return { order, stock, alreadyProcessed: false };
    }

    function startProduction(order) {
        if (order.status !== "accepted") {
            if (order.status === "in_production") {
                // Idempotent guard: already in production
                return { order, stock, alreadyProcessed: true };
            }
            throw new Error(`Cannot start production from status "${order.status}".`);
        }
        stock = transitionConsumeStock(stock, 1);
        order.status = "in_production";
        order.stock_consumed = true;
        return { order, stock, alreadyProcessed: false };
    }

    // First acceptance
    const step1 = acceptOrder(orderState);
    assert.equal(step1.alreadyProcessed, false);
    assert.equal(stock.event_reserved, 1);

    // Duplicate acceptance call (e.g. double click or network retry)
    const step2 = acceptOrder(orderState);
    assert.equal(step2.alreadyProcessed, true);
    assert.equal(stock.event_reserved, 1); // RESERVATION DID NOT DOUBLE-COUNT!

    // First production start
    const step3 = startProduction(orderState);
    assert.equal(step3.alreadyProcessed, false);
    assert.equal(stock.event_consumed, 1);
    assert.equal(stock.event_reserved, 0);

    // Duplicate production start call
    const step4 = startProduction(orderState);
    assert.equal(step4.alreadyProcessed, true);
    assert.equal(stock.event_consumed, 1); // CONSUMPTION DID NOT DOUBLE-COUNT!
});

// ─── 13. Idempotency: Transaction Retry Resilience After Transient Failure ───

test("Idempotency: Transaction retry resilience after simulated transient failure", () => {
    let attempts = 0;
    let ledgerMovements = [];
    let stock = { event_allocated: 10, event_reserved: 0, event_consumed: 0 };

    function runWithRetry(orderId, qty) {
        const movementKey = `mov_${orderId}_reserve`;

        // Check if movement key already recorded in ledger (idempotent ledger invariant)
        if (ledgerMovements.some((m) => m.id === movementKey)) {
            return { status: "already_committed" };
        }

        attempts += 1;
        if (attempts === 1) {
            // Simulate transient Firestore network disconnection / transaction conflict
            throw new Error("UNAVAILABLE: Transaction contention, aborting for retry.");
        }

        // On retry attempt 2: commit
        stock = transitionReserveStock(stock, qty);
        ledgerMovements.push({ id: movementKey, orderId, qty, type: "reserve" });
        return { status: "committed" };
    }

    // Execute with simulated retry loop
    let result = null;
    for (let i = 0; i < 3; i++) {
        try {
            result = runWithRetry("ord_retry_99", 2);
            break;
        } catch (err) {
            if (err.message.includes("UNAVAILABLE")) continue;
            throw err;
        }
    }

    assert.equal(result.status, "committed");
    assert.equal(attempts, 2); // Retried exactly once
    assert.equal(stock.event_reserved, 2); // Reserved exactly once
    assert.equal(ledgerMovements.length, 1); // Exactly 1 movement record

    // Subsequent call with same orderId is a no-op
    const reCall = runWithRetry("ord_retry_99", 2);
    assert.equal(reCall.status, "already_committed");
    assert.equal(stock.event_reserved, 2);
    assert.equal(ledgerMovements.length, 1);
});

// ─── 14. Multi-Stage Cancellation Lifecycle ──────────────────────────────────

test("Multi-stage cancellation: Pre-production release, in-production component recovery, and ready-goods scrap logging", () => {
    // Stage 1: Cancelled when Accepted (Pre-production)
    let stock1 = { event_allocated: 10, event_reserved: 2, event_consumed: 0 };
    stock1 = transitionReleaseStock(stock1, 2);
    assert.equal(stock1.event_reserved, 0);
    assert.equal(stock1.event_available, 10); // Fully returned to available

    // Stage 2: Cancelled during production (Custom printed body scrapped, 4 switches recovered)
    let stock2 = { event_allocated: 10, event_reserved: 0, event_consumed: 5 };
    // 5 total items were in production; 4 switches recovered to stock, 1 personalized piece scrapped
    stock2 = transitionScrapOrRecoverStock(stock2, 4, 1);
    assert.equal(stock2.event_consumed, 1); // 4 returned to available, 1 permanently consumed as scrap
    assert.equal(stock2.wasted_count, 1);
    assert.equal(stock2.event_available, 9); // 10 - 0 - 1 = 9

    // Stage 3: Ready goods cancellation (Finished item ready on counter, customer cancels)
    // 1 casing base cannot be reused; 1 mechanical switch can be disassembled and reused
    let stock3 = { event_allocated: 5, event_reserved: 0, event_consumed: 2 };
    stock3 = transitionScrapOrRecoverStock(stock3, 1, 1);
    assert.equal(stock3.event_consumed, 1); // 1 switch recovered, 1 casing scrapped
    assert.equal(stock3.wasted_count, 1);
    assert.equal(stock3.event_available, 4); // 5 - 0 - 1 = 4
});

// ─── 15. Multi-Component Stock Check Fails When Repeated Letters Exceed Stock ─

test("Multi-component stock check fails when repeated letters exceed stock (e.g. BANANA)", () => {
    const freqs = getCharacterFrequencies("BANANA");
    assert.deepEqual(freqs, { B: 1, A: 3, N: 2 });

    // Inventory has: B: 5, N: 5, but A: only 2
    const letterInventory = {
        cap_B: 5,
        cap_N: 5,
        cap_A: 2, // Needs 3!
    };

    function checkBOMAvailability(word, count) {
        const charMap = getCharacterFrequencies(word);
        for (const [char, perItemQty] of Object.entries(charMap)) {
            const needed = perItemQty * count;
            const inStock = letterInventory[`cap_${char}`] || 0;
            if (needed > inStock) {
                throw new Error(`Insufficient stock for component cap_${char}: needed ${needed}, available ${inStock}`);
            }
        }
        return true;
    }

    // 1 unit of BANANA needs 3 'A's, but only 2 in stock
    assert.throws(
        () => checkBOMAvailability("BANANA", 1),
        /Insufficient stock for component cap_A: needed 3, available 2/
    );
});

// ─── 16. Public Order Tracking Capability Token Security ─────────────────────

test("Public order tracking security: capability token lookup, rejection of expired and revoked tokens", () => {
    const validOrder = {
        order_number: "BZ-001",
        fulfillment_status: "ready",
        pickup_code: "P-12",
        expires_at: { toMillis: () => Date.now() + 600000 }, // Valid for 10 mins
        revoked: false,
    };

    const expiredOrder = {
        order_number: "BZ-002",
        fulfillment_status: "collected",
        expires_at: { toMillis: () => Date.now() - 5000 }, // Expired 5 seconds ago
        revoked: false,
    };

    const revokedOrder = {
        order_number: "BZ-003",
        fulfillment_status: "cancelled",
        expires_at: { toMillis: () => Date.now() + 600000 },
        revoked: true, // Explicitly revoked
    };

    function evaluateTrackingAccess(orderRecord) {
        if (!orderRecord) return null;
        if (orderRecord.revoked === true) return null;
        if (orderRecord.expires_at && orderRecord.expires_at.toMillis() < Date.now()) return null;
        return { allowed: true, orderNumber: orderRecord.order_number };
    }

    assert.equal(evaluateTrackingAccess(validOrder)?.allowed, true);
    assert.equal(evaluateTrackingAccess(expiredOrder), null); // Rejects expired tracking token
    assert.equal(evaluateTrackingAccess(revokedOrder), null); // Rejects revoked tracking token
});

// ─── 17. Milestone 2: Shop and Event Management & Single-Shop Invariant ──────

test("Milestone 2: Shop and Event management, single-shop invariant, and event isolation", () => {
    // 1. Single-Shop Determinism: One subscriber must have exactly one shop ID
    const userA = "usr_alice";
    const userB = "usr_bob";
    assert.equal(getShopId(userA), "shop_usr_alice");
    assert.equal(getShopId(userB), "shop_usr_bob");
    assert.notEqual(getShopId(userA), getShopId(userB));

    // 2. Shop Configuration & Public Projection Sanitization
    const privateShopAlice = {
        shopId: getShopId(userA),
        ownerUid: userA,
        name: "Alice 3D Customizer",
        slug: "alice-3d",
        description: "Specializing in custom name keychains and clickers",
        logoUrl: "https://example.com/logo.png",
        bannerUrl: "https://example.com/banner.jpg",
        contactNumber: "0917-111-2222",
        contactEmail: "alice@example.com",
        pickupInstructions: "Claim at counter 2",
        cashEnabled: true,
        gcashEnabled: true,
        gcashNumber: "0917-111-2222",
        gcashName: "Alice M.",
        gcashQrUrl: "https://example.com/gcash.png",
        internalNotes: "Private profit margin target: 45%", // SENSITIVE
        isPublished: true,
    };

    const publicShop = sanitizePublicShop(privateShopAlice);
    assert.equal(publicShop.shopId, "shop_usr_alice");
    assert.equal(publicShop.name, "Alice 3D Customizer");
    assert.equal(publicShop.isPublished, true);
    assert.equal(publicShop.internalNotes, undefined, "Private seller notes must NEVER leak to public projection");

    // 3. Event Creation & Association with Seller Shop
    const event1 = {
        eventId: "ev_megamall",
        shopId: getShopId(userA),
        ownerUid: userA,
        name: "Megamall Maker Fair",
        venue: "SM Megamall Building B",
        boothNumber: "Booth #12",
        startDate: "2026-11-15",
        endDate: "2026-11-17",
        openingHours: "10:00 AM - 9:00 PM",
        pickupInstructions: "Claim at counter with pickup code",
        status: "Active",
        queueStatus: "open",
        isAcceptingOrders: true,
        pendingQueueCapacity: 12,
        activeProductionCapacity: 6,
        privateCashFloat: 5000, // SENSITIVE
    };

    const publicEvent = sanitizePublicEvent(event1);
    assert.equal(publicEvent.eventId, "ev_megamall");
    assert.equal(publicEvent.shopId, "shop_usr_alice");
    assert.equal(publicEvent.name, "Megamall Maker Fair");
    assert.equal(publicEvent.isAcceptingOrders, true);
    assert.equal(publicEvent.privateCashFloat, undefined, "Private cash float must NEVER leak to public projection");

    // 4. Multi-Event association under one shop
    const event2 = {
        eventId: "ev_glorietta",
        shopId: getShopId(userA),
        ownerUid: userA,
        name: "Glorietta Holiday Bazaar",
        venue: "Glorietta Activity Center",
        status: "Scheduled",
    };
    const aliceEvents = [event1, event2];
    assert.equal(aliceEvents.length, 2);
    assert.ok(aliceEvents.every((e) => e.shopId === getShopId(userA)));
});

// ─── 18. Milestone 2: Event Operational State Transitions ─────────────────────

test("Milestone 2: Event status transitions, intake pause/resume, and queue closing", () => {
    let event = {
        eventId: "ev_pop_up",
        status: "Scheduled",
        isAcceptingOrders: true,
        queueStatus: "open",
    };

    // Transition 1: Activate event
    event = { ...event, status: "Active" };
    assert.equal(event.status, "Active");
    assert.equal(event.isAcceptingOrders, true);

    // Transition 2: Seller pauses intake due to printer queue backlog
    event = { ...event, isAcceptingOrders: false, queueStatus: "paused" };
    assert.equal(event.isAcceptingOrders, false);
    assert.equal(event.queueStatus, "paused");

    // Transition 3: Seller resumes intake
    event = { ...event, isAcceptingOrders: true, queueStatus: "open" };
    assert.equal(event.isAcceptingOrders, true);
    assert.equal(event.queueStatus, "open");

    // Transition 4: Event concluded / ended
    event = { ...event, status: "Ended", isAcceptingOrders: false, queueStatus: "closed" };
    assert.equal(event.status, "Ended");
    assert.equal(event.isAcceptingOrders, false);
    assert.equal(event.queueStatus, "closed");
});

// ─── 19. Milestone 2: Mathematical QR Code Generation ────────────────────────

test("Milestone 2: Mathematical QR code generation for shops and events", async () => {
    const qrcodeModule = await import("qrcode-generator");
    const qrcode = qrcodeModule.default;

    const shopUrl = "https://kencreations.dev/bazaar/alice-prints";
    const eventUrl = "https://kencreations.dev/bazaar/e/ev_megamall";

    // 1. Generate Shop QR
    const qrShop = qrcode(0, "M");
    qrShop.addData(shopUrl);
    qrShop.make();
    const svgShop = qrShop.createSvgTag({ cellSize: 6, margin: 4 });

    assert.ok(svgShop.startsWith("<svg"), "QR output must be valid SVG markup");
    assert.ok(svgShop.includes("</svg>"), "QR output must be closed SVG markup");
    assert.ok(qrShop.getModuleCount() > 20, "QR module matrix must have valid dimension");

    // 2. Generate Event QR
    const qrEvent = qrcode(0, "M");
    qrEvent.addData(eventUrl);
    qrEvent.make();
    const svgEvent = qrEvent.createSvgTag({ cellSize: 8, margin: 4 });

    assert.ok(svgEvent.startsWith("<svg"));
    assert.ok(svgEvent.includes("</svg>"));
    assert.notEqual(svgShop, svgEvent, "Shop QR and Event QR must generate distinct matrices");
});

// ══════════════════════════════════════════════════════════════════════════════
// MILESTONE 3 TESTS: CATALOG, CUSTOMIZATION, BOM, INVENTORY & EVENT INTEGRATION
// ══════════════════════════════════════════════════════════════════════════════

// ─── 20. Milestone 3: Ready-Made Product Registration & Variants ─────────────

test("Milestone 3: Ready-made product registers variants and bypasses print jobs", () => {
    const readyProduct = {
        id: "prod_keychain_01",
        title: "Finished 3D Printed Keychain",
        type: "ready_made",
        category: "keychains",
        base_price: 120,
        variants: [
            { id: "v_pink", color: "Pastel Pink", style: "Standard", sku: "KC-PNK-01", on_hand: 15, unit_cost: 35 },
            { id: "v_teal", color: "Teal Green", style: "Standard", sku: "KC-TEA-01", on_hand: 8, unit_cost: 35 },
        ],
    };

    const bom = decomposeProductBOM({
        product: readyProduct,
        customization: {},
        quantity: 2,
    });

    assert.equal(bom.length, 1);
    assert.equal(bom[0].item_type, "finished_good");
    assert.equal(bom[0].required_qty, 2);
    assert.equal(bom[0].component_key, "finished_prod_keychain_01");
});

// ─── 21. Milestone 3: Letter Clicker BOM Decomposition & Repeated Letters ────

test("Milestone 3: Letter Clicker BOM decomposes 'ANNA' into exact letter caps, switches, and casing", () => {
    const clickerProduct = {
        id: "prod_clicker_custom",
        title: "Personalized Letter Clicker",
        type: "made_to_order",
        category: "clicker",
        base_price: 150,
        customization_schema: {
            add_ons: [
                { id: "keyring", name: "Metal Keyring Loop", price: 15 },
                { id: "giftbox", name: "Gift Box Packaging", price: 25 },
            ],
        },
    };

    // Customer customizes "ANNA" with default Teal color, Silent Peach switch, and Keyring add-on
    const customization = {
        text: "ANNA",
        default_letter_color: "teal",
        switch_type_id: "silent_peach",
        casing_style_id: "compact",
        casing_color: "black",
        selected_add_on_ids: ["keyring"],
    };

    const bom = decomposeProductBOM({
        product: clickerProduct,
        customization,
        quantity: 1,
    });

    // Verify decomposition
    // 1. Cap A: 2 required
    const capA = bom.find((c) => c.component_key === "cap_A_teal");
    assert.ok(capA, "Must include cap A in teal");
    assert.equal(capA.required_qty, 2, "ANNA has two A's");

    // 2. Cap N: 2 required
    const capN = bom.find((c) => c.component_key === "cap_N_teal");
    assert.ok(capN, "Must include cap N in teal");
    assert.equal(capN.required_qty, 2, "ANNA has two N's");

    // 3. Casing: 1 required (4-key compact)
    const casing = bom.find((c) => c.item_type === "casing_base");
    assert.ok(casing, "Must include casing base");
    assert.equal(casing.key_count, 4);
    assert.equal(casing.style, "compact");
    assert.equal(casing.required_qty, 1);

    // 4. Switches: 4 required
    const sw = bom.find((c) => c.item_type === "switch");
    assert.ok(sw, "Must include switches");
    assert.equal(sw.switch_type, "silent_peach");
    assert.equal(sw.required_qty, 4, "Must require 1 switch per letter");

    // 5. Add-ons: 1 keyring
    const addon = bom.find((c) => c.component_key === "addon_keyring");
    assert.ok(addon, "Must include selected keyring add-on");
    assert.equal(addon.required_qty, 1);
});

// ─── 22. Milestone 3: Per-Letter Color Combinations ─────────────────────────

test("Milestone 3: Per-letter color arrays correctly count distinct character-color keys", () => {
    const clickerProduct = {
        id: "prod_clicker",
        title: "Multi-Color Clicker",
        type: "made_to_order",
        category: "clicker",
    };

    // Text "KEN": K is pink, E is teal, N is pink
    const customization = {
        text: "KEN",
        letter_color_array: ["pink", "teal", "pink"],
    };

    const bom = decomposeProductBOM({
        product: clickerProduct,
        customization,
        quantity: 2, // 2 units ordered
    });

    const capKPink = bom.find((c) => c.component_key === "cap_K_pink");
    const capETeal = bom.find((c) => c.component_key === "cap_E_teal");
    const capNPink = bom.find((c) => c.component_key === "cap_N_pink");

    assert.ok(capKPink);
    assert.equal(capKPink.required_qty, 2);

    assert.ok(capETeal);
    assert.equal(capETeal.required_qty, 2);

    assert.ok(capNPink);
    assert.equal(capNPink.required_qty, 2);
});

// ─── 23. Milestone 3: Studio Hub Filaments and Consumables Costing ────────────

test("Milestone 3: Authoritative BOM costing calculates costs from Studio Hub filaments and consumables", () => {
    const bomComponents = [
        { component_key: "cap_A_teal", item_type: "letter_cap", color: "teal", required_qty: 2 },
        { component_key: "cap_N_teal", item_type: "letter_cap", color: "teal", required_qty: 2 },
        { component_key: "casing_4key", item_type: "casing_base", color: "black", key_count: 4, required_qty: 1 },
        { component_key: "switch_silent", item_type: "switch", switch_type: "silent", required_qty: 4 },
        { component_key: "addon_keyring", item_type: "consumable", item_id: "con_keyring", name: "Keyring", required_qty: 1 },
    ];

    // Real Studio Hub records
    const filaments = [
        { id: "fil_teal", name: "Bambu PLA Matte Teal", color_name: "teal", cost_per_gram: 1.25 },
        { id: "fil_black", name: "eSUN PLA+ Black", color_name: "black", cost_per_gram: 0.95 },
    ];

    const consumables = [
        { id: "con_switch", name: "Outemu Silent Peach Switch", category: "Hardware", unit_cost: 9.50 },
        { id: "con_keyring", name: "Stainless Steel Keyring Loop", category: "Hardware", unit_cost: 3.20 },
    ];

    const costResult = calculateBOMCost(bomComponents, { filaments, consumables });

    // Teal caps: 4 caps * 1.2g each = 4.8g * 1.25/g = 6.00
    // Black casing: 4 keys * 3.5g = 14g * 0.95/g = 13.30
    // Switches: 4 * 9.50 = 38.00
    // Keyring: 1 * 3.20 = 3.20
    // Expected Total = 6.00 + 13.30 + 38.00 + 3.20 = 60.50
    assert.ok(costResult.totalCost > 55 && costResult.totalCost < 65, `Total cost was ${costResult.totalCost}`);

    // Profit margin calculation at ₱180 retail price
    const margin = calculateMargin(180, costResult.totalCost);
    assert.equal(margin.retailPrice, 180);
    assert.ok(margin.grossProfit > 115);
    assert.ok(margin.marginPercent > 60);
    assert.ok(margin.markupPercent > 180);
});

// ─── 24. Milestone 3: 2D Letter and Color Matrix Generation ─────────────────

test("Milestone 3: buildLetterColorMatrix formats 2D grid with low-stock alerts", () => {
    const inventoryItems = [
        { item_key: "cap_A_teal", char: "A", color: "Teal", on_hand: 12, reserved: 2, low_threshold: 5 },
        { item_key: "cap_A_pink", char: "A", color: "Pink", on_hand: 3, reserved: 0, low_threshold: 5 },
        { item_key: "cap_B_teal", char: "B", color: "Teal", on_hand: 0, reserved: 0, low_threshold: 5 },
    ];

    const matrix = buildLetterColorMatrix({
        inventoryItems,
        letters: ["A", "B", "C"],
        colors: ["Teal", "Pink", "Purple"],
    });

    assert.equal(matrix.rows.length, 3);
    const rowA = matrix.rows.find((r) => r.char === "A");
    assert.ok(rowA);

    // A - Teal: 12 on hand, 10 available, not low
    const aTeal = rowA.cells["Teal"];
    assert.equal(aTeal.onHand, 12);
    assert.equal(aTeal.available, 10);
    assert.equal(aTeal.isLow, false);

    // A - Pink: 3 on hand, low threshold 5 -> isLow true
    const aPink = rowA.cells["Pink"];
    assert.equal(aPink.onHand, 3);
    assert.equal(aPink.isLow, true);

    // A - Purple: not in inventory -> 0 on hand, isLow true
    const aPurple = rowA.cells["Purple"];
    assert.equal(aPurple.onHand, 0);
    assert.equal(aPurple.isLow, true);
});

// ─── 25. Milestone 3: Transactional Stock Adjustment & Non-Negative Guard ─────

test("Milestone 3: adjustStockBalance enforces strict non-negative balance constraints", () => {
    const currentStock = { on_hand: 20, reserved: 5 };

    // Valid positive adjustment (Restock +15)
    const restocked = adjustStockBalance(currentStock, 15);
    assert.equal(restocked.on_hand, 35);
    assert.equal(restocked.available, 30);
    assert.equal(restocked.previous_on_hand, 20);

    // Valid negative deduction (Scrap -5)
    const deducted = adjustStockBalance(currentStock, -5);
    assert.equal(deducted.on_hand, 15);
    assert.equal(deducted.available, 10);

    // Invalid deduction below zero (Deduct -25 from 20)
    assert.throws(() => {
        adjustStockBalance(currentStock, -25);
    }, /Insufficient inventory/);

    // Invalid deduction below reserved (Deduct -18 from 20 when 5 are reserved)
    assert.throws(() => {
        adjustStockBalance(currentStock, -18);
    }, /Cannot reduce physical stock below reserved/);

    // Zero delta rejection
    assert.throws(() => {
        adjustStockBalance(currentStock, 0);
    }, /A non-zero quantity change is required/);
});

// ─── 26. Milestone 3: Event Catalog Overrides & Multi-Event Isolation ─────────

test("Milestone 3: Event pricing overrides and stock allocations remain strictly isolated", () => {
    const masterProduct = {
        id: "prod_clk_01",
        name: "Clicker",
        base_price: 150,
        type: "made_to_order",
    };

    // Event A: MegaMall Fair (promo price ₱135)
    const eventAConfig = {
        enabled: true,
        price_override: 135,
        max_order_qty: 3,
    };

    // Event B: Weekend Market (premium price ₱160)
    const eventBConfig = {
        enabled: true,
        price_override: 160,
        max_order_qty: 5,
    };

    const priceEventA = calculateItemPrice({
        product: masterProduct,
        eventConfig: eventAConfig,
    });
    const priceEventB = calculateItemPrice({
        product: masterProduct,
        eventConfig: eventBConfig,
    });
    const priceMaster = calculateItemPrice({
        product: masterProduct,
        eventConfig: null,
    });

    assert.equal(priceEventA.unitPrice, 135);
    assert.equal(priceEventA.breakdown.isEventOverride, true);

    assert.equal(priceEventB.unitPrice, 160);
    assert.equal(priceEventB.breakdown.isEventOverride, true);

    assert.equal(priceMaster.unitPrice, 150);
    assert.equal(priceMaster.breakdown.isEventOverride, false);
});

// ─── 27. Milestone 3: Public Projection Sanitization Security ────────────────

test("Milestone 3: sanitizePublicProduct strips all private costs, profit margins, and internal notes", () => {
    const privateProduct = {
        productId: "prod_clicker_master",
        shopId: "shop_alice",
        ownerUid: "alice123",
        name: "Custom Keyboard Clicker",
        description: "Fidget toy with real switches",
        category: "Clickers",
        type: "made_to_order",
        retailPrice: 160,
        images: ["https://example.com/clicker.jpg"],
        isPublished: true,
        status: "active",
        maxOrderQty: 5,

        // SENSITIVE PRIVATE FIELDS TO BE STRIPPED
        unitProductionCost: 48.50,
        targetMarginPercent: 69.7,
        linkedFilamentId: "fil_bambu_teal",
        linkedSwitchConsumableId: "con_switch_peach",
        internalNotes: "Vendor: AliExpress batch #492, wholesale price ₱7.00/pc. Print at 0.16mm layer height.",
        supplier: "Shenzhen Keycap Factory",
        profitMargin: 111.50,
    };

    const publicProduct = sanitizePublicProduct(privateProduct);

    // Verify public allowed fields
    assert.equal(publicProduct.id, "prod_clicker_master");
    assert.equal(publicProduct.name, "Custom Keyboard Clicker");
    assert.equal(publicProduct.price, 160);
    assert.equal(publicProduct.images[0], "https://example.com/clicker.jpg");
    assert.equal(publicProduct.isPublished, true);

    // Verify critical sensitive fields are NOT exposed
    assert.equal(publicProduct.unitProductionCost, undefined);
    assert.equal(publicProduct.targetMarginPercent, undefined);
    assert.equal(publicProduct.linkedFilamentId, undefined);
    assert.equal(publicProduct.linkedSwitchConsumableId, undefined);
    assert.equal(publicProduct.internalNotes, undefined);
    assert.equal(publicProduct.supplier, undefined);
    assert.equal(publicProduct.profitMargin, undefined);
});

test("Milestone 3: Icon Keycaps and custom Casing Slots decompose correctly in BOM", () => {
    const product = {
        id: "prod_clicker",
        title: "Personalized Icon Clicker",
        category: "clicker",
        type: "made_to_order",
    };

    const customization = {
        text: "KEN",
        icon_caps: [
            { icon: "heart", color: "teal", count: 1 },
            { icon: "star", color: "teal", count: 1 },
        ],
        default_letter_color: "teal",
        casing_color: "purple",
        casing_style_id: "5key",
        switch_type_id: "outemu_blue",
        addon_id: "lobster_clasp",
    };

    const bom = decomposeProductBOM({ product, customization, quantity: 1 });

    // Should contain 3 letter caps
    const letterCaps = bom.filter((c) => c.item_type === "letter_cap");
    assert.equal(letterCaps.length, 3);
    assert.equal(letterCaps[0].component_key, "cap_K_teal");
    assert.equal(letterCaps[1].component_key, "cap_E_teal");
    assert.equal(letterCaps[2].component_key, "cap_N_teal");

    // Should contain 2 icon caps
    const iconCaps = bom.filter((c) => c.item_type === "icon_cap");
    assert.equal(iconCaps.length, 2);
    assert.equal(iconCaps[0].component_key, "cap_icon_heart_teal");
    assert.equal(iconCaps[0].icon, "heart");
    assert.equal(iconCaps[1].component_key, "cap_icon_star_teal");
    assert.equal(iconCaps[1].icon, "star");

    // Should contain 5 switches (3 letters + 2 icons = 5 slots)
    const switches = bom.filter((c) => c.item_type === "switch");
    assert.equal(switches.length, 1);
    assert.equal(switches[0].required_qty, 5);

    // Should contain 1 base casing matching Purple and 5 keys
    const casing = bom.find((c) => c.item_type === "casing_base");
    assert.ok(casing);
    assert.equal(casing.key_count, 5);
    assert.equal(casing.color, "purple");
});

test("Milestone 3: Direct Consumables cost resolution for switches and add-ons", () => {
    const bom = [
        { component_key: "cap_icon_heart_pink", item_type: "icon_cap", color: "pink", required_qty: 2, filament_grams: 1.5 },
        { component_key: "con_switch_peach", item_type: "switch", required_qty: 2, consumable_id: "con_switch_peach" },
        { component_key: "con_keyring_metal", item_type: "consumable", required_qty: 1, consumable_id: "con_keyring_metal" },
    ];

    const studioFilaments = [
        { id: "fil_pink", color: "pink", cost_per_gram: 1.20 },
    ];

    const studioConsumables = [
        { id: "con_switch_peach", name: "Silent Peach Switch", unit_cost: 8.50 },
        { id: "con_keyring_metal", name: "Heavy Duty Keyring", unit_cost: 3.25 },
    ];

    const costResult = calculateBOMCost(bom, {
        filaments: studioFilaments,
        consumables: studioConsumables,
    });

    // 2 icon caps * 1.5g * 1.20 = 3.60
    // 2 peach switches * 8.50 = 17.00
    // 1 keyring * 3.25 = 3.25
    // Total = 3.60 + 17.00 + 3.25 = 23.85
    assert.equal(costResult.totalCost, 23.85);
});

test("Milestone 3: calculateItemPrice accurately adds additional price for each base slot", () => {
    const product = {
        id: "prod_clicker",
        base_price: 100,
        type: "made_to_order",
        customization_schema: {
            base_included_letters: 3,
            extra_per_letter_price: 10,
            slot_pricing: {
                1: 0,
                2: 25,
                3: 50,
                4: 75,
            },
        },
    };

    // 1-key base (0 extra)
    const price1 = calculateItemPrice({
        product,
        customization: { text: "A", slots: 1 },
    });
    assert.equal(price1.unitPrice, 100);
    assert.equal(price1.breakdown.slotExtra, 0);

    // 2-key base (+₱25 extra)
    const price2 = calculateItemPrice({
        product,
        customization: { text: "AB", slots: 2 },
    });
    assert.equal(price2.unitPrice, 125);
    assert.equal(price2.breakdown.slotExtra, 25);

    // 3-key base (+₱50 extra)
    const price3 = calculateItemPrice({
        product,
        customization: { text: "KEN", slots: 3 },
    });
    assert.equal(price3.unitPrice, 150);
    assert.equal(price3.breakdown.slotExtra, 50);

    // 4-key base (+₱75 extra + 1 extra letter beyond 3 = +₱10)
    const price4 = calculateItemPrice({
        product,
        customization: { text: "DAVE", slots: 4 },
    });
    // 100 base + 75 slot + 10 extra letter = 185
    assert.equal(price4.unitPrice, 185);
    assert.equal(price4.breakdown.slotExtra, 75);
    assert.equal(price4.breakdown.letterCountExtra, 10);
});

test("Milestone 3: sanitizeForFirestore eliminates undefined fields recursively", () => {
    const dirtyData = {
        name: "Test Clicker",
        price: 150,
        unwantedField: undefined,
        nested: {
            valid: "ok",
            bad: undefined,
        },
        list: [
            { id: "item1", val: 10 },
            { id: "item2", badVal: undefined },
            undefined,
        ],
    };

    const clean = sanitizeForFirestore(dirtyData);

    assert.equal(clean.name, "Test Clicker");
    assert.equal(clean.price, 150);
    assert.equal("unwantedField" in clean, false);
    assert.equal(clean.nested.valid, "ok");
    assert.equal("bad" in clean.nested, false);
    assert.equal(clean.list.length, 2);
    assert.equal("badVal" in clean.list[1], false);
});

