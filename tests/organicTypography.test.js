import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import { generateTypographyLayout, createTypographyGeometry } from '../src/utils/advancedTypography.js';
import { organicLineArrangements } from '../src/utils/organicTypography.js';
import { overlaps, printable } from '../src/utils/typographyContours.js';
import { serializeModel } from '../src/engine/export/modelExport.js';
import { validateSurface } from './typography/meshChecks.js';

const font=new FontLoader().parse(JSON.parse(fs.readFileSync(new URL('../src/assets/fonts/Coiny.json',import.meta.url))));
const names=['KEN','NATE','CAMI','NAME','ALDRIN','HELLOPHOEZ','FAITH OVER FEAR'];
const counts={'1-line':1,'2-lines':2,'3-lines':3};
for(const text of names)for(const layoutMode of ['auto',...Object.keys(counts)])test(`organic: ${text} / ${layoutMode} — constraints, closed mesh, STL and 3MF`,async()=>{
    const options={font,text,stylePreset:'organic-circular',layoutMode};
    // These word-preserving forced arrangements cannot satisfy 0.6 mm features
    // on this fixed 39 mm cap. A reported fitting failure is the intended result.
    if(text==='FAITH OVER FEAR'&&['1-line','2-lines'].includes(layoutMode)) {
        assert.throws(()=>generateTypographyLayout(options),/features below 0.6 mm/);return;
    }
    const layout=generateTypographyLayout(options);
    if(counts[layoutMode])assert.equal(layout.rows.length,counts[layoutMode]);
    else assert.ok(layout.rows.length>=1&&layout.rows.length<=3);
    assert.equal(layout.glyphs.map(g=>g.char).join(''),text.replace(/ /g,''));
    assert.ok(layout.rows.every(row=>row.trim()));
    assert.equal(overlaps(layout.glyphs,.5).length,0,'actual polygon gap gate');
    for(const g of layout.glyphs){assert.equal(g.shapes.reduce((n,s)=>n+s.holes.length,0),g.originalCounters);assert.ok(printable(g.shapes,.6));}
    assert.ok(layout.quality.conformity>=0&&layout.quality.conformity<=1);
    if(layoutMode==='auto')assert.ok(layout.quality.conformity>.8);
    const geometry=createTypographyGeometry(layout);validateSurface(geometry);
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++)assert.ok(Math.hypot(positions.getX(i),positions.getZ(i))<=17.5+.001);
    const model=new THREE.Group();model.rotation.x=Math.PI/2;model.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#f1faee'})));
    const stl=new DataView(await (await serializeModel(model,'stl')).arrayBuffer());
    assert.equal(stl.byteLength,84+stl.getUint32(80,true)*50);
    assert.equal(stl.getUint32(80,true),positions.count/3);
    const files=unzipSync(new Uint8Array(await (await serializeModel(model,'3mf')).arrayBuffer()));
    for(const path of ['[Content_Types].xml','_rels/.rels','3D/3dmodel.model'])assert.ok(files[path]);
    const errors=[];const xml=new DOMParser({onError:(level,message)=>errors.push(`${level}: ${message}`)}).parseFromString(strFromU8(files['3D/3dmodel.model']),'application/xml');
    assert.deepEqual(errors,[]);assert.equal(xml.documentElement.getAttribute('unit'),'millimeter');
    assert.equal(xml.getElementsByTagName('triangle').length,positions.count/3);
    geometry.dispose();model.children[0].material.dispose();
});
test('explicit rows, short names and selected line counts are never silently changed',()=>{
    assert.deepEqual(organicLineArrangements('FAITH\nOVER\nFEAR','3-lines'),[['FAITH','OVER','FEAR']]);
    assert.deepEqual(organicLineArrangements('NA\nTE','auto'),[['NA','TE']]);
    assert.deepEqual(organicLineArrangements('NA\nTE','1-line'),[['NA TE']]);
    assert.throws(()=>organicLineArrangements('NA\nTE','3-lines'),/exactly 3/);
    assert.throws(()=>organicLineArrangements('AB','3-lines'),/at least 3/);
    assert.throws(()=>organicLineArrangements('NA\n\nTE','auto'),/Each entered line/);
    const layout=generateTypographyLayout({font,text:'NA\nTE',layoutMode:'2-lines',stylePreset:'organic-circular'});
    assert.deepEqual(layout.rows,['NA','TE']);
});
test('font injection, printing constraints and independent manual dimensions remain supported',()=>{
    const customFont=new FontLoader().parse(JSON.parse(fs.readFileSync(new URL('../src/assets/fonts/TitanOne.json',import.meta.url))));
    const options={font:customFont,text:'KEN',layoutMode:'1-line',stylePreset:'organic-circular',minGap:.7,minFeature:.5};
    const layout=generateTypographyLayout(options);assert.equal(overlaps(layout.glyphs,.7).length,0);
    const adjusted=generateTypographyLayout({...options,manualPlacement:true,glyphAdjustments:{1:{width:.95,height:.95,stretch:.1}}});
    validateSurface(createTypographyGeometry(adjusted));
    assert.throws(()=>generateTypographyLayout({...options,minGap:.1}),/Printing limits/);
    assert.throws(()=>generateTypographyLayout({...options,manualPlacement:true,glyphAdjustments:{0:{width:3}}}),/readable limits/);
});
