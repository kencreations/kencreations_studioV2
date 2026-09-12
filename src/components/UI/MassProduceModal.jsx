import React, { useState, useMemo, useCallback } from "react";
import { X, Copy, Trash2, PackageOpen, ChevronDown } from "lucide-react";
import { PRINTER_PRESETS, getPresetById } from "../../config/printers";
import { packItems, estimateKeychainSize } from "../../utils/binPacking";

/**
 * MassProduceModal — Paste-and-pack bulk names for batch 3D printing.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(result: { packed, plateCount, printer }) => void} props.onPack
 * @param {Object} props.editorConfig — current keychain editor config (for size estimation)
 */
export default function MassProduceModal({ isOpen, onClose, onPack, editorConfig }) {
    const [rawText, setRawText] = useState("");
    const [printerId, setPrinterId] = useState(
        () => localStorage.getItem("kc_mass_produce_printer") || PRINTER_PRESETS[0].id
    );
    const [spacing, setSpacing] = useState(5);

    // ── Parse raw text into structured items ──────────────────────────────
    const parsedItems = useMemo(() => {
        if (!rawText.trim()) return [];
        const lines = rawText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        // Deduplicate and count quantities
        const countMap = new Map();
        for (const line of lines) {
            countMap.set(line, (countMap.get(line) || 0) + 1);
        }

        return Array.from(countMap.entries()).map(([text, qty], index) => {
            const est = estimateKeychainSize(text, editorConfig || {});
            return {
                id: `mp-${index}`,
                text,
                qty,
                width: Math.round(est.width * 10) / 10,
                depth: Math.round(est.depth * 10) / 10,
            };
        });
    }, [rawText, editorConfig]);

    const totalItems = useMemo(
        () => parsedItems.reduce((sum, item) => sum + item.qty, 0),
        [parsedItems]
    );

    // ── Item actions ──────────────────────────────────────────────────────
    const duplicateItem = useCallback((text) => {
        setRawText((prev) => prev + "\n" + text);
    }, []);

    const removeItem = useCallback((textToRemove) => {
        setRawText((prev) => {
            const lines = prev.split(/\r?\n/);
            // Remove the FIRST occurrence of this text
            const idx = lines.findIndex((l) => l.trim() === textToRemove);
            if (idx !== -1) lines.splice(idx, 1);
            return lines.join("\n");
        });
    }, []);

    // ── Pack & Preview ────────────────────────────────────────────────────
    const handlePack = () => {
        if (parsedItems.length === 0) return;

        const printer = getPresetById(printerId);
        localStorage.setItem("kc_mass_produce_printer", printerId);

        const result = packItems({
            usableWidth: printer.usableWidth,
            usableDepth: printer.usableDepth,
            spacing,
            items: parsedItems,
            exclusionZones: printer.exclusionZones || [],
        });

        onPack({
            packed: result.packed,
            plateCount: result.plateCount,
            printer,
            spacing,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-secondary/20 overflow-hidden flex flex-col max-h-[90vh]">
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-secondary/10 bg-gradient-to-r from-secondary/5 to-primary/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                            <PackageOpen className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900 tracking-tight">
                                Mass Produce
                            </h2>
                            <p className="text-[11px] text-gray-500 font-medium">
                                Paste names, auto-pack onto a build plate, export all at once.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Textarea */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                            Paste Names (one per line)
                        </label>
                        <textarea
                            className="w-full h-36 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-mono outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all resize-none"
                            placeholder={"John\nSarah\nMichael\nEmily\n..."}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                    </div>

                    {/* Config Bar */}
                    <div className="flex items-end gap-4">
                        {/* Printer Select */}
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                                Printer Bed
                            </label>
                            <div className="relative">
                                <select
                                    value={printerId}
                                    onChange={(e) => setPrinterId(e.target.value)}
                                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 pr-8 cursor-pointer"
                                >
                                    {PRINTER_PRESETS.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label} ({p.usableWidth}×{p.usableDepth}mm)
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={14}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                />
                            </div>
                        </div>

                        {/* Spacing Slider */}
                        <div className="w-40">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                                Spacing: {spacing}mm
                            </label>
                            <input
                                type="range"
                                min={2}
                                max={15}
                                step={1}
                                value={spacing}
                                onChange={(e) => setSpacing(Number(e.target.value))}
                                className="w-full accent-secondary"
                            />
                        </div>
                    </div>

                    {/* Data Table */}
                    {parsedItems.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                    Preview ({totalItems} item{totalItems !== 1 ? "s" : ""})
                                </span>
                            </div>
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            <th className="px-3 py-2 text-left">#</th>
                                            <th className="px-3 py-2 text-left">Name</th>
                                            <th className="px-3 py-2 text-center">Qty</th>
                                            <th className="px-3 py-2 text-right">Est. Size</th>
                                            <th className="px-3 py-2 text-right w-20">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {parsedItems.map((item, i) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-secondary/5 transition-colors"
                                            >
                                                <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                                                    {i + 1}
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-gray-800 truncate max-w-[200px]">
                                                    {item.text}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-md bg-secondary/10 text-secondary text-xs font-bold">
                                                        {item.qty}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-500 font-mono text-xs">
                                                    {item.width}×{item.depth}mm
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => duplicateItem(item.text)}
                                                            className="p-1.5 rounded-md hover:bg-secondary/10 text-gray-400 hover:text-secondary transition-colors"
                                                            title="Duplicate"
                                                        >
                                                            <Copy size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeItem(item.text)}
                                                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePack}
                        disabled={parsedItems.length === 0}
                        className="px-6 py-2.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        <PackageOpen size={16} />
                        Pack & Preview ({totalItems})
                    </button>
                </div>
            </div>
        </div>
    );
}
