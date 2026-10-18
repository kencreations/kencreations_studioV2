/**
 * ScrewTopContainerEditor.jsx
 *
 * Full parametric editor for the Screw Top Container generator.
 * Follows the KenCreations Studio editor pattern:
 *   - EditorLayout (sidebar + canvas chrome)
 *   - EditorCanvas (R3F canvas, orbit, export bar, build plate)
 *   - useHistoryState (undo/redo)
 *   - SidebarSection / ControlSlider / ControlInput / ControlSelect / ControlToggle
 *   - useModelExport via EditorCanvas (STL + 3MF)
 */

import { useMemo, useDeferredValue, useState, useCallback, useRef } from "react";
import {
    Package,
    Printer,
    Type,
    AlertTriangle,
    Info,
    ChevronDown,
    ChevronUp,
    CircleDot,
} from "lucide-react";

import { SCREW_CONTAINER_DEFAULTS } from "../store/appState";
import { useHistoryState } from "../hooks/useHistoryState";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { useFontStore } from "../hooks/useFontStore";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import { HistoryControls } from "../components/HistoryControls";
import PrinterSelector from "../components/PrinterSelector";
import TemplateManager from "../components/TemplateManager";
import { containerDimensions, containerLayout, getPushOutHoleLimits, clampPushOutHoleDiameter } from "../utils/screwContainerGeometry";
import ScrewContainerMesh from "../components/3D/ScrewContainerMesh";
import {
    ControlInput,
    ControlSlider,
    ControlSelect,
    ControlColorPicker,
    ControlToggle,
    editorIcons,
} from "../components/UI/EditorControls";

// ─── Preset definitions ───────────────────────────────────────────────────────
const PRESETS = {
    katinko: {
        label: "Katinko 10 g (50 × 12.5 mm)",
        innerDiameter: 50,
        innerHeight: 12.5,
        wallThickness: 2,
        bottomThickness: 1.2,
        lidHeight: 10,
        threadHeight: 10,
        clearance: 0.25,
        lipDepth: 2.5,
    },
    small: {
        label: "Small (40 × 25 mm)",
        innerDiameter: 40,
        innerHeight: 25,
        wallThickness: 2.5,
        bottomThickness: 1.5,
        lidHeight: 12,
        threadHeight: 6,
        clearance: 0.25,
        lipDepth: 3,
    },
    medium: {
        label: "Medium (55 × 35 mm)",
        innerDiameter: 55,
        innerHeight: 35,
        wallThickness: 2.5,
        bottomThickness: 1.8,
        lidHeight: 14,
        threadHeight: 7,
        clearance: 0.3,
        lipDepth: 3.5,
    },
    large: {
        label: "Large (75 × 50 mm)",
        innerDiameter: 75,
        innerHeight: 50,
        wallThickness: 3,
        bottomThickness: 2,
        lidHeight: 16,
        threadHeight: 8,
        clearance: 0.3,
        lipDepth: 4,
    },
    custom: { label: "Custom" },
};

// ─── Validation helpers ───────────────────────────────────────────────────────
function validateConfig(cfg) {
    const warnings = [];
    const { wallThickness, clearance, threadHeight, personalized, personText, personSize, personAutoFit } = cfg;

    if (wallThickness < 1.2) warnings.push("Wall thickness below 1.2 mm may be too thin to print reliably.");
    if (clearance < 0.1) warnings.push("Clearance below 0.1 mm may cause the lid to fuse to the body.");
    if (clearance > 0.8) warnings.push("Clearance above 0.8 mm may make the lid too loose.");
    if (threadHeight < 4) warnings.push("Thread height below 4 mm may not provide enough grip.");

    const dims = containerDimensions(cfg);
    if (threadHeight > dims.threadLength + 0.01) warnings.push("Thread length limited to fit the cavity above the base flange.");

    if (personalized && personText?.trim()) {
        const text = personText.trim();
        const edgeMargin = cfg.containerStyle === 'knurled' ? 3.5 : 2.5;
        const usableRadius = Math.max(5, dims.radius - edgeMargin);
        const approxCharRatio = 0.62;
        const safeDiameter = usableRadius * 1.8;

        if (personAutoFit) {
            const estimatedHeight = Math.min(18, safeDiameter / Math.max(1, text.length * approxCharRatio));
            if (estimatedHeight < 3.2) {
                warnings.push(`Text "${text}" is very long for this lid diameter. Letters may print too thin to resolve cleanly (estimated height ~${estimatedHeight.toFixed(1)} mm, min 3.5 mm recommended). Consider shortening the text or increasing container diameter.`);
            }
        } else {
            const manualSize = Number(personSize) || 8;
            const requiredWidth = text.length * manualSize * approxCharRatio;
            if (requiredWidth > safeDiameter) {
                warnings.push(`Text "${text}" at ${manualSize} mm exceeds the safe circular lid area. Font size will be constrained to fit within the lid boundary.`);
            }
        }
    }

    if (cfg.pushOutHoleEnabled) {
        const limits = getPushOutHoleLimits(cfg.innerDiameter);
        const req = Number(cfg.pushOutHoleDiameterMm ?? cfg.pushOutHoleDiameter ?? limits.defaultDiameter);
        if (req > limits.max + 0.01) {
            warnings.push(`Push-out hole diameter (${req} mm) exceeds the safe base rim for this container. It will be constrained to ${limits.max} mm to keep the floor structurally sound.`);
        }
    }

    return warnings;
}

// ─── Sidebar section for collapsible panels ───────────────────────────────────
function CollapsibleSection({ title, icon, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    const Icon = icon;
    return (
        <div className="rounded-xl bg-white mb-2.5">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2 border-b border-gray-100 pb-1.5 mb-2 group cursor-pointer"
            >
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-50 text-teal-600">
                    {Icon ? <Icon className="h-3 w-3" /> : null}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-900 flex-1 text-left">
                    {title}
                </span>
                {open
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
            </button>
            {open && <div className="space-y-2.5">{children}</div>}
        </div>
    );
}

// ─── Compact selector for print mode / style buttons ──────────────────────────
function CompactSelector({ options, value, onChange, columns = 2 }) {
    return (
        <div className={`grid ${columns === 2 ? "grid-cols-2" : "grid-cols-1"} gap-1.5`}>
            {options.map((opt) => {
                const isSelected = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        disabled={opt.disabled}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                            isSelected
                                ? "border-teal-500 bg-teal-50/90 text-teal-900 font-semibold shadow-xs"
                                : "border-gray-200 bg-gray-50/70 text-gray-700 hover:border-gray-300 hover:bg-white"
                        } ${opt.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        {opt.emoji && <span className="text-xs shrink-0 select-none">{opt.emoji}</span>}
                        {opt.icon && <opt.icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />}
                        <span className="truncate text-[11px] leading-tight">
                            {opt.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Warning / helper banner ─────────────────────────────────────────────────
function InfoBanner({ type = "info", children }) {
    const styles = {
        info: "bg-blue-50 border-blue-200 text-blue-700",
        warn: "bg-amber-50 border-amber-200 text-amber-800",
    };
    const Icon = type === "warn" ? AlertTriangle : Info;
    return (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[10px] leading-snug ${styles[type]}`}>
            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

// ─── Computed dims label ───────────────────────────────────────────────────────
function ComputedDim({ label, value, unit = "mm" }) {
    return (
        <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">{label}</span>
            <span className="text-[11px] font-mono font-bold text-teal-700">{value} {unit}</span>
        </div>
    );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────
export default function ScrewTopContainerEditor() {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors } = useProfile();
    const { allFonts } = useFontStore();

    const [config, setConfig, { undo, redo, reset, canUndo, canRedo }] =
        useHistoryState(SCREW_CONTAINER_DEFAULTS);

    const updateConfig = useCallback(
        (updates) => setConfig((prev) => {
            const next = { ...prev, ...updates };
            const preset = PRESETS[next.preset];
            if (preset && Object.entries(preset).some(([key, value]) => key !== "label" && next[key] !== value)) next.preset = "custom";
            return next;
        }),
        [setConfig]
    );

    // ── Color options ─────────────────────────────────────────────────────────
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

    // ── Font options ──────────────────────────────────────────────────────────
    const fontOptions = useMemo(
        () => allFonts.map((f) => ({ label: f.label, value: f.id })),
        [allFonts]
    );

    // ── Apply preset ──────────────────────────────────────────────────────────
    const handlePresetChange = (presetKey) => {
        if (presetKey === "custom") {
            updateConfig({ preset: "custom" });
            return;
        }
        const preset = PRESETS[presetKey];
        if (!preset) return;
        const dims = Object.fromEntries(Object.entries(preset).filter(([key]) => key !== "label"));
        updateConfig({ preset: presetKey, ...dims });
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const warnings = useMemo(() => validateConfig(config), [config]);

    // ── Computed dimensions ───────────────────────────────────────────────────
    const outerDiameter = useMemo(() =>
        parseFloat((config.innerDiameter + config.wallThickness * 2).toFixed(2)),
        [config.innerDiameter, config.wallThickness]
    );
    const dimensions = containerDimensions(config);
    const totalHeight = (dimensions.bodyHeight + dimensions.floor).toFixed(2);
    const layout = containerLayout(config);
    const dims = { x: layout.x.toFixed(1), y: layout.y.toFixed(1), z: layout.z.toFixed(1) };
    const holeLimits = useMemo(() => getPushOutHoleLimits(config.innerDiameter), [config.innerDiameter]);
    const safeHoleDiameter = useMemo(() => {
        const raw = config.pushOutHoleDiameterMm ?? config.pushOutHoleDiameter ?? holeLimits.defaultDiameter;
        return clampPushOutHoleDiameter(raw, config.innerDiameter);
    }, [config.pushOutHoleDiameterMm, config.pushOutHoleDiameter, config.innerDiameter, holeLimits]);

    const deferredConfig = useDeferredValue(config);
    const modelRef = useRef();

    const topBarActions = (
        <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
        />
    );

    const presetOptions = Object.entries(PRESETS).map(([key, p]) => ({
        label: p.label,
        value: key,
    }));

    return (
        <EditorLayout
            title="Screw Top Container"
            stackedHeader
            topBarActions={topBarActions}
            sidebarContent={
                <div className="space-y-1 pt-1">
                    {/* ── Header description ───────────────────────────── */}
                    <div className="mb-2.5 rounded-lg border border-teal-100/80 bg-teal-50/50 p-2.5">
                        <p className="text-[10px] text-teal-800 leading-snug">
                            Round container with screw-on lid. Inspect assembled or separated. Exports place both parts flat on the bed.
                        </p>
                    </div>

                    <PrinterSelector />

                    <TemplateManager
                        editorId="screw-top-container"
                        currentSettings={config}
                        excludeKeys={["personText"]}
                        onLoadTemplate={(tpl) =>
                            setConfig((prev) => ({
                                ...prev,
                                ...tpl,
                                textColor: tpl.textColor || prev.textColor || "#FFFFFF",
                                personText: prev.personText,
                            }))
                        }
                    />

                    {/* ── MAKE ────────────────────────────────────────── */}
                    <CollapsibleSection title="Make" icon={Printer}>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">What to Print</span>
                            <CompactSelector
                                value={config.printMode}
                                onChange={(v) => updateConfig({ printMode: v })}
                                options={[
                                    { value: "full", emoji: "📦", label: "Full Container" },
                                    { value: "lid", emoji: "🔵", label: "Lid Only" },
                                    { value: "body", emoji: "🟢", label: "Body Only" },
                                    { value: "fitTest", emoji: "🔧", label: "Fit Test" },
                                ]}
                            />
                        </div>
                        {config.printMode === "fitTest" && (
                            <InfoBanner type="info">
                                Print the fit test first to verify tolerance and thread smoothness before printing the full container.
                            </InfoBanner>
                        )}
                    </CollapsibleSection>

                    {/* ── STYLE ───────────────────────────────────────── */}
                    <CollapsibleSection title="Style" icon={editorIcons.ring}>
                        <div className="space-y-2.5">
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1">Container Style</span>
                                <CompactSelector
                                    value={config.containerStyle}
                                    onChange={(v) => updateConfig({ containerStyle: v })}
                                    options={[
                                        { value: "classic", emoji: "⬜", label: "Classic" },
                                        { value: "knurled", emoji: "🔩", label: "Knurled" },
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1">Lid Style</span>
                                <CompactSelector
                                    value={config.lidStyle}
                                    onChange={(v) =>
                                        updateConfig({
                                            lidStyle: v,
                                            personalized: v === "personalized",
                                        })
                                    }
                                    options={[
                                        { value: "plain", emoji: "🔘", label: "Plain" },
                                        { value: "personalized", emoji: "✨", label: "Personalized" },
                                    ]}
                                />
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* ── SIZE / PRESET ───────────────────────────────── */}
                    <CollapsibleSection title="Preset / Size" icon={Package}>
                        <ControlSelect
                            label="Preset"
                            value={config.preset}
                            onChange={handlePresetChange}
                            options={presetOptions}
                        />

                        <p className="text-[10px] text-gray-500">Preset sizes specify the full usable inside diameter × height. Overall dimensions include the bottom, flange and lid.</p>
                        {config.preset === "custom" && (
                            <InfoBanner type="info">
                                Custom mode — adjust all dimensions manually below.
                            </InfoBanner>
                        )}
                    </CollapsibleSection>

                    {/* ── DIMENSIONS ──────────────────────────────────── */}
                    <CollapsibleSection title="Dimensions" icon={editorIcons.crosshair}>
                        <div className="space-y-4">
                            <ControlSlider
                                label="Inner Diameter"
                                value={config.innerDiameter}
                                min={15} max={120} step={0.5} unit="mm"
                                onChange={(v) => updateConfig({ innerDiameter: v })}
                            />
                            <ControlSlider
                                label="Usable Inner Height"
                                value={config.innerHeight}
                                min={8} max={100} step={0.5} unit="mm"
                                onChange={(v) => updateConfig({ innerHeight: v })}
                            />
                            <ControlSlider
                                label="Wall Thickness"
                                value={config.wallThickness}
                                min={1.2} max={6} step={0.1} unit="mm"
                                onChange={(v) => updateConfig({ wallThickness: v })}
                            />
                            <ControlSlider
                                label="Bottom Thickness"
                                value={config.bottomThickness}
                                min={0.8} max={4} step={0.1} unit="mm"
                                onChange={(v) => updateConfig({ bottomThickness: v })}
                            />
                            <ControlSlider
                                label="Lid Top Thickness"
                                value={config.lidTopThickness ?? Math.max(1.2, config.bottomThickness)}
                                min={1.2} max={4} step={0.1} unit="mm"
                                onChange={(v) => updateConfig({ lidTopThickness: v })}
                            />
                            <ControlSlider
                                label="Thread Engagement Length"
                                value={config.threadHeight}
                                min={3} max={20} step={0.5} unit="mm"
                                onChange={(v) => updateConfig({ threadHeight: v })}
                            />
                            <ControlSlider
                                label="Clearance / Tolerance"
                                value={config.clearance}
                                min={0.05} max={0.8} step={0.05} unit="mm"
                                onChange={(v) => updateConfig({ clearance: v })}
                            />
                            <p className="text-[10px] text-gray-400 -mt-2 leading-snug">
                                Increase if the lid is too tight; decrease if too loose. 0.2–0.3 mm works for most PLA/PETG.
                            </p>
                            {/* Computed output dimensions */}
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">Computed Output</span>
                                <ComputedDim label="Neck Diameter" value={outerDiameter} />
                                <ComputedDim label="Base Flange Diameter" value={(dimensions.flangeRadius * 2).toFixed(2)} />
                                <ComputedDim label="Lid Height" value={dimensions.lidHeight.toFixed(2)} />
                                <ComputedDim label="Thread Pitch" value={dimensions.pitch.toFixed(2)} />
                                <ComputedDim label="Turns to Clear Skirt" value={dimensions.engagementTurns.toFixed(2)} unit="turns" />
                                <ComputedDim label="Total Height (closed)" value={totalHeight} />
                                {config.pushOutHoleEnabled && (
                                    <>
                                        <ComputedDim label="Push-out Hole" value={safeHoleDiameter.toFixed(1)} />
                                        <ComputedDim label="Floor Support Rim" value={((config.innerDiameter - safeHoleDiameter) / 2).toFixed(1)} />
                                    </>
                                )}
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* ── BASE / PUSH-OUT HOLE ───────────────────────── */}
                    <CollapsibleSection title="Base / Push-out Hole" icon={CircleDot} defaultOpen={config.pushOutHoleEnabled}>
                        <div className="space-y-3">
                            <ControlToggle
                                label="Enable Push-out Hole"
                                checked={!!config.pushOutHoleEnabled}
                                onChange={(val) => updateConfig({ pushOutHoleEnabled: val })}
                            />
                            <p className="text-[10px] text-gray-500 leading-snug -mt-2">
                                Adds a hole on the bottom so the insert/product can be pushed out from below.
                            </p>

                            <div className="space-y-2 pt-1 border-t border-gray-100">
                                <ControlSlider
                                    label="Hole Diameter"
                                    value={safeHoleDiameter}
                                    min={holeLimits.min}
                                    max={holeLimits.max}
                                    step={0.5}
                                    unit="mm"
                                    disabled={!config.pushOutHoleEnabled}
                                    onChange={(val) => updateConfig({ pushOutHoleDiameterMm: val })}
                                />
                                <p className="text-[10px] text-gray-400 leading-tight">
                                    Safe range: {holeLimits.min} – {holeLimits.max} mm (preserves at least 3 mm supporting floor rim).
                                </p>
                                {config.pushOutHoleEnabled && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
                                        <span>Floor Support Shoulder:</span>
                                        <span className="font-mono font-bold text-teal-700">
                                            {((config.innerDiameter - safeHoleDiameter) / 2).toFixed(1)} mm
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Attachment" icon={Package} defaultOpen={config.addKeychainHole}>
                        <div className="space-y-3">
                            <ControlToggle
                                label="Enable Keychain Hole"
                                checked={!!config.addKeychainHole}
                                onChange={value => updateConfig({ addKeychainHole: value })}
                            />
                            <p className="text-[10px] text-gray-500 leading-snug -mt-2">
                                Reinforced body-mounted lug with a clean circular hole. Blends smoothly into the base flange without touching threads.
                            </p>
                            {config.addKeychainHole && (
                                <div className="space-y-2.5 pt-2 border-t border-gray-100">
                                    <ControlSlider
                                        label="Hole Diameter"
                                        value={config.keychainHoleDiameter ?? 4.2}
                                        min={3.0}
                                        max={6.5}
                                        step={0.1}
                                        unit="mm"
                                        onChange={v => updateConfig({ keychainHoleDiameter: v })}
                                    />
                                    <ControlSlider
                                        label="Lug Wall Thickness"
                                        value={config.keychainWallThickness ?? 3.2}
                                        min={2.0}
                                        max={5.0}
                                        step={0.1}
                                        unit="mm"
                                        onChange={v => updateConfig({ keychainWallThickness: v })}
                                    />
                                </div>
                            )}
                        </div>
                    </CollapsibleSection>

                    {/* ── COLORS ──────────────────────────────────────── */}
                    <CollapsibleSection title="Colors" icon={editorIcons.droplet}>
                        {colorOptions.length > 0 ? (
                            <div className="space-y-2">
                                <ControlColorPicker
                                    label="Body Color"
                                    value={config.bodyColor}
                                    onChange={(v) => updateConfig({ bodyColor: v })}
                                    options={colorOptions}
                                />
                                <ControlColorPicker
                                    label="Lid Color"
                                    value={config.lidColor}
                                    onChange={(v) => updateConfig({ lidColor: v })}
                                    options={colorOptions}
                                />
                                <ControlColorPicker
                                    label="Text Color"
                                    value={config.textColor || "#FFFFFF"}
                                    onChange={(v) => updateConfig({ textColor: v })}
                                    options={colorOptions}
                                />
                            </div>
                        ) : (
                            <p className="text-[10px] text-gray-400">
                                Add filament brands in Studio to unlock the color picker.
                            </p>
                        )}
                    </CollapsibleSection>

                    {/* ── PERSONALIZATION ─────────────────────────────── */}
                    <CollapsibleSection
                        title="Personalization"
                        icon={Type}
                        defaultOpen={config.personalized}
                    >
                        <ControlToggle
                            label="Enable Lid Text"
                            checked={config.personalized}
                            onChange={(v) =>
                                updateConfig({ personalized: v, lidStyle: v ? "personalized" : "plain" })
                            }
                        />

                        {config.personalized && (
                            <div className="space-y-2.5 mt-2">
                                <InfoBanner type="info">
                                    Text is cut or raised on the exterior lid face. 3MF exports support independent multi-part text coloring.
                                </InfoBanner>

                                <ControlInput
                                    label="Name / Text"
                                    value={config.personText}
                                    onChange={(e) => updateConfig({ personText: e.target.value })}
                                    placeholder="e.g. SOPHIE"
                                />
                                <p className="text-[10px] text-gray-400 -mt-2">
                                    Max 12–14 characters recommended. Longer text auto-scales.
                                </p>

                                <ControlSelect
                                    label="Font"
                                    value={config.personFont}
                                    onChange={(v) => updateConfig({ personFont: v })}
                                    options={fontOptions}
                                    prefixType="font"
                                />

                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1">Text Style</span>
                                    <CompactSelector
                                        value={config.personStyle}
                                        onChange={(v) => updateConfig({ personStyle: v })}
                                        options={[
                                            { value: "embossed", emoji: "⬆️", label: "Embossed" },
                                            { value: "engraved", emoji: "⬇️", label: "Engraved" },
                                        ]}
                                    />
                                </div>

                                <ControlSlider
                                    label="Text Height (mm)"
                                    value={config.personSize}
                                    min={3} max={20} step={0.5} unit="mm"
                                    onChange={(v) => updateConfig({ personSize: v })}
                                    disabled={config.personAutoFit}
                                />
                                <ControlSlider
                                    label="Relief Depth"
                                    value={config.personDepth}
                                    min={0.3} max={2.5} step={0.1} unit="mm"
                                    onChange={(v) => updateConfig({ personDepth: v })}
                                />
                                <ControlToggle
                                    label="Auto-Fit Text to Lid"
                                    checked={config.personAutoFit}
                                    onChange={(v) => updateConfig({ personAutoFit: v })}
                                />
                                {config.personAutoFit && (
                                    <p className="text-[10px] text-gray-400 -mt-2">
                                        Text is constrained to a circular safe area, including when a manual size is selected.
                                    </p>
                                )}
                            </div>
                        )}
                    </CollapsibleSection>

                    {/* ── WARNINGS ────────────────────────────────────── */}
                    {warnings.length > 0 && (
                        <div className="space-y-2">
                            {warnings.map((w, i) => (
                                <InfoBanner key={i} type="warn">{w}</InfoBanner>
                            ))}
                        </div>
                    )}
                </div>
            }
        >
            <div className="relative w-full h-full">
                <EditorCanvas
                    title="Screw Top Container"
                    dims={dims}
                    cameraPosition={[28, 65, 88]}
                    cameraTarget={[0, 18, 0]}
                    productLighting={true}
                    getCustomExportScene={() => {
                        if (config !== deferredConfig || !modelRef.current) throw new Error("Model is updating. Please wait before exporting.");
                        return modelRef.current.getPrintScene();
                    }}
                    leftToolbarActions={
                        <div role="group" aria-label="Container preview" className="flex rounded-xl border border-teal-200 bg-white p-1 gap-1">
                            {["assembled", "exploded"].map(mode => <button key={mode}
                                aria-pressed={config.viewMode === mode}
                                onClick={() => updateConfig({ viewMode: mode })}
                                className={`px-3 py-2 rounded-lg text-xs font-bold ${config.viewMode === mode ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-teal-50"}`}>
                                {mode === "assembled" ? "Assembled" : "Exploded"}
                            </button>)}
                        </div>
                    }
                >
                    <ScrewContainerMesh ref={modelRef} config={config} />
                </EditorCanvas>
            </div>
        </EditorLayout>
    );
}
