/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { isBetaTrial } from '../utils/betaTrialPolicy';
import { useAuth } from './AuthContext';
import { summarizeLicenses, evaluateGeneratorAccess, evaluateStudioHubAccess, evaluateBazaarAccess, expiryMillis } from '../utils/licensePolicy';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const AccessContext = createContext();
export const useAccess = () => useContext(AccessContext);

export function AccessProvider({ children }) {
    const auth = useAuth();
    const [desktop, setDesktop] = useState({ status: 'loading', license: null });
    const [promo, setPromo] = useState(null);
    const [now, setNow] = useState(Date.now);
    const isDesktop = !!window.electronAPI;
    useEffect(() => {
        const stop = onSnapshot(doc(db, 'app_settings', 'global'), { includeMetadataChanges: true }, snap => {
            setPromo(!snap.metadata.fromCache && !snap.metadata.hasPendingWrites && snap.exists() ? snap.data() : null);
        }, () => setPromo(null));
        return stop;
    }, []);
    useEffect(() => {
        const deadlines = [expiryMillis(promo?.promo_expiry), expiryMillis(desktop.license?.expiresAt)].filter(t => Number.isFinite(t) && t > now);
        if (!deadlines.length) return;
        const timer = setTimeout(() => setNow(Date.now()), Math.min(2147483647, Math.max(1, Math.min(...deadlines) - Date.now() + 1)));
        return () => clearTimeout(timer);
    }, [promo, desktop.license, now]);
    useEffect(() => {
        if (!isDesktop) return;
        let disposed = false;
        let epoch = 0;
        const refresh = async () => {
            const request = ++epoch;
            try {
                const license = await window.electronAPI.checkLicense();
                if (!disposed && epoch === request) setDesktop({ status: 'ready', license });
            } catch {
                if (!disposed && epoch === request) setDesktop({ status: 'error', license: null });
            }
        };
        const revoke = () => { epoch++; setDesktop({ status: 'ready', license: null }); };
        const stopUpdate = window.electronAPI.onEntitlementsUpdated?.(refresh);
        const stopRevoke = window.electronAPI.onLicenseRevoked?.(revoke);
        window.addEventListener('license-activated', refresh);
        void refresh();
        void window.electronAPI.startSync?.().catch(() => {});
        return () => { disposed = true; epoch++; stopUpdate?.(); stopRevoke?.(); window.removeEventListener('license-activated', refresh); };
    }, [isDesktop]);
    const desktopSummary = isDesktop
        ? summarizeLicenses(desktop.license ? [desktop.license] : [], { desktop: true, now })
        : null;
    const combinedActive = [
        ...(desktopSummary?.active || []),
        ...(auth.active || []),
    ];
    const hasActiveLicense = Boolean(
        desktopSummary?.hasActiveLicense ||
        auth.hasActiveLicense ||
        combinedActive.length > 0
    );
    const isVip = Boolean(desktopSummary?.isVip || auth.isVip);
    const entitlements = [
        ...new Set([
            ...(desktopSummary?.entitlements || []),
            ...(auth.entitlements || []),
        ]),
    ];
    const hasExpired = Boolean(
        !hasActiveLicense && (desktopSummary?.hasExpired || auth.hasExpired)
    );
    const status = isDesktop
        ? (desktop.status === 'ready' || auth.status === 'ready' ? 'ready' : (desktop.status === 'loading' && auth.status === 'loading' ? 'loading' : desktop.status))
        : auth.status;

    const resolvedTier = isVip ? 'vip'
        : [desktopSummary?.tier, auth?.tier].includes('pro_plus') ? 'pro_plus'
        : [desktopSummary?.tier, auth?.tier].includes('pro') ? 'pro'
        : [desktopSummary?.tier, auth?.tier].includes('basic') ? 'basic'
        : 'maker';

    const resolvedBilling = isVip || resolvedTier === 'pro_plus' ? 'lifetime'
        : auth.billingType === 'trial' && !['pro', 'pro_plus', 'vip'].includes(desktopSummary?.tier) ? 'trial'
        : [desktopSummary?.billingType, auth?.billingType].includes('annual') ? 'annual'
        : [desktopSummary?.billingType, auth?.billingType].includes('monthly') ? 'monthly'
        : auth.billingType === 'trial' && resolvedTier === 'pro' ? 'trial'
        : 'none';

    const isBasicTier = resolvedTier === 'basic';
    const isProOrAbove = ['pro', 'pro_plus', 'vip'].includes(resolvedTier);

    const capabilities = {
        basicGenerators: isBasicTier || isProOrAbove || combinedActive.length > 0,
        premiumGenerators: isProOrAbove,
        studioHub: isProOrAbove || entitlements.includes('studio-hub') || entitlements.includes('studio_hub'),
        bazaarHub: isProOrAbove || (!isBasicTier && entitlements.some(e => ['bazaar-hub', 'bazaar_hub', 'bazaar'].includes(e))),
        commercialPrinting: isBasicTier || isProOrAbove || entitlements.includes('commercial'),
        vip: isVip,
    };

    const summary = {
        active: combinedActive,
        betaTrial: auth.betaTrial,
        endedBetaTrial: auth.endedBetaTrial,
        entitlements,
        isVip,
        tier: resolvedTier,
        billingType: resolvedBilling,
        capabilities,
        hasActiveLicense,
        hasExpired,
        status,
        desktop: isDesktop,
        currentUser: auth.currentUser,
    };
    const promoAllAccess = combinedActive.some(l => !isBetaTrial(l)) && promo?.promo_all_access === true && expiryMillis(promo.promo_expiry) > now;
    const value = { ...summary, promoAllAccess, desktop: isDesktop, currentUser: auth.currentUser };
    return (
        <AccessContext.Provider
            value={{
                ...value,
                evaluate: generator => evaluateGeneratorAccess(generator, value),
                evaluateStudioHub: () => evaluateStudioHubAccess(value),
                evaluateBazaar: () => evaluateBazaarAccess(value),
            }}
        >
            {children}
        </AccessContext.Provider>
    );
}
