import { db } from '../firebase';
import { collection, query, where, getDocsFromServer } from 'firebase/firestore';

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
    if (import.meta.env?.DEV) {
        return 'http://127.0.0.1:5191';
    }
    return '';
}

export async function activateLicense(licenseKey, currentUser) {
    try {
        const key = licenseKey?.trim();
        if (!key || key.includes('/') || !currentUser?.uid) {
            throw new Error('Sign in and enter a valid license code.');
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
            // Cloud Functions fallback for deployments without a dedicated HTTP backend
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const activateCallable = httpsCallable(functions, 'activateLicense');
            const res = await activateCallable({ licenseKey: key, hwid });
            result = res.data;
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
            message: error.code === 'permission-denied'
                ? 'License activation was denied by the server. Please contact support.'
                : error.message || 'Failed to activate license.',
        };
    }
}

