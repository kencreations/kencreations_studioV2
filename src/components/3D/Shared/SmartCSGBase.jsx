import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { offsetShapes, unionShapes } from "../../../utils/textContour";
import CsgWorker from "../../../engine/workers/csg.worker.js?worker";

const csgWorker = new CsgWorker();
let messageId = 0;
const pendingCSG = new Map();

csgWorker.onmessage = (e) => {
    if (e.data.type === "result" || e.data.type === "error") {
        const resolve = pendingCSG.get(e.data.id);
        if (resolve) {
            resolve(e.data);
            pendingCSG.delete(e.data.id);
        }
    }
};

csgWorker.onerror = (err) => {
    console.error(
        "CSG Worker failed to load or threw a fatal error:",
        err.message,
    );
    if (!window.hasAlertedCSG) {
        alert("Worker Fatal Error: " + err.message);
        window.hasAlertedCSG = true;
    }
};

function computeCSGAsync(position, index, params) {
    return new Promise((resolve) => {
        const id = messageId++;
        pendingCSG.set(id, resolve);

        const posCopy = position.slice();
        const idxCopy = index ? index.slice() : null;

        csgWorker.postMessage({
            type: "computeCSG",
            id,
            position: posCopy,
            index: idxCopy,
            params,
        });
    });
}

/**
 * SmartCSGBase — Contour-following base plate component with CSG hole drilling.
 *
 * Internally computes the bounding box, drills holes via CSG worker, centers the geometry
 * at the local origin, and reports the centerOffset back via
 * `onGeometryReady(geometry, boundingBox, centerOffset)`.
 */
const SmartCSGBase = React.memo(
    ({
        textShapes = [],
        thickness = 3,
        padding = 4,
        color = "#EC008C",
        holeCount = 1,
        holeDiameter = 4,
        holeOrientation = "horizontal",
        holeShape = "cylinder",
        holeDistance = 4,
        holeXOffset = 0,
        holeYOffset = 0,
        holeZOffset,
        slotLength = 15,
        customGeometry = null,
        disableAutoCenter = false,
        onGeometryReady,
    }) => {
        const [geometry, setGeometry] = useState(null);

        // Store callback in ref to avoid stale closures without adding to deps
        const onGeometryReadyRef = useRef(onGeometryReady);
        useEffect(() => {
            onGeometryReadyRef.current = onGeometryReady;
        }, [onGeometryReady]);

        const rawBaseGeo = useMemo(() => {
            if (customGeometry) {
                const geo = customGeometry.clone();
                geo.computeBoundingBox();
                const bb = geo.boundingBox;
                const cx = -(bb.max.x + bb.min.x) / 2;
                const cy = -(bb.max.y + bb.min.y) / 2;
                
                let merged = BufferGeometryUtils.mergeVertices(geo, 1e-6);
                if (merged.attributes.uv) merged.deleteAttribute("uv");
                merged.computeVertexNormals();
                return { geo: merged, cx, cy };
            }

            if (!textShapes || textShapes.length === 0) return null;

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

            // Center the geometry at local origin (X, Y) and Z
            baseGeo.computeBoundingBox();
            const bb = baseGeo.boundingBox;
            const cx = -(bb.max.x + bb.min.x) / 2;
            const cy = -(bb.max.y + bb.min.y) / 2;
            baseGeo.translate(cx, cy, -thickness);

            let merged = BufferGeometryUtils.mergeVertices(baseGeo, 1e-6);
            if (merged.attributes.uv) merged.deleteAttribute("uv");
            merged.computeVertexNormals();

            return { geo: merged, cx, cy };
        }, [textShapes, thickness, padding, customGeometry]);

        useEffect(() => {
            if (!rawBaseGeo) {
                setGeometry(null);
                onGeometryReadyRef.current?.(null, null, { cx: 0, cy: 0 });
                return;
            }

            let active = true;

            async function doCSG() {
                try {
                    const result = await computeCSGAsync(
                        rawBaseGeo.geo.attributes.position.array,
                        rawBaseGeo.geo.index
                            ? rawBaseGeo.geo.index.array
                            : null,
                        {
                            size: 20, // arbitrary, used as fallback in CSG logic if needed
                            baseOffset: padding,
                            baseHeight: thickness,
                            holeOrientation,
                            holeDiameter,
                            holeCount,
                            holeDistance,
                            holeXOffset,
                            holeYOffset,
                            holeZOffset: holeZOffset !== undefined ? holeZOffset : (disableAutoCenter ? 0 : -thickness / 2),
                            holeShape,
                            slotLength,
                        },
                    );

                    if (!active) return;

                    if (result.type === "result") {
                        const finalGeo = new THREE.BufferGeometry();
                        finalGeo.setAttribute(
                            "position",
                            new THREE.BufferAttribute(result.position, 3),
                        );
                        if (result.normal)
                            finalGeo.setAttribute(
                                "normal",
                                new THREE.BufferAttribute(result.normal, 3),
                            );
                        if (result.index)
                            finalGeo.setIndex(
                                new THREE.BufferAttribute(result.index, 1),
                            );

                        finalGeo.computeBoundingBox();
                        const bb = finalGeo.boundingBox;
                        let tX = 0, tY = 0, tZ = 0;
                        if (!disableAutoCenter) {
                            tX = -(bb.max.x + bb.min.x) / 2;
                            tY = -(bb.max.y + bb.min.y) / 2;
                            tZ = -bb.max.z; // Forces top face to Z=0
                        }
                        finalGeo.translate(tX, tY, tZ);
                        finalGeo.computeBoundingBox();
                        const centeredBB = finalGeo.boundingBox.clone();

                        setGeometry(finalGeo);
                        onGeometryReadyRef.current?.(finalGeo, centeredBB, {
                            cx: rawBaseGeo.cx,
                            cy: rawBaseGeo.cy,
                        });
                    } else {
                        // Fallback to raw base if CSG fails
                        const fallbackGeo = rawBaseGeo.geo.clone();
                        fallbackGeo.computeBoundingBox();
                        if (!disableAutoCenter) {
                            const fBB = fallbackGeo.boundingBox;
                            const ftX = -(fBB.max.x + fBB.min.x) / 2;
                            const ftY = -(fBB.max.y + fBB.min.y) / 2;
                            const ftZ = -fBB.max.z;
                            fallbackGeo.translate(ftX, ftY, ftZ);
                            fallbackGeo.computeBoundingBox();
                        }

                        setGeometry(fallbackGeo);
                        onGeometryReadyRef.current?.(
                            fallbackGeo,
                            fallbackGeo.boundingBox.clone(),
                            { cx: rawBaseGeo.cx, cy: rawBaseGeo.cy },
                        );
                    }
                } catch (err) {
                    console.error("CSG Worker Error", err);
                    if (active) {
                        const fallbackGeo = rawBaseGeo.geo.clone();
                        fallbackGeo.computeBoundingBox();
                        if (!disableAutoCenter) {
                            const fBB = fallbackGeo.boundingBox;
                            const ftX = -(fBB.max.x + fBB.min.x) / 2;
                            const ftY = -(fBB.max.y + fBB.min.y) / 2;
                            const ftZ = -fBB.max.z;
                            fallbackGeo.translate(ftX, ftY, ftZ);
                            fallbackGeo.computeBoundingBox();
                        }

                        setGeometry(fallbackGeo);
                        onGeometryReadyRef.current?.(
                            fallbackGeo,
                            fallbackGeo.boundingBox.clone(),
                            { cx: rawBaseGeo.cx, cy: rawBaseGeo.cy },
                        );
                    }
                }
            }

            doCSG();

            return () => {
                active = false;
            };
        }, [
            rawBaseGeo,
            thickness,
            padding,
            holeCount,
            holeDiameter,
            holeOrientation,
            holeShape,
            holeDistance,
            holeXOffset,
            holeYOffset,
            holeZOffset,
            slotLength,
            disableAutoCenter
        ]);

        if (!geometry) return null;

        const sanitizedColor =
            color?.length > 7 ? color.substring(0, 7) : color;

        return (
            <mesh
                geometry={geometry}
                position={[0, 0, 0]}
                castShadow
                receiveShadow>
                <meshStandardMaterial color={sanitizedColor} />
            </mesh>
        );
    },
);

SmartCSGBase.displayName = "SmartCSGBase";
export default SmartCSGBase;
