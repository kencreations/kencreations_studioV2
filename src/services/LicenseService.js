import { db } from '../firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { validateClaim } from '../utils/licensePolicy';

export async function activateLicense(licenseKey, currentUser) {
    try {
        const key = licenseKey?.trim();
        if (!key || key.includes('/') || !currentUser?.uid) throw new Error('Sign in and enter a valid license code.');
        let hwid = null;
        if (window.electronAPI) {
            hwid = await window.electronAPI.getHwid();
            if (!hwid) throw new Error('Unable to verify this desktop device.');
        }
        await runTransaction(db, async transaction => {
            const ref = doc(db, 'licenses', key);
            const snap = await transaction.get(ref);
            const license = snap.exists() ? snap.data() : null;
            validateClaim(license, currentUser.uid, hwid);
            // Rules must independently enforce ownership and immutable grants.
            transaction.update(ref, {
                claimedByUid: currentUser.uid, status: 'active',
                ...(hwid ? { hwid } : {}), lastSyncAt: serverTimestamp(),
            });
        });
        return { success: true, message: 'License activated successfully!' };
    } catch (error) {
        return { success: false, message: error.code === 'permission-denied'
            ? 'License activation was denied by the server. Please contact support.'
            : error.message || 'Failed to activate license.' };
    }
}
