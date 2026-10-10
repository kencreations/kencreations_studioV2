import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

/**
 * SmartArt3D — Vector art equivalent of SmartText3D.
 *
 * Takes pre-computed shapes (e.g. from an SVG), extrudes them into 3D geometry,
 * and aligns them with the centerOffset provided by SmartCSGBase.
 */
const SmartArt3D = React.memo(
    ({
        shapes,
        depth = 1,
        color = "#ffffff",
        centerOffset = null,
        onShapesReady,
    }) => {
        const onShapesReadyRef = useRef(onShapesReady);
        useEffect(() => {
            onShapesReadyRef.current = onShapesReady;
        }, [onShapesReady]);

        useEffect(() => {
            if (shapes && shapes.length > 0) {
                onShapesReadyRef.current?.(shapes);
            } else {
                onShapesReadyRef.current?.([]);
            }
        }, [shapes]);

        const geometry = useMemo(() => {
            if (!shapes || shapes.length === 0) return null;
            return new THREE.ExtrudeGeometry(shapes, {
                depth,
                bevelEnabled: false,
            });
        }, [shapes, depth]);

        if (!geometry) return null;

        return (
            <mesh
                geometry={geometry}
                position={[
                    centerOffset?.cx || 0,
                    centerOffset?.cy || 0,
                    0
                ]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color={color} />
            </mesh>
        );
    }
);

export default SmartArt3D;
