import test from "node:test";
import assert from "node:assert/strict";

import { calculateItemPrice } from "../src/engine/bazaar/pricing.js";
import { decomposeProductBOM } from "../src/engine/bazaar/bom.js";
import {
    getCartStorageKey,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    calculateCartSummary,
} from "../src/utils/bazaarCart.js";
import {
    sanitizePublicProduct,
    sanitizePublicOrderTracking,
} from "../src/services/bazaarService.js";

// Mock localStorage for test environment
const store = new Map();
const mockLocalStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
};
Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
});
if (typeof globalThis.window === "undefined") {
    globalThis.window = {
        dispatchEvent: () => true,
    };
}

test("Milestone 4: Letter Clicker Customizer accurately calculates price with repeated letters and slot add-ons", () => {
    const product = {
        id: "prod_clicker",
        name: "Custom Letter Clicker",
        type: "made_to_order",
        base_price: 150,
        customization_schema: {
            base_included_letters: 3,
            extra_per_letter_price: 20,
            slot_pricing: {
                1: 0,
                2: 25,
                3: 50,
                4: 75,
            },
            casing_styles: [
                { id: "standard", name: "Standard", extraPrice: 0 },
                { id: "ergonomic", name: "Ergonomic", extraPrice: 20 },
            ],
            allowed_switch_types: [
                { id: "blue", name: "Outemu Blue", extraPrice: 0 },
                { id: "custom_tactile", name: "Holy Panda", additional_price_per_key: 15 },
            ],
            add_ons: [
                { id: "keyring", name: "Keyring", extraPrice: 15 },
            ],
        },
    };

    // 4-letter clicker 'ANNA' (4 letters, 1 extra letter beyond 3 included)
    // base = 150
    // extra letter: (4 - 3) * 20 = +20
    // 4 slots extra: +75
    // ergonomic style: +20
    // Holy Panda switch on 4 keys: 4 * 15 = +60
    // keyring: +15
    // Expected unit price = 150 + 20 + 75 + 20 + 60 + 15 = 340
    const pricing = calculateItemPrice({
        product,
        customization: {
            text: "ANNA",
            slots: 4,
            casing_style_id: "ergonomic",
            switch_type_id: "custom_tactile",
            selected_add_ons: ["keyring"],
        },
        quantity: 2,
    });

    assert.equal(pricing.finalUnitPrice, 340);
    assert.equal(pricing.totalPrice, 680);
});

test("Milestone 4: Decomposed BOM accurately separates individual letter colors for repeated letters (e.g. ANNA with Pink A and Purple A)", () => {
    const product = {
        id: "prod_clicker",
        type: "made_to_order",
        category: "clicker",
        title: "Custom Clicker",
    };

    const bom = decomposeProductBOM({
        product,
        customization: {
            text: "ANNA",
            letter_color_array: ["Pastel Pink", "Teal Green", "Teal Green", "Lavender Purple"],
            casing_color: "Matte Black",
            casing_style: "standard",
            switch_type: "Outemu Blue",
            addons: ["keyring"],
        },
        quantity: 1,
    });

    // Should contain:
    // 1 Pink A
    // 2 Teal N
    // 1 Purple A
    const pinkA = bom.find((c) => c.component_key === "cap_A_Pastel Pink");
    const tealN = bom.find((c) => c.component_key === "cap_N_Teal Green");
    const purpleA = bom.find((c) => c.component_key === "cap_A_Lavender Purple");

    assert.ok(pinkA, "Pink A must exist");
    assert.equal(pinkA.required_qty, 1);

    assert.ok(tealN, "Teal N must exist");
    assert.equal(tealN.required_qty, 2);

    assert.ok(purpleA, "Purple A must exist");
    assert.equal(purpleA.required_qty, 1);
});

test("Milestone 4: Guest Cart enforces strict event isolation and accurately computes summary totals", () => {
    localStorage.clear();

    const shop = "ken-creations";
    const eventA = "makati-bazaar";
    const eventB = "bgc-fair";

    // Add item to Event A
    addToCart(shop, eventA, {
        productId: "p1",
        productName: "Clicker 1",
        quantity: 2,
        finalUnitPrice: 200,
    });

    // Add item to Event B
    addToCart(shop, eventB, {
        productId: "p2",
        productName: "Clicker 2",
        quantity: 1,
        finalUnitPrice: 300,
    });

    // Event A cart must only have item 1
    const cartA = JSON.parse(localStorage.getItem(getCartStorageKey(shop, eventA)));
    assert.equal(cartA.length, 1);
    assert.equal(cartA[0].productId, "p1");
    assert.equal(calculateCartSummary(cartA).subtotal, 400);

    // Event B cart must only have item 2
    const cartB = JSON.parse(localStorage.getItem(getCartStorageKey(shop, eventB)));
    assert.equal(cartB.length, 1);
    assert.equal(cartB[0].productId, "p2");
    assert.equal(calculateCartSummary(cartB).subtotal, 300);
});

test("Milestone 4: Public sanitization strictly prevents leaks of internal costs, margins, and PII", () => {
    const rawPrivateProduct = {
        productId: "p_123",
        shopId: "shop_ken",
        ownerUid: "uid_ken",
        name: "Letter Clicker",
        retailPrice: 250,
        unitProductionCost: 45.2,
        targetMarginPercent: 81.9,
        linkedFilamentId: "fil_secret_123",
        internalNotes: "Filament bought wholesale in Divisoria",
        isPublished: true,
    };

    const sanitized = sanitizePublicProduct(rawPrivateProduct);
    assert.equal(sanitized.productId, "p_123");
    assert.equal(sanitized.price, 250);
    assert.equal(sanitized.unitProductionCost, undefined);
    assert.equal(sanitized.targetMarginPercent, undefined);
    assert.equal(sanitized.linkedFilamentId, undefined);
    assert.equal(sanitized.internalNotes, undefined);

    const rawPrivateOrder = {
        orderNumber: "ORD-9901",
        customerName: "Jane Doe",
        customerContact: "0917-000-0000",
        customerEmail: "private@customer.com",
        fulfillmentStatus: "ready",
        pickupCode: "7721",
        pickupInstructions: "Counter A",
        internalStaffNotes: "Customer was in a rush",
        cogsTotal: 65,
    };

    const sanitizedTracking = sanitizePublicOrderTracking(rawPrivateOrder, "crypto_token_abc");
    assert.equal(sanitizedTracking.orderNumber, "ORD-9901");
    assert.equal(sanitizedTracking.fulfillmentStatus, "ready");
    assert.equal(sanitizedTracking.pickupCode, "7721");
    assert.equal(sanitizedTracking.customerContact, undefined);
    assert.equal(sanitizedTracking.customerEmail, undefined);
    assert.equal(sanitizedTracking.internalStaffNotes, undefined);
    assert.equal(sanitizedTracking.cogsTotal, undefined);
});
