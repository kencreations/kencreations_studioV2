import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { createContainerGeometry, containerLayout, personalizeLid, RADIAL_SEGMENTS, initializeContainerKernel, containerSolid } from '../src/utils/screwContainerGeometry.js';
import { serializeModel } from '../src/engine/export/modelExport.js';
await initializeContainerKernel();
const c = {innerDiameter:40, innerHeight:25, wallThickness:2.5, bottomThickness:1.5, threadHeight:6, lidHeight:12, clearance:0.25, containerStyle:'classic', printMode:'full'};
function volume(g) {
 const p=g.attributes.position, ix=g.index; let v=0;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
 for(let i=0;i<(ix?.count??p.count);i+=3){ a.fromBufferAttribute(p,ix?ix.getX(i):i);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1);d.fromBufferAttribute(p,ix?ix.getX(i+2):i+2);v+=a.dot(b.cross(d))/6; }
 return v;
}
for (const style of ['classic','knurled']) for(const fit of [false,true]) for(const part of ['body','lid']) test(`${style} ${part} fit=${fit}: closed oriented shell above bed`,()=>{
 const g=createContainerGeometry({...c,containerStyle:style},part,fit),edges=new Map(),p=g.attributes.position,ix=g.index;
 assert.ok(volume(g)>0);
 g.computeBoundingBox();assert.equal(g.boundingBox.min.z,0);
 for(let i=0;i<ix.count;i+=3){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
 const a=new THREE.Vector3().fromBufferAttribute(p,ids[0]),b=new THREE.Vector3().fromBufferAttribute(p,ids[1]),d=new THREE.Vector3().fromBufferAttribute(p,ids[2]);
 assert.ok(b.sub(a).cross(d.sub(a)).lengthSq()>1e-14,'nondegenerate triangle');
 for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':'); const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}}
 for(const e of edges.values())assert.deepEqual(e,[2,0]);g.dispose();
});
test('layout is centered, separated, and single parts are centered',()=>{
 const l=containerLayout(c);assert.ok(l.bodyX<0&&l.lidX>0);assert.ok(RADIAL_SEGMENTS>=256);
 for(const printMode of ['body','lid']){const l=containerLayout({...c,printMode});assert.equal(l.bodyX,0);assert.equal(l.lidX,0);}
});
test('personalization removes/adds actual material on exterior and stays above bed',()=>{
 const bytes=readFileSync('src/assets/fonts/BebasNeue.ttf');
 const ot=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const font={generateShapes(text,size){const path=new THREE.ShapePath();
 for(const c of ot.getPath(text,0,0,size).commands){
 if(c.type==='M')path.moveTo(c.x,-c.y);if(c.type==='L')path.lineTo(c.x,-c.y);
 if(c.type==='Q')path.quadraticCurveTo(c.x1,-c.y1,c.x,-c.y);
 if(c.type==='C')path.bezierCurveTo(c.x1,-c.y1,c.x2,-c.y2,c.x,-c.y);
 if(c.type==='Z')path.currentPath.closePath();}return path.toShapes();}};
 for(const personStyle of ['engraved','embossed']){
 const cfg={...c,personalized:true,personText:'DEMO',personSize:10,personDepth:0.8,personStyle};
 const shell=createContainerGeometry(cfg,'lid');const before=volume(shell);const result=personalizeLid(shell,cfg,font);
 assert.ok(personStyle==='engraved'?volume(result)<before:volume(result)>before);
 const solid=containerSolid(result),pieces=solid.decompose();assert.equal(pieces.length,1);assert.equal(solid.status(),'NoError');pieces.forEach(p=>p.delete());solid.delete();
 result.computeBoundingBox();assert.ok(result.boundingBox.min.z>=-1e-5);shell.dispose();result.dispose();
 }
});
test('real container geometry serializes to binary STL and zipped 3MF',async()=>{
 const scene=new THREE.Group();const layout=containerLayout(c);
 for(const part of ['body','lid']){const mesh=new THREE.Mesh(createContainerGeometry(c,part),new THREE.MeshStandardMaterial());mesh.position.x=part==='body'?layout.bodyX:layout.lidX;scene.add(mesh);}
 const stl=new DataView(await (await serializeModel(scene,'stl')).arrayBuffer());assert.equal(stl.byteLength,84+stl.getUint32(80,true)*50);
 const mf=new Uint8Array(await (await serializeModel(scene,'3mf')).arrayBuffer());assert.deepEqual([...mf.slice(0,2)],[80,75]);
 scene.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
});

import { containerDimensions, previewPlacement, addBodyKeychainLoop, createContainerPrintScene } from '../src/utils/screwContainerGeometry.js';
import { SCREW_CONTAINER_DEFAULTS } from '../src/store/appState.js';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
const katinko = SCREW_CONTAINER_DEFAULTS;
test('initial/reset defaults select the actual 50 x 12.5 Katinko cavity and assembled mode',()=>{
 assert.equal(katinko.preset,'katinko');assert.equal(katinko.innerDiameter,50);assert.equal(katinko.innerHeight,12.5);
 assert.equal(katinko.viewMode,'assembled');assert.equal(katinko.addKeychainHole,false);
});
for(const cfg of [katinko,c,{...c,innerDiameter:55,innerHeight:35,threadHeight:7,lidHeight:14},
 {...c,innerDiameter:75,innerHeight:50,threadHeight:8,lidHeight:16},
 {...c,innerDiameter:15,innerHeight:8,threadHeight:20,lidHeight:40,addKeychainHole:true}])
 test(`mating surfaces clear at diameter ${cfg.innerDiameter}, height ${cfg.innerHeight}, thread ${cfg.threadHeight}`,()=>{
 const config={...cfg,containerStyle:'knurled'}, d=containerDimensions(config);
 const body=new THREE.Mesh(createContainerGeometry(config,'body'),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const lid=new THREE.Mesh(createContainerGeometry(config,'lid'),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const seated=previewPlacement({...config,viewMode:'assembled'},'lid');lid.rotation.x=seated.rotationX;lid.position.z=seated.z;
 body.updateMatrixWorld();lid.updateMatrixWorld();
 assert.ok(Math.abs(seated.z-d.floor-d.bodyHeight)<1e-8);
 const exploded=previewPlacement({...config,viewMode:'exploded'},'lid');assert.ok(exploded.z-d.lidHeight>d.bodyHeight);
 assert.ok(Math.abs(d.bodyHeight-d.skirt-d.flangeHeight)<1e-8);
 const ray=new THREE.Raycaster();
 for(let j=0;j<8;j++)for(let i=0;i<8;i++){
 const z=d.bodyHeight-d.threadLength+0.4+(d.threadLength-0.8)*j/7,angle=i*Math.PI/4;
 ray.set(new THREE.Vector3(0,0,z),new THREE.Vector3(Math.cos(angle),Math.sin(angle),0));
 const b=ray.intersectObject(body), l=ray.intersectObject(lid);
 assert.ok(b.length&&l.length);const clearance=l[0].distance-b.at(-1).distance;
 assert.ok(clearance>0.02,`mating interference: ${clearance} at z=${z}, angle=${angle}`);
 }
 body.geometry.dispose();lid.geometry.dispose();body.material.dispose();lid.material.dispose();
});
test('body attachment has a clear through-hole and sits below the lid sweep',()=>{
 const cfg={...katinko,addKeychainHole:true},d=containerDimensions(cfg);
 const shell=createContainerGeometry(cfg,'body'),body=addBodyKeychainLoop(shell,cfg);
 assert.ok(volume(body)>volume(shell));
 const mesh=new THREE.Mesh(body,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
 const ray=new THREE.Raycaster(new THREE.Vector3(-d.flangeRadius-4,0,10),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(mesh).length,0,'hole remains open');
 ray.set(new THREE.Vector3(-d.flangeRadius-4,3.5,10),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>=2,'reinforcement has thickness');
 ray.set(new THREE.Vector3(-d.neck+0.4,0,d.bodyHeight+10),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>=2,'tab root overlaps body wall');
 assert.ok(Math.abs(d.bodyHeight-d.skirt-d.flangeHeight)<1e-8);body.computeBoundingBox();assert.ok(body.boundingBox.min.z>=-1e-5);
 shell.dispose();body.dispose();mesh.material.dispose();
});
test('both preview modes export identical separated, bed-oriented STL and 3MF including loop',async()=>{
 const cfg={...katinko,addKeychainHole:true};const raw=createContainerGeometry(cfg,'body');
 const geos={body:addBodyKeychainLoop(raw,cfg),lid:createContainerGeometry(cfg,'lid')};raw.dispose();
 let priorStl;
 for(const viewMode of ['assembled','exploded']){
 const scene=createContainerPrintScene({...cfg,viewMode},geos);scene.updateMatrixWorld(true);
 const boxes=scene.children.map(m=>new THREE.Box3().setFromObject(m));
 assert.ok(boxes[0].max.x<boxes[1].min.x);for(const box of boxes)assert.ok(Math.abs(box.min.z)<1e-5);
 const stl=new Uint8Array(await (await serializeModel(scene,'stl')).arrayBuffer());
 if(priorStl)assert.deepEqual(stl,priorStl);priorStl=stl;
 const files=unzipSync(new Uint8Array(await (await serializeModel(scene,'3mf')).arrayBuffer()));
 const doc=new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']),'text/xml');
 assert.equal(doc.getElementsByTagName('mesh').length,2);
 assert.ok(doc.getElementsByTagName('triangle').length>10000);
 for(const m of scene.children){m.geometry.dispose();m.material.dispose();}
 }
 geos.body.dispose();geos.lid.dispose();
});

test('finished shells are single closed manifold solids, including lug and fit rings',()=>{
 for(const containerStyle of ['classic','knurled']) for(const printMode of ['full','fitTest']) {
 const cfg={...katinko,containerStyle,printMode,addKeychainHole:true};
 for(const part of ['body','lid']){
 const raw=createContainerGeometry(cfg,part,printMode==='fitTest');
 const geo=part==='body'?addBodyKeychainLoop(raw,cfg):raw;
 const solid=containerSolid(geo),pieces=solid.decompose();
 assert.equal(solid.status(),'NoError');assert.equal(pieces.length,1);assert.ok(solid.volume()>0);
 for(const piece of pieces)piece.delete();solid.delete();
 const p=geo.attributes.position,ix=geo.index,a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
 for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));d.fromBufferAttribute(p,ix.getX(i+2));assert.ok(b.sub(a).cross(d.sub(a)).lengthSq()>1e-16);}
 if(geo!==raw)geo.dispose();raw.dispose();
 }
 }
});
test('right-handed screw motion clears actual solids through one turn',()=>{
 for(const preset of [katinko,c,{...c,innerDiameter:75,innerHeight:50,threadHeight:8},
 {...katinko,clearance:0.05,containerStyle:'knurled'}]){
 const body=createContainerGeometry(preset,'body'),lid=createContainerGeometry(preset,'lid');
 const a=containerSolid(body),b=containerSolid(lid),d=containerDimensions(preset);
 for(const turns of [0,0.125,0.25,0.5,0.75,1, d.engagementTurns]){
 const flipped=b.rotate([180,0,0]),spun=flipped.rotate([0,0,360*turns]);
 const seated=spun.translate([0,0,d.bodyHeight+d.floor+turns*d.pitch]);
 const overlap=a.intersect(seated);
 assert.ok(Math.abs(overlap.volume())<1e-3,`collision at ${turns} turns, volume ${overlap.volume()}`);
 overlap.delete();seated.delete();spun.delete();flipped.delete();
 }
 a.delete();b.delete();body.dispose();lid.dispose();
 }
});
