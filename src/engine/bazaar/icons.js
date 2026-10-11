// One catalog for legacy IDs and seller-owned artwork metadata.
export const BUILTIN_ICONS = [
    ['heart','Heart','❤️'], ['star','Star','⭐'], ['crown','Crown','👑'],
    ['gamepad','Gaming','🎮'], ['paw','Paw','🐾'], ['zap','Lightning','⚡'],
    ['music','Music','🎵'], ['flame','Fire','🔥'], ['smile','Smile','😊'],
    ['cat','Cat','🐱'], ['coffee','Coffee','☕'], ['rocket','Rocket','🚀'],
].map(([id, name, emoji]) => ({ id, name, label: name, emoji }));

export const isIconSlot = slot => slot?.type === 'icon' || (slot?.type == null && slot?.isIcon === true);
export function safeIconUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return '';
    if (/^\/[^/\\]/.test(value) && !value.includes('\\')) return value;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function normalizeIcon(value) {
    const raw = typeof value === 'string' ? { id: value } : value || {};
    const builtin = BUILTIN_ICONS.find(icon => icon.id === raw.id);
    return { ...builtin, ...raw, name: raw.name || raw.label || builtin?.name || raw.id || 'Unnamed icon', imageUrl: safeIconUrl(raw.imageUrl), thumbnailUrl: safeIconUrl(raw.thumbnailUrl) };
}
export function validComponentKey(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[/\\]/.test(value) && !/(^|_)(undefined|null)(_|$)/i.test(value);
}
export function iconComponents(icon) {
    if (icon.fulfillmentMode === 'preprinted' && validComponentKey(icon.inventorySku)) return [{ component_key: icon.inventorySku, required_qty: 1, name: icon.name, item_type: 'icon_cap' }];
    if (icon.fulfillmentMode === 'made_to_order' && Array.isArray(icon.components) && icon.components.length && icon.components.every(c => validComponentKey(c.component_key) && Number.isInteger(c.required_qty) && c.required_qty > 0)) return icon.components;
    throw new Error(`Seller must configure inventory or production materials for icon ${icon.name || icon.id}. Artwork alone cannot be ordered.`);
}
