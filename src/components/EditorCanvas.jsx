import React, { useMemo, useRef, useState, useEffect, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
    OrbitControls,
    GizmoHelper,
    GizmoViewcube,
    Line,
    Environment,
} from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { exportTo3MF } from "three-3mf-exporter";
import { saveAs } from "file-saver";

// ─── Theme colours (mirrors tailwind.config) ───────────────────────────────────
const SECONDARY = "#00A3A3"; // teal
const CELL_COLOR = "#b3e0e0"; // light teal for minor grid lines
const PLATE_SIZE = 256;
const PLATE_HALF = PLATE_SIZE / 2;
const DIVISIONS = 25; // 256 / 25 ≈ 10 mm per cell

// ─── 256×256 mm build plate (horizontal XZ plane) ─────────────────────────────
function BuildPlate() {
    const border = useMemo(
        () => [
            new THREE.Vector3(-PLATE_HALF, 0, -PLATE_HALF),
            new THREE.Vector3(PLATE_HALF, 0, -PLATE_HALF),
            new THREE.Vector3(PLATE_HALF, 0, PLATE_HALF),
            new THREE.Vector3(-PLATE_HALF, 0, PLATE_HALF),
            new THREE.Vector3(-PLATE_HALF, 0, -PLATE_HALF),
        ],
        [],
    );

    return (
        <group position={[0, -0.1, 0]}>
            {/* Standard horizontal XZ grid (no rotation needed for GridHelper) */}
            <gridHelper args={[PLATE_SIZE, DIVISIONS, SECONDARY, CELL_COLOR]} />
            {/* Teal border outline */}
            <Line points={border} color={SECONDARY} lineWidth={2} />
        </group>
    );
}

// ─── Capture Helper ────────────────────────────────────────────────────────────
const CaptureHelper = ({ captureRef, buildPlateRef, gizmoRef, title }) => {
    const { gl, scene, camera } = useThree();

    useImperativeHandle(captureRef, () => ({
        capture: () => {
            // Hide elements that shouldn't be in the screenshot
            if (buildPlateRef.current) buildPlateRef.current.visible = false;
            if (gizmoRef.current) gizmoRef.current.visible = false;

            // Set white background and boost resolution for capture
            const originalBackground = scene.background;
            const originalPixelRatio = gl.getPixelRatio();
            
            scene.background = new THREE.Color("#ffffff");
            gl.setPixelRatio(Math.max(originalPixelRatio, 2)); // High-res capture
            
            // Force synchronous render
            gl.render(scene, camera);

            // Grab image data
            const dataUrl = gl.domElement.toDataURL("image/png", 1.0);
            
            // Convert Data URL to Blob synchronously (to bypass async gesture timeout)
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            
            // Trigger download using an anchor tag with Blob URL
            const filename = `${title ? title.replace(/\s+/g, "_").toLowerCase() : "kencreations_capture"}.png`;
            const link = document.createElement("a");
            link.download = filename;
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up memory
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

            // Restore state
            scene.background = originalBackground;
            gl.setPixelRatio(originalPixelRatio);
            if (buildPlateRef.current) buildPlateRef.current.visible = true;
            if (gizmoRef.current) gizmoRef.current.visible = true;
        },
    }));

    return null;
};

// ─── Shared canvas wrapper ─────────────────────────────────────────────────────
/**
 * EditorCanvas — drop-in canvas wrapper for all editors.
 *
 * Wraps the editor meshes in a -90deg X rotation so models generated in the
 * XY plane (face toward camera) are automatically laid flat on the build plate.
 * A fixed Y lift of 2.5 units places the model approximately on the grid surface.
 *
 * Usage:
 *   <EditorCanvas dims={dims}>
 *     <Center>{your meshes}</Center>
 *   </EditorCanvas>
 */
export default function EditorCanvas({ dims, title, children, cameraPosition = [0, 80, 120], cameraTarget = [0, 0, 0] }) {
    const exportGroupRef = useRef();
    const captureRef = useRef();
    const buildPlateRef = useRef();
    const gizmoRef = useRef();

    const [isExporting, setIsExporting] = useState(false);

    const getExportScene = () => {
        if (!exportGroupRef.current) return null;
        const clone = exportGroupRef.current.clone();
        // Reset rotation and position to export in native coordinates (XY plane = bed, Z = thickness)
        // This ensures the model lays completely flat when opened in a slicer.
        clone.rotation.set(0, 0, 0);
        clone.position.set(0, 0, 0);
        clone.updateMatrixWorld(true);
        return clone;
    };

    const handleExportSTL = async () => {
        const exportScene = getExportScene();
        if (!exportScene) return;
        setIsExporting(true);
        try {
            const exporter = new STLExporter();
            const stlData = exporter.parse(exportScene, { binary: true });
            const blob = new Blob([stlData], { type: "application/octet-stream" });
            const filename = `${title ? title.replace(/\s+/g, "_").toLowerCase() : "kencreations_model"}.stl`;
            saveAs(blob, filename);
            if (window.electronAPI?.queueTelemetry) {
                window.electronAPI.queueTelemetry({
                    generatorId: title || 'unknown',
                    eventType: 'export',
                    exportFormat: 'stl'
                });
            }
        } catch (error) {
            console.error("Failed to export STL:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const [ready3MF, setReady3MF] = useState(null);

    // Reset 3MF ready state if anything changes
    useEffect(() => {
        setReady3MF(null);
    }, [children, dims, title]);

    const handleExport3MF = async () => {
        const exportScene = getExportScene();
        if (!exportScene) return;
        setIsExporting(true);
        try {
            const data = await exportTo3MF(exportScene);
            const blob = data instanceof Blob ? data : new Blob([data], { type: "model/3mf" });
            const url = URL.createObjectURL(blob);
            setReady3MF({
                url,
                filename: `${title ? title.replace(/\s+/g, "_").toLowerCase() : "kencreations_model"}.3mf`
            });
        } catch (error) {
            console.error("Failed to export 3MF:", error);
        } finally {
            setIsExporting(false);
        }
    };
    const handleCapture = () => {
        if (captureRef.current) {
            captureRef.current.capture();
        }
    };

    return (
        <div className="relative w-full h-full">
            <Canvas
                gl={{ preserveDrawingBuffer: true, antialias: true }}
                dpr={[1, 2]}
                camera={{ position: cameraPosition, fov: 45 }}
                onCreated={({ camera }) => {
                    camera.lookAt(...cameraTarget);
                }}>


                {/*
                  Rotate children from XY plane → XZ plane (lay flat) for visual preview.
                  position Y = 2.5 lifts the model so its base sits on the grid.
                  ref captures this group, and we reset the rotation during export.
                */}
                {/* ── Lights ── */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 20, 15]} intensity={0.9} />
                <directionalLight position={[-8, 10, -6]} intensity={0.3} />
                <Environment preset="apartment" />
                <group
                    ref={exportGroupRef}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 2.5, 0]}>
                    {children}
                </group>

                <group ref={buildPlateRef}>
                    <BuildPlate />
                </group>

                <OrbitControls makeDefault target={cameraTarget} />

                <group ref={gizmoRef}>
                    <GizmoHelper alignment="top-right" margin={[190, 70]}>
                        <GizmoViewcube
                            opacity={1}
                            hoverColor="#6ee7f7"
                            color={SECONDARY}
                            textColor="#ffffff"
                            strokeColor={SECONDARY}
                        />
                    </GizmoHelper>
                </group>

                <CaptureHelper
                    captureRef={captureRef}
                    buildPlateRef={buildPlateRef}
                    gizmoRef={gizmoRef}
                    title={title}
                />
            </Canvas>

            {/* ── Dims overlay — top-right HTML, above gizmo ── */}
            {dims && (
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 rounded-xl bg-white/80 backdrop-blur-sm border border-secondary/30 shadow-md px-4 py-3 pointer-events-none select-none">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-secondary">
                        Size
                    </span>
                    {[
                        { axis: "X", val: dims.x },
                        { axis: "Y", val: dims.y },
                        { axis: "Z", val: dims.z },
                    ].map(({ axis, val }) => (
                        <div
                            key={axis}
                            className="flex items-center justify-between gap-5 text-xs">
                            <span className="font-semibold text-secondary">
                                {axis}
                            </span>
                            <strong className="font-bold text-neutral tabular-nums">
                                {val} mm
                            </strong>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Export buttons — bottom-left HTML ── */}
            <div className="absolute bottom-4 left-4 z-10 flex gap-3">
                <div className="flex bg-white/90 backdrop-blur-md border border-secondary shadow-lg rounded-xl overflow-hidden text-sm font-semibold transition-all">
                    <button
                        onClick={handleExportSTL}
                        disabled={isExporting}
                        className="px-5 py-2.5 text-neutral hover:bg-secondary/10 hover:text-secondary transition-colors border-r border-secondary/20 flex items-center gap-2">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        STL
                    </button>
                    {ready3MF ? (
                        <a
                            href={ready3MF.url}
                            download={ready3MF.filename}
                            onClick={() => {
                                if (window.electronAPI?.queueTelemetry) {
                                    window.electronAPI.queueTelemetry({
                                        generatorId: title || 'unknown',
                                        eventType: 'export',
                                        exportFormat: '3mf'
                                    });
                                }
                                // Optional: Reset it after download so they can generate a new one if they want
                                setTimeout(() => setReady3MF(null), 100);
                            }}
                            className="px-5 py-2.5 bg-secondary text-white hover:bg-secondary/90 transition-colors border-r border-secondary/20 flex items-center gap-2">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Save 3MF
                        </a>
                    ) : (
                        <button
                            onClick={handleExport3MF}
                            disabled={isExporting}
                            className="px-5 py-2.5 text-secondary hover:bg-secondary hover:text-white transition-colors border-r border-secondary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            {isExporting ? "Preparing..." : "3MF"}
                        </button>
                    )}
                    <button
                        onClick={handleCapture}
                        disabled={isExporting}
                        className="px-5 py-2.5 text-neutral hover:bg-neutral/10 transition-colors flex items-center gap-2"
                        title="Capture Screenshot">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
