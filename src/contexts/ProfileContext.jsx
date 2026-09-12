import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { BUNDLED_FONTS } from "../utils/fontManager";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useSecureTrial } from "./TrialContext";

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
    const [profile, setProfile] = useState({
        username: "User",
        total_exports: 0,
    });
    const [customFonts, setCustomFonts] = useState([]);
    const [customColors, setCustomColors] = useState([]);
    const [loading, setLoading] = useState(true);
    const { machineId } = useSecureTrial();

    const allFonts = useMemo(
        () => [...BUNDLED_FONTS, ...customFonts],
        [customFonts],
    );

    const loadData = useCallback(async () => {
        try {
            if (!window.electronAPI) return;
            const [prof, fonts] = await Promise.all([
                window.electronAPI.getProfile(),
                window.electronAPI.getCustomFonts(),
            ]);
            if (prof) setProfile(prof);
            if (fonts) {
                setCustomFonts(
                    fonts.map((f) => {
                        const filePath = f.file_path || f.filePath || null;
                        const name = f.font_name || f.name || "";
                        const baseName =
                            name.replace(/\.[^/.]+$/, "") ||
                            filePath ||
                            "custom-font";
                        const safeId = String(f.id ?? baseName);
                        return {
                            id: safeId,
                            label: name
                                .replace(/\.[^/.]+$/, "")
                                .replace(/_/g, " "),
                            filePath,
                            file_path: filePath,
                            rowId: Number(f.id) || null,
                            isCustom: true,
                        };
                    }),
                );
            }
        } catch (err) {
            console.error("Failed to load profile data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Firestore custom colors sync
    useEffect(() => {
        if (!machineId) return;

        const unsubscribe = onSnapshot(
            doc(db, "users", machineId),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.customColors && Array.isArray(data.customColors)) {
                        setCustomColors(
                            data.customColors.map((c) => ({
                                ...c,
                                hex_code:
                                    c.hex_code?.length > 7
                                        ? c.hex_code.substring(0, 7)
                                        : c.hex_code,
                            }))
                        );
                    } else {
                        setCustomColors([]);
                    }
                } else {
                    setCustomColors([]);
                }
            },
            (err) => {
                console.error("Failed to sync custom colors:", err);
            }
        );

        return () => unsubscribe();
    }, [machineId]);

    const updateUsername = async (username) => {
        if (!window.electronAPI) return;
        await window.electronAPI.updateProfile(username);
        setProfile((p) => ({ ...p, username }));
    };

    const incrementExports = async () => {
        if (!window.electronAPI) return;
        await window.electronAPI.incrementExports();
        setProfile((p) => ({ ...p, total_exports: p.total_exports + 1 }));
    };

    const uploadFont = async () => {
        if (!window.electronAPI) return;
        const res = await window.electronAPI.uploadCustomFont();
        if (res.success && res.font) {
            const filePath = res.font.file_path || res.font.filePath || null;
            const baseName =
                res.font.font_name.replace(/\.[^/.]+$/, "") ||
                filePath ||
                "custom-font";
            const safeId = String(res.font.id ?? baseName);
            setCustomFonts((prev) => [
                {
                    id: safeId,
                    label: res.font.font_name
                        .replace(/\.[^/.]+$/, "")
                        .replace(/_/g, " "),
                    filePath,
                    file_path: filePath,
                    rowId: Number(res.font.id) || null,
                    isCustom: true,
                },
                ...prev,
            ]);
        }
        return res;
    };

    const removeFont = async (font) => {
        if (!window.electronAPI) return;
        const rowId = Number(font?.rowId ?? font?.id ?? 0);
        if (!rowId && !font?.filePath && !font?.file_path) return;

        await (window.electronAPI.removeCustomFont?.(rowId || font?.id) ??
            window.electronAPI.deleteCustomFont?.(rowId || font?.id));

        setCustomFonts((prev) =>
            prev.filter((f) => {
                const currentRowId = Number(f.rowId ?? f.id ?? 0);
                return currentRowId !== rowId && f.id !== font?.id;
            }),
        );
    };

    const addColor = async (colorName, hexCode, brand) => {
        if (!machineId) return { success: false, error: "No user identified" };
        const cleanHex =
            hexCode?.length > 7 ? hexCode.substring(0, 7) : hexCode;
        
        const newColor = {
            id: Date.now().toString(),
            color_name: colorName,
            hex_code: cleanHex,
            brand: brand || "Custom",
        };

        try {
            await updateDoc(doc(db, "users", machineId), {
                customColors: arrayUnion(newColor)
            });
            return { success: true, color: newColor };
        } catch (err) {
            if (err.code === "not-found") {
                // Document doesn't exist, try to set it
                const { setDoc } = require("firebase/firestore");
                await setDoc(doc(db, "users", machineId), {
                    customColors: [newColor]
                });
                return { success: true, color: newColor };
            }
            console.error("Failed to add custom color:", err);
            return { success: false, error: err.message };
        }
    };

    const removeColor = async (id) => {
        if (!machineId) return;
        const colorToRemove = customColors.find(c => c.id === id);
        if (!colorToRemove) return;

        try {
            await updateDoc(doc(db, "users", machineId), {
                customColors: arrayRemove(colorToRemove)
            });
        } catch (err) {
            console.error("Failed to remove custom color:", err);
        }
    };

    return (
        <ProfileContext.Provider
            value={{
                profile,
                customFonts,
                allFonts,
                customColors,
                loading,
                updateUsername,
                incrementExports,
                uploadFont,
                removeFont,
                addColor,
                removeColor,
            }}
        >
            {children}
        </ProfileContext.Provider>
    );
}

export const useProfile = () => {
    return useContext(ProfileContext);
};
