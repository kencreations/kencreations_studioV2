import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { generateAdvancedTypography as before, trace } from './before.js';
import arial from '../../src/assets/fonts/ARIAL.json';
import titan from '../../src/assets/fonts/TitanOne.json';
import coiny from '../../src/assets/fonts/Coiny.json';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import coinyURL from '../../src/assets/fonts/Coiny.ttf?url';
import capURL from '../../src/assets/models/popsocket.3mf?url';

const mode = new URLSearchParams(location.search).get('mode');
const presets = ['chunky-rounded', 'groovy-vertical', 'organic-circular'];
let font = new FontLoader().parse(mode === 'before' ? arial : mode === 'titan' ? titan : coiny);
const points = p => p.getPoints(16).map(v => `${v.x},${-v.y}`).join(' L');
const svg = (shapes, radius = 17.5) => `<svg viewBox="-22 -22 44 44"><circle r="19.5" fill="#faf5ed"/><circle r="${radius}" fill="none" stroke="#b7bfc8" stroke-width=".15" stroke-dasharray=".7 .7"/>${shapes.map((s,i)=>`<path d="M${points(s)} Z ${s.holes.map(h=>`M${points(h)} Z`).join(' ')}" fill="${['#e76f51','#2a9d8f','#6b5b95','#dfae2d','#457b9d','#bf5b99'][i%6]}" fill-rule="evenodd" stroke="#24384a" stroke-width=".04"/>`).join('')}<path d="M-1 0 H1 M0 -1 V1" stroke="#222" stroke-width=".1"/></svg>`;
function card(title, subtitle, child) {
 const div = document.createElement('div'); div.className='card'; div.innerHTML=`<h3>${title}</h3><small>${subtitle}</small>`;
 if(typeof child==='string')div.innerHTML+=child; else div.append(child);
 document.querySelector('#grid').append(div);
}
try {
 if(mode==='after')font=new FontLoader().parse(new TTFLoader().parse(await (await fetch(coinyURL)).arrayBuffer()));
 document.querySelector('#title').textContent=`${mode}: actual contours and cap + extruded text`;
 const cap = await new ThreeMFLoader().loadAsync(capURL);
 let geo; cap.traverse(c=>{if(c.isMesh&&!geo)geo=c.geometry.clone();});
 geo.computeBoundingBox(); const center=geo.boundingBox.getCenter(new THREE.Vector3()); geo.translate(-center.x,-center.y,-center.z);
 geo.computeBoundingBox(); const size=geo.boundingBox.getSize(new THREE.Vector3());
 if(size.z<size.x&&size.z<size.y)geo.rotateX(-Math.PI/2); else if(size.x<size.y&&size.x<size.z)geo.rotateZ(Math.PI/2);
 geo.rotateX(Math.PI);geo.computeBoundingBox();geo.translate(0,-geo.boundingBox.min.y,0);geo.computeBoundingBox();
 const top=geo.boundingBox.max.y;
 const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(600,600);
 const camera = new THREE.PerspectiveCamera(32,1,.1,500);camera.position.set(0,84,39);camera.lookAt(0,3,0);
 window.metrics=[];
 for(const preset of presets)for(const text of ['KEN','CAMI','ALDRIN','MY NAME']) {
   const options={text,font,size:8,stylePreset:preset,plateRadius:19.5,blobIntensity:2,roundness:1,compactness:1,edgeMargin:2,fillIntensity:90,autoFit:true,depth:1.5};
   let shapes,geometry,diagnostic;
   if(mode==='before') {
     shapes=before(options); const winner=trace.reduce((a,b)=>a.area>b.area?a:b);
     card(`${preset} / ${text}`,'Before word inflation (native mm)',svg(winner.before));
     card('After word inflation',`offset ${winner.inflationAmount.toFixed(2)} mm`,svg(winner.inflated));
     card('Final fitted outlines',`${shapes.length} shapes, ${shapes.reduce((n,s)=>n+s.holes.length,0)} counters`,svg(shapes));
     const chunky=preset==='chunky-rounded';
     geometry=new THREE.ExtrudeGeometry(shapes,{depth:1.5,bevelEnabled:true,bevelThickness:chunky?.6:.9,bevelSize:chunky?.925:(preset==='groovy-vertical'?1.825:2.225),bevelSegments:chunky?4:6,curveSegments:chunky?8:12});geometry.rotateX(-Math.PI/2);
     diagnostic={text,preset,beforeShapes:winner.before.length,beforeCounters:winner.before.reduce((n,s)=>n+s.holes.length,0),afterShapes:shapes.length,afterCounters:shapes.reduce((n,s)=>n+s.holes.length,0)};
   } else {
     const { generateTypographyLayout, createTypographyGeometry }=await import('../../src/utils/advancedTypography.js');
     const layout=generateTypographyLayout(options);shapes=layout.shapes;geometry=createTypographyGeometry(layout,1.5);
     card(`${preset} / ${text}`,'Original glyphs / fitted placement',svg(layout.glyphs.flatMap(g=>g.original)));
     card('Constrained glyph outlines',`bevel ${layout.bevelSize.toFixed(3)} mm`,svg(shapes));
     card('Order + safe region',`${layout.rows.join(' / ')} · ink ${(layout.coverage*100).toFixed(1)}%`,svg(shapes));
     diagnostic={text,preset,...layout.metrics,rows:layout.rows,coverage:layout.coverage,bevelSize:geometry.userData.bevelSize};
   }
   const scene=new THREE.Scene();scene.background=new THREE.Color('#eef0f3');
   scene.add(new THREE.HemisphereLight(0xffffff,0x8b8e99,1.8));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-25,60,35);scene.add(light);
   scene.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#E63946',roughness:.55})));
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#F1FAEE',roughness:.42}));mesh.position.y=top;scene.add(mesh);
   renderer.render(scene,camera);const image=new Image();image.src=renderer.domElement.toDataURL();image.style.width='300px';image.style.height='300px';card('3D preview','Unmodified cap geometry / same text mesh as export',image);
   window.metrics.push(diagnostic);geometry.dispose();
 }
 const gallery=document.createElement('div');gallery.id='gallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(3,320px);gap:12px;padding:12px;width:984px';
 [...document.querySelectorAll('.card')].filter((_,i)=>i%4===3 && Math.floor(i/4)%4!==3).forEach((card,i)=>{
   const copy=card.cloneNode(true);copy.querySelector('h3').textContent=`${presets[Math.floor(i/3)]} / ${['KEN','CAMI','ALDRIN'][i%3]}`;gallery.append(copy);
 });document.body.append(gallery);
 renderer.dispose();window.done=true;
}catch(e){window.failure=e.stack;throw e;}
