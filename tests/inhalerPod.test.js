import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import opentype from 'opentype.js';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {unzipSync,strFromU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {POD_DEFAULTS,podConfig} from '../src/data/inhalerPodDefaults.js';
import {initPodKernel,buildPod,podSolid,podDimensions,podPlacement,podPrintScene} from '../src/utils/inhalerPodGeometry.js';
import {serializeModel,disposeExportScene} from '../src/engine/export/modelExport.js';
await initPodKernel();
const bytes=readFileSync('src/assets/fonts/BebasNeue.ttf');
const ot=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const font={generateShapes(text,size){const path=new THREE.ShapePath();for(const c of ot.getPath(text,0,0,size).commands){
if(c.type==='M')path.moveTo(c.x,-c.y);if(c.type==='L')path.lineTo(c.x,-c.y);if(c.type==='Q')path.quadraticCurveTo(c.x1,-c.y1,c.x,-c.y);if(c.type==='C')path.bezierCurveTo(c.x1,-c.y1,c.x2,-c.y2,c.x,-c.y);if(c.type==='Z')path.currentPath.closePath();}return path.toShapes();}};
const dispose=parts=>Object.values(parts).forEach(g=>g.dispose());
function inspect(g){const solid=podSolid(g);assert.equal(solid.status(),'NoError');assert.ok(solid.volume()>0);const pieces=solid.decompose();assert.equal(pieces.length,1);pieces.forEach(p=>p.delete());solid.delete();
const p=g.attributes.position,ix=g.index;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-16,'zero-area face');}}
test('templates cannot enable pickup or claim verified dimensions',()=>{const c=podConfig({pickupEnabled:true,physicallyVerified:true,diameter:NaN});assert.equal(c.pickupEnabled,false);assert.equal(c.physicallyVerified,false);assert.equal(c.diameter,16);});
for(const [name,patch] of Object.entries({default:{},minimum:{diameter:12,length:45,exposure:20,wall:1.6,threadLength:8},maximum:{diameter:30,length:100,wall:3.2,armThickness:1.6,loopClearance:0.4},fit:{printMode:'fitTest'},embossed:{personalized:true,text:'KEN',textStyle:'embossed'},engraved:{personalized:true,text:'KEN',textStyle:'engraved'}}))test(`${name}: all three connected manifold parts and print layout`,()=>{
const c=podConfig({...POD_DEFAULTS,...patch});const parts=buildPod(c,font);assert.equal(Object.keys(parts).length,3);Object.values(parts).forEach(inspect);
const scene=podPrintScene(c,parts);const boxes=scene.children.map(m=>new THREE.Box3().setFromObject(m));for(const b of boxes)assert.ok(Math.abs(b.min.z)<1e-5);for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].min.x>boxes[i-1].max.x);disposeExportScene(scene);dispose(parts);
});
test('loop remains captured without cap; installed parts clear and thread follows opening path',()=>{
const c=podConfig(POD_DEFAULTS),d=podDimensions(c),parts=buildPod(c),body=podSolid(parts.body),loop=podSolid(parts.loop),cap=podSolid(parts.cap);
const installed=loop.translate([0,0,d.loopSeat]);let overlap=body.intersect(installed);assert.ok(Math.abs(overlap.volume())<1e-3);overlap.delete();
const pulled=loop.translate([0,0,d.loopSeat+1]);overlap=body.intersect(pulled);assert.ok(overlap.volume()>0.01,'retention arms must encounter bead');overlap.delete();
for(const turns of [0,0.25,0.5,0.75,1]){const flip=cap.rotate([180,0,0]),spin=flip.rotate([0,0,turns*360]),placed=spin.translate([0,0,d.capSeat+turns*c.threadLength]);overlap=body.intersect(placed);assert.ok(Math.abs(overlap.volume())<1e-3,`thread collision at ${turns}: ${overlap.volume()}`);overlap.delete();placed.delete();spin.delete();flip.delete();}
installed.delete();pulled.delete();body.delete();loop.delete();cap.delete();dispose(parts);
});
test('full kit STL and 3MF reimport as three manifold solids; preview and reference never affect export',async()=>{
const c=podConfig({...POD_DEFAULTS,personalized:true,text:'POD',textStyle:'embossed'}),parts=buildPod(c,font);let previous;
for(const viewMode of ['assembled','exploded']){const scene=podPrintScene({...c,viewMode,showReference:true},parts);assert.equal(scene.children.length,3);
const stl=await(await serializeModel(scene,'stl')).arrayBuffer();if(previous)assert.deepEqual(new Uint8Array(stl),previous);previous=new Uint8Array(stl);
const g=new STLLoader().parse(stl),solid=podSolid(g),pieces=solid.decompose();assert.equal(pieces.length,3);pieces.forEach(p=>p.delete());solid.delete();g.dispose();
const files=unzipSync(new Uint8Array(await(await serializeModel(scene,'3mf')).arrayBuffer()));const doc=new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']),'text/xml');assert.equal(doc.documentElement.getAttribute('unit'),'millimeter');
for(const mesh of [...doc.getElementsByTagName('mesh')]){const pos=[...mesh.getElementsByTagName('vertex')].flatMap(v=>['x','y','z'].map(k=>Number(v.getAttribute(k))));const idx=[...mesh.getElementsByTagName('triangle')].flatMap(t=>['v1','v2','v3'].map(k=>Number(t.getAttribute(k))));const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);inspect(geo);geo.dispose();}
assert.ok(doc.getElementsByTagName('m:colorgroup').length>0,'text color preserved');disposeExportScene(scene);}
dispose(parts);
});
for(const part of ['body','cap','loop'])test(`${part} only export contains exactly one part`,()=>{const c=podConfig({printMode:part}),parts=buildPod(c),scene=podPrintScene(c,parts);assert.equal(scene.children.length,1);assert.equal(scene.children[0].name,`Pod_${part}`);disposeExportScene(scene);dispose(parts);});
test('exploded parts stay coaxial and above housing, original capped envelope fits without pickup',()=>{const c=podConfig(POD_DEFAULTS),d=podDimensions(c);assert.ok(c.floor+c.length<d.capSeat-c.floor);assert.ok(d.inner>c.diameter/2);assert.ok(podPlacement({...c,viewMode:'exploded'},'loop').z>d.bodyHeight);assert.ok(podPlacement({...c,viewMode:'exploded'},'cap').z-d.capHeight>d.bodyHeight);});
test('accessory tab clears housing and cap; exploded bounds preserve complete vertical sequence',()=>{
    for(const patch of [{},{holeDiameter:6,threadLength:8,exposure:20},{diameter:30,length:100,wall:3.2}]){
        const c=podConfig(patch),parts=buildPod(c),placed={};
        for(const [part,g] of Object.entries(parts)){
            const t=podPlacement(c,part),solid=podSolid(g),rotated=solid.rotate([t.rx*180/Math.PI,0,0]);
            placed[part]=rotated.translate([0,0,t.z]);rotated.delete();solid.delete();
        }
        for(const pair of [['body','loop'],['cap','loop'],['body','cap']]){
            const overlap=placed[pair[0]].intersect(placed[pair[1]]);assert.ok(Math.abs(overlap.volume())<1e-3,pair.join('/'));overlap.delete();
        }
        const boxes={};for(const [part,g] of Object.entries(parts)){
            g.computeBoundingBox();const t=podPlacement({...c,viewMode:'exploded'},part),m=new THREE.Matrix4().makeRotationX(t.rx);m.setPosition(0,0,t.z);boxes[part]=g.boundingBox.clone().applyMatrix4(m);
        }
        assert.ok(boxes.loop.min.z>boxes.body.max.z);assert.ok(boxes.cap.min.z>boxes.loop.max.z);
        Object.values(placed).forEach(s=>s.delete());dispose(parts);
    }
});
