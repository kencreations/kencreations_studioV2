import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onIdTokenChanged } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp, collection, query, where, onSnapshot, getDocsFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { observeAccount } from '../services/accountObserver';
import { summarizeLicenses, licenseExpiryMillis } from '../utils/licensePolicy';

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }
const ownedLicenses = uid => query(collection(db, 'licenses'), where('claimedByUid', '==', uid));

export function AuthProvider({ children }) {
    const [account, setAccount] = useState({ currentUser: null, userData: null, licenses: [], claims: {}, developerPreview: false, status: 'loading', error: null });
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const stop = observeAccount({
            auth: (next, error) => onIdTokenChanged(auth, next, error),
            profile: (uid, next, error) => onSnapshot(doc(db, 'users', uid), snap => next(snap.exists() ? snap.data() : null), error),
            licenses: (uid, next, error) => onSnapshot(ownedLicenses(uid), { includeMetadataChanges: true }, snap => {
                next(snap.docs.map(d => ({ ...d.data(), id: d.id })), !snap.metadata.fromCache && !snap.metadata.hasPendingWrites);
            }, error),
            claims: (user, next, error) => {
                let disposed = false;
                user.getIdTokenResult(true).then(res => {
                    if (!disposed) next(res?.claims || {});
                }).catch(err => {
                    if (!disposed) {
                        console.warn('Failed to read ID token claims:', err);
                        error?.(err);
                    }
                });
                return () => { disposed = true; };
            },
        }, setAccount);
        return stop;
    }, []);
    useEffect(() => {
        const deadlines = account.licenses.map(l => licenseExpiryMillis(l)).filter(t => Number.isFinite(t) && t > now);
        if (!deadlines.length) return;
        const timer = setTimeout(() => setNow(Date.now()), Math.min(2147483647, Math.max(1, Math.min(...deadlines) - Date.now() + 1)));
        return () => clearTimeout(timer);
    }, [account.licenses, now]);
    const fetchUserData = async uid => {
        if (uid !== auth.currentUser?.uid) return;
        await getDocsFromServer(ownedLicenses(uid));
    };
    const refreshClaims = async () => {
        if (!auth.currentUser) return {};
        try {
            const tokenResult = await auth.currentUser.getIdTokenResult(true);
            const claims = tokenResult?.claims || {};
            setAccount(prev => ({
                ...prev,
                claims,
                developerPreview: claims.developerPreview === true,
            }));
            return claims;
        } catch (err) {
            console.warn('Failed to force refresh ID token claims:', err);
            return {};
        }
    };
    const loginWithGoogle = async () => {
        const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
        try {
            await runTransaction(db, async transaction => {
                const ref = doc(db, 'users', user.uid);
                const snap = await transaction.get(ref);
                if (!snap.exists()) transaction.set(ref, {
                    displayName: user.displayName, email: user.email, photoURL: user.photoURL,
                    points: 0, tier: 'maker', totalExports: 0, joinedAt: serverTimestamp(),
                });
            });
        } catch { console.warn('Signed in, but the profile could not be initialized.'); }
        return user;
    };
    const summary = summarizeLicenses(account.licenses, {
        uid: account.currentUser?.uid,
        now,
        developerPreview: account.developerPreview,
        claims: account.claims,
    });
    return <AuthContext.Provider value={{
        ...account, ...summary,
        userLicenses: summary.active,
        userLicense: summary.active[0] ?? null,
        loading: account.status === 'loading',
        loginWithGoogle,
        logout: () => signOut(auth),
        fetchUserData,
        refreshClaims,
    }}>{children}</AuthContext.Provider>;
}
