import { isBetaTrial } from '../utils/betaTrialPolicy';
import { activateBetaTrialInStore } from '../engine/licensing/betaTrialWorkflow';
import { db, app } from '../firebase';
import { collection, query, where, getDocsFromServer, getDocFromServer, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

export function getLicensingApiUrl() {
    const envUrl = import.meta.env?.VITE_LICENSING_API_URL || import.meta.env?.VITE_BAZAAR_API_URL;
    if (envUrl && envUrl.trim()) {
        const url = new URL(envUrl.trim());
        const isLocal = (import.meta.env?.DEV || import.meta.env?.VITE_USE_FIREBASE_EMULATORS === 'true') &&
            ['127.0.0.1', 'localhost'].includes(url.hostname);
        if (url.protocol !== 'https:' && !isLocal) {
            throw new Error('The licensing service requires HTTPS.');
        }
        return url.href.replace(/\/$/, '');
    }
    return '';
}

export async function activateLicense(licenseKey, currentUser) {
    try {
        const key = licenseKey?.trim();
        if (!key || key.includes('/') || !currentUser?.uid) {
            throw new Error('Sign in and enter a valid license code.');
        }

        // Detect beta before any ordinary API, callable, or desktop activation path.
        const licenseRef = doc(db, 'licenses', key);
        const inspected = await getDocFromServer(licenseRef);
        if (inspected.exists() && isBetaTrial(inspected.data())) {
            const store = {
                serverTimestamp,
                transaction: callback => runTransaction(db, transaction => callback({
                    get: async path => { const snap = await transaction.get(doc(db, path)); return snap.exists() ? snap.data() : null; },
                    update: (path, data) => transaction.update(doc(db, path), data),
                    set: (path, data) => transaction.set(doc(db, path), data),
                })),
            };
            const result = await activateBetaTrialInStore(store, currentUser.uid, key);
            // Read the committed server timestamp, never a local pending timestamp.
            const committed = await getDocFromServer(licenseRef);
            const license = { ...committed.data(), id: key, licenseKey: key };
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('license-activated', { detail: license }));
            return { ...result, license };
        }

        let hwid = null;
        if (typeof window !== 'undefined' && window.electronAPI?.getHwid) {
            try {
                hwid = await window.electronAPI.getHwid();
            } catch {
                throw new Error('Unable to verify this desktop device.');
            }
        }

        const idToken = await currentUser.getIdToken();
        const apiUrl = getLicensingApiUrl();

        let result;
        if (apiUrl) {
            const response = await fetch(`${apiUrl}/activate-license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ licenseKey: key, hwid }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'License activation was denied by the server.');
            }
            result = data;
        } else {
            // First try Cloud Functions if deployed
            let cloudFunctionSuccess = false;
            try {
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions(app, 'us-central1');
                if (Boolean(import.meta.env?.DEV && import.meta.env?.VITE_USE_FIREBASE_EMULATORS === 'true')) {
                    const { connectFunctionsEmulator } = await import('firebase/functions');
                    try { connectFunctionsEmulator(functions, '127.0.0.1', 5001); } catch {}
                }
                const activateCallable = httpsCallable(functions, 'activateLicense');
                const res = await activateCallable({ licenseKey: key, hwid });
                result = res.data;
                cloudFunctionSuccess = true;
            } catch (fnErr) {
                // If Cloud Function is not deployed (404/internal), fallback to secure Firestore transaction
                // Strictly governed by firestore.rules Case 1 (unclaimed) and Case 2 (owner sync)
                const isUnavailable = fnErr?.code === 'functions/not-found' ||
                    fnErr?.code === 'functions/internal' ||
                    fnErr?.message?.includes('internal') ||
                    fnErr?.message?.includes('404') ||
                    fnErr?.message?.includes('not found');
                
                if (!isUnavailable) {
                    throw fnErr;
                }
            }

            if (!cloudFunctionSuccess) {
                const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
                const { validateClaim } = await import('../utils/licensePolicy');

                await runTransaction(db, async transaction => {
                    const ref = doc(db, 'licenses', key);
                    const snap = await transaction.get(ref);
                    const licenseData = snap.exists() ? snap.data() : null;
                    
                    validateClaim(licenseData, currentUser.uid, hwid);

                    if (licenseData.claimedByUid === currentUser.uid) {
                        // CASE 2: Already claimed by current user, sync lastSyncAt
                        transaction.update(ref, {
                            lastSyncAt: serverTimestamp(),
                        });
                        result = {
                            success: true,
                            message: 'License already active on your account.',
                            license: { id: key, licenseKey: key, ...licenseData },
                        };
                    } else {
                        // CASE 1: Unclaimed license, claim atomically
                        transaction.update(ref, {
                            claimedByUid: currentUser.uid,
                            status: 'active',
                            lastSyncAt: serverTimestamp(),
                        });
                        result = {
                            success: true,
                            message: 'License activated successfully!',
                            license: { id: key, licenseKey: key, ...licenseData, status: 'active', claimedByUid: currentUser.uid },
                        };
                    }
                });
            }
        }

        // Force-refresh the user's owned licenses from the Firestore server
        // This ensures the claimed license immediately populates AuthContext and listeners
        try {
            const ownedQuery = query(collection(db, 'licenses'), where('claimedByUid', '==', currentUser.uid));
            await getDocsFromServer(ownedQuery);
        } catch (refreshErr) {
            console.warn('License activated, but local query refresh was delayed:', refreshErr);
        }

        if (typeof window !== 'undefined') {
            if (window.electronAPI?.startSync) {
                try { await window.electronAPI.startSync(); } catch {}
            }
            window.dispatchEvent(new CustomEvent('license-activated', { detail: result?.license }));
        }

        return {
            success: true,
            message: result?.message || 'License activated successfully!',
            license: result?.license || null,
        };
    } catch (error) {
        return {
            success: false,
            message: error?.message || 'Failed to activate license.',
        };
    }
}

