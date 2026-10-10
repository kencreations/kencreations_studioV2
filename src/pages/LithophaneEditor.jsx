import { useModelExport } from "../hooks/useModelExport";
import { disposeExportScene } from "../engine/export/modelExport";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { exportTo3MF } from "three-3mf-exporter";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { useFontStore } from "../hooks/useFontStore";
import { useHistoryState } from "../hooks/useHistoryState";
import { HistoryControls } from "../components/HistoryControls";


import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import TemplateManager from "../components/TemplateManager";
import PrinterSelector from "../components/PrinterSelector";

import {
    SidebarSection,
    ControlInput,
    ControlSlider,
    ControlSelect,
    ControlColorPicker,
    ControlToggle,
} from "../components/UI/EditorControls";

import { Image as ImageIcon, Sliders, Type, Lightbulb, Box as BoxIcon, Layers } from 'lucide-react';
import { DimensionsBadge, EstimatorBadge } from '../components/UI/ViewportBadges';
import ImagePreprocessingModal from '../components/UI/ImagePreprocessingModal';

import SmartLithophane from "../components/3D/Shared/SmartLithophane";
import LithophaneFrame from "../components/3D/Shared/LithophaneFrame";
import { LITHOPHANE_DEFAULTS } from "../store/appState";

function LithophaneSidebar({ onBack, config, setConfig, allFonts, simulateBacklight, setSimulateBacklight, lightTemp, setLightTemp, lightIntensity, setLightIntensity, onImageUpload }) {
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
        [allFonts]
    );

    const handleLoadTemplate = (savedSettings) => {
        setConfig((prev) => ({
            ...prev,
            ...savedSettings,
            imageUrl: prev.imageUrl, // Preserve image
        }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            // Don't set imageUrl immediately. We send it to preprocessing modal.
            onImageUpload(url);
        }
    };

    return (
        <div className="flex h-full flex-col gap-4 text-slate-700">
            <PrinterSelector />
            <TemplateManager
                editorId="lithophane"
                currentSettings={config}
                excludeKeys={["imageUrl"]}
                onLoadTemplate={handleLoadTemplate}
            />

            <SidebarSection title="Image Source" icon={ImageIcon}>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Upload Image</label>
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                </div>
            </SidebarSection>

            <SidebarSection title="Shape & Dimensions" icon={Layers}>
                <ControlSelect
                    label="Crop Shape"
                    value={config.cropShape}
                    onChange={(v) => setConfig(prev => ({ ...prev, cropShape: v }))}
                    options={[
                        { label: "Rectangle", value: "rectangle" },
                        { label: "Circle", value: "circle" },
                        { label: "Heart", value: "heart" },
                        { label: "Hexagon", value: "hexagon" },
                        { label: "Alpha Cutout", value: "alpha" }
                    ]}
                />
                <ControlSelect
                    label="Resolution Grid"
                    value={config.resolution}
                    onChange={(v) => setConfig(prev => ({ ...prev, resolution: v }))}
                    options={[
                        { label: "Low (64px) - Fast Preview", value: "low" },
                        { label: "Mid (128px) - Good", value: "mid" },
                        { label: "High (256px) - Export", value: "high" }
                    ]}
                />
                <ControlSlider
                    label="Physical Width (mm)"
                    value={config.physicalWidth}
                    onChange={(v) => setConfig(prev => ({ ...prev, physicalWidth: v }))}
                    min={20} max={150} step={1}
                />
                <ControlSlider
                    label="Min Thickness (Light)"
                    value={config.minThick}
                    onChange={(v) => setConfig(prev => ({ ...prev, minThick: v }))}
                    min={0.2} max={2.0} step={0.1}
                />
                <ControlSlider
                    label="Max Thickness (Dark)"
                    value={config.maxThick}
                    onChange={(v) => setConfig(prev => ({ ...prev, maxThick: v }))}
                    min={1.0} max={5.0} step={0.1}
                />
                <ControlSlider
                    label="Layer Quantization"
                    value={config.quantizeLayerHeight}
                    onChange={(v) => setConfig(prev => ({ ...prev, quantizeLayerHeight: v }))}
                    min={0.04} max={0.2} step={0.04}
                />
            </SidebarSection>

            <SidebarSection title="Frame & Hardware" icon={BoxIcon}>
                <ControlColorPicker
                    label="Frame Color"
                    value={config.frameColor}
                    onChange={(v) => setConfig(prev => ({ ...prev, frameColor: v }))}
                    options={colorOptions}
                />
                <ControlSlider
                    label="Frame Width"
                    value={config.frameWidth}
                    onChange={(v) => setConfig(prev => ({ ...prev, frameWidth: v }))}
                    min={1.0} max={10.0} step={0.5}
                />
                <ControlSlider
                    label="Frame Depth"
                    value={config.frameDepth}
                    onChange={(v) => setConfig(prev => ({ ...prev, frameDepth: v }))}
                    min={1.0} max={10.0} step={0.1}
                />
                <ControlSelect
                    label="Frame Profile"
                    value={config.frameProfile}
                    onChange={(v) => setConfig(prev => ({ ...prev, frameProfile: v }))}
                    options={[
                        { label: "Flat", value: "flat" },
                        { label: "Fillet", value: "fillet" },
                        { label: "Chamfer", value: "chamfer" }
                    ]}
                />
                <ControlToggle
                    label="Enable Keyring"
                    checked={config.keyringEnabled}
                    onChange={(v) => setConfig(prev => ({ ...prev, keyringEnabled: v }))}
                />
                {config.keyringEnabled && (
                    <>
                        <ControlSelect
                            label="Keyring Style"
                            value={config.keyringStyle}
                            onChange={(v) => setConfig(prev => ({ ...prev, keyringStyle: v }))}
                            options={[
                                { label: "Inset Boss", value: "inset" },
                                { label: "Tab Boss", value: "tab" }
                            ]}
                        />
                        <ControlSlider
                            label="Keyring Thickness"
                            value={config.keyringThickness}
                            onChange={(v) => setConfig(prev => ({ ...prev, keyringThickness: v }))}
                            min={1.0} max={10.0} step={0.1}
                        />
                        <ControlSelect
                            label="Keyring Position"
                            value={config.keyringPosition}
                            onChange={(v) => setConfig(prev => ({ ...prev, keyringPosition: v }))}
                            options={[
                                { label: "Top", value: "top" },
                                { label: "Bottom", value: "bottom" },
                                { label: "Left", value: "left" },
                                { label: "Right", value: "right" }
                            ]}
                        />
                        <ControlSlider
                            label="Keyring Alignment"
                            value={config.keyringOffset}
                            onChange={(v) => setConfig(prev => ({ ...prev, keyringOffset: v }))}
                            min={0} max={100} step={1}
                        />
                        <div className="flex gap-2 px-1">
                            <button
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs py-1 rounded transition-colors"
                                onClick={() => setConfig(prev => ({ ...prev, keyringOffset: 15 }))}
                            >
                                Left
                            </button>
                            <button
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs py-1 rounded transition-colors"
                                onClick={() => setConfig(prev => ({ ...prev, keyringOffset: 50 }))}
                            >
                                Center
                            </button>
                            <button
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs py-1 rounded transition-colors"
                                onClick={() => setConfig(prev => ({ ...prev, keyringOffset: 85 }))}
                            >
                                Right
                            </button>
                        </div>
                        <ControlToggle
                            label="Reinforced Boss"
                            checked={config.keyringReinforced}
                            onChange={(v) => setConfig(prev => ({ ...prev, keyringReinforced: v }))}
                        />
                    </>
                )}
            </SidebarSection>

            <SidebarSection title="Border Text" icon={Type}>
                <ControlInput
                    label="Text"
                    value={config.borderText}
                    onChange={(e) => setConfig(prev => ({ ...prev, borderText: e.target.value }))}
                    placeholder="Enter border text"
                />
                {config.borderText && (
                    <>
                        <ControlSelect
                            label="Text Side"
                            value={config.borderTextSide}
                            onChange={(v) => setConfig(prev => ({ ...prev, borderTextSide: v }))}
                            options={[
                                { label: "Top", value: "top" },
                                { label: "Bottom", value: "bottom" },
                                { label: "Left", value: "left" },
                                { label: "Right", value: "right" }
                            ]}
                        />
                        <ControlSelect
                            label="Font"
                            value={config.borderTextFont}
                            onChange={(v) => setConfig(prev => ({ ...prev, borderTextFont: v }))}
                            options={fontOptions}
                        />
                        <ControlColorPicker
                            label="Text Color"
                            value={config.borderTextColor}
                            onChange={(v) => setConfig(prev => ({ ...prev, borderTextColor: v }))}
                            options={colorOptions}
                        />
                        <ControlSelect
                            label="Mode"
                            value={config.borderTextMode}
                            onChange={(v) => setConfig(prev => ({ ...prev, borderTextMode: v }))}
                            options={[
                                { label: "Emboss", value: "emboss" },
                                { label: "Deboss", value: "deboss" }
                            ]}
                        />
                        <ControlSlider
                            label="Text Size"
                            value={config.borderTextSize}
                            onChange={(v) => setConfig(prev => ({ ...prev, borderTextSize: v }))}
                            min={2} max={15} step={0.5}
                        />
                        <ControlSlider
                            label="Text Depth"
                            value={config.borderTextDepth}
                            onChange={(v) => setConfig(prev => ({ ...prev, borderTextDepth: v }))}
                            min={0.2} max={2.0} step={0.1}
                        />
                    </>
                )}
            </SidebarSection>

            <SidebarSection title="Live Viewer" icon={Lightbulb}>
                <ControlToggle
                    label="Simulate Backlight"
                    checked={simulateBacklight}
                    onChange={(v) => setSimulateBacklight(v)}
                />
                {simulateBacklight && (
                    <>
                        <ControlSlider
                            label="Light Temperature"
                            value={lightTemp}
                            onChange={(v) => setLightTemp(v)}
                            min={3000} max={8000} step={100}
                        />
                        <ControlSlider
                            label="Light Intensity"
                            value={lightIntensity}
                            onChange={(v) => setLightIntensity(v)}
                            min={1} max={50} step={1}
                        />
                    </>
                )}
            </SidebarSection>

        </div>
    );
}

export default function LithophaneEditor() {
    const { allFonts } = useFontStore();

    const [config, setConfig, undo, redo, canUndo, canRedo] = useHistoryState(LITHOPHANE_DEFAULTS);
    
    const [simulateBacklight, setSimulateBacklight] = useState(false);
    const [lightTemp, setLightTemp] = useState(6500);
    const [lightIntensity, setLightIntensity] = useState(15);
    const { exportModel, isExporting, exportError } = useModelExport();
    
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [rawImage, setRawImage] = useState(null);
    const [lithoDimensions, setLithoDimensions] = useState(null);
    const [lithoTexture, setLithoTexture] = useState(null);

    // Mock estimates for now based on physical width
    const estimatedWeight = Math.round((config.physicalWidth * config.physicalWidth * config.maxThick) * 0.0012) || 0;
    const mockEstimates = {
        time: config.physicalWidth > 80 ? "2h 15m" : "45m",
        weight: estimatedWeight,
        cost: estimatedWeight * 0.02
    };
    const dimensions = {
        x: config.physicalWidth + config.frameWidth * 2,
        y: (lithoDimensions ? (lithoDimensions.max.y - lithoDimensions.min.y) : config.physicalWidth) + config.frameWidth * 2,
        z: Math.max(config.maxThick, config.frameDepth)
    };

    // Refs for geometries to merge during export
    const lithoGeoRef = useRef(null);
    const lithoBBRef = useRef(null);
    const cmykGeoRef = useRef(null);
    const frameGeoRef = useRef(null);

    const handleLithoReady = useCallback((geo, bb, cmykGeo, texture) => {
        lithoGeoRef.current = geo;
        lithoBBRef.current = bb;
        cmykGeoRef.current = cmykGeo;
        setLithoDimensions(bb);
        if (texture !== undefined) setLithoTexture(texture);
    }, []);

    const handleFrameReady = useCallback((geo, bb) => {
        frameGeoRef.current = geo;
    }, []);

    const tempToColor = (kelvin) => {
        let temp = kelvin / 100;
        let red, green, blue;
        
        if (temp <= 66) {
            red = 255;
            green = temp;
            green = 99.4708025861 * Math.log(green) - 161.1195681661;
            if (temp <= 19) {
                blue = 0;
            } else {
                blue = temp - 10;
                blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
            }
        } else {
            red = temp - 60;
            red = 329.698727446 * Math.pow(red, -0.1332047592);
            green = temp - 60;
            green = 288.1221695283 * Math.pow(green, -0.0755148492);
            blue = 255;
        }

        const clamp = (v) => Math.max(0, Math.min(255, v));
        return new THREE.Color(clamp(red) / 255, clamp(green) / 255, clamp(blue) / 255);
    };

    const mergedSceneForExport = () => {
        const toMerge = [];
        if (lithoGeoRef.current) {
            // Apply white material to lithophane so it exports with a flat color in 3MF
            const lithoClone = lithoGeoRef.current.clone();
            const mesh = new THREE.Mesh(lithoClone, new THREE.MeshStandardMaterial({ color: 0xffffff }));
            mesh.updateMatrixWorld(true);
            toMerge.push(mesh);
        }
        if (frameGeoRef.current) {
            const frameClone = frameGeoRef.current.clone();
            const mesh = new THREE.Mesh(frameClone, new THREE.MeshStandardMaterial({ color: config.frameColor }));
            mesh.updateMatrixWorld(true);
            toMerge.push(mesh);
        }

        if (toMerge.length === 0) return null;
        
        const group = new THREE.Group();
        toMerge.forEach(m => group.add(m));
        return group;
    };

    const handleExportSTL = () => exportModel({ getScene: mergedSceneForExport, format: 'stl', filename: 'lithophane.stl', dispose: disposeExportScene });
    const handleExport3MF = () => exportModel({ getScene: mergedSceneForExport, format: '3mf', filename: 'lithophane.3mf', dispose: disposeExportScene });
    const handleExportCMYK = () => exportModel({
        format: '3mf', filename: 'lithophane_cmyk_modifier.3mf', dispose: disposeExportScene,
        getScene: () => {
            if (!cmykGeoRef.current) return null;
            const group = new THREE.Group();
            group.add(new THREE.Mesh(cmykGeoRef.current.clone(), new THREE.MeshStandardMaterial({ vertexColors: true })));
            return group;
        },
    });

    const actualHeight = lithoDimensions ? (lithoDimensions.max.y - lithoDimensions.min.y) : config.physicalWidth;
    const totalHeight = actualHeight + (config.frameWidth * 2) + (config.borderText ? config.borderTextSize : 0);

    const groupRotation = simulateBacklight ? [0, 0, 0] : [-Math.PI / 2, 0, 0];
    const groupPosition = simulateBacklight ? [0, totalHeight / 2, 0] : [0, config.frameDepth / 2, 0];
    const ambientIntensity = simulateBacklight ? 0.08 : 0.6;
    
    // Custom lights to inject into EditorCanvas
    const customLights = simulateBacklight ? (
        <pointLight 
            position={[0, totalHeight / 2, -15]} 
            intensity={lightIntensity * 2} 
            color={tempToColor(lightTemp)} 
            distance={100}
            decay={2}
        />
    ) : null;

    return (
        <>
        <EditorLayout
            title="Lithophane Generator"
            sidebarContent={
                <LithophaneSidebar
                    config={config}
                    setConfig={setConfig}
                    allFonts={allFonts}
                    simulateBacklight={simulateBacklight}
                    setSimulateBacklight={setSimulateBacklight}
                    lightTemp={lightTemp}
                    setLightTemp={setLightTemp}
                    lightIntensity={lightIntensity}
                    setLightIntensity={setLightIntensity}
                    onImageUpload={(url) => {
                        setRawImage(url);
                        setIsImageModalOpen(true);
                    }}
                />
            }
            headerRight={
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <HistoryControls
                        undo={undo}
                        redo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                    />
                    <div className="flex gap-2">
                        <button
                            title={exportError || "Export CMYK"}
                            onClick={handleExportCMYK}
                            disabled={isExporting || !config.imageUrl}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                        >
                            {isExporting ? "Exporting..." : "Export CMYK Modifier"}
                        </button>
                        <button
                            title={exportError || "Export STL"}
                            onClick={handleExportSTL}
                            disabled={isExporting || !config.imageUrl}
                            className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                        >
                            {isExporting ? "Exporting..." : "Export STL"}
                        </button>
                        <button
                            title={exportError || "Export 3MF"}
                            onClick={handleExport3MF}
                            disabled={isExporting || !config.imageUrl}
                            className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                        >
                            {isExporting ? "Exporting..." : "Export 3MF"}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="relative w-full h-full bg-slate-50">
                {exportError && <p role="alert" className="absolute top-20 left-4 z-30 bg-white p-3 text-red-700">{exportError}</p>}
            <EditorCanvas
                    getCustomExportScene={mergedSceneForExport}
                    isExporting={isExporting}
                    customAmbientLightIntensity={ambientIntensity}
                    customLights={customLights}
                    dims={dimensions}
                >
                    {simulateBacklight && (
                        <mesh scale={1000}>
                            <sphereGeometry args={[1, 32, 32]} />
                            <meshBasicMaterial color="#020203" side={THREE.BackSide} />
                        </mesh>
                    )}
                    <group rotation={groupRotation} position={groupPosition}>
                        <SmartLithophane
                            imageUrl={config.imageUrl}
                            cropShape={config.cropShape}
                            minThick={config.minThick}
                            maxThick={config.maxThick}
                            resolution={config.resolution}
                            quantizeLayerHeight={config.quantizeLayerHeight}
                            simulateBacklight={simulateBacklight}
                            emissiveTexture={lithoTexture}
                            emissiveColor={tempToColor(lightTemp)}
                            emissiveIntensity={lightIntensity / 10}
                            autoSharpen={false}
                            autoLevel={false}
                            invert={false}
                            physicalWidth={config.physicalWidth}
                            color="#ffffff"
                            onGeometryReady={handleLithoReady}
                        />
                        <LithophaneFrame
                            lithoBoundingBox={lithoBBRef.current}
                            frameWidth={config.frameWidth}
                            frameDepth={config.frameDepth}
                            frameProfile={config.frameProfile}
                            color={config.frameColor}
                            keyringEnabled={config.keyringEnabled}
                            keyringStyle={config.keyringStyle}
                            keyringThickness={config.keyringThickness}
                            keyringDiameter={config.keyringDiameter}
                            keyringHole={config.keyringHole}
                            keyringPosition={config.keyringPosition}
                            keyringReinforced={config.keyringReinforced}
                            borderText={config.borderText}
                            borderTextSide={config.borderTextSide}
                            borderTextFont={config.borderTextFont}
                            borderTextSize={config.borderTextSize}
                            borderTextDepth={config.borderTextDepth}
                            borderTextColor={config.borderTextColor}
                            borderTextMode={config.borderTextMode}
                            onFrameReady={handleFrameReady}
                        />
                    </group>
                </EditorCanvas>

                {!config.imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-slate-200 shadow-sm text-center">
                            <p className="text-slate-600 font-medium">Upload an image in the sidebar to begin</p>
                        </div>
                    </div>
                )}
            </div>
        </EditorLayout>
        
        <ImagePreprocessingModal
            isOpen={isImageModalOpen}
            initialImage={rawImage}
            onClose={() => setIsImageModalOpen(false)}
            onConfirm={(processedBase64) => {
                setConfig(prev => ({ ...prev, imageUrl: processedBase64 }));
                setIsImageModalOpen(false);
            }}
        />
        </>
    );
}
