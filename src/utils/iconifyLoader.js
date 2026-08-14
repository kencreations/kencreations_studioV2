import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

// Cache for fetched SVGs (raw string) and parsed shapes
const svgStringCache = {};
const shapesCache = {};

/**
 * Fetches an SVG from the Iconify API and parses it into an array of THREE.Shape.
 * Caches both the network request and the parsed shapes.
 */
export const getShapesFromIconify = async (iconId, size = 20) => {
    const cacheKey = `${iconId}_${size}`;
    if (shapesCache[cacheKey]) {
        return shapesCache[cacheKey];
    }

    let svgString = svgStringCache[iconId];
    if (!svgString) {
        try {
            // iconId is usually "prefix:name", e.g., "mdi:heart"
            const parts = iconId.split(":");
            let prefix, name;
            if (parts.length === 2) {
                prefix = parts[0];
                name = parts[1];
            } else if (parts.length === 1) {
                // Default to mdi if no prefix is given
                prefix = "mdi";
                name = parts[0];
            } else {
                throw new Error("Invalid iconId format.");
            }
            
            const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg`);
            if (!res.ok) throw new Error(`Failed to fetch icon ${iconId}`);
            
            svgString = await res.text();
            svgStringCache[iconId] = svgString;
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    const loader = new SVGLoader();
    const svgData = loader.parse(svgString);

    let shapes = [];
    svgData.paths.forEach((path) => {
        // We only want paths that have fills
        const pathShapes = path.toShapes(true);
        shapes.push(...pathShapes);
    });

    // 1. Create a temporary geometry to find the bounding box
    const tempGeo = new THREE.ShapeGeometry(shapes);
    tempGeo.computeBoundingBox();
    const bb = tempGeo.boundingBox;
    
    if (!bb) return shapes; // fallback

    const width = bb.max.x - bb.min.x;
    const height = bb.max.y - bb.min.y;
    const maxDim = Math.max(width, height);
    
    const scale = size / maxDim;
    
    // Center offsets
    const cx = (bb.max.x + bb.min.x) / 2;
    const cy = (bb.max.y + bb.min.y) / 2;

    const finalShapes = [];
    for (const shape of shapes) {
        const outerPoints = shape.getPoints(16);
        const transformedOuter = outerPoints.map((p) => {
            return new THREE.Vector2(
                (p.x - cx) * scale,
                -(p.y - cy) * scale // Flip Y since SVG is Y-down
            );
        });
        const newShape = new THREE.Shape(transformedOuter);

        for (const hole of shape.holes) {
            const holePoints = hole.getPoints(16);
            const transformedHole = holePoints.map((p) => {
                return new THREE.Vector2(
                    (p.x - cx) * scale,
                    -(p.y - cy) * scale
                );
            });
            newShape.holes.push(new THREE.Path(transformedHole));
        }

        finalShapes.push(newShape);
    }

    shapesCache[cacheKey] = finalShapes;
    return finalShapes;
};
