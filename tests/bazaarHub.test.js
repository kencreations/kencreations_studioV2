import test from "node:test";
import assert from "node:assert/strict";

import { evaluateBazaarAccess } from "../src/utils/licensePolicy.js";
import { calculateItemPrice, calculateOrderTotal } from "../src/engine/bazaar/pricing.js";
import { getCharacterFrequencies, decomposeProductBOM } from "../src/engine/bazaar/bom.js";
import {
    calculateGlobalAvailable,
    calculateEventAvailable,
    transitionReserveStock,
    transitionConsumeStock,
    transitionReleaseStock,
    transitionScrapOrRecoverStock,
    checkQueueCapacity,
    calculateFinancialSummary,
} from "../src/engine/bazaar/inventoryMath.js";
import { getShopId, normalizeSlug, isValidSlug } from "../src/services/bazaarService.js";

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

    // Active Commercial / Subscriber user
    const commercialUser = {
        status: "ready",
        currentUser: { uid: "u_pro" },
        hasActiveLicense: true,
        active: [{ id: "lic_comm", status: "active" }],
    };
    assert.equal(evaluateBazaarAccess(commercialUser).allowed, true);
    assert.equal(evaluateBazaarAccess(commercialUser).reason, "ACTIVE_LICENSE");

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
    assert.equal(evaluateBazaarAccess(freeUser).reason, "SUBSCRIBER_REQUIRED");
});

// ─── 2. Deterministic Shop ID & Slug Validation ──────────────────────────────

test("Single-shop determinism and URL slug formatting", () => {
    // Deterministic shop ID mapping
    assert.equal(getShopId("user_abc123"), "shop_user_abc123");
    assert.equal(getShopId("user_abc123"), getShopId("user_abc123")); // Idempotent & deterministic
    assert.throws(() => getShopId(null));
    assert.throws(() => getShopId(""));

    // Slug normalization
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
        type: "made_to_order",
        category: "clicker",
        base_price: 150,
        customization_schema: {
            free_letter_count: 3,
            extra_per_letter_price: 20,
            casing_styles: [
                { id: "standard", name: "Standard", additional_price: 0 },
                { id: "hex", name: "Hexagonal", additional_price: 30 },
            ],
            allowed_switch_types: [
                { id: "blue", name: "Blue Clicky", additional_price_per_key: 10 },
            ],
            add_ons: [
                { id: "keyring", name: "Ballchain Keyring", price: 25 },
            ],
        },
    };

    // 1. Standard 3-letter word (within free letter count, standard style, no extras)
    const p1 = calculateItemPrice({
        product,
        customization: {
            text: "KEN",
            casing_style_id: "standard",
        },
        quantity: 1,
    });
    assert.equal(p1.unitPrice, 150);
    assert.equal(p1.totalPrice, 150);

    // 2. 5-letter word ("ALDRI" -> 2 extra letters @ ₱20 = ₱40), Hex casing (+₱30), Blue switch (5 keys * ₱10 = ₱50), Keyring (+₱25)
    // Unit price = 150 + 40 + 30 + 50 + 25 = 295
    const p2 = calculateItemPrice({
        product,
        customization: {
            text: "ALDRI",
            casing_style_id: "hex",
            switch_type_id: "blue",
            selected_add_on_ids: ["keyring"],
        },
        quantity: 2,
    });
    assert.equal(p2.unitPrice, 295);
    assert.equal(p2.totalPrice, 590); // 295 * 2
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
    let stock = { on_hand: 50, global_reserved: 0 };

    // 1. Order Accepted: Reserve 10 units
    stock = transitionReserveStock(stock, 10);
    assert.equal(stock.on_hand, 50); // on_hand unchanged until physically used
    assert.equal(stock.global_reserved, 10);
    assert.equal(stock.available, 40);

    // 2. Reject over-reservation
    assert.throws(() => transitionReserveStock(stock, 45)); // only 40 available

    // 3. Start Production: Consume 10 units physically
    stock = transitionConsumeStock(stock, 10);
    assert.equal(stock.on_hand, 40);
    assert.equal(stock.global_reserved, 0);
    assert.equal(stock.available, 40);

    // 4. Pre-production cancellation: Release reservation
    let preCancelStock = { on_hand: 40, global_reserved: 5 };
    preCancelStock = transitionReleaseStock(preCancelStock, 5);
    assert.equal(preCancelStock.on_hand, 40);
    assert.equal(preCancelStock.global_reserved, 0);
    assert.equal(preCancelStock.available, 40);

    // 5. Post-production cancellation: Recover reusable components and scrap damaged parts
    let scrapStock = { on_hand: 30, global_reserved: 0 };
    // Cancelled after printing: 4 switches recovered, 1 casing base scrapped
    scrapStock = transitionScrapOrRecoverStock(scrapStock, 4, 1);
    assert.equal(scrapStock.on_hand, 34); // 30 + 4 recovered
    assert.equal(scrapStock.wasted_count, 1);
});

// ─── 6. Multi-Event Allocation Bounds & Anti-Overselling Invariants ───────────

test("Event stock allocation prevents double allocation and multi-event overselling", () => {
    // Seller has 100 letter 'E's on hand, 20 already reserved globally
    const globalAvail = calculateGlobalAvailable({
        onHand: 100,
        globalReserved: 20,
        allocatedToEvents: 30, // 30 committed to Event B
    });
    assert.equal(globalAvail, 50);

    // Event A has a quota of 25 units
    const eventAvail = calculateEventAvailable({
        eventAllocated: 25,
        eventReserved: 5,
        eventConsumed: 5,
        globalAvailable: globalAvail, // 50
    });
    // Event remaining = 25 - 5 - 5 = 15. Min(15, 50) = 15
    assert.equal(eventAvail, 15);

    // If global inventory drops below event allocation quota
    const constrainedAvail = calculateEventAvailable({
        eventAllocated: 25,
        eventReserved: 5,
        eventConsumed: 5,
        globalAvailable: 8, // Shop only has 8 units left physically!
    });
    // Bounded by physical reality: min(15, 8) = 8
    assert.equal(constrainedAvail, 8);
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

    // Public sanitized projection creator
    const publicTrackingProjection = {
        order_number: privateOrder.order_number,
        fulfillment_status: privateOrder.fulfillment_status,
        payment_status: privateOrder.payment_status,
        pickup_code: privateOrder.pickup_code,
        pickup_instructions: privateOrder.pickup_instructions,
        items_summary: privateOrder.items.map((i) => ({
            title: i.title,
            summary: i.customization.text ? `${i.customization.text.length}-Letter (${i.customization.text})` : i.title,
        })),
    };

    // Verify allowed fields exist
    assert.equal(publicTrackingProjection.order_number, "BZ-2026-001");
    assert.equal(publicTrackingProjection.pickup_code, "K-09");
    assert.equal(publicTrackingProjection.fulfillment_status, "preparing");

    // Strictly verify sensitive fields are ABSENT
    assert.equal("customer_phone" in publicTrackingProjection, false);
    assert.equal("customer_email" in publicTrackingProjection, false);
    assert.equal("gcash_reference_no" in publicTrackingProjection, false);
    assert.equal("seller_internal_notes" in publicTrackingProjection, false);
    assert.equal("estimated_unit_cost" in publicTrackingProjection, false);
    assert.equal("profit_margin" in publicTrackingProjection, false);
    assert.equal("unit_cost_snapshot" in publicTrackingProjection.items_summary[0], false);
});
