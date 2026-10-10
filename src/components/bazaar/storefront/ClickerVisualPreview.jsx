import React from "react";
import { Sparkles, KeyRound } from "lucide-react";

/**
 * Calculates whether text on a hex color should be dark or light.
 */
function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== "string") return "#ffffff";
    const hex = hexColor.replace("#", "");
    if (hex.length < 6) return "#ffffff";
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? "#0f172a" : "#ffffff";
}

/**
 * High-quality 2D composite visual preview of the customized mechanical clicker.
 * Shows base casing, mechanical switches, and individual keycaps with exact letter/icon and colors.
 */
export default function ClickerVisualPreview({
    slotCount = 3,
    slotsData = [], // [{ char, colorHex, isIcon, iconEmoji, colorName }]
    casingColorHex = "#1e293b",
    casingStyle = "standard", // 'standard' | 'rounded' | 'ergonomic'
    activeSlotIndex = 0,
    onSelectSlot = () => {},
    switchColor = "#3b82f6", // stem color
    switchName = "Mechanical Switch",
    hasKeyring = false,
}) {
    // Style radius
    const casingRadiusClass =
        casingStyle === "rounded"
            ? "rounded-3xl"
            : casingStyle === "ergonomic"
            ? "rounded-2xl"
            : "rounded-xl";

    return (
        <div className="relative w-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-gray-100 rounded-3xl border border-gray-200/80 shadow-inner overflow-hidden select-none">
            {/* Background subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                }}
            />

            {/* Top Badge: Realistic Interactive Visualizer */}
            <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-500 bg-white/80 px-3 py-1 rounded-full border border-gray-200/60 shadow-2xs">
                <Sparkles size={12} className="text-teal-600" />
                <span>Live Clicker Layout Preview • {slotCount}-Key</span>
            </div>

            {/* Clicker Assembly Container */}
            <div className="relative inline-flex items-center justify-center p-3 transition-all duration-200">
                {/* Optional Keyring Hardware Loop */}
                {hasKeyring && (
                    <div className="absolute -top-3 -left-3 z-10 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full border-4 border-slate-400 bg-transparent shadow-xs" />
                        <div className="w-2.5 h-3.5 bg-slate-400 rounded-xs -ml-1 mt-3" />
                    </div>
                )}

                {/* Base Casing */}
                <div
                    className={`relative p-3.5 flex items-center gap-3 transition-all duration-300 shadow-[0_12px_28px_rgba(0,0,0,0.18)] border-2 border-black/10 ${casingRadiusClass}`}
                    style={{
                        backgroundColor: casingColorHex,
                    }}
                >
                    {/* Render each slot */}
                    {Array.from({ length: slotCount }).map((_, idx) => {
                        const slot = slotsData[idx] || {
                            char: String.fromCharCode(65 + idx),
                            colorHex: "#14b8a6",
                            isIcon: false,
                            iconEmoji: "",
                        };
                        const isActive = activeSlotIndex === idx;
                        const contrast = getContrastColor(slot.colorHex);

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onSelectSlot(idx)}
                                className={`relative group flex flex-col items-center cursor-pointer transition-all duration-150 transform ${
                                    isActive ? "scale-105" : "hover:scale-102"
                                }`}
                                aria-label={`Select slot ${idx + 1}`}
                            >
                                {/* Switch housing cavity */}
                                <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-xl bg-black/40 flex items-center justify-center p-1 shadow-inner border border-white/10">
                                    {/* Mechanical switch stem indicator */}
                                    <div
                                        className="w-4 h-4 rounded-xs absolute opacity-80 shadow-xs"
                                        style={{ backgroundColor: switchColor }}
                                    />

                                    {/* Keycap Body (with realistic 3D bevel and drop shadow) */}
                                    <div
                                        className={`w-full h-full rounded-lg flex flex-col items-center justify-center font-black transition-all shadow-[0_4px_8px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.3)] border border-white/20 relative overflow-hidden ${
                                            isActive
                                                ? "ring-3 ring-teal-400 ring-offset-2 ring-offset-slate-900"
                                                : ""
                                        }`}
                                        style={{
                                            backgroundColor: slot.colorHex || "#14b8a6",
                                            color: contrast,
                                        }}
                                    >
                                        {/* Keycap top concave surface shine */}
                                        <div className="absolute inset-x-1 top-1 h-2 rounded-t-md bg-white/25 pointer-events-none" />

                                        {/* Char or Emoji display */}
                                        <span className="text-lg sm:text-xl font-black tracking-tight leading-none drop-shadow-xs z-10">
                                            {slot.isIcon ? slot.iconEmoji || "✨" : slot.char || "A"}
                                        </span>
                                    </div>
                                </div>

                                {/* Slot indicator pill */}
                                <span
                                    className={`mt-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full transition-colors ${
                                        isActive
                                            ? "bg-teal-500 text-white shadow-xs"
                                            : "bg-white/80 text-gray-600 border border-gray-200"
                                    }`}
                                >
                                    Key {idx + 1}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom details footnote */}
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1">
                    <span
                        className="w-2.5 h-2.5 rounded-full inline-block shadow-xs"
                        style={{ backgroundColor: casingColorHex }}
                    />
                    Casing: {casingStyle}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                    <span
                        className="w-2 h-2 rounded-xs inline-block shadow-xs"
                        style={{ backgroundColor: switchColor }}
                    />
                    Switch: {switchName}
                </span>
            </div>
        </div>
    );
}
