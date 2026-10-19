import * as THREE from 'three';
import Module from 'manifold-3d';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { podConfig } from '../data/inhalerPodDefaults.js';
export const POD_SEGMENTS = 192;
let kernel, ready;
export function initPodKernel(url) {
    if (!ready) ready = Module(url ? { locateFile: () => url } : {}).then(m => {m.setup();kernel=m;return m;});
    return ready;
}
export function podSolid(g, color) {
    if (!kernel) throw new Error('Pod geometry engine is loading.');
    const p=g.attributes.position, vc=g.attributes.color;
    const props=color||vc?6:3, data=new Float32Array(p.count*props);
    const rgb=color?new THREE.Color(color):null;
    for(let i=0;i<p.count;i++) {
        data.set([p.getX(i),p.getY(i),p.getZ(i)],i*props);
        if(props===6)data.set(rgb?rgb.toArray():[vc.getX(i),vc.getY(i),vc.getZ(i)],i*props+3);
    }
    const mesh=new kernel.Mesh({numProp:props,vertProperties:data,
        triVerts:g.index?new Uint32Array(g.index.array):Uint32Array.from({length:p.count},(_,i)=>i)});
    mesh.merge();const solid=new kernel.Manifold(mesh);
    if(solid.status()!=='NoError'){const status=solid.status();solid.delete();throw new Error(`Pod mesh: ${status}`);}
    return solid;
}
function fromSolid(solid) {
    if(solid.status()!=='NoError')throw new Error(`Pod operation: ${solid.status()}`);
    const m=solid.getMesh(), p=[], colors=[];
    for(let i=0;i<m.vertProperties.length;i+=m.numProp){p.push(...m.vertProperties.slice(i,i+3));if(m.numProp>=6)colors.push(...m.vertProperties.slice(i+3,i+6));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    if(colors.length)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.triVerts),1));
    const creased=toCreasedNormals(g,Math.PI/3),smooth=mergeVertices(creased,1e-5);g.dispose();creased.dispose();return smooth;
}
function combine(aGeo,bGeo,subtract=false,colors=[]) {
    const a=podSolid(aGeo,colors[0]),b=podSolid(bGeo,colors[1]);let result;
    try{result=subtract?a.subtract(b):a.add(b);return fromSolid(result);}finally{a.delete();b.delete();result?.delete();}
}
// Closed Z-up solid of revolution. Seams and axis poles share indices.
function revolve(profile) {
    const p=[],ix=[],rings=[];
    for(const [r,z] of profile){const ring=[];for(let i=0;i<(r===0?1:POD_SEGMENTS);i++){
        const a=i*2*Math.PI/POD_SEGMENTS, radius=typeof r==='function'?r(a):r;
        ring.push(p.length/3);p.push(radius*Math.cos(a),radius*Math.sin(a),z);
    }rings.push(ring);}
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<POD_SEGMENTS;i++){
        const a=rings[j],b=rings[j+1],k=(i+1)%POD_SEGMENTS;
        if(a.length===1)ix.push(a[0],b[k],b[i]);else if(b.length===1)ix.push(a[i],a[k],b[0]);
        else ix.push(a[i],a[k],b[k],a[i],b[k],b[i]);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function podDimensions(input) {
    const c=podConfig(input), fit=c.printMode==='fitTest';
    const inner=c.diameter/2+c.fitClearance, neck=inner+c.wall, depth=0.8;
    const groove=neck+depth+1.3, bead=groove+0.85;
    const loopInner=groove+c.loopClearance+c.armThickness+0.6, loopOuter=loopInner+3;
    const loopHeight=2.8, grooveHeight=loopHeight+2*c.loopClearance;
    const bodyHeight=fit?c.threadLength+12:c.floor+c.length-c.exposure;
    const threadStart=bodyHeight-c.threadLength;
    const seat=threadStart-3.2-grooveHeight;
    const bodyRadius=loopInner+1;
    const capInner=neck+c.threadClearance, capRadius=bead+c.threadClearance+c.wall+0.6;
    const headspace=fit?1:c.exposure+c.axialClearance;
    const threadMouth=c.floor+headspace+c.threadLength;
    const bellHeight=3.2,capHeight=threadMouth+bellHeight,capBellRadius=bead+c.threadClearance+c.wall;
    const capRound=Math.min(6,capRadius-capInner+c.floor-0.9,capHeight/2);
    const baseRound=Math.min(7,bodyRadius-inner+c.floor-0.8,seat/2);
    const tabDrop=11,tabReach=10;
    return {inner,neck,depth,groove,bead,loopInner,loopOuter,loopHeight,grooveHeight,capRound,baseRound,tabDrop,tabReach,
        bodyHeight,threadStart,seat,bodyRadius,capInner,capRadius,headspace,capHeight,threadMouth,bellHeight,capBellRadius,
        capSeat:bodyHeight+headspace+c.floor,loopSeat:seat+c.loopClearance,
        pickupEnabled:false,verified:false};
}
function ridge(z,a,pitch){const phase=((z/pitch-a/(2*Math.PI))%1+1)%1;return Math.max(0,Math.min(1,(0.4-Math.abs(phase-0.5))/0.2));}
export function makePodBody(input) {
    const c=podConfig(input),d=podDimensions(c),r=d.bodyRadius;
    const round=d.baseRound,p=[[0,0],[r-round,0]];
    // Rounded lower shoulder with a flat printable foot.
    for(let i=1;i<=24;i++){const a=i*Math.PI/48;p.push([r-round+round*Math.sin(a),round-round*Math.cos(a)]);}
    p.push([r,d.seat-0.3],[r-0.3,d.seat],[d.groove,d.seat],
        [d.groove,d.seat+d.grooveHeight],[d.bead,d.seat+d.grooveHeight],
        [d.bead,d.seat+d.grooveHeight+0.5],[d.neck,d.threadStart], [d.neck,d.threadStart+0.02]);
    const steps=Math.ceil(c.threadLength/0.12);
    for(let i=1;i<steps;i++){const t=c.threadLength*i/steps;p.push([a=>d.neck+d.depth*ridge(t,a,c.threadLength)*Math.min(1,t/0.5,(c.threadLength-t)/0.5),d.threadStart+t]);}
    p.push([d.neck-0.2,d.bodyHeight],[d.inner+0.2,d.bodyHeight],[d.inner,d.bodyHeight-0.2],
        [d.inner,c.floor],[0,c.floor]);return revolve(p);
}
export function makePodCap(input) {
    const c=podConfig(input),d=podDimensions(c),r=d.capRadius,round=d.capRound;
    const p=[[0,0],[r-round,0]];
    const crownHeight=Math.min(d.capHeight*0.65,d.capHeight-2);
    for(let i=1;i<=32;i++){const a=i*Math.PI/64;p.push([r-round+round*Math.sin(a),crownHeight*(1-Math.cos(a))]);}
    // Broad crown and rolled lower edge form a pebble, with no bell-shaped skirt.
    for(let i=1;i<=24;i++){const a=i*Math.PI/48;p.push([r-0.6+0.6*Math.cos(a),crownHeight+(d.capHeight-crownHeight)*Math.sin(a)]);}
    p.push(
        [d.bead+c.threadClearance+0.15,d.capHeight]);
    const steps=Math.ceil((d.capHeight-c.floor-0.15)/0.1);
    for(let i=0;i<=steps;i++){
        const z=d.capHeight-0.15-(d.capHeight-c.floor-0.15)*i/steps;
        const t=c.threadLength-(z-c.floor-d.headspace);
        p.push([a=>z>d.threadMouth
            ? Math.max(d.capInner+d.depth, d.neck+(d.bead-d.neck)*Math.min(1,(z-d.threadMouth)/2.7)+c.threadClearance)
            : d.capInner+(z>=c.floor+d.headspace?d.depth*Math.max(ridge(t,-a,c.threadLength),Math.max(0,1-(d.threadMouth-z)/0.7)):0),z]);
    }
    p.push([0,c.floor]);return revolve(p);
}
function extrude(shape,height){return new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:48});}
export function makePodLoop(input) {
    const c=podConfig(input),d=podDimensions(c);
    const ring=new THREE.Shape();ring.absarc(0,0,d.loopOuter,0,Math.PI*2,false);
    const hole=new THREE.Path();hole.absarc(0,0,d.loopInner,0,Math.PI*2,true);ring.holes.push(hole);
    let result=extrude(ring,d.loopHeight);
    const inner=d.groove+c.loopClearance,outer=inner+c.armThickness;
    // Three tangential cantilevers inside an unbroken outer annulus. The bead
    // requires outward flex during insertion; the underside provides retention.
    for(let n=0;n<3;n++){
        const start=n*2*Math.PI/3,end=start+Math.PI*0.42;
        const arm=new THREE.Shape();
        arm.moveTo((d.loopInner+0.5)*Math.cos(start-0.12),(d.loopInner+0.5)*Math.sin(start-0.12));
        arm.lineTo((d.loopInner+0.5)*Math.cos(start),(d.loopInner+0.5)*Math.sin(start));
        arm.lineTo(outer*Math.cos(start),outer*Math.sin(start));arm.absarc(0,0,outer,start,end,false);
        arm.lineTo(inner*Math.cos(end),inner*Math.sin(end));arm.absarc(0,0,inner,end,start-0.12,true);
        arm.closePath();
        const tool=extrude(arm,d.loopHeight),merged=combine(result,tool);result.dispose();tool.dispose();result=merged;
    }
    // Downturned accessory ribbon, rather than a washer's horizontal screw lug.
    // Its rounded slot is extruded through Y; the ribbon stays outside the body.
    const x=d.loopOuter, lug=new THREE.Shape();
    lug.moveTo(x-1.4,2.8);lug.quadraticCurveTo(x+5,3,x+8,-2);
    lug.quadraticCurveTo(x+13,-10,x+7,-d.tabDrop);
    lug.quadraticCurveTo(x+2,-d.tabDrop-0.5,x+1,-6);
    lug.lineTo(x-1,-1);lug.closePath();
    const bore=new THREE.Shape();bore.absellipse(x+5.5,-5.3,c.holeDiameter/2,3.5,0,Math.PI*2,false,-0.3);
    const blank=extrude(lug,3.2),cutter=extrude(bore,5);cutter.translate(0,0,-0.9);
    const tool=combine(blank,cutter,true);blank.dispose();cutter.dispose();tool.rotateX(Math.PI/2);tool.translate(0,1.6,0);
    const merged=combine(result,tool);result.dispose();tool.dispose();return merged;
}
export function personalizePodCap(shell,input,font) {
    const c=podConfig(input),d=podDimensions(c);
    if(!c.personalized||!c.text.trim())return shell;
    if(!font)throw new Error('Personalization font is still loading.');
    const depth=Math.min(c.textDepth,c.floor-0.8);
    const shapes=font.generateShapes(c.text.trim(),10);
    const cutter=new THREE.ExtrudeGeometry(shapes,{depth:depth+0.1,bevelEnabled:false,curveSegments:16});
    cutter.computeBoundingBox();const b=cutter.boundingBox,size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.x)||size.x===0){cutter.dispose();throw new Error('Text has no printable outline.');}
    const scale=Math.min(1,2*(d.capRadius-d.capRound-0.8)/Math.hypot(size.x,size.y));
    cutter.translate(-center.x,-center.y,0);cutter.scale(scale,scale,1);cutter.rotateX(Math.PI);
    cutter.translate(0,0,c.textStyle==='engraved'?depth:0.1);
    try{return combine(shell,cutter,c.textStyle==='engraved',[c.capColor,c.textColor]);}finally{cutter.dispose();}
}
export function buildPod(input,font) {
    const c=podConfig(input),parts={};
    try{
        if(['kit','body','fitTest'].includes(c.printMode))parts.body=makePodBody(c);
        if(['kit','cap','fitTest'].includes(c.printMode)){
            const shell=makePodCap(c);parts.cap=shell;
            if(c.printMode!=='fitTest'){const decorated=personalizePodCap(shell,c,font);if(decorated!==shell)shell.dispose();parts.cap=decorated;}
        }
        if(['kit','loop','fitTest'].includes(c.printMode))parts.loop=makePodLoop(c);
        return parts;
    }catch(error){Object.values(parts).forEach(g=>g.dispose());throw error;}
}
export function podPlacement(input,part) {
    const c=podConfig(input),d=podDimensions(c),pair=['kit','fitTest'].includes(c.printMode),gap=c.viewMode==='exploded'&&pair?10:0;
    if(part==='body')return {z:0,rx:0};
    const loopZ=d.bodyHeight+d.tabDrop+gap;
    if(part==='loop')return {z:pair?(gap?loopZ:d.loopSeat):d.tabDrop+1,rx:0};
    return {z:pair?(gap?loopZ+d.loopHeight+gap+d.capHeight:d.capSeat):d.capHeight,rx:Math.PI};
}
export function podPrintScene(input,parts) {
    const c=podConfig(input),scene=new THREE.Group();let cursor=0;
    for(const part of ['body','cap','loop'])if(parts[part]){
        const geo=parts[part].clone();
        // Loop top face on bed; the downturned ribbon rises in print orientation.
        if(part==='loop')geo.rotateX(Math.PI);
        geo.computeBoundingBox();const b=geo.boundingBox;
        const width=b.max.x-b.min.x;geo.translate(-b.min.x,0,-b.min.z);
        const vc=!!geo.attributes.color;
        const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:vc?'#ffffff':c[part+'Color'],vertexColors:vc}));
        mesh.name=`Pod_${part}`;mesh.position.x=cursor;scene.add(mesh);cursor+=width+8;
    }
    for(const mesh of scene.children)mesh.position.x-=(cursor-8)/2;
    scene.updateMatrixWorld(true);return scene;
}

