/**
 * freeTrialPolicy.js — Configurable policies for KenCreations Studio Free Basic Export Trial.
 *
 * Rules:
 *  - 5 free exports per account, lifetime total (configurable via DEFAULT_FREE_TRIAL_EXPORT_LIMIT).
 *  - Basic generators only.
 *  - No Premium, no VIP Exclusive, no unreleased (Coming Soon / Under Maintenance).
 *  - Not time-based; lifetime total.
 *  - Paid users (Basic, Pro, Pro+, VIP) bypass free trial and never see trial counters.
 */

export const DEFAULT_FREE_TRIAL_EXPORT_LIMIT = 5;

/**
 * Determines if an account is eligible for the free basic export trial.
 * Eligible: Authenticated user who does not hold an active qualifying paid license.
 */
export function isFreeTrialEligible(access = {}) {
    if (!access) return false;
    // Paid tiers and active licenses bypass free trial
    const hasPaidLicense = Boolean(
        access.isVip ||
        access.hasActiveLicense ||
        ['basic', 'pro', 'pro_plus', 'vip'].includes(access.tier)
    );
    return !hasPaidLicense;
}

/**
 * Formats the free trial badge text according to specification:
 *  - Full limit (e.g. 5): "Free Trial — 5 Exports"
 *  - Partially used (e.g. 3): "3 Free Exports Remaining"
 *  - Exhausted (0): "Your Free Exports Have Been Used"
 */
export function formatFreeTrialBadgeText(remaining, limit = DEFAULT_FREE_TRIAL_EXPORT_LIMIT) {
    const safeRemaining = typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : 0;
    const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : DEFAULT_FREE_TRIAL_EXPORT_LIMIT;

    if (safeRemaining <= 0) {
        return "Your Free Exports Have Been Used";
    }
    if (safeRemaining >= safeLimit) {
        return `Free Trial — ${safeLimit} Exports`;
    }
    return `${safeRemaining} Free Export${safeRemaining === 1 ? '' : 's'} Remaining`;
}

/**
 * Evaluates whether a specific generator can be exported under the free trial.
 */
export function evaluateFreeTrialExport(generator, trialState = {}) {
    const limit = typeof trialState.limit === 'number' ? trialState.limit : DEFAULT_FREE_TRIAL_EXPORT_LIMIT;
    const used = typeof trialState.used === 'number' ? trialState.used : 0;
    const remaining = Math.max(0, limit - used);

    if (!generator) {
        return { allowed: false, reason: "UNKNOWN_GENERATOR", remaining, limit, used };
    }

    const rawStatus = String(generator.status || "").toLowerCase().trim();
    const isUnreleased = ['coming soon', 'coming_soon', 'under maintenance', 'maintenance', 'under upgrade', 'disabled', 'archived', 'hidden'].includes(rawStatus);

    if (isUnreleased && !trialState.developerPreview) {
        return { allowed: false, reason: "UNAVAILABLE", remaining, limit, used };
    }

    const category = String(generator.category || "").toLowerCase().trim();
    if (category === "exclusive" || generator.isExclusive === true) {
        return { allowed: false, reason: "EXCLUSIVE_PURCHASE_REQUIRED", remaining, limit, used };
    }
    if (category === "premium") {
        return { allowed: false, reason: "PRO_REQUIRED", remaining, limit, used };
    }

    if (remaining <= 0) {
        return { allowed: false, reason: "FREE_TRIAL_EXHAUSTED", remaining, limit, used };
    }

    return { allowed: true, reason: "FREE_TRIAL", remaining, limit, used };
}
