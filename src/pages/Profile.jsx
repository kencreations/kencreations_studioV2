import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';

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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Badge */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isSuccess ? (
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                </div>

                {isSuccess ? (
                    <>
                        <h3 className="text-xl font-black text-gray-900 mb-1">Font Installed!</h3>
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
                        <h3 className="text-xl font-black text-gray-900 mb-2">Upload Failed</h3>
                        <p className="text-sm text-red-500 font-semibold mb-6">
                            {result.message || 'An unknown error occurred.'}
                        </p>
                    </>
                )}

                <button
                    onClick={onClose}
                    className={`w-full py-3 rounded-2xl font-bold text-white transition-all ${isSuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                    {isSuccess ? 'Awesome!' : 'Got it'}
                </button>
            </div>
        </div>
    );
}

export default function Profile() {
    const {
        profile,
        customFonts,
        customColors,
        loading,
        updateUsername,
        uploadFont,
        removeFont,
        addColor,
        removeColor
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

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const handleSaveName = () => {
        if (tempName.trim()) {
            updateUsername(tempName.trim());
        }
        setEditName(false);
    };

    const handleAddColor = (e) => {
        e.preventDefault();
        if (colorName.trim() && hexCode) {
            // Strip alpha channel if present (e.g. #RRGGBBAA → #RRGGBB)
            const cleanHex = hexCode.length > 7 ? hexCode.substring(0, 7) : hexCode;
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
                        console.warn('[Profile] Firestore font count increment failed (non-fatal):', metricErr.message);
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
    const sanitizeHex = (hex) => hex?.length > 7 ? hex.substring(0, 7) : hex;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#fff0e5] via-teal-100 to-[#00A3A3] text-gray-900 overflow-y-auto">
            {/* Upload Result Modal */}
            <FontUploadModal result={uploadResult} onClose={() => setUploadResult(null)} />

            <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="w-10 h-10 bg-white/50 hover:bg-white/80 rounded-2xl flex items-center justify-center shadow-sm transition-colors text-gray-600 hover:text-primary">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Your Profile</h1>
                    </div>
                </div>

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
                                        onChange={e => setTempName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                        className="text-2xl font-bold bg-white/50 border border-gray-300 rounded-lg px-3 py-1 outline-none focus:border-primary"
                                    />
                                    <button onClick={handleSaveName} className="text-primary hover:text-orange-700 font-semibold text-sm bg-primary/10 px-3 py-1.5 rounded-lg">Save</button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-bold text-gray-900">{profile.username}</h2>
                                    <button 
                                        onClick={() => { setTempName(profile.username); setEditName(true); }}
                                        className="text-gray-400 hover:text-primary transition-colors">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                        <p className="text-gray-500 font-medium">Desktop Creator</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-black text-primary">{profile.total_exports}</div>
                        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mt-1">Total Exports</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Custom Fonts */}
                    <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 flex flex-col h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Custom Fonts</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">Up to 5MB TTF/OTF files</p>
                            </div>
                            <button
                                onClick={handleUploadFont}
                                disabled={isUploading}
                                className="bg-primary hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm flex items-center gap-2">
                                {isUploading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                )}
                                {isUploading ? 'Uploading…' : 'Upload Font'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {customFonts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    <p className="text-sm font-semibold">No custom fonts yet</p>
                                </div>
                            ) : (
                                customFonts.map(font => (
                                    <div key={font.id} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 group">
                                        <div className="flex items-center gap-3 truncate">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold shrink-0">Aa</div>
                                            <span className="font-semibold text-gray-700 truncate">{font.font_name}</span>
                                        </div>
                                        <button onClick={() => removeFont(font.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Custom Colors */}
                    <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8 flex flex-col h-[400px]">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Custom Colors</h3>
                        
                        <form onSubmit={handleAddColor} className="flex flex-col gap-3 mb-6">
                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        placeholder="Color name" 
                                        value={colorName}
                                        onChange={e => setColorName(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        placeholder="Brand (e.g. BambuLab)" 
                                        value={brand}
                                        onChange={e => setBrand(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <div className="relative">
                                    <input 
                                        type="color" 
                                        value={hexCode}
                                        onChange={e => {
                                            // Always strip alpha channel on change — browsers can emit 8-char hex on some systems
                                            const v = e.target.value;
                                            setHexCode(v.length > 7 ? v.substring(0, 7) : v);
                                        }}
                                        className="w-12 h-[42px] rounded-xl cursor-pointer p-0 border-0 bg-transparent"
                                    />
                                </div>
                                <button type="submit" disabled={!colorName.trim()} className="bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all">
                                    Add
                                </button>
                            </div>
                        </form>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {customColors.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                                    <p className="text-sm font-semibold">No custom colors yet</p>
                                </div>
                            ) : (
                                customColors.map(color => (
                                    <div key={color.id} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 group">
                                        <div className="flex items-center gap-3">
                                            {/* Use sanitized hex to prevent WebGL crash on color swatch */}
                                            <div className="w-8 h-8 rounded-full shadow-inner border border-black/10" style={{ backgroundColor: sanitizeHex(color.hex_code) }} />
                                            <div>
                                                <div className="font-semibold text-gray-700">{color.color_name}</div>
                                                <div className="text-xs text-gray-400 uppercase font-mono">{color.brand} · {sanitizeHex(color.hex_code)}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => removeColor(color.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
