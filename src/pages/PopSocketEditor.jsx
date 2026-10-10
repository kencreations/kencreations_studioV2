/** PopSocket editor. Cap geometry and print orientation remain unchanged. */
import { useState, useMemo, useCallback, useRef } from "react";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { useHistoryState } from "../hooks/useHistoryState";
import { HistoryControls } from "../components/HistoryControls";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import PrinterSelector from "../components/PrinterSelector";
import TemplateManager from "../components/TemplateManager";
import PopSocketMesh from "../components/3D/PopSocketMesh";
import TypographyDiagnostics from "../components/3D/TypographyDiagnostics";
import {
    SidebarSection,
    ControlInput,
    ControlSlider,
    ControlSelect,
    ControlColorPicker,
    ControlToggle,
    editorIcons,
} from "../components/UI/EditorControls";
import { POPSOCKET_DEFAULTS } from "../store/appState";

// ─── Style Preset Definitions ─────────────────────────────────────────────────
const STYLE_PRESETS = [
    {
        id: "chunky-rounded",
        label: "Chunky Rounded",
        emoji: "🍩",
        description: "Thick rounded letters with soft corners. Playful but premium.",
    },
    {
        id: "groovy-vertical",
        label: "Groovy Vertical",
        emoji: "✌️",
        description: "Rounded retro letters with varied height and a gentle wave.",
    },
    {
        id: "organic-circular",
        label: "Organic Circular",
        emoji: "🌀",
        description: "Artistic arrangement that organically fills the circular cap.",
    },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function PopSocketSidebar({ config, setConfig, allFonts }) {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors } = useProfile();

    const colorOptions = useMemo(() => {
        const merged = [];
        Object.entries(cloudColors || {}).forEach(([brand, brandColors]) => {
            brandColors.forEach((color) => {
                merged.push({ label: color.name, value: color.hex, hex: color.hex, group: brand });
            });
        });
        (customColors || []).forEach((color) => {
            merged.push({ label: color.color_name, value: color.hex_code, hex: color.hex_code, group: color.brand || "Custom" });
        });
        return merged;
    }, [cloudColors, customColors]);

    const fontOptions = useMemo(
        () => allFonts.map((f) => ({ label: f.label, value: f.id })),
        [allFonts],
    );

    const update = useCallback(
        (key, value) => setConfig((prev) => ({ ...prev, [key]: value })),
        [setConfig],
    );

    return (
        <div className="flex h-full flex-col gap-4 text-slate-700">
            <PrinterSelector />
            <TemplateManager
                editorId="popsocket"
                currentSettings={config}
                excludeKeys={["text"]}
                onLoadTemplate={(saved) => setConfig((prev) => ({ ...prev, ...saved, text: prev.text }))}
            />

            {/* ── Style Presets ───────────────────────────────────────────────── */}
            <SidebarSection title="Style Preset" icon={editorIcons.ring}>
                <div className="grid grid-cols-1 gap-2">
                    {STYLE_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => setConfig(prev => ({ ...prev, stylePreset: preset.id, layoutMode: preset.id !== 'organic-circular' && prev.layoutMode === '3-lines' ? 'auto' : prev.layoutMode }))}
                            className={`flex items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                                config.stylePreset === preset.id
                                    ? "border-teal-500 bg-teal-50 shadow-sm"
                                    : "border-gray-200 bg-gray-50 hover:border-teal-300 hover:bg-white"
                            }`}
                        >
                            <span className="text-xl leading-none mt-0.5">{preset.emoji}</span>
                            <div>
                                <span className={`block text-xs font-bold ${config.stylePreset === preset.id ? "text-teal-700" : "text-gray-800"}`}>
                                    {preset.label}
                                </span>
                                <span className="block text-[10px] text-gray-500 leading-tight mt-0.5">
                                    {preset.description}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </SidebarSection>

            {/* ── Text ─────────────────────────────────────────────────────────── */}
            <SidebarSection title="Text & Font" icon={editorIcons.text}>
                {config.stylePreset === 'organic-circular' ? <label className="block space-y-1.5">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Custom Text</span>
                    <textarea rows={3} value={config.text} placeholder="Your name or phrase"
                        onChange={e => setConfig(prev => ({ ...prev, text: e.target.value, glyphAdjustments: {} }))}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-teal-500 focus:bg-white" />
                    <span className="block text-[10px] text-gray-500">Enter line breaks for an exact arrangement, or let the selected layout split your text.</span>
                </label> : <ControlInput
                    label="Custom Text"
                    value={config.text}
                    onChange={(e) => setConfig(prev => ({ ...prev, text: e.target.value, glyphAdjustments: {} }))}
                    placeholder="Your name or phrase"
                />}
                <ControlSelect
                    label="Font"
                    value={config.fontId}
                    onChange={(value) => update("fontId", value)}
                    options={fontOptions}
                    prefixType="font"
                />
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative group">
                        <ControlSlider
                            label="Font Size"
                            value={config.fontSize}
                            min={4}
                            max={24}
                            step={0.5}
                            unit="mm"
                            onChange={(v) => update("fontSize", v)}
                            disabled={config.autoFit}
                        />
                        {config.autoFit && (
                            <div className="absolute top-0 right-0 -mt-1 -mr-2 text-[10px] text-gray-400 cursor-help" title="Font Size is automatically calculated when 'Scale to Cap' is enabled.">
                                (Auto)
                            </div>
                        )}
                    </div>
                    <ControlSlider
                        label="Text Depth"
                        value={config.textDepth}
                        min={0.5}
                        max={4}
                        step={0.25}
                        unit="mm"
                        onChange={(v) => update("textDepth", v)}
                    />
                </div>
                <ControlSlider
                    label="Letter Spacing"
                    value={config.letterSpacing}
                    min={-5}
                    max={10}
                    step={0.5}
                    unit="mm"
                    onChange={(v) => update("letterSpacing", v)}
                />
                <ControlToggle
                    label="Scale to Cap"
                    checked={config.autoFit}
                    onChange={(v) => update("autoFit", v)}
                />
                
                {/* Layout Mode Selector */}
                <div className="mt-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">
                        Layout Mode
                    </span>
                    <div className={`grid ${config.stylePreset === 'organic-circular' ? 'grid-cols-4' : 'grid-cols-3'} gap-1`}>
                        {[
                            { id: 'auto', label: 'Auto Fit' },
                            { id: '1-line', label: '1 Line' },
                            { id: '2-lines', label: '2 Lines' },
                            ...(config.stylePreset === 'organic-circular' ? [{ id: '3-lines', label: '3 Lines' }] : [])
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => update("layoutMode", mode.id)}
                                className={`rounded-lg border py-1.5 text-[11px] font-bold transition-all ${
                                    (config.layoutMode || 'auto') === mode.id
                                        ? "border-teal-500 bg-teal-50 text-teal-700"
                                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-teal-300"
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                {config.autoFit && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <ControlSlider
                            label="Radial Fit"
                            value={config.fillIntensity}
                            min={50}
                            max={100}
                            step={1}
                            unit="%"
                            onChange={(v) => update("fillIntensity", v)}
                        />
                        <ControlSlider
                            label="Edge Margin"
                            value={config.edgeMargin}
                            min={0}
                            max={5}
                            step={0.5}
                            unit="mm"
                            onChange={(v) => update("edgeMargin", v)}
                        />
                    </div>
                )}
            </SidebarSection>
            
            {/* ── Advanced Shaping ───────────────────────────────────────────── */}
            <SidebarSection title="Advanced Shaping" icon={editorIcons.adjust}>
                <ControlSlider
                    label="Shape Intensity"
                    value={config.blobIntensity}
                    min={0}
                    max={5}
                    step={0.1}
                    onChange={(v) => update("blobIntensity", v)}
                />
                <ControlSlider
                    label="Roundness"
                    value={config.roundness}
                    min={0}
                    max={3}
                    step={0.1}
                    onChange={(v) => update("roundness", v)}
                />
                <ControlSlider
                    label="Compactness"
                    value={config.compactness}
                    min={0.5}
                    max={2}
                    step={0.1}
                    onChange={(v) => update("compactness", v)}
                />
                {config.stylePreset === 'organic-circular' && <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer py-2 font-bold">Printing limits</summary>
                    <ControlSlider label="Minimum Letter Gap" value={config.minGap ?? .5} min={.4} max={2} step={.1} unit="mm" onChange={v => update('minGap', v)} />
                    <ControlSlider label="Minimum Feature" value={config.minFeature ?? .6} min={.4} max={1.5} step={.1} unit="mm" onChange={v => update('minFeature', v)} />
                </details>}
            </SidebarSection>

            <SidebarSection title="Manual Glyph Placement" icon={editorIcons.adjust}>
                <ControlToggle label="Adjust individual letters" checked={!!config.manualPlacement} onChange={v => update('manualPlacement', v)} />
                {config.manualPlacement && <>
                    <p className="text-[10px] text-gray-500">Offsets use millimetres. Unsafe overlaps or lost counters block export. Reset adjustments after changing your text.</p>
                    {Array.from(config.text.trim().replace(/\s+/g, '')).map((char, index) => {
                        const adjustment = config.glyphAdjustments?.[index] || {};
                        const change = (field, value) => setConfig(prev => ({ ...prev, glyphAdjustments: { ...prev.glyphAdjustments, [index]: { ...prev.glyphAdjustments?.[index], [field]: value } } }));
                        return <details key={index} className="text-xs border-b py-2"><summary>{index + 1}. {char}</summary>
                            <ControlSlider label="Horizontal" value={adjustment.x || 0} min={-5} max={5} step={.1} unit="mm" onChange={v => change('x', v)} />
                            <ControlSlider label="Vertical" value={adjustment.y || 0} min={-5} max={5} step={.1} unit="mm" onChange={v => change('y', v)} />
                            <ControlSlider label="Rotation" value={adjustment.rotation || 0} min={-15} max={15} step={1} unit="°" onChange={v => change('rotation', v)} />
                            <ControlSlider label="Scale" value={adjustment.scale ?? 1} min={.8} max={1.2} step={.01} onChange={v => change('scale', v)} />
                            <ControlSlider label="Width" value={adjustment.width ?? 1} min={.7} max={1.3} step={.01} onChange={v => change('width', v)} />
                            <ControlSlider label="Height" value={adjustment.height ?? 1} min={.7} max={1.3} step={.01} onChange={v => change('height', v)} />
                            <ControlSlider label="Local Stretch" value={adjustment.stretch ?? 0} min={-1} max={1} step={.05} onChange={v => change('stretch', v)} />
                        </details>;
                    })}
                    <button className="text-xs font-bold text-teal-700" onClick={() => update('glyphAdjustments', {})}>Reset Letter Adjustments</button>
                </>}
            </SidebarSection>

            {/* ── Materials & Modes ──────────────────────────────────────────── */}
            <SidebarSection title="Materials & Modes" icon={editorIcons.droplet}>
                {/* Text mode: raised vs engraved */}
                <div>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">
                        Text Mode
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        {["raised", "engraved"].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => update("textMode", mode)}
                                className={`rounded-xl border-2 py-2 text-xs font-bold capitalize transition-all ${
                                    config.textMode === mode
                                        ? "border-teal-500 bg-teal-50 text-teal-700"
                                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-teal-300"
                                }`}
                            >
                                {mode === "raised" ? "⬆ Raised" : "⬇ Engraved"}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="mt-4">
                    <ControlColorPicker
                        label="Text Color"
                        value={config.textColor}
                        onChange={(v) => update("textColor", v)}
                        options={colorOptions}
                    />
                </div>
            </SidebarSection>

            {/* ── Colors ───────────────────────────────────────────────────────── */}
            <SidebarSection title="Colors" icon={editorIcons.droplet}>
                <ControlColorPicker
                    label="Part Color"
                    value={config.baseColor}
                    onChange={(v) => update("baseColor", v)}
                    options={colorOptions}
                />
            </SidebarSection>


        </div>
    );
}

// ─── Main Editor Page ─────────────────────────────────────────────────────────
export default function PopSocketEditor() {
    const { allFonts } = useProfile();
    const canvasRef = useRef(null);
    const previewGroupRef = useRef(null);
    const [typography, setTypography] = useState({ status: 'loading' });

    const [config, setConfig, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState({ ...POPSOCKET_DEFAULTS });

    // Expose undo/redo to the top bar
    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
        />
    );

    // Provide a clean Z-up scene for export, preserving exact dimensions
    const getCustomExportScene = useCallback(() => {
        if (!previewGroupRef.current) throw new Error('The cap is still loading.');
        const key = JSON.stringify(config);
        let ready = !config.text.trim(), capReady = false;
        previewGroupRef.current.traverse(node => {
            if (node.userData.typographyReady === key) ready = true;
            if (node.userData.popSocketCap) capReady = true;
        });
        if (!capReady || !ready || (config.text.trim() && (typography.key !== key || typography.status !== 'ready'))) throw new Error((!typography.key || typography.key === key) && typography.error ? typography.error : 'Wait for the current text preview to finish.');
        const exportScene = previewGroupRef.current.clone(true);
        // EditorCanvas disposes export resources. A Three clone otherwise
        // shares geometry/material with the live preview.
        exportScene.traverse(node => {
            if (node.geometry) node.geometry = node.geometry.clone();
            if (node.material) node.material = Array.isArray(node.material) ? node.material.map(m => m.clone()) : node.material.clone();
        });
        // Convert from internal Y-up local space to standard Z-up printing orientation
        // A rotation of +90 degrees on X converts Y to Z, and Z to -Y. This keeps the top face pointing up.
        exportScene.rotation.set(Math.PI / 2, 0, 0);
        exportScene.position.set(0, 0, 0);
        exportScene.updateMatrixWorld(true);
        return exportScene;
    }, [config, typography]);

    // Computed approximate dims for the HUD display (plate diameter and depth including tabs)
    // The standard PopSocket plate is 39mm in diameter (19.5mm radius).
    const dims = useMemo(() => ({
        x: Math.round(19.5 * 2),
        y: Math.round(19.5 * 2),
        z: Math.round(2.0 + 3.5 /* ring depth */ + (config.textMode === "raised" ? config.textDepth : 0)),
    }), [config.textDepth, config.textMode]);

    return (
        <EditorLayout
            title="PopSocket Generator"
            topBarActions={topBarActions}
            sidebarContent={
                <PopSocketSidebar
                    config={config}
                    setConfig={setConfig}
                    allFonts={allFonts}
                />
            }
        >
            <div className="relative h-full w-full">
                <EditorCanvas
                    title="PopSocket"
                    generatorId="popsocket"
                    ref={canvasRef}
                    dims={dims}
                    cameraPosition={[0, 40, 60]}
                    cameraTarget={[0, 5, 0]}
                    getCustomExportScene={getCustomExportScene}
                >
                    {/*
                     * EditorCanvas globally applies -90deg X rotation and +2.5 Y translation.
                     * We invert that here so our Y-up mesh sits perfectly flat on the grid (Y=0).
                     */}
                    <group position={[0, -2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <group ref={previewGroupRef}>
                            <PopSocketMesh config={config} onTypographyState={setTypography} />
                        </group>
                    </group>
                </EditorCanvas>
                {!!config.text.trim() && (typography.key !== JSON.stringify(config) || typography.status !== 'ready') &&
                    <div role="status" className="absolute left-3 top-16 max-w-sm rounded-xl border bg-white/95 px-3 py-2 text-xs text-slate-700 shadow">
                        {(!typography.key || typography.key === JSON.stringify(config)) && typography.error ? typography.error : 'Preparing readable lettering…'}
                    </div>}
                {import.meta.env.DEV && new URLSearchParams(window.location.search).get('typographyDebug') === '1' && <TypographyDiagnostics layout={typography.layout} />}
                {typography.key === JSON.stringify(config) && typography.status === 'ready' && typography.layout?.warnings?.length > 0 &&
                    <div role="status" className="absolute left-3 top-16 max-w-sm rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow">
                        {typography.layout.warnings.join(' ')}
                    </div>}
            </div>
        </EditorLayout>
    );
}
