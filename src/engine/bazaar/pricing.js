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
        slotExtra: 0,
        casingStyleExtra: 0,
        switchExtras: 0,
        addOnsTotal: 0,
        customizationTotal: 0,
    };

    // 2. Customization extras (for made-to-order clickers, keychains, etc.)
    if ((product.type === "made_to_order" || product.customization_schema) && product.customization_schema) {
        const schema = product.customization_schema;

        // Letters extra charge if beyond threshold
        const text = String(customization.text || "").trim();
        const letterCount = text.length;
        const freeLetters = Number(schema.free_letter_count ?? schema.base_included_letters) || 3;
        const extraPerLetter = Number(schema.extra_per_letter_price ?? schema.extra_letter_price) || 0;

        if (letterCount > freeLetters && extraPerLetter > 0) {
            const extraLetters = letterCount - freeLetters;
            const letterCharge = extraLetters * extraPerLetter;
            breakdown.letterCountExtra = letterCharge;
            customizationExtras += letterCharge;
        }

        // Casing base slot extra (e.g. 1-key base is +₱0, 2-key base is +₱25, 3-key base is +₱50)
        const slotCount = Number(customization.slots || customization.casing_slots || letterCount);
        if (schema.slot_pricing && typeof schema.slot_pricing === "object") {
            const slotExtra = Number(schema.slot_pricing[slotCount] ?? schema.slot_pricing[String(slotCount)] ?? 0);
            if (slotExtra > 0) {
                breakdown.slotExtra = slotExtra;
                customizationExtras += slotExtra;
            }
        } else if (Array.isArray(schema.base_slots)) {
            const slotOpt = schema.base_slots.find((b) => Number(b.slots) === slotCount);
            const slotExtra = Number(slotOpt?.additional_price ?? slotOpt?.extra_price ?? 0);
            if (slotExtra > 0) {
                breakdown.slotExtra = slotExtra;
                customizationExtras += slotExtra;
            }
        }

        // Casing style extra
        if (customization.casing_style_id && Array.isArray(schema.casing_styles)) {
            const style = schema.casing_styles.find((s) => s.id === customization.casing_style_id);
            const styleExtra = Number(style?.additional_price ?? style?.extra_price ?? 0);
            if (styleExtra > 0) {
                breakdown.casingStyleExtra = styleExtra;
                customizationExtras += styleExtra;
            }
        }

        // Switches extra per key
        const switchList = schema.allowed_switch_types || schema.switch_types;
        if (customization.switch_type_id && Array.isArray(switchList)) {
            const switchOpt = switchList.find((s) => s.id === customization.switch_type_id);
            const switchPrice = Number(switchOpt?.additional_price_per_key ?? switchOpt?.extra_price ?? 0);
            if (switchPrice > 0) {
                // If extra_price is specified as a flat fee or per-key:
                const switchCharge = switchOpt.additional_price_per_key != null
                    ? switchPrice * Math.max(1, letterCount)
                    : switchPrice;
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

/**
 * Calculates profit margins and markup for a product.
 *
 * @param {number} retailPrice - Selling price
 * @param {number} unitCost - Unit production cost (materials + consumables + wear)
 * @returns {Object} Profit breakdown
 */
export function calculateMargin(retailPrice = 0, unitCost = 0) {
    const price = Math.max(0, Number(retailPrice) || 0);
    const cost = Math.max(0, Number(unitCost) || 0);
    const grossProfit = Number((price - cost).toFixed(2));
    const marginPercent = price > 0 ? Number(((grossProfit / price) * 100).toFixed(1)) : 0;
    const markupPercent = cost > 0 ? Number(((grossProfit / cost) * 100).toFixed(1)) : 0;

    return {
        retailPrice: price,
        unitCost: cost,
        grossProfit,
        marginPercent,
        markupPercent,
    };
}

