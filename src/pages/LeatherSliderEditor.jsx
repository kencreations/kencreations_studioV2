import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link } from "react-router-dom";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import CharmMesh from "../components/CharmMesh";
import { useHistoryState } from "../hooks/useHistoryState";
import { LEATHER_SLIDER_DEFAULTS } from "../store/appState";
import {
    SidebarSection,
    ControlSelect,
    ControlToggle,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";
import { Type, Ruler, CircleDashed, Layers } from "lucide-react";
import { HistoryControls } from "../components/HistoryControls";

export default function LeatherSliderEditor() {
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

    const [sliders, setSliders, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState([
            { id: "slider_1", ...LEATHER_SLIDER_DEFAULTS, type: "text" },
        ]);
    const [selectedSliderId, setSelectedSliderId] = useState("slider_1");

    const activeSliderIndex = sliders.findIndex(
        (c) => c.id === selectedSliderId,
    );
    const activeSlider = sliders[activeSliderIndex];

    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={() => {
                setSliders([
                    {
                        id: "slider_1",
                        ...LEATHER_SLIDER_DEFAULTS,
                        type: "text",
                    },
                ]);
                setSelectedSliderId("slider_1");
            }}
        />
    );

    useEffect(() => {
        setSliders((prev) =>
            prev.map((c) => {
                const currentFontIsValid = allFonts.some(
                    (f) => f.id === c.font,
                );
                if (!currentFontIsValid && allFonts.length > 0)
                    return { ...c, font: allFonts[0].id };
                return c;
            }),
        );
    }, [allFonts]);

    const updateActiveSlider = (updates) => {
        if (activeSliderIndex === -1) return;
        const newSliders = [...sliders];
        newSliders[activeSliderIndex] = { ...activeSlider, ...updates };
        setSliders(newSliders);
    };

    const slidersWithLayout = useMemo(() => {
        const columns = 5;
        const maxSliderSize = Math.max(
            10,
            ...sliders.map((c) => Number(c.size || 10)),
        );
        const maxBaseOffset = Math.max(
            2,
            ...sliders.map((c) => Number(c.baseOffset || 2)),
        );
        const spacing = maxSliderSize + maxBaseOffset * 2 + 8;

        const expanded = [];
        sliders.forEach((slider) => {
            const letters = (slider.text || "A").split("");
            letters.forEach((letter, letterIndex) => {
                const totalIndex = expanded.length;
                const row = Math.floor(totalIndex / columns);
                const col = totalIndex % columns;
                const totalLetters = sliders.reduce(
                    (acc, c) => acc + (c.text || "A").split("").length,
                    0,
                );
                const numRows = Math.ceil(totalLetters / columns);
                const startX = ((columns - 1) * spacing) / 2;
                const startY = ((numRows - 1) * spacing) / 2;

                expanded.push({
                    ...slider,
                    id: `${slider.id}_letter_${letterIndex}`,
                    text: letter.toUpperCase(),
                    layoutX: -startX + col * spacing,
                    layoutY: startY - row * spacing,
                    layoutZ:
                        (slider.enableBase !== false
                            ? slider.baseHeight || 6
                            : 0) /
                            2 -
                        2.5,
                });
            });
        });
        return expanded;
    }, [sliders]);

    const deferredSlidersWithLayout = useDeferredValue(slidersWithLayout);

    const dims = useMemo(() => {
        if (deferredSlidersWithLayout.length === 0) return { x: 0, y: 0, z: 0 };
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity,
            maxZ = 0;

        deferredSlidersWithLayout.forEach((c) => {
            const width = c.size;
            const height = c.size;
            const z = (c.enableBase !== false ? c.baseHeight : 0) + c.depth;
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
    }, [deferredSlidersWithLayout]);

    return (
        <EditorLayout
            title="LEATHER SLIDERS"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="flex h-full flex-col gap-4 text-slate-700">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                            Your Sliders
                        </h2>
                    </div>
                    {activeSlider && (
                        <>
                            <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                                <label className="grid gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-700">
                                            Legends
                                        </span>
                                    </div>
                                    <textarea
                                        value={activeSlider.text || ""}
                                        onChange={(e) =>
                                            updateActiveSlider({
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
                                                updateActiveSlider({
                                                    text: preset.val,
                                                })
                                            }
                                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-200 transition-colors">
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <SidebarSection title=" Typography" icon={Type}>
                                <div className="grid gap-1.5 relative">
                                    <ControlSelect
                                        label="Font Family"
                                        value={activeSlider.font}
                                        onChange={(val) =>
                                            updateActiveSlider({ font: val })
                                        }
                                        options={fontOptions}
                                        prefixType="font"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <ControlSlider
                                        label="Legend Size (%)"
                                        value={activeSlider.legendSize || 100}
                                        min={20}
                                        max={100}
                                        step={5}
                                        onChange={(val) =>
                                            updateActiveSlider({
                                                legendSize: val,
                                            })
                                        }
                                    />
                                    <ControlSlider
                                        label="Extrusion Depth"
                                        value={activeSlider.depth || 1}
                                        min={0.2}
                                        max={3.0}
                                        step={0.1}
                                        onChange={(val) =>
                                            updateActiveSlider({ depth: val })
                                        }
                                    />
                                </div>
                            </SidebarSection>
                            <SidebarSection title="Colors" icon={CircleDashed}>
                                <div className="space-y-3">
                                    <ControlColorPicker
                                        label="Base Color"
                                        value={activeSlider.baseColor}
                                        onChange={(val) =>
                                            updateActiveSlider({
                                                baseColor: val,
                                            })
                                        }
                                        options={colorOptions}
                                    />
                                    <ControlColorPicker
                                        label="Charm Color"
                                        value={activeSlider.charmColor}
                                        onChange={(val) =>
                                            updateActiveSlider({
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
                                            value={activeSlider.size}
                                            min={10}
                                            max={50}
                                            step={1}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    size: val,
                                                })
                                            }
                                        />
                                        <ControlSlider
                                            label="Charm Depth"
                                            value={activeSlider.depth}
                                            min={1}
                                            max={10}
                                            step={1}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    depth: val,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                        <ControlSlider
                                            label="STRAP WIDTH (MM)"
                                            value={activeSlider.strapWidth}
                                            min={5}
                                            max={25}
                                            step={0.5}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    strapWidth: val,
                                                })
                                            }
                                        />
                                        <ControlSlider
                                            label="STRAP THICKNESS (MM)"
                                            value={activeSlider.strapThickness}
                                            min={1}
                                            max={6}
                                            step={0.1}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    strapThickness: val,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                        <ControlSlider
                                            label="HOLE Y OFFSET"
                                            value={activeSlider.holeYOffset}
                                            min={-10}
                                            max={10}
                                            step={0.5}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    holeYOffset: val,
                                                })
                                            }
                                        />
                                        <ControlSlider
                                            label="HOLE Z OFFSET"
                                            value={activeSlider.holeZOffset}
                                            min={-10}
                                            max={10}
                                            step={0.5}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    holeZOffset: val,
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
                                        checked={activeSlider.bubbleMode}
                                        onChange={(val) =>
                                            updateActiveSlider({
                                                bubbleMode: val,
                                            })
                                        }
                                    />
                                    {activeSlider.bubbleMode && (
                                        <ControlSlider
                                            label="Bubble Radius (mm)"
                                            value={activeSlider.bubbleSize ?? 2}
                                            min={0.5}
                                            max={5}
                                            step={0.5}
                                            onChange={(val) =>
                                                updateActiveSlider({
                                                    bubbleSize: val,
                                                })
                                            }
                                        />
                                    )}
                                </div>
                            </SidebarSection>
                            <SidebarSection title="Base" icon={Layers}>
                                <div className="space-y-4 mt-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Layers className="w-4 h-4 text-teal-500" />
                                        <span className="text-xs font-bold tracking-wider text-teal-600 uppercase"></span>
                                    </div>
                                    <ControlToggle
                                        label="Enable Base Plate"
                                        checked={
                                            activeSlider.enableBase !== false
                                        }
                                        onChange={(val) =>
                                            updateActiveSlider({
                                                enableBase: val,
                                            })
                                        }
                                    />
                                    {activeSlider.enableBase !== false && (
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <ControlSlider
                                                label="Border Offset"
                                                value={activeSlider.baseOffset}
                                                min={1}
                                                max={8}
                                                step={1}
                                                onChange={(val) =>
                                                    updateActiveSlider({
                                                        baseOffset: val,
                                                    })
                                                }
                                            />
                                            <ControlSlider
                                                label="Base Height"
                                                value={activeSlider.baseHeight}
                                                min={2}
                                                max={12}
                                                step={1}
                                                onChange={(val) =>
                                                    updateActiveSlider({
                                                        baseHeight: val,
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            </SidebarSection>
                        </>
                    )}
                </div>
            }>
            <EditorCanvas title="Leather Sliders" dims={dims}>
                {deferredSlidersWithLayout.map((slider) => (
                    <group
                        key={slider.id}
                        position={[
                            slider.layoutX,
                            slider.layoutY,
                            slider.layoutZ,
                        ]}>
                        <CharmMesh
                            charm={{
                                ...slider,
                                type: "text",
                                text: slider.text || "A",
                                font: slider.font || "Titan One",
                                size: Number(slider.size ?? 10),
                                legendSize: Number(slider.legendSize ?? 100),
                                depth: Number(slider.depth ?? 1),
                                baseOffset: Number(slider.baseOffset ?? 2),
                                baseHeight: Number(slider.baseHeight ?? 6),
                                baseColor: slider.baseColor || "#00A3A3",
                                charmColor: slider.charmColor || "#ffffff",
                                holeShape: slider.holeShape || "box",
                                strapWidth: Number(slider.strapWidth ?? 10),
                                strapThickness: Number(
                                    slider.strapThickness ?? 2.5,
                                ),
                                holeYOffset: Number(slider.holeYOffset ?? 0),
                                holeZOffset: Number(slider.holeZOffset ?? 1.5),
                                enableBase: slider.enableBase !== false,
                                bubbleMode: Boolean(slider.bubbleMode),
                                bubbleSize: Number(slider.bubbleSize ?? 2),
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
