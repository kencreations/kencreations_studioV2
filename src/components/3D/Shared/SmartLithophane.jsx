import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

/**
 * Resolution presets — pixel count for the longest axis of the image.
 * Lower = faster editing preview, Higher = export quality.
 */
const RES_MAP = { low: 64, mid: 128, high: 256 };

/**
 * 3×3 Unsharp-mask sharpening kernel.
 * Applied as a convolution on the grayscale luminance buffer.
 */
const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];

const clamp = (v, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);

// ─── Image Processing Helpers ─────────────────────────────────────────────────

/**
 * Load an image URL into an HTMLImageElement.
 * Returns a Promise that resolves with the loaded image.
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });
}

/**
 * Draw the image onto a hidden canvas at the target resolution.
 * Returns { data: Uint8ClampedArray, width, height }.
 */
function rasterize(img, maxPixels) {
    const aspect = img.width / img.height;
    let w, h;
    if (img.width >= img.height) {
        w = Math.min(img.width, maxPixels);
        h = Math.round(w / aspect);
    } else {
        h = Math.min(img.height, maxPixels);
        w = Math.round(h * aspect);
    }
    // Ensure at least 2×2
    w = Math.max(w, 2);
    h = Math.max(h, 2);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    return { data: imageData.data, width: w, height: h, canvas };
}

/**
 * Apply brightness & contrast adjustments to RGBA pixel data in-place.
 * brightness: -100..100 (0 = no change)
 * contrast:   -100..100 (0 = no change)
 */
function applyBrightnessContrast(data, brightness, contrast) {
    const bri = brightness / 100; // -1..1
    const con = (contrast + 100) / 100; // 0..2  (1 = no change)
    for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            let v = data[i + c] / 255;
            v += bri; // brightness shift
            v = (v - 0.5) * con + 0.5; // contrast about midpoint
            data[i + c] = clamp(Math.round(v * 255));
        }
    }
}

/**
 * Auto-Level: Stretch histogram so darkest pixel → 0, lightest → 255.
 * Operates on the luminance of RGB channels proportionally.
 */
function applyAutoLevel(data) {
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
    }
    const range = maxLum - minLum;
    if (range < 1) return; // already uniform or single-color
    const scale = 255 / range;
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = clamp(Math.round((data[i]     - minLum) * scale));
        data[i + 1] = clamp(Math.round((data[i + 1] - minLum) * scale));
        data[i + 2] = clamp(Math.round((data[i + 2] - minLum) * scale));
    }
}

/**
 * Auto-Sharpen: 3×3 convolution on each RGB channel.
 */
function applyAutoSharpen(data, width, height) {
    const src = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                let ki = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        sum += src[idx] * SHARPEN_KERNEL[ki++];
                    }
                }
                data[(y * width + x) * 4 + c] = clamp(Math.round(sum));
            }
        }
    }
}

/**
 * Convert RGBA pixel data to a Float32Array of luminance values [0..1].
 * Preserves the alpha channel separately.
 */
function toGrayscale(data, length) {
    const lum = new Float32Array(length / 4);
    for (let i = 0; i < length; i += 4) {
        lum[i / 4] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    }
    return lum;
}

/**
 * Extract alpha channel as a Uint8Array.
 */
function extractAlpha(data, pixelCount) {
    const alpha = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
        alpha[i] = data[i * 4 + 3];
    }
    return alpha;
}

// ─── Shape Mask Generators ────────────────────────────────────────────────────

/**
 * Generate a boolean mask for the given crop shape.
 * Returns a Uint8Array where 1 = inside, 0 = outside.
 */
function generateShapeMask(shape, width, height, alphaChannel) {
    const mask = new Uint8Array(width * height);
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const rx = (width - 1) / 2;
    const ry = (height - 1) / 2;

    switch (shape) {
        case "rectangle":
            mask.fill(1);
            break;

        case "circle":
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    mask[y * width + x] = dx * dx + dy * dy <= 1.0 ? 1 : 0;
                }
            }
            break;

        case "heart": {
            // Parametric heart: ((x/rx)^2 + (y/ry)^2 - 1)^3 - (x/rx)^2*(y/ry)^3 <= 0
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const nx = (x - cx) / rx;
                    // Flip Y so heart points down naturally; shift up slightly
                    const ny = -(y - cy) / ry + 0.1;
                    const a = nx * nx + ny * ny - 1;
                    const val = a * a * a - nx * nx * ny * ny * ny;
                    mask[y * width + x] = val <= 0 ? 1 : 0;
                }
            }
            break;
        }

        case "hexagon": {
            // Regular hexagon inscribed in the image bounds
            const hr = Math.min(rx, ry) * 0.95; // slight inset
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = Math.abs(x - cx);
                    const dy = Math.abs(y - cy);
                    // Hexagon test: pointy-top orientation
                    mask[y * width + x] =
                        dy <= hr * 0.866 && dx <= hr - dy / 1.732 ? 1 : 0;
                }
            }
            break;
        }

        case "alpha":
            // Use the alpha channel directly
            if (alphaChannel) {
                for (let i = 0; i < mask.length; i++) {
                    mask[i] = alphaChannel[i] > 128 ? 1 : 0;
                }
            } else {
                mask.fill(1); // fallback if no alpha
            }
            break;

        default:
            mask.fill(1);
    }

    return mask;
}

// ─── Marching Squares for Smooth Alpha Outline ────────────────────────────────

/**
 * Trace the outer contour of a binary mask using Marching Squares.
 * Returns an array of {x, y} points forming a closed polygon.
 * Used for the "alpha" crop shape to produce smooth edges.
 */
function marchingSquaresContour(mask, width, height) {
    // Find a starting edge pixel (top-left scan)
    let startX = -1, startY = -1;
    outer: for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const idx = y * width + x;
            // Look for a cell where at least one corner is in and one is out
            const tl = mask[idx] || 0;
            const tr = mask[idx + 1] || 0;
            const bl = mask[(y + 1) * width + x] || 0;
            const br = mask[(y + 1) * width + x + 1] || 0;
            const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
            if (code > 0 && code < 15) {
                startX = x;
                startY = y;
                break outer;
            }
        }
    }

    if (startX < 0) return []; // no boundary found

    const points = [];
    const visited = new Set();
    let x = startX, y = startY;
    const maxIter = width * height * 2; // safety limit
    let iter = 0;

    do {
        const key = `${x},${y}`;
        if (visited.has(key) && points.length > 4) break;
        visited.add(key);

        const idx = y * width + x;
        const tl = y >= 0 && x >= 0 ? (mask[idx] || 0) : 0;
        const tr = y >= 0 && x + 1 < width ? (mask[idx + 1] || 0) : 0;
        const bl = y + 1 < height && x >= 0 ? (mask[(y + 1) * width + x] || 0) : 0;
        const br = y + 1 < height && x + 1 < width ? (mask[(y + 1) * width + x + 1] || 0) : 0;
        const code = (tl << 3) | (tr << 2) | (br << 1) | bl;

        // Interpolated edge midpoints
        const top = { x: x + 0.5, y: y };
        const right = { x: x + 1, y: y + 0.5 };
        const bottom = { x: x + 0.5, y: y + 1 };
        const left = { x: x, y: y + 0.5 };

        // Add the midpoint of the active edge
        switch (code) {
            case 1: case 14: points.push(left, bottom); break;
            case 2: case 13: points.push(bottom, right); break;
            case 3: case 12: points.push(left, right); break;
            case 4: case 11: points.push(top, right); break;
            case 6: case 9:  points.push(top, bottom); break;
            case 7: case 8:  points.push(top, left); break;
            case 5:  points.push(top, right, bottom, left); break;
            case 10: points.push(left, top, right, bottom); break;
            default: break;
        }

        // March direction (simplified — move clockwise)
        if (code === 1 || code === 5 || code === 13) y++;
        else if (code === 2 || code === 3 || code === 7) x++;
        else if (code === 4 || code === 6 || code === 14) y--;
        else if (code === 8 || code === 9 || code === 12) x--;
        else if (code === 10) y++;
        else if (code === 11) x++;
        else break;

        // Clamp to bounds
        x = Math.max(-1, Math.min(x, width - 1));
        y = Math.max(-1, Math.min(y, height - 1));

        iter++;
    } while (iter < maxIter);

    return simplifyContour(points, 0.5);
}

/**
 * Douglas-Peucker contour simplification.
 * Reduces point count while preserving shape fidelity.
 */
function simplifyContour(points, tolerance) {
    if (points.length <= 3) return points;

    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const d = perpendicularDistance(points[i], first, last);
        if (d > maxDist) {
            maxDist = d;
            maxIdx = i;
        }
    }

    if (maxDist > tolerance) {
        const left = simplifyContour(points.slice(0, maxIdx + 1), tolerance);
        const right = simplifyContour(points.slice(maxIdx), tolerance);
        return [...left.slice(0, -1), ...right];
    }

    return [first, last];
}

function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        const ex = point.x - lineStart.x;
        const ey = point.y - lineStart.y;
        return Math.sqrt(ex * ex + ey * ey);
    }
    const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
    return num / Math.sqrt(lenSq);
}

// ─── Geometry Builder ─────────────────────────────────────────────────────────

/**
 * Build a watertight lithophane mesh from processed image data.
 *
 * Creates:
 *   1. Front face with vertex displacement (the lithophane surface)
 *   2. Back face at Z = 0 (flat)
 *   3. Side walls stitching front-to-back along the mask perimeter
 *
 * Returns a THREE.BufferGeometry anchored at Z = 0.
 */
function buildLithophaneGeometry(
    luminance,
    mask,
    imgWidth,
    imgHeight,
    physicalWidth,
    minThick,
    maxThick,
    quantizeLayerHeight,
    invert
) {
    const physicalHeight = physicalWidth * (imgHeight / imgWidth);
    const cellW = physicalWidth / imgWidth;
    const cellH = physicalHeight / imgHeight;
    const halfW = physicalWidth / 2;
    const halfH = physicalHeight / 2;

    const geometry = new THREE.BoxGeometry(
        physicalWidth,
        physicalHeight,
        maxThick,
        imgWidth - 1,
        imgHeight - 1,
        1
    );

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        let z = pos.getZ(i);

        if (z > 0) {
            // Top face and top edges
            const col = Math.round((x + halfW) / cellW);
            const row = Math.round((-y + halfH) / cellH);
            const safeCol = Math.max(0, Math.min(imgWidth - 1, col));
            const safeRow = Math.max(0, Math.min(imgHeight - 1, row));
            const idx = safeRow * imgWidth + safeCol;

            if (!mask[idx]) {
                // The "Skirt" Method: outside the mask, use minThick
                z = minThick;
            } else {
                let lum = luminance[idx];
                if (invert) lum = 1.0 - lum;
                z = minThick + (1.0 - lum) * (maxThick - minThick);
                
                if (quantizeLayerHeight > 0) {
                    z = Math.round(z / quantizeLayerHeight) * quantizeLayerHeight;
                    z = Math.max(z, quantizeLayerHeight); // never round below layer height
                }
            }
            pos.setZ(i, z);
        } else {
            // Bottom face and bottom edges
            pos.setZ(i, 0); // Flat back anchored at Z=0
        }
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    // ── Build CMYK Modifier Geometry (Thin slab) ───────
    const cmykGeo = geometry.clone();
    const cpos = cmykGeo.attributes.position;
    const cmykThickness = 0.2;
    const cmykColors = new Float32Array(cpos.count * 3);
    
    // We don't have RGB data here, but we set up the topology.
    // The top face sits at maxThick+0.01, bottom face sits at maxThick+0.01 - 0.2
    for(let i=0; i < cpos.count; i++) {
        let z = cpos.getZ(i);
        // If it's a top vertex (z > 0 initially, but now it's displaced)
        // Since we already displaced, it's safer to check original BoxGeo or just threshold
        // Anything above 0 is top
        if (z > 0) {
            cpos.setZ(i, maxThick + 0.01);
        } else {
            cpos.setZ(i, maxThick + 0.01 - cmykThickness);
        }
    }
    cmykGeo.computeVertexNormals();

    return { geometry, cmykGeo, cmykColors };
}

// ─── SmartLithophane Component ────────────────────────────────────────────────

/**
 * SmartLithophane — Self-contained 3D lithophane mesh component.
 *
 * Handles image loading, pixel processing (brightness, contrast, auto-level,
 * auto-sharpen), grayscale conversion, shape masking, and vertex displacement.
 *
 * Outputs a watertight mesh with:
 *   - Front: Z-displaced surface (dark = thick, light = thin)
 *   - Back:  Flat plane at Z = 0
 *   - Sides: Stitched walls along the mask perimeter
 *
 * Reports geometry via `onGeometryReady(geometry, boundingBox)`.
 */
const SmartLithophane = React.memo(
    ({
        imageUrl,
        cropShape = "rectangle",
        minThick = 0.8,
        maxThick = 3.2,
        resolution = "mid",
        quantizeLayerHeight = 0.08,
        physicalWidth = 50,
        color = "#ffffff",
        simulateBacklight = false,
        emissiveTexture = null,
        emissiveColor = "#000000",
        emissiveIntensity = 0,
        onGeometryReady,
    }) => {
        const [geometry, setGeometry] = useState(null);
        const [dims, setDims] = useState(null);

        // Store callback in ref to avoid stale closures
        const onGeometryReadyRef = useRef(onGeometryReady);
        useEffect(() => {
            onGeometryReadyRef.current = onGeometryReady;
        }, [onGeometryReady]);

        // Debounced key for rebuilds — combine all params into a dep array
        useEffect(() => {
            if (!imageUrl) {
                setGeometry(null);
                setDims(null);
                onGeometryReadyRef.current?.(null, null, null, null);
                return;
            }

            let active = true;

            const build = async () => {
                try {
                    // 1. Load image
                    const img = await loadImage(imageUrl);
                    if (!active) return;

                    // 2. Rasterize to target resolution
                    const maxPx = RES_MAP[resolution] || 128;
                    const raster = rasterize(img, maxPx);
                    if (!active) return;

                    const { data, width, height, canvas } = raster;
                    if (!active) return;

                    // 6. Extract alpha channel (before grayscale conversion)
                    const alphaChannel = extractAlpha(data, width * height);

                    // 7. Convert to grayscale luminance [0..1]
                    const luminance = toGrayscale(data, data.length);

                    // 3. Create strictly monochrome texture from luminance
                    const lumCanvas = document.createElement("canvas");
                    lumCanvas.width = width;
                    lumCanvas.height = height;
                    const lumCtx = lumCanvas.getContext("2d");
                    const lumImgData = lumCtx.createImageData(width, height);
                    for (let i = 0; i < luminance.length; i++) {
                        const val = Math.round(luminance[i] * 255);
                        // Invert mapping: We want light areas (high val) to be white (high emissive)
                        // Thick areas (dark in photo, low val) to be black (low emissive).
                        // Since val is exactly that, we just map it.
                        const idx = i * 4;
                        lumImgData.data[idx] = val;
                        lumImgData.data[idx + 1] = val;
                        lumImgData.data[idx + 2] = val;
                        lumImgData.data[idx + 3] = 255;
                    }
                    lumCtx.putImageData(lumImgData, 0, 0);

                    const texture = new THREE.CanvasTexture(lumCanvas);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.flipY = false;

                    // 8. Generate shape mask
                    const mask = generateShapeMask(cropShape, width, height, alphaChannel);

                    if (!active) return;

                    // 8. Build Geometry
                    const { geometry: geo, cmykGeo, cmykColors } = buildLithophaneGeometry(
                        luminance,
                        mask,
                        width,
                        height,
                        physicalWidth,
                        minThick,
                        maxThick,
                        quantizeLayerHeight,
                        false // invert is now handled in preprocessing or default false
                    );

                    if (!active) return;

                    // 9. Process Colors for CMYK Modifier
                    const cpos = cmykGeo.attributes.position;
                    const ccolors = new Float32Array(cpos.count * 3);
                    for (let i = 0; i < cpos.count; i++) {
                        const x = cpos.getX(i);
                        const y = cpos.getY(i);
                        
                        const col = Math.round((x + physicalWidth/2) / (physicalWidth/width));
                        const physicalHeight = physicalWidth * (height / width);
                        const row = Math.round((-y + physicalHeight/2) / (physicalHeight/height));
                        
                        const safeCol = Math.max(0, Math.min(width - 1, col));
                        const safeRow = Math.max(0, Math.min(height - 1, row));
                        const pIdx = (safeRow * width + safeCol) * 4;

                        ccolors[i * 3] = data[pIdx] / 255;
                        ccolors[i * 3 + 1] = data[pIdx + 1] / 255;
                        ccolors[i * 3 + 2] = data[pIdx + 2] / 255;
                    }
                    cmykGeo.setAttribute("color", new THREE.BufferAttribute(ccolors, 3));

                    const bb = geo.boundingBox.clone();
                    setGeometry(geo);
                    setDims({
                        width: physicalWidth,
                        height: physicalWidth * (height / width),
                    });
                    onGeometryReadyRef.current?.(geo, bb, cmykGeo, texture);
                } catch (err) {
                    console.error("[SmartLithophane] Build failed:", err);
                    if (active) {
                        setGeometry(null);
                        setDims(null);
                        onGeometryReadyRef.current?.(null, null, null, null);
                    }
                }
            };

            // Debounce the build to prevent rapid rebuilds during slider drags
            const timer = setTimeout(build, 150);
            return () => {
                active = false;
                clearTimeout(timer);
            };
        }, [
            imageUrl,
            cropShape,
            minThick,
            maxThick,
            resolution,
            quantizeLayerHeight,
            physicalWidth,
        ]);

        if (!geometry) return null;

        const sanitizedColor = color?.length > 7 ? color.substring(0, 7) : color;

        return (
            <mesh
                geometry={geometry}
                position={[0, 0, 0]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color="#ffffff"
                    side={THREE.DoubleSide}
                    roughness={0.45}
                    metalness={0.05}
                    emissiveMap={simulateBacklight ? emissiveTexture : null}
                    emissive={simulateBacklight ? new THREE.Color("#ff8c00") : new THREE.Color(0x000000)}
                    emissiveIntensity={simulateBacklight ? emissiveIntensity : 0}
                    flatShading={false}
                />
            </mesh>
        );
    }
);

SmartLithophane.displayName = "SmartLithophane";
export default SmartLithophane;
