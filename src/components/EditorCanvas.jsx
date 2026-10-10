import { useModelExport } from "../hooks/useModelExport";
import { disposeExportScene } from "../engine/export/modelExport";
import { useRef, useImperativeHandle } from "react";

import { Canvas, useThree } from "@react-three/fiber";

import { OrbitControls, GizmoHelper, GizmoViewcube } from "@react-three/drei";
import * as THREE from "three";

import PrintEstimatorHUD from "./PrintEstimatorHUD";
import CsgLoadingOverlay from "./CsgLoadingOverlay";

import { usePrinter } from "../contexts/PrinterContext";
import TexturedBuildPlate from "./3D/TexturedBuildPlate";
import FloatingExportBar from "./UI/FloatingExportBar";

// ─── Theme colours (mirrors tailwind.config) ───────────────────────────────────
const SECONDARY = "#00A3A3"; // teal
const CELL_COLOR = "#b3e0e0"; // light teal for minor grid lines

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
    children,
    cameraPosition = [0, 80, 120],
    cameraTarget = [0, 0, 0],
    getCustomExportScene,
    leftToolbarActions,
    ref,
}) {
    const exportGroupRef = useRef();
    const captureRef = useRef();
    const buildPlateRef = useRef();
    const gizmoRef = useRef();
    const { activePrinter } = usePrinter();
    const { exportModel, exportAccess, isExporting, exportError } =
        useModelExport();
    const getExportScene = (format) => {
        if (getCustomExportScene) return getCustomExportScene(format);
        if (!exportGroupRef.current) return null;
        const clone = exportGroupRef.current.clone(true);
        clone.rotation.set(0, 0, 0);
        clone.position.set(0, 0, 0);
        clone.updateMatrixWorld(true);
        return clone;
    };
    const runExport = (format, customFilename) => {
        const safeTitle =
            typeof title === "string"
                ? title
                : title?.text || title?.name || "kencreations_model";
        const filename =
            typeof customFilename === "string"
                ? customFilename
                : safeTitle.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase() +
                  "." +
                  format;
        return exportModel({
            getScene: getExportScene,
            format,
            filename,
            // Custom scenes own their resources; regular clones share the live mesh.
            dispose: getCustomExportScene ? disposeExportScene : undefined,
            printConfig: activePrinter
                ? {
                      printableWidth: activePrinter.width,
                      printableDepth: activePrinter.depth,
                  }
                : undefined,
        });
    };
    const handleExportSTL = (name) => runExport("stl", name);
    const handleExport3MF = (name) => runExport("3mf", name);
    useImperativeHandle(ref, () => ({
        exportSTL: handleExportSTL,
        export3MF: handleExport3MF,
    }));

    const handleCapture = () => {
        if (captureRef.current) {
            captureRef.current.capture();
        }
    };

    return (
        <div className="relative w-full h-full bg-transparent">
            <CsgLoadingOverlay />
            {exportError && (
                <p
                    role="alert"
                    className="absolute top-4 left-4 z-30 max-w-sm rounded-lg bg-white p-3 text-red-700 shadow"
                >
                    {exportError}
                </p>
            )}

            <Canvas
                // Cap at 1.5: on 4K screens dpr=2 doubles GPU load for minimal
                // visual gain. 1.5 is near-identical to 2 at typical monitor sizes.
                dpr={[1, 1.5]}
                // preserveDrawingBuffer removed: the synchronous gl.render() call
                // in CaptureHelper before toDataURL() is sufficient. Keeping
                // preserveDrawingBuffer:true prevents the GPU from discarding the
                // framebuffer between frames, which reduces throughput on some drivers.
                gl={{ antialias: true }}
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
                <directionalLight
                    position={[10, 10, 5]}
                    intensity={1}
                    castShadow
                />

                {activePrinter?.modelPath ? (
                    <group ref={buildPlateRef}>
                        <TexturedBuildPlate activePrinter={activePrinter} />
                    </group>
                ) : (
                    <group ref={buildPlateRef}>
                        <gridHelper
                            args={[256, 25, SECONDARY, CELL_COLOR]}
                            position={[0, -0.1, 0]}
                        />
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
                    minDistance={20}
                    maxDistance={
                        (activePrinter
                            ? Math.max(activePrinter.width, activePrinter.depth)
                            : 256) * 2.5
                    }
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

            <FloatingExportBar
                disabled={isExporting}
                exportAccess={exportAccess}
                onExportSTL={handleExportSTL}
                onExport3MF={handleExport3MF}
                onScreenshot={handleCapture}
                leftToolbarActions={leftToolbarActions}
            />
        </div>
    );
}
