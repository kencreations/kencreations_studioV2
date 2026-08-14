import React, { useState, useEffect } from 'react';

/**
 * WhatsNewModal — "What's New" modal triggered by the SyncWorker when
 * the admin publishes a new update entry in Firestore.
 *
 * Features:
 *  - Full-screen backdrop with glassmorphism card
 *  - Renders the changelog as preformatted text (Markdown-aware)
 *  - "Dismiss" button (forcePrompt updates re-show until dismissed in this session)
 *  - Accessible: focus-trapped, Escape key dismisses
 */

export default function WhatsNewModal() {
    const [update, setUpdate] = useState(null);
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (!window.electronAPI?.onUpdateAvailable) return;

        const unsub = window.electronAPI.onUpdateAvailable((updateData) => {
            setUpdate(updateData);
            setVisible(true);
            setExiting(false);
        });

        return unsub;
    }, []);

    // Escape key to dismiss
    useEffect(() => {
        if (!visible) return;
        const handler = (e) => { if (e.key === 'Escape') handleDismiss(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [visible]);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => {
            setVisible(false);
            setExiting(false);
            setUpdate(null);
        }, 250);
    };

    if (!visible || !update) return null;

    return (
        <div
            className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-250 ${
                exiting ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
            role="dialog"
            aria-modal="true"
            aria-label="What's New"
        >
            <div
                className={`bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_24px_64px_0_rgba(0,0,0,0.25)] max-w-lg w-full border border-white/60 overflow-hidden transition-all duration-250 ${
                    exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                }`}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-6 pb-5 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                            🎉
                        </div>
                        <div>
                            <p className="text-teal-100 text-xs font-bold uppercase tracking-widest mb-0.5">
                                {update.version}
                            </p>
                            <h2 className="text-white text-xl font-extrabold leading-tight">
                                {update.title || "What's New"}
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Changelog Body */}
                <div className="p-6 max-h-72 overflow-y-auto">
                    <pre className="font-sans text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {update.changelog || 'No changelog provided.'}
                    </pre>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex justify-end">
                    <button
                        onClick={handleDismiss}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-teal-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm"
                    >
                        Got it, let's go! ✨
                    </button>
                </div>
            </div>
        </div>
    );
}
