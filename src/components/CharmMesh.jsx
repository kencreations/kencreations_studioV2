import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { getShapesFromIconify } from "../utils/iconifyLoader.js";
import { unionShapes, offsetShapes, createTextShapesWithSpacing } from "../utils/textContour";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { FONT_OPTIONS } from "../pages/KeychainEditor.jsx";

export default function CharmMesh({ charm }) {
    const {
        type = "icon",
        iconId,
        text,
        font: fontId,
        x = 0,
        y = 0,
        size,
        depth,
        baseOffset,
        baseHeight,
        baseColor,
        charmColor,
        holeOrientation,
        holeDiameter,
        holeCount = 1,
        holeDistance = 10,
        bubbleMode = false,
        bubbleSize = 2,
    } = charm;

    const baseRef = useRef();
    const [shapes, setShapes] = useState(null);

    // Fetch the 2D shapes (either from Iconify API or TTF Font)
    useEffect(() => {
        let active = true;
        setShapes(null); // Clear while loading new shapes

        async function fetchShapes() {
            if (type === "icon") {
                const s = await getShapesFromIconify(iconId, size);
                if (active) setShapes(s);
            } else if (type === "text") {
                const fontOption = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
                new TTFLoader().load(fontOption.url, (ttf) => {
                    if (!active) return;
                    const font = new FontLoader().parse(ttf);
                    const s = createTextShapesWithSpacing(text || " ", font, size, 0);
                    // Center the text shapes
                    if (s.length > 0) {
                        const tempGeo = new THREE.ShapeGeometry(s);
                        tempGeo.computeBoundingBox();
                        const bb = tempGeo.boundingBox;
                        const cx = (bb.max.x + bb.min.x) / 2;
                        const cy = (bb.max.y + bb.min.y) / 2;
                        
                        const centeredShapes = [];
                        for (const shape of s) {
                            const pts = shape.getPoints().map(p => new THREE.Vector2(p.x - cx, p.y - cy));
                            const newShape = new THREE.Shape(pts);
                            for (const hole of shape.holes) {
                                const hPts = hole.getPoints().map(p => new THREE.Vector2(p.x - cx, p.y - cy));
                                newShape.holes.push(new THREE.Path(hPts));
                            }
                            centeredShapes.push(newShape);
                        }
                        setShapes(centeredShapes);
                    } else {
                        setShapes(s);
                    }
                });
            }
        }
        fetchShapes();

        return () => {
            active = false;
        };
    }, [type, iconId, text, fontId, size]);

    // 1. Get inner charm geometry
    const { charmGeo, baseGeo } = useMemo(() => {
        if (!shapes || shapes.length === 0)
            return { charmGeo: null, baseGeo: null };

        // Extrude inner charm
        // In bubble mode, bevelThickness = depth/2 so the top surface is fully domed.
        // bevelSize rounds the silhouette edges inward.
        const clampedBevel = Math.min(bubbleSize, depth / 2 - 0.01);
        const cGeo = new THREE.ExtrudeGeometry(shapes, {
            depth: bubbleMode ? depth - clampedBevel : depth,
            bevelEnabled: bubbleMode,
            bevelThickness: bubbleMode ? clampedBevel : 0,
            bevelSize: bubbleMode ? clampedBevel : 0,
            bevelSegments: 12,
            curveSegments: 24,
        });

        // 2. Build base geometry via Clipper offset
        const solidShapes = unionShapes(shapes);
        const bShapes = offsetShapes(solidShapes, baseOffset);

        // Base always stays flat — only the charm gets the bubble/dome effect.
        let rawBase =
            bShapes.length > 0
                ? new THREE.ExtrudeGeometry(bShapes, {
                      depth: baseHeight,
                      bevelEnabled: false,
                      curveSegments: 24,
                  })
                : new THREE.BoxGeometry(size, size, baseHeight);

        // Position base correctly (shift Z down so charm sits on top)
        rawBase.translate(0, 0, -baseHeight);

        // 3. Cut paracord hole using CSG
        const csgEvaluator = new Evaluator();
        csgEvaluator.useGroups = false;

        let bGeo = BufferGeometryUtils.mergeVertices(rawBase);
        bGeo.computeVertexNormals();
        const baseMesh = new Brush(bGeo, new THREE.MeshBasicMaterial());

        const drillLength = size + baseOffset * 4;
        const drillRadius = holeDiameter / 2;

        const zOffset = -(baseHeight / 2); // middle of base
        const isHorizontal = holeOrientation === "horizontal";

        let finalBaseGeo;

        if (holeCount === 2) {
            // holeDistance is edge-to-edge gap; center-to-center = gap + diameter.
            // Subtract each cylinder separately — merging them first creates a
            // self-intersecting mesh that breaks the BVH CSG evaluator when the
            // cylinders overlap (negative gap / Venn-diagram mode).
            const centerToCenterDist = holeDistance + holeDiameter;
            const halfDist = centerToCenterDist / 2;

            const makeDrill = (offset) => {
                const cyl = new THREE.CylinderGeometry(drillRadius, drillRadius, drillLength, 32);
                const drill = new Brush(cyl, new THREE.MeshBasicMaterial());
                if (isHorizontal) {
                    drill.rotation.z = Math.PI / 2;
                    drill.position.set(0, offset, zOffset);
                } else {
                    drill.position.set(offset, 0, zOffset);
                }
                drill.updateMatrixWorld(true);
                return drill;
            };

            baseMesh.updateMatrixWorld(true);
            const after1 = csgEvaluator.evaluate(baseMesh, makeDrill(halfDist), SUBTRACTION);
            after1.updateMatrixWorld(true);
            const finalBase = csgEvaluator.evaluate(after1, makeDrill(-halfDist), SUBTRACTION);
            finalBaseGeo = finalBase.geometry;
        } else {
            // Single hole
            const cyl = new THREE.CylinderGeometry(drillRadius, drillRadius, drillLength, 32);
            const drillMesh = new Brush(cyl, new THREE.MeshBasicMaterial());
            if (isHorizontal) {
                drillMesh.rotation.z = Math.PI / 2;
                drillMesh.position.set(0, 0, zOffset);
            } else {
                drillMesh.position.set(0, 0, zOffset);
            }
            drillMesh.updateMatrixWorld(true);
            baseMesh.updateMatrixWorld(true);
            const finalBase = csgEvaluator.evaluate(baseMesh, drillMesh, SUBTRACTION);
            finalBaseGeo = finalBase.geometry;
        }

        // Clean up UVs for 3MF exporter
        if (finalBaseGeo.attributes.uv) {
            finalBaseGeo.deleteAttribute("uv");
        }
        if (cGeo.attributes.uv) {
            cGeo.deleteAttribute("uv");
        }

        return { charmGeo: cGeo, baseGeo: finalBaseGeo };
    }, [shapes, depth, baseOffset, baseHeight, holeOrientation, holeDiameter, holeCount, holeDistance, size, bubbleMode, bubbleSize]);


    if (!charmGeo || !baseGeo) return null;

    return (
        <group position={[x, y, 0]} ref={baseRef}>
            {/* Base (with paracord hole) */}
            <mesh geometry={baseGeo} name="charmBase">
                <meshStandardMaterial color={baseColor} />
            </mesh>

            {/* Inner Charm / Text */}
            <mesh geometry={charmGeo} name="charmInner">
                <meshStandardMaterial color={charmColor} />
            </mesh>
        </group>
    );
}
