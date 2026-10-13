/**
 * src/services/bazaarService.js
 * Core service layer for KenCreations Bazaar Hub.
 *
 * Implements:
 * 1. Deterministic single-shop IDs (shop_${uid}).
 * 2. Atomic slug reservation registry (shop_slugs/${slug}).
 * 3. Document-level separation between private seller records and sanitized public storefront projections.
 * 4. Explicit subcollections: events, products, inventory, inventory_movements, financial_movements, orders, settings.
 * 5. Strict public schema sanitization preventing leakage of costs, margins, or PII.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction,
    writeBatch,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { publicClickerOptions } from '../engine/bazaar/configuration.js';


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
        .replace(/['']/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
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

// ─── Document & Collection References ─────────────────────────────────────────

// Top-level collections
export const shopsCol = () => collection(db, "shops");
export const shopDoc = (shopId) => doc(db, "shops", shopId);
export const publicShopsCol = () => collection(db, "public_shops");
export const publicShopDoc = (shopId) => doc(db, "public_shops", shopId);
export const slugDoc = (slug) => doc(db, "shop_slugs", slug);
export const eventSlugDoc = (slug) => doc(db, "event_slugs", slug);

export const publicEventsCol = () => collection(db, "public_events");
export const publicEventDoc = (eventId) => doc(db, "public_events", eventId);
export const publicProductsCol = () => collection(db, "public_products");
export const publicProductDoc = (productId) => doc(db, "public_products", productId);
export const orderTrackingDoc = (token) => doc(db, "order_tracking", token);
export const orderInboxDoc = (inboxId) => doc(db, "order_inbox", inboxId);

// Explicit Subcollections under /shops/{shopId}/
export const shopEventsCol = (shopId) => collection(db, "shops", shopId, "events");
export const shopEventDoc = (shopId, eventId) => doc(db, "shops", shopId, "events", eventId);

export const shopProductsCol = (shopId) => collection(db, "shops", shopId, "products");
export const shopProductDoc = (shopId, productId) => doc(db, "shops", shopId, "products", productId);

export const shopInventoryCol = (shopId) => collection(db, "shops", shopId, "inventory");
export const shopInventoryDoc = (shopId, itemId) => doc(db, "shops", shopId, "inventory", itemId);

export const shopInventoryMovementsCol = (shopId) => collection(db, "shops", shopId, "inventory_movements");
export const shopInventoryMovementDoc = (shopId, movementId) => doc(db, "shops", shopId, "inventory_movements", movementId);

export const shopFinancialMovementsCol = (shopId) => collection(db, "shops", shopId, "financial_movements");
export const shopFinancialMovementDoc = (shopId, movementId) => doc(db, "shops", shopId, "financial_movements", movementId);

export const shopOrdersCol = (shopId) => collection(db, "shops", shopId, "orders");
export const shopOrderDoc = (shopId, orderId) => doc(db, "shops", shopId, "orders", orderId);

export const shopSettingsCol = (shopId) => collection(db, "shops", shopId, "settings");
export const shopSettingDoc = (shopId, settingId) => doc(db, "shops", shopId, "settings", settingId);

export const shopEventProductCatalogDoc = (shopId, eventId) => doc(db, "shops", shopId, "event_catalogs", eventId);
export const shopEventAllocationDoc = (shopId, eventId) => doc(db, "shops", shopId, "event_allocations", eventId);

// ─── Public Projection Sanitizers (Data Leak Prevention) ─────────────────────


/**
 * Sanitizes private shop data for the public storefront.
 * Strictly excludes internal notes, private contact details, and payout keys.
 */
export function sanitizePublicShop(privateShop = {}) {
    return {
        shopId: privateShop.shopId || privateShop.shop_id,
        ownerUid: privateShop.ownerUid || privateShop.owner_uid,
        name: privateShop.name || "KenCreations Maker Shop",
        slug: normalizeSlug(privateShop.slug || ""),
        description: privateShop.description || "",
        logoUrl: privateShop.logoUrl || privateShop.logo_url || "",
        bannerUrl: privateShop.bannerUrl || privateShop.banner_url || "",
        pickupInstructions: privateShop.pickupInstructions || privateShop.pickup_instructions || "",
        cashEnabled: privateShop.cashEnabled !== false && privateShop.cash_enabled !== false,
        gcashEnabled: privateShop.gcashEnabled === true || privateShop.gcash_enabled === true,
        gcashNumber: privateShop.gcashNumber || privateShop.gcash_number || "",
        gcashName: privateShop.gcashName || privateShop.gcash_name || "",
        gcashQrUrl: privateShop.gcashQrUrl || privateShop.gcash_qr_url || "",
        isPublished: privateShop.isPublished === true || privateShop.is_published === true,
        updatedAt: serverTimestamp(),
    };
}

/**
 * Sanitizes private event data for public QR landing page.
 * Strictly excludes booth cash float, private event notes, and target revenues.
 */
export function sanitizePublicEvent(privateEvent = {}) {
    const rawCatalog = privateEvent.catalog || {};
    const stock = rawCatalog._stock || privateEvent._stock || privateEvent.availableStock || null;
    const sanitizedCatalog = Object.fromEntries(
        Object.entries(rawCatalog)
            .filter(([id]) => id !== '_stock')
            .map(([id, value]) => [
                id,
                Object.fromEntries(Object.entries(value || {}).filter(([key]) => ['enabled', 'price_override', 'max_order_qty'].includes(key)))
            ])
    );
    if (stock && typeof stock === 'object') {
        sanitizedCatalog._stock = Object.fromEntries(
            Object.entries(stock).filter(([k, v]) => Number.isFinite(v)).map(([k, v]) => [k, Math.max(0, Math.floor(v))])
        );
    }
    return {
        eventId: privateEvent.eventId || privateEvent.event_id || privateEvent.id,
        shopId: privateEvent.shopId || privateEvent.shop_id,
        ownerUid: privateEvent.ownerUid || privateEvent.owner_uid,
        name: privateEvent.name || "Bazaar Event",
        slug: normalizeSlug(privateEvent.slug || ""),
        venue: privateEvent.venue || "",
        startDate: privateEvent.startDate || privateEvent.start_date || null,
        endDate: privateEvent.endDate || privateEvent.end_date || null,
        isAcceptingOrders: privateEvent.isAcceptingOrders !== false && privateEvent.is_accepting_orders !== false,
        queueStatus: privateEvent.queueStatus || privateEvent.queue_status || "open",
        status: privateEvent.status || 'Scheduled',
        isPublished: privateEvent.isPublished !== false && privateEvent.queueStatus !== 'unpublished',
        catalog: sanitizedCatalog,
        updatedAt: serverTimestamp(),
    };
}

/**
 * Sanitizes product catalog for the public customer kiosk.
 * Strictly excludes internal unit costs, filament IDs, supplier notes, and profit margins.
 */
export function sanitizePublicProduct(privateProduct = {}) {
    const id = privateProduct.productId || privateProduct.product_id || privateProduct.id;
    const price = Number(privateProduct.retailPrice ?? privateProduct.retail_price ?? privateProduct.base_price ?? 0);
    return {
        id,
        productId: id,
        shopId: privateProduct.shopId || privateProduct.shop_id,
        ownerUid: privateProduct.ownerUid || privateProduct.owner_uid,
        name: privateProduct.name || privateProduct.title || "Custom 3D Print",
        description: privateProduct.description || "",
        category: privateProduct.category || "custom",
        type: privateProduct.type || null,
        maxOrderQty: privateProduct.maxOrderQty || 5,
        variants: (privateProduct.variants || []).map(v => Object.fromEntries(Object.entries(v).filter(([key]) => ['id', 'name', 'color', 'size', 'price', 'retailPrice', 'extraPrice'].includes(key)))),
        price,
        retailPrice: price,
        images: Array.isArray(privateProduct.images) ? privateProduct.images : [],
        customizationOptions: publicClickerOptions(privateProduct),
        inStock: privateProduct.inStock !== false && privateProduct.in_stock !== false,
        isPublished: privateProduct.isPublished !== false,
        badge: privateProduct.badge || "",
        updatedAt: serverTimestamp(),
    };
}

/**
 * Sanitizes order tracking document for public customer view.
 * Strictly excludes customer phone, customer email, internal seller notes, unit costs, and profit margins.
 */
export function sanitizePublicOrderTracking(privateOrder = {}, cryptoToken = "") {
    return {
        trackingToken: cryptoToken,
        orderNumber: privateOrder.orderNumber || privateOrder.order_number,
        fulfillmentStatus: privateOrder.fulfillmentStatus || privateOrder.fulfillment_status || "pending",
        paymentStatus: privateOrder.paymentStatus || privateOrder.payment_status || "unpaid",
        pickupCode: privateOrder.pickupCode || privateOrder.pickup_code || "",
        pickupInstructions: privateOrder.pickupInstructions || privateOrder.pickup_instructions || "",
        itemsSummary: (privateOrder.items || []).map((item) => ({
            title: item.title || item.name || "Custom Item",
            summary: item.customization?.text
                ? `${item.customization.text.length}-Letter (${item.customization.text})`
                : item.title || "Custom Item",
        })),
        estimatedReadyAt: privateOrder.estimatedReadyAt || privateOrder.estimated_ready_at || null,
        expiresAt: privateOrder.expiresAt || privateOrder.expires_at || null,
        revoked: privateOrder.revoked === true,
        updatedAt: serverTimestamp(),
    };
}

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
 * Updates seller custom colors on the private shop document.
 */
export async function updateShopCustomColors(userId, customColors) {
    const shopId = getShopId(userId);
    const sRef = shopDoc(shopId);
    await setDoc(sRef, {
        customColors,
        updatedAt: serverTimestamp(),
    }, { merge: true });
    return customColors;
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
        if (slugSnap.exists() && slugSnap.data().shopId !== shopId && slugSnap.data().shop_id !== shopId) {
            throw new Error(`The slug "${normalizedSlug}" is already taken by another seller. Please choose a different slug.`);
        }

        // If changing slug, release old slug
        const oldSlug = existingShop?.slug;
        if (oldSlug && oldSlug !== normalizedSlug) {
            const oldSlugRef = slugDoc(oldSlug);
            txn.delete(oldSlugRef);
        }

        // Reserve new slug (atomic ownership mapping)
        txn.set(newSlugRef, {
            shopId: shopId,
            shop_id: shopId,
            ownerUid: userId,
            owner_uid: userId,
            slug: normalizedSlug,
            createdAt: serverTimestamp(),
            created_at: serverTimestamp(),
        });

        // 1. Private Seller Document (Full configuration)
        const privatePayload = {
            shopId: shopId,
            shop_id: shopId,
            ownerUid: userId,
            owner_uid: userId,
            name: shopData.name || "My 3D Print Shop",
            slug: normalizedSlug,
            description: shopData.description || "",
            logoUrl: shopData.logoUrl || shopData.logo_url || "",
            logo_url: shopData.logoUrl || shopData.logo_url || "",
            bannerUrl: shopData.bannerUrl || shopData.banner_url || "",
            banner_url: shopData.bannerUrl || shopData.banner_url || "",
            contactNumber: shopData.contactNumber || shopData.contact_number || "",
            contactEmail: shopData.contactEmail || shopData.contact_email || "",
            pickupInstructions: shopData.pickupInstructions || shopData.pickup_instructions || "Please pick up your items at the booth counter.",
            cashEnabled: shopData.cashEnabled !== false && shopData.cash_enabled !== false,
            cash_enabled: shopData.cashEnabled !== false && shopData.cash_enabled !== false,
            gcashEnabled: shopData.gcashEnabled === true || shopData.gcash_enabled === true,
            gcash_enabled: shopData.gcashEnabled === true || shopData.gcash_enabled === true,
            gcashNumber: shopData.gcashNumber || shopData.gcash_number || "",
            gcashName: shopData.gcashName || shopData.gcash_name || "",
            gcashQrUrl: shopData.gcashQrUrl || shopData.gcash_qr_url || "",
            internalNotes: shopData.internalNotes || shopData.internal_notes || "",
            isPublished: shopData.isPublished === true || shopData.is_published === true,
            is_published: shopData.isPublished === true || shopData.is_published === true,
            updatedAt: serverTimestamp(),
            updated_at: serverTimestamp(),
            ...(existingShop ? {} : { createdAt: serverTimestamp(), created_at: serverTimestamp() }),
        };
        txn.set(sRef, privatePayload, { merge: true });

        // 2. Sanitized Public Projection Document (Schema-constrained publication)
        const publicPayload = sanitizePublicShop(privatePayload);
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

    const data = sSnap.data();
    const shopId = data.shopId || data.shop_id;
    const pSnap = await getDoc(publicShopDoc(shopId));
    if (!pSnap.exists() || (!pSnap.data().isPublished && !pSnap.data().is_published)) return null;

    return { id: pSnap.id, ...pSnap.data() };
}

export async function getPublicShopById(shopId) {
    const snap = await getDoc(publicShopDoc(shopId));
    if (!snap.exists() || snap.data().isPublished !== true) return null;
    return { ...snap.data(), id: snap.id, shopId: snap.id };
}

/**
 * Retrieves public event details by event ID.
 */
export async function getPublicEvent(eventId) {
    const snap = await getDoc(publicEventDoc(eventId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.status !== "Active" && data.status !== "Scheduled" && data.queueStatus === "closed") return null;
    return { id: snap.id, ...data };
}

/**
 * Retrieves public products for a shop.
 */
export async function getPublicProducts(shopId) {
    const q = query(
        publicProductsCol(),
        where("shopId", "==", shopId), where('isPublished', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Retrieves a single public product by ID.
 */
export async function getPublicProduct(productId) {
    if (!productId) return null;
    const snap = await getDoc(publicProductDoc(productId));
    if (!snap.exists() || snap.data().isPublished !== true) return null;
    return { id: snap.id, ...snap.data() };
}

/**
 * Resolves a public event by its slug or ID.
 */
export async function getPublicEventBySlugOrId(identifier) {
    if (!identifier) return null;
    const cleanId = String(identifier).trim();
    const cleanSlug = normalizeSlug(cleanId);

    // Tier 1: Direct doc lookup by ID
    try {
        const snap = await getDoc(publicEventDoc(cleanId));
        if (snap.exists()) {
            const data = snap.data();
            if (data.isPublished !== false && data.queueStatus !== 'unpublished') {
                return { id: snap.id, ...data };
            }
        }
    } catch (err) {
        // Safe catch: non-existent document or temporary network blip
    }

    // Tier 2: Direct lookup by Slug Registry (event_slugs/{slug})
    try {
        const slugSnap = await getDoc(eventSlugDoc(cleanSlug));
        if (slugSnap.exists()) {
            const evId = slugSnap.data().eventId || slugSnap.data().id;
            if (evId) {
                const targetSnap = await getDoc(publicEventDoc(evId));
                if (targetSnap.exists()) {
                    const data = targetSnap.data();
                    if (data.isPublished !== false && data.queueStatus !== 'unpublished') {
                        return { id: targetSnap.id, ...data };
                    }
                }
            }
        }
    } catch (err) {
        // Safe catch
    }

    // Tier 3: Direct doc lookup by slug as document ID (public_events/{slug})
    if (cleanSlug !== cleanId) {
        try {
            const slugDocSnap = await getDoc(publicEventDoc(cleanSlug));
            if (slugDocSnap.exists()) {
                const data = slugDocSnap.data();
                if (data.isPublished !== false && data.queueStatus !== 'unpublished') {
                    return { id: slugDocSnap.id, ...data };
                }
            }
        } catch (err) {
            // Safe catch
        }
    }

    // Tier 4: Query by published slug
    try {
        const q = query(
            publicEventsCol(),
            where("slug", "==", cleanSlug),
            where("isPublished", "==", true),
            limit(1)
        );
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            const d = querySnap.docs[0];
            const data = d.data();
            if (data.isPublished !== false && data.queueStatus !== 'unpublished') {
                return { id: d.id, ...data };
            }
        }
    } catch (err) {
        console.warn(`[getPublicEventBySlugOrId] Slug query fallback for "${cleanSlug}":`, err?.code || err?.message);
    }

    return null;
}

/**
 * Retrieves public sanitized order tracking ticket using capability token.
 * Prevents enumeration and respects revocation and expiration.
 */
export async function getPublicOrderTracking(cryptoToken) {
    if (!cryptoToken || typeof cryptoToken !== "string") return null;
    const snap = await getDoc(orderTrackingDoc(cryptoToken));
    if (!snap.exists()) return null;
    const data = snap.data();

    // Check revocation and expiration
    if (data.revoked === true) return null;
    const expires = typeof data.expiresAt?.toMillis === 'function' ? data.expiresAt.toMillis() : Number(data.expiresAt);
    if (data.expiresAt && Number.isFinite(expires) && expires < Date.now()) {
        return null;
    }

    return { token: snap.id, ...data };
}

// ─── Event Management ─────────────────────────────────────────────────────────

/**
 * Retrieves all events created under a seller's shop.
 */
export async function getSellerEvents(userId) {
    if (!userId) return [];
    const shopId = getShopId(userId);
    const snap = await getDocs(shopEventsCol(shopId));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Retrieves a single private event under a seller's shop.
 */
export async function getSellerEvent(userId, eventId) {
    if (!userId || !eventId) return null;
    const shopId = getShopId(userId);
    const snap = await getDoc(shopEventDoc(shopId, eventId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

/**
 * Creates a new event under the seller's shop and publishes the sanitized public projection.
 */
export async function createEvent(userId, eventData) {
    if (!userId) throw new Error("A valid user ID is required to create an event.");
    const shopId = getShopId(userId);
    const eventId = eventData.eventId || eventData.event_id || `ev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = normalizeSlug(eventData.slug || eventData.name || "event");

    const privateEvent = {
        eventId,
        shopId,
        ownerUid: userId,
        name: eventData.name?.trim() || "Bazaar Event",
        slug,
        venue: eventData.venue?.trim() || "",
        boothNumber: eventData.boothNumber?.trim() || eventData.booth_number?.trim() || "",
        startDate: eventData.startDate || eventData.start_date || null,
        endDate: eventData.endDate || eventData.end_date || null,
        openingHours: eventData.openingHours?.trim() || eventData.opening_hours?.trim() || "",
        pickupInstructions: eventData.pickupInstructions?.trim() || eventData.pickup_instructions?.trim() || "Pick up at counter",
        status: eventData.status || "Scheduled",
        queueStatus: eventData.queueStatus || (eventData.isAcceptingOrders === false ? "paused" : "open"),
        isAcceptingOrders: eventData.isAcceptingOrders !== false,
        pendingQueueCapacity: Number(eventData.pendingQueueCapacity ?? eventData.pending_queue_capacity ?? 10),
        activeProductionCapacity: Number(eventData.activeProductionCapacity ?? eventData.active_production_capacity ?? 5),
        notes: eventData.notes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const publicEvent = sanitizePublicEvent(privateEvent);

    // Save private event and public projection
    await setDoc(shopEventDoc(shopId, eventId), privateEvent);
    await setDoc(publicEventDoc(eventId), publicEvent);

    // Register atomic event slug mapping for direct O(1) public lookups
    if (slug) {
        try {
            await setDoc(eventSlugDoc(slug), {
                ownerUid: userId,
                shopId,
                eventId,
                slug,
                createdAt: serverTimestamp(),
            });
        } catch (slugErr) {
            console.warn('[createEvent] Could not register event slug:', slugErr?.message);
        }
    }

    return { id: eventId, ...privateEvent };
}

/**
 * Updates an existing event under the seller's shop and syncs the public projection.
 */
export async function updateEvent(userId, eventId, eventData) {
    if (!userId || !eventId) throw new Error("User ID and Event ID are required.");
    const shopId = getShopId(userId);

    const existingSnap = await getDoc(shopEventDoc(shopId, eventId));
    if (!existingSnap.exists()) throw new Error(`Event "${eventId}" not found.`);
    const existing = existingSnap.data();

    const slug = normalizeSlug(eventData.slug ?? existing.slug ?? eventData.name ?? existing.name);

    const updatedPrivate = {
        ...existing,
        ...eventData,
        eventId,
        shopId,
        ownerUid: userId,
        slug,
        updatedAt: serverTimestamp(),
    };

    const publicEvent = sanitizePublicEvent(updatedPrivate);

    await setDoc(shopEventDoc(shopId, eventId), updatedPrivate, { merge: true });
    await setDoc(publicEventDoc(eventId), publicEvent, { merge: true });

    // Sync atomic event slug registry
    if (slug) {
        try {
            await setDoc(eventSlugDoc(slug), {
                ownerUid: userId,
                shopId,
                eventId,
                slug,
                createdAt: serverTimestamp(),
            });
        } catch (slugErr) {
            console.warn('[updateEvent] Could not update event slug:', slugErr?.message);
        }
    }

    return { id: eventId, ...updatedPrivate };
}

/**
 * Controlled migration for published event public projections & slug registry.
 * Validates queueStatus, isPublished, slug registry, and projection consistency.
 * Supports dry-run reporting without fabricating data.
 */
export async function migrateEventPublicProjections(userId, dryRun = true) {
    if (!userId) throw new Error("A valid user ID is required to migrate event projections.");
    const shopId = getShopId(userId);
    const events = await getSellerEvents(userId);

    const report = {
        shopId,
        totalEvents: events.length,
        scannedAt: new Date().toISOString(),
        dryRun,
        synced: 0,
        skipped: 0,
        errors: 0,
        results: [],
    };

    for (const ev of events) {
        const eventId = ev.eventId || ev.id;
        const slug = normalizeSlug(ev.slug || ev.name || "");
        const entry = {
            eventId,
            name: ev.name || "Untitled Event",
            slug,
            issuesDetected: [],
            actionsTaken: [],
        };

        try {
            // Check public event projection
            let publicSnap = null;
            try {
                publicSnap = await getDoc(publicEventDoc(eventId));
            } catch (err) {
                entry.issuesDetected.push(`PUBLIC_DOC_READ_ERROR: ${err.message}`);
            }

            const publicData = publicSnap?.exists() ? publicSnap.data() : null;
            if (!publicData) {
                entry.issuesDetected.push("MISSING_PUBLIC_PROJECTION");
            } else {
                if (!publicData.queueStatus) entry.issuesDetected.push("MISSING_QUEUE_STATUS");
                if (publicData.isPublished === undefined) entry.issuesDetected.push("MISSING_IS_PUBLISHED");
                if (publicData.shopId !== shopId) entry.issuesDetected.push("INCONSISTENT_SHOP_ID");
                if (publicData.slug !== slug) entry.issuesDetected.push("STALE_SLUG");
            }

            // Check slug registry
            if (slug) {
                let slugSnap = null;
                try {
                    slugSnap = await getDoc(eventSlugDoc(slug));
                } catch (err) {
                    entry.issuesDetected.push(`SLUG_DOC_READ_ERROR: ${err.message}`);
                }
                if (!slugSnap?.exists()) {
                    entry.issuesDetected.push("MISSING_SLUG_REGISTRY");
                }
            }

            // Actions
            if (entry.issuesDetected.length > 0) {
                if (!dryRun) {
                    const sanitized = sanitizePublicEvent(ev);
                    await setDoc(publicEventDoc(eventId), sanitized, { merge: true });
                    entry.actionsTaken.push("UPDATED_PUBLIC_PROJECTION");

                    if (slug) {
                        await setDoc(eventSlugDoc(slug), {
                            ownerUid: userId,
                            shopId,
                            eventId,
                            slug,
                            createdAt: serverTimestamp(),
                        });
                        entry.actionsTaken.push("REGISTERED_EVENT_SLUG");
                    }
                    report.synced++;
                } else {
                    entry.actionsTaken.push("DRY_RUN_NO_ACTION");
                    report.skipped++;
                }
            } else {
                entry.actionsTaken.push("ALREADY_IN_SYNC");
                report.skipped++;
            }
        } catch (itemErr) {
            entry.issuesDetected.push(`FATAL_ERROR: ${itemErr.message}`);
            report.errors++;
        }

        report.results.push(entry);
    }

    return report;
}

/**
 * Toggles whether an event is actively accepting new orders.
 */
export async function toggleEventAcceptingOrders(userId, eventId, isAcceptingOrders) {
    const queueStatus = isAcceptingOrders ? "open" : "paused";
    return updateEvent(userId, eventId, {
        isAcceptingOrders,
        queueStatus,
    });
}

/**
 * Updates event operational status (e.g. Scheduled -> Active -> Ended).
 */
export async function updateEventStatus(userId, eventId, status) {
    const updates = { status };
    if (status === "Ended") {
        updates.isAcceptingOrders = false;
        updates.queueStatus = "closed";
    } else if (status === "Active") {
        updates.isAcceptingOrders = true;
        updates.queueStatus = "open";
    }
    return updateEvent(userId, eventId, updates);
}

// ─── Milestone 3: Product Catalog Management ──────────────────────────────────

/**
 * Retrieves all active/draft products for a seller's shop (excludes archived).
 */
export async function getSellerProducts(userId) {
    if (!userId) return [];
    const shopId = getShopId(userId);
    const snap = await getDocs(shopProductsCol(shopId));
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.status !== "archived");
}

/**
 * Retrieves all products including archived records.
 */
export async function getAllSellerProducts(userId) {
    if (!userId) return [];
    const shopId = getShopId(userId);
    const snap = await getDocs(shopProductsCol(shopId));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Retrieves a single private product by ID.
 */
export async function getSellerProduct(userId, productId) {
    if (!userId || !productId) return null;
    const shopId = getShopId(userId);
    const snap = await getDoc(shopProductDoc(shopId, productId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

/**
 * Recursively cleanses an object/array by eliminating any keys with `undefined` values,
 * ensuring Firestore setDoc / updateDoc never throws "Unsupported field value: undefined".
 */
export function sanitizeForFirestore(val) {
    if (val === undefined) return null;
    if (val === null) return null;
    if (typeof val !== "object") return val;
    if (val instanceof Date) return val;
    if (typeof val.toMillis === "function") return val;
    if (val._methodName) return val;
    if (Array.isArray(val)) {
        return val
            .filter((item) => item !== undefined)
            .map((item) => sanitizeForFirestore(item));
    }
    const clean = {};
    for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) {
            clean[k] = sanitizeForFirestore(v);
        }
    }
    return clean;
}

/**
 * Creates a new product in the seller's catalog and syncs public projection.
 */
export async function createProduct(userId, productData) {
    if (!userId) throw new Error("A valid user ID is required to create a product.");
    const shopId = getShopId(userId);
    const productId = productData.productId || productData.product_id || `prod_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const privateProduct = sanitizeForFirestore({
        productId,
        shopId,
        ownerUid: userId,
        name: productData.name?.trim() || "Untitled Product",
        description: productData.description?.trim() || "",
        category: productData.category || "Clickers",
        type: productData.type || "made_to_order", // 'ready_made' | 'made_to_order'
        sku: productData.sku?.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
        retailPrice: Number(productData.retailPrice ?? productData.base_price ?? 0),
        images: Array.isArray(productData.images) ? productData.images : [],
        status: productData.status || "active", // 'active' | 'draft' | 'archived'
        isPublished: productData.isPublished !== false,
        maxOrderQty: Number(productData.maxOrderQty ?? productData.max_order_qty ?? 10),

        // Ready-made specific fields
        variants: Array.isArray(productData.variants) ? productData.variants : [],
        stockQty: Number(productData.stockQty ?? productData.stock_qty ?? 0),
        lowStockThreshold: Number(productData.lowStockThreshold ?? productData.low_stock_threshold ?? 5),

        // Made-to-order customization schema (e.g. Letter Clicker builder)
        customizationOptions: productData.customizationOptions || productData.customization_schema || null,

        // Linked Studio Hub costs & BOM components
        linkedFilamentId: productData.linkedFilamentId || null,
        linkedConsumableIds: Array.isArray(productData.linkedConsumableIds) ? productData.linkedConsumableIds : [],
        unitProductionCost: Number(productData.unitProductionCost ?? productData.unit_production_cost ?? 0),
        targetMarginPercent: Number(productData.targetMarginPercent ?? 0),

        internalNotes: productData.internalNotes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Save private master catalog document
    const batch = writeBatch(db);
    batch.set(shopProductDoc(shopId, productId), privateProduct);

    // Save public projection if published and active
    if (privateProduct.isPublished && privateProduct.status === "active") {
        const publicProduct = sanitizeForFirestore(sanitizePublicProduct(privateProduct));
        batch.set(publicProductDoc(productId), publicProduct);
    }

    await batch.commit();
    return { id: productId, ...privateProduct };
}

/**
 * Updates an existing product and syncs public projection.
 */
export async function updateProduct(userId, productId, productData) {
    if (!userId || !productId) throw new Error("User ID and Product ID are required.");
    const shopId = getShopId(userId);

    const existingSnap = await getDoc(shopProductDoc(shopId, productId));
    if (!existingSnap.exists()) throw new Error(`Product "${productId}" not found.`);
    const existing = existingSnap.data();

    const updatedPrivate = sanitizeForFirestore({
        ...existing,
        ...productData,
        productId,
        shopId,
        ownerUid: userId,
        updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);
    batch.set(shopProductDoc(shopId, productId), updatedPrivate);

    // Sync public projection
    if (updatedPrivate.isPublished && updatedPrivate.status === "active") {
        const publicProduct = sanitizeForFirestore(sanitizePublicProduct(updatedPrivate));
        batch.set(publicProductDoc(productId), publicProduct);
    } else {
        batch.set(publicProductDoc(productId), sanitizeForFirestore({...sanitizePublicProduct(updatedPrivate), inStock:false, isPublished:false}));
    }

    await batch.commit();
    return { id: productId, ...updatedPrivate };
}

/**
 * Soft-archives a product so historical orders are preserved.
 */
export async function archiveProduct(userId, productId) {
    return updateProduct(userId, productId, {
        status: "archived",
        isPublished: false,
    });
}

/**
 * Duplicates a product as a draft copy.
 */
export async function duplicateProduct(userId, productId) {
    const existing = await getSellerProduct(userId, productId);
    if (!existing) throw new Error("Original product not found.");

    const duplicatedData = {
        ...existing,
        name: `${existing.name} (Copy)`,
        sku: `${existing.sku || "SKU"}-COPY-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
        isPublished: false,
        status: "draft",
    };
    delete duplicatedData.id;
    delete duplicatedData.productId;

    return createProduct(userId, duplicatedData);
}

// ─── Milestone 3: Variant Inventory (Letter Caps & Components) ────────────────

/**
 * Retrieves all inventory component records for a seller's shop.
 */
export async function getShopInventory(userId) {
    if (!userId) return [];
    const shopId = getShopId(userId);
    const snap = await getDocs(shopInventoryCol(shopId));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Adjusts inventory stock balance for a specific item transactionally.
 * Strictly prevents negative balances.
 */
export async function adjustInventoryStock(userId, adjustment = {}) {
    const { adjustTrustedStock } = await import('./orderSubmissionService.js');
    return adjustTrustedStock(userId, adjustment);
}

/**
 * Retrieves recent inventory movement audit logs.
 */
export async function getShopInventoryMovements(userId, limitCount = 50) {
    if (!userId) return [];
    const shopId = getShopId(userId);
    try {
        const q = query(
            shopInventoryMovementsCol(shopId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        const snap = await getDocs(shopInventoryMovementsCol(shopId));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
}

// ─── Milestone 3: Event Catalog Integration & Stock Allocation ────────────────

/**
 * Retrieves event-specific product catalog configuration.
 */
export async function getEventProducts(userId, eventId) {
    if (!userId || !eventId) return {};
    const shopId = getShopId(userId);
    try {
        const snap = await getDoc(shopEventProductCatalogDoc(shopId, eventId));
        if (snap.exists() && snap.data().products) return snap.data().products;
    } catch (error) { if (error.code !== 'not-found') throw error; }

    try {
        const evSnap = await getDoc(shopEventDoc(shopId, eventId));
        if (evSnap.exists() && evSnap.data().catalog) return evSnap.data().catalog;
    } catch (error) { if (error.code !== 'not-found') throw error; }

    try {
        const nestedSnap = await getDoc(doc(db, "shops", shopId, "events", eventId, "catalog", "settings"));
        if (nestedSnap.exists() && nestedSnap.data().products) return nestedSnap.data().products;
    } catch (error) { if (error.code !== 'not-found') throw error; }

    return {};
}

/**
 * Updates event-specific product configuration (pricing overrides, enabled state, max limits).
 */
export async function updateEventProductCatalog(userId, eventId, eventProductsMap) {
    if (!userId || !eventId) throw new Error("User ID and Event ID are required.");
    const shopId = getShopId(userId);
    const docRef = shopEventProductCatalogDoc(shopId, eventId);
    await runTransaction(db, async tx => {
        const eventRef = shopEventDoc(shopId, eventId);
        const snapshot = await tx.get(eventRef);
        if (!snapshot.exists() || snapshot.data().ownerUid !== userId) throw new Error('Event ownership could not be verified.');
        const existingStock = snapshot.data().catalog?._stock;
        const mergedCatalog = {
            ...eventProductsMap,
            ...(existingStock ? { _stock: existingStock } : {}),
        };
        const event = { ...snapshot.data(), catalog: mergedCatalog };
        tx.set(docRef, { eventId, shopId, ownerUid: userId, products: mergedCatalog, updatedAt: serverTimestamp() });
        tx.update(eventRef, { catalog: mergedCatalog, updatedAt: serverTimestamp() });
        tx.set(publicEventDoc(eventId), sanitizeForFirestore(sanitizePublicEvent(event)));
    });

    return eventProductsMap;
}

/**
 * Allocates booth stock for an event.
 */
export async function allocateEventStock(userId, eventId, allocations) {
    const { allocateTrustedEventStock } = await import('./orderSubmissionService.js');
    return allocateTrustedEventStock(userId, eventId, allocations);
}

/**
 * Retrieves current stock allocations for an event.
 */
export async function getEventStockState(userId, eventId) {
    if (!userId || !eventId) return {};
    const shopId = getShopId(userId);
    const snap = await getDoc(shopEventAllocationDoc(shopId, eventId));
    if (!snap.exists()) return {};
    return snap.data();
}

// Backward-compatible totals-only reader. New availability views need all ledgers.
export async function getEventStockAllocations(userId,eventId) { return (await getEventStockState(userId,eventId)).allocations || {}; }
