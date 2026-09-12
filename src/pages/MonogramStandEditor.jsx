import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link } from "react-router-dom";
import { Type, Layers, Settings, Save } from "lucide-react";
import TemplateManager from "../components/TemplateManager";
import { Geometry as CSG, Base, Subtraction, Addition } from "@react-three/csg";
import { Text3D, Center } from "@react-three/drei";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Box3, ExtrudeGeometry, BoxGeometry } from "three";
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

        // 1. Measure the TRUE un-beveled width for consistent letter tracking
        const measureGeo = new TextGeometry(char, {
            font: font,
            size: size,
            height: 0.1,
            depth: 0.1,
            curveSegments: 2,
            bevelEnabled: false,
        });
        measureGeo.computeBoundingBox();
        const trueMinX = measureGeo.boundingBox.min.x;
        const trueWidth = measureGeo.boundingBox.max.x - trueMinX;

        // 2. Generate the actual physical character (with or without tolerance bevel)
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
        
        // 3. Anchor the character based on the un-beveled position
        charGeo.computeBoundingBox();
        charGeo.translate(currentX - trueMinX, 0, 0);
        geometries.push(charGeo);

        // 4. Advance tracking by the TRUE width, completely ignoring the bevel expansion!
        currentX += trueWidth + spacing;
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

const MONOGRAM_STAND_DEFAULTS = {
    name: "Kencreations",
    initial1: "K",
    initial2: "C",
    enableBase: true,
    pegSpread: 45, // NEW: Default distance from center for the pegs
    initialFont: "Chunky",
    initialSize: 120,
    initialThickness: 40,
    initialColor: "#00B1B7",

    nameFont: "Pacifico",
    nameSize: 27,
    nameThickness: 15,
    nameSpacing: -4.5,
    nameCurve: 0,
    nameX: 0,
    nameY: -30,
    nameRotation: 0, // degrees
    nameColor: "#FF9016",

    pocketDepth: 10,
    tolerance: 0.2,
};

export default function MonogramStandEditor() {
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
        useHistoryState(MONOGRAM_STAND_DEFAULTS);
    const [isDisassembled, setIsDisassembled] = useState(false);

    const updateConfig = (updates) => {
        setConfig({ ...config, ...updates });
    };

    // Removed auto-derive since we have two initials now

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

    const initialText1 =
        typeof deferredConfig.initial1 === "string"
            ? deferredConfig.initial1
            : " ";
    const initialText2 =
        typeof deferredConfig.initial2 === "string"
            ? deferredConfig.initial2
            : " ";
    const nameText =
        typeof deferredConfig.name === "string" ? deferredConfig.name : " ";

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

        const txt1 = initialText1 === " " ? "A" : initialText1;
        const txt2 = initialText2 === " " ? "B" : initialText2;

        const thickness = Number(deferredConfig.initialThickness) || 40;
        const size = Number(deferredConfig.initialSize) || 200;

        const geo1 = new TextGeometry(txt1, {
            font: parsedInitialFont,
            size: size,
            height: thickness,
            depth: thickness,
            curveSegments: 12,
            bevelEnabled: false,
        });
        centerGeometryXY(geo1);

        const geo2 = new TextGeometry(txt2, {
            font: parsedInitialFont,
            size: size,
            height: thickness,
            depth: thickness,
            curveSegments: 12,
            bevelEnabled: false,
        });
        centerGeometryXY(geo2);

        geo1.computeBoundingBox();
        geo2.computeBoundingBox();
        const width1 = geo1.boundingBox.max.x - geo1.boundingBox.min.x;
        const width2 = geo2.boundingBox.max.x - geo2.boundingBox.min.x;

        const avgWidth = (width1 + width2) / 2;
        const overlap = avgWidth * 0.15; // 15% overlap

        geo1.translate(-width1 / 2 + overlap / 2, 0, 0);
        geo2.translate(width2 / 2 - overlap / 2, 0, 0);

        let mergedGeo = BufferGeometryUtils.mergeGeometries(
            [geo1, geo2],
            false,
        );
        centerGeometryXY(mergedGeo);

        return mergedGeo;
    }, [
        parsedInitialFont,
        deferredConfig.initialSize,
        deferredConfig.initialThickness,
        initialText1,
        initialText2,
    ]);

    const baseProps = useMemo(() => {
        if (!deferredConfig.enableBase || !initialGeo) return null;
        initialGeo.computeBoundingBox();
        const minX = initialGeo.boundingBox.min.x;
        const maxX = initialGeo.boundingBox.max.x;
        const minY = initialGeo.boundingBox.min.y;
        const totalWidth = maxX - minX;
        const thickness = Number(deferredConfig.initialThickness) || 40;

        const height = 6;
        const pegRadius = 4; // 8mm diameter
        const pegHeight = 8; 
        const pegOffset = Number(deferredConfig.pegSpread) || 45; // User-controlled spacing!

        return {
            width: totalWidth + 20,
            height: height,
            depth: thickness,
            y: minY - (height / 2),
            z: thickness / 2,
            pegRadius,
            pegHeight,
            pegOffset,
            minY,
            // 0.2mm radius clearance = 0.4mm diameter allowance for glue/elephant foot!
            pegHoleArgs: [pegRadius + 0.2, pegRadius + 0.2, pegHeight, 32], 
            pegArgs: [pegRadius, pegRadius, pegHeight, 32],
            boxArgs: [totalWidth + 20, height, thickness],
            hole1Pos: [-pegOffset, minY + (pegHeight / 2), thickness / 2],
            hole2Pos: [pegOffset, minY + (pegHeight / 2), thickness / 2]
        };
    }, [
        initialGeo,
        deferredConfig.enableBase,
        deferredConfig.initialThickness,
        deferredConfig.pegSpread,
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

    const csgKey = `${initialText1}-${initialText2}-${nameText}-${deferredConfig.initialSize}-${deferredConfig.initialThickness}-${deferredConfig.nameSize}-${deferredConfig.nameThickness}-${deferredConfig.pocketDepth}-${deferredConfig.tolerance}-${deferredConfig.nameX}-${deferredConfig.nameY}-${deferredConfig.nameRotation}-${parsedInitialFont?.id}-${parsedNameFont?.id}`;

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
            title="Standing Monogram V2"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="space-y-4 pt-1">
                    <TemplateManager
                        editorId="monogram_stand"
                        currentSettings={config}
                        onLoadTemplate={(tpl) =>
                            setConfig({ ...config, ...tpl })
                        }
                        excludeKeys={["name", "initial1", "initial2"]}
                    />
                    <SidebarSection title="Base Initial" icon={Type}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <ControlInput
                                    label="INITIAL 1"
                                    value={
                                        typeof config.initial1 === "string"
                                            ? config.initial1
                                            : ""
                                    }
                                    maxLength={1}
                                    onChange={(e) =>
                                        updateConfig({
                                            initial1: e.target.value
                                                .substring(0, 1)
                                                .toUpperCase(),
                                        })
                                    }
                                />
                                <ControlInput
                                    label="INITIAL 2"
                                    value={
                                        typeof config.initial2 === "string"
                                            ? config.initial2
                                            : ""
                                    }
                                    maxLength={1}
                                    onChange={(e) =>
                                        updateConfig({
                                            initial2: e.target.value
                                                .substring(0, 1)
                                                .toUpperCase(),
                                        })
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-white/50 border border-gray-200 rounded-xl mt-2 shadow-sm">
                                <span className="font-semibold text-sm text-gray-700">
                                    Enable Stand Base
                                </span>
                                <button
                                    onClick={() =>
                                        updateConfig({
                                            enableBase: !config.enableBase,
                                        })
                                    }
                                    className={`w-12 h-6 rounded-full transition-colors relative ${config.enableBase ? "bg-primary" : "bg-gray-300"}`}>
                                    <div
                                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${config.enableBase ? "left-7" : "left-1"}`}
                                    />
                                </button>
                            </div>
                            
                            {config.enableBase && (
                                <ControlSlider
                                    label="Peg Spacing (Avoid Gaps)"
                                    value={config.pegSpread}
                                    min={10}
                                    max={150}
                                    step={1}
                                    unit="mm"
                                    onChange={(val) =>
                                        updateConfig({ pegSpread: val })
                                    }
                                />
                            )}
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
                                value={
                                    typeof config.name === "string"
                                        ? config.name
                                        : ""
                                }
                                onChange={(e) =>
                                    updateConfig({ name: e.target.value })
                                }
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
                                                deferredConfig.initialThickness -
                                                    deferredConfig.pocketDepth -
                                                    0.1,
                                            ]}
                                            rotation={[
                                                0,
                                                0,
                                                (deferredConfig.nameRotation *
                                                    Math.PI) /
                                                    180,
                                            ]}
                                        />
                                    )}
                                    {/* MODULAR PEG HOLES (with 0.15mm clearance) */}
                                    {baseProps && deferredConfig.enableBase && (
                                        <>
                                            <Subtraction position={baseProps.hole1Pos}>
                                                <cylinderGeometry args={baseProps.pegHoleArgs} />
                                            </Subtraction>
                                            <Subtraction position={baseProps.hole2Pos}>
                                                <cylinderGeometry args={baseProps.pegHoleArgs} />
                                            </Subtraction>
                                        </>
                                    )}
                                </CSG>
                                <meshStandardMaterial
                                    color={deferredConfig.initialColor}
                                />
                            </mesh>

                            {/* 1.5. THE MODULAR STAND BASE WITH PEGS */}
                            {baseProps && deferredConfig.enableBase && (
                                <group 
                                    position={[
                                        0, 
                                        baseProps.y - (isDisassembled ? 30 : 0), // Slide down when exploded!
                                        baseProps.z
                                    ]}
                                >
                                    <mesh castShadow receiveShadow>
                                        <boxGeometry args={baseProps.boxArgs} />
                                        <meshStandardMaterial color={deferredConfig.initialColor} />
                                    </mesh>
                                    
                                    {/* POSITIVE PEGS */}
                                    <mesh position={[-baseProps.pegOffset, (baseProps.height / 2) + (baseProps.pegHeight / 2), 0]} castShadow receiveShadow>
                                        <cylinderGeometry args={baseProps.pegArgs} />
                                        <meshStandardMaterial color={deferredConfig.initialColor} />
                                    </mesh>
                                    <mesh position={[baseProps.pegOffset, (baseProps.height / 2) + (baseProps.pegHeight / 2), 0]} castShadow receiveShadow>
                                        <cylinderGeometry args={baseProps.pegArgs} />
                                        <meshStandardMaterial color={deferredConfig.initialColor} />
                                    </mesh>
                                </group>
                            )}

                            {/* 2. THE INSERT NAME (PHYSICAL PIECE) */}
                            <group
                                position={[
                                    deferredConfig.nameX,
                                    deferredConfig.nameY,
                                    deferredConfig.initialThickness -
                                        deferredConfig.pocketDepth +
                                        (isDisassembled ? 50 : 0),
                                ]}
                                rotation={[
                                    0,
                                    0,
                                    (deferredConfig.nameRotation * Math.PI) /
                                        180,
                                ]}>
                                {insertGeo && (
                                    <mesh
                                        name="Name_Overlay_Part"
                                        castShadow
                                        receiveShadow
                                        geometry={insertGeo}>
                                        <meshStandardMaterial
                                            color={deferredConfig.nameColor}
                                        />
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
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border transition-all ${isDisassembled ? "bg-secondary text-white border-secondary" : "bg-white/90 text-gray-700 border-secondary/30 hover:border-secondary hover:text-secondary"}`}>
                        {isDisassembled ? "⊟" : "⊞"}{" "}
                        {isDisassembled ? "Assembled" : "Exploded"}
                    </button>
                </div>
            </div>
        </EditorLayout>
    );
}
