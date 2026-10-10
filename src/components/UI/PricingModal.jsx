import { useAuth } from "../../contexts/AuthContext";
import { activateLicense } from "../../services/LicenseService";
import React, { useState, useEffect, useCallback } from "react";
import GlassModal from "./GlassModal";
import LegalModal from "./LegalModal";
import mockBootstrap from "../../data/mockBootstrap.json";

const Checkmark = () => (
    <svg className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default function PricingModal({ isOpen, onClose, pricingTiers = [] }) {
    const { currentUser, loginWithGoogle, fetchUserData } = useAuth();
    const [isActivatingView, setIsActivatingView] = useState(false);
    const [billingCycle, setBillingCycle] = useState('12');
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

    const handlePurchaseClick = (planName = 'studio_pro') => {
        // Trigger Electron IPC to open Facebook Messenger
        const url = `https://www.facebook.com/kenjovenie.samonte?ref=plan_${planName}`;
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
                        window.dispatchEvent(new Event("license-activated"));
                    }, 1000);
                } else {
                    setStatus('error');
                    setMessage(result.message || 'Activation failed. Please try again.');
                }
            } else {
                const user = currentUser || await loginWithGoogle();
                const result = await activateLicense(licenseKey.trim(), user);
                if (!result.success) throw new Error(result.message);
                await fetchUserData(user.uid);
                setStatus('success');
                setMessage('License activated successfully!');
                onClose();
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setMessage(err.message || 'An unexpected error occurred during activation.');
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
                    window.dispatchEvent(new Event("license-activated"));
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full mt-4">
                            
                            {/* Card 1: Subscription */}
                            <div className="relative bg-white border-2 border-teal-500 rounded-2xl p-6 flex flex-col shadow-[0_4px_20px_rgba(20,184,166,0.15)] transform transition-transform hover:-translate-y-1">
                                {billingCycle === '12' && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-[10px] sm:text-xs font-black px-4 py-1 rounded-full shadow-md tracking-wide">
                                        MOST POPULAR
                                    </div>
                                )}
                                <h3 className="text-xl font-black text-gray-900 mb-2 mt-2">Studio Pro</h3>
                                <p className="text-sm text-gray-500 mb-4 h-10">Essential tools for growing your 3D printing business.</p>
                                
                                {/* Billing Toggle inside Card 1 */}
                                <div className="flex justify-center mb-6">
                                    <div className="bg-slate-100 p-1 rounded-full inline-flex relative w-[248px]">
                                        {/* Sliding background */}
                                        <div 
                                            className="absolute top-1 bottom-1 w-[80px] bg-teal-600 rounded-full transition-transform duration-300 ease-in-out shadow-sm"
                                            style={{
                                                transform: `translateX(${
                                                    billingCycle === '1' ? '0px' :
                                                    billingCycle === '6' ? '80px' : '160px'
                                                })`
                                            }}
                                        />
                                        <button onClick={() => setBillingCycle('1')} className={`relative z-10 w-[80px] py-1.5 text-[13px] font-bold transition-colors ${billingCycle === '1' ? 'text-white' : 'text-gray-600'}`}>1 Mo</button>
                                        <button onClick={() => setBillingCycle('6')} className={`relative z-10 w-[80px] py-1.5 text-[13px] font-bold transition-colors ${billingCycle === '6' ? 'text-white' : 'text-gray-600'}`}>6 Mo</button>
                                        <button onClick={() => setBillingCycle('12')} className={`relative z-10 w-[80px] py-1.5 text-[13px] font-bold transition-colors ${billingCycle === '12' ? 'text-white' : 'text-gray-600'}`}>12 Mo</button>
                                    </div>
                                </div>
                                
                                <div className="min-h-[100px] flex flex-col justify-center">
                                    <div className="flex items-baseline gap-1 relative h-10">
                                        <div className="flex items-baseline gap-1 transition-opacity duration-300 w-full">
                                            <span className="text-4xl font-black text-gray-900">
                                                {billingCycle === '1' ? '₱499' : billingCycle === '6' ? '₱2,499' : '₱3,999'}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-500">
                                                {billingCycle === '1' ? '/ mo' : billingCycle === '6' ? '/ 6-mos' : '/ yr'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-8 mt-2">
                                        {billingCycle === '6' && (
                                            <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                                                Save 16% (₱495)
                                            </span>
                                        )}
                                        {billingCycle === '12' && (
                                            <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                                                Save 33% (₱1,989)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <ul className="space-y-3 mb-8 mt-4 flex-grow">
                                    {[
                                        "Unlimited STL & 3MF Exports",
                                        "Commercial Printing License",
                                        "Access to all standard generators",
                                        "Priority support access"
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                                            <Checkmark /> <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={() => handlePurchaseClick('studio_pro')} className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors shadow-sm">
                                    Select Plan
                                </button>
                            </div>

                            {/* Card 2: Lifetime */}
                            <div className="relative bg-white border border-gray-200 rounded-2xl p-6 flex flex-col hover:border-teal-300 hover:shadow-xl transition-all hover:-translate-y-1">
                                <h3 className="text-xl font-black text-gray-900 mb-2 mt-2">Studio Pro (Lifetime)</h3>
                                <p className="text-sm text-gray-500 mb-4 h-10">Pay once, use forever. Best long-term value.</p>
                                
                                <div className="min-h-[100px] flex flex-col justify-center">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-gray-900">₱5,999</span>
                                        <span className="text-sm font-semibold text-gray-500">/ once</span>
                                    </div>
                                    <div className="h-8 mt-2" />
                                </div>
                                
                                <ul className="space-y-3 mb-8 mt-4 flex-grow">
                                    {[
                                        "Everything in Studio Pro",
                                        "No recurring billing",
                                        "Free future standard updates",
                                        "Lifetime Commercial License"
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                                            <Checkmark /> <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={() => handlePurchaseClick('lifetime')} className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors shadow-sm">
                                    Upgrade Now
                                </button>
                            </div>

                            {/* Card 3: VIP */}
                            <div className="relative bg-slate-900 rounded-2xl p-6 flex flex-col shadow-2xl border border-slate-700 transform transition-transform hover:-translate-y-1">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-400 to-teal-500 text-slate-900 text-[10px] sm:text-xs font-black px-4 py-1 rounded-full shadow-md tracking-wide whitespace-nowrap">
                                    ULTIMATE VALUE
                                </div>
                                <h3 className="text-xl font-black text-white mb-2 mt-2">Studio Pro VIP</h3>
                                <p className="text-sm text-slate-400 mb-4 h-10">All exclusive tools + VIP access.</p>
                                
                                <div className="min-h-[100px] flex flex-col justify-center">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-white">₱8,999</span>
                                        <span className="text-sm font-semibold text-slate-400">/ once</span>
                                    </div>
                                    <div className="h-8 mt-2" />
                                </div>
                                
                                <ul className="space-y-3 mb-8 mt-4 flex-grow">
                                    {[
                                        "Everything in Lifetime",
                                        "Access to ALL Exclusive Generators",
                                        "VIP Discord Role & Channel",
                                        "Direct designer requests"
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300 font-medium">
                                            <Checkmark /> <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={() => handlePurchaseClick('vip')} className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-xl font-black transition-colors shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                                    Upgrade Now
                                </button>
                            </div>

                        </div>
                        
                        <div className="mt-8 text-center pt-6 space-y-4">
                            <button onClick={() => handlePurchaseClick('single_exclusive')} className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors underline decoration-gray-300 underline-offset-4">
                                Want a single exclusive generator? Buy one for ₱2,999
                            </button>
                            <br />
                            <button
                                onClick={() => setIsActivatingView(true)}
                                className="text-sm font-bold text-teal-600 hover:text-teal-700 transition-colors">
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
