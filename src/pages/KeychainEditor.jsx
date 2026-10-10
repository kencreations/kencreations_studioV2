import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";

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
import { BatchExportModal } from "../components/UI/BatchExportModal";
import MassProduceModal from "../components/UI/MassProduceModal";
import PrinterSelector from "../components/PrinterSelector";
import PackedKeychainInstance from "../components/3D/PackedKeychainInstance";
import MassProduceSidebar from "../components/MassProduceSidebar";
import SmartText3D from "../components/3D/Shared/SmartText3D";
import SmartBase from "../components/3D/Shared/SmartBase";
import SmartKeyring from "../components/3D/Shared/SmartKeyring";
import { KEYCHAIN_DEFAULTS } from "../store/appState"; // ─── UI Helper Components ──────────────────────────────────────────────────────

function KeychainSidebar({
    onBack,
    config,
    setConfig,
    updateTextLine,
    addTextLine,
    removeTextLine,
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
        setConfig((prev) => {
            let mergedTexts = prev.texts;
            if (savedSettings.texts) {
                mergedTexts = savedSettings.texts.map((savedLine, index) => {
                    const prevLine = prev.texts[index] || { text: "" };
                    return {
                        ...savedLine,
                        text: prevLine.text, // Preserve the user's current text
                    };
                });
            }
            return {
                ...prev,
                ...savedSettings,
                texts: mergedTexts,
            };
        });
    };

    return (
        <div className="flex h-full flex-col gap-4 text-slate-700">
            <PrinterSelector />
            <TemplateManager
                editorId="keychain"
                currentSettings={config}
                excludeKeys={["text"]}
                onLoadTemplate={handleLoadTemplate}
            />
            <SidebarSection title="Text" icon={editorIcons.text}>
                {config.texts.map((line, index) => (
                    <div
                        key={line.id}
                        className="rounded-xl border border-secondary/40 bg-slate-50/80 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#00A3A3]">
                                Text Line {index + 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeTextLine(line.id)}
                                disabled={config.texts.length <= 1}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                                title={
                                    config.texts.length <= 1
                                        ? "At least one line is required"
                                        : "Remove line"
                                }>
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3.5 w-3.5">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-3">
                            <ControlInput
                                label="Text"
                                value={line.text ?? ""}
                                onChange={(e) =>
                                    updateTextLine(line.id, {
                                        text: e.target.value,
                                    })
                                }
                                placeholder="Enter text"
                            />
                            <ControlSelect
                                label="Font"
                                value={line.font}
                                onChange={(value) =>
                                    updateTextLine(line.id, { font: value })
                                }
                                options={fontOptions}
                                prefixType="font"
                            />
                            <ControlColorPicker
                                label="Color"
                                value={line.color}
                                onChange={(value) =>
                                    updateTextLine(line.id, { color: value })
                                }
                                options={colorOptions}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <ControlSlider
                                    label="Size"
                                    value={line.size}
                                    min={6}
                                    max={32}
                                    step={1}
                                    unit="mm"
                                    onChange={(value) =>
                                        updateTextLine(line.id, {
                                            size: value,
                                        })
                                    }
                                />
                                <ControlSlider
                                    label="Depth"
                                    value={line.depth}
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    unit="mm"
                                    onChange={(value) =>
                                        updateTextLine(line.id, {
                                            depth: value,
                                        })
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <ControlSlider
                                    label="X Pos"
                                    value={line.x}
                                    min={-60}
                                    max={60}
                                    step={0.5}
                                    unit="mm"
                                    onChange={(value) =>
                                        updateTextLine(line.id, {
                                            x: value,
                                        })
                                    }
                                />
                                <ControlSlider
                                    label="Y Pos"
                                    value={line.y}
                                    min={-60}
                                    max={60}
                                    step={0.5}
                                    unit="mm"
                                    onChange={(value) =>
                                        updateTextLine(line.id, {
                                            y: value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addTextLine}
                    className="w-full rounded-xl border border-dashed border-[#00A3A3]/50 bg-[#00A3A3]/5 px-3 py-2.5 text-sm font-semibold text-[#00A3A3] transition-colors hover:bg-[#00A3A3]/10">
                    + Add Text Line
                </button>
            </SidebarSection>

            <SidebarSection title="Base" icon={editorIcons.layers}>
                <ControlSlider
                    label="Base Thickness"
                    value={config.base.thickness}
                    min={0.5}
                    max={8}
                    step={0.1}
                    unit="mm"
                    onChange={(value) =>
                        setConfig((prev) => ({
                            ...prev,
                            base: { ...prev.base, thickness: value },
                        }))
                    }
                />
                <ControlSlider
                    label="Base Outline"
                    value={config.base.padding}
                    min={1}
                    max={10}
                    step={0.1}
                    unit="mm"
                    onChange={(value) =>
                        setConfig((prev) => ({
                            ...prev,
                            base: { ...prev.base, padding: value },
                        }))
                    }
                />
                <ControlColorPicker
                    label="Base Color"
                    value={config.base.color}
                    onChange={(value) =>
                        setConfig((prev) => ({
                            ...prev,
                            base: { ...prev.base, color: value },
                        }))
                    }
                    options={colorOptions}
                />
            </SidebarSection>

            <SidebarSection title="Keyring" icon={editorIcons.ring}>
                <ControlToggle
                    label="Enable Keyring"
                    checked={config.keyring.enabled}
                    onChange={(enabled) =>
                        setConfig((prev) => ({
                            ...prev,
                            keyring: { ...prev.keyring, enabled },
                        }))
                    }
                />
                <ControlSlider
                    label="Ring Diameter"
                    value={config.keyring.diameter}
                    min={5}
                    max={15}
                    step={0.5}
                    unit="mm"
                    onChange={(diameter) =>
                        setConfig((prev) => ({
                            ...prev,
                            keyring: { ...prev.keyring, diameter },
                        }))
                    }
                />
                <ControlSlider
                    label="Hole Size"
                    value={config.keyring.hole}
                    min={2}
                    max={8}
                    step={0.5}
                    unit="mm"
                    onChange={(hole) =>
                        setConfig((prev) => ({
                            ...prev,
                            keyring: { ...prev.keyring, hole },
                        }))
                    }
                />
                <div className="grid grid-cols-2 gap-3">
                    <ControlSlider
                        label="X Pos"
                        value={config.keyring.x}
                        min={-100}
                        max={100}
                        step={0.5}
                        unit="mm"
                        onChange={(x) =>
                            setConfig((prev) => ({
                                ...prev,
                                keyring: { ...prev.keyring, x },
                            }))
                        }
                    />
                    <ControlSlider
                        label="Y Pos"
                        value={config.keyring.y}
                        min={-100}
                        max={100}
                        step={0.5}
                        unit="mm"
                        onChange={(y) =>
                            setConfig((prev) => ({
                                ...prev,
                                keyring: { ...prev.keyring, y },
                            }))
                        }
                    />
                </div>
            </SidebarSection>
        </div>
    );
}

// ─── Main Keychain Editor ──────────────────────────────────────────────────────

const getDefaultConfig = (defaultFontId) => ({
    texts: [
        {
            id: Date.now(),
            text: KEYCHAIN_DEFAULTS.text || "Name",
            font: defaultFontId,
            size: KEYCHAIN_DEFAULTS.size ?? 20,
            depth: KEYCHAIN_DEFAULTS.depth ?? 2,
            color: KEYCHAIN_DEFAULTS.textColor || "#FFFFFF",
            x: 0,
            y: 0,
        },
    ],
    base: {
        thickness: KEYCHAIN_DEFAULTS.baseHeight ?? 3,
        padding: KEYCHAIN_DEFAULTS.baseOffset ?? 4,
        color: KEYCHAIN_DEFAULTS.baseColor || "#EC008C",
    },
    keyring: {
        enabled: KEYCHAIN_DEFAULTS.keyringEnabled ?? true,
        diameter: KEYCHAIN_DEFAULTS.ringOuter ?? 10,
        hole: KEYCHAIN_DEFAULTS.ringInner ?? 4,
        x: KEYCHAIN_DEFAULTS.ringX ?? 0,
        y: KEYCHAIN_DEFAULTS.ringY ?? 0,
    },
});

export default function KeychainEditor() {
    const { allFonts } = useFontStore();

    const defaultFontId =
        allFonts.find(
            (f) =>
                f.label === KEYCHAIN_DEFAULTS.font ||
                f.id === KEYCHAIN_DEFAULTS.font,
        )?.id ||
        allFonts[0]?.id ||
        "Arial";

    const [config, setConfig, { undo, redo, canUndo, canRedo }] =
        useHistoryState(getDefaultConfig(defaultFontId));

    const canvasRef = useRef();
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgressText, setBatchProgressText] = useState("");

    // ── Mass Produce state ────────────────────────────────────────────────
    const [isMassProduceOpen, setIsMassProduceOpen] = useState(false);
    const [isMassExporting, setIsMassExporting] = useState(false);
    const [packedInstances, setPackedInstances] = useState([]);
    const [currentPlateView, setCurrentPlateView] = useState(0);
    const [activeInstanceId, setActiveInstanceId] = useState(null);
    const [sidebarMode, setSidebarMode] = useState("editSelected"); // "editSelected" | "applyToAll"
    const [massProducePrinter, setMassProducePrinter] = useState(null);

    const totalPlates = React.useMemo(() => {
        if (!packedInstances || packedInstances.length === 0) return 1;
        return Math.max(...packedInstances.map((i) => i.plateIndex ?? 0)) + 1;
    }, [packedInstances]);

    const handleStartBatch = async (namesArray) => {
        setIsBatchProcessing(true);

        // Save the original text so we can restore it after the batch is done
        const originalText = config.texts[0].text;

        for (let i = 0; i < namesArray.length; i++) {
            const currentName = namesArray[i];
            setBatchProgressText(
                `Exporting ${i + 1} of ${namesArray.length}: ${currentName}`,
            );

            // A. Update the state for the primary text line (texts[0])
            setConfig((prev) => {
                const newTexts = [...prev.texts];
                newTexts[0] = { ...newTexts[0], text: currentName };
                return { ...prev, texts: newTexts };
            });

            // B. WAIT for React to render and Three.js to rebuild the 3D geometry
            // (1000ms is usually a safe buffer for text geometry generation)
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // C. Trigger the download (Pass the currentName to format the filename properly)
            if (canvasRef.current && canvasRef.current.exportSTL) {
                await canvasRef.current.exportSTL(
                    `${currentName}_keychain.stl`,
                );
            }
        }

        // Restore original state and close
        setConfig((prev) => {
            const newTexts = [...prev.texts];
            newTexts[0] = { ...newTexts[0], text: originalText };
            return { ...prev, texts: newTexts };
        });

        setIsBatchProcessing(false);
        setIsBatchModalOpen(false);
        alert("Batch export complete!");
    };

    const handleReset = () => {
        setConfig({
            ...getDefaultConfig(defaultFontId),
            texts: [
                { ...getDefaultConfig(defaultFontId).texts[0], id: Date.now() },
            ],
        });
    };

    // ── Mass Produce: Pack callback ──────────────────────────────────────
    const handleMassProducePack = useCallback(
        (result) => {
            // Map packed items to instances carrying the global config
            const instances = result.packed.map((item) => ({
                ...item,
                depthDim: item.depth, // Pack depth (Y-axis size on plate)
                font: config.texts[0]?.font,
                size: config.texts[0]?.size,
                depth: config.texts[0]?.depth,
                textColor: config.texts[0]?.color,
                baseThickness: config.base.thickness,
                basePadding: config.base.padding,
                baseColor: config.base.color,
                keyringEnabled: config.keyring.enabled,
                keyringDiameter: config.keyring.diameter,
                keyringHole: config.keyring.hole,
                keyringX: config.keyring.x,
                keyringY: config.keyring.y,
                textX: config.texts[0]?.x,
                textY: config.texts[0]?.y,
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

    // ── Mass Produce: Export plate as 3MF ─────────────────────────────────
    const handleMassExportPlate = async (plateNumber) => {
        // The canvas is already rendering the current plate view because currentPlateView === plateNumber - 1
        if (canvasRef.current && canvasRef.current.export3MF) {
            await canvasRef.current.export3MF(
                `Mass_Produce_Plate_${plateNumber}.3mf`,
            );
        }
    };

    const handleMassExportAll = async () => {
        if (!canvasRef.current || !canvasRef.current.export3MF) return;
        setIsMassExporting(true);
        try {
            // Save current view
            const originalView = currentPlateView;
            const originalActiveId = activeInstanceId;
            setActiveInstanceId(null);

            // Export each plate
            for (let i = 0; i < totalPlates; i++) {
                setCurrentPlateView(i);
                // Wait for React to render and geometry to generate (1000ms buffer)
                await new Promise((resolve) => setTimeout(resolve, 1000));
                await canvasRef.current.export3MF(
                    `Mass_Produce_Plate_${i + 1}.3mf`,
                );
            }

            // Restore view
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

    const updateTextLine = useCallback((id, updates) => {
        setConfig((prev) => ({
            ...prev,
            texts: prev.texts.map((t) =>
                t.id === id ? { ...t, ...updates } : t,
            ),
        }));
    }, []);

    const addTextLine = useCallback(() => {
        setConfig((prev) => ({
            ...prev,
            texts: [
                ...prev.texts,
                {
                    id: Date.now() + Math.random(),
                    text: "New Line",
                    font: prev.texts[0]?.font || defaultFontId || "Arial",
                    size: 15,
                    depth: 2,
                    color: prev.texts[0]?.color || "#FFFFFF",
                    x: 0,
                    y: -20,
                },
            ],
        }));
    }, [defaultFontId]);

    const removeTextLine = useCallback((id) => {
        setConfig((prev) => {
            if (prev.texts.length <= 1) return prev;
            return {
                ...prev,
                texts: prev.texts.filter((t) => t.id !== id),
            };
        });
    }, []);

    // ── Smart component coordination state ─────────────────────────────────
    const [dims, setDims] = useState(null);
    const [lineShapes, setLineShapes] = useState({});
    const [baseBB, setBaseBB] = useState(null);
    const [centerOffset, setCenterOffset] = useState({ cx: 0, cy: 0 });

    // Aggregate shapes from all SmartText3D instances for SmartBase
    const allTextShapes = useMemo(
        () => Object.values(lineShapes).flat(),
        [lineShapes],
    );

    // Handler: each SmartText3D reports its shapes keyed by line id
    const handleLineShapesReady = useCallback((lineId, shapes) => {
        setLineShapes((prev) => ({ ...prev, [lineId]: shapes }));
    }, []);

    // Handler: SmartBase reports its geometry, bounding box, and center offset
    const handleBaseReady = useCallback(
        (geo, bb, offset) => {
            setBaseBB(bb);
            setCenterOffset(offset || { cx: 0, cy: 0 });

            // Compute dims from base bounding box + max text depth
            if (bb) {
                const maxDepth = config.texts.length
                    ? Math.max(...config.texts.map((t) => t.depth || 0))
                    : 0;
                setDims({
                    x: Math.round((bb.max.x - bb.min.x) * 10) / 10,
                    y: Math.round((bb.max.y - bb.min.y) * 10) / 10,
                    z: Math.round((bb.max.z - bb.min.z + maxDepth) * 10) / 10,
                });
            }
        },
        [config.texts],
    );

    // Clean up stale shape entries when text lines are removed
    useEffect(() => {
        const activeIds = new Set(config.texts.map((t) => t.id));
        setLineShapes((prev) => {
            const cleaned = {};
            for (const key of Object.keys(prev)) {
                if (activeIds.has(Number(key)) || activeIds.has(key)) {
                    cleaned[key] = prev[key];
                }
            }
            return cleaned;
        });
    }, [config.texts.length]);

    useEffect(() => {
        if (!allFonts?.length) return;

        setConfig((prev) => {
            let hasChanges = false;
            const newTexts = prev.texts.map((line) => {
                const matched =
                    allFonts.find(
                        (f) => f.id === line.font || f.label === line.font,
                    )?.id || allFonts[0].id;

                if (line.font !== matched) {
                    hasChanges = true;
                }
                return { ...line, font: matched };
            });

            if (!hasChanges) return prev;

            return {
                ...prev,
                texts: newTexts,
            };
        });
    }, [allFonts]);

    return (
        <EditorLayout
            title="Keychain Editor"
            topBarActions={
                <HistoryControls
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    onReset={handleReset}
                />
            }
            sidebarContent={
                packedInstances.length > 0 ? (
                    <MassProduceSidebar
                        packedInstances={packedInstances}
                        activeInstanceId={activeInstanceId}
                        sidebarMode={sidebarMode}
                        setSidebarMode={setSidebarMode}
                        onUpdateInstance={handleUpdateInstance}
                        onApplyToAll={handleApplyToAll}
                        onClear={handleClearPackedInstances}
                        currentPlateView={currentPlateView}
                        setCurrentPlateView={setCurrentPlateView}
                        plateCount={totalPlates}
                        onExportPlate={handleMassExportPlate}
                        onExportAll={handleMassExportAll}
                        isExporting={isMassExporting}
                    />
                ) : (
                    <KeychainSidebar
                        config={config}
                        setConfig={setConfig}
                        updateTextLine={updateTextLine}
                        addTextLine={addTextLine}
                        removeTextLine={removeTextLine}
                        dims={dims}
                        allFonts={allFonts}
                    />
                )
            }>
            <EditorCanvas
                ref={canvasRef}
                dims={dims}
                config={config}
                title={config.texts[0]?.text || "keychain"}
                leftToolbarActions={
                    <>
                        <button
                            onClick={() => setIsBatchModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-teal-600 font-bold text-sm hover:bg-teal-50 transition-colors"
                            title="Mass Creation (Batch Export)">
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                            Batch Export
                        </button>
                        <button
                            onClick={() => setIsMassProduceOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-orange-400 text-orange-500 font-bold text-sm hover:bg-orange-50 transition-colors"
                            title="Mass Produce — Pack onto build plate">
                            🏭 Mass Produce
                        </button>
                    </>
                }>
                {packedInstances.length > 0 ? (
                    <group>
                        {packedInstances.map((inst) => {
                            const plateWidth =
                                massProducePrinter?.usableWidth || 256;
                            const plateDepth =
                                massProducePrinter?.usableDepth || 256;
                            const threeX =
                                inst.x - plateWidth / 2 + inst.width / 2;
                            const threeY =
                                plateDepth / 2 - inst.y - inst.height / 2;
                            return (
                                <PackedKeychainInstance
                                    key={inst.id}
                                    instance={inst}
                                    isActive={inst.id === activeInstanceId}
                                    onClick={setActiveInstanceId}
                                    threeX={threeX}
                                    threeY={threeY}
                                    visible={
                                        inst.plateIndex === currentPlateView
                                    }
                                />
                            );
                        })}
                    </group>
                ) : (
                    <group>
                        {/* ── Text meshes (each fires shapes upstream) ── */}
                        {config.texts.map((line) => (
                            <SmartText3D
                                key={line.id}
                                text={line.text}
                                fontId={line.font}
                                size={line.size}
                                depth={line.depth}
                                offsetX={line.x || 0}
                                offsetY={line.y || 0}
                                color={line.color || "#ffffff"}
                                centerOffset={centerOffset}
                                onShapesReady={(shapes) =>
                                    handleLineShapesReady(line.id, shapes)
                                }
                            />
                        ))}

                        {/* ── Base plate (consumes aggregated shapes) ── */}
                        <SmartBase
                            textShapes={allTextShapes}
                            thickness={config.base.thickness}
                            padding={config.base.padding}
                            color={config.base.color}
                            onGeometryReady={handleBaseReady}
                        />

                        {/* ── Keyring (anchors to centered base BB) ── */}
                        <SmartKeyring
                            enabled={config.keyring.enabled}
                            diameter={config.keyring.diameter}
                            holeDiameter={config.keyring.hole}
                            thickness={config.base.thickness}
                            baseBoundingBox={baseBB}
                            offsetX={config.keyring.x}
                            offsetY={config.keyring.y}
                            color={config.base.color}
                        />
                    </group>
                )}
            </EditorCanvas>

            <BatchExportModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                onStartBatch={handleStartBatch}
                isProcessing={isBatchProcessing}
                progressText={batchProgressText}
            />

            <MassProduceModal
                isOpen={isMassProduceOpen}
                onClose={() => setIsMassProduceOpen(false)}
                onPack={handleMassProducePack}
                editorConfig={config}
            />
        </EditorLayout>
    );
}
