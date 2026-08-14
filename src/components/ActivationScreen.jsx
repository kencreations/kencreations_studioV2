import React, { useState, useEffect, useCallback } from 'react';

// Hardcoded secret for the client side validation.
// NOTE: This is only used as a fallback. The primary validation is now done
// via ipcRenderer → main.cjs → licenseManager.cjs (RSA + Firebase).
// This HMAC path is kept only for the web dev environment.
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

// ── Activation Step Types ────────────────────────────────────────────────────
// 'idle' | 'activating' | 'success' | 'error'

export default function ActivationScreen({ onActivate }) {
    const [hwid, setHwid] = useState('');
    const [inputKey, setInputKey] = useState('');
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

    // ── Online activation via Firebase REST ────────────────────────────────
    const handleOnlineActivate = async () => {
        if (!inputKey.trim()) {
            setMessage('Please enter a license key.');
            setStatus('error');
            return;
        }

        setStatus('activating');
        setMessage('Verifying with server...');

        try {
            if (isDesktop) {
                const result = await window.electronAPI.activateWithKey(inputKey.trim());
                if (result.success) {
                    setStatus('success');
                    setMessage(result.message || 'License activated successfully!');
                    setTimeout(() => onActivate(result.entitlements || []), 1000);
                } else {
                    setStatus('error');
                    setMessage(result.message || 'Activation failed. Please try again.');
                }
            } else {
                // Web dev fallback — HMAC check
                const expectedKey = await hashHMAC(hwid);
                if (inputKey.trim() === expectedKey) {
                    setStatus('success');
                    setMessage('License activated (dev mode).');
                    setTimeout(() => onActivate([]), 1000);
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

    // ── Offline .lic file loader ───────────────────────────────────────────
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
                setTimeout(() => onActivate(result.entitlements || []), 1000);
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

    return (
        <div className="min-h-screen w-screen overflow-hidden font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fff0e5] via-teal-100 to-[#00A3A3] flex items-center justify-center p-4">

            {/* Logo */}
            <div className="absolute top-6 left-6 flex items-center space-x-2">
                <div className="text-xl font-black tracking-tighter">
                    <span className="text-gray-900">K</span>
                    <span className="text-gray-900">C</span>
                    <span className="ml-2 text-gray-900 font-bold tracking-normal text-lg">
                        KENCREATIONS
                    </span>
                </div>
                <span className="text-xs bg-white/40 backdrop-blur-md text-gray-800 font-bold px-2 py-0.5 rounded-full border border-white/50">
                    PRO EDITION
                </span>
            </div>

            {/* Activation Card */}
            <div className="bg-white/40 backdrop-blur-2xl p-10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] max-w-lg w-full border border-white/50 relative">

                {/* Badge */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl text-gray-800 text-xs font-semibold px-4 py-1.5 rounded-full border border-white shadow-xl shadow-teal-900/10 flex items-center gap-2 whitespace-nowrap">
                    <span className="text-lg leading-none">🔒</span>
                    Activation Required
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 mb-2 text-center tracking-tight">
                    Unlock Studio
                </h1>
                <p className="text-center text-gray-700 font-medium text-sm mb-8">
                    Share your Hardware ID with the developer to receive your license key,
                    or load an offline <code className="bg-white/50 px-1 rounded">.lic</code> file.
                </p>

                {/* HWID Display */}
                <div className="mb-6">
                    <label className="block text-gray-900 text-sm font-bold mb-2">
                        Your Hardware ID
                    </label>
                    <div className="bg-white/60 p-3.5 rounded-xl text-teal-900 font-mono text-xs break-all border border-white/80 shadow-inner flex flex-col gap-3">
                        <span className="select-all block leading-relaxed">
                            {hwid || 'Loading...'}
                        </span>
                        <button
                            onClick={handleCopyHwid}
                            disabled={!hwid}
                            className="self-end text-xs font-bold text-gray-800 bg-white/80 hover:bg-white active:scale-95 px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {copied ? '✅ Copied!' : '📋 Copy HWID'}
                        </button>
                    </div>
                </div>

                {/* License Key Input */}
                <div className="mb-4">
                    <label className="block text-gray-900 text-sm font-bold mb-2">
                        License Key
                    </label>
                    <input
                        type="text"
                        value={inputKey}
                        onChange={(e) => { setInputKey(e.target.value); setStatus('idle'); setMessage(''); }}
                        disabled={isActivating}
                        className="w-full bg-white/60 text-gray-900 border border-white/80 rounded-xl p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-inner placeholder-gray-500 disabled:opacity-60"
                        placeholder="KC-XXXXXX or paste your full key..."
                        onKeyDown={(e) => e.key === 'Enter' && handleOnlineActivate()}
                    />
                </div>

                {/* Status / Error Message */}
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

                {/* Activate Online Button */}
                <button
                    onClick={handleOnlineActivate}
                    disabled={isActivating}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-4 rounded-xl shadow-xl shadow-teal-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-lg mb-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                    {isActivating ? (
                        <>
                            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        <>Activate Online ✨</>
                    )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-white/50" />
                    <span className="text-xs text-gray-500 font-semibold">OR</span>
                    <div className="flex-1 h-px bg-white/50" />
                </div>

                {/* Load Offline License Button */}
                <button
                    onClick={handleLoadOfflineLicense}
                    disabled={isActivating || !isDesktop}
                    className="w-full bg-white/50 hover:bg-white/70 text-gray-900 font-bold py-3.5 px-4 rounded-xl border border-white/60 shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                    📁 Load Offline License (.lic)
                </button>

                {!isDesktop && (
                    <p className="text-center text-xs text-gray-500 mt-3">
                        Offline license loading requires the desktop app.
                    </p>
                )}
            </div>
        </div>
    );
}
