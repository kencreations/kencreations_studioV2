import { isBetaTrial, activeBetaTrial, betaExpiryMillis } from './betaTrialPolicy.js';
import { DEFAULT_FREE_TRIAL_EXPORT_LIMIT, isFreeTrialEligible } from './freeTrialPolicy.js';

// Authorization uses verified license records, never editable profile tiers/badges.
export function expiryMillis(value) {
    if (value == null || value === "") return Infinity;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return typeof value === "number" ? value : Date.parse(value);
}

export function licenseExpiryMillis(license) {
    return isBetaTrial(license) ? betaExpiryMillis(license) : expiryMillis(license?.expiresAt ?? license?.expires_at);
}

export function isActiveLicense(
    license,
    { uid, hwid, now = Date.now(), desktop = false } = {},
) {
    if (isBetaTrial(license)) return !desktop && activeBetaTrial(license, uid, now);
    if (!license || license.disabled === true || license.revoked === true)
        return false;
    const isStatusActive = desktop
        ? license.activated === true || license.status === "active"
        : license.status === "active" || license.activated === true;
    if (!isStatusActive) return false;
    if (!desktop && (!uid || license.claimedByUid !== uid)) return false;
    if (desktop && license.hwid && license.hwid !== hwid) return false;
    const expiry = expiryMillis(license.expiresAt ?? license.expires_at);
    return !Number.isNaN(expiry) && expiry > now;
}

export function summarizeLicenses(licenses, options) {
    const active = licenses.filter((license) =>
        isActiveLicense(license, options),
    );
    const entitlements = [
        ...new Set(
            active.flatMap((l) =>
                Array.isArray(l.entitlements)
                    ? l.entitlements.filter((e) => typeof e === "string")
                    : [],
            ),
        ),
    ];
    // User-confirmed policy: VIP is all-access. Duration alone is not a grant.
    const isVip =
        entitlements.includes("vip") ||
        active.some((l) => !isBetaTrial(l) && (l.plan_type === "vip" || l.tier === "vip" || l.tier_id === "vip"));
    const now = options?.now || Date.now();
    const hasExpired = licenses.some((l) => {
        if (!l || l.disabled === true || l.revoked === true) return false;
        const exp = licenseExpiryMillis(l);
        return Number.isFinite(exp) && exp <= now;
    });

    // Derive tier, billingType, and capabilities deterministically
    let highestTier = "maker";
    let billingType = "none";
    let expiresAt = null;

    if (isVip) {
        highestTier = "vip";
        billingType = "lifetime";
    } else {
        // Paid records retain their existing selection order; beta only supplies Pro when needed.
        for (const l of [...active.filter(l => !isBetaTrial(l)), ...active.filter(isBetaTrial)]) {
            if (isBetaTrial(l)) {
                if (highestTier === 'maker' || highestTier === 'basic') {
                    highestTier = 'pro'; billingType = 'trial'; expiresAt = betaExpiryMillis(l);
                }
                continue;
            }
            const t = String(l.tier || l.tier_id || l.plan_type || l.plan || "").toLowerCase();
            const isPerpetual = l.isPerpetual === true || l.expiresAt == null || l.expires_at == null;

            if (t === "pro_plus" || t === "pro+" || t === "lifetime") {
                highestTier = "pro_plus";
                billingType = "lifetime";
                expiresAt = null;
                break;
            } else if (["pro", "studio_pro", "commercial", "1mo", "6mo", "12mo", "subscription", "subscriber", "standard", "business"].includes(t)) {
                if (highestTier !== "pro_plus") {
                    highestTier = "pro";
                    billingType = isPerpetual ? "lifetime" : (t === "12mo" ? "annual" : "monthly");
                    expiresAt = l.expiresAt ?? l.expires_at ?? null;
                }
            } else if (t === "basic") {
                if (highestTier === "maker") {
                    highestTier = "basic";
                    billingType = isPerpetual ? "lifetime" : (l.billingCycle === "12" ? "annual" : "monthly");
                    expiresAt = l.expiresAt ?? l.expires_at ?? null;
                }
            }
        }
    }

    const isBasicTier = highestTier === "basic";
    const isProOrAbove = ["pro", "pro_plus", "vip"].includes(highestTier);
    const capabilities = {
        basicGenerators: isBasicTier || isProOrAbove || active.length > 0,
        premiumGenerators: isProOrAbove,
        studioHub: isProOrAbove || entitlements.includes("studio-hub") || entitlements.includes("studio_hub"),
        bazaarHub: isProOrAbove || (!isBasicTier && entitlements.some((e) => ["bazaar-hub", "bazaar_hub", "bazaar"].includes(e))),
        commercialPrinting: isBasicTier || isProOrAbove || entitlements.includes("commercial"),
        vip: isVip,
    };

    const developerPreview = Boolean(
        options?.developerPreview ||
        options?.claims?.developerPreview ||
        active.some((l) => l.developerPreview === true || l.developer_preview === true || (Array.isArray(l.entitlements) && l.entitlements.includes("developer-preview")))
    );

    return {
        active,
        betaTrial: active.find(isBetaTrial) || null,
        endedBetaTrial: licenses.find(l => isBetaTrial(l) && l.claimedByUid === options?.uid && !active.includes(l) && l.claimedAt != null) || null,
        entitlements,
        isVip,
        developerPreview,
        tier: highestTier,
        billingType,
        status: active.length > 0 ? "active" : (hasExpired ? "expired" : "unlicensed"),
        expiresAt,
        capabilities,
        hasActiveLicense: active.length > 0,
        hasExpired,
    };
}

export function resolveAccountEntitlements(licenses = [], options = {}) {
    const summary = summarizeLicenses(licenses, options);
    return {
        tier: summary.tier,
        billingType: summary.billingType,
        status: summary.status,
        expiresAt: summary.expiresAt,
        capabilities: summary.capabilities,
        entitlements: summary.entitlements,
        isVip: summary.isVip,
        developerPreview: summary.developerPreview,
        hasActiveLicense: summary.hasActiveLicense,
        hasExpired: summary.hasExpired,
        active: summary.active,
    };
}

export function evaluateGeneratorAccess(generator, access = {}) {
    const result = (state, reason, metadata = {}) => ({
        state,
        reason,
        allowed: state === "authorized",
        ...metadata,
    });
    if (!generator) return result("unauthorized", "UNKNOWN_GENERATOR");

    const rawStatus = String(generator.status || "").toLowerCase().trim();
    const isComingSoon = rawStatus === "coming soon" || rawStatus === "coming_soon";
    const isMaintenance = rawStatus === "maintenance" || rawStatus === "under maintenance" || rawStatus === "under upgrade";
    const isUnreleased = isComingSoon || isMaintenance;
    const isHardBlocked = [
        "disabled",
        "archived",
        "hidden",
        "placeholder",
    ].includes(rawStatus);

    if (isHardBlocked) {
        return result("unauthorized", "UNAVAILABLE");
    }

    const hasDevPreview = access.developerPreview === true;

    // Public users and accounts without explicit developerPreview are blocked immediately from unreleased tools
    if (isUnreleased && !hasDevPreview) {
        return result("unauthorized", "UNAVAILABLE");
    }

    if (access.status === "loading")
        return result("loading", "VERIFYING_LICENSE");
    if (access.status === "error") return result("error", "VERIFICATION_ERROR");

    // Helper to wrap the final authorized decision with developer preview metadata if applicable
    const authorize = (reason) => {
        if (isUnreleased && hasDevPreview) {
            return result("authorized", reason, {
                developerPreview: true,
                originalStatus: generator.status || (isComingSoon ? "Coming Soon" : "Under Maintenance"),
                isUnderMaintenance: isMaintenance,
                isComingSoon: isComingSoon,
                warningMessage: "This generator is not publicly released. Features may be incomplete or unstable.",
            });
        }
        return result("authorized", reason);
    };

    // VIP is all-access (VIP-eligible exclusives included, non-VIP-eligible require individual entitlement)
    if (access.isVip) {
        if (generator.category === "exclusive" && generator.isVipEligible === false) {
            const hasEntitlement = access.entitlements?.includes(
                generator.requiredEntitlement || generator.id,
            );
            if (hasEntitlement) return authorize("ENTITLEMENT");
            return result("unauthorized", "EXCLUSIVE_PURCHASE_REQUIRED");
        }
        return authorize("VIP");
    }

    // Individual entitlement check (unlocks specific purchased generator regardless of subscription tier)
    const requiredId = generator.requiredEntitlement || generator.id;
    if (access.entitlements?.includes(requiredId)) {
        return authorize("ENTITLEMENT");
    }

    // Promo all-access with active license
    if (access.promoAllAccess && access.hasActiveLicense && !(access.active?.length && access.active.every(isBetaTrial))) {
        return authorize("PROMO");
    }

    // Determine category: "exclusive", "premium", or "basic"
    const cat = String(generator.category || "").toLowerCase();
    const isExclusiveCat = cat === "exclusive" || (cat !== "premium" && cat !== "basic" && (generator.isExclusive === true || generator.is_exclusive === true));
    const isPremiumCat = cat === "premium";

    // Exclusive generators require separate individual purchase (for non-VIP)
    if (isExclusiveCat) {
        return result(
            "unauthorized",
            access.hasActiveLicense || access.freeTrial ? "EXCLUSIVE_PURCHASE_REQUIRED" : "LICENSE_REQUIRED",
        );
    }

    // Resolve tier: check if user has active Pro/Pro+/VIP
    const activeTiers = (access.active || []).map(l =>
        String(l.tier || l.tier_id || l.plan_type || l.plan || "").toLowerCase()
    );
    const hasProOrAbove = activeTiers.some(t =>
        ["vip", "pro_plus", "pro+", "pro", "commercial", "studio_pro", "1mo", "6mo", "12mo", "lifetime", "subscription", "subscriber"].includes(t)
    ) || access.tier === "pro" || access.tier === "pro_plus" || access.tier === "vip";

    const hasBasicTier = activeTiers.some(t => t === "basic") || access.tier === "basic";

    // Premium generators:
    if (isPremiumCat) {
        if (hasProOrAbove) {
            return authorize("PRO_LICENSE");
        }
        return result(
            "unauthorized",
            hasBasicTier || access.freeTrial ? "PRO_REQUIRED" : (access.hasActiveLicense ? "ENTITLEMENT_REQUIRED" : "LICENSE_REQUIRED"),
        );
    }

    // Basic generators:
    // Check if free un-protected tool:
    const protectedGenerator =
        generator.isExclusive === true ||
        generator.is_exclusive === true ||
        generator.isFree === false;

    if (!protectedGenerator) {
        return authorize("FREE_TOOL");
    }

    // If protected basic generator:
    if (hasBasicTier || hasProOrAbove || access.hasActiveLicense) {
        return authorize("BASIC_LICENSE");
    }

    // Free basic export trial for non-subscribers accessing basic generators:
    const freeTrialRemaining = access.freeTrial ? access.freeTrial.remaining : access.exportsLeft;
    const isFreeEligible = isFreeTrialEligible(access);
    if (isFreeEligible && Number.isSafeInteger(freeTrialRemaining)) {
        if (freeTrialRemaining > 0) {
            return authorize("FREE_TRIAL", { freeTrial: true, remaining: freeTrialRemaining });
        }
        return result("unauthorized", "FREE_TRIAL_EXHAUSTED", { freeTrial: true, remaining: 0 });
    }

    return result("unauthorized", "LICENSE_REQUIRED");
}

// Viewing and customization follow generator access. Exporting is a separate
// capability because a free editor is not automatically a free download.
export function evaluateGeneratorCustomization(generator, access = {}) {
    return evaluateGeneratorAccess(generator, access);
}

export function evaluateExportAccess(generator, format, access = {}) {
    const result = (state, reason, metadata = {}) => ({
        state,
        reason,
        allowed: state === "authorized",
        ...metadata,
    });
    if (!["stl", "3mf", "threeMf"].includes(format))
        return result("unauthorized", "UNSUPPORTED_EXPORT_FORMAT");

    const generatorAccess = evaluateGeneratorAccess(generator, access);
    if (generatorAccess.state !== "authorized") return generatorAccess;
    if (access.status === "loading")
        return result("loading", "VERIFYING_LICENSE");
    if (access.status === "error") return result("error", "VERIFICATION_ERROR");
    const devMeta = generatorAccess.developerPreview ? {
        developerPreview: true,
        originalStatus: generatorAccess.originalStatus,
        isUnderMaintenance: generatorAccess.isUnderMaintenance,
        isComingSoon: generatorAccess.isComingSoon,
    } : {};

    // 1. VIP or active paid license has authoritative export authorization
    if (access.isVip || access.hasActiveLicense)
        return result("authorized", "LICENSE", devMeta);

    // Trial status check for non-subscribers (both web and desktop):
    if (access.trialStatus === "loading")
        return result("loading", "VERIFYING_TRIAL");
    if (access.trialStatus === "error")
        return result("error", "QUOTA_VERIFICATION_ERROR");

    // Desktop trial fallback
    if (access.desktop) {
        if (
            access.trialStatus === "ready" &&
            Number.isSafeInteger(access.exportsLeft) &&
            access.exportsLeft > 0
        ) {
            return result("authorized", "TRIAL", devMeta);
        }
        return result("unauthorized", "LICENSE_REQUIRED");
    }

    // 2. Free Basic Export Trial (Web):
    // Free users may export Basic generators only (not Premium or Exclusive)
    const cat = String(generator?.category || "").toLowerCase();
    const isBasicGenerator = generator &&
        cat !== "premium" &&
        cat !== "exclusive" &&
        generator.isExclusive !== true;

    if (!isBasicGenerator) {
        if (cat === "premium") return result("unauthorized", "PRO_REQUIRED", devMeta);
        return result("unauthorized", "EXCLUSIVE_PURCHASE_REQUIRED", devMeta);
    }

    if (access.freeTrial) {
        const freeTrialRemaining = access.freeTrial.remaining;
        if (Number.isSafeInteger(freeTrialRemaining)) {
            const limit = access.freeTrial.limit ?? DEFAULT_FREE_TRIAL_EXPORT_LIMIT;
            if (freeTrialRemaining > 0) {
                return result("authorized", "FREE_TRIAL", {
                    ...devMeta,
                    freeTrial: true,
                    remaining: freeTrialRemaining,
                    limit,
                    used: access.freeTrial.used ?? Math.max(0, limit - freeTrialRemaining),
                });
            }
            return result("unauthorized", "FREE_TRIAL_EXHAUSTED", {
                ...devMeta,
                freeTrial: true,
                remaining: 0,
                limit,
                used: access.freeTrial.used ?? limit,
            });
        }
    }

    if (Number.isSafeInteger(access.exportsLeft) && access.exportsLeft > 0) {
        return result("authorized", "FREE_TRIAL", {
            ...devMeta,
            freeTrial: true,
            remaining: access.exportsLeft,
            limit: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
        });
    }

    return result("unauthorized", "LICENSE_REQUIRED");
}

export function evaluateStudioHubAccess(access = {}) {
    const result = (state, reason) => ({
        state,
        reason,
        allowed: state === "authorized",
    });
    if (access.status === "loading")
        return result("loading", "VERIFYING_LICENSE");
    if (access.status === "error") return result("error", "VERIFICATION_ERROR");

    // In web mode, authentication is required
    if (!access.desktop && !access.currentUser) {
        return result("unauthenticated", "AUTH_REQUIRED");
    }

    // VIP is all-access
    if (access.isVip) return result("authorized", "VIP");

    // Promo all-access with active license
    if (access.promoAllAccess && access.hasActiveLicense && !(access.active?.length && access.active.every(isBetaTrial)))
        return result("authorized", "PROMO");

    // Explicit entitlement check
    if (
        access.entitlements?.includes("studio-hub") ||
        access.entitlements?.includes("studio_hub")
    ) {
        return result("authorized", "ENTITLEMENT");
    }

    // Active subscription tiers (Pro, Pro+, Commercial, 1mo, 6mo, 12mo, Lifetime)
    // Basic tier is explicitly NOT granted Studio Hub access
    const hasActiveSubscription = (access.active || []).some((l) => {
        if (!l || l.disabled === true || l.revoked === true) return false;
        const tier = String(
            l.tier || l.tier_id || l.plan_type || l.plan || "",
        ).toLowerCase();

        // Basic and maker tiers do not grant Studio Hub
        if (tier === "basic" || tier === "maker") return false;

        // Dedicated hub or commercial entitlement
        const hasStudioEntitlement = Array.isArray(l.entitlements) &&
            l.entitlements.some((e) =>
                ["commercial", "studio-hub", "studio_hub", "bazaar-hub", "bazaar_hub"].includes(e)
            );
        if (hasStudioEntitlement || l.commercial_license === true) return true;

        // Generator-only licenses without qualifying tier do not grant Studio Hub
        const isGeneratorOnly = Array.isArray(l.entitlements) && l.entitlements.length > 0 && !tier;
        if (isGeneratorOnly) return false;

        return [
            "pro",
            "pro_plus",
            "pro+",
            "vip",
            "1mo",
            "6mo",
            "12mo",
            "lifetime",
            "studio_pro",
            "subscriber",
            "subscription",
            "standard",
            "commercial",
            "business",
        ].includes(tier);
    });

    if (hasActiveSubscription) return result("authorized", "SUBSCRIBER");

    // Check if account has an active paid license that qualifies for Pro (excludes basic, maker, generator-only)
    const hasQualifyingPaidLicense = (access.active || []).some((l) => {
        if (!l || l.disabled === true || l.revoked === true) return false;
        const tier = String(l.tier || l.tier_id || l.plan_type || l.plan || "").toLowerCase();
        if (tier === "maker" || tier === "basic") return false;
        const isGeneratorOnly = Array.isArray(l.entitlements) && l.entitlements.length > 0 && !tier;
        if (isGeneratorOnly) return false;
        return true;
    });

    if (hasQualifyingPaidLicense) {
        return result("authorized", "ACTIVE_LICENSE");
    }

    // Expired subscription state
    if (access.hasExpired) return result("expired", "SUBSCRIPTION_EXPIRED");

    return result("unauthorized", "SUBSCRIBER_REQUIRED");
}

export function evaluateBazaarAccess(access = {}) {
    const result = (state, reason) => ({
        state,
        reason,
        allowed: state === "authorized",
    });
    if (access.status === "loading")
        return result("loading", "VERIFYING_LICENSE");
    if (access.status === "error") return result("error", "VERIFICATION_ERROR");

    // In web mode, authentication is required
    if (!access.desktop && !access.currentUser) {
        return result("unauthenticated", "AUTH_REQUIRED");
    }

    // VIP is all-access (requires active verified license/entitlement)
    if (access.isVip)
        return result("authorized", "VIP");

    // Promo all-access with active commercial license
    if (access.promoAllAccess && access.hasActiveLicense && !(access.active?.length && access.active.every(isBetaTrial)))
        return result("authorized", "PROMO");

    // Explicit dedicated Bazaar Hub entitlement (excludes basic tier)
    const isBasicAccount = access.tier === "basic";
    if (
        !isBasicAccount &&
        access.entitlements?.some((e) =>
            ["bazaar-hub", "bazaar_hub", "bazaar"].includes(e),
        )
    ) {
        return result("authorized", "ENTITLEMENT");
    }

    // Active Commercial / Studio Pro / Subscription license tiers
    const hasQualifyingLicense = (access.active || []).some((l) => {
        if (!l || l.disabled === true || l.revoked === true) return false;
        const tier = String(
            l.tier || l.tier_id || l.plan_type || l.plan || "",
        ).toLowerCase();

        // Free tier (maker) and Basic tier do not grant Bazaar Hub access
        if (tier === "maker" || tier === "basic") return false;

        // Dedicated Bazaar Hub entitlement on the license
        const hasBazaarEntitlement = Array.isArray(l.entitlements) &&
            l.entitlements.some((e) =>
                ["bazaar-hub", "bazaar_hub", "bazaar"].includes(e)
            );
        if (hasBazaarEntitlement) return true;

        // Generator-only licenses have tool entitlements but no commercial/bazaar entitlements
        const isGeneratorOnly = Array.isArray(l.entitlements) && l.entitlements.length > 0 && !tier;
        if (isGeneratorOnly) return false;

        return [
            "commercial",
            "studio_pro",
            "pro",
            "pro_plus",
            "pro+",
            "vip",
            "1mo",
            "6mo",
            "12mo",
            "lifetime",
            "bazaar",
            "business",
            "standard",
            "subscriber",
            "subscription",
        ].includes(tier);
    });

    if (hasQualifyingLicense) return result("authorized", "COMMERCIAL_LICENSE");

    // Any verified active paid subscription on the account grants Pro access (excluding unentitled free maker, basic, and generator-only licenses)
    const hasActivePaidLicense = (access.active || []).some((l) => {
        if (!l || l.disabled === true || l.revoked === true) return false;
        const tier = String(l.tier || l.tier_id || l.plan_type || l.plan || "").toLowerCase();
        if (tier === "maker" || tier === "basic") return false;
        const isGeneratorOnly = Array.isArray(l.entitlements) && l.entitlements.length > 0 && !tier;
        if (isGeneratorOnly) return false;
        return true;
    });

    if (hasActivePaidLicense) {
        return result("authorized", "ACTIVE_LICENSE");
    }

    // Expired subscription state
    if (access.hasExpired) return result("expired", "SUBSCRIPTION_EXPIRED");

    return result("unauthorized", "COMMERCIAL_OR_ENTITLEMENT_REQUIRED");
}

export function validateClaim(license, uid, hwid, now = Date.now()) {
    if (!license) throw new Error("Invalid License Code.");
    if (isBetaTrial(license)) throw new Error("Beta trials require signed-in beta activation.");
    if (
        !["active", "unclaimed", "pending"].includes(license.status) ||
        license.disabled === true ||
        license.revoked === true
    )
        throw new Error("This license is not available for activation.");
    const expiry = expiryMillis(license.expiresAt ?? license.expires_at);
    if (Number.isNaN(expiry) || expiry <= now)
        throw new Error(
            "This license has expired or has an invalid expiration date.",
        );
    if (license.claimedByUid && license.claimedByUid !== uid)
        throw new Error(
            "This license is already bound to another Google account.",
        );
    if (hwid && license.hwid && license.hwid !== hwid)
        throw new Error("This license is bound to a different desktop device.");
}
