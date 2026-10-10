import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * SmartKeyring — Ring-with-hole mesh using native THREE.Shape holes.
 *
 * Anchors to the top-left corner of the base's (centered) bounding box.
 * The anchor math simplifies to:
 *   translateX = baseBoundingBox.min.x + offsetX
 *   translateY = baseBoundingBox.max.y + offsetY
 *
 * This works because SmartBase already centers its geometry, so the centered
 * bounding box directly gives us the correct anchor coordinates — no need
 * to un-center and re-center like the previous implementation.
 */
const SmartKeyring = React.memo(
    ({
        enabled = false,
        diameter = 10,
        holeDiameter = 4,
        thickness = 3,
        baseBoundingBox = null,
        offsetX = 0,
        offsetY = 0,
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
            if (!enabled || !baseBoundingBox) {
                setGeometry(null);
                onGeometryReadyRef.current?.(null);
                return;
            }

            // 1. Build ring shape with a boolean hole via native THREE.Shape
            const ringShape = new THREE.Shape();
            ringShape.absarc(
                0,
                0,
                diameter / 2,
                0,
                Math.PI * 2,
                false, // CCW for outer contour
            );

            const hole = new THREE.Path();
            hole.absarc(
                0,
                0,
                holeDiameter / 2,
                0,
                Math.PI * 2,
                true, // CW for inner hole
            );
            ringShape.holes.push(hole);

            // 2. Extrude the ring (high curveSegments for smooth circles)
            const ringGeo = new THREE.ExtrudeGeometry(ringShape, {
                depth: thickness,
                bevelEnabled: false,
                curveSegments: 32,
            });

            // 3. Anchor to top-left of base + user offset
            //    baseBoundingBox is already in centered space, so these
            //    coordinates directly give us the correct anchor position.
            const anchorX = baseBoundingBox.min.x;
            const anchorY = baseBoundingBox.max.y;

            ringGeo.translate(
                anchorX + offsetX,
                anchorY + offsetY,
                -thickness,
            );

            // 4. Merge vertices and strip UVs
            const merged = BufferGeometryUtils.mergeVertices(ringGeo);
            if (merged.attributes.uv) merged.deleteAttribute("uv");

            setGeometry(merged);
            onGeometryReadyRef.current?.(merged);
        }, [
            enabled,
            diameter,
            holeDiameter,
            thickness,
            baseBoundingBox,
            offsetX,
            offsetY,
        ]);

        if (!enabled || !geometry) return null;

        const sanitizedColor =
            color?.length > 7 ? color.substring(0, 7) : color;

        return (
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial color={sanitizedColor} />
            </mesh>
        );
    },
);

SmartKeyring.displayName = "SmartKeyring";
export default SmartKeyring;
