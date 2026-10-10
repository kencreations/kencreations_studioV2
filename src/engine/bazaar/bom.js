/**
 * src/engine/bazaar/bom.js
 * Pure Bill of Materials (BOM) decomposition functions for Bazaar Hub.
 *
 * Decomposes customized products into exact physical inventory component requirements.
 * Correctly counts repeated letters (e.g. "ANNA" requires 2 A's, 2 N's, 4 switches).
 */

/**
 * Counts frequency of characters in a string.
 * Uppercases and strips whitespace.
 *
 * @param {string} text - Raw input text (e.g. "ANNA")
 * @returns {Record<string, number>} Character count map
 */
export function getCharacterFrequencies(text) {
    const counts = {};
    if (!text || typeof text !== "string") return counts;

    const cleaned = text.trim().toUpperCase();
    for (const char of cleaned) {
        if (!char || char === " ") continue;
        counts[char] = (counts[char] || 0) + 1;
    }
    return counts;
}

/**
 * Decomposes an ordered item into its required physical inventory components.
 *
 * @param {Object} params
 * @param {Object} params.product - Master product catalog document
 * @param {Object} [params.customization={}] - Customer choices (text, colors, switch, add-ons)
 * @param {number} [params.quantity=1] - Number of items ordered
 * @returns {Array<Object>} List of required inventory components
 */
export function decomposeProductBOM({
    product,
    customization = {},
    quantity = 1,
} = {}) {
    if (!product) throw new Error("Product definition is required for BOM decomposition.");
    const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));

    // ── Case 1: Ready-Made Finished Product ──
    if (product.type === "ready_made") {
        return [
            {
                component_key: `finished_${product.id}`,
                item_type: "finished_good",
                item_id: product.id,
                name: product.title,
                required_qty: safeQty,
            },
        ];
    }

    // ── Case 2: Made-to-Order Letter Clicker ──
    if (product.category === "clicker" || product.type === "made_to_order") {
        const components = [];
        const text = String(customization.text || "").trim().toUpperCase();
        const letterCount = Math.max(1, text.length || 1);
        const charFreqs = getCharacterFrequencies(text);

        // Letter color map (defaults to single color or per-char color map)
        const defaultColor = customization.default_letter_color || "white";
        const charColors = customization.letter_colors || {}; // e.g. { '0': 'pink', '1': 'blue' } or { 'A': 'pink' }

        // A. Letter Cap Components
        // If per-letter colors are provided, index by position; otherwise count by character
        if (Array.isArray(customization.letter_color_array) && customization.letter_color_array.length === text.length) {
            // Detailed per-position color array
            const capColorCounts = {};
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const color = customization.letter_color_array[i] || defaultColor;
                const key = `cap_${char}_${color}`;
                capColorCounts[key] = capColorCounts[key] || { char, color, count: 0 };
                capColorCounts[key].count += 1;
            }
            for (const [key, info] of Object.entries(capColorCounts)) {
                components.push({
                    component_key: key,
                    item_type: "letter_cap",
                    char: info.char,
                    color: info.color,
                    name: `Letter Cap [${info.char}] (${info.color})`,
                    required_qty: info.count * safeQty,
                });
            }
        } else {
            // General character frequency with default color
            for (const [char, count] of Object.entries(charFreqs)) {
                const color = charColors[char] || defaultColor;
                components.push({
                    component_key: `cap_${char}_${color}`,
                    item_type: "letter_cap",
                    char,
                    color,
                    name: `Letter Cap [${char}] (${color})`,
                    required_qty: count * safeQty,
                });
            }
        }

        // B. Icon Cap Components (if customer chose icon keycaps)
        if (Array.isArray(customization.icon_caps) && customization.icon_caps.length > 0) {
            for (const ic of customization.icon_caps) {
                const iconId = ic.icon || ic.id || "heart";
                const iconColor = ic.color || defaultColor;
                const iconQty = Math.max(1, Number(ic.count || ic.qty || 1));
                components.push({
                    component_key: `cap_icon_${iconId}_${iconColor}`,
                    item_type: "icon_cap",
                    icon: iconId,
                    color: iconColor,
                    name: `Icon Cap [${ic.label || iconId}] (${iconColor})`,
                    required_qty: iconQty * safeQty,
                });
            }
        }

        // C. Casing Base (1 casing per clicker)
        const totalKeys = letterCount + (Array.isArray(customization.icon_caps) ? customization.icon_caps.length : 0);
        const casingStyle = customization.casing_style_id || "standard";
        const casingColor = customization.casing_color || "black";
        components.push({
            component_key: `casing_${totalKeys}key_${casingStyle}_${casingColor}`,
            item_type: "casing_base",
            key_count: totalKeys,
            style: casingStyle,
            color: casingColor,
            name: `${totalKeys}-Key Casing [${casingStyle}] (${casingColor})`,
            required_qty: 1 * safeQty,
        });

        // D. Mechanical Switches (1 switch per letter + icon)
        const switchType = customization.switch_type_id || "standard_blue";
        const switchConsumableId = customization.switch_consumable_id || null;
        components.push({
            component_key: `switch_${switchType}`,
            item_type: "switch",
            switch_type: switchType,
            consumable_id: switchConsumableId,
            name: customization.switch_name || `Cherry MX Switch (${switchType})`,
            required_qty: totalKeys * safeQty,
        });

        // E. Add-ons (e.g. ballchains, straps, boxes from consumables)
        if (Array.isArray(customization.selected_add_on_ids) && product.customization_schema?.add_ons) {
            for (const addOnId of customization.selected_add_on_ids) {
                const addOnDef = product.customization_schema.add_ons.find((a) => (a.id === addOnId || a.consumable_id === addOnId));
                if (addOnDef) {
                    components.push({
                        component_key: `addon_${addOnDef.id || addOnDef.consumable_id}`,
                        item_type: "consumable",
                        item_id: addOnDef.consumable_id || addOnDef.id,
                        name: addOnDef.name,
                        required_qty: 1 * safeQty,
                    });
                }
            }
        }

        return components;
    }

    // Default fallback
    return [
        {
            component_key: `generic_${product.id}`,
            item_type: "product",
            item_id: product.id,
            name: product.name || product.title,
            required_qty: safeQty,
        },
    ];
}

/**
 * Calculates authoritative unit production cost for a BOM based on linked Studio Hub filaments and consumables.
 *
 * @param {Array<Object>} bomComponents - Result from decomposeProductBOM
 * @param {Object} studioCatalog
 * @param {Array<Object>} [studioCatalog.filaments=[]] - Studio Hub filaments with cost_per_gram
 * @param {Array<Object>} [studioCatalog.consumables=[]] - Studio Hub consumables with unit_cost
 * @param {Object} [studioCatalog.defaults={}] - Fallback unit costs if not explicitly matched
 * @returns {Object} Costing breakdown and total unit cost
 */
export function calculateBOMCost(bomComponents = [], {
    filaments = [],
    consumables = [],
    defaults = { capCostPerGram: 1.0, capGrams: 1.2, casingGramsPerKey: 3.5, switchUnitCost: 8.5, defaultConsumableCost: 3.0 },
} = {}) {
    if (!Array.isArray(bomComponents)) return { totalCost: 0, items: [] };

    let totalCost = 0;
    const items = [];

    // Lookup maps
    const filamentColorMap = new Map();
    for (const f of filaments) {
        if (f.color_name) filamentColorMap.set(f.color_name.toLowerCase(), f);
        if (f.color) filamentColorMap.set(f.color.toLowerCase(), f);
        if (f.name) filamentColorMap.set(f.name.toLowerCase(), f);
    }

    const consumableIdMap = new Map();
    for (const c of consumables) {
        if (c.id) consumableIdMap.set(c.id, c);
        if (c.name) consumableIdMap.set(c.name.toLowerCase(), c);
    }

    for (const comp of bomComponents) {
        let unitCost = 0;
        let matchedSource = "default";
        const qty = comp.required_qty || comp.qty || 1;

        if (comp.item_type === "letter_cap" || comp.item_type === "icon_cap") {
            const colorLower = String(comp.color || "").toLowerCase();
            const fil = filamentColorMap.get(colorLower);
            const costPerGram = fil ? Number(fil.cost_per_gram) || defaults.capCostPerGram : defaults.capCostPerGram;
            const grams = Number(comp.filament_grams || comp.grams || defaults.capGrams);
            unitCost = costPerGram * grams;
            matchedSource = fil ? `filament:${fil.name}` : (comp.item_type === "icon_cap" ? "estimated_icon_cap" : "estimated_cap");
        } else if (comp.item_type === "casing_base") {
            const colorLower = String(comp.color || "").toLowerCase();
            const fil = filamentColorMap.get(colorLower);
            const costPerGram = fil ? Number(fil.cost_per_gram) || defaults.capCostPerGram : defaults.capCostPerGram;
            const keys = Number(comp.key_count || 3);
            const grams = keys * (Number(comp.gramsPerKey || defaults.casingGramsPerKey));
            unitCost = costPerGram * grams;
            matchedSource = fil ? `filament:${fil.name}` : "estimated_casing";
        } else if (comp.item_type === "switch") {
            const con = (comp.consumable_id && consumableIdMap.get(comp.consumable_id)) || null;
            if (con) {
                unitCost = Number(con.unit_cost) || defaults.switchUnitCost;
                matchedSource = `consumable:${con.name}`;
            } else {
                const swName = String(comp.switch_type || "").toLowerCase();
                let matchedCon = null;
                for (const [key, c] of consumableIdMap.entries()) {
                    if (key.includes(swName) || key.includes("switch")) {
                        matchedCon = c;
                        break;
                    }
                }
                unitCost = matchedCon ? Number(matchedCon.unit_cost) || defaults.switchUnitCost : defaults.switchUnitCost;
                matchedSource = matchedCon ? `consumable:${matchedCon.name}` : "default_switch";
            }
        } else if (comp.item_type === "consumable" || comp.item_type === "addon") {
            const con = (comp.consumable_id && consumableIdMap.get(comp.consumable_id)) ||
                        consumableIdMap.get(comp.item_id) ||
                        consumableIdMap.get(String(comp.name || "").toLowerCase());
            unitCost = con ? Number(con.unit_cost) || defaults.defaultConsumableCost : defaults.defaultConsumableCost;
            matchedSource = con ? `consumable:${con.name}` : "default_consumable";
        } else if (comp.item_type === "finished_good") {
            unitCost = Number(comp.unit_cost) || 0;
            matchedSource = "product_unit_cost";
        }

        const lineTotal = Number((unitCost * qty).toFixed(4));
        totalCost += lineTotal;

        items.push({
            component_key: comp.component_key,
            name: comp.name,
            item_type: comp.item_type,
            quantity: qty,
            unitCost: Number(unitCost.toFixed(4)),
            lineTotal,
            matchedSource,
        });
    }

    return {
        totalCost: Number(totalCost.toFixed(2)),
        items,
    };
}
