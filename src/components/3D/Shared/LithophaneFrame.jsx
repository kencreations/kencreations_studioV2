import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { load3DFont } from "../../../utils/fontManager";
import { createTextShapesWithSpacing } from "../../../utils/textContour";
import { useProfile } from "../../../contexts/ProfileContext";
import { SUBTRACTION, Brush, Evaluator } from "three-bvh-csg";

/**
 * LithophaneFrame — Protective border, keyring boss, and border text
 * for the Lithophane Keychain generator.
 *
 * Wraps the lithophane in a solid frame sitting at Z = 0.
 * Supports frame profiles (flat, fillet, chamfer), a keyring boss
 * (inset or tab with optional reinforced donut), and embossed/debossed
 * text on any frame edge.
 *
 * Architecture follows the same React.memo + useEffect + ref-callback
 * pattern as SmartCSGBase and SmartKeyring.
 */
const LithophaneFrame = React.memo(
    ({
        lithoBoundingBox,
        frameWidth = 2.5,
        frameDepth = 3.2,
        frameProfile = "flat",
        color = "#EC008C",

        // Keyring
        keyringEnabled = true,
        keyringStyle = "tab",
        keyringThickness = 3.2,
        keyringDiameter = 10,
        keyringHole = 4,
        keyringPosition = "top",
        keyringReinforced = true,
        keyringOffset = 50,

        // Border text
        borderText = "",
        borderTextSide = "bottom",
        borderTextFont = "Titan One",
        borderTextSize = 5,
        borderTextDepth = 0.6,
        borderTextColor = "#ffffff",
        borderTextMode = "emboss",

        onFrameReady,
    }) => {
        const { allFonts } = useProfile();
        const [frameGeometry, setFrameGeometry] = useState(null);
        const [textGeometry, setTextGeometry] = useState(null);
        const [textPosition, setTextPosition] = useState([0, 0, 0]);
        const fontCacheRef = useRef({});

        // Store callback in ref to avoid stale closures
        const onFrameReadyRef = useRef(onFrameReady);
        useEffect(() => {
            onFrameReadyRef.current = onFrameReady;
        }, [onFrameReady]);

        // ── Frame + Keyring geometry ─────────────────────────────────────────
        useEffect(() => {
            if (!lithoBoundingBox) {
                setFrameGeometry(null);
                onFrameReadyRef.current?.(null, null);
                return;
            }

            const bb = lithoBoundingBox;
            const overlap = 1; // 1mm overlap to swallow the skirt
            const innerMinX = bb.min.x + overlap;
            const innerMaxX = bb.max.x - overlap;
            const innerMinY = bb.min.y + overlap;
            const innerMaxY = bb.max.y - overlap;

            let padTop = frameWidth;
            let padBottom = frameWidth;
            let padLeft = frameWidth;
            let padRight = frameWidth;

            if (borderText && borderText.trim() !== "") {
                const textSizePad = Math.max(frameWidth, borderTextSize + 4);
                if (borderTextSide === "top") padTop = textSizePad;
                else if (borderTextSide === "bottom") padBottom = textSizePad;
                else if (borderTextSide === "left") padLeft = textSizePad;
                else if (borderTextSide === "right") padRight = textSizePad;
            }

            const outerMinX = bb.min.x - padLeft;
            const outerMaxX = bb.max.x + padRight;
            const outerMinY = bb.min.y - padBottom;
            const outerMaxY = bb.max.y + padTop;

            // ── 1. Build frame shape (outer rect with inner rect hole) ───────
            const outerShape = new THREE.Shape();
            outerShape.moveTo(outerMinX, outerMinY);
            outerShape.lineTo(outerMaxX, outerMinY);
            outerShape.lineTo(outerMaxX, outerMaxY);
            outerShape.lineTo(outerMinX, outerMaxY);
            outerShape.closePath();

            const innerHole = new THREE.Path();
            innerHole.moveTo(innerMinX, innerMinY);
            innerHole.lineTo(innerMaxX, innerMinY);
            innerHole.lineTo(innerMaxX, innerMaxY);
            innerHole.lineTo(innerMinX, innerMaxY);
            innerHole.closePath();
            outerShape.holes.push(innerHole);

            // ── 2. Extrude with profile ──────────────────────────────────────
            let bevelEnabled = false;
            let bevelThickness = 0;
            let bevelSize = 0;
            let bevelSegments = 0;

            if (frameProfile === "fillet") {
                bevelEnabled = true;
                bevelThickness = 0.5;
                bevelSize = 0.5;
                bevelSegments = 3;
            } else if (frameProfile === "chamfer") {
                bevelEnabled = true;
                bevelThickness = 0.5;
                bevelSize = 0.5;
                bevelSegments = 1;
            }

            const effectiveDepth = bevelEnabled
                ? frameDepth - bevelThickness
                : frameDepth;

            const frameGeo = new THREE.ExtrudeGeometry(outerShape, {
                depth: Math.max(effectiveDepth, 0.5),
                bevelEnabled,
                bevelThickness,
                bevelSize,
                bevelSegments,
                curveSegments: 1, // rectangular — no curves needed
            });

            // Anchor at Z = 0
            frameGeo.computeBoundingBox();
            const fBB = frameGeo.boundingBox;
            frameGeo.translate(0, 0, -fBB.min.z);

            // ── 3. Keyring Boss ──────────────────────────────────────────────
            let combinedGeo = frameGeo;

            if (keyringEnabled) {
                const innerR = keyringHole / 2;
                const outerR = innerR + keyringThickness;

                // Ring shape with centered hole
                const ringShape = new THREE.Shape();
                ringShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
                const hole = new THREE.Path();
                hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
                ringShape.holes.push(hole);

                const ringGeo = new THREE.ExtrudeGeometry(ringShape, {
                    depth: frameDepth,
                    bevelEnabled: false,
                    curveSegments: 32,
                });

                // Position the boss along the chosen edge
                let bossX = 0, bossY = 0;
                const tabOffset = keyringStyle === "tab" ? outerR : 0;
                const slideFactor = keyringOffset / 100;

                switch (keyringPosition) {
                    case "top":
                    case "bottom": {
                        const maxLeft = outerMinX + outerR;
                        const maxRight = outerMaxX - outerR;
                        const range = Math.max(0, maxRight - maxLeft);
                        bossX = maxLeft + range * slideFactor;
                        bossY = keyringPosition === "top" ? outerMaxY + tabOffset : outerMinY - tabOffset;
                        break;
                    }
                    case "left":
                    case "right": {
                        const maxBottom = outerMinY + outerR;
                        const maxTop = outerMaxY - outerR;
                        const range = Math.max(0, maxTop - maxBottom);
                        bossY = maxBottom + range * slideFactor;
                        bossX = keyringPosition === "left" ? outerMinX - tabOffset : outerMaxX + tabOffset;
                        break;
                    }
                    default:
                        bossX = (outerMinX + outerMaxX) / 2;
                        bossY = outerMaxY + tabOffset;
                }

                ringGeo.translate(bossX, bossY, 0);

                let finalRingGeo = ringGeo;
                if (keyringStyle === "inset") {
                    // CSG Subtraction: prevent boss from bleeding into the image area
                    const ringBrush = new Brush(ringGeo);
                    
                    const exclusionGeo = new THREE.BoxGeometry(
                        lithoBoundingBox.max.x - lithoBoundingBox.min.x,
                        lithoBoundingBox.max.y - lithoBoundingBox.min.y,
                        frameDepth * 5
                    );
                    const exclusionCx = (lithoBoundingBox.max.x + lithoBoundingBox.min.x) / 2;
                    const exclusionCy = (lithoBoundingBox.max.y + lithoBoundingBox.min.y) / 2;
                    exclusionGeo.translate(exclusionCx, exclusionCy, 0);
                    
                    const exclusionBrush = new Brush(exclusionGeo);
                    const evaluator = new Evaluator();
                    
                    const clippedRingBrush = evaluator.evaluate(ringBrush, exclusionBrush, SUBTRACTION);
                    finalRingGeo = clippedRingBrush.geometry;
                }

                // Merge frame + boss into a single geometry
                const mergedFrame = BufferGeometryUtils.mergeVertices(frameGeo, 1e-6);
                const mergedRing = BufferGeometryUtils.mergeVertices(finalRingGeo, 1e-6);

                // Ensure both have matching attributes before merge
                if (mergedFrame.attributes.uv) mergedFrame.deleteAttribute("uv");
                if (mergedRing.attributes.uv) mergedRing.deleteAttribute("uv");

                mergedFrame.computeVertexNormals();
                mergedRing.computeVertexNormals();

                combinedGeo = BufferGeometryUtils.mergeGeometries(
                    [mergedFrame, mergedRing],
                    false
                );
            }

            // Final cleanup
            let finalGeo = BufferGeometryUtils.mergeVertices(combinedGeo, 1e-6);
            if (finalGeo.attributes.uv) finalGeo.deleteAttribute("uv");
            finalGeo.computeVertexNormals();
            finalGeo.computeBoundingBox();

            setFrameGeometry(finalGeo);
            onFrameReadyRef.current?.(finalGeo, finalGeo.boundingBox.clone());
        }, [
            lithoBoundingBox,
            frameWidth,
            frameDepth,
            frameProfile,
            keyringEnabled,
            keyringStyle,
            keyringThickness,
            keyringDiameter,
            keyringHole,
            keyringPosition,
            keyringReinforced,
            keyringOffset,
            borderText,
            borderTextSide,
            borderTextSize,
        ]);

        // ── Border Text geometry ─────────────────────────────────────────────
        useEffect(() => {
            if (
                !borderText ||
                borderText.trim() === "" ||
                !lithoBoundingBox ||
                !allFonts?.length
            ) {
                setTextGeometry(null);
                return;
            }

            let active = true;

            const buildText = async () => {
                // Resolve font
                const fontOption =
                    allFonts.find(
                        (f) => f.id === borderTextFont || f.label === borderTextFont
                    ) || allFonts[0];
                if (!fontOption) return;

                // Load font (cached)
                if (!fontCacheRef.current[fontOption.id]) {
                    try {
                        fontCacheRef.current[fontOption.id] =
                            await load3DFont(fontOption);
                    } catch (err) {
                        console.error("[LithophaneFrame] Font load failed:", err);
                        return;
                    }
                }

                if (!active) return;

                const loadedFont = fontCacheRef.current[fontOption.id];
                const shapes = createTextShapesWithSpacing(
                    borderText,
                    loadedFont,
                    borderTextSize,
                    0
                );

                if (shapes.length === 0) {
                    setTextGeometry(null);
                    return;
                }

                // Extrude text
                const textGeo = new THREE.ExtrudeGeometry(shapes, {
                    depth: borderTextDepth,
                    bevelEnabled: false,
                    curveSegments: 4,
                });

                // Center the text geometry at its own origin
                textGeo.computeBoundingBox();
                const tBB = textGeo.boundingBox;
                const tcx = -(tBB.max.x + tBB.min.x) / 2;
                const tcy = -(tBB.max.y + tBB.min.y) / 2;
                textGeo.translate(tcx, tcy, 0);

                let merged = BufferGeometryUtils.mergeVertices(textGeo, 1e-6);
                if (merged.attributes.uv) merged.deleteAttribute("uv");
                merged.computeVertexNormals();

                if (!active) return;

                // ── Position text on the correct frame edge ──────────────────
                const bb = lithoBoundingBox;

                let padTop = frameWidth;
                let padBottom = frameWidth;
                let padLeft = frameWidth;
                let padRight = frameWidth;

                if (borderText && borderText.trim() !== "") {
                    const textSizePad = Math.max(frameWidth, borderTextSize + 4);
                    if (borderTextSide === "top") padTop = textSizePad;
                    else if (borderTextSide === "bottom") padBottom = textSizePad;
                    else if (borderTextSide === "left") padLeft = textSizePad;
                    else if (borderTextSide === "right") padRight = textSizePad;
                }

                const outerMinX = bb.min.x - padLeft;
                const outerMaxX = bb.max.x + padRight;
                const outerMinY = bb.min.y - padBottom;
                const outerMaxY = bb.max.y + padTop;
                const frameMidX = (outerMinX + outerMaxX) / 2;
                const frameMidY = (outerMinY + outerMaxY) / 2;

                // Text sits on the frame border midpoint, Z determined by mode
                const embossZ =
                    borderTextMode === "emboss" ? frameDepth : frameDepth - borderTextDepth;

                let pos = [0, 0, 0];

                switch (borderTextSide) {
                    case "top":
                        pos = [
                            frameMidX,
                            bb.max.y + padTop / 2,
                            embossZ,
                        ];
                        break;
                    case "bottom":
                        pos = [
                            frameMidX,
                            bb.min.y - padBottom / 2,
                            embossZ,
                        ];
                        break;
                    case "left":
                        // Rotate text 90° for vertical placement
                        merged.rotateZ(Math.PI / 2);
                        pos = [
                            bb.min.x - padLeft / 2,
                            frameMidY,
                            embossZ,
                        ];
                        break;
                    case "right":
                        merged.rotateZ(-Math.PI / 2);
                        pos = [
                            bb.max.x + padRight / 2,
                            frameMidY,
                            embossZ,
                        ];
                        break;
                    default:
                        pos = [frameMidX, bb.min.y - padBottom / 2, embossZ];
                }

                setTextGeometry(merged);
                setTextPosition(pos);
            };

            const timer = setTimeout(buildText, 100);
            return () => {
                active = false;
                clearTimeout(timer);
            };
        }, [
            borderText,
            borderTextFont,
            borderTextSize,
            borderTextDepth,
            borderTextSide,
            borderTextMode,
            lithoBoundingBox,
            frameWidth,
            frameDepth,
            allFonts,
        ]);

        // ── Render ───────────────────────────────────────────────────────────
        if (!frameGeometry) return null;

        const sanitizedFrameColor =
            color?.length > 7 ? color.substring(0, 7) : color;
        const sanitizedTextColor =
            borderTextColor?.length > 7
                ? borderTextColor.substring(0, 7)
                : borderTextColor;

        return (
            <group>
                {/* Frame + Keyring Boss */}
                <mesh
                    geometry={frameGeometry}
                    position={[0, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <meshStandardMaterial color={sanitizedFrameColor} />
                </mesh>

                {/* Border Text (separate mesh with its own color) */}
                {textGeometry && borderText && (
                    <mesh
                        geometry={textGeometry}
                        position={textPosition}
                        castShadow
                        receiveShadow
                    >
                        <meshStandardMaterial color={sanitizedTextColor} />
                    </mesh>
                )}
            </group>
        );
    }
);

LithophaneFrame.displayName = "LithophaneFrame";
export default LithophaneFrame;
