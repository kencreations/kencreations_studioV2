import { normalizeIcon, isIconSlot } from './icons.js';

export const CANONICAL_COLORS = [
    { id: "teal", name: "Teal Green", hex: "#14b8a6", active: true },
    { id: "pink", name: "Pastel Pink", hex: "#f472b6", active: true },
    { id: "purple", name: "Lavender Purple", hex: "#a855f7", active: true },
    { id: "white", name: "Clean White", hex: "#f8fafc", active: true },
    { id: "black", name: "Matte Black", hex: "#1e293b", active: true },
    { id: "mint", name: "Mint Fresh", hex: "#6ee7b7", active: true },
];

export const LEGACY_COLOR_ALIASES = {
    teal_green: "teal",
    pastel_pink: "pink",
    lavender_purple: "purple",
    clean_white: "white",
    matte_black: "black",
    mint_fresh: "mint",
};

/**
 * Returns canonical color ID. Resolves known legacy aliases (e.g. 'teal_green' -> 'teal').
 * Preserves custom color identifiers without modification.
 */
export function canonicalColorId(colorOrId) {
    if (!colorOrId) return "";
    const raw = typeof colorOrId === "object" ? (colorOrId.id || colorOrId.colorId || colorOrId.name) : String(colorOrId);
    if (!raw || typeof raw !== "string") return "";
    const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (LEGACY_COLOR_ALIASES[cleaned]) {
        return LEGACY_COLOR_ALIASES[cleaned];
    }
    const direct = CANONICAL_COLORS.find(c => c.id === cleaned);
    if (direct) return direct.id;
    const byName = CANONICAL_COLORS.find(c => c.name.toLowerCase() === raw.trim().toLowerCase());
    if (byName) return byName.id;
    return typeof colorOrId === "object" && colorOrId.id ? colorOrId.id : cleaned;
}

/**
 * Generates letter keycap SKU using canonical color ID.
 * Format: cap_{CHAR}_{colorId}{suffix}
 */
export function buildLetterCapSku(char, colorId, styleId = "") {
    const cId = canonicalColorId(colorId);
    const suffix = styleId && styleId !== "standard" ? `_${styleId}` : "";
    return `cap_${String(char).toUpperCase()}_${cId}${suffix}`;
}

/**
 * Generates casing base SKU using canonical color ID.
 * Format: base_casing_{colorId}_{slots}key{suffix}
 */
export function buildCasingBaseSku(colorId, slots = 1, styleId = "") {
    const cId = canonicalColorId(colorId);
    const suffix = styleId && styleId !== "standard" ? `_${styleId}` : "";
    return `base_casing_${cId}_${slots}key${suffix}`;
}

// Seller-owned product options normalized once for preview, cart and checkout.
const list = value => Array.isArray(value) ? value.filter(v => v != null) : [];
const option = value => {
    if (typeof value === 'string') {
        const id = canonicalColorId(value);
        return { id, name: value };
    }
    const id = canonicalColorId(value.id || value.consumableId || value.consumable_id || value.name);
    return {
        ...value,
        id,
        name: value.name || id,
    };
};

export function clickerOptions(product = {}) {
    product ||= {};
    const raw = product.customizationOptions || product.customization_schema || {};
    return {
        ...raw,
        available_slots: [...new Set(list(raw.available_slots || raw.base_slots).map(v => Number(v.slots ?? v)))].filter(n => Number.isInteger(n) && n > 0 && n <= 24).sort((a, b) => a - b),
        colors: list(raw.colors).map(option).filter(c => c.active !== false && !c.archived && !c.disabled),
        casing_base_colors: list(raw.base_colors || raw.casing_base_colors).map(option).filter(c => c.active !== false && !c.archived && !c.disabled),
        casing_styles: list(raw.casing_styles).map(option),
        allowed_switch_types: list(raw.switches || raw.allowed_switch_types || raw.switch_types).map(option),
        keycap_styles: list(raw.keycap_styles).map(option),
        add_ons: list(raw.add_ons).map(option),
        available_icons: raw.icon_caps_enabled ? list(raw.available_icons).map(normalizeIcon).filter(icon => !icon.archived) : [],
    };
}
export function validateClickerConfiguration(product, configuration) {
    const schema = clickerOptions(product);
    if (!schema.casing_base_colors.length) throw new Error('Seller must configure base colors before ordering.');
    const slots = configuration.slotsData || [];
    if (!schema.available_slots.includes(configuration.slots) || slots.length !== configuration.slots) throw new Error('Choose a seller-configured slot count.');
    const selected = (options, id, label, required = true) => {
        if (!options.length && !id) return;
        const cId = canonicalColorId(id);
        if ((!id && required) || (id && !options.some(o => o.id === id || canonicalColorId(o.id) === cId))) throw new Error(`Choose a configured ${label}.`);
    };
    selected(schema.casing_base_colors, configuration.casing_color, 'base color');
    selected(schema.casing_styles, configuration.casing_style_id, 'casing style');
    for (const slot of slots) {
        if (!slot || (slot.type != null && !["letter", "icon"].includes(slot.type))) throw new Error("Choose a letter or icon for each slot.");
        if (!isIconSlot(slot)) {
            if (!schema.colors.length || !schema.allowed_characters) throw new Error("Seller must configure letter colors and characters before ordering.");
            selected(schema.colors, slot.colorId, 'keycap color');
            selected(schema.keycap_styles, slot.styleId, 'keycap style');
        }
        selected(schema.allowed_switch_types, slot.switchId || configuration.switch_type_id, 'switch');
        if (isIconSlot(slot)) selected(schema.available_icons, slot.iconId, 'icon');
        else if (Array.from(slot.char || '').length !== 1 || !Array.from(schema.allowed_characters || '').includes(slot.char)) throw new Error('Choose a seller-configured character for every slot.');
    }
    for (const id of configuration.selected_add_on_ids || []) selected(schema.add_ons, id, 'accessory');
    return configuration;
}
export function canonicalClickerConfiguration(product, configuration) {
    validateClickerConfiguration(product, configuration);
    const schema = clickerOptions(product);
    const rawColors = list(product.customizationOptions?.colors || product.customization_schema?.colors).map(option);
    const allColors = [...schema.colors, ...rawColors.filter(r => !schema.colors.some(c => c.id === r.id))];
    const slotsData = configuration.slotsData.map(slot => {
        const cId = canonicalColorId(slot.colorId);
        const color = allColors.find(c => c.id === slot.colorId || c.id === cId) || { id: cId, name: slot.colorName || cId, hex: slot.colorHex || '' };
        const switchId = slot.switchId || configuration.switch_type_id || '';
        const hardware = { switchId, switchName: schema.allowed_switch_types.find(s => s.id === switchId)?.name || '' };
        if (isIconSlot(slot)) {
            const icon = schema.available_icons.find(i => i.id === slot.iconId);
            return { type: 'icon', isIcon: true, iconId: icon.id, iconName: icon.name, iconEmoji: icon.emoji || '', imageUrl: icon.imageUrl, thumbnailUrl: icon.thumbnailUrl, ...hardware };
        }
        return { type: 'letter', isIcon: false, char: slot.char, colorId: color.id, colorName: color.name, colorHex: color.hex || '', styleId: slot.styleId || '', styleName: schema.keycap_styles.find(s => s.id === slot.styleId)?.name || '', ...hardware };
    });
    const baseId = canonicalColorId(configuration.casing_color);
    const rawBases = list(product.customizationOptions?.base_colors || product.customization_schema?.base_colors).map(option);
    const allBases = [...schema.casing_base_colors, ...rawBases.filter(r => !schema.casing_base_colors.some(c => c.id === r.id))];
    const base = allBases.find(c => c.id === configuration.casing_color || c.id === baseId) || { id: baseId, name: baseId, hex: '' };
    const selectedSwitch = schema.allowed_switch_types.find(s => s.id === configuration.switch_type_id);
    return { slots: slotsData.length, text: slotsData.map(s => s.isIcon ? `[${s.iconId}]` : s.char).join(''), slotsData,
        casingColor: { id: base.id, name: base.name, hex: base.hex || '' }, casingStyle: configuration.casing_style_id || '',
        switchType: selectedSwitch ? { id: selectedSwitch.id, name: selectedSwitch.name } : null,
        addons: [...new Set(configuration.selected_add_on_ids || [])].map(id => ({ id, name: schema.add_ons.find(a => a.id === id)?.name || id })),
        casing_color: base.id, casing_style_id: configuration.casing_style_id || '', switch_type_id: configuration.switch_type_id || '', selected_add_on_ids: [...new Set(configuration.selected_add_on_ids || [])] };
}
// Deliberate whitelist: never copy seller stock/cost/supplier fields publicly.
export function publicClickerOptions(product) {
    const schema = clickerOptions(product);
    const safeOptions = values => values.map(value => Object.fromEntries(Object.entries(value).filter(([key]) => [
        'id', 'name', 'label', 'hex', 'emoji', 'imageUrl', 'thumbnailUrl', 'slots', 'additional_price', 'additional_price_per_key', 'extra_price', 'extraPrice', 'price', 'per_key', 'active', 'archived',
    ].includes(key))));
    const result = {};
    for (const key of ['type', 'max_letters', 'base_included_letters', 'free_letter_count', 'extra_per_letter_price', 'extra_letter_price', 'allowed_characters', 'available_slots', 'slot_pricing', 'icon_caps_enabled', 'icon_cap_surcharge']) if (schema[key] !== undefined) result[key] = schema[key];
    for (const key of ['colors', 'casing_base_colors', 'casing_styles', 'allowed_switch_types', 'keycap_styles', 'add_ons', 'available_icons', 'base_slots']) result[key] = safeOptions(list(schema[key]).map(option));
    return result;
}
