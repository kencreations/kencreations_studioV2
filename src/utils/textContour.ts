import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import ClipperLib from "clipper-lib";

/**
 * Generates translated 2D shapes for each letter in the text using custom spacing.
 */
export function createTextShapesWithSpacing(
    text: string,
    font: Font,
    size: number,
    letterSpacing: number = 0
): THREE.Shape[] {
    if (!text || text.length === 0) {
        return [];
    }

    const scale = size / font.data.resolution;
    let currentX = 0;
    const allShapes: THREE.Shape[] = [];

    for (const char of text) {
        if (char === " ") {
            const glyph = font.data.glyphs[" "];
            const advance = glyph ? glyph.ha * scale : size * 0.3;
            currentX += advance + letterSpacing;
            continue;
        }

        const glyph = font.data.glyphs[char] || font.data.glyphs["?"];
        const charShapes = font.generateShapes(char, size);

        for (const shape of charShapes) {
            const outerPoints = shape.getPoints(16);
            const translatedOuter = outerPoints.map(
                (p) => new THREE.Vector2(p.x + currentX, p.y)
            );
            const newShape = new THREE.Shape(translatedOuter);

            for (const hole of shape.holes) {
                const holePoints = hole.getPoints(16);
                const translatedHole = holePoints.map(
                    (p) => new THREE.Vector2(p.x + currentX, p.y)
                );
                const newHole = new THREE.Path(translatedHole);
                newShape.holes.push(newHole);
            }

            allShapes.push(newShape);
        }

        const advance = glyph ? glyph.ha * scale : size * 0.5;
        currentX += advance + letterSpacing;
    }

    return allShapes;
}

/**
 * Uses clipper-lib to offset (inflate) a set of 2D shapes by a padding amount.
 * Merges overlapping regions automatically using Clipper's robust polygon offset engine.
 */
export function offsetShapes(
    shapes: THREE.Shape[],
    offsetDistance: number
): THREE.Shape[] {
    if (shapes.length === 0 || offsetDistance <= 0) {
        return shapes;
    }

    const scale = 100000;
    const clipperPaths: { X: number; Y: number }[][] = [];

    // Convert THREE.Shape paths to Clipper Paths
    for (const shape of shapes) {
        const outerPoints = shape.getPoints(16);
        const outerPath = outerPoints.map((p) => ({
            X: Math.round(p.x * scale),
            Y: Math.round(p.y * scale),
        }));
        if (outerPath.length > 0) {
            clipperPaths.push(outerPath);
        }

        for (const hole of shape.holes) {
            const holePoints = hole.getPoints(16);
            const holePath = holePoints.map((p) => ({
                X: Math.round(p.x * scale),
                Y: Math.round(p.y * scale),
            }));
            if (holePath.length > 0) {
                clipperPaths.push(holePath);
            }
        }
    }

    // Configure ClipperOffset
    const co = new ClipperLib.ClipperOffset();
    co.AddPaths(
        clipperPaths,
        ClipperLib.JoinType.jtRound,
        ClipperLib.EndType.etClosedPolygon
    );

    const polyTree = new ClipperLib.PolyTree();
    co.Execute(polyTree, offsetDistance * scale);

    // Convert Clipper PolyTree back to THREE.Shape array
    return polyTreeToShapes(polyTree, scale);
}

function polyTreeToShapes(polyNode: any, scale: number): THREE.Shape[] {
    const shapes: THREE.Shape[] = [];

    for (let i = 0; i < polyNode.ChildCount(); i++) {
        const child = polyNode.Childs()[i];
        if (!child.IsHole()) {
            const contour = child.Contour();
            const pts = contour.map(
                (p: any) => new THREE.Vector2(p.X / scale, p.Y / scale)
            );
            const shape = new THREE.Shape(pts);

            // Retrieve child holes
            for (let j = 0; j < child.ChildCount(); j++) {
                const holeNode = child.Childs()[j];
                if (holeNode.IsHole()) {
                    const holeContour = holeNode.Contour();
                    const holePts = holeContour.map(
                        (p: any) => new THREE.Vector2(p.X / scale, p.Y / scale)
                    );
                    const holePath = new THREE.Path(holePts);
                    shape.holes.push(holePath);

                    // Recurse down for nested islands inside holes if any
                    if (holeNode.ChildCount() > 0) {
                        const nested = polyTreeToShapes(holeNode, scale);
                        shapes.push(...nested);
                    }
                }
            }

            shapes.push(shape);
        }
    }

    return shapes;
}

/**
 * Merges a set of 2D shapes into solid, filled polygons using Clipper's union.
 *
 * Two important behaviours:
 *  1. Letter HOLES (counters like the inside of "o", "e", "a") are intentionally
 *     SKIPPED — only outer contours are fed to Clipper, so the result is fully solid.
 *  2. Overlapping or touching letter outlines are unioned into a single boundary,
 *     eliminating any white seams between adjacent characters.
 */
export function unionShapes(shapes: THREE.Shape[]): THREE.Shape[] {
    if (shapes.length === 0) return [];

    const scale = 100000;
    const clipperPaths: { X: number; Y: number }[][] = [];

    for (const shape of shapes) {
        // Only the OUTER contour — deliberately skipping shape.holes
        const outerPoints = shape.getPoints(16);
        const outerPath = outerPoints.map((p) => ({
            X: Math.round(p.x * scale),
            Y: Math.round(p.y * scale),
        }));
        if (outerPath.length > 2) {
            clipperPaths.push(outerPath);
        }
    }

    if (clipperPaths.length === 0) return shapes;

    // Union all outer paths — merges overlapping shapes and fills all gaps
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(clipperPaths, ClipperLib.PolyType.ptSubject, true);

    const solution = new ClipperLib.Paths();
    clipper.Execute(
        ClipperLib.ClipType.ctUnion,
        solution,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero,
    );

    return solution.map((path: { X: number; Y: number }[]) => {
        const pts = path.map((p) => new THREE.Vector2(p.X / scale, p.Y / scale));
        return new THREE.Shape(pts);
    });
}

