import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link } from "react-router-dom";
import { X, Type, WholeWord } from "lucide-react";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import CharmMesh from "../components/CharmMesh";
import { useHistoryState } from "../hooks/useHistoryState";
import { LETTER_BEADS_DEFAULTS as CHARMS_DEFAULTS } from "../store/appState";
import {
    SidebarSection,
    ControlSelect,
    ControlToggle,
    editorIcons,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";
import { Smile, Ruler, CircleDashed, Layers, Palette } from "lucide-react";
import { HistoryControls } from "../components/HistoryControls";
export default function LetterBeadsEditor() {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors, allFonts } = useProfile();

    const fontOptions = useMemo(
        () =>
            allFonts.map((font) => ({
                label: font.label,
                value: font.id,
                fontId: font.id,
            })),
        [allFonts],
    );

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
        useHistoryState([
            {
                id: "charm_1",
                ...CHARMS_DEFAULTS,
                type: "text",
            },
        ]);
    const [selectedCharmId, setSelectedCharmId] = useState("charm_1");

    // UI states
    const [isCharmColorOpen, setIsCharmColorOpen] = useState(false);
    const [isBaseColorOpen, setIsBaseColorOpen] = useState(false);
    const [isFontOpen, setIsFontOpen] = useState(false);
    const [fontSearch, setFontSearch] = useState("");

    const [batchText, setBatchText] = useState("");

    const activeCharmIndex = charms.findIndex((c) => c.id === selectedCharmId);
    const activeCharm = charms[activeCharmIndex];
    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={() => {
                setCharms([
                    {
                        id: "charm_1",
                        ...CHARMS_DEFAULTS,
                        type: "text",
                    },
                ]);
                setSelectedCharmId("charm_1");
            }}
        />
    );
    useEffect(() => {
        setCharms((prev) =>
            prev.map((c) => {
                const currentFontIsValid = allFonts.some(
                    (f) => f.id === c.font,
                );
                if (!currentFontIsValid && allFonts.length > 0) {
                    return { ...c, font: allFonts[0].id };
                }
                return c;
            }),
        );
    }, [allFonts]);

    const updateActiveCharm = (updates) => {
        if (activeCharmIndex === -1) return;
        const newCharms = [...charms];
        newCharms[activeCharmIndex] = { ...activeCharm, ...updates };
        setCharms(newCharms);
    };
    const charmsWithLayout = useMemo(() => {
        const columns = 5;
        const maxCharmSize = Math.max(
            10,
            ...charms.map((c) => Number(c.size || 10)),
        );
        const maxBaseOffset = Math.max(
            2,
            ...charms.map((c) => Number(c.baseOffset || 2)),
        );
        const spacing = maxCharmSize + maxBaseOffset * 2 + 8; // Add 8mm padding between beads

        const expanded = [];
        charms.forEach((charm) => {
            const letters = (charm.text || "A").split("");
            letters.forEach((letter, letterIndex) => {
                const totalIndex = expanded.length;
                const row = Math.floor(totalIndex / columns);
                const col = totalIndex % columns;
                const totalLetters = charms.reduce(
                    (acc, c) => acc + (c.text || "A").split("").length,
                    0,
                );
                const numRows = Math.ceil(totalLetters / columns);
                const startX = ((columns - 1) * spacing) / 2;
                const startY = ((numRows - 1) * spacing) / 2;

                expanded.push({
                    ...charm,
                    id: `${charm.id}_letter_${letterIndex}`,
                    text: letter.toUpperCase(),
                    // Fix X layout: -startX (left) to +startX (right)
                    layoutX: -startX + col * spacing,
                    // Fix Y layout: +startY (top) to -startY (bottom)
                    layoutY: startY - row * spacing,
                    // Fix Z layout: base goes from -baseHeight/2 to +baseHeight/2, so offset by baseHeight/2
                    layoutZ: (charm.baseHeight || 6) / 2 - 2.5,
                });
            });
        });

        return expanded;
    }, [charms]);

    const deferredCharmsWithLayout = useDeferredValue(charmsWithLayout);

    const dims = useMemo(() => {
        if (deferredCharmsWithLayout.length === 0) return { x: 0, y: 0, z: 0 };
        let minX = Infinity,
            maxX = -Infinity;
        let minY = Infinity,
            maxY = -Infinity;
        let maxZ = 0;

        deferredCharmsWithLayout.forEach((c) => {
            const width = c.size;
            const height = c.size;
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
    }, [deferredCharmsWithLayout]);

    return (
        <EditorLayout
            title="Letter Charms"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="flex h-full flex-col gap-4 text-slate-700">
                    {/* Active Charm Settings */}
                    {activeCharm && (
                        <>
                            {/* Legends */}
                            <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                                <label className="grid gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-700">
                                            Legends
                                        </span>
                                    </div>
                                    <textarea
                                        value={activeCharm.text || ""}
                                        onChange={(e) =>
                                            updateActiveCharm({
                                                text: e.target.value,
                                            })
                                        }
                                        rows={3}
                                        placeholder="A B C D E F G..."
                                        className="w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm font-medium text-neutral outline-none transition-colors focus:ring-2 focus:ring-secondary/30 resize-none font-mono"
                                    />
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        {
                                            label: "A-Z + 0-9",
                                            val: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                                        },
                                        {
                                            label: "A-Z",
                                            val: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                                        },
                                        { label: "0-9", val: "0123456789" },
                                    ].map((preset) => (
                                        <button
                                            key={preset.label}
                                            onClick={() =>
                                                updateActiveCharm({
                                                    text: preset.val,
                                                })
                                            }
                                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-200 transition-colors">
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Typography */}
                            <SidebarSection title=" Typography" icon={Type}>
                                <div className="grid gap-1.5 relative">
                                    <ControlSelect
                                        label="Font Family"
                                        value={activeCharm.font}
                                        onChange={(val) =>
                                            updateActiveCharm({ font: val })
                                        }
                                        options={fontOptions}
                                        prefixType="font"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <ControlSlider
                                        label="Legend Size (%)"
                                        value={activeCharm.legendSize || 100}
                                        min={20}
                                        max={100}
                                        step={5}
                                        onChange={(val) =>
                                            updateActiveCharm({
                                                legendSize: val,
                                            })
                                        }
                                    />
                                    <ControlSlider
                                        label="Extrusion Depth"
                                        value={activeCharm.depth || 1}
                                        min={0.2}
                                        max={3.0}
                                        step={0.1}
                                        onChange={(val) =>
                                            updateActiveCharm({ depth: val })
                                        }
                                    />
                                </div>
                            </SidebarSection>
                            <SidebarSection title="Colors" icon={CircleDashed}>
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
                            <SidebarSection title="Dimensions" icon={Ruler}>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <ControlSlider
                                            label="Charm Size"
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
                                            value={activeCharm.depth}
                                            min={1}
                                            max={10}
                                            step={1}
                                            onChange={(val) =>
                                                updateActiveCharm({
                                                    depth: val,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </SidebarSection>
                            <SidebarSection title="Style" icon={CircleDashed}>
                                <div className="space-y-3">
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
                            </SidebarSection>
                            <SidebarSection
                                title="Base & Paracord Holes"
                                icon={Layers}>
                                <div className="space-y-4 mt-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Layers className="w-4 h-4 text-teal-500" />
                                        <span className="text-xs font-bold tracking-wider text-teal-600 uppercase"></span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <ControlSlider
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
                                        <ControlSlider
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
                                            label="Hole Size (mm)"
                                            value={
                                                activeCharm.holeDiameter || 4
                                            }
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
                                                label="Gap Between Holes (mm) ← 0 = touching · − = overlap"
                                                value={
                                                    activeCharm.holeDistance ??
                                                    4
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
                                                            holeOrientation:
                                                                opt.id,
                                                        })
                                                    }
                                                    className={`flex-1 text-[10px] uppercase tracking-wider font-bold py-2 rounded-lg transition-all ${
                                                        (activeCharm.holeOrientation ||
                                                            "horizontal") ===
                                                        opt.id
                                                            ? "bg-[#00A3A3] text-white shadow-md"
                                                            : "text-slate-500 hover:text-[#00A3A3] hover:bg-[#00A3A3]/5"
                                                    }`}>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </SidebarSection>
                        </>
                    )}
                </div>
            }>
            <EditorCanvas title="KenCreations_Charms" dims={dims}>
                {deferredCharmsWithLayout.map((charm) => (
                    <group
                        key={charm.id}
                        position={[
                            charm.layoutX,
                            charm.layoutY,
                            charm.layoutZ,
                        ]}>
                        <CharmMesh
                            charm={{
                                ...charm,
                                type: "text",
                                text: charm.text || "A",
                                font: charm.font || "Titan One",
                                size: Number(charm.size ?? 10),
                                legendSize: Number(charm.legendSize ?? 100),
                                depth: Number(charm.depth ?? 1),
                                baseOffset: Number(charm.baseOffset ?? 2),
                                baseHeight: Number(charm.baseHeight ?? 6),
                                baseColor: charm.baseColor || "#00A3A3",
                                charmColor: charm.charmColor || "#ffffff",
                                holeOrientation:
                                    charm.holeOrientation || "horizontal",
                                holeCount: Number(charm.holeCount ?? 1),
                                holeDiameter: Number(charm.holeDiameter ?? 4.8),
                                bubbleMode: Boolean(charm.bubbleMode),
                                bubbleSize: Number(charm.bubbleSize ?? 2),
                                x: 0,
                                y: 0,
                            }}
                        />
                    </group>
                ))}
            </EditorCanvas>
        </EditorLayout>
    );
}
