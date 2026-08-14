import React, { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import SceneKeycap, { lettersFromLegends, computeSetBounds, FONT_OPTIONS } from "../components/SceneKeycap";
import { KEYCAP_DEFAULTS } from "../store/appState";
import { colors } from "../data/colors";

const PRIMARY = "#FF6B00"; // Orange
const SECONDARY = "#00A3A3"; // Teal

// ─── UI Helper Components ──────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange }) {
    return (
        <label className="grid gap-1">
            <span className="flex justify-between text-xs font-semibold text-gray-700">
                <span>{label}</span>
                <span className="text-xs text-primary">{value}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-primary"
            />
        </label>
    );
}

const getColorName = (hex) => {
    const allColors = [...colors.BambuLab, ...colors.Esun];
    const match = allColors.find(
        (c) => c.hex.toLowerCase() === hex.toLowerCase(),
    );
    return match ? match.name : "Custom Color";
};

function ColorSelectionDrawer({ value, onChange, isOpen, onClose }) {
    const [selectedBrand, setSelectedBrand] = useState("BambuLab");

    if (!isOpen) return null;

    return (
        <div className="absolute left-0 top-0 z-50 w-full mt-5 rounded-2xl border border-secondary bg-white p-4 shadow-2xl">
            <div className="flex gap-10 mb-4 border-b pb-2 border-secondary">
                {Object.keys(colors).map((brand) => (
                    <button
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={`text-sm font-semibold transition-colors ${
                            selectedBrand === brand
                                ? "text-secondary border-b-2 border-secondary"
                                : "text-gray-400 hover:text-secondary"
                        }`}>
                        {brand}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-5 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                {colors[selectedBrand].map((c) => (
                    <button
                        key={c.name}
                        onClick={() => {
                            onChange(c.hex);
                            onClose();
                        }}
                        className={`group relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 transition-all ${
                            value.toLowerCase() === c.hex.toLowerCase()
                                ? "border-secondary scale-105 shadow-md"
                                : "border-transparent hover:border-gray-200 hover:scale-105"
                        }`}>
                        <div
                            className="h-8 w-8 rounded-full shadow-inner border border-black/10"
                            style={{ backgroundColor: c.hex }}
                        />
                        <span className="mt-1 text-[9px] font-medium text-gray-500 text-center leading-tight">
                            {c.name.replace(/Bambu |Esun /i, "")}
                        </span>
                    </button>
                ))}
            </div>
            <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-gray-100 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200">
                Close
            </button>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function KeycapEditor() {
    const [state, setState] = useState(KEYCAP_DEFAULTS);
    const [capBB, setCapBB] = useState(null);
    const [customGeo, setCustomGeo] = useState(null);
    const sceneRef = useRef(null);

    // Font selection state
    const [isFontOpen, setIsFontOpen] = useState(false);
    const [fontSearch, setFontSearch] = useState("");
    const filteredFonts = FONT_OPTIONS.filter((f) =>
        f.label.toLowerCase().includes(fontSearch.toLowerCase()),
    );
    const selectedFont = FONT_OPTIONS.find((f) => f.label === state.fontLabel) || FONT_OPTIONS[0];

    // Color drawers state
    const [openColorDrawer, setOpenColorDrawer] = useState(null); // 'cap' or 'legend'

    const set = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
    const handleCapBB = useCallback((bb) => setCapBB(bb), []);

    const letters = lettersFromLegends(state.legends);
    const bounds = computeSetBounds(letters.length, capBB);
    const cols = Math.min(letters.length, 6);
    const rows = Math.ceil(letters.length / Math.max(cols, 1));

    return (
        <EditorLayout
            title="Keycap Maker"
            backLink="/"
            sidebarContent={
                <div className="space-y-6">
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Generate full mechanical keyboard keycap sets in seconds. Customize legends, fonts, and colors!
                    </p>

                    {/* Legends Input */}
                    <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                        <label className="grid gap-1.5">
                            <div className="flex justify-between">
                                <span className="text-xs font-semibold text-gray-700">Legends</span>
                                <span className="text-[10px] font-semibold text-gray-400">
                                    {letters.length} keys · {cols}×{rows}
                                </span>
                            </div>
                            <textarea
                                value={state.legends}
                                onChange={(e) => set("legends", e.target.value)}
                                rows={3}
                                placeholder="A B C D E F G..."
                                className="w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm font-medium text-neutral outline-none transition-colors focus:ring-2 focus:ring-secondary/30 resize-none font-mono"
                            />
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { label: "A–Z + 0–9", val: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" },
                                { label: "A–Z", val: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
                                { label: "0–9", val: "0123456789" },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => set("legends", preset.val)}
                                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-200 transition-colors">
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font & Appearance */}
                    <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-4">
                        <span className="text-sm font-semibold text-gray-700">Typography</span>
                        
                        <div className="grid gap-1.5 relative">
                            <span className="text-xs font-semibold text-gray-700">Font Family</span>
                            <button
                                type="button"
                                onClick={() => setIsFontOpen((o) => !o)}
                                className="flex w-full items-center justify-between rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-left text-sm text-neutral hover:border-secondary focus:outline-none transition-colors">
                                <span>{selectedFont.label}</span>
                                <span className="text-primary text-xs">{isFontOpen ? "▲" : "▼"}</span>
                            </button>

                            {isFontOpen && (
                                <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-2xl border border-secondary bg-white p-2 shadow-2xl">
                                    <input
                                        type="text"
                                        value={fontSearch}
                                        onChange={(e) => setFontSearch(e.target.value)}
                                        placeholder="search fonts..."
                                        autoFocus
                                        className="mb-2 w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm outline-none focus:border-secondary"
                                    />
                                    <div className="max-h-44 overflow-y-auto rounded-xl border border-secondary bg-gray-50 p-1">
                                        {filteredFonts.map((font) => (
                                            <button
                                                key={font.label}
                                                type="button"
                                                onClick={() => {
                                                    set("fontLabel", font.label);
                                                    setIsFontOpen(false);
                                                    setFontSearch("");
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                    font.label === state.fontLabel
                                                        ? "bg-secondary/15 text-neutral font-bold"
                                                        : "hover:bg-white"
                                                }`}>
                                                <span>{font.label}</span>
                                                {font.label === state.fontLabel && <span className="text-primary">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Slider
                                label="Legend Size (%)"
                                value={state.legendSizePct}
                                min={20}
                                max={100}
                                step={5}
                                onChange={(val) => set("legendSizePct", val)}
                            />
                            <Slider
                                label="Extrusion Depth"
                                value={state.legendDepth}
                                min={0.2}
                                max={3.0}
                                step={0.1}
                                onChange={(val) => set("legendDepth", val)}
                            />
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3 relative">
                        <span className="text-sm font-semibold text-gray-700">Colors</span>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Cap Color */}
                            <label className="grid gap-1.5 relative">
                                <span className="text-xs font-semibold text-gray-500">Cap Color</span>
                                <button
                                    onClick={() => setOpenColorDrawer(openColorDrawer === "cap" ? null : "cap")}
                                    className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5 pr-3 transition-colors hover:border-secondary">
                                    <div
                                        className="h-6 w-6 rounded-lg shadow-inner border border-black/10"
                                        style={{ backgroundColor: state.capColor }}
                                    />
                                    <span className="text-xs font-medium text-neutral truncate">
                                        {getColorName(state.capColor)}
                                    </span>
                                </button>
                                <ColorSelectionDrawer
                                    isOpen={openColorDrawer === "cap"}
                                    value={state.capColor}
                                    onChange={(hex) => set("capColor", hex)}
                                    onClose={() => setOpenColorDrawer(null)}
                                />
                            </label>

                            {/* Legend Color */}
                            <label className="grid gap-1.5 relative">
                                <span className="text-xs font-semibold text-gray-500">Legend Color</span>
                                <button
                                    onClick={() => setOpenColorDrawer(openColorDrawer === "legend" ? null : "legend")}
                                    className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5 pr-3 transition-colors hover:border-secondary">
                                    <div
                                        className="h-6 w-6 rounded-lg shadow-inner border border-black/10"
                                        style={{ backgroundColor: state.legendColor }}
                                    />
                                    <span className="text-xs font-medium text-neutral truncate">
                                        {getColorName(state.legendColor)}
                                    </span>
                                </button>
                                <ColorSelectionDrawer
                                    isOpen={openColorDrawer === "legend"}
                                    value={state.legendColor}
                                    onChange={(hex) => set("legendColor", hex)}
                                    onClose={() => setOpenColorDrawer(null)}
                                />
                            </label>
                        </div>
                    </div>
                    
                    {/* Settings */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
                        <span className="text-sm font-semibold text-gray-700">Advanced</span>
                        
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={state.topBorder} 
                                onChange={e => set("topBorder", e.target.checked)}
                                className="w-4 h-4 accent-secondary rounded"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-700">Add Border</span>
                                <span className="text-[10px] text-gray-400">Adds an extruded border around the cap edge</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={state.mergeForExport} 
                                onChange={e => set("mergeForExport", e.target.checked)}
                                className="w-4 h-4 accent-secondary rounded"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-700">Merge Colors (STL only)</span>
                                <span className="text-[10px] text-gray-400">Merges caps and legends into a single 3D object</span>
                            </div>
                        </label>
                    </div>

                </div>
            }>
            <EditorCanvas dims={bounds} title="Keycap_Set">
                <SceneKeycap 
                    ref={sceneRef} 
                    state={state} 
                    onCapBB={handleCapBB} 
                    customGeo={customGeo} 
                />
            </EditorCanvas>
        </EditorLayout>
    );
}
