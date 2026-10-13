import { expiryMillis } from '../../utils/licensePolicy.js';

export function sanitizeLicense(license) {
    if (!license) return null;
    if (license.licenseType === 'beta_trial') throw new Error('Beta trials cannot be converted to ordinary licenses.');
    return {
        id: license.id || license.licenseKey || null,
        licenseKey: license.licenseKey || license.id || null,
        status: license.status || 'active',
        tier: license.tier || license.plan_type || 'standard',
        plan_type: license.plan_type || license.tier || 'standard',
        entitlements: Array.isArray(license.entitlements) ? license.entitlements : [],
        expiresAt: license.expiresAt ?? license.expires_at ?? null,
        claimedAt: license.claimedAt ?? null,
        claimedByUid: license.claimedByUid ?? null,
        hwid: license.hwid ?? null,
    };
}

/**
 * Authoritative backend license claiming workflow.
 * Atomically validates, checks permissions/expiry, and binds the license to the authenticated UID.
 *
 * @param {Object} store - Transactional store adapter (Firestore transaction)
 * @param {string} uid - Verified authenticated user ID
 * @param {Object} params - Activation parameters
 * @param {string} params.licenseKey - Submitted license key
 * @param {string|null} [params.hwid] - Optional hardware ID for desktop binding
 * @param {number} [now] - Current timestamp
 * @returns {Promise<{ success: boolean, message: string, license: Object, idempotent?: boolean }>}
 */
export async function activateLicenseInStore(store, uid, { licenseKey, hwid = null } = {}, now = Date.now()) {
    const key = String(licenseKey || '').trim();
    if (!key || key.includes('/') || !uid) {
        throw new Error('Sign in and enter a valid license code.');
    }

    return store.transaction(async tx => {
        const path = `licenses/${key}`;
        const license = await tx.get(path);

        if (!license) {
            throw new Error('Invalid License Code.');
        }

        if (license.licenseType === 'beta_trial') throw new Error('Beta trials require signed-in beta activation.');

        // Check if disabled or revoked
        if (
            license.disabled === true ||
            license.revoked === true ||
            !['active', 'unclaimed', 'pending'].includes(license.status)
        ) {
            throw new Error('This license is not available for activation.');
        }

        // Check expiration
        const expiry = expiryMillis(license.expiresAt ?? license.expires_at);
        if (Number.isNaN(expiry) || expiry <= now) {
            throw new Error('This license has expired or has an invalid expiration date.');
        }

        // Ownership verification
        if (license.claimedByUid && license.claimedByUid !== uid) {
            throw new Error('This license is already bound to another Google account.');
        }

        // Hardware ID device binding check
        if (hwid && license.hwid && license.hwid !== hwid) {
            throw new Error('This license is bound to a different desktop device.');
        }

        // Idempotent retry: License is already claimed by this user
        if (license.claimedByUid === uid) {
            if (hwid && !license.hwid) {
                const updated = {
                    ...license,
                    hwid,
                    hwidBoundAt: now,
                    lastSyncAt: now,
                };
                tx.set(path, updated);
                return {
                    success: true,
                    message: 'License already active on your account.',
                    license: sanitizeLicense(updated),
                    idempotent: true,
                };
            }
            return {
                success: true,
                message: 'License already active on your account.',
                license: sanitizeLicense(license),
                idempotent: true,
            };
        }

        // Atomic claim: Bind to authenticated user UID while strictly preserving
        // immutable server-provisioned tier, plan_type, entitlements, and expiration!
        const updated = {
            ...license,
            claimedByUid: uid,
            status: 'active',
            claimedAt: now,
            lastSyncAt: now,
            ...(hwid ? { hwid, hwidBoundAt: now } : {}),
        };

        tx.set(path, updated);

        return {
            success: true,
            message: 'License activated successfully!',
            license: sanitizeLicense(updated),
            idempotent: false,
        };
    });
}
