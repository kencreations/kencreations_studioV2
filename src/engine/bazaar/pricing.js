import { isIconSlot } from './icons.js';
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
import { clickerOptions, validateClickerConfiguration } from './configuration.js';
export function calculateItemPrice({
    product,
    customization = {},
    eventConfig = null,
    quantity = 1,
} = {}) {
    if (!product) throw new Error("Product definition is required for pricing.");
    if (quantity !== undefined && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) {
        throw new Error("Item quantity must be a positive number.");
    }
    const rawBase = product.base_price ?? product.retailPrice ?? product.price;
    if (rawBase !== undefined && rawBase !== null && (!Number.isFinite(Number(rawBase)) || Number(rawBase) < 0)) {
        throw new Error("Product pricing is invalid. Seller must configure a finite price.");
    }
    product = { ...product, base_price: rawBase, customization_schema: clickerOptions(product) };

    const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));

    // 1. Authoritative base price (event override takes precedence if enabled)
    let unitBase = rawBase != null ? Number(rawBase) : 0;
    let hasEventOverride = false;

    if (eventConfig && eventConfig.enabled !== false && typeof eventConfig.price_override === "number" && eventConfig.price_override >= 0) {
        unitBase = Number(eventConfig.price_override);
        hasEventOverride = true;
    } else if (rawBase == null && product.type !== 'ready_made') {
        throw new Error("Product price is missing. Seller must configure a valid price.");
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
    if (product.type === 'made_to_order' && Array.isArray(customization.slotsData)) {
        validateClickerConfiguration(product, customization);
        const schema = product.customization_schema;
        const price = o => Number(o?.price ?? o?.additional_price ?? o?.extra_price ?? o?.extraPrice ?? 0);
        const find = (options, id) => options.find(o => o.id === id);
        const free = Number(schema.free_letter_count ?? schema.base_included_letters ?? 0);
        breakdown.letterCountExtra = Math.max(0, customization.slots - free) * Number(schema.extra_per_letter_price ?? schema.extra_letter_price ?? 0);
        breakdown.slotExtra = Number(schema.slot_pricing?.[customization.slots] ?? price(schema.base_slots?.find(o => Number(o.slots) === customization.slots)));
        breakdown.casingStyleExtra = price(find(schema.casing_styles, customization.casing_style_id));
        breakdown.baseColorExtra = price(find(schema.casing_base_colors, customization.casing_color));
        breakdown.keycapExtras = 0;
        for (const slot of customization.slotsData) {
            if (isIconSlot(slot)) breakdown.keycapExtras += price(find(schema.available_icons, slot.iconId)) + Number(schema.icon_cap_surcharge || 0);
            else breakdown.keycapExtras += price(find(schema.colors, slot.colorId)) + price(find(schema.keycap_styles, slot.styleId));
            const sw = find(schema.allowed_switch_types, slot.switchId || customization.switch_type_id);
            breakdown.switchExtras += Number(sw?.additional_price_per_key ?? price(sw));
        }
        breakdown.addOnsTotal = [...new Set(customization.selected_add_on_ids || [])].reduce((n,id) => n + price(find(schema.add_ons,id)), 0);
        customizationExtras = ['letterCountExtra','slotExtra','casingStyleExtra','baseColorExtra','keycapExtras','switchExtras','addOnsTotal'].reduce((n,key) => n + breakdown[key], 0);
    } else if (product.type !== 'ready_made' && product.customization_schema) {
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
            const styleExtra = Number(style?.additional_price ?? style?.extra_price ?? style?.extraPrice ?? 0);
            if (styleExtra > 0) {
                breakdown.casingStyleExtra = styleExtra;
                customizationExtras += styleExtra;
            }
        }

        // Switches extra per key
        const switchList = schema.allowed_switch_types || schema.switch_types;
        if (customization.switch_type_id && Array.isArray(switchList)) {
            const switchOpt = switchList.find((s) => s.id === customization.switch_type_id);
            const switchPrice = Number(switchOpt?.additional_price_per_key ?? switchOpt?.extra_price ?? switchOpt?.extraPrice ?? 0);
            if (switchPrice > 0) {
                // Charge per key if multi-key clicker and per_key is specified
                const switchCharge = (switchOpt.additional_price_per_key != null || switchOpt.per_key === true)
                    ? switchPrice * Math.max(1, letterCount)
                    : switchPrice;
                breakdown.switchExtras = switchCharge;
                customizationExtras += switchCharge;
            }
        }

        // Add-ons
        const selectedAddonList = customization.selected_add_on_ids || customization.selected_add_ons;
        if (Array.isArray(selectedAddonList) && Array.isArray(schema.add_ons)) {
            let addOnSum = 0;
            for (const addOnId of selectedAddonList) {
                const opt = schema.add_ons.find((a) => a.id === addOnId);
                const addOnPrice = Number(opt?.price ?? opt?.extraPrice ?? opt?.additional_price ?? 0);
                if (opt && addOnPrice > 0) {
                    addOnSum += addOnPrice;
                }
            }
            breakdown.addOnsTotal = addOnSum;
            customizationExtras += addOnSum;
        }
    }

    if (product.type === 'ready_made' && product.variants?.length) {
        const variant = product.variants.find(v => v.id === customization.selected_variant_id);
        if (!variant) throw new Error('Choose a configured finished-product variant.');
        if (!hasEventOverride) unitBase = Number(variant.retailPrice ?? variant.price ?? unitBase);
        customizationExtras += Number(variant.extraPrice || 0);
    }
    if (![unitBase, customizationExtras].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Seller pricing is invalid.');

    breakdown.customizationTotal = Number(customizationExtras.toFixed(2));
    const unitPrice = Number((unitBase + customizationExtras).toFixed(2));
    const totalPrice = Number((unitPrice * safeQty).toFixed(2));

    return {
        unitPrice,
        finalUnitPrice: unitPrice,
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
    if (!Array.isArray(items)) throw new Error("Order items must be an array.");
    for (const item of items) {
        const lineTotal = item.totalPrice ?? item.lineTotal;
        if (lineTotal !== undefined && (!Number.isFinite(Number(lineTotal)) || Number(lineTotal) < 0)) {
            throw new Error(`Item "${item.productName || item.productId || 'Item'}" has an invalid price.`);
        }
    }
    const subtotal = items.reduce((sum, item) => sum + (Number(item.totalPrice ?? item.lineTotal) || 0), 0);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
        throw new Error("Calculated subtotal is not a valid finite number.");
    }
    const safeDiscountPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const discountAmount = Number(((subtotal * safeDiscountPct) / 100).toFixed(2));
    const totalAmount = Number((subtotal - discountAmount).toFixed(2));

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
        throw new Error("Calculated order total is not a valid finite number.");
    }

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

