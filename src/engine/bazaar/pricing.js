/**
 * src/engine/bazaar/pricing.js
 * Pure domain pricing calculation functions for Bazaar Hub.
 *
 * Zero network, zero browser DOM, zero Firebase SDK dependencies.
 * Deterministic and runs identically on client, backend, and tests.
 */

/**
 * Calculates authoritative item price.
 *
 * @param {Object} params
 * @param {Object} params.product - Product document from catalog
 * @param {Object} [params.customization] - Customer selected customization options
 * @param {Object} [params.eventConfig] - Event-specific product configuration overrides
 * @param {number} [params.quantity=1] - Item quantity
 * @returns {Object} Price calculation result and breakdown
 */
export function calculateItemPrice({
    product,
    customization = {},
    eventConfig = null,
    quantity = 1,
} = {}) {
    if (!product) throw new Error("Product definition is required for pricing.");

    const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));

    // 1. Authoritative base price (event override takes precedence if enabled)
    let unitBase = Number(product.base_price) || 0;
    let hasEventOverride = false;

    if (eventConfig && eventConfig.enabled !== false && typeof eventConfig.price_override === "number" && eventConfig.price_override >= 0) {
        unitBase = Number(eventConfig.price_override);
        hasEventOverride = true;
    }

    let customizationExtras = 0;
    const breakdown = {
        basePrice: unitBase,
        isEventOverride: hasEventOverride,
        letterCountExtra: 0,
        casingStyleExtra: 0,
        switchExtras: 0,
        addOnsTotal: 0,
        customizationTotal: 0,
    };

    // 2. Customization extras (for made-to-order clickers, keychains, etc.)
    if (product.type === "made_to_order" && product.customization_schema) {
        const schema = product.customization_schema;

        // Letters extra charge if beyond threshold
        const text = String(customization.text || "").trim();
        const letterCount = text.length;
        const freeLetters = Number(schema.free_letter_count) || 3;
        const extraPerLetter = Number(schema.extra_per_letter_price) || 0;

        if (letterCount > freeLetters && extraPerLetter > 0) {
            const extraLetters = letterCount - freeLetters;
            const letterCharge = extraLetters * extraPerLetter;
            breakdown.letterCountExtra = letterCharge;
            customizationExtras += letterCharge;
        }

        // Casing style extra
        if (customization.casing_style_id && Array.isArray(schema.casing_styles)) {
            const style = schema.casing_styles.find((s) => s.id === customization.casing_style_id);
            if (style && Number(style.additional_price) > 0) {
                const styleCharge = Number(style.additional_price);
                breakdown.casingStyleExtra = styleCharge;
                customizationExtras += styleCharge;
            }
        }

        // Switches extra per key
        if (customization.switch_type_id && Array.isArray(schema.allowed_switch_types)) {
            const switchOpt = schema.allowed_switch_types.find((s) => s.id === customization.switch_type_id);
            if (switchOpt && Number(switchOpt.additional_price_per_key) > 0) {
                const switchCharge = Number(switchOpt.additional_price_per_key) * Math.max(1, letterCount);
                breakdown.switchExtras = switchCharge;
                customizationExtras += switchCharge;
            }
        }

        // Add-ons
        if (Array.isArray(customization.selected_add_on_ids) && Array.isArray(schema.add_ons)) {
            let addOnSum = 0;
            for (const addOnId of customization.selected_add_on_ids) {
                const opt = schema.add_ons.find((a) => a.id === addOnId);
                if (opt && Number(opt.price) > 0) {
                    addOnSum += Number(opt.price);
                }
            }
            breakdown.addOnsTotal = addOnSum;
            customizationExtras += addOnSum;
        }
    }

    breakdown.customizationTotal = Number(customizationExtras.toFixed(2));
    const unitPrice = Number((unitBase + customizationExtras).toFixed(2));
    const totalPrice = Number((unitPrice * safeQty).toFixed(2));

    return {
        unitPrice,
        quantity: safeQty,
        totalPrice,
        breakdown,
    };
}

/**
 * Calculates authoritative order totals from calculated line items.
 *
 * @param {Object} params
 * @param {Array} params.items - Array of priced items
 * @param {number} [params.discountPercent=0] - Discount percentage (0-100)
 * @returns {Object} Order financial totals
 */
export function calculateOrderTotal({ items = [], discountPercent = 0 } = {}) {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    const safeDiscountPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const discountAmount = Number(((subtotal * safeDiscountPct) / 100).toFixed(2));
    const totalAmount = Number((subtotal - discountAmount).toFixed(2));

    return {
        subtotal: Number(subtotal.toFixed(2)),
        discountPercent: safeDiscountPct,
        discountAmount,
        totalAmount,
    };
}
