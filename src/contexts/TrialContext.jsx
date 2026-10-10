import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    serverTimestamp,
} from "firebase/firestore";

const TrialContext = createContext();

export function TrialProvider({ children }) {
    const [exportsLeft, setExportsLeft] = useState(0);
    const [loadingTrial, setLoadingTrial] = useState(true);
    const [machineId, setMachineId] = useState(null);
    const [isLicensed, setIsLicensed] = useState(false);
    const [trialStatus, setTrialStatus] = useState("loading");

    useEffect(() => {
        const initTrial = async () => {
            if (!window.electronAPI || !window.electronAPI.getMachineId) {
                setTrialStatus("ready");
                setLoadingTrial(false);
                return;
            }

            try {
                if (window.electronAPI.checkLicense) {
                    const lic = await window.electronAPI.checkLicense();
                    if (lic && lic.activated) {
                        setIsLicensed(true);
                        setTrialStatus("ready");
                        setLoadingTrial(false);
                        return;
                    }
                }

                const hwid = await window.electronAPI.getMachineId();
                setMachineId(hwid);

                if (navigator.onLine) {
                    const docRef = doc(db, "trial_users", hwid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        setExportsLeft(docSnap.data().exportsLeft || 0);
                    } else {
                        // Create new trial document
                        await setDoc(docRef, {
                            exportsLeft: 5,
                            firstSeen: serverTimestamp(),
                        });
                        setExportsLeft(5);
                    }
                }
                setTrialStatus("ready");
            } catch (err) {
                console.error("Failed to initialize trial system:", err);
                setTrialStatus("error");
            } finally {
                setLoadingTrial(false);
            }
        };

        initTrial();
    }, []);

    const decrementTrial = async () => {
        if (!machineId || !navigator.onLine || isLicensed || exportsLeft <= 0)
            return false;

        try {
            const docRef = doc(db, "trial_users", machineId);
            await updateDoc(docRef, {
                exportsLeft: increment(-1),
            });
            setExportsLeft((prev) => Math.max(0, prev - 1));
            return true;
        } catch (err) {
            console.error("Failed to decrement trial exports:", err);
            return false;
        }
    };

    return (
        <TrialContext.Provider
            value={{
                exportsLeft,
                loadingTrial,
                trialStatus,
                decrementTrial,
                machineId,
                isLicensed,
            }}
        >
            {children}
        </TrialContext.Provider>
    );
}

export function useSecureTrial() {
    return useContext(TrialContext);
}
