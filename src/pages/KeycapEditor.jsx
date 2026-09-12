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
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

const PRIMARY = "#FF6B00"; // Orange
const SECONDARY = "#00A3A3"; // Teal

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

const sanitizeHex = (hex) =>
    hex && typeof hex === "string" && hex.length > 7
        ? hex.substring(0, 7)
        : hex;

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
        if (isOpen && anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            // Position fixed breaks out of the sidebar's overflow: auto!
            // We anchor it to the top-left of the button, pushing it upwards (bottom: window height - rect.top + margin).
            setDrawerStyle({
                position: "fixed",
                left: rect.left,
                bottom: window.innerHeight - rect.top + 8,
                zIndex: 9999,
            });
        }
    }, [isOpen, anchorRef]);

    if (!isOpen) return null;

    return (
        <div
            className="w-[17rem] rounded-2xl border border-[#00A3A3]/40 bg-white/95 p-3 shadow-[0_12px_22px_rgba(15,23,42,0.14)] backdrop-blur-sm"
            style={drawerStyle}
        >
            <div className="mb-3 flex gap-2 overflow-x-auto border-b border-[#00A3A3]/20 pb-2">
                {Object.keys(mergedColors).map((brand) => (
                    <button
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                            selectedBrand === brand
                                ? "bg-[#00A3A3] text-white shadow-sm"
                                : "bg-[#00A3A3]/5 text-slate-500 hover:text-[#00A3A3]"
                        }`}
                    >
                        {brand === "BambuLab" ? "Bambu Lab" : brand}
                    </button>
                ))}
            </div>

            <div className="grid max-h-52 grid-cols-5 gap-2 overflow-y-auto pr-1">
                {mergedColors[selectedBrand]?.map((color) => {
                    const isSelected = value === color.hex;

                    return (
                        <div
                            key={color.hex + color.name}
                            className="flex flex-col items-center gap-1"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(color.hex);
                                    onClose();
                                }}
                                className={`h-7 w-7 rounded-md border transition-all ${
                                    isSelected
                                        ? "scale-105 border-black ring-2 ring-[#00A3A3]/20"
                                        : "border-slate-200 hover:border-slate-300"
                                }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            />
                            <span
                                className="max-w-full truncate text-[8px] font-medium text-slate-500"
                                title={color.name}
                            >
                                {color.name}
                            </span>
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-xl border border-[#00A3A3]/20 bg-[#00A3A3]/5 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#00A3A3] transition-colors hover:bg-[#00A3A3]/10"
            >
                Close
            </button>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function KeycapEditor() {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors } = useProfile();
    const [state, setState, { undo, redo, reset, canUndo, canRedo }] = useHistoryState(KEYCAP_DEFAULTS);
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

    // Font selection state
    const [isFontOpen, setIsFontOpen] = useState(false);
    const [fontSearch, setFontSearch] = useState("");
    const { allFonts } = useProfile();
    const filteredFonts = allFonts.filter((f) =>
        f.label.toLowerCase().includes(fontSearch.toLowerCase()),
    );
    const selectedFont =
        allFonts.find((f) => f.label === state.fontLabel) || allFonts[0];

    // Color drawers state
    const [openColorDrawer, setOpenColorDrawer] = useState(null); // 'cap' or 'legend'

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
                <div className="space-y-6">
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Generate full mechanical keyboard keycap sets in
                        seconds. Customize legends, fonts, and colors!
                    </p>

                    {/* Custom Keycap Base Upload */}
                    <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                        <span className="text-sm font-semibold text-gray-700">
                            Keycap Base
                        </span>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
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
                                        title={customBaseName}
                                    >
                                        {customBaseName}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="flex-1 text-[10px] font-bold text-secondary border border-secondary/30 rounded-lg py-1.5 hover:bg-secondary/10 transition-colors"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        onClick={handleResetBase}
                                        className="flex-1 text-[10px] font-bold text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-100 transition-colors"
                                    >
                                        Reset to Default
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-secondary/40 bg-secondary/5 px-4 py-3 text-xs font-bold text-secondary hover:bg-secondary/10 hover:border-secondary transition-all"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                Upload Custom Base (.stl / .3mf)
                            </button>
                        )}
                    </div>

                    {/* Legends Input */}
                    <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                        <label className="grid gap-1.5">
                            <div className="flex justify-between">
                                <span className="text-xs font-semibold text-gray-700">
                                    Legends
                                </span>
                                <span className="text-[10px] font-semibold text-gray-400">
                                    {letters.length} keys · {cols}×{rows}
                                </span>
                            </div>
                            <textarea
                                value={state.legends}
                                onChange={(e) => set("legends", e.target.value)}
                                rows={3}
                                placeholder="A B C D E F G..."
                                className="w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm font-medium text-neutral outline-none transition-colors focus:ring-2 focus:ring-secondary/30 resize-none font-mono"
                            />
                        </label>
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
                                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-200 transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font & Appearance */}
                    <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-4">
                        <span className="text-sm font-semibold text-gray-700">
                            Typography
                        </span>

                        <div className="grid gap-1.5 relative">
                            <span className="text-xs font-semibold text-gray-700">
                                Font Family
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsFontOpen((o) => !o)}
                                className="flex w-full items-center justify-between rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-left text-sm text-neutral hover:border-secondary focus:outline-none transition-colors"
                            >
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
                                            setFontSearch(e.target.value)
                                        }
                                        placeholder="search fonts..."
                                        autoFocus
                                        className="mb-2 w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm outline-none focus:border-secondary"
                                    />
                                    <div className="max-h-44 overflow-y-auto rounded-xl border border-secondary bg-gray-50 p-1">
                                        {filteredFonts.map((font) => (
                                            <button
                                                key={font.label}
                                                type="button"
                                                onClick={() => {
                                                    set(
                                                        "fontLabel",
                                                        font.label,
                                                    );
                                                    setIsFontOpen(false);
                                                    setFontSearch("");
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                    font.label ===
                                                    state.fontLabel
                                                        ? "bg-secondary/15 text-neutral font-bold"
                                                        : "hover:bg-white"
                                                }`}
                                            >
                                                <span>{font.label}</span>
                                                {font.label ===
                                                    state.fontLabel && (
                                                    <span className="text-primary">
                                                        ✓
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Slider
                                label="Legend Size (%)"
                                value={state.legendSizePct}
                                min={20}
                                max={100}
                                step={5}
                                onChange={(val) => set("legendSizePct", val)}
                            />
                            <Slider
                                label="Extrusion Depth"
                                value={state.legendDepth}
                                min={0.2}
                                max={3.0}
                                step={0.1}
                                onChange={(val) => set("legendDepth", val)}
                            />
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3 relative">
                        <span className="text-sm font-semibold text-gray-700">
                            Colors
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Cap Color */}
                            <label className="grid gap-1.5 relative">
                                <span className="text-xs font-semibold text-gray-500">
                                    Cap Color
                                </span>
                                <button
                                    ref={capColorRef}
                                    onClick={() =>
                                        setOpenColorDrawer(
                                            openColorDrawer === "cap"
                                                ? null
                                                : "cap",
                                        )
                                    }
                                    className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5 pr-3 transition-colors hover:border-secondary"
                                >
                                    <div
                                        className="h-6 w-6 rounded-lg shadow-inner border border-black/10"
                                        style={{
                                            backgroundColor: state.capColor,
                                        }}
                                    />
                                    <span className="text-xs font-medium text-neutral truncate">
                                        {getColorName(
                                            state.capColor,
                                            cloudColors,
                                            customColors,
                                        )}
                                    </span>
                                </button>
                                <ColorSelectionDrawer
                                    isOpen={openColorDrawer === "cap"}
                                    value={state.capColor}
                                    onChange={(hex) =>
                                        set("capColor", sanitizeHex(hex))
                                    }
                                    onClose={() => setOpenColorDrawer(null)}
                                    anchorRef={capColorRef}
                                />
                            </label>

                            {/* Legend Color */}
                            <label className="grid gap-1.5 relative">
                                <span className="text-xs font-semibold text-gray-500">
                                    Legend Color
                                </span>
                                <button
                                    ref={legendColorRef}
                                    onClick={() =>
                                        setOpenColorDrawer(
                                            openColorDrawer === "legend"
                                                ? null
                                                : "legend",
                                        )
                                    }
                                    className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5 pr-3 transition-colors hover:border-secondary"
                                >
                                    <div
                                        className="h-6 w-6 rounded-lg shadow-inner border border-black/10"
                                        style={{
                                            backgroundColor: state.legendColor,
                                        }}
                                    />
                                    <span className="text-xs font-medium text-neutral truncate">
                                        {getColorName(
                                            state.legendColor,
                                            cloudColors,
                                            customColors,
                                        )}
                                    </span>
                                </button>
                                <ColorSelectionDrawer
                                    isOpen={openColorDrawer === "legend"}
                                    value={state.legendColor}
                                    onChange={(hex) =>
                                        set("legendColor", sanitizeHex(hex))
                                    }
                                    onClose={() => setOpenColorDrawer(null)}
                                    anchorRef={legendColorRef}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
                        <span className="text-sm font-semibold text-gray-700">
                            Advanced
                        </span>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={state.topBorder}
                                onChange={(e) =>
                                    set("topBorder", e.target.checked)
                                }
                                className="w-4 h-4 accent-secondary rounded"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-700">
                                    Add Border
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    Adds an extruded border around the cap edge
                                </span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={state.mergeForExport}
                                onChange={(e) =>
                                    set("mergeForExport", e.target.checked)
                                }
                                className="w-4 h-4 accent-secondary rounded"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-700">
                                    Merge Colors (STL only)
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    Merges caps and legends into a single 3D
                                    object
                                </span>
                            </div>
                        </label>
                    </div>
                </div>
            }
        >
            <EditorCanvas
                dims={bounds}
                title="Keycap_Set"
                getCustomExportScene={() => {
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

                    if (state.mergeForExport) {
                        // Merge them into one mesh if requested (usually for STL)
                        const merged = BufferGeometryUtils.mergeGeometries(
                            [geo.caps, geo.legends],
                            false,
                        );
                        group.add(new THREE.Mesh(merged, capMat));
                    } else {
                        // Add as separate meshes
                        group.add(new THREE.Mesh(geo.caps, capMat));
                        group.add(new THREE.Mesh(geo.legends, legMat));
                    }

                    // The returned group will be directly parsed by STLExporter/exportTo3MF
                    return group;
                }}
            >
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
