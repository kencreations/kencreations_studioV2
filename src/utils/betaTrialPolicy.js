// Beta timestamps are Firestore timestamps; no client date/expiry fallback.
export const BETA_DURATION_SECONDS = 604800;
export const isBetaTrial = license => license?.licenseType === 'beta_trial';
export function betaClaimedMillis(value) {
    if (!value || !Number.isSafeInteger(value.seconds) || !Number.isInteger(value.nanoseconds) ||
        value.nanoseconds < 0 || value.nanoseconds >= 1e9) return NaN;
    return value.seconds * 1000 + value.nanoseconds / 1e6;
}
export function betaExpiryMillis(license) {
    return betaClaimedMillis(license?.claimedAt) + BETA_DURATION_SECONDS * 1000;
}
export function validBetaShape(license) {
    return isBetaTrial(license) && license.tier === 'pro' && license.billingType === 'trial' &&
        license.trialDurationDays === 7 && license.pricePHP === 0 && license.isPerpetual === false &&
        license.validityStartPolicy === 'at_activation' && license.expiresAt === null &&
        Array.isArray(license.entitlements) && license.entitlements.length === 0 &&
        license.disabled !== true && license.revoked !== true;
}
export function activeBetaTrial(license, uid, now = Date.now()) {
    const start = betaClaimedMillis(license?.claimedAt);
    return validBetaShape(license) && license.status === 'active' && !!uid &&
        license.claimedByUid === uid && Number.isFinite(start) && start <= now &&
        now < betaExpiryMillis(license);
}
export function formatBetaDeadline(license) {
    const deadline = betaExpiryMillis(license);
    return Number.isFinite(deadline) ? new Date(deadline).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    }) : 'Not activated';
}
export function formatBetaRemaining(license, now = Date.now()) {
    const deadline = betaExpiryMillis(license);
    if (!Number.isFinite(deadline)) return 'Starts on activation';
    const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
    if (!seconds) return 'Expired';
    return Math.floor(seconds / 86400) + 'd ' + Math.floor(seconds % 86400 / 3600) + 'h ' +
        Math.floor(seconds % 3600 / 60) + 'm ' + seconds % 60 + 's remaining';
}
