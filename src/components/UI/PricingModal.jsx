import React, { useState, useEffect, useCallback } from "react";
import GlassModal from "./GlassModal";
import LegalModal from "./LegalModal";
import mockBootstrap from "../../data/mockBootstrap.json";

const SECRET_KEY = "kencreations_secret_license_key_2026";

async function hashHMAC(hwid) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(SECRET_KEY),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(hwid));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function PricingModal({ isOpen, onClose, pricingTiers = [] }) {
    const [isActivatingView, setIsActivatingView] = useState(false);
    const [licenseKey, setLicenseKey] = useState("");
    const [legalAgreed, setLegalAgreed] = useState(false);
    const [legalDoc, setLegalDoc] = useState(null);

    const [hwid, setHwid] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'activating' | 'success' | 'error'
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

    const isDesktop = !!window.electronAPI;

    useEffect(() => {
        const loadHwid = async () => {
            if (window.electronAPI) {
                try {
                    const id = await window.electronAPI.getHwid();
                    setHwid(id);
                } catch {
                    setHwid('HWID-UNAVAILABLE');
                }
            } else {
                setHwid('WEB-DEV-ENVIRONMENT');
            }
        };
        loadHwid();
    }, []);

    const handleCopyHwid = useCallback(() => {
        if (!hwid) return;
        navigator.clipboard.writeText(hwid).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [hwid]);

    if (!isOpen) return null;

    const handlePurchaseClick = () => {
        // Trigger Electron IPC to open Facebook Messenger
        const url = `https://www.facebook.com/kenjovenie.samonte?ref=plan_${selectedPlan}`;
        if (window.electronAPI && window.electronAPI.openExternalUrl) {
            window.electronAPI.openExternalUrl(url);
        } else {
            // Fallback for purely web/dev environments
            window.open(url, "_blank");
        }
    };

    const handleOnlineActivate = async () => {
        if (!licenseKey.trim()) {
            setMessage('Please enter a license key.');
            setStatus('error');
            return;
        }

        setStatus('activating');
        setMessage('Verifying with server...');

        try {
            if (isDesktop) {
                const result = await window.electronAPI.activateWithKey(licenseKey.trim());
                if (result.success) {
                    setStatus('success');
                    setMessage(result.message || 'License activated successfully!');
                    setTimeout(() => {
                        onClose();
                        window.location.reload();
                    }, 1000);
                } else {
                    setStatus('error');
                    setMessage(result.message || 'Activation failed. Please try again.');
                }
            } else {
                // Web dev fallback — HMAC check
                const expectedKey = await hashHMAC(hwid);
                if (licenseKey.trim() === expectedKey) {
                    setStatus('success');
                    setMessage('License activated (dev mode).');
                    setTimeout(() => {
                        onClose();
                        window.location.reload();
                    }, 1000);
                } else {
                    setStatus('error');
                    setMessage('Invalid license key. Please check and try again.');
                }
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setMessage('An unexpected error occurred during activation.');
        }
    };

    const handleLoadOfflineLicense = async () => {
        if (!isDesktop) {
            setMessage('Offline license loading is only available in the desktop app.');
            setStatus('error');
            return;
        }

        setStatus('activating');
        setMessage('Loading license file...');

        try {
            const result = await window.electronAPI.loadOfflineLicense();
            if (result.success) {
                setStatus('success');
                setMessage(result.message || 'License file verified successfully!');
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 1000);
            } else {
                setStatus('error');
                setMessage(result.message || 'Failed to load license file.');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setMessage('An unexpected error occurred while reading the license file.');
        }
    };
    const isActivating = status === 'activating';

    // Fallback if no pricing passed yet
    const displayTiers = pricingTiers.length > 0 ? pricingTiers : mockBootstrap.pricing;

    return (
        <>
            <GlassModal
                isOpen={true}
                onClose={onClose}
                title={
                    isActivatingView ? "Activate License" : "Upgrade to Studio Pro"
                }>
                {!isActivatingView ? (
                    // VIEW A: Sales Pitch & Pricing Grid
                    <div className="flex flex-col">
                        <div className="text-center mb-10 mt-4">
                            <h2 className="text-3xl font-black text-gray-900 mb-3">Unlock Kencreations Studio</h2>
                            <p className="text-gray-500">Get unlimited access to commercial 3D generators.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayTiers.map((tier) => (
                                <div key={tier.tier_id} className="border border-gray-200 rounded-2xl p-6 flex flex-col hover:border-teal-500 transition-colors bg-white">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{tier.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-6">
                                        <span className="text-3xl font-black text-secondary">{tier.price_formatted}</span>
                                        <span className="text-sm font-semibold text-gray-500">{tier.suffix}</span>
                                    </div>
                                    <ul className="space-y-3 mb-8 flex-grow">
                                        {tier.features?.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 font-medium">
                                                <span className="text-secondary font-bold">✓</span> {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    <button 
                                        onClick={handlePurchaseClick}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-secondary transition-colors">
                                        Select Plan
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-8 text-center border-t border-gray-200 pt-6">
                            <button
                                onClick={() => setIsActivatingView(true)}
                                className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
                                I already have a license key
                            </button>
                        </div>
                    </div>
                ) : (
                    // VIEW B: Activation Form
                    <div className="max-w-md mx-auto w-full py-8">
                        <button
                            onClick={() => setIsActivatingView(false)}
                            className="text-sm font-bold text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-1 transition-colors">
                            ← Back
                        </button>

                        <h2 className="text-2xl font-black text-gray-900 mb-2">
                            Enter License Key
                        </h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Share your Hardware ID with Ken to receive your license key,
                            or load an offline <code className="bg-gray-100 px-1 rounded">.lic</code> file.
                        </p>

                        {/* HWID Display */}
                        <div className="mb-6">
                            <label className="block text-gray-900 text-sm font-bold mb-2">
                                Your Hardware ID
                            </label>
                            <div className="bg-gray-100 p-3.5 rounded-xl text-teal-900 font-mono text-xs break-all border border-gray-200 shadow-inner flex flex-col gap-3">
                                <span className="select-all block leading-relaxed">
                                    {hwid || 'Loading...'}
                                </span>
                                <button
                                    onClick={handleCopyHwid}
                                    disabled={!hwid}
                                    className="self-end text-xs font-bold text-gray-800 bg-white hover:bg-gray-50 active:scale-95 px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {copied ? '✅ Copied!' : '📋 Copy HWID'}
                                </button>
                            </div>
                        </div>

                        <label className="block text-gray-900 text-sm font-bold mb-2">
                            License Key
                        </label>
                        <input
                            type="text"
                            value={licenseKey}
                            onChange={(e) => {
                                setLicenseKey(e.target.value);
                                setStatus('idle');
                                setMessage('');
                            }}
                            disabled={isActivating}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 font-mono tracking-widest outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 mb-6 disabled:opacity-60"
                            onKeyDown={(e) => e.key === 'Enter' && legalAgreed && licenseKey.trim() && handleOnlineActivate()}
                        />

                        {/* CRITICAL REQUIREMENT: Legal Checkbox */}
                        <div className="flex items-start gap-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <input
                                type="checkbox"
                                id="legal-agree"
                                checked={legalAgreed}
                                onChange={(e) =>
                                    setLegalAgreed(e.target.checked)
                                }
                                className="mt-1 w-5 h-5 accent-teal-500 cursor-pointer"
                            />
                            <label
                                htmlFor="legal-agree"
                                className="text-xs text-gray-600 leading-relaxed cursor-pointer select-none">
                                I have read and agree to the{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc("terms");
                                    }}
                                    className="text-teal-600 font-bold hover:underline">
                                    Terms & Conditions
                                </button>
                                ,{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc("privacy");
                                    }}
                                    className="text-teal-600 font-bold hover:underline">
                                    Privacy Policy
                                </button>
                                , and{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc("refund");
                                    }}
                                    className="text-teal-600 font-bold hover:underline">
                                    Refund Policy
                                </button>
                                .
                            </label>
                        </div>

                        {message && (
                            <div className={`px-4 py-3 rounded-xl text-sm font-semibold mb-4 text-center transition-all ${
                                status === 'error'
                                    ? 'bg-red-100/80 border border-red-200 text-red-700'
                                    : status === 'success'
                                    ? 'bg-green-100/80 border border-green-200 text-green-700'
                                    : 'bg-blue-100/80 border border-blue-200 text-blue-700'
                            }`}>
                                {status === 'activating' && (
                                    <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                                )}
                                {message}
                            </div>
                        )}

                        <button
                            onClick={handleOnlineActivate}
                            disabled={!legalAgreed || !licenseKey.trim() || isActivating}
                            className={`w-full font-bold py-4 rounded-xl shadow-md transition-all text-lg mb-3 flex items-center justify-center gap-2 ${
                                legalAgreed && licenseKey.trim() && !isActivating
                                    ? "bg-secondary hover:bg-teal-600 text-white"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}>
                            {isActivating ? (
                                <>
                                    <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                "Activate Software"
                            )}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400 font-semibold">OR</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Load Offline License Button */}
                        <button
                            onClick={handleLoadOfflineLicense}
                            disabled={isActivating || !isDesktop}
                            className="w-full bg-white hover:bg-gray-50 text-gray-900 font-bold py-3.5 px-4 rounded-xl border border-gray-300 shadow-sm transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            📁 Load Offline License (.lic)
                        </button>
                    </div>
                )}
            </GlassModal>

            {/* Render nested LegalModal if a link is clicked */}
            <LegalModal
                isOpen={!!legalDoc}
                documentType={legalDoc}
                onClose={() => setLegalDoc(null)}
            />
        </>
    );
}
