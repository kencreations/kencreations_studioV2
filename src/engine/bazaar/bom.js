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

        // B. Casing Base (1 casing per clicker)
        const casingStyle = customization.casing_style_id || "standard";
        const casingColor = customization.casing_color || "black";
        components.push({
            component_key: `casing_${letterCount}key_${casingStyle}_${casingColor}`,
            item_type: "casing_base",
            key_count: letterCount,
            style: casingStyle,
            color: casingColor,
            name: `${letterCount}-Key Casing [${casingStyle}] (${casingColor})`,
            required_qty: 1 * safeQty,
        });

        // C. Mechanical Switches (1 switch per letter)
        const switchType = customization.switch_type_id || "standard_blue";
        components.push({
            component_key: `switch_${switchType}`,
            item_type: "switch",
            switch_type: switchType,
            name: `Cherry MX Switch (${switchType})`,
            required_qty: letterCount * safeQty,
        });

        // D. Add-ons (e.g. ballchains, straps, boxes)
        if (Array.isArray(customization.selected_add_on_ids) && product.customization_schema?.add_ons) {
            for (const addOnId of customization.selected_add_on_ids) {
                const addOnDef = product.customization_schema.add_ons.find((a) => a.id === addOnId);
                if (addOnDef) {
                    components.push({
                        component_key: `addon_${addOnDef.id}`,
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
            name: product.title,
            required_qty: safeQty,
        },
    ];
}
