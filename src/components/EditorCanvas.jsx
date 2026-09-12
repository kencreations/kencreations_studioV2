import React, {
    useMemo,
    useRef,
    useState,
    useEffect,
    useImperativeHandle,
} from "react";
import { useLocation } from "react-router-dom";
import { editors } from "../data/editors";
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
import PrintEstimatorHUD from "./PrintEstimatorHUD";
import CsgLoadingOverlay from "./CsgLoadingOverlay";
import PricingModal from "./UI/PricingModal";
import { useSecureTrial } from "../contexts/TrialContext";
import { usePrinter } from "../contexts/PrinterContext";
import TexturedBuildPlate from "./3D/TexturedBuildPlate";

// ─── Theme colours (mirrors tailwind.config) ───────────────────────────────────
const SECONDARY = "#00A3A3"; // teal
const CELL_COLOR = "#b3e0e0"; // light teal for minor grid lines
const PLATE_SIZE = 256;
const PLATE_HALF = PLATE_SIZE / 2;
const DIVISIONS = 25; // 256 / 25 ≈ 10 mm per cell

// The old generic grid BuildPlate component has been removed in favor of TexturedBuildPlate

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

            const sanitizeHex = (hex) =>
                hex && hex.length > 7 ? hex.substring(0, 7) : hex;
            scene.background = new THREE.Color(sanitizeHex("#ffffff"));
            gl.setPixelRatio(Math.max(originalPixelRatio, 2)); // High-res capture

            // Force synchronous render
            gl.render(scene, camera);

            // Grab image data
            const dataUrl = gl.domElement.toDataURL("image/png", 1.0);

            // Convert Data URL to Blob synchronously (to bypass async gesture timeout)
            const arr = dataUrl.split(",");
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
export default function EditorCanvas({
    dims,
    title,
    generatorId,
    children,
    cameraPosition = [0, 80, 120],
    cameraTarget = [0, 0, 0],
    getCustomExportScene,
    leftToolbarActions,
    ref,
}) {
    const location = useLocation();
    const currentEditor = editors.find(e => e.link === location.pathname);
    const resolvedGeneratorId = generatorId || currentEditor?.id || "unknown";
    const exportGroupRef = useRef();
    const captureRef = useRef();
    const buildPlateRef = useRef();
    const gizmoRef = useRef();

    const [isExporting, setIsExporting] = useState(false);
    const [isLicensed, setIsLicensed] = useState(false);
    const [entitlements, setEntitlements] = useState([]);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const { exportsLeft, decrementTrial } = useSecureTrial() || {};
    const { activePrinter } = usePrinter();

    useEffect(() => {
        if (window.electronAPI?.checkLicense) {
            window.electronAPI.checkLicense().then(res => {
                setIsLicensed(res.activated);
                setEntitlements(res.entitlements || []);
            }).catch(err => console.error("Failed to check license in EditorCanvas:", err));
        }
        
        if (window.electronAPI?.onEntitlementsUpdated) {
            const unsub = window.electronAPI.onEntitlementsUpdated(({ entitlements: newEnt }) => {
                setEntitlements(newEnt);
                setIsLicensed(true);
            });
            return unsub;
        }
    }, []);

    const checkExportAccess = () => {
        if (!currentEditor) return true; // Fallback if editor not found
        if (!currentEditor.isExclusive) return true;
        return isLicensed && entitlements.includes(currentEditor.requiredEntitlement);
    };

    const checkTrialAndDecrement = async () => {
        // A user is allowed infinite exports ONLY IF they have an active license,
        // and if the current editor is exclusive, they must have its entitlement.
        const isFullyLicensed = isLicensed && (!currentEditor?.isExclusive || entitlements.includes(currentEditor?.requiredEntitlement));
        
        if (isFullyLicensed) return true;

        if (!navigator.onLine) {
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('local-notification', { detail: { id: Date.now(), type: 'warning', title: 'Offline', body: 'An internet connection is required to process free trial exports.' } }));
            }
            return false;
        }
        
        if (exportsLeft > 0) {
            if (decrementTrial) await decrementTrial();
            return true;
        } else {
            setIsPricingModalOpen(true);
            return false;
        }
    };

    const getExportScene = () => {
        if (getCustomExportScene) {
            return getCustomExportScene();
        }
        if (!exportGroupRef.current) return null;
        
        const clone = exportGroupRef.current.clone();
        clone.rotation.set(0, 0, 0);
        clone.position.set(0, 0, 0);

        // DEEP CLONE MATERIALS FOR 3MF EXPORTER
        // This stops the exporter from losing R3F shared material colors
        clone.traverse((child) => {
            if (child.isMesh && child.material) {
                // Clone the material so it's a unique instance
                child.material = child.material.clone();
                
                // Hard-bake the color to ensure the XML writer catches it
                if (child.material.color) {
                    const hex = child.material.color.getHexString();
                    child.material.color = new THREE.Color(`#${hex}`);
                }
            }
        });

        clone.updateMatrixWorld(true);
        return clone;
    };

    const handleExportSTL = async (customFilename) => {
        const canExport = await checkTrialAndDecrement();
        if (!canExport) return;
        setIsExporting(true);
        try {
            const exportScene = getExportScene();
            if (!exportScene) {
                setIsExporting(false);
                return;
            }
            const exporter = new STLExporter();
            const stlData = exporter.parse(exportScene, { binary: true });
            const blob = new Blob([stlData], {
                type: "application/octet-stream",
            });
            let safeTitle = "kencreations_model";
            if (typeof title === 'string') safeTitle = title;
            else if (title && typeof title.text === 'string') safeTitle = title.text;
            else if (title && typeof title.name === 'string') safeTitle = title.name;
            const defaultFilename = `${safeTitle.replace(/\s+/g, "_").toLowerCase()}.stl`;
            const finalFilename = typeof customFilename === 'string' ? customFilename : defaultFilename;
            saveAs(blob, finalFilename);
            if (window.electronAPI?.queueTelemetry) {
                window.electronAPI.queueTelemetry({
                    generatorId: resolvedGeneratorId,
                    filename: finalFilename,
                    eventType: "export",
                    exportFormat: "stl",
                });
            }
            if (window.electronAPI?.incrementExports) {
                window.electronAPI.incrementExports();
            }
        } catch (error) {
            console.error("Failed to export STL:", error);
        } finally {
            setIsExporting(false);
        }
    };

    useImperativeHandle(ref, () => ({
        exportSTL: handleExportSTL,
        export3MF: handleExport3MF,
    }));

    const [ready3MF, setReady3MF] = useState(null);

    // Reset 3MF ready state if anything changes
    useEffect(() => {
        setReady3MF(null);
    }, [children, dims, title]);

    const handleExport3MF = async (directFilename = null) => {
        const canExport = await checkTrialAndDecrement();
        if (!canExport) return;
        setIsExporting(true);
        try {
            const exportScene = getExportScene();
            if (!exportScene) {
                setIsExporting(false);
                return;
            }
            const data = await exportTo3MF(exportScene);
            const blob =
                data instanceof Blob
                    ? data
                    : new Blob([data], { type: "model/3mf" });
            
            if (directFilename) {
                saveAs(blob, directFilename);
                if (window.electronAPI?.queueTelemetry) {
                    window.electronAPI.queueTelemetry({
                        generatorId: resolvedGeneratorId,
                        filename: directFilename,
                        eventType: "export",
                        exportFormat: "3mf",
                    });
                }
                if (window.electronAPI?.incrementExports) {
                    window.electronAPI.incrementExports();
                }
            } else {
                const url = URL.createObjectURL(blob);
                let safeTitle = "kencreations_model";
                if (typeof title === 'string') safeTitle = title;
                else if (title && typeof title.text === 'string') safeTitle = title.text;
                else if (title && typeof title.name === 'string') safeTitle = title.name;
                setReady3MF({
                    url,
                    filename: `${safeTitle.replace(/\s+/g, "_").toLowerCase()}.3mf`,
                });
            }
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
        <div className="relative w-full h-full bg-transparent">
            <CsgLoadingOverlay />

            <Canvas
                gl={{ preserveDrawingBuffer: true, antialias: true }}
                dpr={[1, 2]}
                camera={{ position: cameraPosition, fov: 45 }}
                onCreated={({ camera }) => {
                    camera.lookAt(...cameraTarget);
                }}
            >
                {/*
                  Rotate children from XY plane → XZ plane (lay flat) for visual preview.
                  position Y = 2.5 lifts the model so its base sits on the grid.
                  ref captures this group, and we reset the rotation during export.
                */}
                {/* ── Lights ── */}
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} castShadow />

                {activePrinter?.modelPath ? (
                    <group ref={buildPlateRef}>
                        <TexturedBuildPlate activePrinter={activePrinter} />
                    </group>
                ) : (
                    <group ref={buildPlateRef}>
                        <gridHelper args={[256, 25, SECONDARY, CELL_COLOR]} position={[0, -0.1, 0]} />
                    </group>
                )}
                
                <group
                    ref={exportGroupRef}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 2.5, 0]}
                >
                    {children}
                </group>


                <OrbitControls
                    makeDefault
                    target={cameraTarget}
                    enableDamping
                    dampingFactor={0.05}
                    zoomSpeed={1.5}
                    panSpeed={1.2}
                />

                <group ref={gizmoRef}>
                    <GizmoHelper alignment="top-right" margin={[220, 170]}>
                        <GizmoViewcube
                            opacity={1}
                            hoverColor="#6ee7f7"
                            color={SECONDARY}
                            textColor="#ffffff"
                            strokeColor={SECONDARY}
                            borderColor={SECONDARY}
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

            {/* ── Top-right canvas HUD stack; keeps dims, estimator, and gizmo from overlapping ── */}
            <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2.5 pointer-events-none select-none">
                {dims && (
                    <div className="pointer-events-auto flex items-center gap-3.5 rounded-full border border-secondary/30 bg-white/90 px-5 py-2 shadow-sm backdrop-blur-md">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="font-bold text-secondary">X:</span>
                            <strong className="font-semibold text-neutral tabular-nums">
                                {dims.x}mm
                            </strong>
                        </div>

                        <span className="text-secondary/30 font-light">|</span>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="font-bold text-primary">Y:</span>
                            <strong className="font-semibold text-neutral tabular-nums">
                                {dims.y}mm
                            </strong>
                        </div>

                        <span className="text-secondary/30 font-light">|</span>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="font-bold text-slate-400">Z:</span>
                            <strong className="font-semibold text-neutral tabular-nums">
                                {dims.z}mm
                            </strong>
                        </div>
                    </div>
                )}

                <div className="pointer-events-auto">
                    {dims && <PrintEstimatorHUD dims={dims} />}
                </div>
            </div>

            {/* ── Export buttons — bottom-left HTML ── */}
            <div className="absolute bottom-4 left-4 z-10 flex gap-3">
                <div className="flex bg-white/90 backdrop-blur-md border border-secondary shadow-lg rounded-xl overflow-hidden text-sm font-semibold transition-all">
                    <button
                        onClick={handleExportSTL}
                        disabled={isExporting}
                        className="px-5 py-2.5 text-neutral hover:bg-secondary/10 hover:text-secondary transition-colors border-r border-secondary/20 flex items-center gap-2"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
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
                                        generatorId: resolvedGeneratorId,
                                        filename: ready3MF.filename,
                                        eventType: "export",
                                        exportFormat: "3mf",
                                    });
                                }
                                if (window.electronAPI?.incrementExports) {
                                    window.electronAPI.incrementExports();
                                }
                                // Optional: Reset it after download so they can generate a new one if they want
                                setTimeout(() => setReady3MF(null), 100);
                            }}
                            className="px-5 py-2.5 bg-secondary text-white hover:bg-secondary/90 transition-colors border-r border-secondary/20 flex items-center gap-2"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Generate 3MF
                        </a>
                    ) : (
                        <button
                            onClick={handleExport3MF}
                            disabled={isExporting}
                            className="px-5 py-2.5 text-secondary hover:bg-secondary hover:text-white transition-colors border-r border-secondary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
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
                        title="Capture Screenshot"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                    </button>
                </div>
                {leftToolbarActions}
            </div>

            <PricingModal
                isOpen={isPricingModalOpen}
                onClose={() => setIsPricingModalOpen(false)}
            />
        </div>
    );
}
