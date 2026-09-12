import React, { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { getAssetUrl } from "../utils/assetHelper";
import baseStlUrl from "../assets/models/base.stl?url";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import {
    SidebarSection,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";
import { Palette, Smile, Layers } from "lucide-react";

import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import { getShapesFromIconify } from "../utils/iconifyLoader";

// ─── Custom Hook: History State ─────────────────────────────────────────────
import { useHistoryState } from "../hooks/useHistoryState";
import { HistoryControls } from "../components/HistoryControls";

// ─── UI Components ──────────────────────────────────────────────────────────

function ViewportOverlay({ xrayMode, setXrayMode }) {
    return (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            <button
                onClick={() => setXrayMode((s) => !s)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border transition-all ${xrayMode ? "bg-primary text-white border-primary" : "bg-white/90 text-gray-700 border-secondary/30 hover:border-secondary hover:text-secondary"}`}>
                👁️ {xrayMode ? "Solid View" : "X-Ray View"}
            </button>
        </div>
    );
}

// ─── 3D Scene Component ──────────────────────────────────────────────────────

function IconTagModel({
    baseColor,
    iconColor,
    selectedIcon,
    iconThickness = 2,
    iconScale = 1.0,
    iconOffsetX = 0,
    iconOffsetY = 0,
    iconOffsetZ = 0,
    xrayMode,
    onBoundsCalculated,
}) {
    const [baseGeometry, setBaseGeometry] = useState(null);
    const [iconShapes, setIconShapes] = useState([]);
    const [isIconLoading, setIsIconLoading] = useState(false);

    useEffect(() => {
        const getAssetPath = (path) => {
            if (!path) return path;
            return path.startsWith('/') ? '.' + path : path;
        };

        const loader = new STLLoader();
        loader.load(
            getAssetPath(baseStlUrl),
            (geometry) => {
                // Calculate bounding box and center the model in X/Y
                // Translate so the bottom rests exactly at Local Z = 0
                geometry.computeBoundingBox();
                const box = geometry.boundingBox;
                const center = new THREE.Vector3();
                box.getCenter(center);
                geometry.translate(-center.x, -center.y, -box.min.z);
                geometry.computeBoundingBox();
                setBaseGeometry(geometry);
            },
            undefined,
            (err) => {
                // Fallback geometry drawn on the XY plane with thickness 4 in Z
                const fallbackGeom = new THREE.BoxGeometry(40, 40, 4);
                fallbackGeom.translate(0, 0, 2);
                fallbackGeom.computeBoundingBox();
                setBaseGeometry(fallbackGeom);
            },
        );
    }, []);

    useEffect(() => {
        if (!selectedIcon) {
            setIconShapes([]);
            return;
        }

        let isMounted = true;
        setIsIconLoading(true);

        getShapesFromIconify(selectedIcon, 20)
            .then((shapes) => {
                if (isMounted) {
                    setIconShapes(shapes);
                    setIsIconLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) setIsIconLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedIcon]);

    const extrudeSettings = useMemo(
        () => ({
            depth: iconThickness,
            bevelEnabled: false,
        }),
        [iconThickness],
    );

    const extrudedGeometries = useMemo(() => {
        return iconShapes.map((shape) => {
            const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geom.center(); // Fix origin to true center
            return geom;
        });
    }, [iconShapes, extrudeSettings]);

    // Simulate bounds calculation so the Info Panel top-right gets populated
    useEffect(() => {
        if (onBoundsCalculated) {
            onBoundsCalculated({ x: "40.0", y: "40.0", z: "4.0" });
        }
    }, [onBoundsCalculated]);

    const baseHeight = baseGeometry ? baseGeometry.boundingBox.max.z : 4;

    return (
        // Counteract the +2.5 global Y-lift from EditorCanvas by shifting Local Z down
        <group position={[0, 0, -2.5]}>
            {/* Base Mesh */}
            {baseGeometry && (
                <mesh geometry={baseGeometry}>
                    <meshStandardMaterial
                        color={baseColor}
                        roughness={xrayMode ? 0.2 : 0.7}
                        metalness={xrayMode ? 0.5 : 0.1}
                        transparent={xrayMode}
                        opacity={xrayMode ? 0.25 : 1}
                        depthWrite={!xrayMode}
                    />
                </mesh>
            )}

            {/* Extruded Icon Mesh */}
            {extrudedGeometries.length > 0 && (
                // Positioned exactly on top of the base STL's Z-height.
                // The extrusion depth is iconThickness, so centered it extends +/- iconThickness/2.
                // We place the group at baseHeight + iconThickness/2 so its bottom rests exactly at baseHeight.
                // X, Y, and Z offsets position it exactly where needed.
                <group
                    position={[
                        iconOffsetX,
                        iconOffsetY,
                        baseHeight + iconOffsetZ + iconThickness / 2,
                    ]}
                    scale={[iconScale, iconScale, 1]}>
                    <Center>
                        {extrudedGeometries.map((geom, idx) => (
                            <mesh key={idx} geometry={geom}>
                                <meshStandardMaterial
                                    color={iconColor}
                                    roughness={0.5}
                                    metalness={0.2}
                                />
                            </mesh>
                        ))}
                    </Center>
                </group>
            )}
        </group>
    );
}

// ─── Main Component: ClientIconTag ───────────────────────────────────────────
export default function ClientIconTag() {
    const navigate = useNavigate();

    const initialState = {
        baseColor: "#000000",
        iconColor: "#00B1B7",
        selectedIcon: "mdi:star",
        iconThickness: 2,
        iconScale: 1.0,
        iconOffsetX: 0,
        iconOffsetY: 0,
        iconOffsetZ: 0,
    };

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

    const [state, setState, history] = useHistoryState(initialState);
    const [iconSearch, setIconSearch] = useState("");
    const [iconResults, setIconResults] = useState([]);
    const [iconLoading, setIconLoading] = useState(false);
    const iconDebounce = useRef(null);
    const [xrayMode, setXrayMode] = useState(false);

    const [actualDims, setActualDims] = useState({
        x: "40.0",
        y: "40.0",
        z: "4.0",
    });

    const updateState = (key, value) => {
        setState((prev) => ({ ...prev, [key]: value }));
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

    const topBarActions = (
        <HistoryControls
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            onReset={history.reset}
        />
    );

    const exampleIcons = [
        "mdi:star",
        "mdi:heart",
        "mdi:circle",
        "mdi:check",
        "mdi:flash",
        "mdi:account",
        "mdi:cog",
        "mdi:camera",
    ];
    const displayIcons = iconSearch.trim() ? iconResults : exampleIcons;

    return (
        <EditorLayout
            title="Tag Generator"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="flex h-full flex-col gap-4 text-slate-700">
                    <SidebarSection title="Colors" icon={Palette}>
                        <div className="space-y-3">
                            <ControlColorPicker
                                label="Base Color"
                                value={state.baseColor}
                                onChange={(val) =>
                                    updateState("baseColor", val)
                                }
                                options={colorOptions}
                            />
                            <ControlColorPicker
                                label="Icon Color"
                                value={state.iconColor}
                                onChange={(val) =>
                                    updateState("iconColor", val)
                                }
                                options={colorOptions}
                            />
                        </div>
                    </SidebarSection>

                    <SidebarSection title="Dimensions" icon={Layers}>
                        <div className="space-y-3">
                            <ControlSlider
                                label="Icon Scale"
                                unit="x"
                                value={state.iconScale}
                                min={0.5}
                                max={5.0}
                                step={0.1}
                                onChange={(val) =>
                                    updateState("iconScale", val)
                                }
                            />
                            <ControlSlider
                                label="Icon X Offset"
                                unit="mm"
                                value={state.iconOffsetX}
                                min={-30}
                                max={30}
                                step={1}
                                onChange={(val) =>
                                    updateState("iconOffsetX", val)
                                }
                            />
                            <ControlSlider
                                label="Icon Y Offset"
                                unit="mm"
                                value={state.iconOffsetY}
                                min={-30}
                                max={30}
                                step={1}
                                onChange={(val) =>
                                    updateState("iconOffsetY", val)
                                }
                            />
                            <ControlSlider
                                label="Icon Z Offset"
                                unit="mm"
                                value={state.iconOffsetZ}
                                min={-20}
                                max={20}
                                step={0.5}
                                onChange={(val) =>
                                    updateState("iconOffsetZ", val)
                                }
                            />
                            <ControlSlider
                                label="Icon Thickness"
                                unit="mm"
                                value={state.iconThickness}
                                min={0.5}
                                max={10}
                                step={0.5}
                                onChange={(val) =>
                                    updateState("iconThickness", val)
                                }
                            />
                        </div>
                    </SidebarSection>

                    <SidebarSection title="Icon Select" icon={Smile}>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Search 200k+ icons..."
                                value={iconSearch}
                                onChange={(e) =>
                                    handleIconSearch(e.target.value)
                                }
                                className="w-full text-sm font-medium border border-secondary/30 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors bg-gray-50"
                            />
                            {iconLoading && (
                                <div className="text-xs text-center text-gray-500">
                                    Searching...
                                </div>
                            )}
                            <div className="grid grid-cols-4 gap-2">
                                {displayIcons.map((icon) => (
                                    <button
                                        key={icon}
                                        onClick={() =>
                                            updateState("selectedIcon", icon)
                                        }
                                        title={icon}
                                        className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all
                                            ${state.selectedIcon === icon ? "border-primary/80 bg-primary/10 shadow-sm" : "border-secondary/50 hover:border-primary/30 bg-white"}
                                        `}>
                                        <img
                                            src={`https://api.iconify.design/${icon.replace(":", "/")}.svg`}
                                            alt={icon}
                                            className="w-6 h-6 opacity-80"
                                        />
                                    </button>
                                ))}
                                {!iconLoading && displayIcons.length === 0 && (
                                    <div className="col-span-4 text-center text-xs text-gray-400 py-4">
                                        No icons found
                                    </div>
                                )}
                            </div>
                        </div>
                    </SidebarSection>
                </div>
            }>
            <div className="relative w-full h-full">
                <EditorCanvas
                    dims={actualDims}
                    title={`custom_tag_${state.selectedIcon.replace(":", "_")}`}
                    cameraPosition={[0, 50, 50]}
                    cameraTarget={[0, 0, 0]}>
                    <IconTagModel
                        baseColor={state.baseColor}
                        iconColor={state.iconColor}
                        selectedIcon={state.selectedIcon}
                        iconThickness={state.iconThickness}
                        iconScale={state.iconScale}
                        iconOffsetX={state.iconOffsetX}
                        iconOffsetY={state.iconOffsetY}
                        iconOffsetZ={state.iconOffsetZ}
                        xrayMode={xrayMode}
                        onBoundsCalculated={setActualDims}
                    />
                </EditorCanvas>

                <ViewportOverlay
                    xrayMode={xrayMode}
                    setXrayMode={setXrayMode}
                />
            </div>
        </EditorLayout>
    );
}
