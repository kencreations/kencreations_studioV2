// Authorization uses verified license records, never editable profile tiers/badges.
export function expiryMillis(value) {
    if (value == null || value === '') return Infinity;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return typeof value === 'number' ? value : Date.parse(value);
}

export function isActiveLicense(license, { uid, hwid, now = Date.now(), desktop = false } = {}) {
    if (!license || license.disabled === true || license.revoked === true) return false;
    const isStatusActive = desktop
        ? (license.activated === true || license.status === 'active')
        : (license.status === 'active' || license.activated === true);
    if (!isStatusActive) return false;
    if (!desktop && (!uid || license.claimedByUid !== uid)) return false;
    if (desktop && license.hwid && license.hwid !== hwid) return false;
    const expiry = expiryMillis(license.expiresAt ?? license.expires_at);
    return !Number.isNaN(expiry) && expiry > now;
}

export function summarizeLicenses(licenses, options) {
    const active = licenses.filter(license => isActiveLicense(license, options));
    const entitlements = [...new Set(active.flatMap(l => Array.isArray(l.entitlements) ? l.entitlements.filter(e => typeof e === 'string') : []))];
    // User-confirmed policy: VIP is all-access. Duration alone is not a grant.
    const isVip = entitlements.includes('vip') || active.some(l => l.plan_type === 'vip' || l.tier === 'vip');
    const now = options?.now || Date.now();
    const hasExpired = licenses.some(l => {
        if (!l || l.disabled === true || l.revoked === true) return false;
        const exp = expiryMillis(l.expiresAt ?? l.expires_at);
        return Number.isFinite(exp) && exp <= now;
    });
    return { active, entitlements, isVip, hasActiveLicense: active.length > 0, hasExpired };
}

export function evaluateGeneratorAccess(generator, access = {}) {
    const result = (state, reason) => ({ state, reason, allowed: state === 'authorized' });
    if (!generator) return result('unauthorized', 'UNKNOWN_GENERATOR');
    if (['maintenance', 'under upgrade', 'coming soon', 'coming_soon', 'disabled', 'archived', 'hidden', 'placeholder'].includes(String(generator.status).toLowerCase())) return result('unauthorized', 'UNAVAILABLE');
    const protectedGenerator = generator.isExclusive === true || generator.is_exclusive === true || generator.isFree === false;
    if (!protectedGenerator) return result('authorized', 'FREE_TOOL');
    if (access.status === 'loading') return result('loading', 'VERIFYING_LICENSE');
    if (access.status === 'error') return result('error', 'VERIFICATION_ERROR');
    if (access.isVip) return result('authorized', 'VIP');
    if (access.promoAllAccess && access.hasActiveLicense) return result('authorized', 'PROMO');
    if (access.entitlements?.includes(generator.requiredEntitlement || generator.id)) return result('authorized', 'ENTITLEMENT');
    return result('unauthorized', access.hasActiveLicense ? 'ENTITLEMENT_REQUIRED' : 'LICENSE_REQUIRED');
}

export function evaluateStudioHubAccess(access = {}) {
    const result = (state, reason) => ({ state, reason, allowed: state === 'authorized' });
    if (access.status === 'loading') return result('loading', 'VERIFYING_LICENSE');
    if (access.status === 'error') return result('error', 'VERIFICATION_ERROR');

    // In web mode, authentication is required
    if (!access.desktop && !access.currentUser) {
        return result('unauthenticated', 'AUTH_REQUIRED');
    }

    // VIP is all-access
    if (access.isVip) return result('authorized', 'VIP');

    // Promo all-access with active license
    if (access.promoAllAccess && access.hasActiveLicense) return result('authorized', 'PROMO');

    // Explicit entitlement check
    if (access.entitlements?.includes('studio-hub') || access.entitlements?.includes('studio_hub')) {
        return result('authorized', 'ENTITLEMENT');
    }

    // Active subscription tiers
    const hasActiveSubscription = (access.active || []).some(l => {
        const tier = String(l.tier || l.tier_id || l.plan_type || l.plan || '').toLowerCase();
        return ['1mo', '6mo', '12mo', 'lifetime', 'studio_pro', 'pro', 'subscriber', 'subscription', 'standard', 'commercial', 'maker'].includes(tier);
    });

    if (hasActiveSubscription) return result('authorized', 'SUBSCRIBER');

    // Any active license means the account is on Pro/commercial tier in KenCreations Studio
    if (access.hasActiveLicense || (access.active && access.active.length > 0)) {
        return result('authorized', 'ACTIVE_LICENSE');
    }

    // Expired subscription state
    if (access.hasExpired) return result('expired', 'SUBSCRIPTION_EXPIRED');

    return result('unauthorized', 'SUBSCRIBER_REQUIRED');
}

export function evaluateBazaarAccess(access = {}) {
    const result = (state, reason) => ({ state, reason, allowed: state === 'authorized' });
    if (access.status === 'loading') return result('loading', 'VERIFYING_LICENSE');
    if (access.status === 'error') return result('error', 'VERIFICATION_ERROR');

    // In web mode, authentication is required
    if (!access.desktop && !access.currentUser) {
        return result('unauthenticated', 'AUTH_REQUIRED');
    }

    // VIP is all-access
    if (access.isVip) return result('authorized', 'VIP');

    // Promo all-access with active license
    if (access.promoAllAccess && access.hasActiveLicense) return result('authorized', 'PROMO');

    // Explicit Bazaar Hub entitlement check
    if (access.entitlements?.includes('bazaar') || access.entitlements?.includes('bazaar-hub') || access.entitlements?.includes('bazaar_hub')) {
        return result('authorized', 'ENTITLEMENT');
    }

    // Active subscription tiers
    const hasActiveSubscription = (access.active || []).some(l => {
        const tier = String(l.tier || l.tier_id || l.plan_type || l.plan || '').toLowerCase();
        return ['1mo', '6mo', '12mo', 'lifetime', 'studio_pro', 'pro', 'subscriber', 'subscription', 'standard', 'commercial', 'maker'].includes(tier);
    });

    if (hasActiveSubscription) return result('authorized', 'SUBSCRIBER');

    // Any active license means the account is on Pro/commercial tier in KenCreations Studio
    if (access.hasActiveLicense || (access.active && access.active.length > 0)) {
        return result('authorized', 'ACTIVE_LICENSE');
    }

    // Expired subscription state
    if (access.hasExpired) return result('expired', 'SUBSCRIPTION_EXPIRED');

    return result('unauthorized', 'SUBSCRIBER_REQUIRED');
}

export function validateClaim(license, uid, hwid, now = Date.now()) {
    if (!license) throw new Error('Invalid License Code.');
    if (!['active', 'unclaimed', 'pending'].includes(license.status) || license.disabled === true || license.revoked === true) throw new Error('This license is not available for activation.');
    const expiry = expiryMillis(license.expiresAt ?? license.expires_at);
    if (Number.isNaN(expiry) || expiry <= now) throw new Error('This license has expired or has an invalid expiration date.');
    if (license.claimedByUid && license.claimedByUid !== uid) throw new Error('This license is already bound to another Google account.');
    if (hwid && license.hwid && license.hwid !== hwid) throw new Error('This license is bound to a different desktop device.');
}

