/**
 * generate-better-keycap.cjs
 *
 * Generates an OEM-profile-like keycap STL.
 * A truncated pyramid with a curved top.
 * Corrected axes: Z is UP, Y is Depth, X is Width.
 */
const fs = require('fs');
const path = require('path');

// Dimensions
const BASE_W = 18;
const BASE_D = 18;
const TOP_W = 12;
const TOP_D = 14;
const H = 8.5;
const DISH_DEPTH = 1.0;

function makeKeycap() {
    const triangles = [];
    
    // Bottom vertices (Z = 0, Y is depth)
    const b0 = [-BASE_W/2, -BASE_D/2, 0];
    const b1 = [ BASE_W/2, -BASE_D/2, 0];
    const b2 = [ BASE_W/2,  BASE_D/2, 0];
    const b3 = [-BASE_W/2,  BASE_D/2, 0];

    // Top vertices (before dish) (Z = H)
    const t0 = [-TOP_W/2, -TOP_D/2, H];
    const t1 = [ TOP_W/2, -TOP_D/2, H];
    const t2 = [ TOP_W/2,  TOP_D/2, H];
    const t3 = [-TOP_W/2,  TOP_D/2, H];

    // Function to add a quad (2 triangles)
    // Note: winding order (counter-clockwise) matters for normals
    const addQuad = (v0, v1, v2, v3) => {
        triangles.push({ v1: v0, v2: v1, v3: v2 });
        triangles.push({ v1: v0, v2: v2, v3: v3 });
    };

    // Bottom face
    addQuad(b3, b2, b1, b0);
    // Front face (Y is negative depth)
    addQuad(b0, b1, t1, t0);
    // Back face (Y is positive depth)
    addQuad(b2, b3, t3, t2);
    // Left face
    addQuad(b3, b0, t0, t3);
    // Right face
    addQuad(b1, b2, t2, t1);

    // Top face with a cylindrical dish
    const res = 10;
    for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
            const x0 = -TOP_W/2 + (TOP_W/res)*i;
            const x1 = -TOP_W/2 + (TOP_W/res)*(i+1);
            const y0 = -TOP_D/2 + (TOP_D/res)*j;
            const y1 = -TOP_D/2 + (TOP_D/res)*(j+1);
            
            // Dish function (cylindrical along X axis)
            const getHz = (x, y) => {
                // normalized y from -1 to 1
                const ny = (y / (TOP_D/2));
                // Parabola: depth is max at ny=0, 0 at ny=±1
                return H - DISH_DEPTH * (1 - ny*ny);
            };

            const p00 = [x0, y0, getHz(x0, y0)];
            const p10 = [x1, y0, getHz(x1, y0)];
            const p11 = [x1, y1, getHz(x1, y1)];
            const p01 = [x0, y1, getHz(x0, y1)];

            addQuad(p00, p10, p11, p01);
        }
    }

    return triangles;
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

const triangles = makeKeycap();
const bufSize = 80 + 4 + triangles.length * 50;
const buf = Buffer.alloc(bufSize);
buf.write('KenCreations Better Keycap Template', 0, 'ascii');
buf.writeUInt32LE(triangles.length, 80);

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
    buf.writeUInt16LE(0, offset); offset += 2;
}

const outPath = path.join(__dirname, '..', 'public', 'models', 'keycaps', 'template.stl');
fs.writeFileSync(outPath, buf);
console.log(`✅ Wrote better keycap template to ${outPath} (${buf.length} bytes)`);
