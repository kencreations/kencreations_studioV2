import { doc, runTransaction, serverTimestamp, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_FREE_TRIAL_EXPORT_LIMIT } from '../utils/freeTrialPolicy';
import { consumeFreeTrialInStore } from '../engine/licensing/freeTrialAccounting';

export const FreeTrialService = {
    /**
     * Subscribes to real-time updates for an account's free trial quota.
     * When the document does not exist yet, emits the default initial quota (0 used, 5 remaining).
     */
    subscribeQuota(uid, onUpdate, onError) {
        if (!uid || typeof uid !== 'string') {
            onUpdate?.({
                limit: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                used: 0,
                remaining: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                operations: {},
                status: 'ready',
            });
            return () => {};
        }

        const quotaRef = doc(db, 'users', uid, 'quota', 'export_trial');
        return onSnapshot(
            quotaRef,
            { includeMetadataChanges: true },
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const limit = typeof data.limit === 'number' ? data.limit : DEFAULT_FREE_TRIAL_EXPORT_LIMIT;
                    const used = typeof data.used === 'number' ? data.used : 0;
                    const remaining = Math.max(0, limit - used);
                    onUpdate?.({
                        ownerUid: uid,
                        limit,
                        used,
                        remaining,
                        operations: data.operations || {},
                        status: 'ready',
                        fromCache: snap.metadata.fromCache,
                    });
                } else {
                    onUpdate?.({
                        ownerUid: uid,
                        limit: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                        used: 0,
                        remaining: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                        operations: {},
                        status: 'ready',
                        fromCache: false,
                    });
                }
            },
            (err) => {
                console.warn('[FreeTrialService] Quota subscription error:', err);
                onError?.(err);
            }
        );
    },

    /**
     * Reads authoritative server-side quota balance for the given user.
     */
    async getQuota(uid) {
        if (!uid || typeof uid !== 'string') return null;
        try {
            const quotaRef = doc(db, 'users', uid, 'quota', 'export_trial');
            const snap = await getDocFromServer(quotaRef);
            if (snap.exists()) {
                const data = snap.data();
                const limit = typeof data.limit === 'number' ? data.limit : DEFAULT_FREE_TRIAL_EXPORT_LIMIT;
                const used = typeof data.used === 'number' ? data.used : 0;
                return {
                    ownerUid: uid,
                    limit,
                    used,
                    remaining: Math.max(0, limit - used),
                    operations: data.operations || {},
                };
            }
            return {
                ownerUid: uid,
                limit: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                used: 0,
                remaining: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                operations: {},
            };
        } catch (err) {
            console.warn('[FreeTrialService] Error reading quota from server:', err);
            return null;
        }
    },

    /**
     * Atomically consumes one free trial export credit for a Basic generator.
     * Enforces concurrency safety, positive balance, and idempotent safe retries.
     */
    async consumeCredit(uid, { generatorId, format = 'stl', operationId, limit = DEFAULT_FREE_TRIAL_EXPORT_LIMIT } = {}) {
        const store = {
            serverTimestamp,
            transaction: (callback) =>
                runTransaction(db, async (tx) => {
                    const quotaDocRef = doc(db, 'users', uid, 'quota', 'export_trial');
                    return callback({
                        get: async () => {
                            const snap = await tx.get(quotaDocRef);
                            return snap.exists() ? snap.data() : null;
                        },
                        set: async (path, data) => tx.set(quotaDocRef, data),
                        update: async (path, data) => tx.update(quotaDocRef, data),
                    });
                }),
        };

        return await consumeFreeTrialInStore(store, uid, {
            generatorId,
            format,
            operationId,
            limit,
        });
    },
};
