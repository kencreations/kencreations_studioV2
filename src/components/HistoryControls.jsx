import React from "react";
import { Undo, Redo, RotateCcw } from "lucide-react";

export function HistoryControls({ canUndo, canRedo, onUndo, onRedo, onReset }) {
    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset to default settings?")) {
            onReset?.();
        }
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    title="Undo (Ctrl+Z)">
                    <Undo className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-gray-200"></div>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    title="Redo (Ctrl+Y)">
                    <Redo className="w-4 h-4" />
                </button>
            </div>
            <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
                <RotateCcw className="w-3.5 h-3.5" />
                RESET
            </button>
        </div>
    );
}
