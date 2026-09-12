import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { load3DFont } from "../utils/fontManager";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
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
import { exportTo3MF } from "three-3mf-exporter";
import { saveAs } from "file-saver";
import {
    createTextShapesWithSpacing,
    offsetShapes,
    unionShapes,
} from "../utils/textContour";
import { KEYCHAIN_DEFAULTS } from "../store/appState"; // ─── UI Helper Components ──────────────────────────────────────────────────────
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
    const customMatch = customColors.find(
        (c) => c.hex_code.toLowerCase() === hex.toLowerCase(),
    );
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
        customColors.forEach((c) => {
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
            left: 0,
            top: "calc(100% + 8px)",
            zIndex: 50,
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
        <div
            className="w-96 rounded-2xl border border-secondary bg-white p-4 shadow-2xl"
            style={drawerStyle}>
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
                    <div
                        key={color.hex + color.name}
                        className="flex flex-col items-center">
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
    const { allFonts } = useProfile();

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
        return Math.max(...packedInstances.map(i => i.plateIndex ?? 0)) + 1;
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
    const handleMassProducePack = useCallback((result) => {
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
    }, [config]);

    const handleUpdateInstance = useCallback((id, updates) => {
        setPackedInstances((prev) => 
            prev.map(inst => inst.id === id ? { ...inst, ...updates } : inst)
        );
    }, []);

    const handleApplyToAll = useCallback((updates) => {
        setPackedInstances((prev) => 
            prev.map(inst => ({ ...inst, ...updates }))
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
            await canvasRef.current.export3MF(`Mass_Produce_Plate_${plateNumber}.3mf`);
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
                await new Promise(resolve => setTimeout(resolve, 1000));
                await canvasRef.current.export3MF(`Mass_Produce_Plate_${i + 1}.3mf`);
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

    // Geometry States
    const [textGeo, setTextGeo] = useState(null);
    const [baseGeo, setBaseGeo] = useState(null);
    const [ringGeo, setRingGeo] = useState(null);
    const [dims, setDims] = useState(null);

    const fontCacheRef = useRef({});
    const loadedFontRef = useRef(null);
    const textShapesRef = useRef([]);
    const baseBBRef = useRef(null);

    const translateShape2D = useCallback((shape, dx, dy) => {
        const translatedOuter = shape
            .getPoints(16)
            .map((p) => new THREE.Vector2(p.x + dx, p.y + dy));
        const translatedShape = new THREE.Shape(translatedOuter);

        for (const hole of shape.holes) {
            const translatedHole = hole
                .getPoints(16)
                .map((p) => new THREE.Vector2(p.x + dx, p.y + dy));
            translatedShape.holes.push(new THREE.Path(translatedHole));
        }

        return translatedShape;
    }, []);

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

    const buildBase = (shapes, bHeight, bOffset, textDepths = []) => {
        const solidShapes = shapes.length > 0 ? unionShapes(shapes) : shapes;
        const baseShapes = offsetShapes(solidShapes, bOffset);
        let rawBase =
            baseShapes.length > 0
                ? new THREE.ExtrudeGeometry(baseShapes, {
                      depth: bHeight,
                      bevelEnabled: false,
                      curveSegments: 16,
                  })
                : new THREE.BoxGeometry(20, 10, bHeight);

        rawBase.computeBoundingBox();
        const bb = rawBase.boundingBox;

        // Push the base down so its top face rests at Z=0
        rawBase.translate(0, 0, -bHeight);
        rawBase.computeBoundingBox();

        baseBBRef.current = rawBase.boundingBox.clone();

        const mergedBase = BufferGeometryUtils.mergeVertices(rawBase);
        if (mergedBase.attributes.uv) {
            mergedBase.deleteAttribute("uv");
        }
        setBaseGeo(mergedBase);

        mergedBase.computeBoundingBox();
        const fb = mergedBase.boundingBox;
        const maxDepth = textDepths.length ? Math.max(...textDepths) : 0;
        setDims({
            x: Math.round((fb.max.x - fb.min.x) * 10) / 10,
            y: Math.round((fb.max.y - fb.min.y) * 10) / 10,
            z: Math.round((fb.max.z - fb.min.z + maxDepth) * 10) / 10,
        });
    };
    const textGeoDeps = JSON.stringify(
        config.texts.map((t) => ({
            text: t.text,
            font: t.font,
            size: t.size,
            depth: t.depth,
            x: t.x,
            y: t.y,
        })),
    );

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (!config.texts.length) {
                setTextGeo(null);
                setBaseGeo(null);
                return;
            }

            const allShapes = [];
            const lineGeometries = [];
            const textDepths = [];

            for (const line of config.texts) {
                const fontOption = allFonts.find(
                    (f) => f.id === line.font || f.label === line.font,
                );
                if (!fontOption) continue;

                if (!fontCacheRef.current[fontOption.id]) {
                    try {
                        fontCacheRef.current[fontOption.id] =
                            await load3DFont(fontOption);
                    } catch (err) {
                        console.error(
                            "Failed to load font in KeychainEditor:",
                            err,
                        );
                        continue;
                    }
                }

                const loadedFont = fontCacheRef.current[fontOption.id];
                loadedFontRef.current = loadedFont;

                const lineShapes = createTextShapesWithSpacing(
                    line.text || "",
                    loadedFont,
                    line.size,
                    0,
                ).map((shape) =>
                    translateShape2D(shape, line.x || 0, line.y || 0),
                );

                allShapes.push(...lineShapes);

                if (lineShapes.length > 0) {
                    const lineGeo = new THREE.ExtrudeGeometry(lineShapes, {
                        depth: line.depth,
                        bevelEnabled: false,
                        curveSegments: 4,
                    });
                    lineGeometries.push({
                        geometry: BufferGeometryUtils.mergeVertices(lineGeo),
                        id: line.id,
                    });
                    textDepths.push(line.depth || 0);
                }
            }

            textShapesRef.current = allShapes;

            if (lineGeometries.length > 0) {
                setTextGeo(lineGeometries);
            } else {
                setTextGeo(null);
            }

            buildBase(
                allShapes,
                config.base.thickness,
                config.base.padding,
                textDepths,
            );
        }, 100);

        return () => clearTimeout(handler);
    }, [textGeoDeps, allFonts, translateShape2D]);

    // ── Effect B (FAST): runs only when base outline sliders change ───────────
    // Uses the cached font shapes — NO font loading, NO text geometry rebuild.
    useEffect(() => {
        if (!loadedFontRef.current || textShapesRef.current.length === 0)
            return;

        const handler = setTimeout(() => {
            buildBase(
                textShapesRef.current,
                config.base.thickness,
                config.base.padding,
                config.texts.map((line) => line.depth || 0),
            );
        }, 50); // shorter debounce since this is purely synchronous math

        return () => clearTimeout(handler);
    }, [config.base.padding, config.base.thickness]);

    // ── Effect 2 (FAST): Rebuild only the ring when ring params change ──
    // This does NOT reload the font or rebuild base geometry — instant response.
    useEffect(() => {
        if (!config.keyring.enabled) {
            setRingGeo(null);
            return;
        }

        const bb = baseBBRef.current;

        // Build ring shape
        const ringShape = new THREE.Shape();
        ringShape.absarc(
            0,
            0,
            config.keyring.diameter / 2,
            0,
            Math.PI * 2,
            false,
        );
        const hole = new THREE.Path();
        hole.absarc(0, 0, config.keyring.hole / 2, 0, Math.PI * 2, true);
        ringShape.holes.push(hole);

        const ringExtrudeGeo = new THREE.ExtrudeGeometry(ringShape, {
            depth: config.base.thickness,
            bevelEnabled: false,
            curveSegments: 32,
        });

        // Position relative to base bounding box (or fallback to origin if bb not ready)
        const anchorY = bb ? bb.max.y : 0;
        const anchorX = bb ? bb.min.x : 0;
        ringExtrudeGeo.translate(
            anchorX + config.keyring.x,
            anchorY + config.keyring.y,
            -config.base.thickness,
        );

        const mergedRing = BufferGeometryUtils.mergeVertices(ringExtrudeGeo);
        if (mergedRing.attributes.uv) {
            mergedRing.deleteAttribute("uv");
        }

        setRingGeo(mergedRing);
    }, [
        config.keyring.enabled,
        config.keyring.diameter,
        config.keyring.hole,
        config.keyring.x,
        config.keyring.y,
        config.base.thickness,
        baseGeo,
    ]);
    // baseGeo in deps ensures ring re-anchors if base is rebuilt

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
                            className="px-5 py-2.5 text-secondary hover:bg-secondary/10 hover:text-secondary transition-colors border-r border-secondary/20 flex items-center gap-2"
                            title="Mass Creation (Batch Export)">
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                            Batch Export
                        </button>
                        <div className="flex bg-white/90 backdrop-blur-md border border-primary shadow-lg rounded-xl overflow-hidden text-sm font-semibold transition-all">
                            <button
                                onClick={() => setIsMassProduceOpen(true)}
                                className="px-5 py-2.5 text-primary hover:bg-primary hover:text-white transition-colors flex items-center gap-2"
                                title="Mass Produce — Pack onto build plate">
                                🏭 Mass Produce
                            </button>
                        </div>
                    </>
                }>
                {packedInstances.length > 0 ? (
                    <group>
                        {packedInstances
                            .map((inst) => {
                                const plateWidth = massProducePrinter?.usableWidth || 256;
                                const plateDepth = massProducePrinter?.usableDepth || 256;
                                const threeX = inst.x - (plateWidth / 2) + (inst.width / 2);
                                const threeY = (plateDepth / 2) - inst.y - (inst.height / 2);
                                return (
                                    <PackedKeychainInstance
                                        key={inst.id}
                                        instance={inst}
                                        isActive={inst.id === activeInstanceId}
                                        onClick={setActiveInstanceId}
                                        threeX={threeX}
                                        threeY={threeY}
                                        visible={inst.plateIndex === currentPlateView}
                                    />
                                );
                            })}
                    </group>
                ) : (
                    <group>
                        {/* Base mesh — hex sanitized to strip any alpha channel (#RRGGBBAA → #RRGGBB) */}
                        {baseGeo && (
                            <mesh geometry={baseGeo} castShadow receiveShadow>
                                <meshStandardMaterial
                                    color={
                                        config.base.color?.length > 7
                                            ? config.base.color.substring(0, 7)
                                            : config.base.color
                                    }
                                />
                            </mesh>
                        )}
                        {/* Text meshes */}
                        {textGeo &&
                            Array.isArray(textGeo) &&
                            textGeo.map((t) => {
                                const lineData =
                                    config.texts.find((line) => line.id === t.id) ||
                                    config.texts[0];
                                const col = lineData?.color || "#ffffff";
                                return (
                                    <mesh
                                        key={t.id}
                                        geometry={t.geometry}
                                        position={[0, 0, 0.1]}
                                        castShadow
                                        receiveShadow>
                                        <meshStandardMaterial
                                            color={
                                                col.length > 7
                                                    ? col.substring(0, 7)
                                                    : col
                                            }
                                        />
                                    </mesh>
                                );
                            })}
                        {/* Keyring — separate mesh for instant repositioning */}
                        {config.keyring.enabled && ringGeo && (
                            <mesh geometry={ringGeo} castShadow receiveShadow>
                                <meshStandardMaterial
                                    color={
                                        config.base.color?.length > 7
                                            ? config.base.color.substring(0, 7)
                                            : config.base.color
                                    }
                                />
                            </mesh>
                        )}
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
