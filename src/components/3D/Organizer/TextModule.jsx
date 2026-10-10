import React, { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Evaluator, Brush, ADDITION } from "three-bvh-csg";
import { getCached3DFont } from "../../../utils/fontManager";

export default function TextModule({ config, pegHeight, pegLocalPositions = [] }) {
    const [font1, setFont1] = useState(null);
    const [font2, setFont2] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const loadFontSafely = async (fontName, setFontState) => {
            if (!fontName) return;
            try {
                let safeFontName = fontName;
                if (!safeFontName.includes('.')) safeFontName = `/src/assets/fonts/${fontName}.ttf`;
                const font = await getCached3DFont({ url: safeFontName, id: fontName });
                if (isMounted) setFontState(font);
            } catch (error) {
                try {
                    const fallback = await getCached3DFont({ url: "/src/assets/fonts/ARIAL.ttf", id: "ARIAL" });
                    if (isMounted) setFontState(fallback);
                } catch (e) {}
            }
        };
        loadFontSafely(config.line1Font, setFont1);
        loadFontSafely(config.line2Font, setFont2);
        return () => { isMounted = false; };
    }, [config.line1Font, config.line2Font]);

    const layout = useMemo(() => {
        // Line 2 is always required; Line 1 is optional
        if (!font2 || !config.line2Text) return null;
        const hasLine1 = !!font1 && !!config.line1Text;

        const safeTextDepth = Number(config.textDepth) || 2;
        const safeBackingDepth = Number(config.backingDepth) || 4;
        const safeBackingPad = Number(config.textBackingPad) || 1;
        const line1OffsetX = Number(config.line1OffsetX) || 0;
        const lineSpacing = Number(config.lineSpacing) || 0;
        const textAlign = config.textAlign || "center";

        // ─── HELPER: Compute 2D bounding box of raw font shapes ─────────────
        const getShapesBounds = (shapes) => {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            shapes.forEach(shape => {
                const pts = shape.getPoints(30);
                pts.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                });
            });
            return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
        };

        // ─── HELPER: Create a perfectly rounded pill shape ───────────────────
        const createPill = (w, h) => {
            let r = Math.min(w / 2, h / 2);
            if (r < 0.01) r = 0.01;
            const s = new THREE.Shape();
            const hw = w / 2, hh = h / 2;
            s.moveTo(-hw + r, -hh);
            s.lineTo(hw - r, -hh);
            s.quadraticCurveTo(hw, -hh, hw, -hh + r);
            s.lineTo(hw, hh - r);
            s.quadraticCurveTo(hw, hh, hw - r, hh);
            s.lineTo(-hw + r, hh);
            s.quadraticCurveTo(-hw, hh, -hw, hh - r);
            s.lineTo(-hw, -hh + r);
            s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
            return s;
        };

        // ─── 1. GENERATE SHAPES ──────────────────────────────────────────────
        const fgShapes2 = font2.generateShapes(config.line2Text, Number(config.line2Size));
        const bgShapes2 = font2.generateShapes(config.line2Text, Number(config.line2Size));
        bgShapes2.forEach(shape => { shape.holes = []; });
        const bounds2 = getShapesBounds(bgShapes2);

        let fgShapes1, bgShapes1, bounds1;
        if (hasLine1) {
            fgShapes1 = font1.generateShapes(config.line1Text, Number(config.line1Size));
            bgShapes1 = font1.generateShapes(config.line1Text, Number(config.line1Size));
            bgShapes1.forEach(shape => { shape.holes = []; });
            bounds1 = getShapesBounds(bgShapes1);
        }

        // ─── 2. EXTRUDE FOREGROUND (crisp, no bevel) ─────────────────────────
        const fg2 = new THREE.ExtrudeGeometry(fgShapes2, { depth: safeTextDepth, bevelEnabled: false, curveSegments: 6 });
        let fg1;
        if (hasLine1) {
            fg1 = new THREE.ExtrudeGeometry(fgShapes1, { depth: safeTextDepth, bevelEnabled: false, curveSegments: 6 });
        }

        // ─── 3. EXTRUDE BACKING (flat bevel for contour expansion) ───────────
        const bevelOpts = {
            depth: safeBackingDepth, bevelEnabled: true,
            bevelThickness: 0.001, bevelSize: safeBackingPad,
            bevelSegments: 1, curveSegments: 6
        };
        const bg2 = new THREE.ExtrudeGeometry(bgShapes2, bevelOpts);
        let bg1;
        if (hasLine1) {
            bg1 = new THREE.ExtrudeGeometry(bgShapes1, bevelOpts);
        }

        // ─── 4. CREATE INVISIBLE ORGANIC GAP-FILLERS (Pills) ─────────────────
        // Highly rounded and scaled down so they act as internal bones connecting the letters,
        // rather than protruding rectangles.
        const coreDepth = Math.max(safeBackingDepth - 0.05, 0.1);
        
        const core2W = Math.max(bounds2.width * 0.85, 2);
        const core2H = Math.max(bounds2.height * 0.4, 2);
        const core2Shape = createPill(core2W, core2H);
        const core2 = new THREE.ExtrudeGeometry(core2Shape, { depth: coreDepth, bevelEnabled: false });
        core2.translate(bounds2.cx, bounds2.cy, 0.025);

        let core1;
        if (hasLine1) {
            const core1W = Math.max(bounds1.width * 0.85, 2);
            const core1H = Math.max(bounds1.height * 0.4, 2);
            const core1Shape = createPill(core1W, core1H);
            core1 = new THREE.ExtrudeGeometry(core1Shape, { depth: coreDepth, bevelEnabled: false });
            core1.translate(bounds1.cx, bounds1.cy, 0.025);
        }

        // ─── 5. CENTER X INDEPENDENTLY ───────────────────────────────────────
        const allGeos = hasLine1 ? [fg1, fg2, bg1, bg2, core1, core2] : [fg2, bg2, core2];
        allGeos.forEach(geo => {
            geo.computeBoundingBox();
            const offsetX = -(geo.boundingBox.max.x + geo.boundingBox.min.x) / 2;
            geo.translate(offsetX, 0, 0);
        });

        // ─── 6. STACK LINE 1 ABOVE LINE 2 & APPLY TEXT ALIGNMENT ─────────────
        let shiftX = 0;
        let yShift1 = 0;
        let bridgeX = 0;

        if (hasLine1) {
            bg2.computeBoundingBox();
            const h2 = bg2.boundingBox.max.y - bg2.boundingBox.min.y;
            const overlap = h2 * 0.15;
            yShift1 = h2 - overlap + lineSpacing;

            const w1 = bounds1.width;
            const w2 = bounds2.width;

            if (textAlign === "left") {
                shiftX = (-w2 / 2) - (-w1 / 2);
            } else if (textAlign === "right") {
                shiftX = (w2 / 2) - (w1 / 2);
            }
            // Add custom offset
            shiftX += line1OffsetX;

            [fg1, bg1, core1].forEach(geo => geo.translate(shiftX, yShift1, 0));

            // Find intersection for the vertical bridge
            const minX1 = shiftX - w1 / 2;
            const maxX1 = shiftX + w1 / 2;
            const minX2 = -w2 / 2;
            const maxX2 = w2 / 2;
            const overlapMinX = Math.max(minX1, minX2);
            const overlapMaxX = Math.min(maxX1, maxX2);

            if (overlapMinX <= overlapMaxX) {
                bridgeX = (overlapMinX + overlapMaxX) / 2;
            } else {
                bridgeX = shiftX / 2; // Default to midway if no overlap
            }
        }

        // ─── 7. CSG BOOLEAN WELDING ──────────────────────────────────────────
        const evaluator = new Evaluator();

        let result = new Brush(bg2);
        result.updateMatrixWorld();

        const addBrush = (geo) => {
            const brush = new Brush(geo);
            brush.updateMatrixWorld();
            result = evaluator.evaluate(result, brush, ADDITION);
        };

        addBrush(core2);

        if (hasLine1) {
            addBrush(bg1);
            addBrush(core1);

            // Organic vertical bridge
            core2.computeBoundingBox();
            core1.computeBoundingBox();
            const bridgeBottom = core2.boundingBox.max.y;
            const bridgeTop = core1.boundingBox.min.y;
            const bridgeMidY = (bridgeTop + bridgeBottom) / 2;
            const bridgeHeight = Math.abs(bridgeTop - bridgeBottom) + 4; // overlap

            if (bridgeHeight > 0.5) {
                const bridgeW = 8; // Constrained hidden width
                const bridgeShape = createPill(bridgeW, bridgeHeight);
                const bridge = new THREE.ExtrudeGeometry(bridgeShape, { depth: coreDepth, bevelEnabled: false });
                bridge.translate(bridgeX, bridgeMidY, 0.025);
                addBrush(bridge);
            }
        }

        const finalBgGeo = result.geometry;

        // ─── 8. ABSOLUTE GROUNDING ───────────────────────────────────────────
        finalBgGeo.computeBoundingBox();
        const offsetY = -finalBgGeo.boundingBox.min.y;
        const centerZ = -(finalBgGeo.boundingBox.max.z + finalBgGeo.boundingBox.min.z) / 2;

        finalBgGeo.translate(0, offsetY, centerZ);
        finalBgGeo.computeBoundingBox();

        // ─── 9. PUSH FOREGROUND TEXT flush onto front face ───────────────────
        const frontZ = finalBgGeo.boundingBox.max.z;
        const fgGeos = hasLine1 ? [fg1, fg2] : [fg2];
        fgGeos.forEach(geo => {
            geo.translate(0, offsetY, centerZ);
            geo.computeBoundingBox();
            geo.translate(0, 0, frontZ - geo.boundingBox.min.z);
        });

        return { finalBgGeo, fg1: fg1 || null, fg2 };
    }, [font1, font2, config]);

    // Peg extends 2mm deeper for strong mechanical bond inside the text backing
    const pegGeo = useMemo(() => new THREE.CylinderGeometry(3.8, 3.8, pegHeight + 2, 16), [pegHeight]);

    if (!layout) return null;

    const backingColor = config.backingColor || config.baseColor;

    return (
        <group>
            {/* ── CSG-Welded Backing Slab (single manifold mesh) ── */}
            <mesh geometry={layout.finalBgGeo} castShadow receiveShadow>
                <meshStandardMaterial color={backingColor} />
            </mesh>

            {/* ── Crisp White Foreground Text ── */}
            {layout.fg1 && (
                <mesh geometry={layout.fg1} castShadow receiveShadow>
                    <meshStandardMaterial color={config.textColor || "#ffffff"} />
                </mesh>
            )}
            <mesh geometry={layout.fg2} castShadow receiveShadow>
                <meshStandardMaterial color={config.textColor || "#ffffff"} />
            </mesh>

            {/* ── Pegs (extend into negative Y for baseplate snap-fit) ── */}
            {pegLocalPositions.map((pos, i) => (
                <mesh key={`peg-${i}`} position={[pos.x, -(pegHeight / 2) + 1, pos.z]} castShadow>
                    <primitive object={pegGeo.clone()} attach="geometry" />
                    <meshStandardMaterial color={backingColor} />
                </mesh>
            ))}
        </group>
    );
}
