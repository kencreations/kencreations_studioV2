import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "../contexts/ProfileContext";
import {
    doc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

// ─── Upload Result Modal ───────────────────────────────────────────────────────
function FontUploadModal({ result, onClose }) {
    // Auto-dismiss after 3 seconds on success
    useEffect(() => {
        if (!result?.success) return;
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [result, onClose]);

    if (!result) return null;
    const isSuccess = result.success;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-[fadeInUp_0.2s_ease] relative">
                {/* X close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>

                {/* Badge */}
                <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${isSuccess ? "bg-green-100" : "bg-red-100"}`}>
                    {isSuccess ? (
                        <svg
                            className="w-8 h-8 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    ) : (
                        <svg
                            className="w-8 h-8 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    )}
                </div>

                {isSuccess ? (
                    <>
                        <h3 className="text-xl font-black text-gray-900 mb-1">
                            Font Installed!
                        </h3>
                        <p className="text-sm font-bold text-gray-700 mb-1 truncate max-w-[240px]">
                            {result.font?.font_name}
                        </p>
                        <p className="text-xs text-gray-400 font-medium mb-5">
                            Successfully installed across all 3D Editors
                        </p>
                        <div className="w-full bg-green-50 rounded-xl px-4 py-2.5 text-xs font-mono text-green-700 text-left break-all mb-6">
                            {result.font?.file_path}
                        </div>
                    </>
                ) : (
                    <>
                        <h3 className="text-xl font-black text-gray-900 mb-2">
                            Upload Failed
                        </h3>
                        <p className="text-sm text-red-500 font-semibold mb-6">
                            {result.message || "An unknown error occurred."}
                        </p>
                    </>
                )}

                <button
                    onClick={onClose}
                    className={`w-full py-3 rounded-2xl font-bold text-white transition-all ${isSuccess ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                    {isSuccess ? "Awesome!" : "Got it"}
                </button>
            </div>
        </div>
    );
}

export default function Profile() {
    const navigate = useNavigate();
    const {
        profile,
        customFonts,
        allFonts,
        customColors,
        loading,
        updateUsername,
        uploadFont,
        removeFont,
        addColor,
        removeColor,
    } = useProfile();

    const [editName, setEditName] = useState(false);
    const [tempName, setTempName] = useState("");

    const [colorName, setColorName] = useState("");
    // Default to a clean 6-digit hex to prevent any WebGL crashes
    const [hexCode, setHexCode] = useState("#FF6B00");
    const [brand, setBrand] = useState("Custom");

    // Font upload modal state
    const [uploadResult, setUploadResult] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const [license, setLicense] = useState(null);
    const [totalExports, setTotalExports] = useState(0);

    const [disable3D, setDisable3D] = useState(false);

    useEffect(() => {
        if (window.electronAPI?.checkLicense) {
            window.electronAPI.checkLicense().then((res) => setLicense(res));
        }
        if (window.electronAPI?.getTotalExports) {
            window.electronAPI
                .getTotalExports()
                .then((count) => setTotalExports(count));
        }

        // Load preferences on mount
        const saved3D = localStorage.getItem("kc_pref_disable_3d") === "true";

        setDisable3D(saved3D);
    }, []);

    const handleToggle3D = () => {
        const newVal = !disable3D;
        setDisable3D(newVal);
        localStorage.setItem("kc_pref_disable_3d", newVal.toString());
    };

    if (loading)
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );

    const handleSaveName = async () => {
        const newName = tempName.trim();
        if (newName) {
            updateUsername(newName);

            try {
                // Fetch the user's active license key from local storage
                const activeKey =
                    localStorage.getItem("kc_license_key") ||
                    localStorage.getItem("kc_pro_license");

                if (activeKey) {
                    // Find the license in Firebase and update it so the Admin Panel sees it
                    const q = query(
                        collection(db, "licenses"),
                        where("key", "==", activeKey),
                    );
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const licenseDoc = snapshot.docs[0];
                        await updateDoc(doc(db, "licenses", licenseDoc.id), {
                            user_name: newName,
                            name: newName,
                        });
                        console.log("Successfully synced name to Admin Panel!");
                    }
                }
            } catch (error) {
                console.error("Failed to sync name to database:", error);
            }
        }
        setEditName(false);
    };

    const handleAddColor = (e) => {
        e.preventDefault();
        if (colorName.trim() && hexCode) {
            // Strip alpha channel if present (e.g. #RRGGBBAA → #RRGGBB)
            const cleanHex =
                hexCode.length > 7 ? hexCode.substring(0, 7) : hexCode;
            addColor(colorName.trim(), cleanHex, brand.trim() || "Custom");
            setColorName("");
            setBrand("Custom");
        }
    };

    const handleUploadFont = async () => {
        setIsUploading(true);
        try {
            const result = await uploadFont();
            if (result) {
                setUploadResult(result);
                // Fire-and-forget: increment Firestore font count for the admin dashboard.
                // Wrapped in its own try/catch so any IPC failure (e.g. handler not registered,
                // offline) NEVER overwrites the upload success modal.
                if (result.success) {
                    try {
                        await window.electronAPI?.incrementCustomFonts?.();
                    } catch (metricErr) {
                        console.warn(
                            "[Profile] Firestore font count increment failed (non-fatal):",
                            metricErr.message,
                        );
                    }
                }
            }
        } catch (err) {
            setUploadResult({ success: false, message: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    // Sanitize a color for display: strip alpha if 8-char hex
    const sanitizeHex = (hex) => (hex?.length > 7 ? hex.substring(0, 7) : hex);

    return (
        // 1. THIS BREAKS OUT OF PARENT CONSTRAINTS AND FORCES SCROLLING
        <div className="absolute inset-0 z-[100] overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fff0e5] via-teal-100 to-[#00A3A3]">
            {/* 2. THIS CONSTRAINS THE WIDTH SO CARDS DON'T STRETCH */}
            <div className="max-w-4xl mx-auto px-6 pt-12 pb-32">
                {/* Profile Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-white/50 hover:bg-white rounded-full shadow-sm transition-colors">
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        Your Profile
                    </h1>
                </div>

                {/* 3. ADD THIS WRAPPER TO FIX THE "YUCK" SPACING */}
                <div className="flex flex-col gap-6">
                    {/* Profile Overview */}
                    <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                {editName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={tempName}
                                            onChange={(e) =>
                                                setTempName(e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                                e.key === "Enter" &&
                                                handleSaveName()
                                            }
                                            className="text-2xl font-bold bg-white/50 border border-gray-300 rounded-lg px-3 py-1 outline-none focus:border-primary"
                                        />
                                        <button
                                            onClick={handleSaveName}
                                            className="text-primary hover:text-orange-700 font-semibold text-sm bg-primary/10 px-3 py-1.5 rounded-lg">
                                            Save
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-2xl font-bold text-gray-900">
                                            {profile.username}
                                        </h2>
                                        <button
                                            onClick={() => {
                                                setTempName(profile.username);
                                                setEditName(true);
                                            }}
                                            className="text-gray-400 hover:text-primary transition-colors">
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                                />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                            <p className="text-gray-500 font-medium">
                                Desktop Creator
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-black text-primary">
                                {totalExports}
                            </div>
                            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mt-1">
                                Total Exports
                            </div>
                        </div>
                    </div>

                    {/* Subscription Status */}
                    {license && (
                        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {license.activated
                                            ? "Studio Pro"
                                            : "Free Tier"}
                                    </h2>
                                    {license.activated && (
                                        <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                            {license.plan_type === "lifetime"
                                                ? "Lifetime VIP"
                                                : "Active"}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-500 font-medium">
                                    {license.activated
                                        ? license.plan_type === "lifetime"
                                            ? "Perpetual access to all exclusive generators."
                                            : `Your subscription is active. Expires: ${license.expires_at ? new Date(license.expires_at).toLocaleDateString() : "N/A"}`
                                        : "Upgrade to VIP to unlock all commercial 3D generators."}
                                </p>
                            </div>
                            {!license.activated && (
                                <Link
                                    to="/"
                                    className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-colors">
                                    Upgrade Now
                                </Link>
                            )}
                        </div>
                    )}

                    {/* App Preferences Section */}
                    <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">
                            App Preferences
                        </h3>

                        <div className="space-y-4">
                            {/* 3D Background Toggle */}
                            <div className="flex items-center justify-between p-5 bg-white/50 rounded-2xl border border-white/50 shadow-sm">
                                <div>
                                    <p className="font-bold text-gray-800">
                                        Disable 3D Background
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Turn off the interactive home background
                                        to save battery and system resources.
                                    </p>
                                </div>
                                <button
                                    onClick={handleToggle3D}
                                    className={`w-14 h-7 rounded-full transition-colors relative ${disable3D ? "bg-primary" : "bg-gray-300"}`}>
                                    <div
                                        className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${disable3D ? "left-8" : "left-1"}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Fonts List */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 flex flex-col h-[400px]">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">
                                        Your Fonts
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium mt-1">
                                        Bundled & Custom (TTF/OTF)
                                    </p>
                                </div>
                                <button
                                    onClick={handleUploadFont}
                                    disabled={isUploading}
                                    className="bg-primary hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm flex items-center gap-2">
                                    {isUploading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                    )}
                                    {isUploading ? "Uploading…" : "Upload Font"}
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                {(() => {
                                    return allFonts.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <svg
                                                className="w-12 h-12 mb-3 opacity-50"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1.5}
                                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                                />
                                            </svg>
                                            <p className="text-sm font-semibold">
                                                No fonts available
                                            </p>
                                        </div>
                                    ) : (
                                        allFonts.map((font, idx) => (
                                            <div
                                                key={`${font.isCustom ? "custom" : "bundled"}-${font.id ?? font.label ?? idx}-${font.filePath ?? font.file_path ?? ""}`}
                                                className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 group">
                                                <div className="flex items-center gap-3 truncate">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold shrink-0">
                                                        Aa
                                                    </div>
                                                    <span className="font-semibold text-gray-700 truncate">
                                                        {font.label}
                                                    </span>
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${font.isCustom ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>
                                                        {font.isCustom
                                                            ? "Custom"
                                                            : "Bundled"}
                                                    </span>
                                                </div>
                                                {font.isCustom && (
                                                    <button
                                                        onClick={() =>
                                                            removeFont(font)
                                                        }
                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                        <svg
                                                            className="w-5 h-5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor">
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                            />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Custom Colors */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 flex flex-col h-[400px]">
                            <h3 className="text-xl font-bold text-gray-900 mb-6">
                                Custom Colors
                            </h3>

                            <form
                                onSubmit={handleAddColor}
                                className="flex flex-col gap-3 mb-6">
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            placeholder="Color name"
                                            value={colorName}
                                            onChange={(e) =>
                                                setColorName(e.target.value)
                                            }
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            placeholder="Brand (e.g. BambuLab)"
                                            value={brand}
                                            onChange={(e) =>
                                                setBrand(e.target.value)
                                            }
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={hexCode}
                                            onChange={(e) => {
                                                // Always strip alpha channel on change — browsers can emit 8-char hex on some systems
                                                const v = e.target.value;
                                                setHexCode(
                                                    v.length > 7
                                                        ? v.substring(0, 7)
                                                        : v,
                                                );
                                            }}
                                            className="w-12 h-[42px] rounded-xl cursor-pointer p-0 border-0 bg-transparent"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!colorName.trim()}
                                        className="bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all">
                                        Add
                                    </button>
                                </div>
                            </form>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                {customColors.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <svg
                                            className="w-12 h-12 mb-3 opacity-50"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                                            />
                                        </svg>
                                        <p className="text-sm font-semibold">
                                            No custom colors yet
                                        </p>
                                    </div>
                                ) : (
                                    customColors.map((color) => (
                                        <div
                                            key={color.id}
                                            className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 group">
                                            <div className="flex items-center gap-3">
                                                {/* Use sanitized hex to prevent WebGL crash on color swatch */}
                                                <div
                                                    className="w-8 h-8 rounded-full shadow-inner border border-black/10"
                                                    style={{
                                                        backgroundColor:
                                                            sanitizeHex(
                                                                color.hex_code,
                                                            ),
                                                    }}
                                                />
                                                <div>
                                                    <div className="font-semibold text-gray-700">
                                                        {color.color_name}
                                                    </div>
                                                    <div className="text-xs text-gray-400 uppercase font-mono">
                                                        {color.brand} ·{" "}
                                                        {sanitizeHex(
                                                            color.hex_code,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    removeColor(color.id)
                                                }
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <svg
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
