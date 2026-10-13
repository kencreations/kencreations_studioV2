import { validBetaShape, activeBetaTrial } from '../../utils/betaTrialPolicy.js';

// Store adapter supplies serverTimestamp(). Firestore Rules enforce every write;
// this helper's checks provide friendly errors, not the security boundary.
export async function activateBetaTrialInStore(store, uid, key, now = Date.now()) {
    if (!uid || !key || key.includes('/')) throw new Error('Sign in and enter a valid beta key.');
    return store.transaction(async tx => {
        const licensePath = 'licenses/' + key;
        const claimPath = 'beta_trial_claims/' + uid;
        const license = await tx.get(licensePath);
        const claim = await tx.get(claimPath);
        if (!validBetaShape(license)) throw new Error('This beta key is invalid or revoked.');
        if (license.claimedByUid === uid && claim?.licenseId === key && claim.uid === uid &&
            activeBetaTrial(license, uid, now)) {
            return { success: true, idempotent: true, message: 'Your beta trial is already active. Its original deadline is unchanged.' };
        }
        if (claim) throw new Error('This account has already used its beta trial.');
        if (license.status !== 'unclaimed' || license.claimedByUid !== null || license.claimedAt !== null) {
            throw new Error('This beta key has already been claimed or is unavailable.');
        }
        const timestamp = store.serverTimestamp();
        tx.update(licensePath, { claimedByUid: uid, status: 'active', claimedAt: timestamp, lastSyncAt: timestamp });
        tx.set(claimPath, { uid, licenseId: key, claimedAt: timestamp });
        return { success: true, idempotent: false, message: 'Your 7-Day Pro Beta Trial is active!' };
    });
}
