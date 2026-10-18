import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DOMParser } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';
import { serializeModel, prepareExportScene, disposeExportScene } from '../src/engine/export/modelExport.js';
import { createExportRunner, saveModel } from '../src/services/exportWorkflow.js';
import { nextExportStats } from '../src/utils/exportStats.js';
import { normalizeGenerator, catalogStats, exportTotal, canonicalGeneratorId } from '../src/utils/generatorCatalog.js';

const box = color => new THREE.Mesh(new THREE.BoxGeometry(18, 18, 5), new THREE.MeshStandardMaterial({ color }));
function parseXml(text) {
    const errors = [];
    const doc = new DOMParser({ onError: (level, message) => errors.push(`${level}: ${message}`) }).parseFromString(text, 'application/xml');
    assert.deepEqual(errors, []);
    return doc;
}
test('3MF is a ZIP with valid OPC relationships, triangle references, parts, colors and escaped names', async () => {
    const scene = new THREE.Group(); const cap = box('#ff0000'); cap.name = 'A & "B" <keycap>'; scene.add(cap);
    const legend = box('#00ff00'); legend.position.x = 20; scene.add(legend);
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()));
    const blob = await serializeModel(scene, '3mf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 2)], [80, 75]);
    const files = unzipSync(bytes);
    for (const file of ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model', 'Metadata/model_settings.config']) assert.ok(files[file]);
    const rels = parseXml(strFromU8(files['_rels/.rels']));
    const target = rels.getElementsByTagName('Relationship')[0].getAttribute('Target');
    assert.ok(files[target.replace(/^\//, '')]);
    const doc = parseXml(strFromU8(files['3D/3dmodel.model']));
    assert.equal(doc.documentElement.getAttribute('unit'), 'millimeter');
    assert.equal(doc.getElementsByTagName('mesh').length, 2);
    assert.equal(doc.getElementsByTagName('base').length, 2);
    const objects = [...doc.getElementsByTagName('object')];
    assert.equal(objects[0].getAttribute('name'), 'A & "B" <keycap>');
    const ids = new Set(objects.map(o => o.getAttribute('id')));
    for (const tag of ['component', 'item']) for (const item of doc.getElementsByTagName(tag)) assert.ok(ids.has(item.getAttribute('objectid')));
    for (const mesh of doc.getElementsByTagName('mesh')) {
        const count = mesh.getElementsByTagName('vertex').length;
        for (const triangle of mesh.getElementsByTagName('triangle')) for (const key of ['v1', 'v2', 'v3']) assert.ok(Number(triangle.getAttribute(key)) < count);
    }
    parseXml(strFromU8(files['Metadata/model_settings.config']));
    assert.equal(JSON.parse(strFromU8(files['Metadata/project_settings.config'])).filament_colour.length, 2);
});
test('binary STL has the correct length, triangle count and native millimeter bounds', async () => {
    const blob = await serializeModel(box('#fff'), 'stl');
    const data = new DataView(await blob.arrayBuffer());
    assert.equal(data.getUint32(80, true), 12); assert.equal(data.byteLength, 84 + 12 * 50);
    const scene = prepareExportScene(box('#fff'));
    assert.deepEqual(new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).toArray(), [18, 18, 5]);
    disposeExportScene(scene);
});
test('vertex colors survive 3MF as per-corner material extension properties', async () => {
    const mesh = box('#fff'); const n = mesh.geometry.attributes.position.count;
    mesh.material.vertexColors = true;
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => i % 3 === 0 ? 1 : 0), 3));
    const files = unzipSync(new Uint8Array(await (await serializeModel(mesh, '3mf')).arrayBuffer()));
    const doc = parseXml(strFromU8(files['3D/3dmodel.model']));
    assert.equal(doc.getElementsByTagName('m:color')[0].getAttribute('color'), '#FF0000FF');
    assert.ok(doc.getElementsByTagName('triangle')[0].hasAttribute('p3'));
});
test('multi-material, instanced, nested and hidden meshes are handled without mutating originals', () => {
    const source = new THREE.Group(); const mesh = box('#f00');
    mesh.material = Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial());
    mesh.add(box('#0f0')); source.add(mesh);
    const hidden = box('#00f'); hidden.visible = false; source.add(hidden);
    const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 2); source.add(instances);
    const prepared = prepareExportScene(source);
    assert.equal(prepared.children.length, 9);
    assert.notEqual(prepared.children[0].geometry, mesh.geometry);
    disposeExportScene(prepared); assert.ok(mesh.geometry.attributes.position.count);
});
test('empty, NaN and out-of-range geometry cannot produce fake downloads', async () => {
    await assert.rejects(serializeModel(new THREE.Group(), '3mf'), /no printable/);
    const mesh = box('#fff'); mesh.geometry.attributes.position.setX(0, NaN);
    await assert.rejects(serializeModel(mesh, 'stl'), /invalid coordinates/);
    mesh.geometry.attributes.position.setX(0, 1); mesh.geometry.index.setX(0, 1000000);
    await assert.rejects(serializeModel(mesh, '3mf'), /invalid vertex index/);
});
test('authorization, failures, cancellation and repeated clicks never count exports', async () => {
    let saves = 0; let records = 0; let allowed = true;
    let finish; const serialization = new Promise(resolve => { finish = resolve; });
    const run = createExportRunner({ authorize: () => ({ allowed }), serialize: () => serialization, save: async () => { saves++; return { success: false, reason: 'canceled' }; }, record: () => records++ });
    const options = { getScene: () => ({}), format: '3mf', filename: 'model.3mf' };
    const first = run(options); assert.equal((await run(options)).reason, 'busy');
    finish(new Blob(['data'])); assert.equal((await first).reason, 'canceled'); assert.equal(records, 0);
    allowed = false; await run(options); assert.equal(saves, 1);
});
test('save success survives rejected analytics and save errors remain failures', async () => {
    const options = { getScene: () => ({}), format: 'stl', filename: 'model.stl' };
    const run = createExportRunner({ authorize: () => ({ allowed: true }), serialize: () => new Blob(), save: () => ({ success: true }), record: () => { throw Error('offline'); } });
    assert.equal((await run(options)).success, true);
    await assert.rejects(saveModel(new Blob(), 'model.stl', 'stl', { saveFileDialog: async () => ({ success: false, error: 'disk full' }) }), /disk full/);
});
test('statistics initialize missing counters, validate formats and preserve historical totals', () => {
    assert.deepEqual(nextExportStats({ stlExports: 5 }, '3mf'), { stlExports: 5, threeMfExports: 1, totalExports: 6 });
    assert.equal(nextExportStats({ totalExports: 100 }, 'stl').totalExports, 101);
    assert.throws(() => nextExportStats({}, 'png'));
    assert.throws(() => nextExportStats({ stlExports: -1 }, 'stl'));
    assert.equal(exportTotal({ totalExports: '9000' }), null);
    const g = normalizeGenerator('charms', { id: 'fake', totalExports: 5 });
    assert.equal(g.id, 'charms');
    assert.equal(catalogStats([g, { id: 'future', status: 'coming_soon', totalExports: 0 }]).availableCount, 1);
    assert.equal(catalogStats([g]).totalExports, 5);
    assert.equal(catalogStats([g, { id: 'missing' }]).totalExports, null);
    // Ready state treats missing as 0 and reconciles with historical counts
    assert.equal(catalogStats([g, { id: 'missing' }], { isReady: true }).totalExports, 5);
    // Single-format export resolution (e.g. historical namekeychain with stlExports only)
    assert.equal(exportTotal({ stlExports: 570 }), 570);
    assert.equal(exportTotal({ threeMfExports: 154 }), 154);
    assert.equal(exportTotal({ stlExports: 1, threeMfExports: 154 }), 155);
    // Canonical generator IDs resolve aliases
    assert.equal(canonicalGeneratorId('whistle-bagtag'), 'whistlebagtag');
    assert.equal(canonicalGeneratorId('whistlebagtag'), 'whistlebagtag');
    assert.equal(canonicalGeneratorId('clicker'), 'clicker-v2');
    assert.equal(canonicalGeneratorId('keycap-maker'), 'keycap-maker');
    // Mathematical consistency: total = stl + 3mf
    const statsSTL = nextExportStats({ stlExports: 570, totalExports: 570 }, 'stl');
    assert.equal(statsSTL.totalExports, statsSTL.stlExports + statsSTL.threeMfExports);
    const stats3MF = nextExportStats({ stlExports: 1, threeMfExports: 154, totalExports: 155 }, '3mf');
    assert.equal(stats3MF.totalExports, stats3MF.stlExports + stats3MF.threeMfExports);
});
