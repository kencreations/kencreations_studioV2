import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

// Load FontAwesome Solid SVGs as raw strings
const svgFiles = import.meta.glob(
    "../../../node_modules/@fortawesome/fontawesome-free/svgs/solid/*.svg",
    { eager: true, query: "?raw", import: "default" },
);

export const ICON_OPTIONS = Object.keys(svgFiles).map((filepath) => {
    const filename = filepath.split("/").pop().replace(".svg", "");
    return {
        id: filename,
        label: filename.replace(/-/g, " "),
        svgString: svgFiles[filepath],
    };
});

// Cache for parsed shapes
const shapesCache = {};

/**
 * Parses an SVG string into an array of THREE.Shape
 * Scales and centers the SVG to fit within a given size.
 */
export const getShapesFromSVG = (iconId, size = 20) => {
    if (shapesCache[iconId]) {
        return shapesCache[iconId];
    }

    const iconOption = ICON_OPTIONS.find((icon) => icon.id === iconId);
    if (!iconOption) return [];

    const loader = new SVGLoader();
    const svgData = loader.parse(iconOption.svgString);

    let shapes = [];
    svgData.paths.forEach((path) => {
        // We only want paths that have fills, FontAwesome is strictly filled.
        const pathShapes = SVGLoader.createShapes(path);
        shapes.push(...pathShapes);
    });

    // FontAwesome SVGs are often massive (e.g. 512x512) and Y-down.
    // We need to scale it down and flip Y, then center it.
    
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

    // 2. We can transform the shapes via applying matrix to geometry, 
    // but we need THREE.Shape array for Clipper offset!
    // We can transform the paths directly, but modifying curves is error-prone.
    // Instead of transforming paths manually, we can generate the ExtrudeGeometry first, 
    // BUT we need the paths for Clipper offset.
    // A much safer way to transform Shape for Clipper is to apply the transform 
    // AFTER getting the points from shape.extractPoints().
    // But we need the Shape array!
    
    // Wait, let's just transform the Shape curves.
    const transformedShapes = shapes.map(shape => {
        const newShape = new THREE.Shape();
        
        // This is tricky because Shape contains various curve types.
        // Let's use shape.getPoints() to convert it into a polygon!
        // FontAwesome icons are straight lines and curves, getPoints(12) gives a good polygon approximation.
        const pts = shape.getPoints(12).map(p => new THREE.Vector2((p.x - cx) * scale, -(p.y - cy) * scale));
        
        if (pts.length > 0) {
            newShape.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                newShape.lineTo(pts[i].x, pts[i].y);
            }
        }
        
        if (shape.holes) {
            shape.holes.forEach(hole => {
                const holePts = hole.getPoints(12).map(p => new THREE.Vector2((p.x - cx) * scale, -(p.y - cy) * scale));
                const newHole = new THREE.Path();
                if (holePts.length > 0) {
                    newHole.moveTo(holePts[0].x, holePts[0].y);
                    for (let i = 1; i < holePts.length; i++) {
                        newHole.lineTo(holePts[i].x, holePts[i].y);
                    }
                }
                newShape.holes.push(newHole);
            });
        }
        
        return newShape;
    });

    shapesCache[iconId] = transformedShapes;
    return transformedShapes;
};
