import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { generateTypographyLayout, createTypographyGeometry, resolveTypographyFont, typographyArea } from '../src/utils/advancedTypography.js';
import { serializeModel } from '../src/engine/export/modelExport.js';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

const font = new FontLoader().parse(JSON.parse(fs.readFileSync(new URL('../src/assets/fonts/Coiny.json', import.meta.url))));
const presets = ['chunky-rounded','groovy-vertical','organic-circular'];

import { validateSurface } from './typography/meshChecks.js';

for(const stylePreset of presets)for(const text of ['KEN','CAMI','ALDRIN','MY NAME'])test(`${stylePreset}: ${text} readable contours and closed exported text`,async()=>{
    const layout=generateTypographyLayout({font,text,stylePreset});
    assert.equal(layout.glyphs.map(g=>g.char).join(''),text.replace(/ /g,''));
    assert.equal(layout.metrics.collisions,0);
    assert.ok(layout.metrics.maxRadius<=17.5);
    for(const g of layout.glyphs) {
        assert.equal(g.shapes.reduce((n,s)=>n+s.holes.length,0),g.originalCounters);
        assert.ok(g.inflation<=.031);
    }
    assert.ok(layout.coverage>0&&layout.coverage<.8);
    assert.ok(Math.abs(typographyArea(layout.shapes)/(Math.PI*17.5**2)-layout.coverage)<.0001);
    const geometry=createTypographyGeometry(layout,1.5);
    validateSurface(geometry);
    assert.ok(Math.abs(geometry.boundingBox.min.y+.03)<.0001);
    assert.ok(Math.abs(geometry.boundingBox.max.y-1.47)<.0001);
    const scene=new THREE.Group();scene.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#f1faee'})));scene.rotation.x=Math.PI/2;
    const stl=await serializeModel(scene,'stl');const bytes=new DataView(await stl.arrayBuffer());
    assert.equal(bytes.byteLength,84+bytes.getUint32(80,true)*50);
    assert.equal(bytes.getUint32(80,true),geometry.attributes.position.count/3);
    const files=unzipSync(new Uint8Array(await (await serializeModel(scene,'3mf')).arrayBuffer()));
    for(const name of ['[Content_Types].xml','_rels/.rels','3D/3dmodel.model'])assert.ok(files[name]);
    const errors=[];
    const xml=new DOMParser({onError:(level,message)=>errors.push(`${level}: ${message}`)}).parseFromString(strFromU8(files['3D/3dmodel.model']),'application/xml');
    assert.deepEqual(errors,[]);
    assert.equal(xml.documentElement.getAttribute('unit'),'millimeter');
    assert.equal(xml.getElementsByTagName('triangle').length,geometry.attributes.position.count/3);
    geometry.dispose();scene.children[0].material.dispose();
});
test('counter protection includes A, D, R and P; unsupported data fails explicitly',()=>{
    const layout=generateTypographyLayout({font,text:'ADRP'});
    assert.equal(layout.metrics.counters,4);
    assert.throws(()=>generateTypographyLayout({font,text:'🙂'}),/does not contain/);
    assert.throws(()=>generateTypographyLayout({font,text:'A'.repeat(25)}),/24 characters/);
    assert.throws(()=>generateTypographyLayout({font,text:'KEN',size:NaN}),/Invalid/);
    assert.throws(()=>generateTypographyLayout({font,text:'KEN',size:24,autoFit:false}),/outside safe circle/);
    assert.throws(()=>generateTypographyLayout({font,text:'MY NAMEALDRIN'}),/Text cannot fit safely/);
});
test('manual placement validates final geometry and never silently re-fits user positions',()=>{
    const layout=generateTypographyLayout({font,text:'KEN',manualPlacement:true,glyphAdjustments:{0:{x:.1,rotation:1}}});
    assert.ok(layout.shapes.length);
    assert.throws(()=>generateTypographyLayout({font,text:'KEN',manualPlacement:true,glyphAdjustments:{0:{x:30}}}),/outside safe circle/);
    const base=generateTypographyLayout({font,text:'KEN'});
    const center=g=>new THREE.Box2().setFromPoints(g.shapes.flatMap(s=>s.getPoints())).getCenter(new THREE.Vector2());
    const delta=center(base.glyphs[1]).sub(center(base.glyphs[0]));
    assert.throws(()=>generateTypographyLayout({font,text:'KEN',manualPlacement:true,glyphAdjustments:{0:{x:delta.x,y:delta.y}}}),/gaps/);
    assert.throws(()=>generateTypographyLayout({font,text:'KEN',manualPlacement:true,glyphAdjustments:{0:{rotation:60}}}),/readable limits/);
});
test('radial 100% remains inside the safe region and shaping is deterministic',()=>{
    for(const stylePreset of presets) {
        const options={font,text:'ALDRIN',stylePreset,fillIntensity:100,blobIntensity:5,roundness:3,compactness:1};
        const a=generateTypographyLayout(options),b=generateTypographyLayout(options);
        assert.deepEqual(a.metrics,b.metrics);
        const geometry=createTypographyGeometry(a,0.5);validateSurface(geometry);geometry.dispose();
    }
});
test('legacy Titan One resolves without falling back to Arial; cap bytes are unchanged',()=>{
    const fonts=[{id:'ARIAL'},{id:'TitanOne'},{id:'Coiny'}];
    assert.equal(resolveTypographyFont(fonts,'Titan One').id,'TitanOne');
    assert.equal(resolveTypographyFont(fonts,'missing'),undefined);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/assets/models/popsocket.3mf',import.meta.url))).digest('hex'),'cbae80f9f089822d9ff1726e2f19c78ec1fddc50c3310fc1325b4bcb2ebbd7c0');
});
