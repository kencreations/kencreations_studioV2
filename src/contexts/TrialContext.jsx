import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useAccess } from "./AccessContext";
import { FreeTrialService } from "../services/freeTrialService";
import { DEFAULT_FREE_TRIAL_EXPORT_LIMIT, isFreeTrialEligible } from "../utils/freeTrialPolicy";

const TrialContext = createContext();

export function TrialProvider({ children }) {
    const auth = useAuth() || {};
    const access = useAccess() || {};
    const currentUser = auth.currentUser;

    const isPaidLicense = !isFreeTrialEligible(access);

    const [exportsLeft, setExportsLeft] = useState(null);
    const [loadingTrial, setLoadingTrial] = useState(true);
    const [machineId, setMachineId] = useState(null);
    const [trialStatus, setTrialStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
    const [trialError, setTrialError] = useState(null);
    const [freeTrial, setFreeTrial] = useState({
        limit: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
        used: 0,
        remaining: null,
        operations: {},
        status: "loading",
        isEligible: !isPaidLicense,
    });

    // Desktop hardware ID check for offline/desktop license fallback
    useEffect(() => {
        let disposed = false;
        if (window.electronAPI && window.electronAPI.getMachineId) {
            window.electronAPI.getMachineId().then((hwid) => {
                if (!disposed) setMachineId(hwid);
            }).catch(() => {});
        }
        return () => { disposed = true; };
    }, []);

    // Subscribe to account-scoped Free Trial Quota in Firestore when signed in
    useEffect(() => {
        if (!currentUser?.uid) {
            setFreeTrial({
                limit: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                used: 0,
                remaining: DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
                operations: {},
                status: "ready",
                isEligible: !isPaidLicense,
            });
            setExportsLeft(DEFAULT_FREE_TRIAL_EXPORT_LIMIT);
            setLoadingTrial(false);
            setTrialStatus("ready");
            setTrialError(null);
            return;
        }

        setLoadingTrial(true);
        setTrialStatus("loading");
        setTrialError(null);

        const unsubscribe = FreeTrialService.subscribeQuota(
            currentUser.uid,
            (quota) => {
                const limit = quota?.limit ?? DEFAULT_FREE_TRIAL_EXPORT_LIMIT;
                const used = quota?.used ?? 0;
                const remaining = quota?.remaining ?? Math.max(0, limit - used);

                setFreeTrial({
                    ownerUid: currentUser.uid,
                    limit,
                    used,
                    remaining,
                    operations: quota?.operations || {},
                    status: "ready",
                    isEligible: !isPaidLicense,
                });
                setExportsLeft(remaining);
                setLoadingTrial(false);
                setTrialStatus("ready");
                setTrialError(null);
            },
            (err) => {
                console.warn("[TrialContext] Quota subscription error:", err);
                // Do NOT set 5 as fallback when quota read fails!
                setTrialStatus("error");
                setTrialError(err);
                setLoadingTrial(false);
                setExportsLeft(null);
                setFreeTrial((prev) => ({
                    ...prev,
                    status: "error",
                    error: err?.message || "QUOTA_UNAVAILABLE",
                    remaining: null,
                }));
            }
        );

        return () => unsubscribe?.();
    }, [currentUser?.uid, isPaidLicense]);

    const consumeCredit = async ({ generatorId, format = "stl", operationId } = {}) => {
        if (isPaidLicense) {
            // Paid licensees bypass trial consumption entirely
            return { success: true, bypassed: true };
        }

        if (!currentUser?.uid) {
            const err = new Error("SIGN_IN_REQUIRED");
            err.code = "SIGN_IN_REQUIRED";
            throw err;
        }

        const opId = operationId || crypto.randomUUID();
        const result = await FreeTrialService.consumeCredit(currentUser.uid, {
            generatorId,
            format,
            operationId: opId,
            limit: freeTrial.limit || DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
        });

        if (result?.success) {
            setExportsLeft(result.remaining);
            setFreeTrial((prev) => ({
                ...prev,
                used: result.used,
                remaining: result.remaining,
                status: "ready",
            }));
            setTrialStatus("ready");
            setTrialError(null);
        }
        return result;
    };

    const decrementTrial = async (details = {}) => {
        if (isPaidLicense) return true;
        try {
            const res = await consumeCredit(details);
            return Boolean(res?.success);
        } catch (err) {
            console.warn("[TrialContext] Decrement error:", err);
            return false;
        }
    };

    return (
        <TrialContext.Provider
            value={{
                exportsLeft,
                loadingTrial,
                trialStatus,
                trialError,
                decrementTrial,
                consumeCredit,
                machineId,
                isLicensed: isPaidLicense,
                freeTrial: {
                    ...freeTrial,
                    isEligible: !isPaidLicense,
                    remaining: exportsLeft,
                },
            }}
        >
            {children}
        </TrialContext.Provider>
    );
}

export function useSecureTrial() {
    return useContext(TrialContext);
}

