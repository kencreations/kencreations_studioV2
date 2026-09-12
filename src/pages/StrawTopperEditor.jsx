import React, { useMemo, useState, useEffect } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useHistoryState } from "../hooks/useHistoryState";
import { STRAW_TOPPER_DEFAULTS } from "../store/appState";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import CharmMesh from "../components/CharmMesh";
import {
    SidebarSection,
    ControlInput,
    ControlSelect,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";
import {
    TextSelect,
    Type,
    CopyPlus,
    Trash2,
    Ruler,
    PaintBucket,
    RotateCcw,
    GripVertical,
} from "lucide-react";
import { HistoryControls } from "../components/HistoryControls";

export default function StrawTopperEditor() {
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

    const [sleeves, setSleeves, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState([
            { ...STRAW_TOPPER_DEFAULTS, id: `topper_${Date.now()}` },
        ]);

    const [selectedId, setSelectedId] = useState(sleeves[0]?.id);
    const [draggedItemIdx, setDraggedItemIdx] = useState(null);
    const [dragOverItemIdx, setDragOverItemIdx] = useState(null);

    const activeIndex = sleeves.findIndex((s) => s.id === selectedId);
    const activeSleeve = sleeves[activeIndex] || sleeves[0];

    const handleDragStart = (e, index) => {
        setDraggedItemIdx(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnter = (e, index) => {
        e.preventDefault();
        setDragOverItemIdx(index);
    };

    const handleDragEnd = () => {
        if (
            draggedItemIdx !== null &&
            dragOverItemIdx !== null &&
            draggedItemIdx !== dragOverItemIdx
        ) {
            const newSleeves = [...sleeves];
            const [draggedItem] = newSleeves.splice(draggedItemIdx, 1);
            newSleeves.splice(dragOverItemIdx, 0, draggedItem);
            setSleeves(newSleeves);
        }
        setDraggedItemIdx(null);
        setDragOverItemIdx(null);
    };

    // Auto-select valid font if current becomes invalid
    useEffect(() => {
        setSleeves((prev) =>
            prev.map((s) => {
                const currentFontIsValid = allFonts.some(
                    (f) => f.id === s.font,
                );
                if (!currentFontIsValid && allFonts.length > 0) {
                    return { ...s, font: allFonts[0].id };
                }
                return s;
            }),
        );
    }, [allFonts, setSleeves]);

    const updateActive = (updates) => {
        if (activeIndex === -1) return;
        const newSleeves = [...sleeves];
        newSleeves[activeIndex] = { ...activeSleeve, ...updates };
        setSleeves(newSleeves);
    };

    const handleAdd = () => {
        const newId = `topper_${Date.now()}`;
        setSleeves([...sleeves, { ...STRAW_TOPPER_DEFAULTS, id: newId }]);
        setSelectedId(newId);
    };

    const handleDelete = (id) => {
        const newSleeves = sleeves.filter((s) => s.id !== id);
        if (newSleeves.length === 0) {
            const newId = `topper_${Date.now()}`;
            newSleeves.push({ ...STRAW_TOPPER_DEFAULTS, id: newId });
        }
        setSleeves(newSleeves);
        if (selectedId === id) {
            setSelectedId(newSleeves[newSleeves.length - 1].id);
        }
    };

    const handleReset = () => {
        if (
            window.confirm(
                "Are you sure you want to reset to default settings?",
            )
        ) {
            const newId = `topper_${Date.now()}`;
            setSleeves([{ ...STRAW_TOPPER_DEFAULTS, id: newId }]);
            setSelectedId(newId);
        }
    };

    const applySettingsToAll = (field, value) => {
        if (
            window.confirm(
                `Apply this ${field.replace(/([A-Z])/g, " $1").toLowerCase()} to all toppers?`,
            )
        ) {
            const newSleeves = sleeves.map((s) => ({ ...s, [field]: value }));
            setSleeves(newSleeves);
        }
    };

    const handleApplyToAll = () => {
        if (!activeSleeve) return;
        const newSleeves = sleeves.map((s) => {
            if (s.id === activeSleeve.id) return s;
            return {
                ...s,
                font: activeSleeve.font,
                size: activeSleeve.size,
                depth: activeSleeve.depth,
                baseOffset: activeSleeve.baseOffset,
                baseHeight: activeSleeve.baseHeight,
                holeDiameter: activeSleeve.holeDiameter,
                holeZOffset: activeSleeve.holeZOffset,
                baseColor: activeSleeve.baseColor,
                textColor: activeSleeve.textColor,
            };
        });
        setSleeves(newSleeves);
    };

    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={() => {
                const newId = `topper_${Date.now()}`;
                setSleeves([{ ...STRAW_TOPPER_DEFAULTS, id: newId }]);
                setSelectedSleeveId(newId);
            }}
        />
    );

    const sleevesWithLayout = useMemo(() => {
        const columns = 3; // 2 columns for wide straw toppers
        const spacingX = 80;
        const spacingY = 35;

        // Approximate width of each sleeve
        const withWidth = sleeves.map((sleeve) => {
            const textStr = sleeve.text || "Name";
            // Rough width approximation: character count * size * 0.85 + borders
            const approxWidth =
                textStr.length * (sleeve.size * 0.85) + sleeve.baseOffset * 2;
            return { ...sleeve, approxWidth };
        });

        const numRows = Math.ceil(sleeves.length / columns);
        const actualColumns = Math.min(sleeves.length, columns);

        const totalWidth = actualColumns * spacingX - spacingX;
        const totalHeight = numRows * spacingY - spacingY;

        const startX = -totalWidth / 2;
        const startY = totalHeight / 2;

        return withWidth.map((sleeve, i) => {
            const col = i % columns;
            const row = Math.floor(i / columns);

            const layoutX = startX + col * spacingX;
            const layoutY = startY - row * spacingY;

            return {
                ...sleeve,
                layoutX,
                layoutY,
                approxWidth: sleeve.approxWidth,
            };
        });
    }, [sleeves]);

    const dims = useMemo(() => {
        if (sleevesWithLayout.length === 0) return { x: 0, y: 0, z: 0 };
        let minX = Infinity,
            maxX = -Infinity;
        let minY = Infinity,
            maxY = -Infinity;
        let minZ = Infinity,
            maxZ = -Infinity;

        sleevesWithLayout.forEach((s) => {
            const w = s.approxWidth;
            const h = s.size + s.baseOffset * 2;
            const d = s.baseHeight;

            minX = Math.min(minX, s.layoutX - w / 2);
            maxX = Math.max(maxX, s.layoutX + w / 2);
            minY = Math.min(minY, s.layoutY - h / 2);
            maxY = Math.max(maxY, s.layoutY + h / 2);
            minZ = Math.min(minZ, 0);
            maxZ = Math.max(maxZ, d);
        });
        return {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ,
        };
    }, [sleevesWithLayout]);

    return (
        <EditorLayout
            title="Straw Toppers"
            icon={<TextSelect className="w-5 h-5" />}
            topBarActions={topBarActions}
            sidebarContent={
                <div className="space-y-4">
                    <SidebarSection title="YOUR TOPPERS" icon={TextSelect}>
                        <div className="flex flex-col gap-2">
                            {sleeves.map((sleeve, idx) => (
                                <div
                                    key={sleeve.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragEnter={(e) => handleDragEnter(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => setSelectedId(sleeve.id)}
                                    className={`flex items-center justify-between p-2 rounded-lg border-2 cursor-pointer transition-colors ${
                                        selectedId === sleeve.id
                                            ? "border-primary bg-primary/5"
                                            : "border-gray-200 hover:border-primary/50"
                                    } ${
                                        draggedItemIdx === idx
                                            ? "opacity-50"
                                            : ""
                                    } ${
                                        dragOverItemIdx === idx &&
                                        draggedItemIdx !== idx
                                            ? "border-primary shadow-md transform scale-[1.02]"
                                            : ""
                                    }`}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab hover:text-gray-500 flex-shrink-0" />
                                        <span className="font-medium truncate max-w-[130px]">
                                            {sleeve.text || `Topper ${idx + 1}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newId = `topper_${Date.now()}`;
                                                const duplicated = {
                                                    ...sleeve,
                                                    id: newId,
                                                };
                                                const newArr = [...sleeves];
                                                newArr.splice(
                                                    idx + 1,
                                                    0,
                                                    duplicated,
                                                );
                                                setSleeves(newArr);
                                                setSelectedId(newId);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-white rounded"
                                            title="Duplicate">
                                            <CopyPlus className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(sleeve.id);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded"
                                            title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={handleAdd}
                                className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 font-medium transition-colors">
                                <CopyPlus className="w-4 h-4 mr-2" /> Add Topper
                            </button>
                        </div>
                    </SidebarSection>

                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 mt-6 mb-2 px-1 tracking-wider">
                        <span>ACTIVE SETTINGS</span>
                        <button
                            onClick={handleApplyToAll}
                            className="px-2 py-1 bg-gray-100 text-secondary border border-secondary/20 hover:bg-secondary hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors"
                            title="Apply size, colors, holes, etc. to all charms">
                            Apply to All
                        </button>
                    </div>

                    <SidebarSection title="TEXT & FONT" icon={Type}>
                        <ControlInput
                            label="TEXT"
                            value={activeSleeve.text}
                            onChange={(e) =>
                                updateActive({ text: e.target.value })
                            }
                            placeholder="Type name here..."
                            onApplyAll={() =>
                                applySettingsToAll("text", activeSleeve.text)
                            }
                        />
                        <ControlSelect
                            label="FONT FAMILY"
                            value={activeSleeve.font}
                            onChange={(val) => updateActive({ font: val })}
                            options={fontOptions}
                            prefixType="font"
                        />
                    </SidebarSection>
                    <SidebarSection title="COLORS" icon={PaintBucket}>
                        <ControlColorPicker
                            label="TOP COLOR (TEXT)"
                            value={activeSleeve.textColor}
                            onChange={(val) => updateActive({ textColor: val })}
                            options={colorOptions}
                        />
                        <ControlColorPicker
                            label="BASE COLOR"
                            value={activeSleeve.baseColor}
                            onChange={(val) => updateActive({ baseColor: val })}
                            options={colorOptions}
                        />
                    </SidebarSection>

                    <SidebarSection title="DIMENSIONS" icon={Ruler}>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider
                                label="TEXT SIZE"
                                value={activeSleeve.size}
                                min={10}
                                max={40}
                                step={1}
                                onChange={(val) => updateActive({ size: val })}
                                onApplyAll={() =>
                                    applySettingsToAll(
                                        "size",
                                        activeSleeve.size,
                                    )
                                }
                            />
                            <ControlSlider
                                label="TEXT THICKNESS (MM)"
                                value={activeSleeve.depth}
                                min={0.5}
                                max={10.0}
                                step={0.1}
                                onChange={(val) => updateActive({ depth: val })}
                                onApplyAll={() =>
                                    applySettingsToAll(
                                        "depth",
                                        activeSleeve.depth,
                                    )
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider
                                label="STRAW HOLE DIAMETER (MM)"
                                value={activeSleeve.holeDiameter}
                                min={5.0}
                                max={12.0}
                                step={0.1}
                                onChange={(val) =>
                                    updateActive({ holeDiameter: val })
                                }
                                onApplyAll={() =>
                                    applySettingsToAll(
                                        "holeDiameter",
                                        activeSleeve.holeDiameter,
                                    )
                                }
                            />
                            <ControlSlider
                                label="HOLE Z OFFSET (MM)"
                                value={activeSleeve.holeZOffset}
                                min={-10.0}
                                max={10.0}
                                step={0.1}
                                onChange={(val) =>
                                    updateActive({ holeZOffset: val })
                                }
                                onApplyAll={() =>
                                    applySettingsToAll(
                                        "holeZOffset",
                                        activeSleeve.holeZOffset,
                                    )
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider
                                label="BASE THICKNESS (MM)"
                                value={activeSleeve.baseHeight}
                                min={2.0}
                                max={20.0}
                                step={0.1}
                                onChange={(val) =>
                                    updateActive({ baseHeight: val })
                                }
                                onApplyAll={() =>
                                    applySettingsToAll(
                                        "baseHeight",
                                        activeSleeve.baseHeight,
                                    )
                                }
                            />
                            <ControlSlider
                                label="OUTLINE WIDTH (MM)"
                                value={activeSleeve.baseOffset}
                                min={0.5}
                                max={10.0}
                                step={0.1}
                                onChange={(val) =>
                                    updateActive({ baseOffset: val })
                                }
                                onApplyAll={() =>
                                    applySettingsToAll(
                                        "baseOffset",
                                        activeSleeve.baseOffset,
                                    )
                                }
                            />
                        </div>
                    </SidebarSection>
                </div>
            }>
            {/* --- CANVAS --- */}
            <div className="w-full h-full relative">
                <EditorCanvas title="Straw Toppers" dims={dims}>
                    {sleevesWithLayout.map((sleeve, i) => {
                        return (
                            <group
                                key={sleeve.id}
                                position={[
                                    sleeve.layoutX,
                                    sleeve.layoutY,
                                    sleeve.baseHeight / 2 - 2.5,
                                ]}>
                                <CharmMesh
                                    charm={{
                                        ...sleeve,
                                        type: "text",
                                        charmColor: sleeve.textColor,
                                        holeOrientation: "vertical",
                                        holeCount: 1,
                                    }}
                                />
                            </group>
                        );
                    })}
                </EditorCanvas>
            </div>
        </EditorLayout>
    );
}
