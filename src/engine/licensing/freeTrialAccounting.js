import { DEFAULT_FREE_TRIAL_EXPORT_LIMIT } from "../../utils/freeTrialPolicy.js";

/**
 * Pure transactional free trial quota consumer.
 * Works with any store interface providing:
 *   { get(path), set(path, data), update(path, data), serverTimestamp() }
 *
 * Guarantees:
 *  - Atomic concurrency safety
 *  - Fixed lifetime limit (default 5, configurable)
 *  - Negative credit prevention
 *  - Idempotent safe retries using operationId
 *  - Auditable operations log
 */
export async function consumeFreeTrialInStore(
    store,
    uid,
    { generatorId, format = "stl", operationId, limit = DEFAULT_FREE_TRIAL_EXPORT_LIMIT } = {}
) {
    if (!uid || typeof uid !== "string") {
        throw new Error("A valid user UID is required for free trial quota.");
    }
    const quotaPath = `users/${uid}/quota/export_trial`;

    return await store.transaction(async (tx) => {
        const existing = await tx.get(quotaPath);

        const currentLimit = typeof existing?.limit === "number" ? existing.limit : limit;
        const currentUsed = typeof existing?.used === "number" ? existing.used : 0;
        const currentOperations = existing?.operations || {};

        // Safe retry check:
        // If this operationId has already been recorded, do NOT consume another credit.
        if (operationId && currentOperations[operationId]) {
            return {
                success: true,
                idempotentRetry: true,
                limit: currentLimit,
                used: currentUsed,
                remaining: Math.max(0, currentLimit - currentUsed),
                operation: currentOperations[operationId],
            };
        }

        // Quota boundary check:
        if (currentUsed >= currentLimit) {
            const error = new Error("FREE_TRIAL_EXHAUSTED");
            error.code = "FREE_TRIAL_EXHAUSTED";
            error.limit = currentLimit;
            error.used = currentUsed;
            error.remaining = 0;
            throw error;
        }

        const nextUsed = currentUsed + 1;
        const nextRemaining = Math.max(0, currentLimit - nextUsed);
        const opEntry = {
            generatorId: generatorId || "unknown",
            format: String(format).toLowerCase(),
            recordedAt: new Date().toISOString(),
        };
        const nextOperations = {
            ...currentOperations,
            ...(operationId ? { [operationId]: opEntry } : {}),
        };

        const now = store.serverTimestamp ? store.serverTimestamp() : new Date().toISOString();

        if (!existing) {
            await tx.set(quotaPath, {
                ownerUid: uid,
                limit: currentLimit,
                used: nextUsed,
                remaining: nextRemaining,
                operations: nextOperations,
                createdAt: now,
                updatedAt: now,
            });
        } else {
            await tx.update(quotaPath, {
                used: nextUsed,
                remaining: nextRemaining,
                operations: nextOperations,
                updatedAt: now,
            });
        }

        return {
            success: true,
            idempotentRetry: false,
            limit: currentLimit,
            used: nextUsed,
            remaining: nextRemaining,
            operation: opEntry,
        };
    });
}
