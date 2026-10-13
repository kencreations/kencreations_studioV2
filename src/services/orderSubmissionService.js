// Browser transport only. Authoritative writes belong to a trusted backend.
import { doc, runTransaction, getDocs, collection, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { getShopId, shopOrdersCol, sanitizeForFirestore } from './bazaarService.js';
import { bazaarOperation } from './bazaarDiagnostics.js';
import {
    submitOrder,
    transitionOrder,
    reconcileOrder,
    allocateStock,
    adjustStock,
} from '../engine/bazaar/orderWorkflow.js';
import { decomposeProductBOM } from '../engine/bazaar/bom.js';

export function generateTrackingToken() { return 'trk_' + crypto.randomUUID().replace(/-/g, ''); }
export function generatePickupCode() { const v = new Uint32Array(1); crypto.getRandomValues(v); return String(1000 + v[0] % 9000); }

export function hasRemoteBackend() {
    try {
        const value = import.meta.env?.VITE_BAZAAR_API_URL;
        return Boolean(value && value.trim());
    } catch {
        return false;
    }
}

export function bazaarApiUrl() {
    const value = import.meta.env?.VITE_BAZAAR_API_URL;
    if (!value) throw new Error('Online checkout and fulfillment are not configured. Please contact the seller; no new order has been submitted.');
    const url = new URL(value);
    const local = import.meta.env?.DEV && import.meta.env?.VITE_USE_FIREBASE_EMULATORS === 'true' && ['127.0.0.1','localhost'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('The ordering service requires HTTPS.');
    return url.href.replace(/\/$/, '');
}

export function checkoutAvailability() {
    if (hasRemoteBackend()) {
        return { available: true, message: '' };
    }
    return {
        available: false,
        message: 'Online kiosk checkout requires the cloud order service (available upon Blaze upgrade). Please place your order directly at the booth counter.'
    };
}

async function request(action, payload, seller = false) {
    const base = bazaarApiUrl();
    const token = seller ? await auth.currentUser?.getIdToken() : null;
    if (seller && !token) throw new Error('Sign in as the seller to manage this order.');
    return bazaarOperation(action, action === 'submit' ? 'shops/{shop}/orders + order_tracking/{capability}' : 'shops/{shop}/orders/{order} + inventory + tracking', async () => {
        const response = await fetch(base + '/' + action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.message || 'The ordering service could not complete this operation.'), { code: data.code || 'request-failed' });
        return data;
    });
}

function createFirestoreTxStore(tx) {
    return {
        transaction: async (callback) => {
            const txStore = {
                get: async (path) => {
                    const snap = await tx.get(doc(db, path));
                    return snap.exists() ? snap.data() : null;
                },
                list: async (path, filters = {}) => {
                    let q = collection(db, path);
                    for (const [key, value] of Object.entries(filters)) {
                        if (value !== undefined && value !== null) {
                            q = query(q, where(key, '==', value));
                        }
                    }
                    const snap = await getDocs(q);
                    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                },
                set: (path, data) => tx.set(doc(db, path), sanitizeForFirestore(data)),
            };
            return callback(txStore);
        },
    };
}

export const submitGuestOrder = async (payload) => {
    if (hasRemoteBackend()) {
        return request('submit', payload);
    }

    // Blaze tier integration: Callable Cloud Function
    try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const { app } = await import('../firebase.js');
        const functions = getFunctions(app, 'us-central1');
        const submitCallable = httpsCallable(functions, 'submitBazaarOrder');
        const res = await submitCallable(payload);
        if (res?.data) return res.data;
    } catch (fnErr) {
        const isNotDeployed = fnErr?.code === 'functions/not-found' ||
            fnErr?.code === 'functions/internal' ||
            fnErr?.message?.includes('404') ||
            fnErr?.message?.includes('not found') ||
            fnErr?.message?.includes('internal');

        if (isNotDeployed) {
            throw Object.assign(
                new Error('Online kiosk checkout requires the cloud order service (available upon Blaze upgrade). Please place your order directly at the booth counter.'),
                { code: 'backend-unavailable' }
            );
        }
        throw fnErr;
    }

    throw new Error('Online checkout service is currently unavailable.');
};

const transition = async (uid, orderId, action, extra = {}) => {
    if (auth.currentUser?.uid !== uid) throw new Error('Seller identity changed. Sign in again.');
    if (hasRemoteBackend()) {
        return request('transition', { shopId: getShopId(uid), orderId, action, ...extra }, true);
    }
    const shopId = getShopId(uid);
    return runTransaction(db, async (tx) => {
        const store = createFirestoreTxStore(tx);
        return transitionOrder(store, uid, { shopId, orderId, action, ...extra });
    });
};

export const acceptSellerOrder = (uid, id) => transition(uid, id, 'accept');
export const startOrderProduction = (uid, id) => transition(uid, id, 'prepare');
export const markOrderReady = (uid, id) => transition(uid, id, 'ready');
export const markOrderCollected = (uid, id) => transition(uid, id, 'collect');
export const cancelOrRejectOrder = (uid, id, options) => transition(uid, id, 'cancel', options);

export const allocateTrustedEventStock = async (uid, eventId, allocations) => {
    if (auth.currentUser?.uid !== uid) throw new Error('Seller identity changed. Sign in again.');
    if (hasRemoteBackend()) {
        return request('allocate', { shopId: getShopId(uid), eventId, allocations }, true);
    }
    const shopId = getShopId(uid);
    return runTransaction(db, async (tx) => {
        const store = createFirestoreTxStore(tx);
        return allocateStock(store, uid, { shopId, eventId, allocations });
    });
};

export const adjustTrustedStock = async (uid, adjustment) => {
    if (auth.currentUser?.uid !== uid) throw new Error('Seller identity changed. Sign in again.');
    if (hasRemoteBackend()) {
        return request('adjust', { shopId: getShopId(uid), ...adjustment }, true);
    }
    const shopId = getShopId(uid);
    return runTransaction(db, async (tx) => {
        const store = createFirestoreTxStore(tx);
        return adjustStock(store, uid, { shopId, ...adjustment });
    });
};

export const reconcileSellerOrder = async (uid, orderId, review) => {
    if (auth.currentUser?.uid !== uid) throw new Error('Sign in again.');
    if (hasRemoteBackend()) {
        return request('reconcile', { shopId: getShopId(uid), orderId, ...review }, true);
    }
    const shopId = getShopId(uid);
    return runTransaction(db, async (tx) => {
        const store = createFirestoreTxStore(tx);
        return reconcileOrder(store, uid, { shopId, orderId, ...review });
    });
};

export async function getSellerOrders(userId, eventId = null) {
    if (!userId) return [];
    const shopId = getShopId(userId);
    if (hasRemoteBackend()) {
        try {
            return (await request('orders', { shopId, eventId }, true)).orders;
        } catch (err) {
            console.warn('[getSellerOrders] Remote backend failed, reading from Firestore:', err?.message);
        }
    }
    try {
        let q;
        if (eventId) {
            q = query(
                shopOrdersCol(shopId),
                where("eventId", "==", eventId),
                orderBy("submittedAt", "desc"),
                limit(100)
            );
        } else {
            q = query(
                shopOrdersCol(shopId),
                orderBy("submittedAt", "desc"),
                limit(100)
            );
        }
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        // Fallback without compound index
        const snap = await getDocs(shopOrdersCol(shopId));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (eventId) {
            return list.filter((o) => o.eventId === eventId);
        }
        return list;
    }
}

export async function checkCheckoutService() {
    let hasRemoteBackend = false;
    try {
        bazaarApiUrl();
        hasRemoteBackend = true;
    } catch {
        hasRemoteBackend = false;
    }

    if (hasRemoteBackend) {
        try {
            const response = await fetch(bazaarApiUrl() + '/health', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
            const result = await response.json();
            if (!response.ok || result.ready !== true) throw new Error('Not ready');
            return { available: true, message: '' };
        } catch {
            return { available: false, message: 'Online ordering is temporarily unavailable. Please contact the booth.' };
        }
    }

    return checkoutAvailability();
}
