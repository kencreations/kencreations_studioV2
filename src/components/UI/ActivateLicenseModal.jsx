import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { activateLicense } from "../../services/LicenseService";
import { useAuth } from "../../contexts/AuthContext";

export default function ActivateLicenseModal({ isOpen, onClose }) {
    const { currentUser, fetchUserData } = useAuth();
    const [licenseKey, setLicenseKey] = useState("");
    const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState("");

    if (!isOpen) return null;

    const handleActivate = async () => {
        if (!licenseKey.trim() || status === "loading") return;
        
        setStatus("loading");
        setErrorMessage("");

        const result = await activateLicense(licenseKey.trim(), currentUser);

        if (result.success) {
            setStatus("success");
            
            // Re-fetch user data to update the UI globally and hide the Activate button
            if (fetchUserData && currentUser?.uid) {
                try { await fetchUserData(currentUser.uid); } catch {
                    setStatus("error");
                    setErrorMessage("Activation was saved, but access could not yet be verified. Check your connection and retry.");
                    return;
                }
            }

            setTimeout(() => {
                onClose();
                setStatus("idle");
                setLicenseKey("");
            }, 1500);
        } else {
            setStatus("error");
            setErrorMessage(result.message);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl transition-all my-auto">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-slate-900">Enter License Code</h2>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                    Enter your purchased license or 7-Day Pro Beta Trial code. Beta access starts when activation succeeds.
                </p>

                <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => {
                        setLicenseKey(e.target.value);
                        if (status === "error") setStatus("idle");
                    }}
                    disabled={status === "loading" || status === "success"}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center font-mono tracking-widest text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-5 disabled:opacity-60 uppercase"
                    onKeyDown={(e) => e.key === 'Enter' && licenseKey.trim() && handleActivate()}
                />
                
                {status === "error" && (
                    <p className="text-red-500 text-xs font-bold -mt-3 mb-4 animate-in fade-in slide-in-from-top-1 text-center">
                        {errorMessage}
                    </p>
                )}

                <div className="flex justify-center h-[52px]">
                    <button
                        onClick={handleActivate}
                        disabled={!licenseKey.trim() || status === "loading" || status === "success"}
                        className={`relative flex items-center justify-center text-white font-semibold shadow-md transition-all duration-300 ease-in-out active:scale-[0.98] ${
                            status === "success"
                                ? "bg-green-500 w-[52px] h-[52px] rounded-full cursor-default active:scale-100"
                                : status === "loading"
                                ? "bg-teal-600 w-[52px] h-[52px] rounded-full cursor-wait active:scale-100"
                                : "bg-teal-600 hover:bg-teal-700 w-full py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                        }`}
                    >
                        {status === "idle" || status === "error" ? (
                            <span className="animate-in fade-in zoom-in duration-300">Activate Now</span>
                        ) : status === "loading" ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            <svg className="w-6 h-6 text-white animate-in zoom-in duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
