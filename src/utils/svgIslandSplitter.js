import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * Parses an SVG string and clusters intersecting/touching shapes into isolated groups.
 * 
 * @param {string} svgString 
 * @returns {Array<THREE.Shape[]>} Array of islands, where each island is an array of Shapes.
 */
export const parseAndSplitSVG = (svgString) => {
    const loader = new SVGLoader();
    const svgData = loader.parse(svgString);

    const shapesWithBounds = [];

    // 1. Extract all shapes and compute their bounding boxes
    svgData.paths.forEach((path) => {
        const shapes = path.toShapes(true);
        shapes.forEach((shape) => {
            // Get points to compute bounding box
            const points = shape.getPoints(10);
            if (points.length === 0) return;

            const box = new THREE.Box2();
            box.setFromPoints(points);
            
            shapesWithBounds.push({
                shape,
                box
            });
        });
    });

    if (shapesWithBounds.length === 0) return [];

    // 2. Cluster shapes into islands
    // We'll use a simple disjoint-set / union-find approach, or an iterative merge.
    // Iterative merge is easiest for Box2 intersection.
    const margin = 2.0; 
    let islands = shapesWithBounds.map((swb) => ({
        shapes: [swb.shape],
        box: swb.box.clone().expandByScalar(margin) // expand by margin for proximity grouping
    }));

    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < islands.length; i++) {
            for (let j = i + 1; j < islands.length; j++) {
                if (islands[i].box.intersectsBox(islands[j].box)) {
                    // Merge j into i
                    islands[i].shapes.push(...islands[j].shapes);
                    islands[i].box.union(islands[j].box);
                    // Remove j
                    islands.splice(j, 1);
                    changed = true;
                    break;
                }
            }
            if (changed) break; // Restart loop if array was mutated
        }
    }

    // 3. Re-center and NORMALIZE each island
    // Find the global maximum dimension among all islands
    let globalMaxDim = 0;
    const islandsWithTrueBox = islands.map((island) => {
        const trueBox = new THREE.Box2();
        island.shapes.forEach((shape) => {
            const pts = shape.getPoints(10);
            const b = new THREE.Box2().setFromPoints(pts);
            trueBox.union(b);
        });
        const w = trueBox.max.x - trueBox.min.x;
        const h = trueBox.max.y - trueBox.min.y;
        globalMaxDim = Math.max(globalMaxDim, w, h);
        return { island, trueBox };
    });

    if (globalMaxDim === 0) globalMaxDim = 1;

    const finalIslands = islandsWithTrueBox.map(({ island, trueBox }) => {
        const center = new THREE.Vector2();
        trueBox.getCenter(center);

        // Translate and scale each shape
        const centeredShapes = island.shapes.map(shape => {
            const processPoint = (p) => new THREE.Vector2(
                (p.x - center.x) / globalMaxDim,
                -(p.y - center.y) / globalMaxDim // Flip Y for 3D coordinates!
            );

            const translatedOuter = shape.getPoints(16).map(processPoint);
            const translatedShape = new THREE.Shape(translatedOuter);

            for (const hole of shape.holes) {
                const translatedHole = hole.getPoints(16).map(processPoint);
                translatedShape.holes.push(new THREE.Path(translatedHole));
            }
            return translatedShape;
        });

        return centeredShapes;
    });

    return finalIslands;
};
