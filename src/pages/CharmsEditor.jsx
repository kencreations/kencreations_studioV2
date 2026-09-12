import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { useHistoryState } from "../hooks/useHistoryState";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import CharmMesh from "../components/CharmMesh";
import { CHARMS_DEFAULTS } from "../store/appState";
import {
    SidebarSection,
    ControlInput,
    ControlSelect,
    ControlToggle,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";
import { Smile, Ruler, CircleDashed, Layers, Settings, Palette } from "lucide-react";
import { HistoryControls } from "../components/HistoryControls";

const PRIMARY = "#FF6B00"; // Orange
const SECONDARY = "#00A3A3"; // Teal

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
    const { customColors } = useProfile();

    const colorOptions = useMemo(() => {
        const merged = [];
        Object.entries(cloudColors || {}).forEach(([brand, brandColors]) => {
            brandColors.forEach((color) => {
                merged.push({
                    label: color.name,
                    value: color.hex,
                    hex: color.hex,
                    group: brand,
                });
            });
        });
        (customColors || []).forEach((color) => {
            merged.push({
                label: color.color_name,
                value: color.hex_code,
                hex: color.hex_code,
                group: color.brand || "Custom",
            });
        });
        return merged;
    }, [cloudColors, customColors]);

    const [charms, setCharms, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState([{ id: "charm_1", ...CHARMS_DEFAULTS }]);
    const [selectedCharmId, setSelectedCharmId] = useState("charm_1");

    // UI states
    const [isIconOpen, setIsIconOpen] = useState(false);
    const [isCharmColorOpen, setIsCharmColorOpen] = useState(false);
    const [isBaseColorOpen, setIsBaseColorOpen] = useState(false);

    // Iconify states
    const [iconSearch, setIconSearch] = useState("");
    const [iconResults, setIconResults] = useState([]);
    const [iconLoading, setIconLoading] = useState(false);
    const [presetTab, setPresetTab] = useState("Arrows");
    const iconDebounce = useRef(null);

    const activeCharmIndex = charms.findIndex((c) => c.id === selectedCharmId);
    const activeCharm = charms[activeCharmIndex];

    // Fonts are not used in CharmsEditor (icon only)

    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
        />
    );
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
                size: activeCharm.size,
                depth: activeCharm.depth,
                baseOffset: activeCharm.baseOffset,
                baseHeight: activeCharm.baseHeight,
                baseColor: activeCharm.baseColor,
                charmColor: activeCharm.charmColor,
                holeOrientation: activeCharm.holeOrientation,
                holeCount: activeCharm.holeCount,
                holeDiameter: activeCharm.holeDiameter,
                holeDistance: activeCharm.holeDistance,
                bubbleMode: activeCharm.bubbleMode,
                bubbleSize: activeCharm.bubbleSize,
            };
        });
        setCharms(newCharms);
    };

    const handleAddCharm = () => {
        const newId = `charm_${Date.now()}`;
        setCharms([...charms, { ...CHARMS_DEFAULTS, id: newId }]);
        setSelectedCharmId(newId);
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
            topBarActions={topBarActions}
            sidebarContent={
                <div className="flex h-full flex-col gap-4 text-slate-700">
                    {/* Charms List */}
                    <div className="rounded-2xl border border-secondary/20 bg-white p-3 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">
                                Your Charms
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {charms.map((c, i) => (
                                <div
                                    key={c.id}
                                    onClick={() => setSelectedCharmId(c.id)}
                                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                                        selectedCharmId === c.id
                                            ? "border-2 border-primary/80 bg-primary/10 shadow-sm"
                                            : "border border-secondary/50 hover:border-primary/30 bg-white"
                                    }`}>
                                    <span className="text-sm font-semibold text-gray-700 capitalize">
                                        {i + 1}.{" "}
                                        {c.iconId
                                            .split(":")
                                            .pop()
                                            .replace(/-/g, " ")}
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
                        <button
                            onClick={handleAddCharm}
                            className="w-full mt-3 rounded-xl border border-dashed border-[#00A3A3]/50 bg-[#00A3A3]/5 px-3 py-2.5 text-sm font-semibold text-[#00A3A3] transition-colors hover:bg-[#00A3A3]/10 flex items-center justify-center">
                            + Add Charm
                        </button>
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

                            {/* Icon Selector */}
                            <SidebarSection title="Icon Select" icon={Smile}>
                                <div className="grid gap-1.5 relative">
                                    <span className="text-xs font-semibold text-gray-700">
                                        Charm Icon
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsIconOpen((o) => !o)}
                                        className="flex w-full items-center justify-between rounded-xl border border-secondary bg-slate-50 px-3 py-2.5 text-left text-sm text-primary hover:bg-white focus:outline-none transition-colors">
                                        <span className="flex items-center gap-2 capitalize">
                                            (
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
                                                className="w-full text-sm font-medium border border-secondary/30 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors mb-3 bg-gray-50"
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
                                                            className={`text-xs font-bold px-2 py-1.5 rounded-xl border whitespace-nowrap transition-colors ${
                                                                presetTab ===
                                                                p.label
                                                                    ? "border-primary bg-primary/70 text-white"
                                                                    : "border-secondary/50 text-secondary/70 bg-secondary/30 hover:bg-secondary/5"
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
                                                                    className="relative group w-15 h-15 p-2 rounded-xl border flex items-center justify-center transition-all  border-secondary bg-secondary/10 hover:border-primary hover:scale-110 hover:shadow-lg hover:bg-primary/70">
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
                            </SidebarSection>
                            <SidebarSection title="Colors" icon={Palette}>
                                <div className="space-y-3">
                                    <ControlColorPicker
                                        label="Base Color"
                                        value={activeCharm.baseColor}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                baseColor: val,
                                            })
                                        }
                                        options={colorOptions}
                                    />
                                    <ControlColorPicker
                                        label="Charm Color"
                                        value={activeCharm.charmColor}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                charmColor: val,
                                            })
                                        }
                                        options={colorOptions}
                                    />
                                </div>
                            </SidebarSection>

                            {/* Dimensions */}
                            <SidebarSection title="Dimensions" icon={Ruler}>
                                <div className="grid grid-cols-2 gap-3">
                                    <ControlSlider
                                        label="Charm Size"
                                        unit="mm"
                                        value={activeCharm.size}
                                        min={10}
                                        max={50}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({ size: val })
                                        }
                                    />
                                    <ControlSlider
                                        label="Charm Depth"
                                        unit="mm"
                                        value={activeCharm.depth}
                                        min={1}
                                        max={10}
                                        step={1}
                                        onChange={(val) =>
                                            updateActiveCharm({ depth: val })
                                        }
                                    />
                                </div>
                            </SidebarSection>

                            {/* Bubble Style */}
                            <SidebarSection
                                title="Bubble Style"
                                icon={CircleDashed}>
                                <ControlToggle
                                    label="Bubble Mode"
                                    checked={activeCharm.bubbleMode}
                                    onChange={(val) =>
                                        updateActiveCharm({
                                            bubbleMode: val,
                                        })
                                    }
                                />
                                {activeCharm.bubbleMode && (
                                    <ControlSlider
                                        label="Bubble Radius"
                                        unit="mm"
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
                            </SidebarSection>

                            {/* Base & Paracord Settings */}
                            <SidebarSection
                                title="Base & Paracord Hole"
                                icon={Layers}>
                                <div className="grid grid-cols-2 gap-3">
                                    <ControlSlider
                                        label="Border Offset"
                                        unit="mm"
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
                                    <ControlSlider
                                        label="Base Height"
                                        unit="mm"
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
                                    <ControlSlider
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
                                    <ControlSlider
                                        label="Hole Size"
                                        unit="mm"
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
                                        <ControlSlider
                                            label="Gap Between Holes ← 0 = touching · − = overlap"
                                            unit="mm"
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
                                <div className="flex flex-col gap-1.5 pt-3 border-t border-secondary/20 mt-3">
                                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary">
                                        Hole Orientation
                                    </span>
                                    <div className="flex bg-white p-1 rounded-xl w-full border border-secondary/20 shadow-sm relative">
                                        {[
                                            {
                                                id: "horizontal",
                                                label: "Horizontal",
                                            },
                                            {
                                                id: "front-to-back",
                                                label: "Front-to-Back",
                                            },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() =>
                                                    updateActiveCharm({
                                                        holeOrientation: opt.id,
                                                    })
                                                }
                                                className={`flex-1 text-[10px] uppercase tracking-wider font-bold py-2 rounded-lg transition-all ${
                                                    (activeCharm.holeOrientation ||
                                                        "horizontal") === opt.id
                                                        ? "bg-[#00A3A3] text-white shadow-md"
                                                        : "text-slate-500 hover:text-[#00A3A3] hover:bg-[#00A3A3]/5"
                                                }`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </SidebarSection>
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
