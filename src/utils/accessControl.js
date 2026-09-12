export function evaluateAccess(editor, license, globalSettings) {
    // 1. Block unavailable editors completely
    if (editor.status === 'maintenance') {
        return { allowed: false, reason: 'MAINTENANCE', message: 'This generator is currently undergoing maintenance.' };
    }
    if (editor.status === 'coming_soon') {
        return { allowed: false, reason: 'COMING_SOON', message: 'This generator is launching soon!' };
    }

    // 2. Open access for standard non-exclusive tools
    if (!editor.is_exclusive && !editor.isExclusive) { // Fallback for camelCase
        return { allowed: true, reason: 'FREE_TOOL' };
    }

    // 3. Block completely unlicensed users from exclusive tools
    if (!license || !license.activated) {
        return { allowed: false, reason: 'UNLICENSED', message: 'An active license or VIP subscription is required.' };
    }

    // 4. Global Promotional Event Override (All licensed users get access)
    if (globalSettings?.promo_all_access) {
        return { allowed: true, reason: 'PROMO_EVENT', isPromo: true };
    }

    // 5. Tiered Subscription Check
    if (license.plan_type === 'vip' || license.plan_type === 'lifetime') {
        return { allowed: true, reason: 'VIP_SUBSCRIPTION' };
    }

    // 6. A-la-carte Entitlement Check
    if (Array.isArray(license.entitlements) && license.entitlements.includes(editor.id)) {
        return { allowed: true, reason: 'A_LA_CARTE' };
    }

    return { allowed: false, reason: 'UPGRADE_REQUIRED', message: 'Upgrade to VIP to unlock this exclusive generator.' };
}
