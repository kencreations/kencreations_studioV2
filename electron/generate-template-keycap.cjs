/**
 * generate-template-keycap.cjs
 *
 * Generates a simple 18×18×8 mm Cherry MX keycap STL for the Keycap Maker.
 * The keycap is a slightly rounded box matching standard 1U dimensions.
 * Output: public/models/keycaps/template.stl (binary STL)
 */
const fs = require('fs');
const path = require('path');

// ── Keycap dimensions (mm) ───────────────────────────────────────────────
const W = 18;       // width
const D = 18;       // depth
const H = 8;        // height
const WALL = 1.5;   // wall thickness (for the hollow interior)

// We create a simple solid box as the cap profile.
// The SceneKeycap normalizes it to ~65 internal units anyway.

function makeBox(w, d, h, ox = 0, oy = 0, oz = 0) {
    const hw = w / 2, hd = d / 2;
    // 8 vertices
    const v = [
        [ox - hw, oy,     oz - hd], // 0: bottom-left-front
        [ox + hw, oy,     oz - hd], // 1: bottom-right-front
        [ox + hw, oy,     oz + hd], // 2: bottom-right-back
        [ox - hw, oy,     oz + hd], // 3: bottom-left-back
        [ox - hw, oy + h, oz - hd], // 4: top-left-front
        [ox + hw, oy + h, oz - hd], // 5: top-right-front
        [ox + hw, oy + h, oz + hd], // 6: top-right-back
        [ox - hw, oy + h, oz + hd], // 7: top-left-back
    ];

    // 12 triangles (2 per face, 6 faces)
    const triangles = [
        // bottom (y=0)
        [0, 2, 1], [0, 3, 2],
        // top (y=h)
        [4, 5, 6], [4, 6, 7],
        // front (z=-hd)
        [0, 1, 5], [0, 5, 4],
        // back (z=+hd)
        [2, 3, 7], [2, 7, 6],
        // left (x=-hw)
        [3, 0, 4], [3, 4, 7],
        // right (x=+hw)
        [1, 2, 6], [1, 6, 5],
    ];

    return triangles.map(([a, b, c]) => ({
        v1: v[a], v2: v[b], v3: v[c],
    }));
}

function computeNormal(v1, v2, v3) {
    const ax = v2[0] - v1[0], ay = v2[1] - v1[1], az = v2[2] - v1[2];
    const bx = v3[0] - v1[0], by = v3[1] - v1[1], bz = v3[2] - v1[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
}

function writeBinarySTL(triangles, outputPath) {
    const numTri = triangles.length;
    const bufSize = 80 + 4 + numTri * 50;
    const buf = Buffer.alloc(bufSize);

    // 80-byte header
    buf.write('KenCreations Keycap Template', 0, 'ascii');
    // triangle count
    buf.writeUInt32LE(numTri, 80);

    let offset = 84;
    for (const { v1, v2, v3 } of triangles) {
        const [nx, ny, nz] = computeNormal(v1, v2, v3);
        buf.writeFloatLE(nx, offset); offset += 4;
        buf.writeFloatLE(ny, offset); offset += 4;
        buf.writeFloatLE(nz, offset); offset += 4;

        for (const v of [v1, v2, v3]) {
            buf.writeFloatLE(v[0], offset); offset += 4;
            buf.writeFloatLE(v[1], offset); offset += 4;
            buf.writeFloatLE(v[2], offset); offset += 4;
        }

        buf.writeUInt16LE(0, offset); offset += 2; // attribute byte count
    }

    fs.writeFileSync(outputPath, buf);
    console.log(`✅ Wrote ${numTri} triangles to ${outputPath} (${buf.length} bytes)`);
}

// Generate a simple solid 18×18×8 box
const triangles = makeBox(W, D, H);
const outPath = path.join(__dirname, '..', 'public', 'models', 'keycaps', 'template.stl');
writeBinarySTL(triangles, outPath);
