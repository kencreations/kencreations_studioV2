import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { useFontStore } from "../hooks/useFontStore";
import { useHistoryState } from "../hooks/useHistoryState";
import { HistoryControls } from "../components/HistoryControls";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import TemplateManager from "../components/TemplateManager";
import {
    SidebarSection,
    ControlInput,
    ControlSlider,
    ControlSelect,
    ControlColorPicker,
    ControlToggle,
    editorIcons,
} from "../components/UI/EditorControls";
import MassProduceModal from "../components/UI/MassProduceModal";
import PrinterSelector from "../components/PrinterSelector";
import PackedStrawTopperInstance from "../components/3D/PackedStrawTopperInstance";
import MassProduceSidebar from "../components/MassProduceSidebar";
import SmartText3D from "../components/3D/Shared/SmartText3D";
import SmartCSGBase from "../components/3D/Shared/SmartCSGBase";
import { STRAW_TOPPER_DEFAULTS } from "../store/appState";

function StrawTopperSidebar({
    onBack,
    config,
    setConfig,
    allFonts,
}) {
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

    const fontOptions = useMemo(
        () =>
            allFonts.map((font) => ({
                label: font.label,
                value: font.id,
            })),
        [allFonts],
    );

    const handleLoadTemplate = (savedSettings) => {
        setConfig((prev) => ({
            ...prev,
            ...savedSettings,
            text: prev.text // Preserve the current text when loading template
        }));
    };

    return (
        <div className="flex h-full flex-col gap-4 text-slate-700">
            <PrinterSelector />
            <TemplateManager
                editorId="strawtopper"
                currentSettings={config}
                excludeKeys={["text"]}
                onLoadTemplate={handleLoadTemplate}
            />

            <SidebarSection title="Text & Font" icon={editorIcons.text}>
                <ControlInput
                    label="Text"
                    value={config.text ?? ""}
                    onChange={(e) =>
                        setConfig(prev => ({ ...prev, text: e.target.value }))
                    }
                    placeholder="Enter text"
                />
                <ControlSelect
                    label="Font"
                    value={config.font}
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, font: value }))
                    }
                    options={fontOptions}
                    prefixType="font"
                />
                <ControlColorPicker
                    label="Text Color"
                    value={config.textColor}
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, textColor: value }))
                    }
                    options={colorOptions}
                />
                <div className="grid grid-cols-2 gap-3">
                    <ControlSlider
                        label="Size"
                        value={config.size}
                        min={10}
                        max={40}
                        step={1}
                        unit="mm"
                        onChange={(value) =>
                            setConfig(prev => ({ ...prev, size: value }))
                        }
                    />
                    <ControlSlider
                        label="Depth"
                        value={config.depth}
                        min={1}
                        max={10}
                        step={0.1}
                        unit="mm"
                        onChange={(value) =>
                            setConfig(prev => ({ ...prev, depth: value }))
                        }
                    />
                </div>
            </SidebarSection>

            <SidebarSection title="Base" icon={editorIcons.layers}>
                <ControlSlider
                    label="Base Thickness"
                    value={config.baseHeight}
                    min={2}
                    max={20}
                    step={0.1}
                    unit="mm"
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, baseHeight: value }))
                    }
                />
                <ControlSlider
                    label="Outline Width"
                    value={config.baseOffset}
                    min={0.5}
                    max={10}
                    step={0.1}
                    unit="mm"
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, baseOffset: value }))
                    }
                />
                <ControlColorPicker
                    label="Base Color"
                    value={config.baseColor}
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, baseColor: value }))
                    }
                    options={colorOptions}
                />
            </SidebarSection>

            <SidebarSection title="Straw Hole" icon={editorIcons.settings}>
                <ControlSlider
                    label="Diameter"
                    value={config.holeDiameter}
                    min={5}
                    max={15}
                    step={0.1}
                    unit="mm"
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, holeDiameter: value }))
                    }
                />
                <ControlSlider
                    label="Z Offset"
                    value={config.holeZOffset}
                    min={-10}
                    max={10}
                    step={0.1}
                    unit="mm"
                    onChange={(value) =>
                        setConfig(prev => ({ ...prev, holeZOffset: value }))
                    }
                />
            </SidebarSection>
        </div>
    );
}

const getDefaultConfig = (defaultFontId) => ({
    text: STRAW_TOPPER_DEFAULTS.text || "Name",
    font: defaultFontId,
    size: STRAW_TOPPER_DEFAULTS.size ?? 20,
    depth: STRAW_TOPPER_DEFAULTS.depth ?? 2,
    textColor: STRAW_TOPPER_DEFAULTS.textColor || "#FFFFFF",
    baseHeight: STRAW_TOPPER_DEFAULTS.baseHeight ?? 6,
    baseOffset: STRAW_TOPPER_DEFAULTS.baseOffset ?? 4,
    baseColor: STRAW_TOPPER_DEFAULTS.baseColor || "#EC008C",
    holeDiameter: STRAW_TOPPER_DEFAULTS.holeDiameter ?? 8,
    holeZOffset: STRAW_TOPPER_DEFAULTS.holeZOffset ?? 0,
});

export default function StrawTopperEditor() {
    const { allFonts } = useFontStore();
    const defaultFontId =
        allFonts.find(
            (f) =>
                f.label === STRAW_TOPPER_DEFAULTS.font ||
                f.id === STRAW_TOPPER_DEFAULTS.font,
        )?.id ||
        allFonts[0]?.id ||
        "Arial";

    const [config, setConfig, { undo, redo, canUndo, canRedo }] =
        useHistoryState(getDefaultConfig(defaultFontId));

    const canvasRef = useRef();

    // Mass Produce state
    const [isMassProduceOpen, setIsMassProduceOpen] = useState(false);
    const [isMassExporting, setIsMassExporting] = useState(false);
    const [packedInstances, setPackedInstances] = useState([]);
    const [currentPlateView, setCurrentPlateView] = useState(0);
    const [activeInstanceId, setActiveInstanceId] = useState(null);
    const [sidebarMode, setSidebarMode] = useState("editSelected");
    const [massProducePrinter, setMassProducePrinter] = useState(null);
    
    // Preview Shapes
    const [textShapes, setTextShapes] = useState([]);
    const [centerOffset, setCenterOffset] = useState({ cx: 0, cy: 0 });

    const handleShapesReady = useCallback((shapes) => {
        setTextShapes(shapes);
    }, []);

    const handleBaseReady = useCallback((geo, bb, offset) => {
        setCenterOffset(offset || { cx: 0, cy: 0 });
    }, []);

    const handleReset = () => {
        setConfig({
            ...getDefaultConfig(defaultFontId),
        });
    };

    const totalPlates = useMemo(() => {
        if (!packedInstances || packedInstances.length === 0) return 1;
        return Math.max(...packedInstances.map((i) => i.plateIndex ?? 0)) + 1;
    }, [packedInstances]);

    const handleMassProducePack = useCallback(
        (result) => {
            const instances = result.packed.map((item) => ({
                ...item,
                depthDim: item.depth,
                font: config.font,
                size: config.size,
                depth: config.depth,
                textColor: config.textColor,
                baseHeight: config.baseHeight,
                baseOffset: config.baseOffset,
                baseColor: config.baseColor,
                holeDiameter: config.holeDiameter,
                holeZOffset: config.holeZOffset,
            }));

            setPackedInstances(instances);
            setMassProducePrinter(result.printer);
            setCurrentPlateView(0);
            setActiveInstanceId(null);
            setIsMassProduceOpen(false);
        },
        [config],
    );

    const handleUpdateInstance = useCallback((id, updates) => {
        setPackedInstances((prev) =>
            prev.map((inst) =>
                inst.id === id ? { ...inst, ...updates } : inst,
            ),
        );
    }, []);

    const handleApplyToAll = useCallback((updates) => {
        setPackedInstances((prev) =>
            prev.map((inst) => ({ ...inst, ...updates })),
        );
    }, []);

    const handleClearPackedInstances = useCallback(() => {
        setPackedInstances([]);
        setActiveInstanceId(null);
        setMassProducePrinter(null);
    }, []);

    const handleMassExportPlate = async (plateNumber) => {
        if (canvasRef.current && canvasRef.current.export3MF) {
            await canvasRef.current.export3MF(
                `Mass_Produce_StrawToppers_Plate_${plateNumber}.3mf`,
            );
        }
    };

    const handleMassExportAll = async () => {
        if (!canvasRef.current || !canvasRef.current.export3MF) return;
        setIsMassExporting(true);
        try {
            const originalView = currentPlateView;
            const originalActiveId = activeInstanceId;
            setActiveInstanceId(null);

            for (let i = 0; i < totalPlates; i++) {
                setCurrentPlateView(i);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                await canvasRef.current.export3MF(
                    `Mass_Produce_StrawToppers_Plate_${i + 1}.3mf`,
                );
            }

            setCurrentPlateView(originalView);
            setActiveInstanceId(originalActiveId);
            alert("Batch export complete!");
        } catch (err) {
            console.error("Batch export failed", err);
            alert("Batch export failed: " + err.message);
        } finally {
            setIsMassExporting(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                e.target.tagName.toLowerCase() === "input" &&
                e.target.type === "text"
            )
                return;
            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            if (cmdOrCtrl && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    if (canRedo) redo();
                } else {
                    if (canUndo) undo();
                }
            }
            if (cmdOrCtrl && e.key.toLowerCase() === "y") {
                e.preventDefault();
                if (canRedo) redo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo, canUndo, canRedo]);

    const isMassProduceMode = packedInstances.length > 0;

    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={handleReset}
        />
    );

    return (
        <EditorLayout
            title={
                isMassProduceMode
                    ? "Mass Produce Straw Toppers"
                    : "Straw Topper Editor"
            }
            icon={
                <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                </svg>
            }
            topBarActions={topBarActions}
            sidebarContent={
                isMassProduceMode ? (
                    <MassProduceSidebar
                        packedInstances={packedInstances}
                        currentPlateView={currentPlateView}
                        totalPlates={totalPlates}
                        activeInstanceId={activeInstanceId}
                        sidebarMode={sidebarMode}
                        onSidebarModeChange={setSidebarMode}
                        onUpdateInstance={handleUpdateInstance}
                        onApplyToAll={handleApplyToAll}
                        onChangePlate={setCurrentPlateView}
                        onClearAll={handleClearPackedInstances}
                        onExportPlate={handleMassExportPlate}
                        onExportAll={handleMassExportAll}
                        isExporting={isMassExporting}
                    />
                ) : (
                    <StrawTopperSidebar
                        config={config}
                        setConfig={setConfig}
                        allFonts={allFonts}
                    />
                )
            }>
            <div className="relative h-full w-full">
                <EditorCanvas
                    title="Straw Toppers"
                    ref={canvasRef}
                    dims={{ x: 100, y: 100, z: config.baseHeight }}
                    leftToolbarActions={
                        !isMassProduceMode ? (
                            <>
                                <button
                                    onClick={() => setIsMassProduceOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-orange-400 text-orange-500 font-bold text-sm hover:bg-orange-50 transition-colors"
                                    title="Mass Produce — Pack onto build plate">
                                    🏭 Mass Produce
                                </button>
                            </>
                        ) : null
                    }
                >
                    {isMassProduceMode ? (
                        packedInstances
                            .filter((i) => i.plateIndex === currentPlateView)
                            .map((instance) => (
                                <PackedStrawTopperInstance
                                    key={instance.id}
                                    instance={instance}
                                    isActive={activeInstanceId === instance.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveInstanceId(instance.id);
                                    }}
                                    threeX={instance.threeX}
                                    threeY={instance.threeY}
                                    visible={true}
                                />
                            ))
                    ) : (
                        <group position={[0, 0, Number(config.baseHeight) - 3.0]}>
                            <SmartText3D
                                text={config.text}
                                fontId={config.font}
                                size={Number(config.size)}
                                depth={Number(config.depth)}
                                color={config.textColor}
                                centerOffset={centerOffset}
                                onShapesReady={handleShapesReady}
                            />
                            <SmartCSGBase
                                textShapes={textShapes}
                                thickness={Number(config.baseHeight)}
                                padding={Number(config.baseOffset)}
                                color={config.baseColor}
                                holeCount={1}
                                holeDiameter={Number(config.holeDiameter)}
                                holeOrientation="vertical"
                                holeDistance={0}
                                holeZOffset={Number(config.holeZOffset)}
                                onGeometryReady={handleBaseReady}
                            />
                        </group>
                    )}
                </EditorCanvas>
            </div>

            <MassProduceModal
                isOpen={isMassProduceOpen}
                onClose={() => setIsMassProduceOpen(false)}
                onPack={handleMassProducePack}
                editorConfig={config}
            />
        </EditorLayout>
    );
}
