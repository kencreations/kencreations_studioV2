import * as THREE from 'three';
import Module from 'manifold-3d';
import { toCreasedNormals, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared by preview and export: 256 samples keep chord error below 0.006 mm
// even at the largest supported diameter. Z is the printing axis.
export const RADIAL_SEGMENTS = 256;
let kernel, kernelPromise;
export function initializeContainerKernel(wasmUrl) {
    if (!kernelPromise) kernelPromise = Module(wasmUrl ? { locateFile: () => wasmUrl } : {}).then(m => {
        m.setup(); kernel = m; return m;
    });
    return kernelPromise;
}

export function containerSolid(geometry) {
    if (!kernel) throw new Error('Geometry kernel is still loading.');
    const positions = geometry.attributes.position;
    const mesh = new kernel.Mesh({ numProp: 3,
        vertProperties: new Float32Array(positions.array),
        triVerts: geometry.index ? new Uint32Array(geometry.index.array)
            : Uint32Array.from({ length: positions.count }, (_, i) => i),
    });
    mesh.merge();
    const solid = new kernel.Manifold(mesh);
    if (solid.status() !== 'NoError') { const status = solid.status(); solid.delete(); throw new Error(`Invalid container solid: ${status}`); }
    return solid;
}

function booleanGeometry(shell, tool, subtract = false) {
    const a = containerSolid(shell), b = containerSolid(tool);
    let result;
    try {
        result = subtract ? a.subtract(b) : a.add(b);
        if (result.status() !== 'NoError') throw new Error(`Container boolean failed: ${result.status()}`);
        const data = result.getMesh();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(data.vertProperties, 3));
        geo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.triVerts), 1));
        geo.computeVertexNormals();
        const creased = toCreasedNormals(geo, (35 * Math.PI) / 180);
        const smooth = mergeVertices(creased, 1e-6);
        geo.dispose();
        creased.dispose();
        return smooth;
    } finally { a.delete(); b.delete(); result?.delete(); }
}

export function containerDimensions(c) {
    const inner = c.innerDiameter / 2, neck = inner + c.wallThickness;
    // Inner height is the FULL usable cavity, including the threaded neck.
    const bodyHeight = c.bottomThickness + c.innerHeight;
    const flangeHeight = Math.min(2.4, bodyHeight * 0.3);
    const floor = Math.max(1.2, c.lidTopThickness ?? c.bottomThickness);
    const threadLength = Math.min(Math.max(3, c.threadHeight), bodyHeight - flangeHeight - 0.8);
    const pitch = threadLength; // single-start, approximately one turn
    const threadDepth = Math.min(1.2, pitch * 0.2);
    const lidInner = neck + c.clearance;
    const radius = lidInner + threadDepth + c.wallThickness;
    const flangeRadius = radius + 0.8;
    const skirt = bodyHeight - flangeHeight; // rim and flange are the seating stops
    return { inner, neck, lidInner, radius, floor, skirt, bodyHeight,
        flangeHeight, flangeRadius, threadLength, pitch, threadDepth,
        lidHeight: floor + skirt, engagementTurns: skirt / pitch };
}

function threadProfile(z, angle, pitch) {
    const phase = ((z / pitch - angle / (2 * Math.PI)) % 1 + 1) % 1;
    return Math.max(0, Math.min(1, (0.4 - Math.abs(phase - 0.5)) / 0.2));
}
export function thread(z, angle, length) {
    return Math.min(1.2, length * 0.2) * threadProfile(z, angle, length)
        * Math.max(0, Math.min(1, z / 0.6, (length - z) / 0.6));
}

// Revolve a closed cross-section. Ring seams share vertices; poles are single
// vertices (no zero-area triangles). A variable radius embeds threads/knurling
// in the shell itself, avoiding overlapping solids and internal faces.
function revolve(profile) {
    const positions = [], indices = [], rings = [];
    for (const [radius, z] of profile) {
        const pole = typeof radius === 'number' && radius === 0;
        const ring = [];
        for (let i = 0; i < (pole ? 1 : RADIAL_SEGMENTS); i++) {
            const a = i * Math.PI * 2 / RADIAL_SEGMENTS;
            const r = typeof radius === 'function' ? radius(a) : radius;
            ring.push(positions.length / 3);
            positions.push(r * Math.cos(a), r * Math.sin(a), z);
        }
        rings.push(ring);
    }
    for (let j = 0; j < rings.length - 1; j++) {
        const a = rings[j], b = rings[j + 1];
        for (let i = 0; i < RADIAL_SEGMENTS; i++) {
            const k = (i + 1) % RADIAL_SEGMENTS;
            if (a.length === 1) indices.push(a[0], b[k], b[i]);
            else if (b.length === 1) indices.push(a[i], a[k], b[0]);
            else indices.push(a[i], a[k], b[k], a[i], b[k], b[i]);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

export function createContainerGeometry(c, part, fitTest = false) {
    const d = containerDimensions(c), lid = part === 'lid', edge = 0.3;
    const base = fitTest ? 0 : lid ? d.floor : c.bottomThickness;
    const height = fitTest ? d.threadLength + 2 : lid ? d.lidHeight : d.bodyHeight;
    const start = height - d.threadLength;
    const inside = lid ? d.lidInner : d.inner;
    const outer = lid ? d.radius : d.neck;
    const grip = a => c.containerStyle === 'knurled' ? 0.25 * (0.5 + 0.5 * Math.cos(a * 64)) : 0;
    let p;
    if (lid || fitTest) {
        p = [[fitTest ? inside : 0, 0], [outer - edge, 0], [a => outer + (lid ? grip(a) : 0), edge]];
    } else {
        // The flange is part of the revolved shell, not an overlapping disk.
        p = [[0, 0], [d.flangeRadius - edge, 0], [a => d.flangeRadius + grip(a), edge],
            [a => d.flangeRadius + grip(a), d.flangeHeight - edge],
            [d.flangeRadius - edge, d.flangeHeight], [outer + edge, d.flangeHeight],
            [outer, d.flangeHeight + edge]];
    }
    if (lid) {
        p.push([a => outer + grip(a), height - edge], [outer - edge, height]);
        // Widen the mouth as a lead-in; cut the female helix through the mouth.
        // Do not taper the female groove to zero: that blocks unscrewing.
        p.push([inside + d.threadDepth + edge, height]);
        const steps = Math.ceil((height - base - edge) / 0.16);
        for (let i = 0; i <= steps; i++) {
            const z = height - edge - (height - base - edge) * i / steps;
            const t = d.threadLength - (z - base);
            p.push([a => inside + d.threadDepth * Math.max(threadProfile(t, -a, d.pitch),
                Math.max(0, 1 - (height - z) / 0.8)), z]);
        }
    } else {
        p.push([outer, start]);
        const steps = Math.ceil((d.threadLength - edge) / 0.16);
        for (let i = 1; i <= steps; i++) {
            const z = start + (d.threadLength - edge) * i / steps;
            p.push([a => outer + thread(z - start, a, d.threadLength), z]);
        }
        p.push([outer - edge, height], [inside + edge, height],
            [inside, height - edge], [inside, base]);
    }
    if (!fitTest) p.push([0, base]);
    const geo = revolve(p);
    if (fitTest) {
        const index = geo.index.array, last = geo.attributes.position.count - RADIAL_SEGMENTS;
        for (let i = 0; i < index.length; i++) if (index[i] >= last) index[i] -= last;
        // Lid's first and last rings differ where its groove reaches the bottom.
        // Its lower annulus must retain that groove instead of welding unequal radii.
        if (lid) {
            geo.dispose();
            p[0] = p.at(-1);
            const closed = revolve(p);
            const ix = closed.index.array, end = closed.attributes.position.count - RADIAL_SEGMENTS;
            for (let i = 0; i < ix.length; i++) if (ix[i] >= end) ix[i] -= end;
            closed.computeVertexNormals(); return closed;
        }
        geo.computeVertexNormals();
    }
    return geo;
}

export function createLidTextGeometry(c, font) {
    const rawText = c.personText?.trim();
    if (!rawText || !font) return null;
    const d = containerDimensions(c);

    // Usable circular radius on lid exterior surface
    const edgeMargin = c.containerStyle === 'knurled' ? 3.5 : 2.5;
    const usableRadius = Math.max(5, d.radius - edgeMargin);

    // Generate shapes at standard reference size (10 mm) to compute accurate metrics
    const baseSize = 10;
    const shapes = font.generateShapes(rawText, baseSize);
    if (!shapes || shapes.length === 0) return null;

    // Accurate 2D bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    shapes.forEach(shape => {
        const pts = shape.getPoints(12);
        pts.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
    });
    if (!isFinite(minX) || !isFinite(maxX)) return null;

    const textWidth = maxX - minX;
    const textHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const halfDiag = Math.hypot(textWidth / 2, textHeight / 2);

    const hasTopLug = Boolean(c.addKeychainHole ?? c.enableKeychainHole) && c.attachmentPosition !== 'side';
    // Safe margin from top lid edge when lug is at 12 o'clock
    const topMargin = hasTopLug ? 2.5 : 0;
    // Lower vertical shift (towards 6 o'clock) to leave generous headroom below the 12 o'clock lug
    const yShift = hasTopLug ? 1.5 : 0;

    // Max scale that fits inside usable circular radius and respects top/bottom margins
    const maxCircularScale = (usableRadius * 0.90) / Math.max(halfDiag, 0.001);
    const maxTopScale = hasTopLug
        ? (usableRadius - topMargin - yShift) / Math.max(maxY - centerY, 0.001)
        : maxCircularScale;
    const maxBottomScale = hasTopLug
        ? (usableRadius * 0.90 - yShift) / Math.max(centerY - minY, 0.001)
        : maxCircularScale;
    const maxAllowedScale = Math.min(maxCircularScale, maxTopScale, maxBottomScale);

    let scale;
    if (c.personAutoFit) {
        // Auto-fit scales text to fill the circular area nicely,
        // with an upper cap so short names (e.g. 1-3 letters) stay proportional
        const maxFontHeight = Math.min(18, (usableRadius - (hasTopLug ? topMargin : 0)) * 1.05);
        scale = Math.min(maxAllowedScale, maxFontHeight / baseSize);
    } else {
        const manualSize = Number(c.personSize) || 8;
        const requestedScale = manualSize / baseSize;
        // Never allow manual text to clip past the circular safety margin or top margin
        scale = Math.min(requestedScale, maxAllowedScale);
    }

    const isEngraved = c.personStyle === 'engraved';
    let reliefDepth;
    let extrudeDepth;
    let textZOffset;

    if (isEngraved) {
        // Engraved: cuts into the lid exterior surface (from z = -0.10 to z = +reliefDepth).
        // Leaves at least 0.6mm solid floor thickness below the engraving
        const maxCutDepth = Math.max(0.4, d.floor - 0.6);
        reliefDepth = Math.max(0.3, Math.min(Number(c.personDepth) || 0.8, maxCutDepth));
        extrudeDepth = reliefDepth + 0.10;
        // After rotateX(PI), z spans [-extrudeDepth, 0]. Translating +reliefDepth
        // places cutter at [-0.10, +reliefDepth], cleanly cutting through exterior face.
        textZOffset = reliefDepth;
    } else {
        // Embossed: raised above the lid exterior surface (from z = -reliefDepth to z = +0.40).
        // Anchors 0.40 mm into the solid roof (z > 0) for a seamless 100% manifold fusion (2 layers at 0.2mm).
        const overlap = 0.40;
        reliefDepth = Math.max(0.4, Math.min(2.5, Number(c.personDepth) || 0.8));
        extrudeDepth = reliefDepth + overlap;
        // After rotateX(PI), z spans [-extrudeDepth, 0]. Translating +overlap
        // places raised text at [-reliefDepth, +overlap].
        textZOffset = overlap;
    }

    const textGeo = new THREE.ExtrudeGeometry(shapes, {
        depth: extrudeDepth,
        bevelEnabled: false,
        curveSegments: 16,
    });

    // Center in XY, with downward offset for top lug clearance if keychain enabled
    // Note: rotateX(PI) inverts Y (Y_lid = -Y_font).
    // So to shift text towards +Y_lid (6 o'clock, down away from 12 o'clock lug),
    // we translate by -yShift / scale in font coordinates.
    textGeo.translate(-centerX, -centerY - (yShift / scale), 0);
    // Scale uniformly
    textGeo.scale(scale, scale, 1);
    // Rotate 180 degrees around X: aligns text front-facing and upright when viewed from top,
    // preserving outward face normals and counter-clockwise triangle winding
    textGeo.rotateX(Math.PI);
    // Position in Z relative to lid exterior surface (z = 0)
    textGeo.translate(0, 0, textZOffset);

    return { textGeo, isEngraved, reliefDepth, extrudeDepth };
}

export function personalizeLid(shell, c, font) {
    if (!c.personalized) return shell;
    const textInfo = createLidTextGeometry(c, font);
    if (!textInfo) return shell;
    const { textGeo, isEngraved } = textInfo;

    try {
        const finalGeo = booleanGeometry(shell, textGeo, isEngraved);
        finalGeo.computeBoundingBox();
        const minZ = finalGeo.boundingBox?.min.z ?? 0;
        if (minZ < -1e-5) {
            finalGeo.translate(0, 0, -minZ);
        }
        return finalGeo;
    } finally {
        textGeo.dispose();
    }
}

export function containerLayout(c) {
    const d = containerDimensions(c);
    const pair = c.printMode === 'full' || c.printMode === 'fitTest';
    const bodyR = (c.printMode === 'fitTest' ? d.neck + d.threadDepth : d.flangeRadius) + (c.containerStyle === 'knurled' ? 0.25 : 0);
    const lidR = d.radius + (c.containerStyle === 'knurled' ? 0.25 : 0);
    const isSide = c.attachmentPosition === 'side';
    const sideExtension = isSide && c.addKeychainHole && c.printMode !== 'lid' && c.printMode !== 'fitTest' ? d.flangeRadius + 12 - bodyR : 0;
    const width = (pair ? 2 * bodyR + 10 + 2 * lidR : 2 * (c.printMode === 'body' ? bodyR : lidR)) + sideExtension;
    const topExtension = !isSide && c.addKeychainHole && c.printMode !== 'lid' && c.printMode !== 'fitTest' ? d.flangeRadius + 12 - bodyR : 0;
    // Loop points away from the lid in the print arrangement.
    return {
        bodyX: pair ? -width / 2 + bodyR + sideExtension : sideExtension / 2,
        lidX: pair ? width / 2 - lidR : 0,
        x: width,
        y: 2 * (pair ? Math.max(bodyR, lidR) : c.printMode === 'body' ? bodyR : lidR) + topExtension,
        z: c.printMode === 'fitTest' ? d.threadLength + 2 : Math.max(
            c.printMode === 'lid' ? 0 : d.bodyHeight,
            c.printMode === 'body' ? 0 : d.lidHeight
        )
    };
}

export function previewPlacement(c, part) {
    const d = containerDimensions(c), fit = c.printMode === 'fitTest';
    const pair = c.printMode === 'full' || fit;
    if (part === 'body') return { z: 0, rotationX: 0 };

    // In Assembled mode:
    // Lid sits in the mechanically correct closed position:
    // - Interior ceiling (z = d.floor) meets the body neck rim (z = d.bodyHeight)
    // - Lower skirt rim (z = d.lidHeight) reaches the body flange (z = d.flangeHeight)
    // - Zero floating gaps, zero solid overlap
    const seated = fit ? d.threadLength + 2 : d.bodyHeight + d.floor;

    if (c.viewMode === 'exploded' && pair) {
        // In Exploded mode:
        // Clear vertical separation showing container mouth, external threads,
        // and lid underside/interior.
        const explodedGap = Math.max(18, Math.min(32, d.bodyHeight * 1.1));
        const explodedZ = d.bodyHeight + d.lidHeight + explodedGap;
        return { z: explodedZ, rotationX: Math.PI };
    }

    return { z: pair ? seated : d.lidHeight, rotationX: Math.PI };
}

export function addBodyKeychainLoop(shell, c) {
    const enabled = Boolean(c.addKeychainHole ?? c.enableKeychainHole);
    if (!enabled || c.printMode === 'fitTest') return shell;
    const d = containerDimensions(c);

    const Rf = d.flangeRadius;
    const Hf = d.flangeHeight;
    const rawHoleDia = Number(c.keychainHoleDiameter ?? c.holeDiameter);
    const holeDiameter = (!isNaN(rawHoleDia) && rawHoleDia >= 2.0 && rawHoleDia <= 10.0) ? rawHoleDia : 4.2;
    const rawWall = Number(c.keychainWallThickness ?? c.lugWidth ?? c.lugWallThickness);
    const wallThickness = (!isNaN(rawWall) && rawWall >= 1.5 && rawWall <= 8.0) ? rawWall : 3.2;
    const rawLength = Number(c.keychainLugLength ?? c.lugLength);
    const lugLength = (!isNaN(rawLength) && rawLength >= 2.0 && rawLength <= 12.0) ? rawLength : 4.0;

    const rHole = holeDiameter / 2;
    const rLug = rHole + wallThickness;
    const D = Rf + lugLength;

    const isSide = c.attachmentPosition === 'side';

    if (isSide) {
        // Legacy side lug along -X axis
        const Rb = Math.min(6.0, Math.max(2.0, lugLength * 1.5));
        let xb = ((rLug + Rb) ** 2 - (Rf + Rb) ** 2 - D ** 2) / (2 * D);
        let term = (Rf + Rb) ** 2 - xb ** 2;
        let effectiveRb = Rb;
        while (term <= 0.5 && effectiveRb > 1.0) {
            effectiveRb -= 0.5;
            xb = ((rLug + effectiveRb) ** 2 - (Rf + effectiveRb) ** 2 - D ** 2) / (2 * D);
            term = (Rf + effectiveRb) ** 2 - xb ** 2;
        }
        const yb = Math.sqrt(Math.max(0.1, term));

        const tLugX = -D + (rLug / (rLug + effectiveRb)) * (xb - (-D));
        const tLugY = (rLug / (rLug + effectiveRb)) * yb;
        const tFlangeX = (Rf / (Rf + effectiveRb)) * xb;
        const tFlangeY = (Rf / (Rf + effectiveRb)) * yb;

        const shape = new THREE.Shape();
        const a1_f = Math.atan2(tFlangeY - yb, tFlangeX - xb);
        const a1_l = Math.atan2(tLugY - yb, tLugX - xb);
        const a_tip1 = Math.atan2(tLugY, tLugX - (-D));
        const rawTip2 = Math.atan2(-tLugY, tLugX - (-D));
        const a_tip2 = rawTip2 < 0 ? rawTip2 + 2 * Math.PI : rawTip2;
        const a2_l = Math.atan2(-tLugY - (-yb), tLugX - xb);
        const a2_f = Math.atan2(-tFlangeY - (-yb), tFlangeX - xb);

        shape.moveTo(tFlangeX, tFlangeY);
        shape.absarc(xb, yb, effectiveRb, a1_f, a1_l, true);
        shape.absarc(-D, 0, rLug, a_tip1, a_tip2, false);
        shape.absarc(xb, -yb, effectiveRb, a2_l, a2_f, true);
        shape.closePath();

        const hole = new THREE.Path();
        hole.absarc(-D, 0, rHole, 0, Math.PI * 2, true);
        shape.holes.push(hole);

        const tabGeo = new THREE.ExtrudeGeometry(shape, {
            depth: Hf,
            bevelEnabled: false,
            curveSegments: 128,
        });

        try {
            return booleanGeometry(shell, tabGeo, false);
        } finally {
            tabGeo.dispose();
        }
    }

    // Default 'top' attachment: lug centered at 12 o'clock along +Y axis at (0, +D)
    const Rb = Math.min(6.0, Math.max(2.0, lugLength * 1.5));
    let yb = ((Rf + Rb) ** 2 + D ** 2 - (rLug + Rb) ** 2) / (2 * D);
    let term = (Rf + Rb) ** 2 - yb ** 2;
    let effectiveRb = Rb;
    while (term <= 0.5 && effectiveRb > 1.0) {
        effectiveRb -= 0.5;
        yb = ((Rf + effectiveRb) ** 2 + D ** 2 - (rLug + effectiveRb) ** 2) / (2 * D);
        term = (Rf + effectiveRb) ** 2 - yb ** 2;
    }
    const xb = Math.sqrt(Math.max(0.1, term));

    // Tangent points on flange circle (center (0, 0))
    const tFlangeXR = (Rf / (Rf + effectiveRb)) * xb;
    const tFlangeYR = (Rf / (Rf + effectiveRb)) * yb;
    const tFlangeXL = -tFlangeXR;
    const tFlangeYL = tFlangeYR;

    // Tangent points on lug tip circle (center (0, D))
    const tLugXR = (rLug / (rLug + effectiveRb)) * xb;
    const tLugYR = D + (rLug / (rLug + effectiveRb)) * (yb - D);
    const tLugXL = -tLugXR;
    const tLugYL = tLugYR;

    const shape = new THREE.Shape();
    // 1. Right blend fillet from flange tangent to lug tangent (around (+xb, yb), clockwise)
    const a1_f = Math.atan2(tFlangeYR - yb, tFlangeXR - xb);
    const a1_l = Math.atan2(tLugYR - yb, tLugXR - xb);

    // 2. Convex outer lug tip around (0, D) (from tLugR to tLugL over the top, counter-clockwise)
    const a_tip1 = Math.atan2(tLugYR - D, tLugXR);
    const a_tip2 = Math.atan2(tLugYL - D, tLugXL);

    // 3. Left blend fillet from lug tangent to flange tangent (around (-xb, yb), clockwise)
    const a2_l = Math.atan2(tLugYL - yb, tLugXL - (-xb));
    const a2_f = Math.atan2(tFlangeYL - yb, tFlangeXL - (-xb));

    // Closed tangent chord across the base flange circle (y = tFlangeYR < Rf).
    // Every point on this chord is strictly inside the solid flange cylinder,
    // eliminating chamfer collisions, pinched wedges, or surface steps.
    shape.moveTo(tFlangeXR, tFlangeYR);
    shape.absarc(xb, yb, effectiveRb, a1_f, a1_l, true);
    shape.absarc(0, D, rLug, a_tip1, a_tip2, false);
    shape.absarc(-xb, yb, effectiveRb, a2_l, a2_f, true);
    shape.closePath();

    // Clean circular through-hole concentric with the lug tip at (0, D)
    const hole = new THREE.Path();
    hole.absarc(0, D, rHole, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const tabGeo = new THREE.ExtrudeGeometry(shape, {
        depth: Hf,
        bevelEnabled: false,
        curveSegments: 128,
    });

    try {
        return booleanGeometry(shell, tabGeo, false);
    } finally {
        tabGeo.dispose();
    }
}

export function getPushOutHoleLimits(configOrInnerDiameter) {
    const innerDiameter = typeof configOrInnerDiameter === 'number'
        ? configOrInnerDiameter
        : Number(configOrInnerDiameter?.innerDiameter) || 50;
    const min = 3.0;
    // Maintain at least 3.0 mm of solid supporting floor rim around the hole (6.0 mm total margin)
    // and limit large containers to at most 85% of inner diameter for structural integrity
    const max = Math.max(min, Math.min(innerDiameter - 6.0, innerDiameter * 0.85));
    const defaultDiameter = Math.min(15.0, Math.max(min, Math.round(innerDiameter * 0.35 * 2) / 2));
    return {
        min,
        max: Math.round(max * 10) / 10,
        defaultDiameter,
    };
}

export function clampPushOutHoleDiameter(diameter, innerDiameter) {
    const { min, max, defaultDiameter } = getPushOutHoleLimits(innerDiameter);
    const val = Number(diameter);
    if (isNaN(val) || val <= 0) return defaultDiameter;
    return Math.max(min, Math.min(val, max));
}

export function addBodyPushOutHole(shell, c) {
    if (!c.pushOutHoleEnabled || c.printMode === 'fitTest') return shell;
    const innerDiameter = Number(c.innerDiameter) || 50;
    const rawDiameter = c.pushOutHoleDiameterMm ?? c.pushOutHoleDiameter;
    const holeDiameter = clampPushOutHoleDiameter(rawDiameter, innerDiameter);
    const radius = holeDiameter / 2;

    const bottomThickness = Math.max(0.8, Number(c.bottomThickness) || 1.2);
    // Cylinder cutter height slightly exceeds bottomThickness to ensure a clean,
    // non-coplanar through-cut across both the exterior bottom (z = 0) and inner floor (z = bottomThickness)
    const cutterHeight = bottomThickness + 2.0;
    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, cutterHeight, 128, 1, false);

    // Three.js CylinderGeometry is default-aligned along Y axis centered at [0, 0, 0].
    // Revolve axis in screwContainer is Z, with bottom floor extending from z = 0 to z = bottomThickness.
    cylinderGeo.rotateX(Math.PI / 2);
    cylinderGeo.translate(0, 0, bottomThickness / 2);

    try {
        return booleanGeometry(shell, cylinderGeo, true);
    } finally {
        cylinderGeo.dispose();
    }
}

// Fresh owned resources for the existing export pipeline. Preview transforms
// (including mid-animation transforms) never enter the export scene.
export function createContainerPrintScene(c, geometries, format = '3mf') {
    const layout = containerLayout(c);
    const scene = new THREE.Scene();
    scene.name = 'Screw Top Container';
    const isStl = format === 'stl';
    const isEmbossedMultiColor = !isStl && c.personalized && c.personStyle === 'embossed' && geometries.lidBase && geometries.text;

    // 1. Container Body
    if (c.printMode !== 'lid') {
        if (!geometries.body) throw new Error('Container body geometry is still loading.');
        const clonedBody = geometries.body.clone();
        clonedBody.computeBoundingBox();
        const minZ = clonedBody.boundingBox?.min.z ?? 0;
        if (Math.abs(minZ) > 0.001) {
            clonedBody.translate(0, 0, -minZ);
        }
        const bodyMesh = new THREE.Mesh(clonedBody, new THREE.MeshStandardMaterial({
            color: (c.bodyColor || '#14B8A6')?.slice(0, 7),
        }));
        bodyMesh.name = 'Container Body';
        bodyMesh.position.set(layout.bodyX, 0, 0);
        scene.add(bodyMesh);
    }

    // 2. Personalized Lid (or Container Lid)
    if (c.printMode !== 'body') {
        if (isEmbossedMultiColor) {
            // Group for Bambu Studio assembly object:
            // Top-level object: Personalized Lid
            // Sub-parts: Lid Base and Lid Text
            const lidGroup = new THREE.Group();
            lidGroup.name = 'Personalized Lid';
            lidGroup.position.set(layout.lidX, 0, 0);

            const clonedLidBase = geometries.lidBase.clone();
            const clonedText = geometries.text.clone();

            clonedLidBase.computeBoundingBox();
            clonedText.computeBoundingBox();

            // Coordinate both parts together using their combined minimum Z
            // so they undergo the EXACT same print bed placement translation
            const minZ = Math.min(
                clonedLidBase.boundingBox?.min.z ?? 0,
                clonedText.boundingBox?.min.z ?? 0
            );
            if (Math.abs(minZ) > 0.001) {
                clonedLidBase.translate(0, 0, -minZ);
                clonedText.translate(0, 0, -minZ);
            }

            const lidBaseMesh = new THREE.Mesh(clonedLidBase, new THREE.MeshStandardMaterial({
                color: (c.lidColor || '#647D94')?.slice(0, 7),
            }));
            lidBaseMesh.name = 'Lid Base';
            lidGroup.add(lidBaseMesh);

            const textMesh = new THREE.Mesh(clonedText, new THREE.MeshStandardMaterial({
                color: (c.textColor || '#FFFFFF')?.slice(0, 7),
            }));
            textMesh.name = 'Lid Text';
            lidGroup.add(textMesh);

            scene.add(lidGroup);
        } else {
            // Single 100% closed manifold solid for STL export or non-embossed/single-color lid
            if (!geometries.lid) throw new Error('Container lid geometry is still loading.');
            const clonedLid = geometries.lid.clone();
            clonedLid.computeBoundingBox();
            const minZ = clonedLid.boundingBox?.min.z ?? 0;
            if (Math.abs(minZ) > 0.001) {
                clonedLid.translate(0, 0, -minZ);
            }
            const lidMesh = new THREE.Mesh(clonedLid, new THREE.MeshStandardMaterial({
                color: (c.lidColor || '#647D94')?.slice(0, 7),
            }));
            lidMesh.name = c.personalized ? 'Personalized Lid' : 'Container Lid';
            lidMesh.position.set(layout.lidX, 0, 0);
            scene.add(lidMesh);
        }
    }
    return scene;
}

