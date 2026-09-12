import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link } from "react-router-dom";
import { Type, Layers, Settings, Save } from "lucide-react";
import TemplateManager from "../components/TemplateManager";
import { Geometry as CSG, Base, Subtraction } from "@react-three/csg";
import { Text3D, Center } from "@react-three/drei";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Box3, ExtrudeGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { useHistoryState } from "../hooks/useHistoryState";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import { HistoryControls } from "../components/HistoryControls";
import { getCached3DFont } from "../utils/fontManager";
import {
    SidebarSection,
    ControlInput,
    ControlSelect,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";

const buildCustomTextGeometry = (
    text,
    font,
    size,
    thickness,
    spacing,
    curveAngle,
    bevelSize = 0,
) => {
    if (!font || !text?.trim()) return null;

    const geometries = [];
    let currentX = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === " ") {
            currentX += size * 0.3 + spacing;
            continue;
        }

        const charGeo = new TextGeometry(char, {
            font: font,
            size: size,
            height: thickness,
            depth: thickness,
            curveSegments: 16,
            bevelEnabled: bevelSize > 0,
            bevelThickness: 0.01,
            bevelSize: bevelSize,
            bevelSegments: 2,
        });

        charGeo.computeBoundingBox();
        const charBox = charGeo.boundingBox;
        const charWidth = charBox.max.x - charBox.min.x;

        charGeo.translate(currentX - charBox.min.x, 0, 0);
        geometries.push(charGeo);

        currentX += charWidth + spacing;
    }

    if (geometries.length === 0) return null;

    // Weld into a single mesh for the slicer
    let mergedGeo =
        geometries.length === 1
            ? geometries[0]
            : BufferGeometryUtils.mergeGeometries(geometries, false);

    // Center the whole word on X/Y
    mergedGeo.computeBoundingBox();
    const wordOffsetX =
        -0.5 * (mergedGeo.boundingBox.max.x + mergedGeo.boundingBox.min.x);
    const wordOffsetY =
        -0.5 * (mergedGeo.boundingBox.max.y + mergedGeo.boundingBox.min.y);
    mergedGeo.translate(wordOffsetX, wordOffsetY, 0);

    // Apply trigonometric cylindrical bend (arch)
    if (curveAngle && curveAngle !== 0) {
        const angleRad = (curveAngle * Math.PI) / 180;
        mergedGeo.computeBoundingBox();
        const width = mergedGeo.boundingBox.max.x - mergedGeo.boundingBox.min.x;

        if (width > 0) {
            const radius = width / angleRad;
            const positions = mergedGeo.attributes.position;

            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);

                const theta = x / radius;
                const currentRadius = radius + y;

                const newX = currentRadius * Math.sin(theta);
                const newY = currentRadius * Math.cos(theta) - radius;

                positions.setXY(i, newX, newY);
            }
            positions.needsUpdate = true;
            mergedGeo.computeVertexNormals();
            mergedGeo.computeBoundingBox();
        }
    }

    return mergedGeo;
};

const MONOGRAM_INSERT_DEFAULTS = {
    name: "Name",
    initial: "N",
    initialFont: "Chunky",
    initialSize: 200,
    initialThickness: 40,
    initialColor: "#00B1B7",

    nameFont: "Pacifico",
    nameSize: 50,
    nameThickness: 15,
    nameSpacing: 0,
    nameCurve: 0,
    nameX: 0,
    nameY: -10,
    nameRotation: 0, // degrees
    nameColor: "#FF9016",

    pocketDepth: 10,
    tolerance: 0.2,
};

export default function MonogramInsertEditor() {
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

    const [config, setConfig, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState(MONOGRAM_INSERT_DEFAULTS);
    const [isDisassembled, setIsDisassembled] = useState(false);

    const updateConfig = (updates) => {
        setConfig({ ...config, ...updates });
    };

    // Auto-derive initial if cleared
    useEffect(() => {
        const safeName = typeof config.name === 'string' ? config.name : "";
        if (!config.initial && safeName) {
            updateConfig({ initial: safeName.charAt(0).toUpperCase() });
        }
    }, [config.initial, config.name]);

    // Ensure valid default fonts
    useEffect(() => {
        if (allFonts.length > 0) {
            let updates = {};
            const isInitialFontValid = allFonts.some(
                (f) => f.id === config.initialFont,
            );
            if (!isInitialFontValid) updates.initialFont = allFonts[0].id;

            const isNameFontValid = allFonts.some(
                (f) => f.id === config.nameFont,
            );
            if (!isNameFontValid) updates.nameFont = allFonts[0].id;

            if (Object.keys(updates).length > 0) {
                updateConfig(updates);
            }
        }
    }, [allFonts]);

    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
        />
    );

    // Get active fonts
    const initialFontData = useMemo(
        () => allFonts.find((f) => f.id === config.initialFont) || allFonts[0],
        [config.initialFont, allFonts],
    );
    const nameFontData = useMemo(
        () => allFonts.find((f) => f.id === config.nameFont) || allFonts[0],
        [config.nameFont, allFonts],
    );

    const [loadedFonts, setLoadedFonts] = useState({});

    useEffect(() => {
        let mounted = true;
        const loadFonts = async () => {
            const fontsToLoad = [initialFontData, nameFontData].filter(Boolean);

            for (const font of fontsToLoad) {
                if (!loadedFonts[font.label]) {
                    try {
                        const data = await getCached3DFont(font);
                        if (mounted) {
                            setLoadedFonts((prev) => ({
                                ...prev,
                                [font.label]: data,
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
    }, [initialFontData, nameFontData, loadedFonts]);

    // Deferred rendering to keep UI responsive
    const deferredConfig = useDeferredValue(config);

    const initialText = typeof deferredConfig.initial === 'string' ? deferredConfig.initial : " ";
    const nameText = typeof deferredConfig.name === 'string' ? deferredConfig.name : " ";

    const parsedInitialFont = initialFontData
        ? loadedFonts[initialFontData.label]
        : null;
    const parsedNameFont = nameFontData
        ? loadedFonts[nameFontData.label]
        : null;

    const centerGeometryXY = (geo) => {
        geo.computeBoundingBox();
        const xOffset = -0.5 * (geo.boundingBox.max.x + geo.boundingBox.min.x);
        const yOffset = -0.5 * (geo.boundingBox.max.y + geo.boundingBox.min.y);
        geo.translate(xOffset, yOffset, 0);
        return geo;
    };

    const initialGeo = useMemo(() => {
        if (!parsedInitialFont) return null;
        const safeName = typeof deferredConfig.name === 'string' ? deferredConfig.name : "";
        const txt =
            initialText === " "
                ? safeName.charAt(0)?.toUpperCase() || "N"
                : initialText;
        const thickness = Number(deferredConfig.initialThickness) || 40;
        const size = Number(deferredConfig.initialSize) || 200;

        return centerGeometryXY(
            new TextGeometry(txt, {
                font: parsedInitialFont,
                size: size,
                height: thickness,
                depth: thickness,
                curveSegments: 12,
                bevelEnabled: false,
            }),
        );
    }, [
        parsedInitialFont,
        deferredConfig.initialSize,
        deferredConfig.initialThickness,
        initialText,
        deferredConfig.name,
    ]);

    const cutterGeo = useMemo(() => {
        if (!parsedNameFont) return null;
        const thickness = Number(deferredConfig.pocketDepth) + 5;
        const size = Number(deferredConfig.nameSize) || 50;
        const tol = Number(deferredConfig.tolerance) || 0;
        const spacing = Number(deferredConfig.nameSpacing) || 0;
        const curve = Number(deferredConfig.nameCurve) || 0;

        return buildCustomTextGeometry(
            nameText,
            parsedNameFont,
            size,
            thickness,
            spacing,
            curve,
            tol,
        );
    }, [
        parsedNameFont,
        deferredConfig.nameSize,
        deferredConfig.pocketDepth,
        deferredConfig.tolerance,
        deferredConfig.nameSpacing,
        deferredConfig.nameCurve,
        nameText,
    ]);

    const insertGeo = useMemo(() => {
        if (!parsedNameFont) return null;
        const thickness = Number(deferredConfig.nameThickness) || 15;
        const size = Number(deferredConfig.nameSize) || 50;
        const spacing = Number(deferredConfig.nameSpacing) || 0;
        const curve = Number(deferredConfig.nameCurve) || 0;

        return buildCustomTextGeometry(
            nameText,
            parsedNameFont,
            size,
            thickness,
            spacing,
            curve,
            0,
        );
    }, [
        parsedNameFont,
        deferredConfig.nameSize,
        deferredConfig.nameThickness,
        deferredConfig.nameSpacing,
        deferredConfig.nameCurve,
        nameText,
    ]);

    const csgKey = `${initialText}-${nameText}-${deferredConfig.initialSize}-${deferredConfig.initialThickness}-${deferredConfig.nameSize}-${deferredConfig.nameThickness}-${deferredConfig.pocketDepth}-${deferredConfig.tolerance}-${deferredConfig.nameX}-${deferredConfig.nameY}-${deferredConfig.nameRotation}-${parsedInitialFont?.id}-${parsedNameFont?.id}`;

    const dims = useMemo(() => {
        if (!initialGeo) return null;
        initialGeo.computeBoundingBox();
        return {
            x:
                Math.round(
                    (initialGeo.boundingBox.max.x -
                        initialGeo.boundingBox.min.x) *
                        100,
                ) / 100,
            y:
                Math.round(
                    (initialGeo.boundingBox.max.y -
                        initialGeo.boundingBox.min.y) *
                        100,
                ) / 100,
            z: deferredConfig.initialThickness,
        };
    }, [initialGeo, deferredConfig.initialThickness]);

    return (
        <EditorLayout
            title="Monogram Insert"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="space-y-4 pt-1">
                    <TemplateManager
                        editorId="monogram_insert"
                        currentSettings={config}
                        onLoadTemplate={(tpl) => setConfig({ ...config, ...tpl })}
                        excludeKeys={["name", "initial"]}
                    />
                    <SidebarSection title="Base Initial" icon={Type}>
                        <div className="space-y-4">
                            <ControlInput
                                label="INITIAL LETTER"
                                value={typeof config.initial === 'string' ? config.initial : ""}
                                maxLength={1}
                                onChange={(e) =>
                                    updateConfig({ initial: e.target.value.substring(0, 1).toUpperCase() })
                                }
                            />
                            <ControlSelect
                                label="Font Family"
                                value={config.initialFont}
                                onChange={(val) =>
                                    updateConfig({ initialFont: val })
                                }
                                options={fontOptions}
                                prefixType="font"
                            />
                            <ControlSlider
                                label="Initial Size"
                                value={config.initialSize}
                                min={50}
                                max={400}
                                step={1}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ initialSize: val })
                                }
                            />
                            <ControlSlider
                                label="Letter Thickness"
                                value={config.initialThickness}
                                min={Math.max(5, config.pocketDepth + 2)}
                                max={100}
                                step={1}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ initialThickness: val })
                                }
                            />
                            <ControlColorPicker
                                label="Color"
                                value={config.initialColor}
                                onChange={(val) =>
                                    updateConfig({ initialColor: val })
                                }
                                options={colorOptions}
                            />
                        </div>
                    </SidebarSection>

                    <SidebarSection title="Name Overlay" icon={Layers}>
                        <div className="space-y-4">
                            <ControlInput
                                label="FULL NAME"
                                value={typeof config.name === 'string' ? config.name : ""}
                                onChange={(e) => updateConfig({ name: e.target.value })}
                            />
                            <ControlSelect
                                label="Font Family"
                                value={config.nameFont}
                                onChange={(val) =>
                                    updateConfig({ nameFont: val })
                                }
                                options={fontOptions}
                                prefixType="font"
                            />
                            <ControlColorPicker
                                label="Color"
                                value={config.nameColor}
                                onChange={(val) =>
                                    updateConfig({ nameColor: val })
                                }
                                options={colorOptions}
                            />
                            <ControlSlider
                                label="Name Size"
                                value={config.nameSize}
                                min={10}
                                max={150}
                                step={1}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ nameSize: val })
                                }
                            />

                            <ControlSlider
                                label="Thickness"
                                value={config.nameThickness}
                                min={5}
                                max={50}
                                step={1}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ nameThickness: val })
                                }
                            />
                            <ControlSlider
                                label="Letter Spacing"
                                value={config.nameSpacing}
                                min={-10}
                                max={30}
                                step={0.5}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ nameSpacing: val })
                                }
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <ControlSlider
                                    label="Rotation"
                                    value={config.nameRotation}
                                    min={-360}
                                    max={360}
                                    step={1}
                                    unit="°"
                                    onChange={(val) =>
                                        updateConfig({ nameRotation: val })
                                    }
                                />
                                <ControlSlider
                                    label="Curve Text"
                                    value={config.nameCurve}
                                    min={-360}
                                    max={360}
                                    step={1}
                                    unit="°"
                                    onChange={(val) =>
                                        updateConfig({ nameCurve: val })
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <ControlSlider
                                    label="Pos X"
                                    value={config.nameX}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateConfig({ nameX: val })
                                    }
                                />
                                <ControlSlider
                                    label="Pos Y"
                                    value={config.nameY}
                                    min={-100}
                                    max={100}
                                    step={1}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateConfig({ nameY: val })
                                    }
                                />
                            </div>
                        </div>
                    </SidebarSection>

                    <SidebarSection title="Pocket Fit" icon={Settings}>
                        <div className="space-y-4">
                            <ControlSlider
                                label="Pocket Depth"
                                value={config.pocketDepth}
                                min={1}
                                max={Math.max(1, config.initialThickness - 2)}
                                step={1}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ pocketDepth: val })
                                }
                            />
                            <ControlSlider
                                label="Clearance / Tolerance"
                                value={config.tolerance}
                                min={0}
                                max={1.5}
                                step={0.01}
                                unit="mm"
                                onChange={(val) =>
                                    updateConfig({ tolerance: val })
                                }
                            />
                        </div>
                    </SidebarSection>
                </div>
            }>
            <div className="relative w-full h-full">
                <EditorCanvas title="Monogram Insert" dims={dims}>
                    {parsedInitialFont && parsedNameFont && (
                        <group position={[0, 0, 0]} key={csgKey}>
                            {/* 1. BASE INITIAL WITH CARVED POCKET */}
                            <mesh name="Base_Initial" castShadow receiveShadow>
                                <CSG>
                                    <Base geometry={initialGeo} />
                                    {cutterGeo && (
                                        <Subtraction
                                            geometry={cutterGeo}
                                            position={[
                                                deferredConfig.nameX,
                                                deferredConfig.nameY,
                                                deferredConfig.initialThickness - deferredConfig.pocketDepth - 0.1,
                                            ]}
                                            rotation={[0, 0, (deferredConfig.nameRotation * Math.PI) / 180]}
                                        />
                                    )}
                                </CSG>
                                <meshStandardMaterial color={deferredConfig.initialColor} />
                            </mesh>

                            {/* 2. THE INSERT NAME (PHYSICAL PIECE) */}
                            <group
                                position={[
                                    deferredConfig.nameX,
                                    deferredConfig.nameY,
                                    deferredConfig.initialThickness - deferredConfig.pocketDepth + (isDisassembled ? 50 : 0),
                                ]}
                                rotation={[0, 0, (deferredConfig.nameRotation * Math.PI) / 180]}
                            >
                                {insertGeo && (
                                    <mesh name="Name_Overlay_Part" castShadow receiveShadow geometry={insertGeo}>
                                        <meshStandardMaterial color={deferredConfig.nameColor} />
                                    </mesh>
                                )}
                            </group>
                        </group>
                    )}
                </EditorCanvas>

                {/* HTML viewport overlay — rendered on top of the canvas */}
                <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDisassembled((d) => !d);
                        }}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border transition-all ${isDisassembled ? "bg-secondary text-white border-secondary" : "bg-white/90 text-gray-700 border-secondary/30 hover:border-secondary hover:text-secondary"}`}
                    >
                        {isDisassembled ? "⊟" : "⊞"} {isDisassembled ? "Assembled" : "Exploded"}
                    </button>
                </div>
            </div>
        </EditorLayout>
    );
}
