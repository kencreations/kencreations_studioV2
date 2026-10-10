import React, {
    useState,
    useCallback,
    useRef,
    useEffect,
    useMemo,
} from "react";
import { Link } from "react-router-dom";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import SceneKeycap, {
    lettersFromLegends,
    computeSetBounds,
} from "../components/SceneKeycap";
import { KEYCAP_DEFAULTS } from "../store/appState";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { useHistoryState } from "../hooks/useHistoryState";
import { HistoryControls } from "../components/HistoryControls";
import { useProfile } from "../contexts/ProfileContext";
import { useFontStore } from "../hooks/useFontStore";
import PrinterSelector from "../components/PrinterSelector";
import TemplateManager from "../components/TemplateManager";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
    SidebarSection,
    ControlInput,
    ControlSlider,
    ControlSelect,
    ControlColorPicker,
    ControlToggle,
    editorIcons,
} from "../components/UI/EditorControls";

const PRIMARY = "#FF6B00"; // Orange
const SECONDARY = "#00A3A3"; // Teal

const sanitizeHex = (hex) =>
    hex && typeof hex === "string" && hex.length > 7
        ? hex.substring(0, 7)
        : hex;
// ─── Main Component ────────────────────────────────────────────────────────────
export default function KeycapEditor() {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors } = useProfile();
    const { allFonts } = useFontStore();
    const [state, setState, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState(KEYCAP_DEFAULTS);
    const [capBB, setCapBB] = useState(null);
    const [customGeo, setCustomGeo] = useState(null);
    const [customBaseName, setCustomBaseName] = useState(null);
    const sceneRef = useRef(null);
    const fileInputRef = useRef(null);
    const capColorRef = useRef(null);
    const legendColorRef = useRef(null);

    // Handle uploading a custom keycap base (STL or 3MF)
    const handleUploadBase = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop().toLowerCase();
        const reader = new FileReader();
        reader.onload = () => {
            const buffer = reader.result;
            try {
                let geometry;
                if (ext === "3mf") {
                    const loader = new ThreeMFLoader();
                    const group = loader.parse(buffer);
                    // Extract all meshes from the 3MF group and merge them
                    const geometries = [];
                    group.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            const g = child.geometry.clone();
                            child.updateMatrixWorld(true);
                            g.applyMatrix4(child.matrixWorld);
                            geometries.push(g);
                        }
                    });
                    if (geometries.length === 0)
                        throw new Error("No geometry found in 3MF");
                    geometry =
                        geometries.length === 1
                            ? geometries[0]
                            : BufferGeometryUtils.mergeGeometries(
                                  geometries,
                                  false,
                              );
                } else {
                    // Default: STL
                    const loader = new STLLoader();
                    geometry = loader.parse(buffer);
                }
                geometry.computeVertexNormals();

                // === PHASE 1 NORMALIZATION ===
                geometry.computeBoundingBox();
                const bb = geometry.boundingBox;
                const currentWidth = bb.max.x - bb.min.x;
                const scaleFactor = 18 / currentWidth;
                geometry.scale(scaleFactor, scaleFactor, scaleFactor);

                // Center the X/Y axes and anchor the bottom face to exactly Z = 0
                geometry.computeBoundingBox();
                const newBB = geometry.boundingBox;
                const center = new THREE.Vector3();
                newBB.getCenter(center);
                geometry.translate(-center.x, -center.y, -newBB.min.z);
                geometry.computeBoundingBox();
                setCustomGeo(geometry);
                setCustomBaseName(file.name);
            } catch (err) {
                console.error(
                    "[KeycapEditor] Failed to parse uploaded file:",
                    err,
                );
                alert(
                    "Failed to load the file. Please ensure it is a valid STL or 3MF file.",
                );
            }
        };
        reader.readAsArrayBuffer(file);
        // Reset input so the same file can be re-uploaded
        e.target.value = "";
    };

    const handleResetBase = () => {
        setCustomGeo(null);
        setCustomBaseName(null);
    };

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
                // fallback if id is not what it stores
            })),
        [allFonts],
    );

    const set = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
    const handleCapBB = useCallback((bb) => setCapBB(bb), []);

    const letters = lettersFromLegends(state.legends);
    const bounds = computeSetBounds(letters.length, capBB);
    const cols = Math.min(letters.length, 6);
    const rows = Math.ceil(letters.length / Math.max(cols, 1));

    return (
        <EditorLayout
            title="Keycap Maker"
            topBarActions={
                <HistoryControls
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    onReset={reset}
                />
            }
            sidebarContent={
                <div className="flex h-full flex-col gap-4 text-slate-700">
                    <PrinterSelector />
                    <TemplateManager
                        editorId="keycap"
                        currentSettings={state}
                        onLoadTemplate={(s) =>
                            setState((prev) => ({ ...prev, ...s }))
                        }
                    />

                    <SidebarSection
                        title="Keycap Base"
                        icon={editorIcons.layers}>
                        <p className="text-[10px] text-gray-400 leading-relaxed mb-2">
                            Upload your own .STL or .3MF keycap profile to
                            replace the default shape.
                        </p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".stl,.3mf"
                            onChange={handleUploadBase}
                            className="hidden"
                        />
                        {customBaseName ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                                    <span className="text-teal-600 text-sm">
                                        ✓
                                    </span>
                                    <span
                                        className="text-xs font-semibold text-teal-700 truncate flex-1"
                                        title={customBaseName}>
                                        {customBaseName}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="flex-1 text-[10px] font-bold text-secondary border border-secondary/30 rounded-lg py-1.5 hover:bg-secondary/10 transition-colors">
                                        Replace
                                    </button>
                                    <button
                                        onClick={handleResetBase}
                                        className="flex-1 text-[10px] font-bold text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-100 transition-colors">
                                        Reset to Default
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-secondary/40 bg-secondary/5 px-4 py-3 text-xs font-bold text-secondary hover:bg-secondary/10 hover:border-secondary transition-all">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                Upload Custom Base (.stl / .3mf)
                            </button>
                        )}
                    </SidebarSection>

                    <SidebarSection title="Legends" icon={editorIcons.text}>
                        <div className="flex justify-between mb-1">
                            <span className="text-[10px] font-semibold text-gray-400">
                                {letters.length} keys · {cols}×{rows}
                            </span>
                        </div>
                        <textarea
                            value={state.legends}
                            onChange={(e) => set("legends", e.target.value)}
                            rows={3}
                            placeholder="A B C D E F G..."
                            className="w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm font-medium text-neutral outline-none transition-colors focus:ring-2 focus:ring-secondary/30 resize-none font-mono mb-2"
                        />
                        <div className="flex gap-2 flex-wrap">
                            {[
                                {
                                    label: "A–Z + 0–9",
                                    val: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                                },
                                {
                                    label: "A–Z",
                                    val: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                                },
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
                    </SidebarSection>

                    <SidebarSection title="Typography" icon={editorIcons.text}>
                        <ControlSelect
                            label="Font Family"
                            value={state.fontLabel || state.font}
                            onChange={(value) => set("fontLabel", value)}
                            options={fontOptions}
                            prefixType="font"
                        />
                        <div className="grid grid-cols-2 gap-4 mt-3">
                            <ControlSlider
                                label="Legend Size (%)"
                                value={state.legendSizePct}
                                min={20}
                                max={100}
                                step={5}
                                onChange={(val) => set("legendSizePct", val)}
                            />
                            <ControlSlider
                                label="Extrusion Depth"
                                value={state.legendDepth}
                                min={0.2}
                                max={3.0}
                                step={0.1}
                                onChange={(val) => set("legendDepth", val)}
                            />
                        </div>
                    </SidebarSection>

                    <SidebarSection title="Colors" icon={editorIcons.ring}>
                        <ControlColorPicker
                            label="Cap Color"
                            value={state.capColor}
                            onChange={(value) =>
                                set("capColor", sanitizeHex(value))
                            }
                            options={colorOptions}
                        />
                        <ControlColorPicker
                            label="Legend Color"
                            value={state.legendColor}
                            onChange={(value) =>
                                set("legendColor", sanitizeHex(value))
                            }
                            options={colorOptions}
                        />
                    </SidebarSection>

                    <SidebarSection title="Advanced" icon={editorIcons.layers}>
                        <ControlToggle
                            label="Add Border"
                            checked={state.topBorder}
                            onChange={(checked) => set("topBorder", checked)}
                        />
                        <ControlToggle
                            label="Merge Colors (STL only)"
                            checked={state.mergeForExport}
                            onChange={(checked) =>
                                set("mergeForExport", checked)
                            }
                        />
                    </SidebarSection>
                </div>
            }>
            <EditorCanvas
                dims={bounds}
                title="Keycap_Set"
                getCustomExportScene={(format) => {
                    if (!sceneRef.current) return null;
                    const geo = sceneRef.current.buildExportGeo();
                    if (!geo) return null;

                    const group = new THREE.Group();

                    // Create basic materials for export (3MF exporter uses color, STL ignores it)
                    const capMat = new THREE.MeshStandardMaterial({
                        color: sanitizeHex(state.capColor),
                    });
                    const legMat = new THREE.MeshStandardMaterial({
                        color: sanitizeHex(state.legendColor),
                    });

                    if (state.mergeForExport && format === "stl" && geo.caps?.getAttribute("position")?.count && geo.legends?.getAttribute("position")?.count) {
                        // Merge them into one mesh if requested (usually for STL)
                        const merged = BufferGeometryUtils.mergeGeometries(
                            [geo.caps, geo.legends],
                            false,
                        );
                        if (!merged) throw new Error("Keycap geometry could not be merged.");
                        geo.caps.dispose(); geo.legends.dispose(); legMat.dispose();
                        group.add(new THREE.Mesh(merged, capMat));
                    } else {
                        // Add as separate meshes
                        group.add(new THREE.Mesh(geo.caps, capMat));
                        group.add(new THREE.Mesh(geo.legends, legMat));
                    }

                    // The returned group will be directly parsed by STLExporter/exportTo3MF
                    return group;
                }}>
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
