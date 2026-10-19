import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import {
    createContainerGeometry,
    containerDimensions,
    previewPlacement,
    containerLayout,
    personalizeLid,
    createLidTextGeometry,
    addBodyKeychainLoop,
    addBodyPushOutHole,
    createContainerPrintScene,
    RADIAL_SEGMENTS,
    initializeContainerKernel,
    containerSolid
} from '../src/utils/screwContainerGeometry.js';
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

import { SCREW_CONTAINER_DEFAULTS } from '../src/store/appState.js';
const katinko = SCREW_CONTAINER_DEFAULTS;
test('initial/reset defaults select the actual 50 x 12.5 Katinko cavity and assembled mode',()=>{
 assert.equal(katinko.preset,'katinko');assert.equal(katinko.innerDiameter,50);assert.equal(katinko.innerHeight,12.5);
 assert.equal(katinko.viewMode,'assembled');assert.equal(katinko.addKeychainHole,false);
 assert.equal(katinko.attachmentPosition,'top');
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
test('body attachment defaults to 12 o’clock top lug with clear through-hole and smooth blends',()=>{
 const cfg={...katinko,addKeychainHole:true,attachmentPosition:'top'},d=containerDimensions(cfg);
 const shell=createContainerGeometry(cfg,'body'),body=addBodyKeychainLoop(shell,cfg);
 assert.ok(volume(body)>volume(shell));
 const mesh=new THREE.Mesh(body,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
 // Top lug (12 o'clock / +Y axis)
 const ray=new THREE.Raycaster(new THREE.Vector3(0,d.flangeRadius+4,10),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(mesh).length,0,'top hole remains open');
 ray.set(new THREE.Vector3(3.5,d.flangeRadius+4,10),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>=2,'right reinforcement has thickness');
 ray.set(new THREE.Vector3(-3.5,d.flangeRadius+4,10),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>=2,'left reinforcement has thickness');
 ray.set(new THREE.Vector3(0,d.neck+0.4,d.bodyHeight+10),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>=2,'tab root overlaps body wall');
 assert.ok(Math.abs(d.bodyHeight-d.skirt-d.flangeHeight)<1e-8);body.computeBoundingBox();assert.ok(body.boundingBox.min.z>=-1e-5);
 shell.dispose();body.dispose();mesh.material.dispose();
});
test('body attachment supports backward-compatible side lug when attachmentPosition is side',()=>{
 const cfg={...katinko,addKeychainHole:true,attachmentPosition:'side'},d=containerDimensions(cfg);
 const shell=createContainerGeometry(cfg,'body'),body=addBodyKeychainLoop(shell,cfg);
 assert.ok(volume(body)>volume(shell));
 const mesh=new THREE.Mesh(body,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
 const ray=new THREE.Raycaster(new THREE.Vector3(-d.flangeRadius-4,0,10),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(mesh).length,0,'side hole remains open');
 ray.set(new THREE.Vector3(-d.flangeRadius-4,3.5,10),new THREE.Vector3(0,0,-1));
 assert.ok(ray.intersectObject(mesh).length>=2,'side reinforcement has thickness');
 shell.dispose();body.dispose();mesh.material.dispose();
});
test('lid text orientation automatically aligns below top keychain lug with safe margin',()=>{
 const bytes=readFileSync('src/assets/fonts/BebasNeue.ttf');
 const ot=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const font={generateShapes(text,size){const path=new THREE.ShapePath();
 for(const cmd of ot.getPath(text,0,0,size).commands){
 if(cmd.type==='M')path.moveTo(cmd.x,-cmd.y);if(cmd.type==='L')path.lineTo(cmd.x,-cmd.y);
 if(cmd.type==='Q')path.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);
 if(cmd.type==='C')path.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);
 if(cmd.type==='Z')path.currentPath.closePath();}return path.toShapes();}};
 const cfgTop={...katinko,personalized:true,personText:'ALDRIN',personAutoFit:true,addKeychainHole:true,attachmentPosition:'top'};
 const info=createLidTextGeometry(cfgTop,font);
 assert.ok(info&&info.textGeo);
 info.textGeo.computeBoundingBox();
 const box=info.textGeo.boundingBox;
 const d=containerDimensions(cfgTop);
 assert.ok(Math.abs(box.min.y) < d.radius - 2.5, 'text respects top margin away from 12 o’clock lug');
 assert.ok(Math.abs((box.min.x + box.max.x) / 2) < 0.1, 'text is centered on attachment axis');
 info.textGeo.dispose();
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

test('screw top container multi-color 3MF export hierarchy, contact, orientation, and colors', async () => {
    const bytes = readFileSync('src/assets/fonts/BebasNeue.ttf');
    const ot = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const font = {
        generateShapes(text, size) {
            const path = new THREE.ShapePath();
            for (const cmd of ot.getPath(text, 0, 0, size).commands) {
                if (cmd.type === 'M') path.moveTo(cmd.x, -cmd.y);
                if (cmd.type === 'L') path.lineTo(cmd.x, -cmd.y);
                if (cmd.type === 'Q') path.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y);
                if (cmd.type === 'C') path.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y);
                if (cmd.type === 'Z') path.currentPath.closePath();
            }
            return path.toShapes();
        }
    };

    const buildGeos = (cfg) => {
        const rawBody = createContainerGeometry(cfg, 'body');
        const withHole = cfg.pushOutHoleEnabled ? addBodyPushOutHole(rawBody, cfg) : rawBody;
        if (withHole !== rawBody) rawBody.dispose();
        const withLug = cfg.addKeychainHole ? addBodyKeychainLoop(withHole, cfg) : withHole;
        if (withLug !== withHole) withHole.dispose();

        const shell = createContainerGeometry(cfg, 'lid');
        let finalLid = shell;
        let lidBase = null;
        let textGeo = null;

        if (cfg.personalized && cfg.personText?.trim()) {
            const textInfo = createLidTextGeometry(cfg, font);
            finalLid = personalizeLid(shell, cfg, font);
            if (textInfo) {
                if (cfg.personStyle === 'embossed') {
                    const shiftZ = textInfo.reliefDepth;
                    textInfo.textGeo.translate(0, 0, shiftZ);
                    textGeo = textInfo.textGeo;
                    const baseCopy = shell.clone();
                    baseCopy.translate(0, 0, shiftZ);
                    lidBase = baseCopy;
                } else {
                    textInfo.textGeo.dispose();
                }
            }
        }
        if (finalLid !== shell && finalLid !== lidBase) shell.dispose();

        return { body: withLug, lid: finalLid, lidBase, text: textGeo };
    };

    const disposeGeos = (geos) => {
        Object.values(geos).forEach(g => { if (g && typeof g.dispose === 'function') g.dispose(); });
    };

    // 1. No personalization
    {
        const cfg = { ...c, personalized: false, addKeychainHole: false };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, '3mf');
        const blob = await serializeModel(scene, '3mf');
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        const doc = new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']), 'text/xml');
        assert.equal(doc.getElementsByTagName('item').length, 2);
        assert.equal(doc.getElementsByTagName('mesh').length, 2);
        disposeGeos(geos);
    }

    // 2. Embossed text with one color (body == lid == text color)
    {
        const cfg = { ...c, personalized: true, personText: 'KEN', personStyle: 'embossed', bodyColor: '#14B8A6', lidColor: '#14B8A6', textColor: '#14B8A6' };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, '3mf');
        const blob = await serializeModel(scene, '3mf');
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        const doc = new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']), 'text/xml');
        assert.equal(doc.getElementsByTagName('item').length, 2, '2 build items on plate');
        assert.equal(doc.getElementsByTagName('mesh').length, 3, 'Body, LidBase, LidText meshes');
        const lidObj = Array.from(doc.getElementsByTagName('object')).find(o => o.getAttribute('name') === 'Personalized Lid');
        assert.ok(lidObj, 'Personalized Lid object exists as assembly');
        assert.equal(lidObj.getElementsByTagName('component').length, 2, 'Contains 2 sub-components');
        disposeGeos(geos);
    }

    // 3. Embossed text with different colors (Body, Lid, Text distinct)
    {
        const cfg = { ...c, personalized: true, personText: 'KEN', personStyle: 'embossed', bodyColor: '#14B8A6', lidColor: '#647D94', textColor: '#FFFFFF' };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, '3mf');
        const blob = await serializeModel(scene, '3mf');
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        const modelXml = strFromU8(files['3D/3dmodel.model']);
        const modelSettings = strFromU8(files['Metadata/model_settings.config']);
        const projectSettings = JSON.parse(strFromU8(files['Metadata/project_settings.config']));

        // Verify distinct extruder assignments
        assert.ok(modelSettings.includes('value="Lid Base"'));
        assert.ok(modelSettings.includes('value="Lid Text"'));
        assert.ok(modelSettings.includes('value="Container Body"'));
        assert.ok(modelSettings.includes('value="Personalized Lid"'));
        assert.deepEqual(projectSettings.filament_colour.slice(0, 3), ['#14b8a6', '#647d94', '#ffffff']);

        // Verify build items: exactly 2 items on the plate
        const doc = new DOMParser().parseFromString(modelXml, 'text/xml');
        assert.equal(doc.getElementsByTagName('item').length, 2);

        // Verify text overlap into lid roof: text top > lid base roof
        geos.lidBase.computeBoundingBox();
        geos.text.computeBoundingBox();
        assert.ok(geos.text.boundingBox.max.z > geos.lidBase.boundingBox.min.z, 'Text overlaps lid roof');

        disposeGeos(geos);
    }

    // 4. Engraved text
    {
        const cfg = { ...c, personalized: true, personText: 'KEN', personStyle: 'engraved' };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, '3mf');
        const blob = await serializeModel(scene, '3mf');
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        const doc = new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']), 'text/xml');
        assert.equal(doc.getElementsByTagName('mesh').length, 2, 'Engraved has 2 meshes');
        assert.equal(doc.getElementsByTagName('item').length, 2, '2 items on plate');
        disposeGeos(geos);
    }

    // 5. Short name: KEN & 6. Longer name: MY NAME
    for (const personText of ['KEN', 'MY NAME']) {
        const cfg = { ...c, personalized: true, personText, personStyle: 'embossed' };
        const geos = buildGeos(cfg);
        assert.ok(geos.text.attributes.position.count > 0);
        geos.text.computeBoundingBox();
        const width = geos.text.boundingBox.max.x - geos.text.boundingBox.min.x;
        assert.ok(width > 5 && width < c.innerDiameter + 10, `${personText} fits in circular boundary`);
        disposeGeos(geos);
    }

    // 7. Body Only
    {
        const cfg = { ...c, printMode: 'body', personalized: true, personText: 'KEN' };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, '3mf');
        const blob = await serializeModel(scene, '3mf');
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        const doc = new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']), 'text/xml');
        assert.equal(doc.getElementsByTagName('item').length, 1);
        assert.equal(doc.getElementsByTagName('mesh').length, 1);
        disposeGeos(geos);
    }

    // 8. Lid Only
    {
        const cfg = { ...c, printMode: 'lid', personalized: true, personText: 'KEN', personStyle: 'embossed' };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, '3mf');
        const blob = await serializeModel(scene, '3mf');
        const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        const doc = new DOMParser().parseFromString(strFromU8(files['3D/3dmodel.model']), 'text/xml');
        assert.equal(doc.getElementsByTagName('item').length, 1, 'Only Personalized Lid item on plate');
        assert.equal(doc.getElementsByTagName('mesh').length, 2, 'Lid Base and Lid Text meshes');
        disposeGeos(geos);
    }

    // 9. Full Container STL Export (single solid lid, text permanently attached)
    {
        const cfg = { ...c, printMode: 'full', personalized: true, personText: 'KEN', personStyle: 'embossed' };
        const geos = buildGeos(cfg);
        const scene = createContainerPrintScene(cfg, geos, 'stl');
        assert.equal(scene.children.length, 2, 'STL export scene has exactly Body and Lid meshes');
        const blob = await serializeModel(scene, 'stl');
        const dv = new DataView(await blob.arrayBuffer());
        assert.ok(dv.byteLength > 84);
        const triCount = dv.getUint32(80, true);
        assert.equal(dv.byteLength, 84 + triCount * 50, 'Valid binary STL structure');
        disposeGeos(geos);
    }

    // 10. Keychain hole enabled vs disabled
    {
        const cfgOn = { ...c, addKeychainHole: true };
        const geosOn = buildGeos(cfgOn);
        geosOn.body.computeBoundingBox();
        const widthOn = geosOn.body.boundingBox.max.y - geosOn.body.boundingBox.min.y;

        const cfgOff = { ...c, addKeychainHole: false };
        const geosOff = buildGeos(cfgOff);
        geosOff.body.computeBoundingBox();
        const widthOff = geosOff.body.boundingBox.max.y - geosOff.body.boundingBox.min.y;

        assert.ok(widthOn > widthOff, 'Keychain hole enabled adds lug extension at top (12 o clock)');
        disposeGeos(geosOn);
        disposeGeos(geosOff);
    }
});
