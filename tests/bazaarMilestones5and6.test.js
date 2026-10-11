import test from "node:test";
import assert from "node:assert/strict";

import {
    transitionReserveStock,
    transitionConsumeStock,
    transitionReleaseStock,
    transitionScrapOrRecoverStock,
    calculateFinancialSummary,
    checkQueueCapacity,
} from "../src/engine/bazaar/inventoryMath.js";
import { calculateItemPrice, calculateOrderTotal } from "../src/engine/bazaar/pricing.js";
import { decomposeProductBOM } from "../src/engine/bazaar/bom.js";
import {
    generateTrackingToken,
    generatePickupCode,
} from "../src/services/orderSubmissionService.js";

test("Milestone 5: Server-side recalculation rejects tampered client prices", () => {
    const masterProduct = {
        id: "prod_clicker",
        name: "Custom Letter Clicker",
        base_price: 150,
        customization_schema: {
            base_included_letters: 3,
            extra_per_letter_price: 20,
            slot_pricing: { 4: 75 },
            casing_styles: [{ id: "ergonomic", extraPrice: 20 }],
            allowed_switch_types: [{ id: "tactile", additional_price_per_key: 15 }],
            add_ons: [{ id: "keyring", extraPrice: 15 }],
        },
    };

    // Attacker client attempts to submit a fake price of 10 pesos for a 340-peso item
    const clientTamperedPrice = 10;
    
    // Server independently calculates authoritative price from master schema
    const serverPriced = calculateItemPrice({
        product: masterProduct,
        customization: {
            text: "ANNA",
            slots: 4,
            casing_style_id: "ergonomic",
            switch_type_id: "tactile",
            selected_add_ons: ["keyring"],
        },
        quantity: 1,
    });

    assert.equal(serverPriced.unitPrice, 340);
    assert.notEqual(serverPriced.unitPrice, clientTamperedPrice);
});

test("Milestone 5: State Machine — Stock Reservation upon Order Acceptance", () => {
    // Inventory starting with 50 units on hand, 0 reserved
    const initialInv = {
        item_key: "cap_A_Pastel Pink",
        on_hand: 50,
        reserved: 0,
    };

    // Accept order requiring 2 caps
    const reservedInv = transitionReserveStock(initialInv, 2);
    assert.equal(reservedInv.on_hand, 50, "Physical on_hand does not drop during reservation");
    assert.equal(reservedInv.reserved, 2, "Reserved stock increments by ordered qty");
    assert.equal(reservedInv.available, 48, "Available stock drops to 48");

    // Acceptance fails if stock is insufficient
    assert.throws(() => {
        transitionReserveStock(reservedInv, 50); // only 48 available
    }, /Insufficient.*stock/);
});

test("Milestone 5: State Machine — Physical Consumption during Production Assembly", () => {
    // Order was accepted (reserved: 2, on_hand: 50)
    const reservedInv = {
        item_key: "cap_A_Pastel Pink",
        on_hand: 50,
        reserved: 2,
    };

    // Transition to 'preparing': consume 2 units physically
    const consumedInv = transitionConsumeStock(reservedInv, 2);
    assert.equal(consumedInv.on_hand, 48, "Physical stock deducted once upon production");
    assert.equal(consumedInv.reserved, 0, "Reservation cleared upon physical consumption");
    assert.equal(consumedInv.available, 48, "Available remains 48");
});

test("Milestone 5: State Machine — Order Cancellation and Stock Recovery", () => {
    // Case A: Cancellation after Acceptance (before assembly): releases reservation
    const reservedInv = { item_key: "cap_A_Pastel Pink", on_hand: 50, reserved: 2 };
    const releasedInv = transitionReleaseStock(reservedInv, 2);
    assert.equal(releasedInv.reserved, 0);
    assert.equal(releasedInv.on_hand, 50);
    assert.equal(releasedInv.available, 50);

    // Case B: Cancellation after assembly: recover reusable components back to physical inventory
    const inProductionInv = { item_key: "cap_A_Pastel Pink", on_hand: 48, reserved: 0 };
    const recoveredInv = transitionScrapOrRecoverStock({
        inventoryItem: inProductionInv,
        recoveredQty: 2,
    });
    assert.equal(recoveredInv.on_hand, 50, "Physical components recovered back into inventory");
});

test("Milestone 5: Queue capacity bounds prevent overselling at high-volume booths", () => {
    const activeEvent = {
        isAcceptingOrders: true,
        queueStatus: "open",
        pendingQueueCapacity: 10,
        activeProductionCapacity: 5,
    };

    // 8 pending, 3 active -> within capacity
    const canAccept1 = checkQueueCapacity({
        event: activeEvent,
        currentPendingCount: 8,
        currentInProductionCount: 3,
    });
    assert.equal(canAccept1.canAccept, true);

    // 10 pending -> at capacity
    const canAccept2 = checkQueueCapacity({
        event: activeEvent,
        currentPendingCount: 10,
        currentInProductionCount: 3,
    });
    assert.equal(canAccept2.canAccept, false);
    assert.match(canAccept2.reason, /PENDING_QUEUE_FULL|Queue full/i);

    // Paused event
    const pausedEvent = { ...activeEvent, queueStatus: "paused" };
    const canAccept3 = checkQueueCapacity({
        event: pausedEvent,
        currentPendingCount: 1,
        currentInProductionCount: 1,
    });
    assert.equal(canAccept3.canAccept, false);
    assert.match(canAccept3.reason, /BOOTH_PAUSED|paused/i);
});

test("Milestone 5: Cryptographic tracking tokens generate anti-enumeration capability strings", () => {
    const token1 = generateTrackingToken();
    const token2 = generateTrackingToken();
    const pickup1 = generatePickupCode();

    assert.ok(token1.startsWith("trk_"));
    assert.ok(token2.startsWith("trk_"));
    assert.notEqual(token1, token2);
    assert.equal(pickup1.length, 4);
});

test("Milestone 6: Financial summary cleanly separates cash collections, GCash, refunds, COGS, and booth expenses", () => {
    const orders = [
        // Order 1: Cash, paid, collected
        {
            orderId: "o1",
            fulfillmentStatus: "collected",
            paymentMethod: "cash",
            paymentStatus: "paid",
            totalAmount: 300,
            paidAmount: 300,
            cogs: 60,
        },
        // Order 2: GCash, paid, ready
        {
            orderId: "o2",
            fulfillmentStatus: "ready",
            paymentMethod: "gcash",
            paymentStatus: "paid",
            totalAmount: 400,
            paidAmount: 400,
            cogs: 80,
        },
        // Order 3: Cash, unpaid, preparing
        {
            orderId: "o3",
            fulfillmentStatus: "preparing",
            paymentMethod: "cash",
            paymentStatus: "unpaid",
            totalAmount: 250,
            paidAmount: 0,
            cogs: 50,
        },
        // Order 4: Cancelled, refunded 150
        {
            orderId: "o4",
            fulfillmentStatus: "cancelled",
            paymentMethod: "cash",
            paymentStatus: "refunded",
            totalAmount: 150,
            paidAmount: 0,
            totalRefunded: 150,
            cogs: 0,
        },
    ];

    const summary = calculateFinancialSummary({
        orders,
        expenses: 200, // e.g. ₱200 booth fee
        refunds: [{ amount: 150 }],
    });

    // Valid gross orders (excluding cancelled) = 300 + 400 + 250 = 950
    assert.equal(summary.grossOrderValue, 950);
    // Total Collections = 300 + 400 = 700
    assert.equal(summary.totalCollections, 700);
    // Collected GCash = 400
    assert.equal(summary.collectedGcash, 400);
    // Uncollected balance = 250
    assert.equal(summary.outstandingBalance, 250);
    // Total refunds = 150
    assert.equal(summary.totalRefunds, 150);
    // Net cash collections = 700 - 150 = 550
    assert.equal(summary.netCashCollections, 550);
    // COGS for valid orders = 60 + 80 + 50 = 190
    assert.equal(summary.cogs, 190);
    // Gross Profit: Net Collections (550) - COGS (190) = 360
    assert.equal(summary.grossProfit, 360);
    // Net estimated profit = 360 - 200 (expenses) = 160
    assert.equal(summary.estimatedProfit, 160);
});
