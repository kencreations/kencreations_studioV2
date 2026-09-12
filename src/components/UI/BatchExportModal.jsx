import React, { useState } from 'react';

export function BatchExportModal({ isOpen, onClose, onStartBatch, isProcessing, progressText }) {
    const [namesList, setNamesList] = useState("");

    if (!isOpen) return null;

    const handleStart = () => {
        const names = namesList.split('\n').map(n => n.trim()).filter(n => n !== "");
        if (names.length > 0) {
            onStartBatch(names);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-slate-800 mb-2">Mass Creation (Batch Export)</h2>
                <p className="text-xs text-slate-500 mb-4">
                    Paste a list of names below (one name per line). The editor will automatically generate and download an STL for each name using your current base and font settings.
                </p>
                
                <textarea
                    className="w-full h-40 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 mb-4"
                    placeholder="John&#10;Sarah&#10;Michael"
                    value={namesList}
                    onChange={(e) => setNamesList(e.target.value)}
                    disabled={isProcessing}
                />

                {isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
                        <span className="text-xs font-bold text-teal-600 animate-pulse">{progressText}</span>
                    </div>
                ) : (
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleStart}
                            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-teal-600 transition-colors"
                        >
                            Start Batch Export
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
