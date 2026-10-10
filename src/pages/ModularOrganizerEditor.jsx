/**
 * ModularOrganizerEditor.jsx — Main UI layout for the Modular Desk Nameplate & Organizer.
 *
 * Three modular parts snap together with friction-fit pegs:
 *   1. Base Plate — rounded rectangle with CSG female peg slots
 *   2. Hollow Organizer Cup — pen/pencil holder with male pegs
 *   3. Multi-Line Text Block — two-line nameplate with dynamic backing plate + male pegs
 *
 * This editor mirrors the existing KC pattern:
 *   - useHistoryState for undo/redo
 *   - EditorLayout for the sidebar/canvas chrome
 *   - EditorCanvas for the R3F Canvas wrapper, export, and build plate
 *   - SidebarSection/ControlSlider/ControlInput/ControlSelect/ControlColorPicker for the sidebar
 */
import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import {
    Box,
    Type,
    Coffee,
    Settings,
    Layers,
} from "lucide-react";

import { ORGANIZER_DEFAULTS } from "../store/appState";
import { useHistoryState } from "../hooks/useHistoryState";
import { useProfile } from "../contexts/ProfileContext";
import { useFontStore } from "../hooks/useFontStore";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { getCached3DFont } from "../utils/fontManager";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import { HistoryControls } from "../components/HistoryControls";
import TemplateManager from "../components/TemplateManager";
import SmartOrganizer from "../components/3D/Organizer/SmartOrganizer";
import {
    SidebarSection,
    ControlInput,
    ControlSelect,
    ControlSlider,
    ControlColorPicker,
} from "../components/UI/EditorControls";

// ─────────────────────────────────────────────────────────────────────────────
export default function ModularOrganizerEditor() {
    // ── Profile & color data ─────────────────────────────────────────────────
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors } = useProfile();
    const { allFonts } = useFontStore();

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

    // ── State with undo/redo ─────────────────────────────────────────────────
    const [config, setConfig, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState(ORGANIZER_DEFAULTS);

    const updateConfig = (updates) => {
        setConfig({ ...config, ...updates });
    };

    // ── Validate fonts exist ─────────────────────────────────────────────────
    useEffect(() => {
        if (allFonts.length > 0) {
            const updates = {};
            if (!allFonts.some((f) => f.id === config.line1Font)) {
                updates.line1Font = allFonts[0].id;
            }
            if (!allFonts.some((f) => f.id === config.line2Font)) {
                updates.line2Font = allFonts[0].id;
            }
            if (Object.keys(updates).length > 0) updateConfig(updates);
        }
    }, [allFonts]);

    // ── Load fonts ───────────────────────────────────────────────────────────
    const line1FontData = useMemo(
        () => allFonts.find((f) => f.id === config.line1Font) || allFonts[0],
        [config.line1Font, allFonts],
    );
    const line2FontData = useMemo(
        () => allFonts.find((f) => f.id === config.line2Font) || allFonts[0],
        [config.line2Font, allFonts],
    );

    const [loadedFonts, setLoadedFonts] = useState({});

    useEffect(() => {
        let mounted = true;
        const loadFonts = async () => {
            const toLoad = [line1FontData, line2FontData].filter(Boolean);
            for (const font of toLoad) {
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
                        console.error("Failed to load font:", font.label, err);
                    }
                }
            }
        };
        loadFonts();
        return () => { mounted = false; };
    }, [line1FontData, line2FontData, loadedFonts]);

    const parsedLine1Font = line1FontData ? loadedFonts[line1FontData.label] : null;
    const parsedLine2Font = line2FontData ? loadedFonts[line2FontData.label] : null;

    // ── Deferred rendering ───────────────────────────────────────────────────
    const deferredConfig = useDeferredValue(config);

    // ── Viewport toggle ──────────────────────────────────────────────────────
    const isExploded = deferredConfig.viewMode === "exploded";

    // ── Dimensions badge ─────────────────────────────────────────────────────
    const dims = useMemo(() => ({
        x: deferredConfig.baseWidth,
        y: deferredConfig.baseDepth,
        z: Math.max(
            deferredConfig.baseThickness,
            deferredConfig.baseThickness + deferredConfig.cupHeight,
        ),
    }), [deferredConfig.baseWidth, deferredConfig.baseDepth, deferredConfig.baseThickness, deferredConfig.cupHeight]);

    // ── Top-bar actions ──────────────────────────────────────────────────────
    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
        />
    );

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <EditorLayout
            title="Modular Organizer"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="space-y-4 pt-1">
                    <TemplateManager
                        editorId="modular_organizer"
                        currentSettings={config}
                        onLoadTemplate={(tpl) => setConfig({ ...config, ...tpl })}
                        excludeKeys={["line1Text", "line2Text"]}
                    />

                    {/* ─── Base Plate ─────────────────────────────────── */}
                    <SidebarSection title="Base Plate" icon={Box}>
                        <div className="space-y-4">
                            <ControlSlider
                                label="Width"
                                value={config.baseWidth}
                                min={60} max={300} step={1} unit="mm"
                                onChange={(val) => updateConfig({ baseWidth: val })}
                            />
                            <ControlSlider
                                label="Depth"
                                value={config.baseDepth}
                                min={30} max={200} step={1} unit="mm"
                                onChange={(val) => updateConfig({ baseDepth: val })}
                            />
                            <ControlSlider
                                label="Thickness"
                                value={config.baseThickness}
                                min={2} max={10} step={0.5} unit="mm"
                                onChange={(val) => updateConfig({ baseThickness: val })}
                            />
                            <ControlSlider
                                label="Corner Radius"
                                value={config.baseRadius}
                                min={0} max={20} step={0.5} unit="mm"
                                onChange={(val) => updateConfig({ baseRadius: val })}
                            />
                            <ControlColorPicker
                                label="Color"
                                value={config.baseColor}
                                onChange={(val) => updateConfig({ baseColor: val })}
                                options={colorOptions}
                            />
                        </div>
                    </SidebarSection>

                    {/* ─── Organizer Cup ──────────────────────────────── */}
                    <SidebarSection title="Organizer Cup" icon={Coffee}>
                        <div className="space-y-4">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">CUP TEXTURE (GEOMETRY)</label>
                                <ControlSelect
                                    options={[
                                        { label: "Plain", value: "Plain" },
                                        { label: "Hexagon", value: "Hexagon" },
                                        { label: "Octagon", value: "Octagon" },
                                        { label: "Low-Poly (12-Sided)", value: "Low-Poly (12-Sided)" }
                                    ]}
                                    value={config.cupStyle || "Plain"}
                                    onChange={(v) => updateConfig({ cupStyle: v })}
                                />
                            </div>
                            <ControlSlider
                                label="Diameter"
                                value={config.cupDiameter}
                                min={20} max={120} step={1} unit="mm"
                                onChange={(val) => updateConfig({ cupDiameter: val })}
                            />
                            <ControlSlider
                                label="Height"
                                value={config.cupHeight}
                                min={20} max={150} step={1} unit="mm"
                                onChange={(val) => updateConfig({ cupHeight: val })}
                            />
                            <ControlSlider
                                label="Wall Thickness"
                                value={config.cupWallThick}
                                min={1} max={8} step={0.5} unit="mm"
                                onChange={(val) => updateConfig({ cupWallThick: val })}
                            />

                            <ControlColorPicker
                                label="Color"
                                value={config.cupColor}
                                onChange={(val) => updateConfig({ cupColor: val })}
                                options={colorOptions}
                            />
                        </div>
                    </SidebarSection>

                    {/* ─── Text Block ─────────────────────────────────── */}
                    <SidebarSection title="Nameplate Text" icon={Type}>
                        <div className="space-y-4">
                            {/* Line 1 */}
                            <div className="rounded-xl bg-slate-50 p-3 space-y-3 border border-secondary/10">
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-secondary/60">
                                    Line 1
                                </span>
                                <ControlInput
                                    label="Text"
                                    value={config.line1Text}
                                    onChange={(e) => updateConfig({ line1Text: e.target.value })}
                                />
                                <ControlSelect
                                    label="Font"
                                    value={config.line1Font}
                                    onChange={(val) => updateConfig({ line1Font: val })}
                                    options={fontOptions}
                                    prefixType="font"
                                />
                                <ControlSlider
                                    label="Size"
                                    value={config.line1Size}
                                    min={5} max={100} step={1} unit="mm"
                                    onChange={(val) => updateConfig({ line1Size: val })}
                                />
                                <ControlSelect
                                    label="Alignment"
                                    value={config.textAlign || "center"}
                                    onChange={(val) => updateConfig({ textAlign: val })}
                                    options={[
                                        { label: "Left", value: "left" },
                                        { label: "Center", value: "center" },
                                        { label: "Right", value: "right" },
                                    ]}
                                />
                                <ControlSlider
                                    label="Offset X"
                                    value={config.line1OffsetX}
                                    min={-100} max={100} step={1} unit="mm"
                                    onChange={(val) => updateConfig({ line1OffsetX: val })}
                                />
                                <ControlSlider
                                    label="Spacing Y"
                                    value={config.lineSpacing}
                                    min={-20} max={50} step={0.5} unit="mm"
                                    onChange={(val) => updateConfig({ lineSpacing: val })}
                                />
                            </div>

                            {/* Line 2 */}
                            <div className="rounded-xl bg-slate-50 p-3 space-y-3 border border-secondary/10">
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-secondary/60">
                                    Line 2
                                </span>
                                <ControlInput
                                    label="Text"
                                    value={config.line2Text}
                                    onChange={(e) => updateConfig({ line2Text: e.target.value })}
                                />
                                <ControlSelect
                                    label="Font"
                                    value={config.line2Font}
                                    onChange={(val) => updateConfig({ line2Font: val })}
                                    options={fontOptions}
                                    prefixType="font"
                                />
                                <ControlSlider
                                    label="Size"
                                    value={config.line2Size}
                                    min={5} max={120} step={1} unit="mm"
                                    onChange={(val) => updateConfig({ line2Size: val })}
                                />
                            </div>

                            <ControlSlider
                                label="Foreground Text Depth"
                                value={config.textDepth}
                                min={1} max={10} step={0.5} unit="mm"
                                onChange={(val) => updateConfig({ textDepth: val })}
                            />
                            <ControlSlider 
                                label="Backing Depth" 
                                value={config.backingDepth || 4}
                                min={1} max={15} step={0.5} unit="mm" 
                                onChange={(val) => updateConfig({ backingDepth: val })}
                            />
                            <ControlSlider
                                label="Position X"
                                value={config.textPosX}
                                min={-120} max={120} step={1} unit="mm"
                                onChange={(val) => updateConfig({ textPosX: val })}
                            />
                            <ControlSlider
                                label="Backing Pad"
                                value={config.textBackingPad}
                                min={0} max={10} step={0.5} unit="mm"
                                onChange={(val) => updateConfig({ textBackingPad: val })}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <ControlColorPicker
                                    label="Text"
                                    value={config.textColor}
                                    onChange={(val) => updateConfig({ textColor: val })}
                                    options={colorOptions}
                                />
                                <ControlColorPicker
                                    label="Backing"
                                    value={config.backingColor}
                                    onChange={(val) => updateConfig({ backingColor: val })}
                                    options={colorOptions}
                                />
                            </div>
                        </div>
                    </SidebarSection>

                    {/* ─── Hardware / Print Settings ──────────────────── */}
                    <SidebarSection title="Print & Fit" icon={Settings}>
                        <div className="space-y-4">

                            <ControlSlider
                                label="Tolerance"
                                value={config.tolerance}
                                min={0} max={1} step={0.05} unit="mm"
                                onChange={(val) => updateConfig({ tolerance: val })}
                            />
                            <p className="text-[10px] text-gray-400 leading-snug">
                                Tolerance controls friction fit looseness. Start with 0.2 mm and
                                test-print. Increase for a looser fit, decrease for tighter.
                            </p>
                        </div>
                    </SidebarSection>
                </div>
            }>
            <div className="relative w-full h-full">
                <EditorCanvas title="Modular Organizer" dims={dims}>
                    <SmartOrganizer
                        config={deferredConfig}
                        line1Font={parsedLine1Font}
                        line2Font={parsedLine2Font}
                    />
                </EditorCanvas>

                {/* ── HTML viewport overlay — Assembled/Exploded toggle ── */}
                <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            updateConfig({
                                viewMode: isExploded ? "assembled" : "exploded",
                            });
                        }}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border transition-all ${
                            isExploded
                                ? "bg-secondary text-white border-secondary"
                                : "bg-white/90 text-gray-700 border-secondary/30 hover:border-secondary hover:text-secondary"
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        {isExploded ? "Assembled" : "Exploded"}
                    </button>
                </div>
            </div>
        </EditorLayout>
    );
}
