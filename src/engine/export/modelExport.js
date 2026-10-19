import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { exportTo3MF } from 'three-3mf-exporter';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const xml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

// Export only printable visible meshes. Own all resulting resources; never mutate
// or dispose the live R3F scene. Bake transforms without changing dimensions.
export function prepareExportScene(source) {
    if (!source) throw new Error('The model is not ready to export.');
    source.updateMatrixWorld(true);
    const result = new THREE.Scene();
    result.name = source.name || 'ExportScene';
    let partCount = 0;
    const addMeshTo = (target, node, matrix, instanceColor) => {
        const geometry = node.geometry;
        const positions = geometry?.getAttribute('position');
        if (!positions?.count) return; // e.g. a keycap with no legend
        const index = geometry.getIndex();
        const count = index?.count ?? positions.count;
        if (count % 3) throw new Error('Model geometry contains an incomplete triangle.');
        for (let i = 0; i < positions.count; i++) {
            if (![positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite)) throw new Error('Model geometry contains invalid coordinates.');
        }
        if (index) for (let i = 0; i < index.count; i++) {
            if (!Number.isInteger(index.getX(i)) || index.getX(i) < 0 || index.getX(i) >= positions.count) throw new Error('Model geometry contains an invalid vertex index.');
        }
        if (!matrix.elements.every(Number.isFinite) || Math.abs(matrix.determinant()) < 1e-12) throw new Error('Model has an invalid transform.');
        const groups = Array.isArray(node.material) ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
        if (!groups.length) throw new Error('Multi-material geometry has no material groups.');
        for (const group of groups) {
            const start = Math.max(group.start, geometry.drawRange.start);
            const end = Math.min(group.start + group.count, geometry.drawRange.start + geometry.drawRange.count, count);
            if (end <= start) continue;
            if (start % 3 || (end - start) % 3) throw new Error('Model material range splits a triangle.');
            const originalMaterial = Array.isArray(node.material) ? node.material[group.materialIndex] : node.material;
            if (!originalMaterial) throw new Error('Model is missing a material.');
            const out = new THREE.BufferGeometry();
            const vertices = new Float32Array((end - start) * 3);
            const colors = geometry.getAttribute('color');
            const colorValues = originalMaterial.vertexColors && colors ? new Float32Array(vertices.length) : null;
            // Reflection changes winding; restore outward-facing triangles.
            const mirrored = matrix.determinant() < 0;
            for (let i = start; i < end; i++) {
                const offset = i - start;
                const corner = offset % 3;
                const order = mirrored && corner !== 0 ? i + (corner === 1 ? 1 : -1) : i;
                const vertex = index ? index.getX(order) : order;
                const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
                if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Model transform produces invalid coordinates.');
                point.toArray(vertices, offset * 3);
                if (colorValues) {
                    const color = [colors.getX(vertex), colors.getY(vertex), colors.getZ(vertex)];
                    if (!color.every(Number.isFinite)) throw new Error('Model has invalid vertex colors.');
                    colorValues.set(color, offset * 3);
                }
            }
            out.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            if (colorValues) out.setAttribute('color', new THREE.BufferAttribute(colorValues, 3));
            out.computeVertexNormals();
            const material = originalMaterial.clone();
            if (instanceColor && material.color) material.color.multiply(instanceColor);
            const mesh = new THREE.Mesh(out, material);
            partCount++;
            // The upstream writer interpolates names without XML escaping.
            mesh.name = xml(node.name || `Part ${partCount}`);
            target.add(mesh);
        }
    };
    try {
        if (source.type === 'Scene') {
            const topChildren = source.children || [];
            for (const child of topChildren) {
                if (child.userData?.excludeFromExport || !child.visible) continue;
                if (child.isMesh) {
                    if (child.isInstancedMesh) {
                        for (let i = 0; i < child.count; i++) {
                            const local = new THREE.Matrix4(); child.getMatrixAt(i, local);
                            const color = child.instanceColor ? new THREE.Color() : null;
                            if (color) child.getColorAt(i, color);
                            addMeshTo(result, child, child.matrixWorld.clone().multiply(local), color);
                        }
                    } else {
                        addMeshTo(result, child, child.matrixWorld);
                    }
                } else if (child.isGroup || child.type === 'Group') {
                    const targetGroup = new THREE.Group();
                    targetGroup.name = xml(child.name || `Group ${result.children.length + 1}`);
                    child.traverseVisible(node => {
                        if (!node.isMesh || node.userData?.excludeFromExport) return;
                        for (let parent = node.parent; parent && parent !== child; parent = parent.parent) {
                            if (parent.userData?.excludeFromExport) return;
                        }
                        if (node.isInstancedMesh) {
                            for (let i = 0; i < node.count; i++) {
                                const local = new THREE.Matrix4(); node.getMatrixAt(i, local);
                                const color = node.instanceColor ? new THREE.Color() : null;
                                if (color) node.getColorAt(i, color);
                                addMeshTo(targetGroup, node, node.matrixWorld.clone().multiply(local), color);
                            }
                        } else {
                            addMeshTo(targetGroup, node, node.matrixWorld);
                        }
                    });
                    if (targetGroup.children.length > 0) {
                        result.add(targetGroup);
                    }
                }
            }
        } else {
            source.traverseVisible(node => {
                if (!node.isMesh || node.userData?.excludeFromExport) return;
                for (let parent = node.parent; parent; parent = parent.parent) {
                    if (parent.userData?.excludeFromExport) return;
                    if (parent === source) break;
                }
                if (node.isInstancedMesh) {
                    for (let i = 0; i < node.count; i++) {
                        const local = new THREE.Matrix4(); node.getMatrixAt(i, local);
                        const color = node.instanceColor ? new THREE.Color() : null;
                        if (color) node.getColorAt(i, color);
                        addMeshTo(result, node, node.matrixWorld.clone().multiply(local), color);
                    }
                } else addMeshTo(result, node, node.matrixWorld);
            });
        }
        if (!result.children.length) throw new Error('The model has no printable geometry yet.');
        result.updateMatrixWorld(true);
        return result;
    } catch (error) { disposeExportScene(result); throw error; }
}

export function disposeExportScene(scene) {
    const geometries = new Set(); const materials = new Set();
    scene?.traverse(node => {
        if (node.geometry) geometries.add(node.geometry);
        if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

// Retain upstream ZIP, assembly and slicer metadata. Add standard material/color
// resources so colors survive outside Bambu-specific project settings too.
async function build3MF(scene, printConfig) {
    const blob = await exportTo3MF(scene, printConfig);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    let model = strFromU8(files['3D/3dmodel.model']);
    const maxId = Math.max(...Array.from(model.matchAll(/<object id="(\d+)"/g), m => Number(m[1])));
    let nextId = maxId + 1;
    const baseId = nextId++;
    const allMeshes = [];
    scene.traverse(node => {
        if (node.isMesh) allMeshes.push(node);
    });
    const base = allMeshes.map(mesh => `<base name="${mesh.name}" displaycolor="#${(mesh.material.color || new THREE.Color()).getHexString().toUpperCase()}FF"/>`).join('');
    const resources = [`<basematerials id="${baseId}">${base}</basematerials>`];
    let partIndex = 0;
    model = model.replace(/<object ([^>]+)><mesh>([\s\S]*?)<\/mesh><\/object>/g, (_, attributes, meshXml) => {
        const mesh = allMeshes[partIndex];
        const materialIndex = partIndex++;
        const colors = mesh.geometry.getAttribute('color');
        if (colors && mesh.material.vertexColors) {
            const id = nextId++; const palette = []; const indices = []; const byHex = new Map();
            for (let i = 0; i < colors.count; i++) {
                const color = new THREE.Color().fromBufferAttribute(colors, i).multiply(mesh.material.color || new THREE.Color());
                const hex = `#${color.getHexString().toUpperCase()}FF`;
                if (!byHex.has(hex)) { byHex.set(hex, palette.length); palette.push(hex); }
                indices.push(byHex.get(hex));
            }
            resources.push(`<m:colorgroup id="${id}">${palette.map(color => `<m:color color="${color}"/>`).join('')}</m:colorgroup>`);
            let triangle = 0;
            meshXml = meshXml.replace(/<triangle ([^>]+)\/>/g, (match, attrs) => {
                const i = triangle++ * 3;
                return `<triangle ${attrs} pid="${id}" p1="${indices[i]}" p2="${indices[i + 1]}" p3="${indices[i + 2]}"/>`;
            });
        }
        return `<object ${attributes} pid="${baseId}" pindex="${materialIndex}"><mesh>${meshXml}</mesh></object>`;
    });
    if (partIndex !== allMeshes.length) throw new Error('3MF exporter returned an unexpected part layout.');
    model = model.replace('<model ', '<model xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" ')
        .replace('<resources>', `<resources>${resources.join('')}`);
    files['3D/3dmodel.model'] = strToU8(model);
    return new Blob([zipSync(files)], { type: 'model/3mf' });
}

export async function serializeModel(source, format, printConfig) {
    const scene = prepareExportScene(source);
    try {
        if (format === '3mf') return await build3MF(scene, printConfig);
        if (format === 'stl') return new Blob([new STLExporter().parse(scene, { binary: true })], { type: 'model/stl' });
        throw new Error('Unsupported export format.');
    } finally { disposeExportScene(scene); }
}
