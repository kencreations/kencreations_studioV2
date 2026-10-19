import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

import {
    createContainerGeometry,
    containerLayout,
    containerDimensions,
    previewPlacement,
    addBodyKeychainLoop,
    addBodyPushOutHole,
    getPushOutHoleLimits,
    clampPushOutHoleDiameter,
    createContainerPrintScene,
    initializeContainerKernel,
    containerSolid,
} from '../src/utils/screwContainerGeometry.js';
import { SCREW_CONTAINER_DEFAULTS } from '../src/store/appState.js';
import { serializeModel } from '../src/engine/export/modelExport.js';

await initializeContainerKernel();

const baseConfig = {
    innerDiameter: 50,
    innerHeight: 12.5,
    wallThickness: 2.0,
    bottomThickness: 1.2,
    threadHeight: 10,
    lidHeight: 10,
    clearance: 0.25,
    containerStyle: 'classic',
    printMode: 'full',
    viewMode: 'assembled',
};

function computeMeshVolume(geometry) {
    const solid = containerSolid(geometry);
    const vol = solid.volume();
    solid.delete();
    return vol;
}

test('1. Default state: push-out hole is OFF by default and preserves solid base', () => {
    assert.equal(SCREW_CONTAINER_DEFAULTS.pushOutHoleEnabled, false);
    assert.equal(SCREW_CONTAINER_DEFAULTS.pushOutHoleDiameterMm, 12);

    // Old saved configs without pushOutHoleEnabled default to false
    const oldSavedConfig = { ...baseConfig };
    assert.equal(oldSavedConfig.pushOutHoleEnabled, undefined);

    const raw = createContainerGeometry(oldSavedConfig, 'body');
    const withModifier = addBodyPushOutHole(raw, oldSavedConfig);

    // When disabled, returns identical shell without running boolean
    assert.equal(withModifier, raw);

    // Verify center of base is solid
    const mesh = new THREE.Mesh(raw, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const rayCenter = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    const hits = rayCenter.intersectObject(mesh);
    assert.ok(hits.length >= 2, 'Solid base stops raycast through center');

    raw.dispose();
    mesh.material.dispose();
});

test('2. Parametric behavior: push-out hole cuts clean circular through-hole through bottom floor only', () => {
    const cfg = {
        ...baseConfig,
        pushOutHoleEnabled: true,
        pushOutHoleDiameterMm: 12,
    };

    const raw = createContainerGeometry(cfg, 'body');
    const solidVol = computeMeshVolume(raw);

    const bodyWithHole = addBodyPushOutHole(raw, cfg);
    assert.notEqual(bodyWithHole, raw);

    const holeVol = computeMeshVolume(bodyWithHole);
    // Cylinder removed = pi * r^2 * bottomThickness = pi * 6^2 * 1.2 ~= 135.7 mm^3
    const expectedRemoved = Math.PI * Math.pow(6, 2) * cfg.bottomThickness;
    const actualRemoved = solidVol - holeVol;
    assert.ok(
        Math.abs(actualRemoved - expectedRemoved) < 1.0,
        `Removed volume ${actualRemoved.toFixed(2)} should match cylinder volume ${expectedRemoved.toFixed(2)}`
    );

    // Raycast through center passes freely (0 hits)
    const mesh = new THREE.Mesh(bodyWithHole, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const rayCenter = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    const centerHits = rayCenter.intersectObject(mesh);
    assert.equal(centerHits.length, 0, 'Ray through center of push-out hole passes with 0 hits');

    // Raycast through surrounding floor shelf (e.g. at radius 16 mm > 6 mm hole radius, < 25 mm inner radius)
    const rayShelf = new THREE.Raycaster(new THREE.Vector3(16, 0, 5), new THREE.Vector3(0, 0, -1));
    const shelfHits = rayShelf.intersectObject(mesh);
    assert.ok(shelfHits.length >= 2, 'Supporting base shelf surrounding the hole remains solid');

    // Base rests flat on print bed at z = 0
    bodyWithHole.computeBoundingBox();
    assert.ok(Math.abs(bodyWithHole.boundingBox.min.z) < 1e-4, 'Base rests on print bed at z = 0');

    // Single manifold piece
    const solid = containerSolid(bodyWithHole);
    assert.equal(solid.status(), 'NoError');
    const pieces = solid.decompose();
    assert.equal(pieces.length, 1, 'Body with push-out hole is a single connected manifold solid');
    pieces.forEach(p => p.delete());
    solid.delete();

    raw.dispose();
    bodyWithHole.dispose();
    mesh.material.dispose();
});

test('3. Geometry constraints: safe limits and automatic clamping protect base integrity', () => {
    // Katinko 50mm inner diameter
    const limits50 = getPushOutHoleLimits(50);
    assert.equal(limits50.min, 3);
    // 50 - 6 = 44, 50 * 0.85 = 42.5 -> max is 42.5 mm
    assert.equal(limits50.max, 42.5);
    assert.equal(clampPushOutHoleDiameter(12, 50), 12);
    assert.equal(clampPushOutHoleDiameter(50, 50), 42.5, 'Clamped to safe maximum');
    assert.equal(clampPushOutHoleDiameter(1, 50), 3, 'Clamped to safe minimum');
    assert.equal(clampPushOutHoleDiameter(-5, 50), limits50.defaultDiameter, 'Invalid input defaults safely');
    assert.equal(clampPushOutHoleDiameter(NaN, 50), limits50.defaultDiameter, 'NaN defaults safely');

    // Small 15mm container
    const limits15 = getPushOutHoleLimits(15);
    assert.equal(limits15.min, 3);
    assert.equal(limits15.max, 9); // 15 - 6 = 9 mm
    assert.equal(clampPushOutHoleDiameter(20, 15), 9, 'Clamps when container diameter shrinks');

    // Ensure model does not break when oversized diameter is passed to addBodyPushOutHole
    const oversizedCfg = {
        ...baseConfig,
        innerDiameter: 15,
        pushOutHoleEnabled: true,
        pushOutHoleDiameterMm: 50, // oversized
    };
    const raw = createContainerGeometry(oversizedCfg, 'body');
    const bodyClamped = addBodyPushOutHole(raw, oversizedCfg);
    const solid = containerSolid(bodyClamped);
    assert.equal(solid.status(), 'NoError');
    solid.delete();
    raw.dispose();
    bodyClamped.dispose();
});

test('4. Combination: push-out hole works alongside knurled style and keychain loop', () => {
    for (const style of ['classic', 'knurled']) {
        const cfg = {
            ...baseConfig,
            containerStyle: style,
            pushOutHoleEnabled: true,
            pushOutHoleDiameterMm: 14,
            addKeychainHole: true,
        };

        const raw = createContainerGeometry(cfg, 'body');
        const withHole = addBodyPushOutHole(raw, cfg);
        const withLoopAndHole = addBodyKeychainLoop(withHole, cfg);

        const solid = containerSolid(withLoopAndHole);
        assert.equal(solid.status(), 'NoError');
        const pieces = solid.decompose();
        assert.equal(pieces.length, 1, `Style ${style} produces single manifold piece with hole + loop`);
        pieces.forEach(p => p.delete());
        solid.delete();

        // Check keychain hole remains open
        const d = containerDimensions(cfg);
        const mesh = new THREE.Mesh(withLoopAndHole, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        mesh.updateMatrixWorld();
        const rayLoop = new THREE.Raycaster(new THREE.Vector3(0, d.flangeRadius + 4, 10), new THREE.Vector3(0, 0, -1));
        assert.equal(rayLoop.intersectObject(mesh).length, 0, 'Keychain hole remains open');

        // Check push-out hole remains open
        const rayCenter = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
        assert.equal(rayCenter.intersectObject(mesh).length, 0, 'Push-out hole remains open');

        raw.dispose();
        withHole.dispose();
        withLoopAndHole.dispose();
        mesh.material.dispose();
    }
});

test('5. Fit test mode: push-out hole is ignored in fitTest print mode', () => {
    const fitCfg = {
        ...baseConfig,
        printMode: 'fitTest',
        pushOutHoleEnabled: true,
        pushOutHoleDiameterMm: 12,
    };
    const raw = createContainerGeometry(fitCfg, 'body', true);
    const withHole = addBodyPushOutHole(raw, fitCfg);
    assert.equal(withHole, raw, 'addBodyPushOutHole returns untouched shell in fitTest mode');
    raw.dispose();
});

test('6. Preview and exports: assembled and exploded modes export identical STL and 3MF with push-out hole', async () => {
    const cfg = {
        ...baseConfig,
        pushOutHoleEnabled: true,
        pushOutHoleDiameterMm: 14,
        addKeychainHole: true,
    };

    const raw = createContainerGeometry(cfg, 'body');
    const withHole = addBodyPushOutHole(raw, cfg);
    const bodyFinal = addBodyKeychainLoop(withHole, cfg);
    const lidFinal = createContainerGeometry(cfg, 'lid');
    raw.dispose();
    withHole.dispose();

    const geometries = { body: bodyFinal, lid: lidFinal };

    let priorStl;
    for (const viewMode of ['assembled', 'exploded']) {
        const scene = createContainerPrintScene({ ...cfg, viewMode }, geometries);
        scene.updateMatrixWorld(true);

        const boxes = scene.children.map(m => new THREE.Box3().setFromObject(m));
        // Both parts are on the bed and separated
        assert.ok(boxes[0].max.x < boxes[1].min.x, 'Parts are separated on X');
        for (const box of boxes) {
            assert.ok(Math.abs(box.min.z) < 1e-4, 'Exported parts rest on print bed at z = 0');
        }

        // Binary STL export check
        const stlBuffer = await (await serializeModel(scene, 'stl')).arrayBuffer();
        const stl = new Uint8Array(stlBuffer);
        assert.ok(stl.byteLength > 84);
        if (priorStl) {
            assert.deepEqual(stl, priorStl, 'Both preview modes export identical binary STL');
        }
        priorStl = stl;

        // 3MF export check
        const mfBuffer = await (await serializeModel(scene, '3mf')).arrayBuffer();
        const files = unzipSync(new Uint8Array(mfBuffer));
        const doc = new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']), 'text/xml');
        assert.equal(doc.getElementsByTagName('mesh').length, 2, '3MF contains both body and lid meshes');
        assert.ok(doc.getElementsByTagName('triangle').length > 10000);

        scene.children.forEach(m => {
            m.geometry.dispose();
            m.material.dispose();
        });
    }

    bodyFinal.dispose();
    lidFinal.dispose();
});
