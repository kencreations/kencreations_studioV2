import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Creates a merged BufferGeometry for a string of text, mathematically computing the
 * horizontal advance (kerning) of each character from the font data and injecting
 * a custom letter spacing offset.
 */
export function createTextGeometryWithSpacing(
    text: string,
    font: Font,
    size: number,
    depth: number,
    letterSpacing: number = 0
): THREE.BufferGeometry {
    if (!text || text.length === 0) {
        return new THREE.BufferGeometry();
    }

    const scale = size / font.data.resolution;
    let currentX = 0;
    const charGeometries: THREE.BufferGeometry[] = [];

    for (const char of text) {
        // Handle spaces explicitly
        if (char === ' ') {
            const glyph = font.data.glyphs[' '];
            // If the font doesn't have a space glyph, approximate its width
            const advance = glyph ? glyph.ha * scale : size * 0.3;
            currentX += advance + letterSpacing;
            continue;
        }

        const glyph = font.data.glyphs[char] || font.data.glyphs['?'];
        
        // Generate the geometry for the single character
        const charGeo = new TextGeometry(char, {
            font,
            size,
            depth,
            curveSegments: 4,
            bevelEnabled: false
        });

        // Translate the character to its correct position
        charGeo.translate(currentX, 0, 0);
        charGeometries.push(charGeo);

        // Advance currentX by the character's exact horizontal advance plus our custom spacing
        const advance = glyph ? glyph.ha * scale : size * 0.5;
        currentX += advance + letterSpacing;
    }

    if (charGeometries.length === 0) {
        return new THREE.BufferGeometry();
    }

    // Merge all individual character geometries into a single mesh
    const mergedGeo = BufferGeometryUtils.mergeGeometries(charGeometries);
    
    // We need to perfectly center this geometry along its own X-axis bounding box so that the 
    // upstream layout engines in Scene and Scene2 can accurately position it globally.
    mergedGeo.computeBoundingBox();
    const minX = mergedGeo.boundingBox!.min.x;
    const maxX = mergedGeo.boundingBox!.max.x;
    const width = maxX - minX;
    
    // Offset the entire merged geometry so its local origin (0,0,0) is at the horizontal center
    mergedGeo.translate(-minX - width / 2, 0, 0);

    return mergedGeo;
}
