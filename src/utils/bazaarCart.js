/**
 * src/utils/bazaarCart.js
 * Client-side guest cart manager for KenCreations Bazaar Hub storefronts.
 * 
 * Enforces:
 * 1. Event isolation: Cart from Event A cannot be silently submitted under Event B.
 * 2. Full customization preservation: Decomposed letter sequences, colors, switch selections.
 * 3. Reactive cart updates via custom browser events.
 */

export function getCartStorageKey(shopSlug, eventIdentifier = "general") {
    const s = String(shopSlug || "unknown").toLowerCase().trim();
    const e = String(eventIdentifier || "general").toLowerCase().trim();
    return `bazaar_cart_${s}_${e}`;
}

export function loadCart(shopSlug, eventIdentifier = "general") {
    try {
        const key = getCartStorageKey(shopSlug, eventIdentifier);
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("[bazaarCart] Failed to load cart:", e);
        return [];
    }
}

export function saveCart(shopSlug, eventIdentifier = "general", items = []) {
    try {
        const key = getCartStorageKey(shopSlug, eventIdentifier);
        localStorage.setItem(key, JSON.stringify(items));
        // Broadcast custom event so active layout/header can update immediately
        window.dispatchEvent(new CustomEvent("bazaar_cart_updated", { detail: { shopSlug, eventIdentifier, count: items.length } }));
    } catch (e) {
        console.error("[bazaarCart] Failed to save cart:", e);
    }
}

export function addToCart(shopSlug, eventIdentifier = "general", newItem) {
    const current = loadCart(shopSlug, eventIdentifier);
    
    // If identical item already exists (same product and identical customization), increment qty
    const matchIndex = current.findIndex((item) => {
        if (item.productId !== newItem.productId) return false;
        if (item.type !== newItem.type) return false;
        return JSON.stringify(item.customization || {}) === JSON.stringify(newItem.customization || {}) &&
               JSON.stringify(item.selectedVariant || {}) === JSON.stringify(newItem.selectedVariant || {});
    });

    let updated;
    if (matchIndex >= 0) {
        updated = [...current];
        const maxQty = newItem.maxOrderQty || 10;
        updated[matchIndex].quantity = Math.min(maxQty, (updated[matchIndex].quantity || 1) + (newItem.quantity || 1));
    } else {
        const cartItemId = `cart_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        updated = [...current, { ...newItem, cartItemId }];
    }

    saveCart(shopSlug, eventIdentifier, updated);
    return updated;
}

export function updateCartQuantity(shopSlug, eventIdentifier = "general", cartItemId, newQuantity) {
    const current = loadCart(shopSlug, eventIdentifier);
    const qty = Math.max(1, Math.floor(Number(newQuantity) || 1));
    const updated = current.map((item) => {
        if (item.cartItemId === cartItemId) {
            const max = item.maxOrderQty || 10;
            return { ...item, quantity: Math.min(max, qty) };
        }
        return item;
    });
    saveCart(shopSlug, eventIdentifier, updated);
    return updated;
}

export function removeFromCart(shopSlug, eventIdentifier = "general", cartItemId) {
    const current = loadCart(shopSlug, eventIdentifier);
    const updated = current.filter((item) => item.cartItemId !== cartItemId);
    saveCart(shopSlug, eventIdentifier, updated);
    return updated;
}

export function clearCart(shopSlug, eventIdentifier = "general") {
    saveCart(shopSlug, eventIdentifier, []);
}

export function calculateCartSummary(items = []) {
    let itemCount = 0;
    let subtotal = 0;
    for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.finalUnitPrice || item.price || 0);
        itemCount += qty;
        subtotal += price * qty;
    }
    return {
        itemCount,
        subtotal,
    };
}
