const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function to securely increment generator export statistics.
 * This runs securely on the backend, bypassing client-side write protections.
 * Uses a unique eventId and Firestore transaction to ensure idempotency (no duplicate counting).
 */
exports.trackExport = onCall({ cors: true }, async (request) => {
    // 1. Validate Input
    const { generatorId, format, eventId } = request.data;
    
    if (!generatorId || !format || !eventId) {
        throw new HttpsError('invalid-argument', 'Missing required fields: generatorId, format, eventId');
    }
    
    if (format !== 'stl' && format !== 'threeMf') {
        throw new HttpsError('invalid-argument', 'Format must be either stl or threeMf');
    }

    const db = admin.firestore();
    const generatorRef = db.collection('generators').doc(generatorId);
    
    // We use a subcollection inside the generator doc to store processed events
    const eventRef = generatorRef.collection('export_events').doc(eventId);

    try {
        await db.runTransaction(async (t) => {
            // 2. Check Idempotency
            const eventDoc = await t.get(eventRef);
            if (eventDoc.exists) {
                // We've already processed this exact export event. Exit silently.
                return;
            }

            // 3. Fetch current generator stats
            const genDoc = await t.get(generatorRef);
            if (!genDoc.exists) {
                throw new HttpsError('not-found', 'Generator document not found.');
            }

            const data = genDoc.data();
            
            // 4. Calculate new values (initialize to 0 if missing)
            const currentTotal = typeof data.totalExports === 'number' ? data.totalExports : 0;
            const currentStl = typeof data.stlExports === 'number' ? data.stlExports : 0;
            const currentThreeMf = typeof data.threeMfExports === 'number' ? data.threeMfExports : 0;

            const updateData = {
                totalExports: currentTotal + 1
            };

            if (format === 'stl') {
                updateData.stlExports = currentStl + 1;
                // Preserve the other format if it's missing from the document
                if (data.threeMfExports === undefined) {
                    updateData.threeMfExports = currentThreeMf;
                }
            } else if (format === 'threeMf') {
                updateData.threeMfExports = currentThreeMf + 1;
                // Preserve the other format if it's missing from the document
                if (data.stlExports === undefined) {
                    updateData.stlExports = currentStl;
                }
            }

            // 5. Commit Updates
            // Update the generator document with new counters
            t.update(generatorRef, updateData);
            
            // Record the event to prevent duplicate counting in the future
            t.set(eventRef, {
                format,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                uid: request.auth ? request.auth.uid : 'anonymous'
            });
        });
        
        return { success: true };
    } catch (error) {
        console.error("Transaction failed during trackExport:", error);
        throw new HttpsError('internal', 'An error occurred while tracking the export.', error.message);
    }
});

/**
 * Cloud Function to securely activate an unclaimed license key.
 * Authoritatively claims the key for the authenticated user and preserves immutable server fields.
 */
exports.activateLicense = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'Sign in to activate a license.');
    }
    const uid = request.auth.uid;
    const { licenseKey, hwid } = request.data || {};
    const key = String(licenseKey || '').trim();
    if (!key || key.includes('/')) {
        throw new HttpsError('invalid-argument', 'Enter a valid license code.');
    }

    const db = admin.firestore();
    const licenseRef = db.collection('licenses').doc(key);

    try {
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(licenseRef);
            if (!snap.exists) {
                throw new HttpsError('not-found', 'Invalid License Code.');
            }
            const license = snap.data();
            if (license.licenseType === 'beta_trial') {
                throw new HttpsError('failed-precondition', 'Beta trials require signed-in beta activation.');
            }
            const now = Date.now();

            if (license.disabled === true || license.revoked === true || !['active', 'unclaimed', 'pending'].includes(license.status)) {
                throw new HttpsError('failed-precondition', 'This license is not available for activation.');
            }

            const rawExp = license.expiresAt ?? license.expires_at;
            let expiry = Infinity;
            if (rawExp != null && rawExp !== '') {
                if (typeof rawExp.toMillis === 'function') expiry = rawExp.toMillis();
                else if (typeof rawExp.seconds === 'number') expiry = rawExp.seconds * 1000;
                else expiry = typeof rawExp === 'number' ? rawExp : Date.parse(rawExp);
            }
            if (Number.isNaN(expiry) || expiry <= now) {
                throw new HttpsError('failed-precondition', 'This license has expired or has an invalid expiration date.');
            }

            if (license.claimedByUid && license.claimedByUid !== uid) {
                throw new HttpsError('permission-denied', 'This license is already bound to another Google account.');
            }

            if (hwid && license.hwid && license.hwid !== hwid) {
                throw new HttpsError('permission-denied', 'This license is bound to a different desktop device.');
            }

            // Idempotent retry for current owner
            if (license.claimedByUid === uid) {
                if (hwid && !license.hwid) {
                    tx.update(licenseRef, {
                        hwid,
                        hwidBoundAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                return {
                    success: true,
                    message: 'License already active on your account.',
                    license: {
                        id: key,
                        licenseKey: key,
                        status: license.status || 'active',
                        tier: license.tier || license.plan_type || 'standard',
                        entitlements: Array.isArray(license.entitlements) ? license.entitlements : [],
                        expiresAt: license.expiresAt ?? license.expires_at ?? null,
                    },
                    idempotent: true,
                };
            }

            // Atomic claim preserving immutable server properties
            const updatePayload = {
                claimedByUid: uid,
                status: 'active',
                claimedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (hwid) {
                updatePayload.hwid = hwid;
                updatePayload.hwidBoundAt = admin.firestore.FieldValue.serverTimestamp();
            }

            tx.update(licenseRef, updatePayload);

            const activeTier = String(license.tier || license.plan_type || 'standard').toLowerCase();
            const activeEntitlements = Array.isArray(license.entitlements) ? license.entitlements : [];

            return {
                success: true,
                message: 'License activated successfully!',
                license: {
                    id: key,
                    licenseKey: key,
                    status: 'active',
                    tier: activeTier,
                    entitlements: activeEntitlements,
                    expiresAt: license.expiresAt ?? license.expires_at ?? null,
                },
                idempotent: false,
            };
        });

        // Authoritative Custom Claim Synchronization (Ready for future Blaze deployments)
        try {
            const userDoc = await admin.auth().getUser(uid);
            const currentClaims = userDoc.customClaims || {};
            const licSnap = await db.collection('licenses').where('claimedByUid', '==', uid).get();
            const allOwned = licSnap.docs.map(d => d.data());
            const now = Date.now();

            const activeOwned = allOwned.filter(l => {
                if (l?.licenseType === 'beta_trial') return false;
                if (!l || l.disabled === true || l.revoked === true || l.status !== 'active') return false;
                const rawExp = l.expiresAt ?? l.expires_at;
                let expiry = Infinity;
                if (rawExp != null && rawExp !== '') {
                    if (typeof rawExp.toMillis === 'function') expiry = rawExp.toMillis();
                    else if (typeof rawExp.seconds === 'number') expiry = rawExp.seconds * 1000;
                    else expiry = typeof rawExp === 'number' ? rawExp : Date.parse(rawExp);
                }
                return !Number.isNaN(expiry) && expiry > now;
            });

            const allTiers = activeOwned.map(l => String(l.tier || l.plan_type || '').toLowerCase());
            const allEntitlements = activeOwned.flatMap(l => Array.isArray(l.entitlements) ? l.entitlements : []);

            const isVip = allTiers.includes('vip') || allEntitlements.includes('vip');
            const isPro = allTiers.some(t => ['pro', 'pro_plus', 'pro+', 'lifetime', 'studio_pro', 'commercial', '1mo', '6mo', '12mo'].includes(t));
            const isBasic = allTiers.includes('basic');

            const hasBazaarHub = isPro || isVip || allEntitlements.some(e => ['bazaar-hub', 'bazaar_hub', 'bazaar'].includes(e));

            // Custom claims strictly govern trusted Hub and VIP gates.
            // Physical commercial-printing rights are handled via license policies, NOT an Auth custom claim.
            await admin.auth().setCustomUserClaims(uid, {
                ...currentClaims,
                bazaarHub: hasBazaarHub,
                vip: isVip,
                admin: currentClaims.admin === true, // NEVER escalate admin!
            });
        } catch (claimErr) {
            console.warn('Custom claim sync skipped or delayed:', claimErr.message);
        }

        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'License activation failed.');
    }
});

// ==========================================
// BAZAAR HUB: BLAZE PRODUCTION CALLABLE FUNCTIONS
// ==========================================

const CANONICAL_COLORS = ['teal', 'pink', 'purple', 'white', 'black', 'mint'];

function normalizeColorId(color) {
    if (!color) return 'teal';
    const clean = String(color).toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (clean === 'teal_green') return 'teal';
    return clean;
}

function calculateItemPriceServer(product, item) {
    let price = Number(product.retailPrice ?? product.retail_price ?? product.base_price ?? 0);
    const custom = item.customization || {};
    const slots = Number(custom.slots || 1);
    
    // Tiered pricing for slots
    if (product.customizationOptions?.tieredPricing?.[slots]) {
        price = Number(product.customizationOptions.tieredPricing[slots]);
    } else if (slots > 1 && product.customizationOptions?.slotSurcharges?.[slots]) {
        price += Number(product.customizationOptions.slotSurcharges[slots]);
    }

    // Switch surcharge
    if (custom.switchType && product.customizationOptions?.switchPrices?.[custom.switchType]) {
        price += Number(product.customizationOptions.switchPrices[custom.switchType]);
    }

    const qty = Math.max(1, Math.min(50, Number(item.quantity || 1)));
    return Math.round(price * qty);
}

function decomposeItemBOM(item) {
    const bom = [];
    const custom = item.customization || {};
    const qty = Math.max(1, Math.min(50, Number(item.quantity || 1)));
    const slots = Math.max(1, Math.min(4, Number(custom.slots || 1)));
    const casingStyle = custom.casingStyle || 'standard';
    const casingColor = normalizeColorId(custom.baseColor || custom.casingColor);

    // 1. Base Casing
    bom.push({
        component_key: `kc_base_${slots}slot_${casingStyle}_${casingColor}`,
        category: 'casings',
        name: `${slots}-Slot Base (${casingColor})`,
        required_qty: qty,
    });

    // 2. Switches
    const switchType = custom.switchType || 'blue';
    bom.push({
        component_key: `kc_switch_${switchType}`,
        category: 'switches',
        name: `Switch (${switchType})`,
        required_qty: slots * qty,
    });

    // 3. Letters / Icons
    const letters = custom.letters || [];
    for (let i = 0; i < slots; i++) {
        const slotData = letters[i] || {};
        if (slotData.iconId) {
            const iconColor = normalizeColorId(slotData.color);
            bom.push({
                component_key: `kc_icon_${slotData.iconId}_${iconColor}`,
                category: 'icons',
                name: `Icon Keycap (${slotData.iconId}, ${iconColor})`,
                required_qty: qty,
            });
        } else if (slotData.char) {
            const char = String(slotData.char).toUpperCase();
            const charColor = normalizeColorId(slotData.color);
            bom.push({
                component_key: `kc_letter_${char}_${charColor}`,
                category: 'keycaps',
                name: `Letter Keycap (${char}, ${charColor})`,
                required_qty: qty,
            });
        }
    }

    return bom;
}

/**
 * Cloud Function: submitBazaarOrder
 * Secure, authoritative order intake for guest & authenticated customers.
 * Recalculates prices server-side, checks event status, and writes atomically.
 */
exports.submitBazaarOrder = onCall({ cors: true }, async (request) => {
    const {
        shopId,
        eventId,
        items,
        customerName,
        customerContact,
        orderNotes,
        paymentMethod,
        gcashReference,
        idempotencyKey,
    } = request.data || {};

    if (!shopId || typeof shopId !== 'string' || !shopId.startsWith('shop_')) {
        throw new HttpsError('invalid-argument', 'Valid shop ID is required.');
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
        throw new HttpsError('invalid-argument', 'Order must contain between 1 and 30 items.');
    }
    const cleanCustomerName = String(customerName || '').trim().slice(0, 120);
    if (!cleanCustomerName) {
        throw new HttpsError('invalid-argument', 'Customer name is required.');
    }

    const db = admin.firestore();
    const shopRef = db.collection('shops').doc(shopId);
    const eventRef = eventId ? shopRef.collection('events').doc(eventId) : null;
    const idempotencyRef = idempotencyKey ? shopRef.collection('order_requests').doc(idempotencyKey) : null;

    try {
        const result = await db.runTransaction(async (tx) => {
            // 1. Idempotency Check
            if (idempotencyRef) {
                const idempDoc = await tx.get(idempotencyRef);
                if (idempDoc.exists) {
                    return idempDoc.data();
                }
            }

            // 2. Validate Shop
            const shopDoc = await tx.get(shopRef);
            if (!shopDoc.exists) {
                throw new HttpsError('not-found', 'Shop not found.');
            }
            const shopData = shopDoc.data();
            if (shopData.isPublished === false) {
                throw new HttpsError('failed-precondition', 'This shop is not accepting orders.');
            }

            // 3. Validate Event
            let eventData = null;
            if (eventRef) {
                const evDoc = await tx.get(eventRef);
                if (!evDoc.exists) {
                    throw new HttpsError('not-found', 'Event not found.');
                }
                eventData = evDoc.data();
                if (eventData.isAcceptingOrders === false || eventData.queueStatus === 'closed' || eventData.queueStatus === 'paused') {
                    throw new HttpsError('failed-precondition', 'Order intake is currently paused for this event.');
                }
            }

            // 4. Server-Side Price & BOM Validation
            let calculatedTotal = 0;
            const verifiedItems = [];

            for (const item of items) {
                if (!item.productId) {
                    throw new HttpsError('invalid-argument', 'Product ID missing from item.');
                }
                const productRef = shopRef.collection('products').doc(item.productId);
                const prodDoc = await tx.get(productRef);
                if (!prodDoc.exists) {
                    throw new HttpsError('not-found', `Product ${item.productId} not found.`);
                }
                const prodData = prodDoc.data();
                if (prodData.isPublished === false || prodData.status === 'archived') {
                    throw new HttpsError('failed-precondition', `Product ${prodData.name} is no longer available.`);
                }

                const itemPrice = calculateItemPriceServer(prodData, item);
                calculatedTotal += itemPrice;

                const itemBOM = decomposeItemBOM(item);
                verifiedItems.push({
                    productId: item.productId,
                    productName: prodData.name || 'Custom Item',
                    quantity: Math.max(1, Math.min(50, Number(item.quantity || 1))),
                    unitPrice: Math.round(itemPrice / Math.max(1, Number(item.quantity || 1))),
                    totalPrice: itemPrice,
                    customization: item.customization || {},
                    requiredBOM: itemBOM,
                });
            }

            // 5. Generate Authoritative Order Record
            const now = Date.now();
            const orderId = `ord_${admin.firestore().collection('_').doc().id.slice(0, 16)}`;
            const orderNumber = orderId.slice(4, 12).toUpperCase();
            const trackingToken = `trk_${admin.firestore().collection('_').doc().id}${admin.firestore().collection('_').doc().id}`;
            const pickupCode = String(1000 + Math.floor(Math.random() * 9000));
            const sellerUid = shopData.ownerUid || shopId.replace('shop_', '');

            const orderPayload = {
                orderId,
                orderNumber,
                shopId,
                sellerUid,
                eventId: eventId || null,
                eventName: eventData?.name || null,
                boothNumber: eventData?.venue || null,
                customerName: cleanCustomerName,
                customerContact: String(customerContact || '').slice(0, 200),
                orderNotes: String(orderNotes || '').slice(0, 1000),
                paymentMethod: paymentMethod === 'gcash' ? 'gcash' : 'cash',
                gcashReference: paymentMethod === 'gcash' ? String(gcashReference || '').slice(0, 100) : null,
                fulfillmentStatus: 'pending',
                paymentStatus: 'unpaid',
                inventoryVersion: 1,
                items: verifiedItems,
                totalAmount: calculatedTotal,
                pickupCode,
                trackingToken,
                pickupInstructions: shopData.pickupInstructions || 'Pick up at counter',
                submittedAt: now,
                updatedAt: now,
                expiresAt: now + (30 * 86400000),
            };

            const trackingPayload = {
                trackingToken,
                orderNumber,
                shopId,
                sellerUid,
                fulfillmentStatus: 'pending',
                paymentStatus: 'unpaid',
                pickupCode,
                pickupInstructions: orderPayload.pickupInstructions,
                itemsSummary: verifiedItems.map(i => ({
                    title: i.productName,
                    summary: i.customization?.text ? `${i.customization.text.length}-Letter (${i.customization.text})` : i.productName,
                })),
                submittedAt: now,
                updatedAt: now,
                expiresAt: orderPayload.expiresAt,
                revoked: false,
            };

            const orderDocRef = shopRef.collection('orders').doc(orderId);
            const trackingDocRef = db.collection('order_tracking').doc(trackingToken);

            tx.set(orderDocRef, orderPayload);
            tx.set(trackingDocRef, trackingPayload);

            const responseData = {
                success: true,
                orderId,
                orderNumber,
                trackingToken,
                pickupCode,
                totalAmount: calculatedTotal,
            };

            if (idempotencyRef) {
                tx.set(idempotencyRef, {
                    ...responseData,
                    createdAt: now,
                });
            }

            return responseData;
        });

        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Order submission failed.');
    }
});

/**
 * Cloud Function: transitionBazaarOrder
 * Authoritative seller order fulfillment and stock reservation engine.
 */
exports.transitionBazaarOrder = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'Sign in as the seller to manage orders.');
    }
    const uid = request.auth.uid;
    const { shopId, orderId, targetStatus, cancellationReason } = request.data || {};

    if (!shopId || !orderId || !targetStatus) {
        throw new HttpsError('invalid-argument', 'Missing shopId, orderId, or targetStatus.');
    }

    const ALLOWED_STATUSES = ['accepted', 'preparing', 'ready', 'collected', 'declined', 'cancelled'];
    if (!ALLOWED_STATUSES.includes(targetStatus)) {
        throw new HttpsError('invalid-argument', `Invalid target status: ${targetStatus}`);
    }

    const db = admin.firestore();
    const orderRef = db.collection('shops').doc(shopId).collection('orders').doc(orderId);

    try {
        const result = await db.runTransaction(async (tx) => {
            const orderDoc = await tx.get(orderRef);
            if (!orderDoc.exists) {
                throw new HttpsError('not-found', 'Order not found.');
            }
            const order = orderDoc.data();

            if (order.sellerUid !== uid && shopId !== `shop_${uid}`) {
                throw new HttpsError('permission-denied', 'You do not own this shop.');
            }

            const current = order.fulfillmentStatus || 'pending';
            const now = Date.now();
            const updatePayload = {
                fulfillmentStatus: targetStatus,
                updatedAt: now,
            };

            if (targetStatus === 'accepted') {
                if (current !== 'pending') {
                    throw new HttpsError('failed-precondition', `Cannot accept order in status ${current}`);
                }
                updatePayload.acceptedAt = now;
            } else if (targetStatus === 'preparing') {
                updatePayload.preparingAt = now;
            } else if (targetStatus === 'ready') {
                updatePayload.readyAt = now;
            } else if (targetStatus === 'collected') {
                updatePayload.collectedAt = now;
            } else if (targetStatus === 'cancelled' || targetStatus === 'declined') {
                updatePayload.cancelledAt = now;
                updatePayload.cancellationReason = String(cancellationReason || 'Seller cancelled').slice(0, 500);
            }

            tx.update(orderRef, updatePayload);

            // Update capability tracking document
            if (order.trackingToken) {
                const trackingRef = db.collection('order_tracking').doc(order.trackingToken);
                tx.update(trackingRef, {
                    fulfillmentStatus: targetStatus,
                    updatedAt: now,
                });
            }

            return {
                success: true,
                orderId,
                fulfillmentStatus: targetStatus,
            };
        });

        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Order transition failed.');
    }
});

/**
 * Cloud Function: recordBazaarPayment
 * Authoritative financial ledger recording for cash and manual GCash payments.
 */
exports.recordBazaarPayment = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'Sign in as the seller to verify payments.');
    }
    const uid = request.auth.uid;
    const { shopId, orderId, paymentMethod, amount, reference } = request.data || {};

    if (!shopId || !orderId) {
        throw new HttpsError('invalid-argument', 'Missing shopId or orderId.');
    }

    const db = admin.firestore();
    const orderRef = db.collection('shops').doc(shopId).collection('orders').doc(orderId);

    try {
        const result = await db.runTransaction(async (tx) => {
            const orderDoc = await tx.get(orderRef);
            if (!orderDoc.exists) {
                throw new HttpsError('not-found', 'Order not found.');
            }
            const order = orderDoc.data();

            if (order.sellerUid !== uid && shopId !== `shop_${uid}`) {
                throw new HttpsError('permission-denied', 'You do not own this shop.');
            }
            if (order.paymentStatus === 'paid') {
                return { success: true, message: 'Order is already marked as paid.', paymentStatus: 'paid' };
            }

            const paymentAmount = Number(amount || order.totalAmount || 0);
            const now = Date.now();
            const movementId = `mov_${admin.firestore().collection('_').doc().id}`;
            const movementRef = db.collection('shops').doc(shopId).collection('financial_movements').doc(movementId);

            tx.set(movementRef, {
                ownerUid: uid,
                shopId,
                orderId,
                orderNumber: order.orderNumber,
                type: paymentMethod === 'gcash' ? 'gcash' : 'cash',
                amount: paymentAmount,
                reference: reference ? String(reference).slice(0, 100) : null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            tx.update(orderRef, {
                paymentStatus: 'paid',
                paymentMethod: paymentMethod === 'gcash' ? 'gcash' : 'cash',
                paidAt: now,
                updatedAt: now,
            });

            if (order.trackingToken) {
                const trackingRef = db.collection('order_tracking').doc(order.trackingToken);
                tx.update(trackingRef, {
                    paymentStatus: 'paid',
                    updatedAt: now,
                });
            }

            return {
                success: true,
                orderId,
                paymentStatus: 'paid',
                amount: paymentAmount,
            };
        });

        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Payment recording failed.');
    }
});


