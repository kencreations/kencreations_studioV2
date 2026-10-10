import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { load3DFont } from "../../../utils/fontManager";
import { createTextShapesWithSpacing } from "../../../utils/textContour";
import { useProfile } from "../../../contexts/ProfileContext";

/**
 * SmartText3D — Self-contained 3D text mesh component.
 *
 * Handles its own async font loading, caching, shape generation, and geometry
 * extrusion. Reports raw 2D shapes via `onShapesReady` for SmartBase consumption.
 * Accepts `centerOffset` from SmartBase to align itself with the centered base.
 *
 * Does NOT rebuild geometry when centerOffset changes — only repositions the mesh.
 */
const SmartText3D = React.memo(
    ({
        text,
        fontId,
        size = 20,
        depth = 2,
        offsetX = 0,
        offsetY = 0,
        offsetZ = 0,
        bubbleMode = false,
        bubbleSize = 2,
        color = "#ffffff",
        centerOffset = null,
        onShapesReady,
        onGeometryReady,
    }) => {
        const { allFonts } = useProfile();
        const fontCacheRef = useRef({});
        const [geometry, setGeometry] = useState(null);

        // Store callbacks in refs to avoid stale closures without adding to deps
        const onShapesReadyRef = useRef(onShapesReady);
        const onGeometryReadyRef = useRef(onGeometryReady);
        useEffect(() => {
            onShapesReadyRef.current = onShapesReady;
        }, [onShapesReady]);
        useEffect(() => {
            onGeometryReadyRef.current = onGeometryReady;
        }, [onGeometryReady]);

        const translateShape2D = useCallback((shape, dx, dy) => {
            const translatedOuter = shape
                .getPoints(16)
                .map((p) => new THREE.Vector2(p.x + dx, p.y + dy));
            const translatedShape = new THREE.Shape(translatedOuter);

            for (const hole of shape.holes) {
                const translatedHole = hole
                    .getPoints(16)
                    .map((p) => new THREE.Vector2(p.x + dx, p.y + dy));
                translatedShape.holes.push(new THREE.Path(translatedHole));
            }

            return translatedShape;
        }, []);

        useEffect(() => {
            let active = true;

            const build = async () => {
                const fontOption =
                    allFonts.find(
                        (f) => f.id === fontId || f.label === fontId,
                    ) || allFonts[0];

                if (!fontOption) return;

                if (!fontCacheRef.current[fontOption.id]) {
                    try {
                        fontCacheRef.current[fontOption.id] =
                            await load3DFont(fontOption);
                    } catch (err) {
                        console.error("[SmartText3D] Font load failed:", err);
                        return;
                    }
                }

                if (!active) return;

                const loadedFont = fontCacheRef.current[fontOption.id];
                const shapes = createTextShapesWithSpacing(
                    text || "",
                    loadedFont,
                    size,
                    0,
                ).map((shape) => translateShape2D(shape, offsetX, offsetY));

                if (shapes.length === 0) {
                    setGeometry(null);
                    onShapesReadyRef.current?.([]);
                    return;
                }

                // Fire shapes callback for SmartBase consumption
                onShapesReadyRef.current?.(shapes);

                // Build 3D geometry
                const clampedBevel = Math.min(bubbleSize, depth / 2 - 0.01);
                const extruded = new THREE.ExtrudeGeometry(shapes, {
                    depth: bubbleMode ? depth - clampedBevel : depth,
                    bevelEnabled: bubbleMode,
                    bevelThickness: bubbleMode ? clampedBevel : 0,
                    bevelSize: bubbleMode ? clampedBevel : 0,
                    bevelSegments: 4,
                    curveSegments: bubbleMode ? 6 : 4,
                });
                const merged = BufferGeometryUtils.mergeVertices(extruded);
                if (merged.attributes.uv) merged.deleteAttribute("uv");


                setGeometry(merged);
                onGeometryReadyRef.current?.(merged);
            };

            const handler = setTimeout(build, 100);
            return () => {
                active = false;
                clearTimeout(handler);
            };
        }, [text, fontId, size, depth, offsetX, offsetY, allFonts, translateShape2D, bubbleMode, bubbleSize]);

        if (!geometry) return null;

        const sanitizedColor =
            color?.length > 7 ? color.substring(0, 7) : color;
        const cx = centerOffset?.cx || 0;
        const cy = centerOffset?.cy || 0;

        return (
            <mesh
                geometry={geometry}
                position={[cx, cy, offsetZ || 0]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color={sanitizedColor} />
            </mesh>
        );
    },
);

SmartText3D.displayName = "SmartText3D";
export default SmartText3D;
