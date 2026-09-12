import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { getShapesFromIconify } from "../utils/iconifyLoader.js";
import { unionShapes, offsetShapes, createTextShapesWithSpacing } from "../utils/textContour";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { BUNDLED_FONTS } from "../utils/fontManager.js";
import CsgWorker from "../engine/workers/csg.worker.js?worker";

const csgWorker = new CsgWorker();
let messageId = 0;
const pendingCSG = new Map();

csgWorker.onmessage = (e) => {
    if (e.data.type === 'result' || e.data.type === 'error') {
        const resolve = pendingCSG.get(e.data.id);
        if (resolve) {
            resolve(e.data);
            pendingCSG.delete(e.data.id);
        }
    }
};

csgWorker.onerror = (err) => {
    console.error("CSG Worker failed to load or threw a fatal error:", err.message);
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
            type: 'computeCSG',
            id,
            position: posCopy,
            index: idxCopy,
            params
        });
    });
}

import { useProfile } from "../contexts/ProfileContext";

export default function CharmMesh({ charm }) {
    const { allFonts = [] } = useProfile();
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
        holeYOffset = 0,
        holeZOffset = 0,
        holeShape = "cylinder",
        strapWidth = 10,
        strapThickness = 2.5,
        enableBase = true,
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
                const fallbackFonts = allFonts.length > 0 ? allFonts : BUNDLED_FONTS;
                const fontOption = fallbackFonts.find((f) => f.id === fontId || f.label === fontId) || fallbackFonts[0];
                if (!fontOption) return;
                
                new TTFLoader().load(fontOption.url || fontOption.file_path, (ttf) => {
                    if (!active) return;
                    const font = new FontLoader().parse(ttf);
                    const s = font.generateShapes(text || " ", size);
                    setShapes(s);
                });
            }
        }
        fetchShapes();

        return () => {
            active = false;
        };
    }, [type, iconId, text, fontId, size, allFonts]);

    const centerOffset = useMemo(() => {
        if (!shapes || shapes.length === 0) return { cx: 0, cy: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shapes.forEach(shape => {
            const pts = shape.getPoints(16);
            pts.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
        });
        return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    }, [shapes]);

    const charmGeo = useMemo(() => {
        if (!shapes || shapes.length === 0) return null;

        const clampedBevel = Math.min(bubbleSize, depth / 2 - 0.01);
        const cGeo = new THREE.ExtrudeGeometry(shapes, {
            depth: bubbleMode ? depth - clampedBevel : depth,
            bevelEnabled: bubbleMode,
            bevelThickness: bubbleMode ? clampedBevel : 0,
            bevelSize: bubbleMode ? clampedBevel : 0,
            bevelSegments: 4,
            curveSegments: 6,
        });
        cGeo.translate(-centerOffset.cx, -centerOffset.cy, 0);

        if (cGeo.attributes.uv) cGeo.deleteAttribute("uv");
        
        let mergedGeo = BufferGeometryUtils.mergeVertices(cGeo, 1e-6);
        mergedGeo.computeVertexNormals();
        return mergedGeo;
    }, [shapes, depth, bubbleMode, bubbleSize, centerOffset]);

    const rawBaseGeo = useMemo(() => {
        if (!shapes || shapes.length === 0) return null;
        const solidShapes = unionShapes(shapes);
        const bShapes = offsetShapes(solidShapes, baseOffset);
        let rawBase = bShapes.length > 0
            ? new THREE.ExtrudeGeometry(bShapes, { depth: baseHeight, bevelEnabled: false, curveSegments: 8 })
            : new THREE.BoxGeometry(size, size, baseHeight);

        // Center the base in XY, and center it in Z so it goes from -baseHeight/2 to +baseHeight/2
        rawBase.translate(-centerOffset.cx, -centerOffset.cy, -baseHeight / 2);
        let bGeo = BufferGeometryUtils.mergeVertices(rawBase, 1e-6);
        bGeo.computeVertexNormals();
        return bGeo;
    }, [shapes, baseOffset, baseHeight, size, centerOffset]);

    const [csgBaseGeo, setCsgBaseGeo] = useState(null);

    useEffect(() => {
        const targetGeo = enableBase ? rawBaseGeo : charmGeo;
        if (!targetGeo) {
            setCsgBaseGeo(null);
            return;
        }

        let active = true;
        setCsgBaseGeo(null); // Revert to fake hole preview while computing

        async function doCSG() {
            window.dispatchEvent(new CustomEvent('csg-compute-start'));
            try {
                const result = await computeCSGAsync(
                    targetGeo.attributes.position.array,
                    targetGeo.index ? targetGeo.index.array : null,
                    { size, baseOffset, baseHeight, holeOrientation, holeDiameter, holeCount, holeDistance, holeYOffset, holeZOffset, holeShape, strapWidth, strapThickness }
                );
                
                if (!active) return;
                
                if (result.type === 'result') {
                    const finalGeo = new THREE.BufferGeometry();
                    finalGeo.setAttribute('position', new THREE.BufferAttribute(result.position, 3));
                    if (result.normal) finalGeo.setAttribute('normal', new THREE.BufferAttribute(result.normal, 3));
                    if (result.index) finalGeo.setIndex(new THREE.BufferAttribute(result.index, 1));
                    setCsgBaseGeo(finalGeo);
                } else if (result.type === 'error') {
                    console.error("CSG Worker internal error:", result.error);
                    // Instead of a main-thread fallback that freezes the UI, 
                    // we just fail gracefully and render the uncut geometry.
                    setCsgBaseGeo(null);
                }
            } catch (err) {
                console.error("CSG Worker Error", err);
            } finally {
                window.dispatchEvent(new CustomEvent('csg-compute-end'));
            }
        }
        
        doCSG();
        
        return () => { active = false; };
    }, [rawBaseGeo, charmGeo, enableBase, size, baseOffset, baseHeight, holeOrientation, holeDiameter, holeCount, holeDistance, holeYOffset, holeZOffset, holeShape, strapWidth, strapThickness]);

    if (!charmGeo || !rawBaseGeo) return null;

    const activeBaseGeo = csgBaseGeo || rawBaseGeo;
    const isHorizontal = holeOrientation === "horizontal";
    const drillLength = 2000;
    const drillRadius = holeDiameter / 2;
    const zOffset = holeZOffset || 0;
    const halfDist = (holeDistance + holeDiameter) / 2;

    return (
        <group position={[x, y, 0]} ref={baseRef}>
            {/* Base */}
            {enableBase && (
                <mesh geometry={activeBaseGeo} name="charmBase">
                    <meshStandardMaterial color={baseColor} />
                </mesh>
            )}

            {/* Inner Charm / Text */}
            <mesh geometry={enableBase ? charmGeo : (csgBaseGeo || charmGeo)} position={enableBase ? [0, 0, baseHeight / 2] : [0, 0, 0]} name="charmInner">
                <meshStandardMaterial color={charmColor} />
            </mesh>
        </group>
    );
}
