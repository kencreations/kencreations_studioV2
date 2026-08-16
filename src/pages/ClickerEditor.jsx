/**
 * ClickerEditor.jsx  — v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * 3D-Printable Custom Clicker Generator  (Cherry MX standard)
 *
 * Physical structure (mm, Z = height axis):
 *   ┌─────────────────────────┐  top ← colour-lift layers (per colour, 0–5 mm)
 *   │     Image Cap Top       │      ← base cap (circle / square / custom)
 *   ├─────────────────────────┤
 *   │  Shell (hollow walls)   │  outer = capSize+6, 1.5 mm walls, 4 mm tall
 *   ├─────────────────────────┤
 *   │  Stem mount (cylinder)  │  Ø 5.6 mm cylinder, 5.0 mm deep
 *   │  ╋ Cruciform socket     │  4.40 × 4.40 mm cross, arm 1.30 mm (FDM tol.)
 *   └─────────────────────────┘  bottom
 *
 * Multi-switch: switches are laid out side-by-side on the X axis; the floor
 * shape widens to accommodate all cavities in a single extrusion.
 */

import React, {
    useState, useCallback, useEffect, useMemo, useRef, Suspense,
} from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useProfile } from '../contexts/ProfileContext';
import EditorLayout from '../components/EditorLayout';
import EditorCanvas from '../components/EditorCanvas';
import { colors } from '../data/colors';
import { CLICKER_DEFAULTS } from '../store/appState';
import { processImage } from '../engine/image/pipeline';
import { loadUrlToImage } from '../engine/image/decode';
import { parseSvg } from '../engine/image/logo';
import { loadBundledFonts, FONT_OPTIONS } from '../engine/image/letter';
import { useGeometryWorker } from '../hooks/useGeometryWorker';
import { getShapesFromIconify } from '../utils/iconifyLoader';
import ImageWizardModal from '../components/ImageWizardModal';

// ── Flatten filament palette ──────────────────────────────────────────────────
const ALL_COLORS = [...colors.BambuLab, ...colors.Esun];

// ── Geometry constants (mm) — Cherry MX commercial-tolerance specification ────
const STEM_LENGTH   = 5.0;
const STEM_OUTER_R  = 5.6 / 2;   // 2.8 mm
const CROSS_TOTAL   = 4.40;
const CROSS_ARM_BASE= 1.30;
const SHELL_HEIGHT  = 4.0;
const HOUSING_FLOOR = 8.0;
const CAVITY_BASE   = 14.2;       // mm — base cavity before tolerance adjustment

// ── Switch spacing — when switchCount > 1, switches are this far apart (centre-to-centre) ──
const getSwitchSpacing = (capSize) => capSize + 4.0;

// ── Lucide icon list (static, searchable) ────────────────────────────────────
const LUCIDE_ICONS = [
    'heart','star','home','user','settings','search','camera','music',
    'mail','phone','globe','lock','key','clock','calendar','map',
    'zap','sun','moon','cloud','umbrella','coffee','book','pen',
    'scissors','gift','flag','bell','bookmark','smile','thumbs-up',
    'thumbs-down','circle','square','diamond','hexagon','activity',
    'anchor','award','bar-chart','battery','bluetooth','box','briefcase',
    'bug','check','compass','cpu','credit-card','database','disc',
    'dollar-sign','download','edit','eye','feather','file','filter',
    'folder','headphones','image','info','layers','leaf','link',
    'map-pin','message-circle','mic','monitor','package','pause',
    'percent','play','plus','power','printer','radio','refresh-cw',
    'save','send','share','shield','shopping-cart','sliders',
    'smartphone','speaker','tag','tool','trash','trending-up','tv',
    'type','upload','video','watch','wifi','x','zoom-in','zoom-out',
    'navigation','flame','gamepad-2','cat','dog','fish','bird',
    'turtle','truck','rocket','atom','crown','dices','fingerprint',
    'gem','ghost','guitar','joystick','mountain','puzzle','rabbit',
    'shark','snail','snowflake','sword','target','wand-2','waves',
];

// ────────────────────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ────────────────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, unit = 'mm', className = '' }) {
    return (
        <label className={`grid gap-1 ${className}`}>
            <span className="flex justify-between text-xs font-semibold text-gray-700">
                <span>{label}</span>
                <span className="text-xs text-secondary font-bold tabular-nums">{value}{unit}</span>
            </span>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-secondary h-1.5" />
        </label>
    );
}

function Toggle({ label, value, onChange }) {
    return (
        <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            <div
                onClick={() => onChange(!value)}
                className={`relative inline-flex h-5 w-9 rounded-full border-2 transition-colors cursor-pointer ${value ? 'bg-secondary border-secondary' : 'bg-gray-200 border-gray-200'}`}>
                <span className={`inline-block h-3.5 w-3.5 mt-0.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
        </label>
    );
}

function SegmentedControl({ options, value, onChange }) {
    return (
        <div className="flex rounded-xl overflow-hidden border border-secondary">
            {options.map((opt) => (
                <button key={opt.value} onClick={() => onChange(opt.value)}
                    disabled={opt.disabled}
                    className={`flex-1 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${value === opt.value ? 'bg-secondary text-white' : 'bg-white text-gray-600 hover:bg-secondary/10'}`}>
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function EdgeSelect({ label, type, onTypeChange, radius, onRadiusChange }) {
    return (
        <div className="space-y-1.5">
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            <SegmentedControl
                value={type}
                onChange={onTypeChange}
                options={[
                    { value: 'none',    label: 'None'    },
                    { value: 'fillet',  label: 'Fillet'  },
                    { value: 'chamfer', label: 'Chamfer' },
                ]}
            />
            {type !== 'none' && (
                <Slider label="Radius" value={radius} min={0.2} max={2.0} step={0.1} onChange={onRadiusChange} />
            )}
        </div>
    );
}

function AccordionSection({ number, title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-2xl border border-secondary bg-white shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-secondary/10 to-transparent hover:from-secondary/20 transition-colors">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary text-white text-[10px] font-black flex items-center justify-center">
                    {number}
                </span>
                <span className="text-xs font-bold text-gray-700 flex-1 text-left">{title}</span>
                <span className={`text-secondary text-xs font-bold transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <div style={{ maxHeight: open ? '1000px' : '0', opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease, opacity 0.2s ease' }}>
                <div className="p-3 space-y-2.5">{children}</div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// COLOR ASSIGN DRAWER
// ────────────────────────────────────────────────────────────────────────────

function ColorAssignDrawer({ currentHex, onSelect, isOpen, onClose, inline = false, popUp = false }) {
    const { customColors } = useProfile();
    const [brand, setBrand] = useState('BambuLab');

    const mergedColors = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(colors));
        customColors.forEach(c => {
            const b = c.brand || "Custom";
            if (!merged[b]) merged[b] = [];
            merged[b].push({ hex: c.hex_code, name: c.color_name });
        });
        return merged;
    }, [customColors]);

    if (!isOpen) return null;

    let containerClass = "rounded-2xl border border-secondary bg-white p-3 animate-in fade-in ";
    if (inline) {
        containerClass += "w-full mt-2 shadow-sm slide-in-from-top-2";
    } else {
        containerClass += "absolute left-1/2 -translate-x-1/2 z-50 w-64 shadow-2xl ";
        if (popUp) {
            containerClass += "bottom-full mb-2 slide-in-from-bottom-2";
        } else {
            containerClass += "top-full mt-2 slide-in-from-top-2";
        }
    }

    return (
        <div className={containerClass}>
            <div className="flex gap-4 mb-2 border-b border-secondary/30 pb-2 overflow-x-auto">
                {Object.keys(mergedColors).map((b) => (
                    <button key={b} onClick={() => setBrand(b)}
                        className={`text-xs font-bold transition-colors whitespace-nowrap ${brand === b ? 'text-secondary border-b-2 border-secondary' : 'text-gray-400 hover:text-secondary'}`}>
                        {b === 'BambuLab' ? 'Bambu Lab' : b}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {mergedColors[brand]?.map((c) => (
                    <div key={c.hex + c.name} className="flex flex-col items-center gap-0.5">
                        <button onClick={() => { onSelect(c); onClose(); }}
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${currentHex === c.hex ? 'border-secondary scale-110 shadow-md' : 'border-gray-200 hover:scale-105 hover:border-secondary/50'}`}
                            style={{ backgroundColor: c.hex }} title={c.name} />
                        <span className="text-[0.5rem] text-gray-400 text-center truncate w-full font-medium leading-tight">{c.name}</span>
                    </div>
                ))}
            </div>
            <button onClick={onClose} className="mt-2 w-full text-xs font-semibold text-white bg-secondary py-1.5 rounded-xl hover:bg-secondary/80 transition-colors">
                Close
            </button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// IMPORT TABS
// ────────────────────────────────────────────────────────────────────────────

function ImageTab({ onImageLoaded, imageSrc, isProcessing, removeBackground, setRemoveBackground }) {
    const inputRef = useRef();
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = useCallback((file) => {
        if (!file) return;
        const ok = ['image/png','image/jpeg','image/webp','image/avif','image/gif','image/svg+xml'];
        if (!ok.some((t) => file.type === t) && !file.name.match(/\.(png|jpg|jpeg|webp|avif|gif|svg)$/i)) return;
        const reader = new FileReader();
        reader.onload = (e) => onImageLoaded(e.target.result, file.name);
        reader.readAsDataURL(file);
    }, [onImageLoaded]);

    const onDrop = useCallback((e) => {
        e.preventDefault(); setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    return (
        <div className="space-y-2">
            <div
                className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${isDragging ? 'border-secondary bg-secondary/10 scale-[1.02]' : 'border-gray-300 hover:border-secondary hover:bg-secondary/5'}`}
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}>
                {isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-24 gap-2">
                        <div className="w-7 h-7 border-[3px] border-secondary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-secondary font-semibold">Analysing image…</span>
                        <span className="text-[10px] text-gray-400">k-means + contour tracing</span>
                    </div>
                ) : imageSrc ? (
                    <div className="relative h-24 group">
                        <img src={imageSrc} alt="Design" className="w-full h-full object-contain p-1" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold transition-opacity bg-black/60 px-3 py-1 rounded-lg">Change</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-24 gap-1.5 text-gray-400 select-none">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span className="text-xs font-semibold text-gray-500">Drop image here</span>
                        <span className="text-[10px] text-gray-400 text-center px-3">PNG / JPG / SVG · transparent bg recommended</span>
                    </div>
                )}
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
                    className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>
            <Toggle label="Remove background" value={removeBackground} onChange={setRemoveBackground} />

            {/* Templates Section */}
            <div className="pt-2 border-t border-secondary/10">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-2 block">Templates</span>
                <div className="grid grid-cols-3 gap-2">
                    {['paw.png', 'cheese.png', 'dog.png', 'heart.png', 'radiation.png', 'Vostok Labs logo.png'].map((filename) => (
                        <button
                            key={filename}
                            onClick={async () => {
                                try {
                                    const res = await fetch(`/assets/media/images/${filename}`);
                                    const blob = await res.blob();
                                    const reader = new FileReader();
                                    reader.onload = (e) => onImageLoaded(e.target.result, filename);
                                    reader.readAsDataURL(blob);
                                } catch (err) {
                                    console.error('Failed to load template:', err);
                                }
                            }}
                            className="bg-gray-100 rounded-lg p-2 border border-gray-200 hover:border-secondary transition-colors group aspect-square flex items-center justify-center"
                            title={filename}
                        >
                            <img src={`/assets/media/images/${filename}`} alt={filename} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SvgTab({ onSvgLoaded, isProcessing }) {
    const inputRef = useRef();
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState(null);

    const handleFile = useCallback((file) => {
        if (!file || !file.name.match(/\.svg$/i)) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => onSvgLoaded(e.target.result);
        reader.readAsText(file);
    }, [onSvgLoaded]);

    const onDrop = useCallback((e) => {
        e.preventDefault(); setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    return (
        <div
            className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${isDragging ? 'border-secondary bg-secondary/10' : 'border-gray-300 hover:border-secondary hover:bg-secondary/5'}`}
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}>
            {isProcessing ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2">
                    <div className="w-7 h-7 border-[3px] border-secondary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-secondary font-semibold">Parsing SVG…</span>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-24 gap-1.5 text-gray-400 select-none">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                    </svg>
                    {fileName ? (
                        <span className="text-xs font-semibold text-secondary">{fileName}</span>
                    ) : (
                        <>
                            <span className="text-xs font-semibold text-gray-500">Drop SVG file here</span>
                            <span className="text-[10px] text-gray-400 text-center px-3">Paths grouped by fill → colour layers</span>
                        </>
                    )}
                </div>
            )}
            <input ref={inputRef} type="file" accept=".svg,image/svg+xml" className="hidden"
                onChange={(e) => handleFile(e.target.files[0])} />
        </div>
    );
}

function IconTab({ selectedIcon, onIconSelect, isLoading }) {
    const [search, setSearch] = useState('');
    const filtered = search
        ? LUCIDE_ICONS.filter((n) => n.includes(search.toLowerCase()))
        : LUCIDE_ICONS;

    return (
        <div className="space-y-2">
            <input
                type="text" placeholder="Search icons…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-secondary/40 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30" />
            {isLoading && (
                <div className="flex justify-center py-2">
                    <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1">
                {filtered.slice(0, 60).map((name) => {
                    const id = `lucide:${name}`;
                    const isSelected = selectedIcon === id;
                    return (
                        <button key={id} title={name} onClick={() => onIconSelect(id)}
                            className={`rounded-lg p-1 border-2 transition-all ${isSelected ? 'border-secondary bg-secondary/10 scale-105' : 'border-transparent hover:border-secondary/30 hover:bg-gray-50'}`}>
                            <img
                                src={`https://api.iconify.design/lucide/${name}.svg`}
                                alt={name} width={20} height={20}
                                className="w-5 h-5 opacity-70" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function TextTab({ text, onTextChange, fontId, onFontChange, isLoading, customFonts = [] }) {
    const allFonts = useMemo(() => {
        const mappedCustom = customFonts.map(f => ({
            id: f.font_name,
            label: f.font_name,
            file: `file://${f.file_path}`
        }));
        return [...FONT_OPTIONS, ...mappedCustom];
    }, [customFonts]);

    return (
        <div className="space-y-2">
            <input
                type="text" placeholder="Enter text…" value={text}
                onChange={(e) => onTextChange(e.target.value)}
                className="w-full rounded-xl border border-secondary/40 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30" />
            <select
                value={fontId}
                onChange={(e) => onFontChange(e.target.value)}
                className="w-full rounded-xl border border-secondary/40 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-secondary appearance-none cursor-pointer">
                {allFonts.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                ))}
            </select>
            {isLoading && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                    <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                    Loading font…
                </div>
            )}
        </div>
    );
}

function ImportTabs({ importMode, setImportMode, ...tabProps }) {
    const TABS = [
        { id: 'image', label: '📷 Image' },
        { id: 'svg',   label: '⬡ SVG'   },
        { id: 'icon',  label: '✦ Icon'   },
        { id: 'text',  label: 'Aa Text'  },
    ];

    return (
        <div className="flex-shrink-0 rounded-2xl border border-secondary bg-white shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-secondary/20">
                {TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setImportMode(tab.id)}
                        className={`flex-1 py-2 text-[10px] font-bold transition-colors ${importMode === tab.id ? 'bg-secondary text-white' : 'text-gray-500 hover:bg-secondary/10 hover:text-secondary'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="p-3">
                {importMode === 'image' && <ImageTab {...tabProps} />}
                {importMode === 'svg'   && <SvgTab   {...tabProps} />}
                {importMode === 'icon'  && <IconTab  {...tabProps} />}
                {importMode === 'text'  && <TextTab  {...tabProps} />}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// SIDEBAR SECTIONS
// ────────────────────────────────────────────────────────────────────────────

function ColorsSection({ colorCount, setColorCount, smoothing, setSmoothing, colorLayers, onLayerColorChange, onLayerLiftChange, capBaseColor, setCapBaseColor, shellColor, setShellColor, activePaintLayerId, setActivePaintLayerId, customColors = [] }) {
    const [openDrawer, setOpenDrawer] = useState(null);
    const colorName = (hex) => {
        const customMatch = customColors.find(c => c.hex_code.toLowerCase() === hex.toLowerCase());
        if (customMatch) return customMatch.color_name;
        return ALL_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? 'Custom';
    };
    const hasLayers = colorLayers.length > 0;

    return (
        <AccordionSection number="1" title="Colors & Smoothing">
            {/* Color count */}
            <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-700">Color Count</span>
                    <span className="text-xs font-bold text-secondary tabular-nums">{colorCount} colors</span>
                </div>
                <input type="range" min={2} max={12} step={1} value={colorCount}
                    onChange={(e) => setColorCount(Number(e.target.value))}
                    className="w-full accent-secondary h-1.5" />
                <div className="flex justify-between text-[9px] text-gray-400 font-medium px-0.5">
                    <span>2</span><span>6</span><span>12</span>
                </div>
                {colorCount > 8 && (
                    <p className="text-[10px] text-orange-500 font-semibold">⚠ 9–12 colors may take 5–8 sec</p>
                )}
            </div>

            {/* Smoothing */}
            <Slider label="Smoothing" value={smoothing} min={0} max={5} step={1} onChange={setSmoothing} unit="" />

            {/* Color swatches (when layers exist) */}
            {hasLayers && (
                <>
                    <div className="border-t border-secondary/10 pt-2 space-y-1">
                        <div className="flex justify-between items-end mb-1">
                            <p className="text-[10px] text-gray-400">Click swatch to assign filament.</p>
                            <p className="text-[9px] text-secondary font-semibold">Select 🖌️ to paint 3D parts</p>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {colorLayers.map((layer) => (
                                <div key={layer.id} className="relative flex flex-col items-center gap-1 bg-gray-50 p-1.5 rounded-xl border border-gray-100 hover:border-secondary/30 transition-colors">
                                    <button onClick={() => setOpenDrawer(openDrawer === layer.id ? null : layer.id)}
                                        className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 shadow-sm ${openDrawer === layer.id ? 'border-secondary shadow-md scale-110' : 'border-gray-200 hover:border-secondary/60'}`}
                                        style={{ backgroundColor: layer.hex }} title={layer.name} />
                                    <span className="text-[0.5rem] text-gray-500 text-center truncate w-full font-medium">{layer.name}</span>
                                    <button onClick={() => setActivePaintLayerId(layer.id)}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${activePaintLayerId === layer.id ? 'bg-secondary text-white shadow-md scale-110' : 'bg-white border border-gray-200 text-gray-400 hover:border-secondary hover:text-secondary'}`}
                                        title="Paint parts with this color">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        {colorLayers.map((layer) => layer.id === openDrawer && (
                            <ColorAssignDrawer key={`drawer-${layer.id}`} currentHex={layer.hex}
                                onSelect={(c) => onLayerColorChange(layer.id, c)}
                                isOpen={true}
                                onClose={() => setOpenDrawer(null)}
                                inline={true} />
                        ))}
                    </div>

                    {/* 3D lift per layer */}
                    <div className="border-t border-secondary/10 pt-2 space-y-1">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">3D Lift per Layer</span>
                        <div className="space-y-2">
                            {colorLayers.map((layer) => (
                                <div key={layer.id} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: layer.hex }} />
                                        <span className="text-xs font-medium text-gray-600 flex-1 truncate">{layer.name}</span>
                                        <span className="text-xs text-secondary font-bold tabular-nums">{layer.liftHeight}mm</span>
                                    </div>
                                    <input type="range" min={0} max={5} step={0.25}
                                        value={layer.liftHeight}
                                        onChange={(e) => onLayerLiftChange(layer.id, Number(e.target.value))}
                                        className="w-full accent-secondary h-1.5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Housing colors */}
            <div className="border-t border-secondary/10 pt-2 space-y-1.5">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Housing Colors</span>
                {[
                    { key: 'shell',   label: 'Shell & Stem', hex: shellColor,   setHex: setShellColor   },
                    { key: 'capBase', label: 'Cap Base',     hex: capBaseColor, setHex: setCapBaseColor },
                ].map(({ key, label, hex, setHex }) => (
                    <div key={key} className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 font-semibold">{label}</span>
                        <div className="relative">
                            <button onClick={() => setOpenDrawer(openDrawer === key ? null : key)}
                                className="w-full flex items-center gap-2 rounded-xl border border-secondary p-1.5 hover:bg-secondary/5 transition-colors">
                                <div className="w-6 h-6 rounded-lg border border-gray-200 flex-shrink-0" style={{ backgroundColor: hex }} />
                                <span className="text-xs font-medium text-gray-700 truncate">{colorName(hex)}</span>
                            </button>
                        </div>
                        {openDrawer === key && (
                            <ColorAssignDrawer currentHex={hex}
                                onSelect={(c) => { setHex(c.hex); setOpenDrawer(null); }}
                                isOpen={true}
                                onClose={() => setOpenDrawer(null)}
                                inline={true} />
                        )}
                    </div>
                ))}
            </div>
        </AccordionSection>
    );
}

function MoreSettingsSection({
    baseShape, setBaseShape, capSize, setCapSize, capDepth, setCapDepth, filletRadius, setFilletRadius,
    edgeCapTop, setEdgeCapTop, edgeCapTopRadius, setEdgeCapTopRadius,
    edgeBase, setEdgeBase, edgeBaseRadius, setEdgeBaseRadius,
    switchSocketTol, setSwitchSocketTol, switchStemTol, setSwitchStemTol,
    keychainHole, setKeychainHole, keychainHoleDiam, setKeychainHoleDiam,
    keychainPosition, setKeychainPosition, keychainSlideOffset, setKeychainSlideOffset,
    hasImage,
}) {
    return (
        <AccordionSection number="2" title="More Settings">
            {/* Base Shape */}
            <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-700">Base Shape</span>
                <select 
                    value={baseShape} 
                    onChange={(e) => setBaseShape(e.target.value)}
                    className="w-full text-xs font-semibold border-secondary/30 rounded-xl focus:ring-secondary focus:border-secondary shadow-sm py-1.5 px-2 bg-white"
                >
                    <option value="custom">Custom (Image Outline)</option>
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="hexagon">Hexagon</option>
                    <option value="heart">Heart</option>
                    <option value="star">Star</option>
                    <option value="egg">Egg</option>
                    <option value="outline" disabled={!hasImage}>Custom / Outline</option>
                </select>
            </div>

            {/* Sizes */}
            <div className="grid grid-cols-2 gap-2">
                <Slider label="Cap Size"  value={capSize}  min={14} max={32} step={0.5} onChange={setCapSize} />
                <Slider label="Cap Depth" value={capDepth} min={1}  max={8}  step={0.5} onChange={setCapDepth} />
            </div>
            {baseShape !== 'circle' && (
                <Slider label="Corner Fillet" value={filletRadius} min={0} max={6} step={0.25} onChange={setFilletRadius} />
            )}

            {/* Edges */}
            <div className="border-t border-secondary/10 pt-2 space-y-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Edges</span>
                <EdgeSelect label="Cap Top" type={edgeCapTop} onTypeChange={setEdgeCapTop} radius={edgeCapTopRadius} onRadiusChange={setEdgeCapTopRadius} />
                <EdgeSelect label="Base"    type={edgeBase}   onTypeChange={setEdgeBase}   radius={edgeBaseRadius}   onRadiusChange={setEdgeBaseRadius}   />
            </div>

            {/* Tolerances */}
            <div className="border-t border-secondary/10 pt-2 space-y-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Tolerances</span>
                <Slider label="Socket cavity delta" value={switchSocketTol} min={-0.5} max={1.0} step={0.05} onChange={setSwitchSocketTol} />
                <Slider label="Stem arm delta"      value={switchStemTol}  min={-0.3} max={0.3}  step={0.05} onChange={setSwitchStemTol}  />
            </div>

            {/* Keychain */}
            <div className="border-t border-secondary/10 pt-2 space-y-2">
                <Toggle label="Keychain Hole" value={keychainHole} onChange={setKeychainHole} />
                {keychainHole && (
                    <>
                        <Slider label="Hole Diameter" value={keychainHoleDiam} min={2} max={8} step={0.5} onChange={setKeychainHoleDiam} />
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-gray-700">Position</span>
                            <SegmentedControl value={keychainPosition} onChange={setKeychainPosition}
                                options={[
                                    { value: 'top',    label: 'Top'    },
                                    { value: 'right',  label: 'Right'  },
                                    { value: 'bottom', label: 'Bot'    },
                                    { value: 'left',   label: 'Left'   },
                                ]} />
                        </div>
                        <Slider label="Slide Offset" value={keychainSlideOffset} min={-8} max={8} step={0.5} onChange={setKeychainSlideOffset} />
                    </>
                )}
            </div>
        </AccordionSection>
    );
}

function SwitchSection({ switchCount, setSwitchCount, switchOffsets, setSwitchOffsets }) {
    const updateOffset = (i, field, val) => {
        setSwitchOffsets((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], [field]: val };
            return next;
        });
    };

    return (
        <AccordionSection number="3" title="Switch Configuration" defaultOpen={false}>
            <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-700">Switch Count</span>
                <SegmentedControl value={switchCount} onChange={setSwitchCount}
                    options={[
                        { value: 1, label: '1 Switch' },
                        { value: 2, label: '2 Switches' },
                        { value: 3, label: '3 Switches' },
                    ]} />
            </div>

            {Array.from({ length: switchCount }).map((_, i) => (
                <div key={i} className="border-t border-secondary/10 pt-2 space-y-1.5">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                        Switch {i + 1} offset
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        <Slider label="X offset" value={switchOffsets[i]?.x ?? 0} min={-5} max={5} step={0.5} onChange={(v) => updateOffset(i, 'x', v)} />
                        <Slider label="Y offset" value={switchOffsets[i]?.y ?? 0} min={-5} max={5} step={0.5} onChange={(v) => updateOffset(i, 'y', v)} />
                    </div>
                    <Slider label="Rotation" value={switchOffsets[i]?.rotation ?? 0} min={-45} max={45} step={5} onChange={(v) => updateOffset(i, 'rotation', v)} unit="°" />
                </div>
            ))}
        </AccordionSection>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// FULL SIDEBAR
// ────────────────────────────────────────────────────────────────────────────

function ClickerSidebar(props) {
    const { onBack, onSave, onLoad, importMode, setImportMode, ...rest } = props;

    return (
        <div className="flex flex-col text-neutral space-y-2 pb-4">
            {/* Top row: Back + Save/Load */}
            <div className="flex-shrink-0 flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
                    ‹ Back
                </button>
                <div className="flex gap-1">
                    <button onClick={onSave} title="Save Project" className="flex items-center gap-1 text-xs font-semibold text-secondary border border-secondary/40 rounded-lg px-2 py-1 hover:bg-secondary/10 transition-colors">
                        💾 Save
                    </button>
                    <label title="Load Project" className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors cursor-pointer">
                        📂 Load
                        <input type="file" accept=".kcp,.json" className="hidden"
                            onChange={(e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => props.onLoad(ev.target.result); r.readAsText(f); } e.target.value = ''; }} />
                    </label>
                </div>
            </div>

            {/* Import tabs */}
            <ImportTabs
                importMode={importMode}
                setImportMode={setImportMode}
                onImageLoaded={rest.onImageLoaded}
                imageSrc={rest.imageSrc}
                isProcessing={rest.isProcessing}
                removeBackground={rest.removeBackground}
                setRemoveBackground={rest.setRemoveBackground}
                onSvgLoaded={rest.onSvgLoaded}
                selectedIcon={rest.iconId}
                onIconSelect={rest.onIconSelect}
                isLoading={rest.isIconLoading || rest.isTextLoading}
                text={rest.textContent}
                onTextChange={rest.onTextChange}
                fontId={rest.textFont}
                onFontChange={rest.onFontChange}
            />

            {/* Accordion Sections */}
            <ColorsSection {...rest} />
            <MoreSettingsSection {...rest} />
            <SwitchSection {...rest} />

            {/* Spec footer */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2.5 space-y-0.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cherry MX Spec (FDM)</span>
                <div className="text-[9px] text-gray-400 space-y-0.5 font-medium">
                    <p>Cavity: {(CAVITY_BASE).toFixed(1)} mm² (±tol)</p>
                    <p>Stem: Ø {(STEM_OUTER_R * 2).toFixed(1)} mm · {STEM_LENGTH} mm deep</p>
                    <p>Cross: {CROSS_TOTAL} × {CROSS_TOTAL} mm · arm {CROSS_ARM_BASE} mm</p>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// MX SWITCH PLACEHOLDER MESH
// ────────────────────────────────────────────────────────────────────────────

function MXSwitchMesh({ x = 0, y = 0, zOffset = 0, meshData }) {
    const geo = useMemo(() => {
        if (!meshData) return null;
        const geometry = new THREE.BufferGeometry();
        let positions;
        if (meshData.numProp === 3) {
            positions = meshData.vertProperties;
        } else {
            const count = meshData.vertProperties.length / meshData.numProp;
            positions = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                positions[i * 3] = meshData.vertProperties[i * meshData.numProp];
                positions[i * 3 + 1] = meshData.vertProperties[i * meshData.numProp + 1];
                positions[i * 3 + 2] = meshData.vertProperties[i * meshData.numProp + 2];
            }
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(meshData.triVerts, 1));
        geometry.computeVertexNormals();
        return geometry;
    }, [meshData]);

    if (!geo) return null;

    return (
        <group position={[x, y, zOffset]}>
            <mesh geometry={geo} castShadow receiveShadow>
                <meshStandardMaterial color={new THREE.Color(0x2a2a30)} roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 3D CLICKER MODEL
// ────────────────────────────────────────────────────────────────────────────


import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function PartMesh({ part, overrideColor }) {
    const geo = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        let positions;
        if (part.numProp === 3) {
            positions = part.vertProperties;
        } else {
            const count = part.vertProperties.length / part.numProp;
            positions = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                positions[i * 3] = part.vertProperties[i * part.numProp];
                positions[i * 3 + 1] = part.vertProperties[i * part.numProp + 1];
                positions[i * 3 + 2] = part.vertProperties[i * part.numProp + 2];
            }
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(part.triVerts, 1));
        const creased = toCreasedNormals(geometry, (35 * Math.PI) / 180);
        geometry.dispose();
        return creased;
    }, [part]);

    const overrideStr = overrideColor ? overrideColor.join(',') : null;
    const material = useMemo(() => {
        const rgb = overrideColor || part.colorRgb;
        const hex = `#${rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;
        return new THREE.MeshStandardMaterial({ color: hex, side: THREE.DoubleSide });
    }, [part.colorRgb, overrideStr]);

    return (
        <mesh geometry={geo} material={material} castShadow receiveShadow
              onClick={(e) => {
                  e.stopPropagation();
                  if (part.name) {
                      const event = new CustomEvent('partclick', { detail: part.name });
                      window.dispatchEvent(event);
                  }
              }}
        />
    );
}

function ClickerModel({
    regionSet, colorLayers, buildParams, viewMode, showMXSwitch, onBoundsCalculated,
    partOverrides
}) {
    const workerRegions = React.useMemo(() => {
        if (regionSet?.regions) {
            const out = [];
            regionSet.regions.forEach((r, i) => {
                r.components.forEach((comp, j) => {
                    const partName = `top-color-${i}-${j}`;
                    const targetLayerId = partOverrides[partName] || `layer_${i}`;
                    const layer = colorLayers?.find(l => l.id === targetLayerId) || colorLayers?.[i];
                    const rgb = layer?.hex ? [
                        parseInt(layer.hex.slice(1, 3), 16),
                        parseInt(layer.hex.slice(3, 5), 16),
                        parseInt(layer.hex.slice(5, 7), 16)
                    ] : r.quantRgb;
                    out.push({
                        partName,
                        rings: comp.rings,
                        coverage: r.coverage,
                        filamentRgb: rgb
                    });
                });
            });
            return out;
        } else if (regionSet?.colorLayers) {
            const out = [];
            regionSet.colorLayers.forEach((l, i) => {
                const rgb = l.hex ? [
                    parseInt(l.hex.slice(1, 3), 16),
                    parseInt(l.hex.slice(3, 5), 16),
                    parseInt(l.hex.slice(5, 7), 16)
                ] : [0, 0, 0];
                l.shapes?.forEach((shapeOrRings, j) => {
                    let rings = [];
                    // Check if it's a THREE.Shape (has getPoints)
                    if (shapeOrRings && typeof shapeOrRings.getPoints === 'function') {
                        // getShapesFromIconify returns un-normalized shapes, max dimension = capSize * 0.8
                        // We must normalize them to [-0.5, 0.5] like traceRegions does.
                        // wait, getShapesFromIconify already centers the shapes, but they are scaled to `size`.
                        // However, buildClicker.ts applies its own scaling (capSize).
                        // Let's divide by the size they were scaled to (capSize * 0.8).
                        const size = buildParams?.capSize ? buildParams.capSize * 0.8 : 20;
                        const outer = shapeOrRings.getPoints(16).map(p => [p.x / size, p.y / size]);
                        rings.push(outer);
                        if (shapeOrRings.holes) {
                            shapeOrRings.holes.forEach(hole => {
                                rings.push(hole.getPoints(16).map(p => [p.x / size, p.y / size]));
                            });
                        }
                    } else {
                        rings = shapeOrRings;
                    }
                    out.push({
                        partName: `top-color-${i}-${j}`,
                        rings: rings,
                        coverage: 1,
                        filamentRgb: rgb
                    });
                });
            });
            return out;
        }
        return [];
    }, [regionSet, colorLayers, buildParams?.capSize, partOverrides]);

    const workerOutline = React.useMemo(() => {
        return regionSet?.outline || regionSet?.customOutlineOuterShape || [];
    }, [regionSet]);

    const { parts, switchPlacements, isBuilding, warnings: geomWarnings, switchMesh } = useGeometryWorker(
        '/switch/mx/mx-socket.3mf',
        '/switch/mx/mx-stem.3mf',
        '/switch/mx/mx-switch.3mf',
        workerRegions,
        workerOutline,
        buildParams
    );

    const topGroupRef = useRef();
    const targetCapOffset = viewMode === 'exploded' ? (buildParams?.imageDepth * 1.5 + 10) : 0;
    
    useFrame((_, delta) => {
        if (topGroupRef.current) {
            topGroupRef.current.position.z += (targetCapOffset - topGroupRef.current.position.z) * Math.min(1, delta * 5);
        }
    });

    const modelOffset = React.useMemo(() => {
        if (!parts || parts.length === 0) return { x: 0, y: 0, z: 0, bounds: { x: 0, y: 0, z: 0 } };
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        parts.forEach(p => {
            const props = p.vertProperties;
            const numProp = p.numProp;
            for (let i = 0; i < props.length; i += numProp) {
                const x = props[i], y = props[i+1], z = props[i+2];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
        });
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        return { 
            x: -cx, 
            y: -cy, 
            z: -minZ - 2.5, // counteract the +2.5 global Y-lift in EditorCanvas
            bounds: { x: (maxX - minX).toFixed(1), y: (maxY - minY).toFixed(1), z: (maxZ - minZ).toFixed(1) }
        };
    }, [parts]);

    React.useEffect(() => {
        if (onBoundsCalculated && modelOffset.bounds.x > 0) {
            onBoundsCalculated(modelOffset.bounds);
        }
    }, [modelOffset, onBoundsCalculated]);

    const topParts = parts?.filter(p => p.group === 'top') || [];
    const baseParts = parts?.filter(p => p.group !== 'top') || [];

    return (
        <group position={[modelOffset.x, modelOffset.y, modelOffset.z]}>
            <group ref={topGroupRef} position={[0, 0, viewMode === 'exploded' ? (buildParams?.imageDepth * 1.5 + 10) : 0]}>
                {topParts.map((p, i) => {
                    let overrideColor = null;
                    if (p.name === 'top-base') {
                        overrideColor = buildParams?.baseFilamentRgb;
                    }
                    return <PartMesh key={i} part={p} overrideColor={overrideColor} />;
                })}
            </group>
            <group>
                {baseParts.map((p, i) => {
                    let overrideColor = null;
                    if (p.name === 'base-body') {
                        overrideColor = buildParams?.bodyColorRgb;
                    }
                    return <PartMesh key={i} part={p} overrideColor={overrideColor} />;
                })}
            </group>
            {showMXSwitch && switchPlacements?.map((c, i) => (
                <group key={`sw-${i}`} position={[c.x, c.y, 0]} rotation={[0, 0, c.rotation]}>
                    <MXSwitchMesh meshData={switchMesh} zOffset={0} />
                </group>
            ))}
        </group>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// VIEWPORT OVERLAY
// ────────────────────────────────────────────────────────────────────────────

function ViewportOverlay({ viewMode, setViewMode, showMXSwitch, setShowMXSwitch }) {
    return (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            <button onClick={() => setViewMode((m) => m === 'assembled' ? 'exploded' : 'assembled')}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border transition-all ${viewMode === 'exploded' ? 'bg-secondary text-white border-secondary' : 'bg-white/90 text-gray-700 border-secondary/30 hover:border-secondary hover:text-secondary'}`}>
                {viewMode === 'exploded' ? '⊟' : '⊞'} {viewMode === 'exploded' ? 'Assembled' : 'Exploded'}
            </button>
            <button onClick={() => setShowMXSwitch((s) => !s)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border transition-all ${showMXSwitch ? 'bg-primary text-white border-primary' : 'bg-white/90 text-gray-700 border-secondary/30 hover:border-secondary hover:text-secondary'}`}>
                🎛 {showMXSwitch ? 'Hide Switch' : 'Show Switch'}
            </button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// COLOR EXTRUDE PANEL (canvas footer)
// ────────────────────────────────────────────────────────────────────────────

function ColorExtrudePanel({ colorLayers, onLayerLiftChange, onLayerColorChange }) {
    const [selected, setSelected] = useState(null);
    const [openDrawer, setOpenDrawer] = useState(false);
    if (!colorLayers.length) return null;

    const sel = colorLayers.find((l) => l.id === selected) ?? null;

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex-shrink-0">Extrude</span>
            <div className="flex gap-2 flex-shrink-0">
                {colorLayers.map((layer) => (
                    <button key={layer.id} onClick={() => setSelected(layer.id === selected ? null : layer.id)}
                        title={`${layer.name} — ${layer.liftHeight}mm`}
                        className={`relative w-7 h-7 rounded-lg border-2 transition-all flex-shrink-0 ${layer.id === selected ? 'border-secondary scale-110 shadow-md ring-2 ring-secondary/30' : 'border-gray-200 hover:border-secondary/60 hover:scale-105'}`}
                        style={{ backgroundColor: layer.hex }}>
                        <span className="absolute -bottom-3 left-0 right-0 text-center text-[8px] text-gray-500 font-bold tabular-nums leading-none">
                            {layer.liftHeight}
                        </span>
                    </button>
                ))}
            </div>

            {sel && (
                <>
                    <div className="h-8 w-px bg-secondary/20 flex-shrink-0" />
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => onLayerLiftChange(sel.id, Math.max(0, +(sel.liftHeight - 0.25).toFixed(2)))}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-secondary/20 text-gray-700 font-bold text-sm transition-colors flex items-center justify-center">−</button>
                        <span className="text-sm font-bold text-secondary tabular-nums w-12 text-center">{sel.liftHeight}mm</span>
                        <button onClick={() => onLayerLiftChange(sel.id, Math.min(5, +(sel.liftHeight + 0.25).toFixed(2)))}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-secondary/20 text-gray-700 font-bold text-sm transition-colors flex items-center justify-center">+</button>
                    </div>
                    <div className="relative flex-shrink-0">
                        <button onClick={() => setOpenDrawer((o) => !o)}
                            className="w-7 h-7 rounded-lg border-2 border-dashed border-secondary/50 hover:border-secondary transition-colors flex items-center justify-center text-secondary text-xs font-bold"
                            title="Change color">🎨</button>
                        <ColorAssignDrawer currentHex={sel.hex}
                            onSelect={(c) => { onLayerColorChange(sel.id, c); setOpenDrawer(false); }}
                            isOpen={openDrawer} onClose={() => setOpenDrawer(false)}
                            popUp={true} />
                    </div>
                    <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{sel.name}</span>
                </>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// CAMERA CONFIG
// ────────────────────────────────────────────────────────────────────────────

const CLICKER_CAM_POS    = [20, 22, 30];
const CLICKER_CAM_TARGET = [0, 3, 0];

// ────────────────────────────────────────────────────────────────────────────
// MAIN EDITOR COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export default function ClickerEditor() {
    const navigate = useNavigate();
    const { customColors, customFonts } = useProfile();
    const [state, setState] = useState({ ...CLICKER_DEFAULTS });

    // ── Import mode ───────────────────────────────────────────────────────────
    const [importMode, setImportMode] = useState(CLICKER_DEFAULTS.importMode);

    // ── Image state ───────────────────────────────────────────────────────────
    const [regionSet, setRegionSet] = useState(null);
    const [imageSrc, setImageSrc] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    // ── Paint overrides ───────────────────────────────────────────────────────
    const [partOverrides, setPartOverrides] = useState({});
    const [activePaintLayerId, setActivePaintLayerId] = useState(null);

    // Reset paint selections when new image loads
    useEffect(() => {
        setPartOverrides({});
        if (colorLayers.length > 0) {
            setActivePaintLayerId(colorLayers[0].id);
        } else {
            setActivePaintLayerId(null);
        }
    }, [regionSet]);

    // Handle 3D model part click
    useEffect(() => {
        const handlePartClick = (e) => {
            if (activePaintLayerId && e.detail) {
                setPartOverrides(prev => ({
                    ...prev,
                    [e.detail]: activePaintLayerId
                }));
            }
        };
        window.addEventListener('partclick', handlePartClick);
        return () => window.removeEventListener('partclick', handlePartClick);
    }, [activePaintLayerId]);

    const [colorLayers, setColorLayers] = useState([]);
    const [customOutlineShape, setCustomOutlineShape] = useState(null);
    const [customOutlineClearanceShape, setCustomOutlineClearanceShape] = useState(null);
    const [customOutlineOuterShape, setCustomOutlineOuterShape] = useState(null);

    // ── Image processing options ──────────────────────────────────────────────
    const [colorCount, setColorCountRaw] = useState(CLICKER_DEFAULTS.colorCount);
    const [smoothing, setSmoothing]      = useState(CLICKER_DEFAULTS.smoothing);
    const [removeBackground, setRemoveBackground] = useState(CLICKER_DEFAULTS.removeBackground);
    
    // ── Wizard State ──────────────────────────────────────────────────────────
    const [wizardImage, setWizardImage] = useState(null);
    const [adjustedImgData, setAdjustedImgData] = useState(null);
    const [actualDims, setActualDims] = useState(null);

    // ── Icon state ────────────────────────────────────────────────────────────
    const [iconId, setIconId] = useState(CLICKER_DEFAULTS.iconId);
    const [isIconLoading, setIsIconLoading] = useState(false);

    // ── Text state ────────────────────────────────────────────────────────────
    const [textContent, setTextContent] = useState(CLICKER_DEFAULTS.textContent);
    const [textFont, setTextFont]       = useState(CLICKER_DEFAULTS.textFont);
    const [isTextLoading, setIsTextLoading] = useState(false);
    const textDebounce = useRef(null);

    // ── Design parameters ─────────────────────────────────────────────────────
    const [baseShape,     setBaseShape]     = useState(CLICKER_DEFAULTS.baseShape);
    const [capSize,       setCapSize]       = useState(CLICKER_DEFAULTS.capSize);
    const [capDepth,      setCapDepth]      = useState(CLICKER_DEFAULTS.capDepth);
    const [imageDepth,    setImageDepth]    = useState(CLICKER_DEFAULTS.imageDepth);
    const [filletRadius,  setFilletRadius]  = useState(CLICKER_DEFAULTS.filletRadius);

    // Edge profiles
    const [edgeCapTop,       setEdgeCapTop]       = useState(CLICKER_DEFAULTS.edgeCapTop);
    const [edgeCapTopRadius, setEdgeCapTopRadius] = useState(CLICKER_DEFAULTS.edgeCapTopRadius);
    const [edgeBase,         setEdgeBase]         = useState(CLICKER_DEFAULTS.edgeBase);
    const [edgeBaseRadius,   setEdgeBaseRadius]   = useState(CLICKER_DEFAULTS.edgeBaseRadius);

    // Tolerances
    const [switchSocketTol, setSwitchSocketTol] = useState(CLICKER_DEFAULTS.switchSocketTol);
    const [switchStemTol,   setSwitchStemTol]   = useState(CLICKER_DEFAULTS.switchStemTol);

    // Keychain
    const [keychainHole,        setKeychainHole]        = useState(CLICKER_DEFAULTS.keychainHole);
    const [keychainHoleDiam,    setKeychainHoleDiam]    = useState(CLICKER_DEFAULTS.keychainHoleDiam);
    const [keychainPosition,    setKeychainPosition]    = useState(CLICKER_DEFAULTS.keychainPosition);
    const [keychainSlideOffset, setKeychainSlideOffset] = useState(CLICKER_DEFAULTS.keychainSlideOffset);

    // Multi-switch
    const [switchCount,   setSwitchCount]   = useState(CLICKER_DEFAULTS.switchCount);
    const [switchOffsets, setSwitchOffsets] = useState(CLICKER_DEFAULTS.switchOffsets);

    // Housing colors
    const [shellColor,    setShellColor]    = useState(CLICKER_DEFAULTS.shellColor);
    const [capBaseColor,  setCapBaseColor]  = useState(CLICKER_DEFAULTS.capBaseColor);

    // Viewport
    const [viewMode,      setViewMode]      = useState(CLICKER_DEFAULTS.viewMode);
    const [showMXSwitch,  setShowMXSwitch]  = useState(CLICKER_DEFAULTS.showMXSwitch);

    // ── Layer handlers ────────────────────────────────────────────────────────

    const buildParams = useMemo(() => {
        const parseHex = (hex) => {
            const c = new THREE.Color(hex);
            return [Math.round(c.r*255), Math.round(c.g*255), Math.round(c.b*255)];
        };
        const componentHeights = {};
        colorLayers.forEach((l, i) => {
            if (regionSet?.regions) {
                const r = regionSet.regions[i];
                if (r && r.components) {
                    r.components.forEach((_, j) => {
                        const partName = `top-color-${i}-${j}`;
                        const targetLayerId = partOverrides[partName] || `layer_${i}`;
                        const targetLayer = colorLayers.find(layer => layer.id === targetLayerId) || l;
                        componentHeights[partName] = targetLayer.liftHeight;
                    });
                }
            } else if (regionSet?.colorLayers) {
                const cl = regionSet.colorLayers[i];
                if (cl && cl.shapes) {
                    cl.shapes.forEach((_, j) => {
                        const partName = `top-color-${i}-${j}`;
                        const targetLayerId = partOverrides[partName] || `layer_${i}`;
                        const targetLayer = colorLayers.find(layer => layer.id === targetLayerId) || l;
                        componentHeights[partName] = targetLayer.liftHeight;
                    });
                }
            }
            // fallback for anything else
            componentHeights[l.name] = l.liftHeight;
        });
        return {
            baseShape, capWidthMm: capSize, topThickness: capDepth - imageDepth,
            imageDepth, imageMargin: 1, borderWidth: 1.5, capProud: 1.5,
            tolerance: switchSocketTol, stemTolerance: switchStemTol,
            colorBleed: 0.1, stepHeight: 0.25, travel: 3.5, floorThickness: 1.6,
            switches: switchOffsets.slice(0, switchCount).map(o => ({ x: o.x ?? 0, y: o.y ?? 0, rotation: o.rotation ?? 0 })),
            keychain: { enabled: keychainHole, style: 'loop', angleDeg: 90, holeDiameterMm: keychainHoleDiam, offsetMm: keychainSlideOffset },
            baseFilamentRgb: parseHex(capBaseColor),
            bodyColorRgb: parseHex(shellColor),
            componentHeights,
            edgeSettings: [
                { target: 'capTop', style: edgeCapTop, radius: edgeCapTopRadius },
                { target: 'baseTop', style: edgeBase, radius: edgeBaseRadius },
            ],
            extrudeChamfer: true,
        };
    }, [baseShape, capSize, capDepth, imageDepth, switchSocketTol, switchStemTol, switchCount, switchOffsets, keychainHole, keychainHoleDiam, keychainSlideOffset, capBaseColor, shellColor, colorLayers, edgeCapTop, edgeCapTopRadius, edgeBase, edgeBaseRadius, partOverrides]);

    const onLayerColorChange = useCallback((id, colorEntry) => {
        setColorLayers((prev) => prev.map((l) => l.id === id ? { ...l, hex: colorEntry.hex, name: colorEntry.name } : l));
    }, []);

    const onLayerLiftChange = useCallback((id, liftHeight) => {
        setColorLayers((prev) => prev.map((l) => l.id === id ? { ...l, liftHeight } : l));
    }, []);

    // ── Apply processing result ───────────────────────────────────────────────
    const applyResult = useCallback((result) => {
        if (!result) return;
        const layers = [];
        if (result.regions) {
            result.regions.forEach((r, i) => {
                const hex = '#' + r.quantRgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
                layers.push({ id: `layer_${i}`, hex, name: `Color ${i+1}`, liftHeight: 0 });
            });
        }
        setColorLayers(layers);
        setRegionSet(result);
    }, []);

    // ── Image processing ──────────────────────────────────────────────────────
    const runProcessing = useCallback(async (imgData, count) => {
        if (!imgData) return;
        setIsProcessing(true);
        try {
            // Clone the image because processImage mutates it (removeBackground, etc)
            const clone = {
                data: new Uint8ClampedArray(imgData.data),
                width: imgData.width,
                height: imgData.height
            };
            const result = processImage(clone, count, {
                smoothing: smoothing / 5,
                removeBg: removeBackground,
                preserveDetail: true
            });
            applyResult(result);
        } catch (err) {
            console.error('Image processing failed:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [smoothing, removeBackground, applyResult]);

    const handleImageLoaded = useCallback(async (src) => {
        setImageSrc(src);
        setIsProcessing(true);
        try {
            const img = await loadUrlToImage(src);
            setWizardImage(img);
        } catch (err) {
            console.error('Failed to load image:', err);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleWizardComplete = useCallback((result) => {
        setWizardImage(null);
        setAdjustedImgData(result.adjusted);
        runProcessing(result.adjusted, colorCount);
    }, [runProcessing, colorCount]);

    const setColorCount = useCallback((n) => {
        setColorCountRaw(n);
        if (adjustedImgData && importMode === 'image') runProcessing(adjustedImgData, n);
    }, [adjustedImgData, importMode, runProcessing]);

    // Re-run when smoothing changes (debounced)
    useEffect(() => {
        if (!adjustedImgData || importMode !== 'image') return;
        const t = setTimeout(() => runProcessing(adjustedImgData, colorCount), 400);
        return () => clearTimeout(t);
    }, [smoothing, removeBackground]);   // eslint-disable-line

    // ── SVG processing ────────────────────────────────────────────────────────
    const handleSvgLoaded = useCallback((svgString) => {
        setIsProcessing(true);
        try {
            const result = parseSvg(svgString, { removeBg: removeBackground });
            applyResult(result);
        } catch (err) {
            console.error('SVG processing failed:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [removeBackground, applyResult]);

    // ── Icon processing ───────────────────────────────────────────────────────
    const handleIconSelect = useCallback(async (id) => {
        setIconId(id);
        setIsIconLoading(true);
        try {
            const shapes = await getShapesFromIconify(id, capSize * 0.8);
            if (shapes.length) {
                applyResult({
                    colorLayers: [{
                        id: 'icon_layer_0',
                        hex: capBaseColor,
                        name: 'Icon',
                        shapes,
                        liftHeight: imageDepth,
                    }],
                    customOutlineShape: null,
                    customOutlineClearanceShape: null,
                    customOutlineOuterShape: null,
                });
            }
        } catch (err) {
            console.error('Icon load failed:', err);
        } finally {
            setIsIconLoading(false);
        }
    }, [capSize, capBaseColor, imageDepth, applyResult]);

    // ── Text processing ───────────────────────────────────────────────────────
    const runTextProcessing = useCallback(async (text, fontId) => {
        if (!text?.trim()) { setColorLayers([]); setRegionSet(null); return; }
        setIsTextLoading(true);
        setIsTextLoading(false);
    }, []);

    const handleTextChange = useCallback((text) => {
        setTextContent(text);
        clearTimeout(textDebounce.current);
        textDebounce.current = setTimeout(() => runTextProcessing(text, textFont), 600);
    }, [runTextProcessing, textFont]);

    const handleFontChange = useCallback((fontId) => {
        setTextFont(fontId);
        if (textContent?.trim()) runTextProcessing(textContent, fontId);
    }, [runTextProcessing, textContent]);

    // Pre-load default font
    useEffect(() => {
        loadBundledFonts().catch(() => {});
    }, []);   // eslint-disable-line

    // Guard: custom shape needs an image or SVG
    useEffect(() => {
        if (baseShape === 'custom' && importMode !== 'image' && importMode !== 'svg') setBaseShape('square');
    }, [baseShape, importMode]);

    // ── Dimension overlay ─────────────────────────────────────────────────────
    const dims = actualDims || { x: (capSize + 6).toFixed(1), y: (capSize + 6).toFixed(1), z: "..." };

    // ── Save / Load project ───────────────────────────────────────────────────
    const handleSave = useCallback(() => {
        const state = {
            version: 2,
            importMode, iconId, textContent, textFont,
            colorCount, smoothing, removeBackground, imageDepth,
            baseShape, capSize, capDepth, filletRadius,
            edgeCapTop, edgeCapTopRadius, edgeBase, edgeBaseRadius,
            switchSocketTol, switchStemTol,
            keychainHole, keychainHoleDiam, keychainPosition, keychainSlideOffset,
            switchCount, switchOffsets,
            shellColor, capBaseColor,
            viewMode, showMXSwitch,
            colorLayers: colorLayers.map(({ id, hex, name, liftHeight }) => ({ id, hex, name, liftHeight })),
        };
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'clicker_project.kcp';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [importMode, iconId, textContent, textFont, colorCount, smoothing, removeBackground, imageDepth, baseShape, capSize, capDepth, filletRadius, edgeCapTop, edgeCapTopRadius, edgeBase, edgeBaseRadius, switchSocketTol, switchStemTol, keychainHole, keychainHoleDiam, keychainPosition, keychainSlideOffset, switchCount, switchOffsets, shellColor, capBaseColor, viewMode, showMXSwitch, colorLayers]);

    const handleLoad = useCallback((jsonStr) => {
        try {
            const s = JSON.parse(jsonStr);
            if (s.importMode)    setImportMode(s.importMode);
            if (s.iconId)        setIconId(s.iconId);
            if (s.textContent)   setTextContent(s.textContent);
            if (s.textFont)      setTextFont(s.textFont);
            if (s.colorCount)    setColorCountRaw(s.colorCount);
            if (s.smoothing !== undefined)        setSmoothing(s.smoothing);
            if (s.removeBackground !== undefined) setRemoveBackground(s.removeBackground);
            if (s.imageDepth)    setImageDepth(s.imageDepth);
            if (s.baseShape)     setBaseShape(s.baseShape);
            if (s.capSize)       setCapSize(s.capSize);
            if (s.capDepth)      setCapDepth(s.capDepth);
            if (s.filletRadius)  setFilletRadius(s.filletRadius);
            if (s.edgeCapTop)    setEdgeCapTop(s.edgeCapTop);
            if (s.edgeCapTopRadius) setEdgeCapTopRadius(s.edgeCapTopRadius);
            if (s.edgeBase)      setEdgeBase(s.edgeBase);
            if (s.edgeBaseRadius) setEdgeBaseRadius(s.edgeBaseRadius);
            if (s.switchSocketTol !== undefined) setSwitchSocketTol(s.switchSocketTol);
            if (s.switchStemTol  !== undefined)  setSwitchStemTol(s.switchStemTol);
            if (s.keychainHole   !== undefined)  setKeychainHole(s.keychainHole);
            if (s.keychainHoleDiam) setKeychainHoleDiam(s.keychainHoleDiam);
            if (s.keychainPosition) setKeychainPosition(s.keychainPosition);
            if (s.keychainSlideOffset !== undefined) setKeychainSlideOffset(s.keychainSlideOffset);
            if (s.switchCount)   setSwitchCount(s.switchCount);
            if (s.switchOffsets) setSwitchOffsets(s.switchOffsets);
            if (s.shellColor)    setShellColor(s.shellColor);
            if (s.capBaseColor)  setCapBaseColor(s.capBaseColor);
            if (s.viewMode)      setViewMode(s.viewMode);
            if (s.showMXSwitch !== undefined) setShowMXSwitch(s.showMXSwitch);
            if (Array.isArray(s.colorLayers)) setColorLayers(s.colorLayers.map((l) => ({ ...l, shapes: [] })));
        } catch (err) {
            console.error('Failed to load project:', err);
            alert('Invalid project file');
        }
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <EditorLayout
            title="Clicker Editor"
            sidebarContent={
                <ClickerSidebar
                    onBack={() => navigate('/')}
                    onSave={handleSave}
                    onLoad={handleLoad}

                    importMode={importMode}
                    setImportMode={setImportMode}

                    /* image tab */
                    imageSrc={imageSrc}
                    isProcessing={isProcessing}
                    onImageLoaded={handleImageLoaded}
                    removeBackground={removeBackground}
                    setRemoveBackground={setRemoveBackground}

                    /* svg tab */
                    onSvgLoaded={handleSvgLoaded}

                    /* icon tab */
                    iconId={iconId}
                    onIconSelect={handleIconSelect}
                    isIconLoading={isIconLoading}

                    /* text tab */
                    textContent={textContent}
                    onTextChange={handleTextChange}
                    fontId={state.fontId}
                    onFontChange={(v) => setState((s) => ({ ...s, fontId: v }))}
                    isLoading={isTextLoading}
                    customFonts={customFonts}

                    /* section 1 */
                    colorCount={colorCount}
                    setColorCount={setColorCount}
                    smoothing={smoothing}
                    setSmoothing={setSmoothing}
                    colorLayers={colorLayers}
                    onLayerColorChange={onLayerColorChange}
                    onLayerLiftChange={onLayerLiftChange}
                    capBaseColor={capBaseColor}
                    setCapBaseColor={setCapBaseColor}
                    shellColor={shellColor}
                    setShellColor={setShellColor}
                    activePaintLayerId={activePaintLayerId}
                    setActivePaintLayerId={setActivePaintLayerId}

                    /* section 2 */
                    baseShape={baseShape}
                    setBaseShape={setBaseShape}
                    capSize={capSize}
                    setCapSize={setCapSize}
                    capDepth={capDepth}
                    setCapDepth={setCapDepth}
                    filletRadius={filletRadius}
                    setFilletRadius={setFilletRadius}
                    edgeCapTop={edgeCapTop}
                    setEdgeCapTop={setEdgeCapTop}
                    edgeCapTopRadius={edgeCapTopRadius}
                    setEdgeCapTopRadius={setEdgeCapTopRadius}
                    edgeBase={edgeBase}
                    setEdgeBase={setEdgeBase}
                    edgeBaseRadius={edgeBaseRadius}
                    setEdgeBaseRadius={setEdgeBaseRadius}
                    switchSocketTol={switchSocketTol}
                    setSwitchSocketTol={setSwitchSocketTol}
                    switchStemTol={switchStemTol}
                    setSwitchStemTol={setSwitchStemTol}
                    keychainHole={keychainHole}
                    setKeychainHole={setKeychainHole}
                    keychainHoleDiam={keychainHoleDiam}
                    setKeychainHoleDiam={setKeychainHoleDiam}
                    keychainPosition={keychainPosition}
                    setKeychainPosition={setKeychainPosition}
                    keychainSlideOffset={keychainSlideOffset}
                    setKeychainSlideOffset={setKeychainSlideOffset}
                    hasImage={!!imageSrc || colorLayers.length > 0}

                    /* section 3 */
                    switchCount={switchCount}
                    setSwitchCount={setSwitchCount}
                    switchOffsets={switchOffsets}
                    setSwitchOffsets={setSwitchOffsets}
                />
            }
            canvasFooter={
                <ColorExtrudePanel
                    colorLayers={colorLayers}
                    onLayerLiftChange={onLayerLiftChange}
                    onLayerColorChange={onLayerColorChange}
                />
            }
        >
            {/* HTML overlay sits on top of the canvas via absolute positioning */}
            <div className="relative w-full h-full">
                <EditorCanvas
                    dims={dims}
                    title="clicker"
                    cameraPosition={CLICKER_CAM_POS}
                    cameraTarget={CLICKER_CAM_TARGET}
                >

                <ClickerModel regionSet={regionSet} colorLayers={colorLayers} buildParams={buildParams} viewMode={viewMode} showMXSwitch={showMXSwitch} onBoundsCalculated={setActualDims} partOverrides={partOverrides} />
                </EditorCanvas>

                {/* HTML viewport overlay — rendered on top of the canvas */}
                <ViewportOverlay
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    showMXSwitch={showMXSwitch}
                    setShowMXSwitch={setShowMXSwitch}
                />

                {wizardImage && (
                    <ImageWizardModal
                        baseImage={wizardImage}
                        onComplete={handleWizardComplete}
                        onCancel={() => setWizardImage(null)}
                    />
                )}
            </div>
        </EditorLayout>
    );
}
