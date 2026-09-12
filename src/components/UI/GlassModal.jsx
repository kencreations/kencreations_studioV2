import React, { useEffect } from "react";

/**
 * A highly styled, reusable Glassmorphism Modal component.
 * Features a sticky header with a close button and a scrollable body.
 */
export default function GlassModal({ isOpen, onClose, title, children }) {
    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/80 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 border-b border-gray-200/50 bg-white/50 backdrop-blur-md">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-full flex items-center justify-center transition-colors focus:outline-none"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
}
