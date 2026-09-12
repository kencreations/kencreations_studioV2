import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import { useMacropadWorker } from "../hooks/useMacropadWorker";
import { MACROPAD_DEFAULTS } from "../store/appState";
import { HistoryControls } from "../components/HistoryControls";
import { useHistoryState } from "../hooks/useHistoryState";

// UI Helpers
function Slider({ label, value, min, max, step, onChange }) {
    return (
        <label className="grid gap-1">
            <span className="flex justify-between text-xs font-semibold text-gray-700">
                <span>{label}</span>
                <span className="text-xs text-teal-600">{value}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-teal-600"
            />
        </label>
    );
}

const parseHex = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
};

function AccordionSection({ number, title, children, defaultOpen = true }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="rounded-2xl border border-teal-600/20 bg-white overflow-hidden shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-teal-600/5 hover:bg-teal-600/10 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                        {number}
                    </span>
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                        {title}
                    </span>
                </div>
                <svg
                    className={`w-4 h-4 text-teal-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && <div className="p-3 space-y-3">{children}</div>}
        </div>
    );
}

function SegmentedControl({ options, value, onChange }) {
    return (
        <div className="flex bg-gray-100 p-1 rounded-xl">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${value === opt.value ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// 3D Rendering Components
function PartMesh({ part }) {
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

    const material = useMemo(() => {
        const rgb = part.colorRgb;
        const hex = rgb ? `#${rgb.map(c => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, '0')).join('')}` : '#888888';
        return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.1 });
    }, [part.colorRgb]);

    return (
        <mesh geometry={geo} material={material} castShadow receiveShadow />
    );
}

function MacropadModel({ parts, onBoundsCalculated }) {
    const modelOffset = useMemo(() => {
        if (!parts || parts.length === 0) return { x: 0, y: 0, z: 0, bounds: { x: 0, y: 0, z: 0 } };
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const part of parts) {
            const count = part.vertProperties.length / part.numProp;
            for (let i = 0; i < count; i++) {
                const x = part.vertProperties[i * part.numProp];
                const y = part.vertProperties[i * part.numProp + 1];
                const z = part.vertProperties[i * part.numProp + 2];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        return { 
            x: -cx, 
            y: -cy, 
            z: -minZ,
            bounds: { x: (maxX - minX).toFixed(1), y: (maxY - minY).toFixed(1), z: (maxZ - minZ).toFixed(1) }
        };
    }, [parts]);

    React.useEffect(() => {
        if (onBoundsCalculated && modelOffset.bounds.x > 0) {
            onBoundsCalculated(modelOffset.bounds);
        }
    }, [modelOffset, onBoundsCalculated]);

    return (
        <group position={[modelOffset.x, modelOffset.y, modelOffset.z]}>
            {parts && parts.map((p, i) => <PartMesh key={i} part={p} />)}
        </group>
    );
}

export default function MacropadEditor() {
    const [state, setState, { undo, redo, reset, canUndo, canRedo }] = useHistoryState({
        rows: MACROPAD_DEFAULTS.rows,
        columns: MACROPAD_DEFAULTS.columns,
        pitchX: MACROPAD_DEFAULTS.pitchX,
        pitchY: MACROPAD_DEFAULTS.pitchY,
        style: MACROPAD_DEFAULTS.style,
        baseShape: MACROPAD_DEFAULTS.baseShape,
        margin: MACROPAD_DEFAULTS.margin,
        floorThickness: MACROPAD_DEFAULTS.floorThickness,
        sidePattern: MACROPAD_DEFAULTS.sidePattern,
        socketTol: MACROPAD_DEFAULTS.socketToleranceMm,
        shellColor: MACROPAD_DEFAULTS.shellColor,
        keychainHole: MACROPAD_DEFAULTS.keychainHole,
        keychainHoleDiam: MACROPAD_DEFAULTS.keychainHoleDiam,
        keychainSlideOffset: MACROPAD_DEFAULTS.keychainSlideOffset,
    });

    const { rows, columns, pitchX, pitchY, style, baseShape, margin, floorThickness, sidePattern, socketTol, shellColor, keychainHole, keychainHoleDiam, keychainSlideOffset } = state;

    const setRows = (val) => setState(p => ({...p, rows: typeof val === 'function' ? val(p.rows) : val}));
    const setColumns = (val) => setState(p => ({...p, columns: typeof val === 'function' ? val(p.columns) : val}));
    const setPitchX = (val) => setState(p => ({...p, pitchX: typeof val === 'function' ? val(p.pitchX) : val}));
    const setPitchY = (val) => setState(p => ({...p, pitchY: typeof val === 'function' ? val(p.pitchY) : val}));
    const setStyle = (val) => setState(p => ({...p, style: typeof val === 'function' ? val(p.style) : val}));
    const setBaseShape = (val) => setState(p => ({...p, baseShape: typeof val === 'function' ? val(p.baseShape) : val}));
    const setMargin = (val) => setState(p => ({...p, margin: typeof val === 'function' ? val(p.margin) : val}));
    const setFloorThickness = (val) => setState(p => ({...p, floorThickness: typeof val === 'function' ? val(p.floorThickness) : val}));
    const setSidePattern = (val) => setState(p => ({...p, sidePattern: typeof val === 'function' ? val(p.sidePattern) : val}));
    const setSocketTol = (val) => setState(p => ({...p, socketTol: typeof val === 'function' ? val(p.socketTol) : val}));
    const setShellColor = (val) => setState(p => ({...p, shellColor: typeof val === 'function' ? val(p.shellColor) : val}));
    const setKeychainHole = (val) => setState(p => ({...p, keychainHole: typeof val === 'function' ? val(p.keychainHole) : val}));
    const setKeychainHoleDiam = (val) => setState(p => ({...p, keychainHoleDiam: typeof val === 'function' ? val(p.keychainHoleDiam) : val}));
    const setKeychainSlideOffset = (val) => setState(p => ({...p, keychainSlideOffset: typeof val === 'function' ? val(p.keychainSlideOffset) : val}));

    const [actualDims, setActualDims] = useState(null);

    const buildParams = useMemo(() => ({
        rows, columns, pitchX, pitchY, style, baseShape, margin, floorThickness, sidePattern,
        socketToleranceMm: socketTol,
        keychain: { enabled: keychainHole, style: 'loop', angleDeg: 180, holeDiameterMm: keychainHoleDiam, offsetMm: keychainSlideOffset },
        bodyColorRgb: parseHex(shellColor),
        edgeSettings: []
    }), [rows, columns, pitchX, pitchY, style, baseShape, margin, floorThickness, sidePattern, socketTol, keychainHole, keychainHoleDiam, keychainSlideOffset, shellColor]);

    const { parts, isBuilding, warnings } = useMacropadWorker(
        '/switch/mx/mx-socket.3mf',
        '/switch/mx/mx-stem.3mf',
        '/switch/mx/mx-switch.3mf',
        buildParams
    );

    const handleSave = () => {};
    const handleLoad = () => {};

    const sidebar = (
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 bg-teal-600 flex items-center justify-between text-white">
                <h2 className="text-sm font-black tracking-widest">MACROPAD EDITOR</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-4">
                    <Link to="/" className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </Link>
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="px-3 py-1 bg-white border border-teal-600/30 text-teal-600 text-xs font-bold rounded-lg shadow-sm">Save</button>
                        <button onClick={handleLoad} className="px-3 py-1 bg-white border border-teal-600/30 text-teal-600 text-xs font-bold rounded-lg shadow-sm">Load</button>
                    </div>
                </div>

                <AccordionSection number="1" title="Layout">
                    <Slider label="Rows" value={rows} min={1} max={4} step={1} onChange={setRows} />
                    <Slider label="Columns" value={columns} min={1} max={6} step={1} onChange={setColumns} />
                    <Slider label="Pitch X (mm)" value={pitchX} min={15} max={25} step={0.1} onChange={setPitchX} />
                    <Slider label="Pitch Y (mm)" value={pitchY} min={15} max={25} step={0.1} onChange={setPitchY} />
                </AccordionSection>

                <AccordionSection number="2" title="Housing Style">
                    <SegmentedControl value={style} onChange={setStyle} options={[
                        { value: 'unified', label: 'Unified Box' },
                        { value: 'joined', label: 'Joined Shapes' }
                    ]} />
                    
                    <div className="space-y-1.5 mt-3">
                        <span className="text-xs font-semibold text-gray-700">Shape</span>
                        <select value={baseShape} onChange={e => setBaseShape(e.target.value)} className="w-full text-xs border border-teal-600/30 rounded-xl p-2 bg-white">
                            <option value="square">Square / Rect</option>
                            <option value="circle">Circle / Pill</option>
                            <option value="hexagon">Hexagon</option>
                            {style === 'unified' && <option value="scalloped">Scalloped</option>}
                        </select>
                    </div>

                    <div className="space-y-1.5 mt-3">
                        <span className="text-xs font-semibold text-gray-700">Side Wall Pattern</span>
                        <select value={sidePattern} onChange={e => setSidePattern(e.target.value)} className="w-full text-xs border border-teal-600/30 rounded-xl p-2 bg-white">
                            <option value="none">None (Smooth)</option>
                            <option value="ribbed">Ribbed</option>
                            <option value="knurled">Knurled</option>
                            <option value="wavy">Wavy</option>
                            <option value="brick">Brick</option>
                        </select>
                    </div>

                    <div className="mt-3">
                        <Slider label="Margin (Thickness)" value={margin} min={1} max={10} step={0.5} onChange={setMargin} />
                    </div>
                </AccordionSection>
                
                <AccordionSection number="3" title="Keychain">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-semibold text-gray-700">Add Loop Tab</span>
                        <div className="relative">
                            <input type="checkbox" className="sr-only" checked={keychainHole} onChange={(e) => setKeychainHole(e.target.checked)} />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${keychainHole ? 'bg-teal-600' : 'bg-gray-300'}`}></div>
                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${keychainHole ? 'translate-x-4' : ''}`}></div>
                        </div>
                    </label>
                    {keychainHole && (
                        <div className="pt-3 space-y-3">
                            <Slider label="Hole Size (mm)" value={keychainHoleDiam} min={2} max={10} step={0.2} onChange={setKeychainHoleDiam} />
                            <Slider label="Slide Offset" value={keychainSlideOffset} min={-20} max={20} step={1} onChange={setKeychainSlideOffset} />
                        </div>
                    )}
                </AccordionSection>
            </div>
        </div>
    );

    const dims = actualDims || { x: "?", y: "?", z: "?" };

    return (
        <EditorLayout
            title="Macropad Builder"
            topBarActions={
                <HistoryControls 
                    canUndo={canUndo} 
                    canRedo={canRedo} 
                    onUndo={undo} 
                    onRedo={redo} 
                    onReset={reset} 
                />
            }
            sidebarContent={sidebar}
        >
            <div className="relative w-full h-full bg-gray-50/30">
                <EditorCanvas 
                    dims={dims}
                    cameraPosition={[30, 40, 50]}
                    cameraTarget={[0, 0, 0]}
                >
                    <MacropadModel parts={parts} onBoundsCalculated={setActualDims} />
                </EditorCanvas>

                {isBuilding && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
                        <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 border border-teal-600/20">
                            <div className="w-6 h-6 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-bold text-gray-700">Building Macropad Base...</span>
                        </div>
                    </div>
                )}
                
                {warnings.length > 0 && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg">
                        {warnings[0]}
                    </div>
                )}
            </div>
        </EditorLayout>
    );
}
