import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { offsetShapes, unionShapes } from "../../../utils/textContour";

/**
 * SmartBase — Contour-following base plate component.
 *
 * Receives raw 2D text shapes, unions them into solid polygons (filling letter
 * holes via Clipper), inflates by `padding`, and extrudes to `thickness`.
 *
 * Internalizes centering: computes the bounding box, translates geometry so the
 * center is at local origin, and reports the centerOffset back via
 * `onGeometryReady(geometry, boundingBox, centerOffset)` so sibling components
 * (SmartText3D, SmartKeyring) can align themselves.
 */
const SmartBase = React.memo(
    ({
        textShapes = [],
        thickness = 3,
        padding = 4,
        color = "#EC008C",
        onGeometryReady,
    }) => {
        const [geometry, setGeometry] = useState(null);

        // Store callback in ref to avoid stale closures without adding to deps
        const onGeometryReadyRef = useRef(onGeometryReady);
        useEffect(() => {
            onGeometryReadyRef.current = onGeometryReady;
        }, [onGeometryReady]);

        useEffect(() => {
            if (!textShapes || textShapes.length === 0) {
                setGeometry(null);
                onGeometryReadyRef.current?.(null, null, { cx: 0, cy: 0 });
                return;
            }

            // 1. Union all text outlines into solid contours (fills letter holes)
            const solidShapes = unionShapes(textShapes);

            // 2. Inflate contour by padding (Clipper jtRound offset)
            const baseShapes = offsetShapes(solidShapes, padding);

            // 3. Extrude into 3D geometry
            let baseGeo =
                baseShapes.length > 0
                    ? new THREE.ExtrudeGeometry(baseShapes, {
                          depth: thickness,
                          bevelEnabled: false,
                          curveSegments: 16,
                      })
                    : new THREE.BoxGeometry(20, 10, thickness);

            // 4. Push base down so top face rests at Z=0
            baseGeo.computeBoundingBox();
            baseGeo.translate(0, 0, -thickness);

            // 5. Merge vertices and strip UVs
            const merged = BufferGeometryUtils.mergeVertices(baseGeo);
            if (merged.attributes.uv) merged.deleteAttribute("uv");

            // 6. Center the geometry at local origin
            merged.computeBoundingBox();
            const bb = merged.boundingBox;
            const cx = -(bb.max.x + bb.min.x) / 2;
            const cy = -(bb.max.y + bb.min.y) / 2;
            merged.translate(cx, cy, 0);

            // 7. Compute final (centered) bounding box
            merged.computeBoundingBox();
            const centeredBB = merged.boundingBox.clone();

            setGeometry(merged);
            onGeometryReadyRef.current?.(merged, centeredBB, { cx, cy });
        }, [textShapes, thickness, padding]);

        if (!geometry) return null;

        const sanitizedColor =
            color?.length > 7 ? color.substring(0, 7) : color;

        return (
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial color={sanitizedColor} />
            </mesh>
        );
    },
);

SmartBase.displayName = "SmartBase";
export default SmartBase;
