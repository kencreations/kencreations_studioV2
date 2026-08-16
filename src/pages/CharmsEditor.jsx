import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import CharmMesh from "../components/CharmMesh";
import { CHARMS_DEFAULTS } from "../store/appState";
import { FONT_OPTIONS } from "../utils/fonts";

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

const getColorName = (hex, allBrands, customColors = []) => {
    // Check custom colors first
    const customMatch = customColors.find(c => c.hex_code.toLowerCase() === hex.toLowerCase());
    if (customMatch) return customMatch.color_name;

    if (!allBrands) return "Custom Color";
    
    // Flatten all brand colors to search for the hex
    const allColors = Object.values(allBrands).flat();
    
    const match = allColors.find(
        (c) => c.hex.toLowerCase() === hex.toLowerCase(),
    );
    return match ? match.name : "Custom Color";
};

function ColorSelectionDrawer({ value, onChange, isOpen, onClose, anchorRef }) {
    const { brands: colors } = useFilamentBrands();
    const { customColors } = useProfile();

    const mergedColors = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(colors));
        customColors.forEach(c => {
            const b = c.brand || "Custom";
            if (!merged[b]) merged[b] = [];
            merged[b].push({ hex: c.hex_code, name: c.color_name });
        });
        return merged;
    }, [colors, customColors]);

    const [selectedBrand, setSelectedBrand] = useState("BambuLab");
    const [drawerStyle, setDrawerStyle] = useState({});

    useEffect(() => {
        let style = {
            position: "absolute",
            left: "0",
            bottom: "100%",
            zIndex: 50,
            marginBottom: "8px"
        };

        if (anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            style = {
                position: "fixed",
                left: rect.left,
                bottom: window.innerHeight - rect.top + 8,
                zIndex: 9999,
            };
        }
        setDrawerStyle(style);
    }, [anchorRef]);

    if (!isOpen) return null;

    return (
        <div className="w-96 rounded-2xl border border-secondary bg-white p-4 shadow-2xl" style={drawerStyle}>
            <div className="flex gap-10 mb-4 border-b pb-2 border-secondary overflow-x-auto">
                {Object.keys(mergedColors).map((brand) => (
                    <button
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={`text-sm font-bold whitespace-nowrap ${selectedBrand === brand ? "text-secondary border-b-2 border-secondary " : "text-gray-400 hover:text-secondary"}`}>
                        {brand === "BambuLab" ? "Bambu Lab" : brand}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                {mergedColors[selectedBrand]?.map((color) => (
                    <div key={color.hex + color.name} className="flex flex-col items-center">
                        <button
                            onClick={() => {
                                onChange(color.hex);
                                onClose();
                            }}
                            className={`w-10 h-10 rounded-lg border ${value === color.hex ? "border-black scale-105" : "border-gray-200"}`}
                            style={{ backgroundColor: color.hex }}
                        />
                        <span
                            className="mt-1 text-[0.6rem] text-neutral text-center w-full truncate font-semibold"
                            title={color.name}>
                            {color.name}
                        </span>
                    </div>
                ))}
            </div>
            <button
                onClick={onClose}
                className="mt-4 w-full text-xs text-gray-400 bg-primary/60 py-2 rounded-lg hover:bg-primary border border-primary transition-colors font-semibold">
                Close
            </button>
        </div>
    );
}

const ICON_PRESETS = [
    {
        label: "Arrows",
        icons: [
            "mdi:arrow-up",
            "mdi:arrow-down",
            "mdi:arrow-left",
            "mdi:arrow-right",
            "mdi:arrow-u-left-top",
            "mdi:arrow-expand-all",
        ],
    },
    {
        label: "Symbols",
        icons: [
            "mdi:heart",
            "mdi:star",
            "mdi:check-bold",
            "mdi:close",
            "mdi:infinity",
            "mdi:lightning-bolt",
        ],
    },
    {
        label: "UI",
        icons: [
            "mdi:home",
            "mdi:magnify",
            "mdi:bell",
            "mdi:cog",
            "mdi:menu",
            "mdi:account",
        ],
    },
    {
        label: "Media",
        icons: [
            "mdi:play",
            "mdi:pause",
            "mdi:stop",
            "mdi:skip-next",
            "mdi:volume-high",
            "mdi:music-note",
        ],
    },
    {
        label: "Gaming",
        icons: [
            "mdi:gamepad-variant",
            "mdi:sword",
            "mdi:shield",
            "mdi:skull",
            "mdi:trophy",
            "mdi:ghost",
        ],
    },
];

export default function CharmsEditor() {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors, customFonts } = useProfile();
    const [charms, setCharms] = useState([
        { id: "charm_1", ...CHARMS_DEFAULTS },
    ]);
    const [selectedCharmId, setSelectedCharmId] = useState("charm_1");

    // UI states
    const [isIconOpen, setIsIconOpen] = useState(false);
    const [isCharmColorOpen, setIsCharmColorOpen] = useState(false);
    const [isBaseColorOpen, setIsBaseColorOpen] = useState(false);
    const [isFontOpen, setIsFontOpen] = useState(false);
    const [fontSearch, setFontSearch] = useState("");

    // Iconify states
    const [iconSearch, setIconSearch] = useState("");
    const [iconResults, setIconResults] = useState([]);
    const [iconLoading, setIconLoading] = useState(false);
    const [presetTab, setPresetTab] = useState("Arrows");
    const iconDebounce = useRef(null);

    const [batchText, setBatchText] = useState("");

    const activeCharmIndex = charms.findIndex((c) => c.id === selectedCharmId);
    const activeCharm = charms[activeCharmIndex];

    useEffect(() => {
        const allFonts = [...FONT_OPTIONS, ...customFonts.map(f => ({ id: f.font_name, label: f.font_name, file: `file://${f.file_path}` }))];
        setCharms((prev) =>
            prev.map((c) => {
                const currentFontIsValid = allFonts.some((f) => f.id === c.font);
                if (!currentFontIsValid && allFonts.length > 0) {
                    return { ...c, font: allFonts[0].id };
                }
                return c;
            }),
        );
    }, [customFonts]);

    const updateActiveCharm = (updates) => {
        if (activeCharmIndex === -1) return;
        const newCharms = [...charms];
        newCharms[activeCharmIndex] = { ...activeCharm, ...updates };
        setCharms(newCharms);
    };

    const handleApplyToAll = () => {
        if (!activeCharm) return;
        const newCharms = charms.map((c) => {
            if (c.id === activeCharm.id) return c;
            return {
                ...c,
                font: activeCharm.font,
                size: activeCharm.size,
                depth: activeCharm.depth,
                baseOffset: activeCharm.baseOffset,
                baseHeight: activeCharm.baseHeight,
                baseColor: activeCharm.baseColor,
                charmColor: activeCharm.charmColor,
                holeOrientation: activeCharm.holeOrientation,
                holeCount: activeCharm.holeCount,
                holeDiameter: activeCharm.holeDiameter,
            };
        });
        setCharms(newCharms);
    };

    const handleAddCharm = () => {
        const newId = `charm_${Date.now()}`;
        setCharms([...charms, { ...CHARMS_DEFAULTS, id: newId }]);
        setSelectedCharmId(newId);
    };

    const handleBatchAdd = () => {
        if (!batchText.trim()) return;
        const letters = batchText.trim().split("");
        const newCharms = letters.map((letter, i) => ({
            ...CHARMS_DEFAULTS,
            id: `charm_${Date.now()}_${i}`,
            type: "text",
            text: letter.toUpperCase(),
        }));
        setCharms([...charms, ...newCharms]);
        setBatchText("");
    };

    const handleDeleteCharm = (id) => {
        const newCharms = charms.filter((c) => c.id !== id);
        if (newCharms.length === 0) {
            const newId = `charm_${Date.now()}`;
            newCharms.push({ ...CHARMS_DEFAULTS, id: newId });
        }
        setCharms(newCharms);
        if (selectedCharmId === id) {
            setSelectedCharmId(newCharms[0].id);
        }
    };

    const handleIconSearch = (q) => {
        setIconSearch(q);
        if (iconDebounce.current) clearTimeout(iconDebounce.current);
        if (!q.trim()) {
            setIconResults([]);
            return;
        }
        iconDebounce.current = setTimeout(async () => {
            setIconLoading(true);
            try {
                const res = await fetch(
                    `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=30`,
                );
                const json = await res.json();
                setIconResults(json.icons || []);
            } catch {
                setIconResults([]);
            } finally {
                setIconLoading(false);
            }
        }, 350);
    };

    const activePresetIcons =
        ICON_PRESETS.find((p) => p.label === presetTab)?.icons || [];
    const displayIcons = iconSearch.trim() ? iconResults : activePresetIcons;

    const allFonts = useMemo(() => {
        const mappedCustom = customFonts.map(f => ({
            id: f.font_name,
            label: f.font_name,
            file: `file://${f.file_path}`
        }));
        return [...FONT_OPTIONS, ...mappedCustom];
    }, [customFonts]);

    const filteredFonts = allFonts.filter((f) =>
        f.label.toLowerCase().includes(fontSearch.toLowerCase()),
    );

    const selectedFont =
        allFonts.find((f) => f.id === activeCharm?.font) || allFonts[0];

    const charmsWithLayout = useMemo(() => {
        const columns = 5;
        const spacing = 26; // Tighter gap for screenshots (charms are ~24mm wide)
        const totalCols = Math.min(charms.length, columns);
        const totalRows = Math.ceil(charms.length / columns);
        const startX = -((totalCols - 1) * spacing) / 2;
        const startY = ((totalRows - 1) * spacing) / 2;

        return charms.map((charm, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            return {
                ...charm,
                layoutX: startX + col * spacing,
                layoutY: startY - row * spacing,
                layoutZ: charm.baseHeight - 2.5, // Counteract EditorCanvas 2.5 Y offset
            };
        });
    }, [charms]);

    const dims = useMemo(() => {
        if (charmsWithLayout.length === 0) return { x: 0, y: 0, z: 0 };
        let minX = Infinity,
            maxX = -Infinity;
        let minY = Infinity,
            maxY = -Infinity;
        let maxZ = 0;

        charmsWithLayout.forEach((c) => {
            const width = c.size + c.baseOffset * 2;
            const height = c.size + c.baseOffset * 2;
            const z = c.baseHeight + c.depth;

            const x = c.layoutX;
            const y = c.layoutY;

            minX = Math.min(minX, x - width / 2);
            maxX = Math.max(maxX, x + width / 2);
            minY = Math.min(minY, y - height / 2);
            maxY = Math.max(maxY, y + height / 2);
            maxZ = Math.max(maxZ, z);
        });

        return {
            x: Math.round(maxX - minX) || 0,
            y: Math.round(maxY - minY) || 0,
            z: Math.round(maxZ) || 0,
        };
    }, [charmsWithLayout]);

    return (
        <EditorLayout
            title="Charms Editor"
            sidebarContent={
                <div className="flex flex-col gap-6 pb-20">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <Link
                            to="/"
                            className="text-xs font-bold text-gray-400 hover:text-gray-800 transition-colors uppercase tracking-wider">
                            ‹ Back to Studio
                        </Link>
                    </div>

                    {/* Charms List */}
                    <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">
                                Your Charms
                            </span>
                            <button
                                onClick={handleAddCharm}
                                className="px-2 py-1 bg-teal-500 text-white text-xs font-bold rounded-lg hover:bg-teal-600 transition-colors">
                                + Add Charm
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {charms.map((c, i) => (
                                <div
                                    key={c.id}
                                    onClick={() => setSelectedCharmId(c.id)}
                                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                                        selectedCharmId === c.id
                                            ? "border-teal-500 bg-teal-50 shadow-sm"
                                            : "border-gray-200 hover:border-teal-300 bg-white"
                                    }`}>
                                    <span className="text-sm font-semibold text-gray-700 capitalize">
                                        {i + 1}.{" "}
                                        {c.type === "icon"
                                            ? c.iconId
                                                  .split(":")
                                                  .pop()
                                                  .replace(/-/g, " ")
                                            : `Text: "${c.text}"`}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCharm(c.id);
                                        }}
                                        className="text-gray-400 hover:text-red-500 transition-colors px-2">
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <input
                                type="text"
                                placeholder="Batch add text..."
                                value={batchText}
                                onChange={(e) => setBatchText(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && handleBatchAdd()
                                }
                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-secondary transition-colors"
                            />
                            <button
                                onClick={handleBatchAdd}
                                className="bg-primary/90 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-primary transition-colors whitespace-nowrap">
                                + Batch
                            </button>
                        </div>
                    </div>

                    {/* Active Charm Settings */}
                    {activeCharm && (
                        <>
                            <div className="flex items-center justify-between mt-2 mb-1 px-1">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Active Settings
                                </span>
                                <button
                                    onClick={handleApplyToAll}
                                    className="px-2 py-1 bg-gray-100 text-secondary border border-secondary/20 hover:bg-secondary hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors"
                                    title="Apply size, colors, holes, etc. to all charms">
                                    Apply to All
                                </button>
                            </div>
                            {/* Charm Type Selector */}
                            <div className="flex bg-gray-100 p-1 rounded-xl w-full border border-gray-200">
                                {["icon", "text"].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() =>
                                            updateActiveCharm({ type: t })
                                        }
                                        className={`flex-1 text-xs font-bold py-2 rounded-lg capitalize transition-all ${
                                            activeCharm.type === t
                                                ? "bg-white text-secondary shadow-sm border border-gray-200"
                                                : "text-gray-400 hover:text-gray-600"
                                        }`}>
                                        {t === "icon"
                                            ? "Icon Charm"
                                            : "Text Charm"}
                                    </button>
                                ))}
                            </div>

                            {activeCharm.type === "icon" ? (
                                /* Icon Selector */
                                <div className="grid gap-1.5 relative">
                                    <span className="text-xs font-semibold text-gray-700">
                                        Charm Icon
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsIconOpen((o) => !o)}
                                        className="flex w-full items-center justify-between rounded-2xl border border-secondary bg-gray-50 px-4 py-2.5 text-left text-xs text-neutral hover:border-secondary focus:outline-none transition-colors">
                                        <span className="flex items-center gap-2 capitalize">
                                            😊 Icon Library (
                                            {activeCharm.iconId
                                                .split(":")
                                                .pop()}
                                            )
                                        </span>
                                        <span className="text-primary text-xs">
                                            {isIconOpen ? "▲" : "▼"}
                                        </span>
                                    </button>

                                    {isIconOpen && (
                                        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-2xl border border-secondary bg-white p-3 shadow-2xl">
                                            <input
                                                type="text"
                                                placeholder="Search 200k+ icons..."
                                                value={iconSearch}
                                                onChange={(e) =>
                                                    handleIconSearch(
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-full text-sm font-medium border-2 border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-secondary transition-colors mb-3 bg-gray-50"
                                            />
                                            {!iconSearch.trim() && (
                                                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                                                    {ICON_PRESETS.map((p) => (
                                                        <button
                                                            key={p.label}
                                                            onClick={() =>
                                                                setPresetTab(
                                                                    p.label,
                                                                )
                                                            }
                                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                                                                presetTab ===
                                                                p.label
                                                                    ? "border-secondary bg-secondary/10 text-secondary"
                                                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                                            }`}>
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1 scrollbar-thin">
                                                {iconLoading ? (
                                                    <div className="col-span-4 text-center text-xs text-gray-400 py-4">
                                                        Searching...
                                                    </div>
                                                ) : displayIcons.length ===
                                                  0 ? (
                                                    <div className="col-span-4 text-center text-xs text-gray-400 py-4">
                                                        No icons found.
                                                    </div>
                                                ) : (
                                                    displayIcons.map(
                                                        (iconId) => {
                                                            const [
                                                                prefix,
                                                                name,
                                                            ] =
                                                                iconId.split(
                                                                    ":",
                                                                );
                                                            const url = `https://api.iconify.design/${prefix}/${name}.svg`;
                                                            return (
                                                                <div
                                                                    key={iconId}
                                                                    className="relative group w-20 h-20 p-2 rounded-xl border flex items-center justify-center transition-all bg-white hover:border-secondary hover:scale-110 hover:shadow-lg">
                                                                    <button
                                                                        onClick={() => {
                                                                            updateActiveCharm(
                                                                                {
                                                                                    iconId,
                                                                                },
                                                                            );
                                                                        }}
                                                                        className={`w-full h-full flex items-center justify-center ${
                                                                            activeCharm.iconId ===
                                                                            iconId
                                                                                ? "text-secondary"
                                                                                : "text-gray-600 group-hover:text-secondary"
                                                                        }`}
                                                                        title={
                                                                            iconId
                                                                        }>
                                                                        <img
                                                                            src={
                                                                                url
                                                                            }
                                                                            alt={
                                                                                iconId
                                                                            }
                                                                            className="w-full h-full object-contain pointer-events-none opacity-80"
                                                                        />
                                                                    </button>
                                                                    <button
                                                                        onClick={(
                                                                            e,
                                                                        ) => {
                                                                            e.stopPropagation();
                                                                            const newId = `charm_${Date.now()}_${Math.random()}`;
                                                                            setCharms(
                                                                                (
                                                                                    prev,
                                                                                ) => [
                                                                                    ...prev,
                                                                                    {
                                                                                        ...CHARMS_DEFAULTS,
                                                                                        id: newId,
                                                                                        type: "icon",
                                                                                        iconId,
                                                                                    },
                                                                                ],
                                                                            );
                                                                            setSelectedCharmId(
                                                                                newId,
                                                                            );
                                                                        }}
                                                                        className="absolute -top-1 -right-1 bg-teal-500 hover:bg-teal-600 text-white w-5 h-5 rounded-full text-[10px] font-black shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                                                                        title="Spawn as new charm">
                                                                        +
                                                                    </button>
                                                                </div>
                                                            );
                                                        },
                                                    )
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-400 text-center mt-3 border-t pt-2 border-gray-100">
                                                Powered by{" "}
                                                <strong className="text-gray-500">
                                                    Iconify
                                                </strong>{" "}
                                                (200k+ icons).
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Text Selector */
                                <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                                    <label className="grid gap-1.5">
                                        <span className="text-xs font-semibold text-gray-700">
                                            Content
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Enter text..."
                                            value={activeCharm.text}
                                            onChange={(e) =>
                                                updateActiveCharm({
                                                    text: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm font-medium text-neutral outline-none transition-colors focus:ring-2 focus:ring-secondary/30"
                                        />
                                    </label>

                                    <div className="grid gap-1.5 relative">
                                        <span className="text-xs font-semibold text-gray-700">
                                            Font
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsFontOpen((o) => !o)
                                            }
                                            className="flex w-full items-center justify-between rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-left text-sm text-neutral hover:border-secondary focus:outline-none transition-colors">
                                            <span>{selectedFont.label}</span>
                                            <span className="text-primary text-xs">
                                                {isFontOpen ? "▲" : "▼"}
                                            </span>
                                        </button>

                                        {isFontOpen && (
                                            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-2xl border border-secondary bg-white p-2 shadow-2xl">
                                                <input
                                                    type="text"
                                                    value={fontSearch}
                                                    onChange={(e) =>
                                                        setFontSearch(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="search fonts..."
                                                    autoFocus
                                                    className="mb-2 w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm outline-none focus:border-secondary"
                                                />
                                                <div className="max-h-44 overflow-y-auto rounded-xl border border-secondary bg-gray-50 p-1">
                                                    {filteredFonts.length ===
                                                        0 && (
                                                        <div className="px-3 py-2 text-xs text-gray-500">
                                                            No font found.
                                                        </div>
                                                    )}
                                                    {filteredFonts.map(
                                                        (font) => (
                                                            <button
                                                                key={font.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    updateActiveCharm(
                                                                        {
                                                                            font: font.id,
                                                                        },
                                                                    );
                                                                    setIsFontOpen(
                                                                        false,
                                                                    );
                                                                    setFontSearch(
                                                                        "",
                                                                    );
                                                                }}
                                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                                    font.id ===
                                                                    activeCharm.font
                                                                        ? "bg-secondary/15 text-neutral font-bold"
                                                                        : "hover:bg-white"
                                                                }`}>
                                                                <span>
                                                                    {font.label}
                                                                </span>
                                                                {font.id ===
                                                                    activeCharm.font && (
                                                                    <span className="text-primary">
                                                                        ✓
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Dimensions */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
                                <span className="text-sm font-semibold text-gray-700">
                                    Dimensions
                                </span>
                                <div className="grid grid-cols-2 gap-3">
                                    <Slider
                                        label="Charm Size"
                                        value={activeCharm.size}
                                        min={10}
                                        max={50}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({ size: val })
                                        }
                                    />
                                    <Slider
                                        label="Charm Depth"
                                        value={activeCharm.depth}
                                        min={1}
                                        max={10}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({ depth: val })
                                        }
                                    />
                                </div>
                            </div>

                            {/* Bubble Style */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🫧</span>
                                        <span className="text-sm font-semibold text-gray-700">
                                            Bubble Style
                                        </span>
                                    </div>
                                    <button
                                        onClick={() =>
                                            updateActiveCharm({
                                                bubbleMode:
                                                    !activeCharm.bubbleMode,
                                            })
                                        }
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                                            activeCharm.bubbleMode
                                                ? "bg-secondary"
                                                : "bg-gray-300"
                                        }`}>
                                        <span
                                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                                                activeCharm.bubbleMode
                                                    ? "translate-x-5"
                                                    : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                </div>
                                {activeCharm.bubbleMode && (
                                    <Slider
                                        label="Bubble Radius (mm)"
                                        value={activeCharm.bubbleSize ?? 2}
                                        min={0.5}
                                        max={5}
                                        step={0.5}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                bubbleSize: val,
                                            })
                                        }
                                    />
                                )}
                            </div>

                            {/* Base & Paracord Settings */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
                                <span className="text-sm font-semibold text-gray-700">
                                    Base & Paracord Hole
                                </span>
                                <div className="grid grid-cols-2 gap-3">
                                    <Slider
                                        label="Border Offset"
                                        value={activeCharm.baseOffset}
                                        min={1}
                                        max={8}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                baseOffset: val,
                                            })
                                        }
                                    />
                                    <Slider
                                        label="Base Height"
                                        value={activeCharm.baseHeight}
                                        min={2}
                                        max={12}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                baseHeight: val,
                                            })
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <Slider
                                        label="Hole Count"
                                        value={activeCharm.holeCount || 1}
                                        min={1}
                                        max={2}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                holeCount: val,
                                            })
                                        }
                                    />
                                    <Slider
                                        label="Hole Size (mm)"
                                        value={activeCharm.holeDiameter || 4}
                                        min={2}
                                        max={10}
                                        step={0.5}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                holeDiameter: val,
                                            })
                                        }
                                    />
                                </div>
                                {activeCharm.holeCount === 2 && (
                                    <div className="mt-3">
                                        <Slider
                                            label="Gap Between Holes (mm) ← 0 = touching · − = overlap"
                                            value={
                                                activeCharm.holeDistance ?? 4
                                            }
                                            min={-10}
                                            max={30}
                                            step={1}
                                            onChange={(val) =>
                                                updateActiveCharm({
                                                    holeDistance: val,
                                                })
                                            }
                                        />
                                    </div>
                                )}
                                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
                                    <span className="text-xs font-semibold text-gray-700">
                                        Hole Orientation
                                    </span>
                                    <div className="flex bg-gray-100 p-1 rounded-xl w-full border border-gray-200">
                                        {["horizontal", "front-to-back"].map(
                                            (dir) => (
                                                <button
                                                    key={dir}
                                                    onClick={() =>
                                                        updateActiveCharm({
                                                            holeOrientation:
                                                                dir,
                                                        })
                                                    }
                                                    className={`flex-1 text-xs font-bold py-1.5 rounded-lg capitalize transition-all ${
                                                        activeCharm.holeOrientation ===
                                                        dir
                                                            ? "bg-white text-secondary shadow-sm"
                                                            : "text-gray-400 hover:text-gray-600"
                                                    }`}>
                                                    {dir === "horizontal"
                                                        ? "Horizontal (L/R)"
                                                        : "Front-to-Back"}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Colors */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3 relative">
                                <span className="text-sm font-semibold text-gray-700">
                                    Colors
                                </span>
                                <div className="space-y-3">
                                    {/* Base Color Picker */}
                                    <label className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-700">
                                            Base Color
                                        </span>
                                        <button
                                            onClick={() => {
                                                setIsBaseColorOpen(
                                                    !isBaseColorOpen,
                                                );
                                                setIsCharmColorOpen(false);
                                            }}
                                            className="flex items-center gap-2 rounded-xl border border-secondary bg-gray-50 px-3 py-1.5 hover:border-secondary transition-colors">
                                            <div
                                                className="h-4 w-4 rounded-full border border-gray-300"
                                                style={{
                                                    backgroundColor:
                                                        activeCharm.baseColor,
                                                }}
                                            />
                                            <span className="text-xs font-semibold text-neutral">
                                                {getColorName(
                                                    activeCharm.baseColor,
                                                    cloudColors,
                                                    customColors
                                                )}
                                            </span>
                                        </button>
                                    </label>
                                    <ColorSelectionDrawer
                                        value={activeCharm.baseColor}
                                        onChange={(c) =>
                                            updateActiveCharm({ baseColor: c })
                                        }
                                        isOpen={isBaseColorOpen}
                                        onClose={() =>
                                            setIsBaseColorOpen(false)
                                        }
                                    />

                                    {/* Charm Color Picker */}
                                    <label className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-700">
                                            Charm Color
                                        </span>
                                        <button
                                            onClick={() => {
                                                setIsCharmColorOpen(
                                                    !isCharmColorOpen,
                                                );
                                                setIsBaseColorOpen(false);
                                            }}
                                            className="flex items-center gap-2 rounded-xl border border-secondary bg-gray-50 px-3 py-1.5 hover:border-secondary transition-colors">
                                            <div
                                                className="h-4 w-4 rounded-full border border-gray-300"
                                                style={{
                                                    backgroundColor:
                                                        activeCharm.charmColor,
                                                }}
                                            />
                                            <span className="text-xs font-semibold text-neutral">
                                                {getColorName(
                                                    activeCharm.charmColor,
                                                    cloudColors,
                                                    customColors
                                                )}
                                            </span>
                                        </button>
                                    </label>
                                    <ColorSelectionDrawer
                                        value={activeCharm.charmColor}
                                        onChange={(c) =>
                                            updateActiveCharm({ charmColor: c })
                                        }
                                        isOpen={isCharmColorOpen}
                                        onClose={() =>
                                            setIsCharmColorOpen(false)
                                        }
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            }>
            <EditorCanvas title="KenCreations_Charms" dims={dims}>
                {charmsWithLayout.map((charm) => (
                    <group
                        key={charm.id}
                        position={[
                            charm.layoutX,
                            charm.layoutY,
                            charm.layoutZ,
                        ]}>
                        <CharmMesh charm={{ ...charm, x: 0, y: 0 }} />
                    </group>
                ))}
            </EditorCanvas>
        </EditorLayout>
    );
}
