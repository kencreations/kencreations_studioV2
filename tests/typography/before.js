import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { offsetShapes } from "../../src/utils/textContour.ts";
export const trace = [];

/**
 * Generate typography with advanced per-character manipulation.
 * Returns an array of THREE.Shape objects ready for extrusion.
 */
export function generateAdvancedTypography({
    text,
    font,
    size,
    stylePreset,
    plateRadius,
    letterSpacing = 0,
    compactness = 1.0,
    blobIntensity = 1.0,
    edgeMargin = 2.0,
    fillIntensity = 90,
    autoFit = true,
}) {
    if (!text || text.trim().length === 0) return [];
    
    // Normalize words
    const words = text.trim().split(/\s+/);
    const safeRadius = Math.max(0.1, plateRadius - edgeMargin);
    const targetRadius = safeRadius * (fillIntensity / 100);
    
    let bestShapes = [];
    
    switch (stylePreset) {
        case "groovy-vertical":
            bestShapes = generateGroovyVertical(words, font, size, letterSpacing, blobIntensity, compactness, targetRadius, autoFit);
            break;
        case "organic-circular":
            bestShapes = generateOrganicCircular(words, font, size, letterSpacing, blobIntensity, compactness, targetRadius, autoFit);
            break;
        case "chunky-rounded":
        default:
            bestShapes = generateChunkyRounded(words, font, size, letterSpacing, blobIntensity, compactness, targetRadius, autoFit);
            break;
    }
    
    return bestShapes;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM: BEST LAYOUT SELECTION & INFLATION
// ─────────────────────────────────────────────────────────────────────────────

function pickBestLayout(candidates, targetRadius, autoFit, inflationAmount) {
    trace.length = 0;
    let bestArea = -1;
    let bestShapes = [];
    
    for (const candidate of candidates) {
        if (candidate.length === 0) continue;
        
        // 1. Center vertically
        let processed = centerShapesVertically(candidate);
        const before = processed;
        
        // 2. Apply inflation/bubble-offset to merge overlapping contours
        if (inflationAmount > 0) {
            processed = offsetShapes(processed, inflationAmount);
        }
        const inflated = processed;
        
        // 3. Scale uniformly so the furthest point exactly touches targetRadius
        if (autoFit) {
            processed = fitToCircle(processed, targetRadius);
        }
        
        // 4. Calculate actual geometric area coverage inside the circle
        const area = getTrueCoverageArea(processed);
        trace.push({ before, inflated, final: processed, area, inflationAmount });
        if (area > bestArea) {
            bestArea = area;
            bestShapes = processed;
        }
    }
    
    return bestShapes;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 1: CHUNKY ROUNDED
// ─────────────────────────────────────────────────────────────────────────────
function generateChunkyRounded(words, font, baseSize, letterSpacing, blobIntensity, compactness, targetRadius, autoFit) {
    const candidates = [];
    const text = words.join(" ");
    
    // Candidate 1: Single line
    candidates.push(buildStackedLayout([text], font, baseSize, letterSpacing, compactness));
    
    // Candidate 2: Two lines
    if (words.length > 1) {
        const mid = Math.floor(words.length / 2);
        const l1 = words.slice(0, mid).join(" ");
        const l2 = words.slice(mid).join(" ");
        candidates.push(buildStackedLayout([l1, l2], font, baseSize, letterSpacing, compactness));
    }
    
    // Candidate 3: Stacked per word
    if (words.length > 2) {
        candidates.push(buildStackedLayout(words, font, baseSize, letterSpacing, compactness));
    }
    
    // Chunky rounded uses moderate inflation for thick soft letters
    const inflation = baseSize * 0.05 + (blobIntensity * 0.2);
    
    return pickBestLayout(candidates, targetRadius, autoFit, inflation);
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 2: GROOVY VERTICAL
// ─────────────────────────────────────────────────────────────────────────────
function generateGroovyVertical(words, font, baseSize, letterSpacing, blobIntensity, compactness, targetRadius, autoFit) {
    const text = words.join(" ");
    const candidates = [];
    
    const applyGroovyWarp = (lines) => {
        const shapes = [];
        let currentY = 0;
        
        lines.forEach(lineText => {
            const lineData = layoutLine(lineText, font, baseSize, letterSpacing);
            if (!lineData) return;
            
            const cx = -lineData.width / 2;
            
            lineData.characterShapes.forEach((charData, index) => {
                const angle = Math.sin(index * 0.8) * 0.1 * blobIntensity;
                // Exaggerated vertical stretch
                const stretchY = 1.5 + Math.abs(Math.cos(index * 1.1)) * 0.6 * blobIntensity;
                const squashX = 0.85 + Math.abs(Math.sin(index * 0.5)) * 0.2;
                
                const tx = charData.xOffset + cx;
                
                const warpedShapes = transformShapes(charData.shapes, (p) => {
                    let px = p.x - charData.centerX;
                    let py = p.y - charData.centerY;
                    
                    px *= squashX;
                    py *= stretchY;
                    
                    const rx = px * Math.cos(angle) - py * Math.sin(angle);
                    const ry = px * Math.sin(angle) + py * Math.cos(angle);
                    
                    const organicWarpY = Math.sin(rx * 0.1) * 3 * blobIntensity;
                    
                    return new THREE.Vector2(
                        rx + charData.centerX + tx,
                        ry + charData.centerY + organicWarpY + currentY
                    );
                });
                
                shapes.push(...warpedShapes);
            });
            
            currentY -= (baseSize * (1.5 - (compactness - 1.0) * 0.5));
        });
        
        return shapes;
    };
    
    candidates.push(applyGroovyWarp([text]));
    
    if (words.length > 1) {
        const mid = Math.floor(words.length / 2);
        candidates.push(applyGroovyWarp([
            words.slice(0, mid).join(" "),
            words.slice(mid).join(" ")
        ]));
    }
    
    if (words.length > 2) {
        candidates.push(applyGroovyWarp(words));
    }
    
    // Groovy vertical gets heavier inflation for blobs
    const inflation = baseSize * 0.08 + (blobIntensity * 0.35);
    
    return pickBestLayout(candidates, targetRadius, autoFit, inflation);
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 3: ORGANIC CIRCULAR
// ─────────────────────────────────────────────────────────────────────────────
function generateOrganicCircular(words, font, baseSize, letterSpacing, blobIntensity, compactness, targetRadius, autoFit) {
    const text = words.join(" ");
    const candidates = [];
    
    const buildRadius = targetRadius;
    
    // Candidate 1: Full Circle (Top & Bottom Arcs)
    if (text.length > 4) {
        const mid = Math.ceil(text.length / 2);
        const topText = text.substring(0, mid);
        const bottomText = text.substring(mid);
        
        const doubleArchShapes = [];
        doubleArchShapes.push(...layoutArch(topText, font, baseSize, letterSpacing, buildRadius, 1, blobIntensity, compactness));
        doubleArchShapes.push(...layoutArch(bottomText, font, baseSize, letterSpacing, buildRadius, -1, blobIntensity, compactness));
        candidates.push(doubleArchShapes);
    }
    
    // Candidate 2: Single Top Arch + Stacked Center
    if (words.length >= 2) {
        const topArchWords = words[0];
        const centerWords = words.slice(1).join(" ");
        const comboShapes = [];
        comboShapes.push(...layoutArch(topArchWords, font, baseSize, letterSpacing, buildRadius, 1, blobIntensity, compactness));
        
        const centerStack = buildStackedLayout([centerWords], font, baseSize, letterSpacing, compactness);
        // Center the stack relative to the origin
        const centeredStack = centerShapesVertically(centerStack);
        comboShapes.push(...centeredStack);
        
        candidates.push(comboShapes);
    }
    
    // Candidate 3: Packed Stack (highly compressed lines)
    if (words.length > 1) {
        candidates.push(buildStackedLayout(words, font, baseSize, letterSpacing, compactness * 1.5));
    } else {
        candidates.push(buildStackedLayout([text], font, baseSize, letterSpacing, compactness));
    }
    
    // Organic circular uses very heavy inflation to weld everything into a single badge
    const inflation = baseSize * 0.1 + (blobIntensity * 0.4);
    
    return pickBestLayout(candidates, targetRadius, autoFit, inflation);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function buildStackedLayout(lines, font, size, letterSpacing, compactness) {
    const shapes = [];
    let currentY = 0;
    const lineHeight = size * (1.1 - (compactness - 1.0) * 0.3);
    
    lines.forEach(lineText => {
        const lineData = layoutLine(lineText, font, size, letterSpacing);
        if (!lineData) return;
        
        const cx = -lineData.width / 2;
        lineData.characterShapes.forEach(charData => {
            const tx = charData.xOffset + cx;
            const translated = transformShapes(charData.shapes, (p) => new THREE.Vector2(p.x + tx, p.y + currentY));
            shapes.push(...translated);
        });
        
        currentY -= lineHeight;
    });
    
    return shapes;
}

function layoutArch(text, font, size, letterSpacing, radius, direction, blobIntensity, compactness) {
    const shapes = [];
    if (!text) return shapes;
    
    const lineData = layoutLine(text, font, size, letterSpacing);
    if (!lineData) return shapes;
    
    const maxAngle = Math.PI * 0.9 * compactness; 
    let angleSpan = (lineData.width / (radius * Math.PI)) * Math.PI;
    if (angleSpan > maxAngle) angleSpan = maxAngle;
    
    const startAngle = (Math.PI - angleSpan) / 2;
    
    lineData.characterShapes.forEach((charData, index) => {
        const t = lineData.width > 0 ? charData.xOffset / lineData.width : 0.5;
        
        let theta = Math.PI - t * angleSpan - (Math.PI - angleSpan)/2;
        if (direction < 0) {
            theta = Math.PI + t * angleSpan + (Math.PI - angleSpan)/2;
        }
        
        const r = radius * (1.1 - compactness * 0.15);
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;
        
        const charRotation = theta - Math.PI / 2;
        const organicScale = 1.0 + Math.sin(index * 2) * 0.1 * blobIntensity;
        
        const warpedShapes = transformShapes(charData.shapes, (p) => {
            let lx = (p.x - charData.centerX) * organicScale;
            let ly = (p.y - charData.centerY) * organicScale;
            
            const rx = lx * Math.cos(charRotation) - ly * Math.sin(charRotation);
            const ry = lx * Math.sin(charRotation) + ly * Math.cos(charRotation);
            
            return new THREE.Vector2(rx + px, ry + py);
        });
        
        shapes.push(...warpedShapes);
    });
    
    return shapes;
}

function layoutLine(text, font, size, letterSpacing) {
    if (!text || text.length === 0) return null;
    
    const scale = size / font.data.resolution;
    let currentX = 0;
    const characterShapes = [];
    
    for (const char of text) {
        if (char === " ") {
            const glyph = font.data.glyphs[" "];
            currentX += (glyph ? glyph.ha * scale : size * 0.3) + letterSpacing;
            continue;
        }
        
        const glyph = font.data.glyphs[char] || font.data.glyphs["?"];
        const charShapes = font.generateShapes(char, size);
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        charShapes.forEach(shape => {
            shape.getPoints(8).forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
        });
        
        characterShapes.push({
            char,
            shapes: charShapes,
            xOffset: currentX,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY,
        });
        
        currentX += (glyph ? glyph.ha * scale : size * 0.5) + letterSpacing;
    }
    
    return { characterShapes, width: currentX };
}

function transformShapes(shapes, transformFn) {
    return shapes.map(shape => {
        const outerPoints = shape.getPoints(16).map(transformFn);
        const newShape = new THREE.Shape(outerPoints);
        
        shape.holes.forEach(hole => {
            const holePoints = hole.getPoints(16).map(transformFn);
            newShape.holes.push(new THREE.Path(holePoints));
        });
        
        return newShape;
    });
}

function centerShapesVertically(shapes) {
    if (shapes.length === 0) return shapes;
    let minY = Infinity, maxY = -Infinity;
    shapes.forEach(shape => {
        shape.getPoints(8).forEach(p => {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
    });
    const cy = -(minY + maxY) / 2;
    return transformShapes(shapes, p => new THREE.Vector2(p.x, p.y + cy));
}

/**
 * Mathematically scales shapes uniformly so that their furthest point
 * exactly hits the targetRadius, guaranteeing a perfect bounding fit without overflow.
 */
function fitToCircle(shapes, targetRadius) {
    if (shapes.length === 0) return shapes;
    
    let maxR = 0;
    shapes.forEach(shape => {
        shape.getPoints(16).forEach(p => {
            const r = Math.sqrt(p.x * p.x + p.y * p.y);
            if (r > maxR) maxR = r;
        });
    });
    
    if (maxR === 0) return shapes;
    
    const scale = targetRadius / maxR;
    return transformShapes(shapes, p => new THREE.Vector2(p.x * scale, p.y * scale));
}

/**
 * Computes the true 2D geometric area of a set of shapes.
 * This perfectly scores layouts based on how much "ink" covers the plate!
 */
function getTrueCoverageArea(shapes) {
    if (shapes.length === 0) return 0;
    
    let totalArea = 0;
    
    const getPolygonArea = (points) => {
        let area = 0;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            area += points[j].x * points[i].y;
            area -= points[i].x * points[j].y;
        }
        return Math.abs(area / 2);
    };

    shapes.forEach(shape => {
        totalArea += getPolygonArea(shape.getPoints(16));
        
        // Subtract area of holes
        shape.holes.forEach(hole => {
            totalArea -= getPolygonArea(hole.getPoints(16));
        });
    });
    
    return totalArea;
}
