/**
 * src/services/bazaarService.js
 * Core service layer for KenCreations Bazaar Hub.
 *
 * Implements:
 * 1. Deterministic single-shop IDs (shop_${uid}).
 * 2. Atomic slug reservation registry (shop_slugs/${slug}).
 * 3. Document-level separation between private seller records and sanitized public storefront projections.
 * 4. Seller event & product catalog management.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    runTransaction,
} from "firebase/firestore";
import { db } from "../firebase.js";

// ─── Helpers & Deterministic IDs ──────────────────────────────────────────────

/**
 * Generates the deterministic shop ID for a user.
 * Guarantees exactly one shop per user in Firestore storage.
 */
export const getShopId = (userId) => {
    if (!userId || typeof userId !== "string") throw new Error("A valid user ID is required.");
    return `shop_${userId}`;
};

/**
 * Normalizes user input into a URL-safe, lowercase alphanumeric slug.
 */
export function normalizeSlug(raw) {
    if (!raw || typeof raw !== "string") return "";
    return raw
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Validates slug format and length constraints.
 */
export function isValidSlug(slug) {
    if (!slug || typeof slug !== "string") return false;
    const normalized = normalizeSlug(slug);
    return normalized.length >= 3 && normalized.length <= 32 && normalized === slug;
}

// Collection references
export const shopsCol = () => collection(db, "shops");
export const shopDoc = (shopId) => doc(db, "shops", shopId);
export const publicShopDoc = (shopId) => doc(db, "public_shops", shopId);
export const slugDoc = (slug) => doc(db, "shop_slugs", slug);
export const publicEventsCol = () => collection(db, "public_events");
export const publicEventDoc = (eventId) => doc(db, "public_events", eventId);
export const publicProductsCol = () => collection(db, "public_products");
export const publicProductDoc = (productId) => doc(db, "public_products", productId);
export const orderTrackingDoc = (token) => doc(db, "order_tracking", token);

// ─── Shop Setup & Deterministic Single-Shop Enforcement ────────────────────────

/**
 * Retrieves the seller's private shop record.
 */
export async function getSellerShop(userId) {
    const shopId = getShopId(userId);
    const snap = await getDoc(shopDoc(shopId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

/**
 * Creates or updates a shop with deterministic ID and atomic slug reservation.
 */
export async function createOrUpdateShop(userId, shopData) {
    const shopId = getShopId(userId);
    const normalizedSlug = normalizeSlug(shopData.slug || shopData.name);
    if (!isValidSlug(normalizedSlug)) {
        throw new Error("Invalid shop slug. Slugs must be 3-32 characters, lowercase letters, numbers, and hyphens.");
    }

    const sRef = shopDoc(shopId);
    const psRef = publicShopDoc(shopId);
    const newSlugRef = slugDoc(normalizedSlug);

    await runTransaction(db, async (txn) => {
        const existingShopSnap = await txn.get(sRef);
        const existingShop = existingShopSnap.exists() ? existingShopSnap.data() : null;

        // Verify if slug is already claimed by another shop
        const slugSnap = await txn.get(newSlugRef);
        if (slugSnap.exists() && slugSnap.data().shop_id !== shopId) {
            throw new Error(`The slug "${normalizedSlug}" is already taken by another seller. Please choose a different slug.`);
        }

        // If changing slug, release old slug
        if (existingShop?.slug && existingShop.slug !== normalizedSlug) {
            const oldSlugRef = slugDoc(existingShop.slug);
            txn.delete(oldSlugRef);
        }

        // Reserve new slug
        txn.set(newSlugRef, {
            shop_id: shopId,
            owner_uid: userId,
            created_at: serverTimestamp(),
        });

        // 1. Private Seller Document (Full configuration)
        const privatePayload = {
            owner_uid: userId,
            name: shopData.name || "My 3D Print Shop",
            slug: normalizedSlug,
            description: shopData.description || "",
            logo_url: shopData.logo_url || "",
            banner_url: shopData.banner_url || "",
            contact_number: shopData.contact_number || "",
            contact_email: shopData.contact_email || "",
            pickup_instructions: shopData.pickup_instructions || "Please pick up your items at the booth counter.",
            cash_enabled: shopData.cash_enabled !== false,
            gcash_enabled: shopData.gcash_enabled === true,
            gcash_number: shopData.gcash_number || "",
            gcash_name: shopData.gcash_name || "",
            gcash_qr_url: shopData.gcash_qr_url || "",
            internal_notes: shopData.internal_notes || "",
            is_published: shopData.is_published === true,
            updated_at: serverTimestamp(),
            ...(existingShop ? {} : { created_at: serverTimestamp() }),
        };
        txn.set(sRef, privatePayload, { merge: true });

        // 2. Sanitized Public Projection Document (Document-level isolation)
        const publicPayload = {
            shop_id: shopId,
            owner_uid: userId,
            name: privatePayload.name,
            slug: normalizedSlug,
            description: privatePayload.description,
            logo_url: privatePayload.logo_url,
            banner_url: privatePayload.banner_url,
            pickup_instructions: privatePayload.pickup_instructions,
            cash_enabled: privatePayload.cash_enabled,
            gcash_enabled: privatePayload.gcash_enabled,
            gcash_number: privatePayload.gcash_number,
            gcash_name: privatePayload.gcash_name,
            gcash_qr_url: privatePayload.gcash_qr_url,
            is_published: privatePayload.is_published,
            updated_at: serverTimestamp(),
        };
        txn.set(psRef, publicPayload, { merge: true });
    });

    return { id: shopId, slug: normalizedSlug };
}

// ─── Public Storefront Projections ─────────────────────────────────────────────

/**
 * Resolves a shop's public profile from its public slug.
 */
export async function getPublicShopBySlug(slug) {
    const normSlug = normalizeSlug(slug);
    const sSnap = await getDoc(slugDoc(normSlug));
    if (!sSnap.exists()) return null;

    const shopId = sSnap.data().shop_id;
    const pSnap = await getDoc(publicShopDoc(shopId));
    if (!pSnap.exists() || !pSnap.data().is_published) return null;

    return { id: pSnap.id, ...pSnap.data() };
}

/**
 * Retrieves public event details by event ID or slug.
 */
export async function getPublicEvent(eventId) {
    const snap = await getDoc(publicEventDoc(eventId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.status !== "Active" && data.status !== "Scheduled") return null;
    return { id: snap.id, ...data };
}

/**
 * Retrieves public products for a shop.
 */
export async function getPublicProducts(shopId) {
    const q = query(
        publicProductsCol(),
        where("shop_id", "==", shopId),
        where("status", "==", "active")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Retrieves public sanitized order tracking ticket.
 * Excludes customer PII, seller margins, and cost records.
 */
export async function getPublicOrderTracking(cryptoToken) {
    if (!cryptoToken || typeof cryptoToken !== "string") return null;
    const snap = await getDoc(orderTrackingDoc(cryptoToken));
    if (!snap.exists()) return null;
    return { token: snap.id, ...snap.data() };
}
