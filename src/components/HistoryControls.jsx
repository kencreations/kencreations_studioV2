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
            <div className="flex items-center rounded-lg border border-white/20 bg-white/10 overflow-hidden shadow-sm">
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="p-1.5 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    title="Undo (Ctrl+Z)">
                    <Undo className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/20"></div>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="p-1.5 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    title="Redo (Ctrl+Y)">
                    <Redo className="w-4 h-4" />
                </button>
            </div>
            <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-red-300/30">
                <RotateCcw className="w-3.5 h-3.5" />
                RESET
            </button>
        </div>
    );
}
