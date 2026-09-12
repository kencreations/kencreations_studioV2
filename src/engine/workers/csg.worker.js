import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Suppress the harmless three-mesh-bvh maxLeafSize deprecation warning
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('maxLeafSize')) {
        return;
    }
    originalWarn.apply(console, args);
};

self.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'computeCSG') {
        const { id, position, index, params } = msg;
        const {
            size,
            baseOffset,
            baseHeight,
            holeOrientation,
            holeDiameter,
            holeCount,
            holeDistance,
            holeYOffset = 0,
            holeZOffset = 0,
            holeShape,
            strapWidth = 10,
            strapThickness = 2.5,
        } = params;

        try {
            // Reconstruct the base geometry from arrays
            const bGeo = new THREE.BufferGeometry();
            bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(position), 3));
            if (index) {
                bGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(index), 1));
            }
            bGeo.computeVertexNormals();
            bGeo.computeBoundingBox();
            bGeo.computeBoundingSphere();

            const baseMesh = new Brush(bGeo, new THREE.MeshBasicMaterial());
            baseMesh.updateMatrixWorld(true);

            const bbox = bGeo.boundingBox;
            const maxDistX = Math.max(Math.abs(bbox.min.x), Math.abs(bbox.max.x));
            const maxDistY = Math.max(Math.abs(bbox.min.y), Math.abs(bbox.max.y));
            
            // Avoid extreme drill lengths (which create huge high-aspect-ratio triangles that break CSG),
            // but ensure it fully pierces the text mesh by spanning 2x the furthest point from origin + margin.
            const drillLength = Math.max(maxDistX, maxDistY) * 2 + 100;
            
            const drillRadius = holeDiameter / 2;
            const zOffset = holeZOffset || 0;
            const isHorizontal = holeOrientation === "horizontal";
            const isBox = holeShape === "box";

            const csgEvaluator = new Evaluator();
            csgEvaluator.useGroups = false;
            csgEvaluator.attributes = ['position', 'normal'];
            let finalBaseGeo;

            if (holeCount === 2 && !isBox) {
                const centerToCenterDist = holeDistance + holeDiameter;
                const halfDist = centerToCenterDist / 2;

                const makeDrill = (offset) => {
                    const cyl = new THREE.CylinderGeometry(drillRadius, drillRadius, drillLength, 32, 16);
                    cyl.deleteAttribute('uv');
                    const drill = new Brush(cyl, new THREE.MeshBasicMaterial());
                    // Add a micro-offset to prevent exact coplanar/vertex alignment floating point errors in BVH
                    const microJitter = 0.001337;
                    if (isHorizontal) {
                        drill.rotation.z = Math.PI / 2;
                        drill.position.set(microJitter, offset + holeYOffset + microJitter, zOffset + microJitter);
                    } else {
                        drill.position.set(offset + microJitter, holeYOffset + microJitter, zOffset + microJitter);
                    }
                    drill.updateMatrixWorld(true);
                    return drill;
                };

                const drill1 = makeDrill(halfDist);
                const drill2 = makeDrill(-halfDist);

                const after1 = csgEvaluator.evaluate(baseMesh, drill1, SUBTRACTION);
                after1.updateMatrixWorld(true);
                const finalBase = csgEvaluator.evaluate(after1, drill2, SUBTRACTION);
                finalBaseGeo = finalBase.geometry;
            } else {
                let drillMesh;
                
                if (isBox) {
                    const box = new THREE.BoxGeometry(drillLength, strapWidth, strapThickness, 16, 1, 1);
                    box.deleteAttribute('uv');
                    drillMesh = new Brush(box, new THREE.MeshBasicMaterial());
                    const microJitter = 0.001337;
                    drillMesh.position.set(microJitter, holeYOffset + microJitter, zOffset + microJitter);
                } else {
                    const cyl = new THREE.CylinderGeometry(drillRadius, drillRadius, drillLength, 32, 16);
                    cyl.deleteAttribute('uv');
                    drillMesh = new Brush(cyl, new THREE.MeshBasicMaterial());
                    if (isHorizontal) {
                        drillMesh.rotation.z = Math.PI / 2;
                    }
                    const microJitter = 0.001337;
                    drillMesh.position.set(microJitter, holeYOffset + microJitter, zOffset + microJitter);
                }
                
                drillMesh.updateMatrixWorld(true);
                
                const finalBase = csgEvaluator.evaluate(baseMesh, drillMesh, SUBTRACTION);
                finalBaseGeo = finalBase.geometry;
            }

            if (finalBaseGeo.attributes.uv) {
                finalBaseGeo.deleteAttribute("uv");
            }

            // Extract the final arrays to send back
            const outPosition = finalBaseGeo.attributes.position.array;
            const outNormal = finalBaseGeo.attributes.normal ? finalBaseGeo.attributes.normal.array : null;
            const outIndex = finalBaseGeo.index ? finalBaseGeo.index.array : null;

            // Send back without transferables to avoid DataCloneError on shared/interleaved buffers
            self.postMessage({
                type: 'result',
                id,
                position: outPosition,
                normal: outNormal,
                index: outIndex
            });
            
        } catch (err) {
            self.postMessage({ type: 'error', id, error: err.message || err.toString() });
        }
    }
};
