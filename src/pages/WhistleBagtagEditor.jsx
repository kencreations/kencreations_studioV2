import React, {
    useState,
    useEffect,
    Suspense,
    useCallback,
    useMemo,
} from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Palette, CircleDashed, Type } from "lucide-react";
import { Geometry as CSG, Base, Subtraction } from "@react-three/csg";
import { Text3D, Center } from "@react-three/drei";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import {
    SidebarSection,
    ControlSlider,
    ControlToggle,
    ControlInput,
    ControlSelect,
    ControlColorPicker,
} from "../components/UI/EditorControls";
import { getAssetUrl } from "../utils/assetHelper";
import whistleUrl from "../assets/models/whistle.stl?url";
import TemplateManager from "../components/TemplateManager";
import { useHistoryState } from "../hooks/useHistoryState";
import { HistoryControls } from "../components/HistoryControls";
import { useProfile } from "../contexts/ProfileContext";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { load3DFontJson } from "../utils/fontManager";

const getAssetPath = (path) => {
    if (!path) return path;
    return path.startsWith('/') ? '.' + path : path;
};

function WhistleModel({ state, setDims }) {
    // Load the base whistle STL
    const stlPath = getAssetPath(whistleUrl);
    const rawWhistleGeo = useLoader(STLLoader, stlPath);

    // Clone and patch the geometry to prevent CSG crashes
    const whistleGeo = useMemo(() => {
        const geo = rawWhistleGeo.clone();
        geo.center();
        geo.rotateZ(Math.PI); // Flip 180 degrees to place the mouthpiece opposite the lanyard hole
        // STLLoader does not create UVs, but cylinderGeometry does.
        // @react-three/csg requires all geometries to have matching attributes.
        if (!geo.attributes.uv) {
            const uvArray = new Float32Array(geo.attributes.position.count * 2);
            geo.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));
        }
        return geo;
    }, [rawWhistleGeo]);

    useEffect(() => {
        if (whistleGeo) {
            whistleGeo.computeBoundingBox();
            const bbox = whistleGeo.boundingBox;
            if (bbox) {
                setDims({
                    x: (bbox.max.x - bbox.min.x).toFixed(1),
                    y: (bbox.max.y - bbox.min.y).toFixed(1),
                    z: (bbox.max.z - bbox.min.z).toFixed(1),
                });
            }
        }
    }, [whistleGeo, setDims]);

    const [loadedFonts, setLoadedFonts] = useState({});

    useEffect(() => {
        let mounted = true;
        const loadFonts = async () => {
            for (const line of state.texts || []) {
                if (line.font && !loadedFonts[line.font.label]) {
                    try {
                        const data = await load3DFontJson(line.font);
                        if (mounted) {
                            setLoadedFonts((prev) => ({
                                ...prev,
                                [line.font.label]: data,
                            }));
                        }
                    } catch (err) {
                        console.error("Failed to load font:", err);
                    }
                }
            }
        };
        loadFonts();
        return () => {
            mounted = false;
        };
    }, [state.texts, loadedFonts]);

    return (
        <group position={[0, 0, 0.5]}>
            {/* The main whistle CSG mesh */}
            <mesh castShadow receiveShadow>
                <CSG>
                    {/* The base whistle geometry */}
                    <Base geometry={whistleGeo} />

                    {/* Circle Hole */}
                    {state.holeShape === "circle" && (
                        <Subtraction
                            position={[state.holeXOffset, state.holeYOffset, 0]}
                            rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry
                                args={[
                                    state.holeSize / 2,
                                    state.holeSize / 2,
                                    20,
                                    32,
                                ]}
                            />
                        </Subtraction>
                    )}

                    {/* True Slot Hole */}
                    {state.holeShape === "slot" && (
                        <>
                            {/* Top Circle */}
                            <Subtraction
                                position={[
                                    state.holeXOffset,
                                    state.holeYOffset + state.slotLength / 2,
                                    0,
                                ]}
                                rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry
                                    args={[
                                        state.holeSize / 2,
                                        state.holeSize / 2,
                                        20,
                                        32,
                                    ]}
                                />
                            </Subtraction>

                            {/* Bottom Circle */}
                            <Subtraction
                                position={[
                                    state.holeXOffset,
                                    state.holeYOffset - state.slotLength / 2,
                                    0,
                                ]}
                                rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry
                                    args={[
                                        state.holeSize / 2,
                                        state.holeSize / 2,
                                        20,
                                        32,
                                    ]}
                                />
                            </Subtraction>

                            {/* Middle Box connecting the circles */}
                            <Subtraction
                                position={[
                                    state.holeXOffset,
                                    state.holeYOffset,
                                    0,
                                ]}
                                // No rotation needed. X = width, Y = span length, Z = punch depth
                            >
                                <boxGeometry
                                    args={[
                                        state.holeSize,
                                        state.slotLength,
                                        20,
                                    ]}
                                />
                            </Subtraction>
                        </>
                    )}
                </CSG>
                {/* Explicitly add a material so it renders! */}
                <meshStandardMaterial color={state.baseColor} />
            </mesh>

            {/* Dynamic Text Lines */}
            {(state.texts || []).map((line) => {
                const fontData = loadedFonts[line.font?.label];
                if (!fontData) return null;
                return (
                    <Center
                        key={`${line.id}-${line.text}`}
                        position={[line.xOffset, line.yOffset, 1.6]}
                        disableZ>
                        <Text3D
                            font={fontData}
                            size={line.size}
                            height={line.depth}
                            curveSegments={12}
                            bevelEnabled={false}>
                            {line.text || " "}
                            <meshStandardMaterial color={line.color} />
                        </Text3D>
                    </Center>
                );
            })}
        </group>
    );
}

export default function WhistleBagtagEditor() {
    const { allFonts, customColors } = useProfile();
    const { brands: cloudColors } = useFilamentBrands();
    const defaultFont = allFonts?.[0] || null;
    const [dims, setDims] = useState(null);

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

    // Standard History Hook
    const [state, set, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState({
            baseColor: "#00B1B7",
            texts: [
                {
                    id: Date.now(),
                    text: "NAME",
                    font: defaultFont,
                    color: "#FF9016",
                    size: 12,
                    depth: 1,
                    xOffset: 5,
                    yOffset: 0,
                },
            ],
            holeShape: "circle", // 'circle' or 'slot'
            holeXOffset: -28,
            holeYOffset: 0,
            holeSize: 5,
            slotLength: 15,
        });

    const addTextLine = () => {
        set((prev) => {
            const newTexts = [...(prev.texts || [])];
            const updatedTexts = newTexts.map((t) => ({
                ...t,
                yOffset: t.yOffset + 8,
            }));

            const first = prev.texts?.[0] || {};
            updatedTexts.push({
                id: Date.now(),
                text: "",
                font: first.font || defaultFont,
                color: first.color || "#FF9016",
                size: first.size || 12,
                depth: first.depth || 1,
                xOffset: first.xOffset || 5,
                yOffset: -8,
            });
            return { ...prev, texts: updatedTexts };
        });
    };

    const removeTextLine = (id) => {
        set((prev) => ({
            ...prev,
            texts: prev.texts.filter((t) => t.id !== id),
        }));
    };

    const updateTextLine = (id, updates) => {
        set((prev) => ({
            ...prev,
            texts: prev.texts.map((t) =>
                t.id === id ? { ...t, ...updates } : t,
            ),
        }));
    };

    const handleLoadTemplate = (savedSettings) => {
        set((prev) => {
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

    // Top Bar UI
    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
        />
    );

    // Sidebar UI
    const sidebar = (
        <div className="space-y-6">
            <TemplateManager
                editorId="whistle-bagtag"
                currentSettings={state}
                excludeKeys={["text"]}
                onLoadTemplate={handleLoadTemplate}
            />
            <SidebarSection title="Text Personalization" icon={Type}>
                {(state.texts || []).map((line, index) => (
                    <div
                        key={line.id}
                        className="rounded-xl border border-secondary/40 bg-slate-50/80 p-3 mb-4">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#00A3A3]">
                                Text Line {index + 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeTextLine(line.id)}
                                disabled={(state.texts || []).length <= 1}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                                title={
                                    (state.texts || []).length <= 1
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
                                    <path d="M16 6V4h-8v2" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <ControlInput
                                label="Custom Text"
                                value={line.text}
                                onChange={(e) =>
                                    updateTextLine(line.id, {
                                        text: e.target ? e.target.value : e,
                                    })
                                }
                                placeholder={`Enter line ${index + 1}...`}
                            />

                            <ControlSelect
                                label="Font Style"
                                value={line.font?.label || ""}
                                onChange={(val) => {
                                    const font = allFonts.find(
                                        (f) => f.label === val,
                                    );
                                    if (font) updateTextLine(line.id, { font });
                                }}
                                options={allFonts.map((f) => ({
                                    label: f.label,
                                    value: f.label,
                                }))}
                            />

                            <ControlColorPicker
                                label="Text Color"
                                value={line.color}
                                onChange={(val) =>
                                    updateTextLine(line.id, { color: val })
                                }
                                options={colorOptions}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <ControlSlider
                                    label="Text Size"
                                    value={line.size}
                                    min={6}
                                    max={36}
                                    step={1}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateTextLine(line.id, { size: val })
                                    }
                                />

                                <ControlSlider
                                    label="Text Depth"
                                    value={line.depth}
                                    min={0.5}
                                    max={5}
                                    step={0.5}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateTextLine(line.id, { depth: val })
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <ControlSlider
                                    label="Text X Offset"
                                    value={line.xOffset}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateTextLine(line.id, {
                                            xOffset: val,
                                        })
                                    }
                                />
                                <ControlSlider
                                    label="Text Y Offset"
                                    value={line.yOffset}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateTextLine(line.id, {
                                            yOffset: val,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={addTextLine}
                    className="w-full rounded-xl border border-dashed border-[#00A3A3]/50 bg-[#00A3A3]/5 px-3 py-2.5 text-sm font-semibold text-[#00A3A3] transition-colors hover:bg-[#00A3A3]/10">
                    + Add Text Line
                </button>
            </SidebarSection>
            <SidebarSection title="Base Settings" icon={Palette}>
                <ControlColorPicker
                    label="Whistle Color"
                    value={state.baseColor}
                    onChange={(val) =>
                        set((prev) => ({ ...prev, baseColor: val }))
                    }
                    options={colorOptions}
                />
                <ControlSelect
                    label="Hole Shape"
                    value={state.holeShape}
                    onChange={(val) =>
                        set((prev) => ({ ...prev, holeShape: val }))
                    }
                    options={[
                        { label: "Circle", value: "circle" },
                        { label: "Slot", value: "slot" },
                    ]}
                />

                <ControlSlider
                    label="Hole Size"
                    value={state.holeSize}
                    min={2}
                    max={15}
                    step={0.5}
                    unit="mm"
                    onChange={(val) =>
                        set((prev) => ({ ...prev, holeSize: val }))
                    }
                />
                {state.holeShape === "slot" && (
                    <ControlSlider
                        label="Slot Length"
                        value={state.slotLength}
                        min={5}
                        max={40}
                        step={0.5}
                        unit="mm"
                        onChange={(val) =>
                            set((prev) => ({ ...prev, slotLength: val }))
                        }
                    />
                )}
                <div className="grid grid-cols-2 gap-3">
                    <ControlSlider
                        label="Hole X Pos"
                        value={state.holeXOffset}
                        min={-35}
                        max={35}
                        step={1}
                        unit="mm"
                        onChange={(val) =>
                            set((prev) => ({ ...prev, holeXOffset: val }))
                        }
                    />

                    <ControlSlider
                        label="Hole Y Pos"
                        value={state.holeYOffset}
                        min={-20}
                        max={20}
                        step={1}
                        unit="mm"
                        onChange={(val) =>
                            set((prev) => ({ ...prev, holeYOffset: val }))
                        }
                    />
                </div>
            </SidebarSection>
        </div>
    );

    return (
        <EditorLayout
            title="Whistle Bagtag "
            sidebarContent={sidebar}
            topBarActions={topBarActions}>
            <EditorCanvas title={state.text} dims={dims}>
                <Suspense fallback={null}>
                    <WhistleModel state={state} setDims={setDims} />
                </Suspense>
            </EditorCanvas>
        </EditorLayout>
    );
}
