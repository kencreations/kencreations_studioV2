import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import {
    createTextShapesWithSpacing,
    offsetShapes,
    unionShapes,
} from "../utils/textContour";
import { KEYCHAIN_DEFAULTS } from "../store/appState";
import { FONT_OPTIONS } from "../utils/fonts";

// ─── UI Helper Components ──────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange }) {
    return (
        <label className="grid gap-1">
            <span className="flex justify-between text-xs font-semibold text-gray-700">
                <span>{label}</span>
                <span className="text-xs text-primary">{value}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-primary"
            />
        </label>
    );
}

const getColorName = (hex, allBrands, customColors = []) => {
    // Check custom colors first
    const customMatch = customColors.find(c => c.hex_code.toLowerCase() === hex.toLowerCase());
    if (customMatch) return customMatch.color_name;

    if (!allBrands) return "Custom Color";
    
    // Flatten all brand colors to search for the hex
    const allColors = Object.values(allBrands).flat();
    
    const match = allColors.find(
        (c) => c.hex.toLowerCase() === hex.toLowerCase(),
    );
    return match ? match.name : "Custom Color";
};

function ColorSelectionDrawer({ value, onChange, isOpen, onClose, anchorRef }) {
    const { brands: colors } = useFilamentBrands();
    const { customColors } = useProfile();

    const mergedColors = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(colors));
        customColors.forEach(c => {
            const b = c.brand || "Custom";
            if (!merged[b]) merged[b] = [];
            merged[b].push({ hex: c.hex_code, name: c.color_name });
        });
        return merged;
    }, [colors, customColors]);

    const [selectedBrand, setSelectedBrand] = useState("BambuLab");
    const [drawerStyle, setDrawerStyle] = useState({});

    useEffect(() => {
        let style = {
            position: "absolute",
            left: 0,
            top: "calc(100% + 8px)",
            zIndex: 50,
        };

        if (anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            style = {
                position: "fixed",
                left: rect.left,
                bottom: window.innerHeight - rect.top + 8,
                zIndex: 9999,
            };
        }
        setDrawerStyle(style);
    }, [anchorRef]);

    if (!isOpen) return null;

    return (
        <div className="w-96 rounded-2xl border border-secondary bg-white p-4 shadow-2xl" style={drawerStyle}>
            <div className="flex gap-10 mb-4 border-b pb-2 border-secondary overflow-x-auto">
                {Object.keys(mergedColors).map((brand) => (
                    <button
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={`text-sm font-bold whitespace-nowrap ${selectedBrand === brand ? "text-secondary border-b-2 border-secondary " : "text-gray-400 hover:text-secondary"}`}>
                        {brand === "BambuLab" ? "Bambu Lab" : brand}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                {mergedColors[selectedBrand]?.map((color) => (
                    <div key={color.hex + color.name} className="flex flex-col items-center">
                        <button
                            onClick={() => {
                                onChange(color.hex);
                                onClose();
                            }}
                            className={`w-10 h-10 rounded-lg border ${value === color.hex ? "border-black scale-105" : "border-gray-200"}`}
                            style={{ backgroundColor: color.hex }}
                        />
                        <span
                            className="mt-1 text-[0.6rem] text-neutral text-center w-full truncate font-semibold"
                            title={color.name}>
                            {color.name}
                        </span>
                    </div>
                ))}
            </div>
            <button
                onClick={onClose}
                className="mt-4 w-full text-xs text-gray-400 bg-primary/60 py-2 rounded-lg hover:bg-primary border border-primary transition-colors font-semibold">
                Close
            </button>
        </div>
    );
}

function KeychainSidebar({
    onBack,
    text,
    onTextChange,
    size,
    onSizeChange,
    depth,
    onDepthChange,
    baseOffset,
    onBaseOffsetChange,
    baseHeight,
    onBaseHeightChange,
    baseColor,
    onBaseColorChange,
    textColor,
    onTextColorChange,
    keyringEnabled,
    setKeyringEnabled,
    ringOuter,
    setRingOuter,
    ringInner,
    setRingInner,
    ringX,
    setRingX,
    ringY,
    setRingY,
    selectedFontId,
    onFontChange,
    dims,
}) {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors, customFonts } = useProfile();
    const [isFontOpen, setIsFontOpen] = useState(false);
    const [fontSearch, setFontSearch] = useState("");
    const [isBaseOpen, setIsBaseOpen] = useState(false);
    const [isTextOpen, setIsTextOpen] = useState(false);

    // Merge predefined fonts with custom fonts from ProfileContext
    const allFonts = useMemo(() => {
        const mappedCustom = customFonts.map(f => ({
            id: f.font_name,
            label: f.font_name,
            file_path: f.file_path,  // raw disk path for IPC buffer read
            isCustom: true,
        }));
        return [...FONT_OPTIONS, ...mappedCustom];
    }, [customFonts]);

    const selectedFont =
        allFonts.find((f) => f.id === selectedFontId) || allFonts[0];
    const filteredFonts = allFonts.filter((f) =>
        (f.label || "").toLowerCase().includes(fontSearch.toLowerCase()),
    );

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (window.electronAPI) {
            const buffer = await file.arrayBuffer();
            const result = await window.electronAPI.saveCustomFont({
                name: file.name,
                buffer: new Uint8Array(buffer),
            });

            if (result.success) {
                // Fetch fonts again and trigger a re-render
                window.dispatchEvent(new Event("custom-fonts-updated"));
            } else {
                console.error("Failed to save custom font");
            }
        }
    };

    return (
        <div className="flex h-full flex-col text-neutral space-y-3">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
                ‹ Back to Studio
            </button>

            {/* ── Content ── */}
            <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                <label htmlFor="keychainContent" className="grid gap-1.5">
                    <span className="text-xs font-semibold text-gray-700">
                        Content
                    </span>
                    <input
                        id="keychainContent"
                        type="text"
                        placeholder="Enter name or text"
                        value={text}
                        onChange={(e) => onTextChange(e.target.value)}
                        className="w-full rounded-2xl border border-secondary bg-gray-50 px-4 py-2.5 text-base font-medium text-neutral outline-none transition-colors focus:border-secondary focus:ring-2 focus:ring-secondary/30"
                    />
                </label>

                {/* Font picker */}
                <div className="grid gap-1.5">
                    <span className="text-xs font-semibold text-gray-700">
                        Font
                    </span>
                    <div className="relative">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsFontOpen((o) => !o)}
                                className="flex w-full items-center justify-between rounded-2xl border border-secondary bg-gray-50 px-4 py-2.5 text-left text-xs text-neutral hover:border-secondary focus:outline-none transition-colors">
                                <span className="truncate mr-2">
                                    {selectedFont?.label}
                                </span>
                                <span className="text-primary text-xs">
                                    {isFontOpen ? "▲" : "▼"}
                                </span>
                            </button>
                        </div>

                        {isFontOpen && (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 rounded-2xl border border-secondary bg-white p-2 shadow-lg">
                                <input
                                    type="text"
                                    value={fontSearch}
                                    onChange={(e) =>
                                        setFontSearch(e.target.value)
                                    }
                                    placeholder="search fonts..."
                                    autoFocus
                                    className="mb-2 w-full rounded-xl border border-secondary bg-gray-50 px-3 py-2 text-sm outline-none focus:border-secondary"
                                />
                                <div className="max-h-44 overflow-y-auto rounded-xl border border-secondary bg-gray-50 p-1">
                                    {filteredFonts.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-gray-500">
                                            No font found.
                                        </div>
                                    )}
                                    {filteredFonts.map((font) => (
                                        <button
                                            key={font.id}
                                            type="button"
                                            onClick={() => {
                                                onFontChange(font.id);
                                                setIsFontOpen(false);
                                                setFontSearch("");
                                            }}
                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                font.id === selectedFontId
                                                    ? "bg-secondary/15 text-neutral"
                                                    : "hover:bg-white"
                                            }`}>
                                            <span>{font.label}</span>
                                            {font.id === selectedFontId && (
                                                <span className="text-primary">
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Slider
                        label="Size"
                        value={size}
                        min={6}
                        max={32}
                        step={1}
                        onChange={onSizeChange}
                    />
                    <Slider
                        label="Depth"
                        value={depth}
                        min={1}
                        max={10}
                        step={1}
                        onChange={onDepthChange}
                    />
                </div>

                <div className="relative flex flex-col text-neutral space-y-3">
                    <div className="relative">
                        <span className="text-sm font-semibold text-gray-700">
                            Text color
                        </span>
                        <button
                            onClick={() => setIsTextOpen(!isTextOpen)}
                            className="w-full flex items-center gap-3 rounded-2xl border border-secondary p-2 hover:border-secondary transition-colors">
                            <div
                                className="w-8 h-8 rounded-lg shadow-inner border border-secondary/50"
                                style={{ backgroundColor: textColor }}
                            />
                            <span className="text-sm font-medium">
                                {getColorName(textColor, cloudColors, customColors)}
                            </span>
                        </button>
                        <ColorSelectionDrawer
                            value={textColor}
                            onChange={onTextColorChange}
                            isOpen={isTextOpen}
                            onClose={() => setIsTextOpen(false)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Base Outline ── */}
            <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-3">
                <span className="text-xs font-semibold text-gray-700">
                    Base Outline
                </span>
                <div className="grid grid-cols-2 gap-3">
                    <Slider
                        label="Offset"
                        value={baseOffset}
                        min={1}
                        max={18}
                        step={0.5}
                        onChange={onBaseOffsetChange}
                    />
                    <Slider
                        label="Thickness"
                        value={baseHeight}
                        min={0.5}
                        max={8}
                        step={0.1}
                        onChange={onBaseHeightChange}
                    />
                </div>
                <div className="relative">
                    <span className="text-xs font-semibold text-gray-700">
                        Base color
                    </span>
                    <button
                        onClick={() => setIsBaseOpen(!isBaseOpen)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-secondary p-2 hover:border-secondary transition-colors">
                        <div
                            className="w-8 h-8 rounded-lg shadow-inner border border-secondary/50"
                            style={{ backgroundColor: baseColor }}
                        />
                        <span className="text-sm font-medium">
                            {getColorName(baseColor, cloudColors, customColors)}
                        </span>
                    </button>
                    <ColorSelectionDrawer
                        value={baseColor}
                        onChange={onBaseColorChange}
                        isOpen={isBaseOpen}
                        onClose={() => setIsBaseOpen(false)}
                    />
                </div>
            </div>

            {/* ── Keyring Position ── */}
            <div className="rounded-2xl border border-secondary bg-white p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">
                        Keyring
                    </span>
                    <label className="text-xs text-gray-400 font-medium gap-2 text-xs flex items-center">
                        <input
                            className="h-4 w-4 mr-1 accent-primary"
                            type="checkbox"
                            checked={keyringEnabled}
                            onChange={(e) =>
                                setKeyringEnabled(e.target.checked)
                            }
                        />
                        Enabled
                    </label>
                </div>
                <div className="rounded-2xl  bg-white p-3 shadow-sm space-y-3">
                    <span className="text-sm font-semibold text-gray-700">
                        Ring Settings
                    </span>
                    <Slider
                        label="Outer Diameter"
                        value={ringOuter}
                        min={5}
                        max={15}
                        step={0.5}
                        onChange={setRingOuter}
                    />
                    <Slider
                        label="Hole Size (Inner)"
                        value={ringInner}
                        min={2}
                        max={8}
                        step={0.5}
                        onChange={setRingInner}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Slider
                            label="X Position"
                            value={ringX}
                            min={-40}
                            max={20}
                            step={0.5}
                            onChange={setRingX}
                        />
                        <Slider
                            label="Y Position"
                            value={ringY}
                            min={-40}
                            max={40}
                            step={0.5}
                            onChange={setRingY}
                        />
                    </div>
                </div>
            </div>

            <p className="text-xs text-gray-400 pb-2">
                Live 3D preview · Export STL for printing.
            </p>
        </div>
    );
}

// ─── Main Keychain Editor ──────────────────────────────────────────────────────
export default function KeychainEditor() {
    const navigate = useNavigate();

    // States — seeded from KEYCHAIN_DEFAULTS so all initial values live in one place
    const [text, setText] = useState(KEYCHAIN_DEFAULTS.text);
    const defaultFontId =
        FONT_OPTIONS.find(
            (f) =>
                f.label === KEYCHAIN_DEFAULTS.font ||
                f.id === KEYCHAIN_DEFAULTS.font,
        )?.id || FONT_OPTIONS[0]?.id;
    const [selectedFontId, setSelectedFontId] = useState(defaultFontId);
    const [size, setSize] = useState(KEYCHAIN_DEFAULTS.size);
    const [depth, setDepth] = useState(KEYCHAIN_DEFAULTS.depth);
    const [baseOffset, setBaseOffset] = useState(KEYCHAIN_DEFAULTS.baseOffset);
    const [baseHeight, setBaseHeight] = useState(KEYCHAIN_DEFAULTS.baseHeight);
    const [baseColor, setBaseColor] = useState(KEYCHAIN_DEFAULTS.baseColor);
    const [textColor, setTextColor] = useState(KEYCHAIN_DEFAULTS.textColor);

    // Keyring States
    const [keyringEnabled, setKeyringEnabled] = useState(
        KEYCHAIN_DEFAULTS.keyringEnabled,
    );
    const [ringOuter, setRingOuter] = useState(KEYCHAIN_DEFAULTS.ringOuter);
    const [ringInner, setRingInner] = useState(KEYCHAIN_DEFAULTS.ringInner);
    const [ringX, setRingX] = useState(KEYCHAIN_DEFAULTS.ringX);
    const [ringY, setRingY] = useState(KEYCHAIN_DEFAULTS.ringY);

    // Geometry States
    const [textGeo, setTextGeo] = useState(null);
    const [baseGeo, setBaseGeo] = useState(null);
    const [ringGeo, setRingGeo] = useState(null);
    const [dims, setDims] = useState(null);

    const [, setForceUpdate] = useState({});

    // Load custom fonts on mount if in Electron — stores file_path for IPC buffer reads
    useEffect(() => {
        const loadFonts = async () => {
            if (window.electronAPI) {
                const loaded = await window.electronAPI.getCustomFonts();
                window.customFonts = loaded
                    .filter(f => f.font_name && (f.filePath || f.file_path))
                    .map((f) => {
                        const pathVal = f.filePath || f.file_path;
                        const nameVal = f.font_name || f.name || "CustomFont";
                        const id = nameVal.replace(/\.[^/.]+$/, "");
                        return {
                            id,
                            label: id.replace(/_/g, " "),
                            file_path: pathVal,  // kept for IPC readFontBuffer
                            isCustom: true,
                        };
                    });
                setForceUpdate({});
            }
        };

        loadFonts();

        const handleUpdate = () => loadFonts();
        window.addEventListener("custom-fonts-updated", handleUpdate);
        return () =>
            window.removeEventListener("custom-fonts-updated", handleUpdate);
    }, []);

    const fontCacheRef = useRef({});
    const loadedFontRef = useRef(null);
    const textShapesRef = useRef([]);
    const baseBBRef = useRef(null);

    const buildBase = (shapes, bHeight, bOffset, dep) => {
        const solidShapes = shapes.length > 0 ? unionShapes(shapes) : shapes;
        const baseShapes = offsetShapes(solidShapes, bOffset);
        let rawBase =
            baseShapes.length > 0
                ? new THREE.ExtrudeGeometry(baseShapes, {
                      depth: bHeight,
                      bevelEnabled: false,
                      curveSegments: 16,
                  })
                : new THREE.BoxGeometry(20, 10, bHeight);

        rawBase.computeBoundingBox();
        const bb = rawBase.boundingBox;
        rawBase.translate(
            -(bb.min.x + bb.max.x) / 2,
            -(bb.min.y + bb.max.y) / 2,
            -bHeight,
        );

        rawBase.computeBoundingBox();
        baseBBRef.current = rawBase.boundingBox.clone();

        const mergedBase = BufferGeometryUtils.mergeVertices(rawBase);
        if (mergedBase.attributes.uv) {
            mergedBase.deleteAttribute("uv");
        }
        setBaseGeo(mergedBase);

        mergedBase.computeBoundingBox();
        const fb = mergedBase.boundingBox;
        setDims({
            x: Math.round((fb.max.x - fb.min.x) * 10) / 10,
            y: Math.round((fb.max.y - fb.min.y) * 10) / 10,
            z: Math.round((fb.max.z - fb.min.z + dep) * 10) / 10,
        });
    };

    useEffect(() => {
        const handler = setTimeout(async () => {
            const allFonts = [...FONT_OPTIONS, ...(window.customFonts || [])];
            const fontOption = allFonts.find((f) => f.id === selectedFontId);
            if (!fontOption) return;

            // Use cached font if available — avoids re-downloading on every change
            if (!fontCacheRef.current[selectedFontId]) {
                const fontLoader = new FontLoader();
                const ttfLoader = new TTFLoader();
                let parsed;

                if (fontOption.isCustom && fontOption.file_path && window.electronAPI?.readFontBuffer) {
                    // ── Custom font: read raw bytes via IPC → parse with TTFLoader.parse()
                    // This bypasses all Chromium web protocol restrictions entirely.
                    const rawBuffer = await window.electronAPI.readFontBuffer(fontOption.file_path);
                    if (!rawBuffer) {
                        console.error('[KeychainEditor] readFontBuffer returned null for', fontOption.file_path);
                        return;
                    }
                    const arrayBuf = rawBuffer.buffer
                        ? rawBuffer.buffer  // Node Buffer wraps an ArrayBuffer
                        : rawBuffer;
                    const fontJson = ttfLoader.parse(arrayBuf);
                    parsed = fontLoader.parse(fontJson);
                } else {
                    // ── Bundled font: fetch from Vite asset URL
                    parsed = await new Promise((res, rej) => {
                        ttfLoader.load(
                            fontOption.url,
                            (json) => res(fontLoader.parse(json)),
                            undefined,
                            rej,
                        );
                    });
                }
                fontCacheRef.current[selectedFontId] = parsed;
            }
            const loadedFont = fontCacheRef.current[selectedFontId];
            loadedFontRef.current = loadedFont;

            // Get raw 2D letter shapes (with holes from font data)
            const rawShapes = createTextShapesWithSpacing(
                text,
                loadedFont,
                size,
                0,
            );
            textShapesRef.current = rawShapes;

            if (rawShapes.length > 0) {
                const rawText = new THREE.ExtrudeGeometry(rawShapes, {
                    depth,
                    bevelEnabled: false,
                    curveSegments: 4,
                });
                rawText.computeBoundingBox();
                const b = rawText.boundingBox;
                if (b) {
                    rawText.translate(
                        -(b.min.x + b.max.x) / 2,
                        -(b.min.y + b.max.y) / 2,
                        0,
                    );
                }
                setTextGeo(BufferGeometryUtils.mergeVertices(rawText));
            } else {
                setTextGeo(null);
            }

            // Build base using current baseOffset / baseHeight
            buildBase(rawShapes, baseHeight, baseOffset, depth);
        }, 300);

        return () => clearTimeout(handler);
    }, [text, size, depth, selectedFontId]); // ← NO baseOffset/baseHeight here

    // ── Effect B (FAST): runs only when base outline sliders change ───────────
    // Uses the cached font shapes — NO font loading, NO text geometry rebuild.
    useEffect(() => {
        if (!loadedFontRef.current || textShapesRef.current.length === 0)
            return;

        const handler = setTimeout(() => {
            buildBase(textShapesRef.current, baseHeight, baseOffset, depth);
        }, 150); // shorter debounce since this is purely synchronous math

        return () => clearTimeout(handler);
    }, [baseOffset, baseHeight]);

    // ── Effect 2 (FAST): Rebuild only the ring when ring params change ──
    // This does NOT reload the font or rebuild base geometry — instant response.
    useEffect(() => {
        if (!keyringEnabled) {
            setRingGeo(null);
            return;
        }

        const bb = baseBBRef.current;

        // Build ring shape
        const ringShape = new THREE.Shape();
        ringShape.absarc(0, 0, ringOuter / 2, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, ringInner / 2, 0, Math.PI * 2, true);
        ringShape.holes.push(hole);

        const ringExtrudeGeo = new THREE.ExtrudeGeometry(ringShape, {
            depth: baseHeight,
            bevelEnabled: false,
            curveSegments: 32,
        });

        // Position relative to base bounding box (or fallback to origin if bb not ready)
        const anchorY = bb ? bb.max.y : 0;
        const anchorX = bb ? bb.min.x : 0;
        ringExtrudeGeo.translate(anchorX + ringX, anchorY + ringY, -baseHeight);

        const mergedRing = BufferGeometryUtils.mergeVertices(ringExtrudeGeo);
        if (mergedRing.attributes.uv) {
            mergedRing.deleteAttribute("uv");
        }

        setRingGeo(mergedRing);
    }, [
        keyringEnabled,
        ringOuter,
        ringInner,
        ringX,
        ringY,
        baseHeight,
        baseGeo,
    ]);
    // baseGeo in deps ensures ring re-anchors if base is rebuilt

    return (
        <EditorLayout
            title="Keychain Editor"
            sidebarContent={
                <KeychainSidebar
                    onBack={() => navigate("/")}
                    text={text}
                    onTextChange={setText}
                    selectedFontId={selectedFontId}
                    onFontChange={setSelectedFontId} // ← Bug 1 fix: pass the handler
                    size={size}
                    onSizeChange={setSize}
                    depth={depth}
                    onDepthChange={setDepth}
                    baseOffset={baseOffset}
                    onBaseOffsetChange={setBaseOffset}
                    baseHeight={baseHeight}
                    onBaseHeightChange={setBaseHeight}
                    baseColor={baseColor}
                    onBaseColorChange={setBaseColor}
                    textColor={textColor}
                    onTextColorChange={setTextColor}
                    keyringEnabled={keyringEnabled}
                    setKeyringEnabled={setKeyringEnabled}
                    ringOuter={ringOuter}
                    setRingOuter={setRingOuter}
                    ringInner={ringInner}
                    setRingInner={setRingInner}
                    ringX={ringX}
                    setRingX={setRingX}
                    ringY={ringY}
                    setRingY={setRingY}
                    dims={dims}
                />
            }>
            <EditorCanvas dims={dims} title={text || "keychain"}>
                <Center>
                    {/* Base mesh — hex sanitized to strip any alpha channel (#RRGGBBAA → #RRGGBB) */}
                    {baseGeo && (
                        <mesh geometry={baseGeo} castShadow receiveShadow>
                            <meshStandardMaterial color={baseColor?.length > 7 ? baseColor.substring(0, 7) : baseColor} />
                        </mesh>
                    )}
                    {/* Text mesh */}
                    {textGeo && (
                        <mesh
                            geometry={textGeo}
                            position={[0, 0, 0.1]}
                            castShadow
                            receiveShadow>
                            <meshStandardMaterial color={textColor?.length > 7 ? textColor.substring(0, 7) : textColor} />
                        </mesh>
                    )}
                    {/* Keyring — separate mesh for instant repositioning */}
                    {keyringEnabled && ringGeo && (
                        <mesh geometry={ringGeo} castShadow receiveShadow>
                            <meshStandardMaterial color={baseColor?.length > 7 ? baseColor.substring(0, 7) : baseColor} />
                        </mesh>
                    )}
                </Center>
            </EditorCanvas>
        </EditorLayout>
    );
}
