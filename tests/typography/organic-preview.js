import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import fontURL from '../../src/assets/fonts/Coiny.ttf?url';
import capURL from '../../src/assets/models/popsocket.3mf?url';
const before=new URLSearchParams(location.search).get('mode')==='before';
const engine=before?await import('./checkpoint.js'):await import('../../src/utils/advancedTypography.js');
const font=new FontLoader().parse(new TTFLoader().parse(await (await fetch(fontURL)).arrayBuffer()));
const cap=await new ThreeMFLoader().loadAsync(capURL);
let capGeo;cap.traverse(n=>{if(n.isMesh&&!capGeo)capGeo=n.geometry.clone();});
capGeo.computeBoundingBox();const center=capGeo.boundingBox.getCenter(new THREE.Vector3());capGeo.translate(-center.x,-center.y,-center.z);
capGeo.computeBoundingBox();const dimensions=capGeo.boundingBox.getSize(new THREE.Vector3());
if(dimensions.z<dimensions.x&&dimensions.z<dimensions.y)capGeo.rotateX(-Math.PI/2);else if(dimensions.x<dimensions.y&&dimensions.x<dimensions.z)capGeo.rotateZ(Math.PI/2);
capGeo.rotateX(Math.PI);capGeo.computeBoundingBox();capGeo.translate(0,-capGeo.boundingBox.min.y,0);capGeo.computeBoundingBox();
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(540,540);
const camera=new THREE.OrthographicCamera(-22,22,22,-22,.1,200);camera.position.set(0,80,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
const path=shapes=>shapes.flatMap(s=>[s,...s.holes]).map(s=>`M${s.getPoints().map(p=>`${p.x},${-p.y}`).join(' L')} Z`).join(' ');
window.metrics=[];
document.querySelector('#title').textContent=`Organic Circular — ${before?'checkpoint before rework':'per-glyph envelope engine'}`;
for(const text of ['KEN','NATE','CAMI','NAME','ALDRIN','HELLOPHOEZ','FAITH OVER FEAR'])for(const layoutMode of ['auto','1-line','2-lines','3-lines']) {
    const card=document.createElement('div');card.className='card';card.innerHTML=`<h3>${text} · ${layoutMode}</h3>`;document.querySelector('#grid').append(card);
    try {
        const layout=engine.generateTypographyLayout({font,text,stylePreset:'organic-circular',layoutMode});
        card.innerHTML+=`<svg viewBox="-22 -22 44 44"><circle r="17.5" stroke="#a5b0be" fill="white" stroke-width=".12" stroke-dasharray=".4 .4"/><path d="${path(layout.shapes)}" fill="black" fill-rule="evenodd"/></svg>`;
        const geometry=engine.createTypographyGeometry(layout,1.5),scene=new THREE.Scene();scene.background=new THREE.Color('#eef0f3');
        scene.add(new THREE.HemisphereLight(0xffffff,0x8b8e99,1.8));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-25,60,35);scene.add(light);
        scene.add(new THREE.Mesh(capGeo,new THREE.MeshStandardMaterial({color:'#E63946',roughness:.55})));
        const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#F1FAEE',roughness:.42}));mesh.position.y=capGeo.boundingBox.max.y;scene.add(mesh);
        renderer.render(scene,camera);const image=new Image();image.src=renderer.domElement.toDataURL();card.append(image);
        const forced={'1-line':1,'2-lines':2,'3-lines':3}[layoutMode];
        const wrongMode=forced&&layout.rows.length!==forced;
        card.insertAdjacentHTML('beforeend',`<div>${layout.rows.join(' / ')} · ink ${(layout.coverage*100).toFixed(1)}%${layout.quality?` · contour ${(layout.quality.conformity*100).toFixed(0)}%`:''}</div><div class="warning">${wrongMode?'Selected line count was ignored.':(layout.warnings||[]).join(' ')}</div>`);
        window.metrics.push({text,layoutMode,rows:layout.rows,wrongMode:!!wrongMode,...layout.metrics,coverage:layout.coverage,quality:layout.quality,warnings:layout.warnings,bevel:geometry.userData.bevelSize});geometry.dispose();
    }catch(error){card.insertAdjacentHTML('beforeend',`<p class="error">${error.message}</p>`);window.metrics.push({text,layoutMode,error:error.message});}
}
renderer.dispose();window.done=true;
