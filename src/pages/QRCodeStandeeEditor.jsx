import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import { QrCode, Type, Box as BoxIcon, Plus, Trash2, Layers, Upload } from "lucide-react";
import jsQR from "jsqr";
import { Geometry as CSG, Base, Subtraction } from "@react-three/csg";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import qrcode from "qrcode-generator";
import EditorLayout from "../components/EditorLayout";
import EditorCanvas from "../components/EditorCanvas";
import { SidebarSection, ControlInput, ControlSlider, ControlSelect, ControlColorPicker } from "../components/UI/EditorControls";
import { useProfile } from "../contexts/ProfileContext";
import { useHistoryState } from "../hooks/useHistoryState";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import TemplateManager from "../components/TemplateManager";
import { useTemplates } from "../hooks/useTemplates";
import { getCached3DFont } from "../utils/fontManager";
import { HistoryControls } from "../components/HistoryControls";
import PrinterSelector from "../components/PrinterSelector";

const DEFAULT_STATE = {
    // Board & Base Settings
    boardWidth: 150, boardHeight: 200, boardThickness: 4, boardRadius: 8, boardColor: "#FF9016",
    baseDepth: 50, baseColor: "#00B1B7",
    
    // Independent Text Array (Adjusted sizes and Y-positions for a clean look)
    customTexts: [
        { id: 1, text: "Connect with us", x: 0, y: 75, size: 14, depth: 2 },
        { id: 2, text: "Instagram", x: -35, y: 15, size: 12, depth: 2 },
        { id: 3, text: "Free WiFi", x: -35, y: -45, size: 12, depth: 2 }
    ],
    textColor: "#F59E0B",
    fontId: "",
    
    // QR Slots (Aligned with the text)
    qrTolerance: 0.2,
    tileSize: 40,
    items: [
        { id: 1, type: "url", data: "https://kencreations.dev", qrX: 30, qrY: 15 },
        { id: 2, type: "wifi", data: "WIFI:T:WPA;S:MyNetwork;P:Password;;", qrX: 30, qrY: -45 }
    ]
};

const createHalfRoundedBoard = (width, height, radius, thickness) => {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    shape.moveTo(x, y); // Bottom Left (Sharp)
    shape.lineTo(x + width, y); // Bottom Right (Sharp)
    shape.lineTo(x + width, y + height - radius); 
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); // Top Right (Rounded)
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius); // Top Left (Rounded)
    shape.lineTo(x, y); // Close

    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 16 });
    geo.center(); 
    return geo;
};

const centerGeometryXY = (geo) => {
    geo.computeBoundingBox();
    const xOffset = -0.5 * (geo.boundingBox.max.x + geo.boundingBox.min.x);
    const yOffset = -0.5 * (geo.boundingBox.max.y + geo.boundingBox.min.y);
    geo.translate(xOffset, yOffset, 0);
    return geo;
};

const generate3DQRCode = (data, size, thickness) => {
    if (!data) return null;
    try {
        const qr = qrcode(0, 'L');
        qr.addData(data);
        qr.make();
        const moduleCount = qr.getModuleCount();
        const pixelSize = size / moduleCount;
        const geometries = [];
        const offset = size / 2 - pixelSize / 2;

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    const box = new THREE.BoxGeometry(pixelSize, pixelSize, thickness);
                    box.translate(col * pixelSize - offset, -(row * pixelSize - offset), thickness / 2);
                    geometries.push(box);
                }
            }
        }
        return geometries.length > 0 ? BufferGeometryUtils.mergeGeometries(geometries, false) : null;
    } catch (e) {
        return null;
    }
};

export default function QRCodeStandeeEditor() {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors, allFonts } = useProfile();
    const { templates, saveTemplate, loadTemplate, deleteTemplate } = useTemplates("qr_standee");

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
                merged.push({ label: color.name, value: color.hex, hex: color.hex, group: brand });
            });
        });
        (customColors || []).forEach((color) => {
            merged.push({ label: color.color_name, value: color.hex_code, hex: color.hex_code, group: color.brand || "Custom" });
        });
        return merged;
    }, [cloudColors, customColors]);

    const [config, setConfig, { undo, redo, reset, canUndo, canRedo }] = useHistoryState(DEFAULT_STATE);
    const [isDisassembled, setIsDisassembled] = useState(false);

    const updateConfig = (updates) => {
        setConfig({ ...config, ...updates });
    };

    // Ensure valid default font
    useEffect(() => {
        if (allFonts.length > 0) {
            const isValid = allFonts.some((f) => f.id === config.fontId);
            if (!isValid) updateConfig({ fontId: allFonts[0].id });
        }
    }, [allFonts]);

    // Ensure valid default colors from user's filament list
    useEffect(() => {
        if (colorOptions.length > 0) {
            let updates = {};
            const hasBoard = colorOptions.some(c => c.value === config.boardColor);
            const hasBase = colorOptions.some(c => c.value === config.baseColor);
            const hasText = colorOptions.some(c => c.value === config.textColor);

            if (!hasBoard) updates.boardColor = colorOptions[0].value;
            if (!hasBase) updates.baseColor = colorOptions[0].value;
            if (!hasText) updates.textColor = colorOptions[0].value;

            if (Object.keys(updates).length > 0) {
                updateConfig(updates);
            }
        }
    }, [colorOptions]);

    const topBarActions = (
        <HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} onReset={reset} />
    );

    // Get active font
    const fontData = useMemo(() => allFonts.find((f) => f.id === config.fontId) || allFonts[0], [config.fontId, allFonts]);
    const [parsedFont, setParsedFont] = useState(null);

    useEffect(() => {
        let mounted = true;
        const loadFont = async () => {
            if (fontData) {
                try {
                    const data = await getCached3DFont(fontData);
                    if (mounted) setParsedFont(data);
                } catch (err) {
                    console.error("Failed to load font:", err);
                }
            }
        };
        loadFont();
        return () => { mounted = false; };
    }, [fontData]);

    const deferredConfig = useDeferredValue(config);

    const updateItem = (id, updates) => {
        const newItems = config.items.map(item => item.id === id ? { ...item, ...updates } : item);
        updateConfig({ items: newItems });
    };

    const dims = useMemo(() => {
        return {
            x: deferredConfig.boardWidth + 20,
            y: deferredConfig.boardHeight + 10,
            z: deferredConfig.baseDepth
        };
    }, [deferredConfig.boardWidth, deferredConfig.boardHeight, deferredConfig.baseDepth]);

    const baseGeo = useMemo(() => new THREE.BoxGeometry(deferredConfig.boardWidth + 20, 10, deferredConfig.baseDepth), [deferredConfig.boardWidth, deferredConfig.baseDepth]);
    const slotCutterGeo = useMemo(() => new THREE.BoxGeometry(deferredConfig.boardWidth, 15, deferredConfig.boardThickness + deferredConfig.qrTolerance), [deferredConfig.boardWidth, deferredConfig.boardThickness, deferredConfig.qrTolerance]);
    const boardGeo = useMemo(() => createHalfRoundedBoard(
        deferredConfig.boardWidth, deferredConfig.boardHeight, deferredConfig.boardRadius, deferredConfig.boardThickness
    ), [deferredConfig.boardWidth, deferredConfig.boardHeight, deferredConfig.boardRadius, deferredConfig.boardThickness]);
    
    const pocketDepth = deferredConfig.boardThickness / 2;
    const pocketCutterGeo = useMemo(() => new THREE.BoxGeometry(
        deferredConfig.tileSize + deferredConfig.qrTolerance, 
        deferredConfig.tileSize + deferredConfig.qrTolerance, 
        pocketDepth + 0.1
    ), [deferredConfig.tileSize, deferredConfig.qrTolerance, pocketDepth]);

    const disassembleAction = (
        <div className="flex bg-white/90 backdrop-blur-md border border-secondary shadow-lg rounded-xl overflow-hidden text-sm font-semibold transition-all">
            <button onClick={(e) => { e.stopPropagation(); setIsDisassembled(!isDisassembled); }} className="px-5 py-2.5 text-secondary hover:bg-secondary hover:text-white transition-colors flex items-center gap-2">
                <Layers size={16}/>
                {isDisassembled ? "Assemble Tiles" : "Disassemble Tiles"}
            </button>
        </div>
    );

    const handleImageUpload = (e, itemId) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                
                // Scale down slightly for performance if it's a massive image
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round((height *= MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const imageData = ctx.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

                if (code) {
                    updateItem(itemId, { data: code.data });
                } else {
                    alert("Could not find a valid QR code in this image. Please ensure it is clear and well-lit.");
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        e.target.value = null; 
    };

    return (
        <EditorLayout
            title="QR Standee"
            topBarActions={topBarActions}
            sidebarContent={
                <div className="space-y-4 pt-1">
                    <PrinterSelector />
                    <TemplateManager
                        editorId="qr_standee"
                        currentSettings={config}
                        onLoadTemplate={(tpl) => setConfig({ ...config, ...tpl })}
                        excludeKeys={[]}
                    />

                    <SidebarSection title="Board Configuration" icon={Layers}>
                        <div className="space-y-4">
                            <ControlSlider
                                label="Board Width"
                                value={config.boardWidth}
                                min={100} max={250} step={1} unit="mm"
                                onChange={(val) => updateConfig({ boardWidth: val })}
                            />
                            <ControlSlider
                                label="Board Height"
                                value={config.boardHeight}
                                min={100} max={300} step={1} unit="mm"
                                onChange={(val) => updateConfig({ boardHeight: val })}
                            />
                            <ControlSlider
                                label="Board Thickness"
                                value={config.boardThickness}
                                min={2} max={10} step={1} unit="mm"
                                onChange={(val) => updateConfig({ boardThickness: val })}
                            />
                            <ControlSlider
                                label="Corner Radius"
                                value={config.boardRadius}
                                min={0} max={30} step={1} unit="mm"
                                onChange={(val) => updateConfig({ boardRadius: val })}
                            />
                            <ControlColorPicker
                                label="Board Color"
                                value={config.boardColor}
                                onChange={(val) => updateConfig({ boardColor: val })}
                                options={colorOptions}
                            />
                        </div>
                    </SidebarSection>

                    <SidebarSection title="Base Stand" icon={BoxIcon}>
                        <div className="space-y-4">
                            <ControlSlider
                                label="Base Depth"
                                value={config.baseDepth}
                                min={20} max={100} step={1} unit="mm"
                                onChange={(val) => updateConfig({ baseDepth: val })}
                            />
                            <ControlSlider
                                label="QR Slot Tolerance"
                                value={config.qrTolerance}
                                min={0} max={1} step={0.05} unit="mm"
                                onChange={(val) => updateConfig({ qrTolerance: val })}
                            />
                            <ControlColorPicker
                                label="Base Color"
                                value={config.baseColor}
                                onChange={(val) => updateConfig({ baseColor: val })}
                                options={colorOptions}
                            />
                        </div>
                    </SidebarSection>

                    <SidebarSection title={`Custom Text (${config.customTexts?.length || 0})`} icon={Type}>
                        <div className="space-y-4">
                            <ControlSelect
                                label="Font Family"
                                value={config.fontId}
                                onChange={(val) => updateConfig({ fontId: val })}
                                options={fontOptions}
                                prefixType="font"
                            />
                            <ControlColorPicker 
                                label="Text Color" 
                                value={config.textColor}
                                onChange={(v) => updateConfig({ textColor: v })} 
                                options={colorOptions} 
                            />
                            {(config.customTexts || []).map((txt) => (
                                <div key={txt.id} className="p-3 border border-secondary/20 bg-secondary/5 rounded-lg space-y-3 relative shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <ControlInput 
                                            label="Text" 
                                            value={typeof txt.text === 'string' ? txt.text : ""}
                                            onChange={(e) => {
                                                const newTexts = config.customTexts.map(t => t.id === txt.id ? { ...t, text: e.target.value } : t);
                                                updateConfig({ customTexts: newTexts });
                                            }} 
                                        />
                                        <button 
                                            onClick={() => updateConfig({ customTexts: config.customTexts.filter(t => t.id !== txt.id) })} 
                                            className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <ControlSlider 
                                            label="Pos X" 
                                            max={150} min={-150} 
                                            value={txt.x} 
                                            onChange={(v) => {
                                                const newTexts = config.customTexts.map(t => t.id === txt.id ? { ...t, x: v } : t);
                                                updateConfig({ customTexts: newTexts });
                                            }} 
                                        />
                                        <ControlSlider 
                                            label="Pos Y" 
                                            max={150} min={-150} 
                                            value={txt.y} 
                                            onChange={(v) => {
                                                const newTexts = config.customTexts.map(t => t.id === txt.id ? { ...t, y: v } : t);
                                                updateConfig({ customTexts: newTexts });
                                            }} 
                                        />
                                        <div className="col-span-2 grid grid-cols-2 gap-2">
                                            <ControlSlider 
                                                label="Size" 
                                                max={40} min={5} 
                                                value={txt.size} 
                                                onChange={(v) => {
                                                    const newTexts = config.customTexts.map(t => t.id === txt.id ? { ...t, size: v } : t);
                                                    updateConfig({ customTexts: newTexts });
                                                }} 
                                            />
                                            <ControlSlider 
                                                label="Depth" 
                                                max={20} min={1} 
                                                value={txt.depth || 2} 
                                                onChange={(v) => {
                                                    const newTexts = config.customTexts.map(t => t.id === txt.id ? { ...t, depth: v } : t);
                                                    updateConfig({ customTexts: newTexts });
                                                }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button 
                                onClick={() => updateConfig({ customTexts: [...(config.customTexts || []), { id: Date.now(), text: "New Text", x: 0, y: 0, size: 14, depth: 2 }] })} 
                                className="w-full py-2.5 border-2 border-dashed border-secondary/40 text-secondary rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors font-semibold"
                            >
                                <Plus size={16}/> Add Text Line
                            </button>
                        </div>
                    </SidebarSection>

                    <SidebarSection title="QR Inserts" icon={QrCode}>
                        <div className="space-y-4">
                            <ControlSlider
                                label="QR Tile Size"
                                value={config.tileSize}
                                min={20} max={80} step={1} unit="mm"
                                onChange={(val) => updateConfig({ tileSize: val })}
                            />
                            
                            {config.items.map((item, index) => (
                                <div key={item.id} className="p-3 bg-white border border-secondary/20 rounded-xl space-y-3 relative shadow-sm">
                                    <button 
                                        onClick={() => updateConfig({ items: config.items.filter(t => t.id !== item.id) })}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <p className="text-xs font-bold text-secondary uppercase">Slot {index + 1}</p>
                                    
                                    <div className="space-y-2">
                                        <ControlInput
                                            label="URL, WiFi, or Payment Data"
                                            value={typeof item.data === 'string' ? item.data : ""}
                                            onChange={(e) => updateItem(item.id, { data: e.target.value })}
                                        />
                                        {/* DENSITY WARNING FOR LONG PAYLOADS */}
                                        {typeof item.data === 'string' && item.data.length > 60 && (
                                            <div className="mt-2 mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 animate-fade-in">
                                                <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                                                <p className="text-[10px] text-amber-600/90 leading-tight">
                                                    <strong className="font-bold block mb-0.5">High Density QR Detected</strong>
                                                    This data payload is very long ({item.data.length} chars). To ensure it scans after 3D printing, please increase the <b>QR Tile Size</b> to at least 60mm.
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex justify-end">
                                            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white rounded-lg text-xs font-bold transition-colors">
                                                📷 Extract from Image
                                                <input 
                                                    type="file" 
                                                    accept="image/png, image/jpeg" 
                                                    className="hidden" 
                                                    onChange={(e) => handleImageUpload(e, item.id)}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <ControlSlider label="QR X" max={150} min={-150} value={item.qrX} onChange={(v) => updateItem(item.id, { qrX: v })} />
                                        <ControlSlider label="QR Y" max={150} min={-150} value={item.qrY} onChange={(v) => updateItem(item.id, { qrY: v })} />
                                    </div>
                                </div>
                            ))}

                            {config.items.length < 4 && (
                                <button 
                                    onClick={() => {
                                        const qrY = config.items.length > 0 ? config.items[config.items.length - 1].qrY - 50 : 20;
                                        updateConfig({ items: [...config.items, { id: Date.now(), type: "url", data: "https://", qrX: 30, qrY }] });
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-secondary/40 text-secondary hover:bg-secondary/5 font-semibold transition-colors"
                                >
                                    <Plus size={16} /> Add QR Slot
                                </button>
                            )}
                        </div>
                    </SidebarSection>
                </div>
            }>
            <div className="relative w-full h-full">
                <EditorCanvas title="QR Standee" dims={dims} leftToolbarActions={disassembleAction}>
                    <group position={[0, 0, 0]}>
                        
                        {/* 1. THE DESK BASE */}
                        <group position={[0, -deferredConfig.boardHeight / 2 - 5, 0]}>
                            <mesh name="Standee_Base" castShadow receiveShadow>
                                <CSG>
                                    <Base geometry={baseGeo} />
                                    <Subtraction geometry={slotCutterGeo} position={[0, 2, 0]} />
                                </CSG>
                                <meshStandardMaterial color={deferredConfig.baseColor} />
                            </mesh>
                        </group>

                        {/* 2. THE MAIN BOARD */}
                        <group position={[0, 0, 0]}>
                            <mesh name="Standee_Board" castShadow receiveShadow>
                                <CSG>
                                    <Base geometry={boardGeo}/>
                                    
                                    {/* Subtract QR Pockets (Half Depth) */}
                                    {deferredConfig.items.map((item) => (
                                        <Subtraction key={`pocket-${item.id}`} geometry={pocketCutterGeo} position={[item.qrX, item.qrY, deferredConfig.boardThickness / 4]} />
                                    ))}
                                </CSG>
                                <meshStandardMaterial color={deferredConfig.boardColor} />
                            </mesh>

                            {/* 3. CUSTOM TEXTS (RENDERED AS SEPARATE MESHES FOR EASY COLORING IN SLICER) */}
                            {deferredConfig.customTexts.map((txt) => {
                                if (!parsedFont || typeof txt.text !== 'string' || !txt.text.trim()) return null;
                                const textDepth = txt.depth || 2;
                                const txtGeo = centerGeometryXY(new TextGeometry(txt.text, { font: parsedFont, size: txt.size, height: textDepth, depth: textDepth, curveSegments: 12 }));
                                return (
                                    <mesh key={`text-${txt.id}`} name={`Custom_Text_${txt.id}`} geometry={txtGeo} position={[txt.x, txt.y, deferredConfig.boardThickness / 2]} castShadow receiveShadow>
                                        <meshStandardMaterial color={deferredConfig.textColor} />
                                    </mesh>
                                );
                            })}
                        </group>

                        {/* 3. MODULAR QR TILES */}
                        {deferredConfig.items.map((item) => {
                            const qrGeo = generate3DQRCode(item.data, deferredConfig.tileSize - 4, 1.5);
                            const isDisassembledZ = isDisassembled ? 30 : 0;
                            const tileZ = (deferredConfig.boardThickness / 4) + isDisassembledZ; 
                            
                            return (
                                <group key={`tile-${item.id}`} position={[item.qrX, item.qrY, tileZ]}>
                                    <mesh name={`QR_Tile_Base_${item.id}`} castShadow receiveShadow>
                                        <boxGeometry args={[deferredConfig.tileSize, deferredConfig.tileSize, pocketDepth]} />
                                        <meshStandardMaterial color="#ffffff" />
                                    </mesh>
                                    {qrGeo && (
                                        <mesh name={`QR_Code_Matrix_${item.id}`} geometry={qrGeo} position={[0, 0, pocketDepth / 2]} castShadow receiveShadow>
                                            <meshStandardMaterial color="#111111" />
                                        </mesh>
                                    )}
                                </group>
                            );
                        })}
                    </group>
                </EditorCanvas>
            </div>
        </EditorLayout>
    );
}
