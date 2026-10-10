import * as THREE from 'three';
import Clipper from 'clipper-lib';
import { buildOrganicCandidates } from './organicTypography.js';

import { SCALE, MIN_GAP, MIN_FEATURE, clamp, area, holeCount, rings, clean, bounds, paths, offset, typographyArea, booleanShapes, validTopology, printable, countersRetained, inflateGlyph, openSmallCounters, overlaps, transformTypographyShapes } from "./typographyContours.js";
export { typographyArea, transformTypographyShapes } from "./typographyContours.js";
function lineBreaks(text, organic) {
    const chars = Array.from(text), result = [[text]], words = text.split(' ');
    
    // Word-based line breaks
    if (words.length > 1) {
        for (let i = 1; i < words.length; i++) {
            result.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
        }
        if (words.length >= 3) {
            result.push(words);
        }
    } 
    // Character-based fallback for single long words
    else if (chars.length >= 3) {
        // Generate ALL possible 2-line splits so the evaluator can pick the most physically balanced one.
        for (let i = 1; i < chars.length; i++) {
            result.push([chars.slice(0, i).join(''), chars.slice(i).join('')]);
        }
    }
    
    // Aggressive stacked layouts for organic
    if (organic) {
        if (words.length >= 3) {
            // e.g. 1 top, center stacked, 1 bottom
            result.push([words[0], words.slice(1, -1).join(' '), words.at(-1)]);
        }
        if (chars.length >= 8) {
            const n = Math.ceil(chars.length / 3);
            result.push([
                chars.slice(0, n).join('').trim(),
                chars.slice(n, n * 2).join('').trim(),
                chars.slice(n * 2).join('').trim()
            ]);
            const m = Math.ceil(chars.length / 4);
            if (chars.length >= 10) {
                result.push([
                    chars.slice(0, m).join('').trim(),
                    chars.slice(m, m * 2).join('').trim(),
                    chars.slice(m * 2, m * 3).join('').trim(),
                    chars.slice(m * 3).join('').trim()
                ]);
            }
        }
    }
    
    // Filter empty rows
    return result.filter(rows => rows.every(row => row.length > 0));
}

function getCircleConformity(shapes, numSamples = 72) {
    const buckets = new Array(numSamples).fill(0);
    for (const ring of rings(shapes)) {
        for (const p of clean(ring)) {
            const angle = Math.atan2(p.y, p.x);
            let index = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * numSamples);
            if (index === numSamples) index = 0;
            const r = p.length();
            if (r > buckets[index]) buckets[index] = r;
        }
    }
    const maxR = Math.max(...buckets, 1e-6);
    let sum = 0, sumSq = 0, minR = maxR;
    for (const r of buckets) {
        sum += r;
        sumSq += r * r;
        if (r < minR) minR = r;
    }
    const avgR = sum / numSamples;
    const variance = (sumSq / numSamples) - (avgR * avgR);
    const stdDev = Math.sqrt(Math.max(0, variance));
    
    return {
        avgCoverage: avgR / maxR,
        minCoverage: minR / maxR,
        smoothness: 1.0 - (stdDev / maxR)
    };
}
function compose(rows, options, arched) {
    const {font,size,stylePreset,letterSpacing,compactness,blobIntensity}=options;
    const organic=stylePreset==='organic-circular', groovy=stylePreset==='groovy-vertical';
    // Remove the severe negative clamping to allow users to use negative letter spacing
    const gap=size*(0.13/clamp(compactness,.5,2))+letterSpacing;
    let index=0, top=0;const glyphs=[];
    rows.forEach((row,rowIndex)=>{
        let x=0;const line=[], chars=Array.from(row), count=chars.filter(c=>c!==' ').length;let n=0;
        for(const char of chars) {
            if(char===' '){x+=size*.35;continue;}
            const source=font.generateShapes(char,size);const {center,size:extent}=bounds(source);
            const u=count===1?0:(n/(count-1)*2-1), strength=clamp(blobIntensity/2,0,1.5);
            
            // Groovy gets no global X/Y scale here, handled entirely in contour deformation
            // Organic gets a slight uniform baseline stretch before envelope fitting
            const sx = organic ? 1 + Math.cos(n * 1.8) * 0.045 : 1;
            const sy = organic ? 1.1 : 1;
            const angle=organic&&arched?-u*.055:0;
            
            let shapes=transformTypographyShapes(source,p=>{
                let px=(p.x-center.x)*sx;
                let py=(p.y-center.y)*sy;
                
                if (groovy) {
                    const normY = py / Math.max(extent.y, 0.1);
                    const normX = px / Math.max(extent.x, 0.1);
                    
                    // Mild tapering for asymmetric width
                    const taper = 1 + Math.sin(n * 2.3) * 0.12 * normY * strength;
                    px *= taper;
                    
                    // Gentle S-curve (one wave per letter)
                    const waveX = Math.sin(normY * Math.PI + n) * 0.4 * strength;
                    
                    // Controlled variable stroke width (swelling)
                    const swell = Math.cos(normY * Math.PI * 1.5 - n) * 0.25 * strength;
                    px += waveX + (px > 0 ? swell : -swell);
                    
                    // Subtle flowing baseline and top
                    const waveY = Math.sin(normX * Math.PI + n * 1.5) * 0.3 * strength;
                    py += waveY;
                    
                    // Mild per-letter height variations
                    const hScale = 1 + Math.sin(n * 3.7) * 0.08 * strength;
                    py *= hScale;
                    
                    // Very slight rotation
                    const gRot = Math.sin(n * 1.4) * 0.05 * strength;
                    const rx = px * Math.cos(gRot) - py * Math.sin(gRot);
                    const ry = px * Math.sin(gRot) + py * Math.cos(gRot);
                    
                    return new THREE.Vector2(rx, ry);
                }
                
                return new THREE.Vector2(px*Math.cos(angle)-py*Math.sin(angle),px*Math.sin(angle)+py*Math.cos(angle));
            });
            const box=bounds(shapes), stagger=groovy?Math.sin(n*1.9)*size*.06:organic&&arched?(1-u*u)*size*.1*(rowIndex===0?1:-1):0;
            shapes=transformTypographyShapes(shapes,p=>p.add(new THREE.Vector2(x-box.box.min.x,stagger)));
            line.push({char,index:index++,row:rowIndex,shapes,originalCounters:holeCount(source)});x+=box.size.x+gap;n++;
        }
        const b=bounds(line.flatMap(g=>g.shapes)), rowY=top-b.box.max.y;
        for(const g of line)g.shapes=transformTypographyShapes(g.shapes,p=>p.add(new THREE.Vector2(-b.center.x,rowY)));
        glyphs.push(...line);top-=b.size.y+gap*1.05;
    });
    const center=bounds(glyphs.flatMap(g=>g.shapes)).center;
    return glyphs.map(g=>({...g,shapes:transformTypographyShapes(g.shapes,p=>p.sub(center))}));
}
function radius(shapes) {return shapes.reduce((r,s)=>s.getPoints().reduce((v,p)=>Math.max(v,p.length()),r),0);}
function applyTrueCircularEnvelope(glyphs, options) {
    const strength = clamp(options.blobIntensity / 2, 0.4, 1.0);
    if (strength <= 0.01) return glyphs;
    
    // 1. Pre-justify rows to ensure the text block forms a solid rectangle
    const rowIndices = [...new Set(glyphs.map(g => g.row))];
    let maxW = 0;
    const rowBounds = rowIndices.map(r => {
        const rowGlyphs = glyphs.filter(g => g.row === r);
        const box = bounds(rowGlyphs.flatMap(g => g.shapes));
        if (box.size.x > maxW) maxW = box.size.x;
        return { r, box };
    });
    
    let justifiedGlyphs = glyphs.map(g => {
        const rb = rowBounds.find(b => b.r === g.row);
        if (rb.box.size.x < 0.1) return g;
        
        const stretchX = maxW / rb.box.size.x;
        const safeStretchX = Math.min(stretchX, 1.35); // max 35% horizontal stretch for justification
        
        const shapes = transformTypographyShapes(g.shapes, p => {
            const px = (p.x - rb.box.center.x) * safeStretchX + rb.box.center.x;
            return new THREE.Vector2(px, p.y);
        });
        return { ...g, shapes };
    });
    
    // 2. Map the justified rectangular block to a circle using Elliptical Grid Mapping
    const box = bounds(justifiedGlyphs.flatMap(g => g.shapes));
    const W = box.size.x / 2;
    const H = box.size.y / 2;
    if (W < 0.1 || H < 0.1) return justifiedGlyphs;
    
    const targetRadius = W; 
    
    return justifiedGlyphs.map(g => {
        const shapes = transformTypographyShapes(g.shapes, p => {
            const nx = clamp((p.x - box.center.x) / W, -1, 1);
            const ny = clamp((p.y - box.center.y) / H, -1, 1);
            
            // Elliptical Grid Mapping: perfectly maps the square [-1, 1] to the unit circle
            const mappedX = nx * Math.sqrt(1 - (ny * ny) / 2);
            const mappedY = ny * Math.sqrt(1 - (nx * nx) / 2);
            
            const targetX = box.center.x + mappedX * targetRadius;
            const targetY = box.center.y + mappedY * targetRadius;
            
            const finalX = p.x + (targetX - p.x) * strength;
            const finalY = p.y + (targetY - p.y) * strength;
            
            return new THREE.Vector2(finalX, finalY);
        });
        return { ...g, shapes };
    });
}
function evaluate(glyphs, safeRadius, constraints = {}) {
    const shapes=glyphs.flatMap(g=>g.shapes), collisions=overlaps(glyphs,constraints.minGap??MIN_GAP), reasons=[];
    if(radius(shapes)>safeRadius+1e-4)reasons.push('outside safe circle');
    if(collisions.length)reasons.push('letter gaps below 0.5 mm');
    if(glyphs.some(g=>holeCount(g.shapes)!==g.originalCounters))reasons.push('lost counters');
    if(glyphs.some(g=>!validTopology(g.shapes)))reasons.push('invalid outlines');
    for(let i=1;i<glyphs.length;i++)if(glyphs[i].row===glyphs[i-1].row&&bounds(glyphs[i].shapes).center.x<=bounds(glyphs[i-1].shapes).center.x) {
        reasons.push('reading order reversed');break;
    }
    if(glyphs.some(g=>!printable(g.shapes,constraints.minFeature??MIN_FEATURE)))reasons.push(`features below 0.6 mm (${glyphs.filter(g=>!printable(g.shapes,constraints.minFeature??MIN_FEATURE)).map(g=>g.char).join(', ')})`);
    return {reasons,collisions};
}
export function generateTypographyLayout(input) {
    const options={size:8,stylePreset:'chunky-rounded',plateRadius:19.5,letterSpacing:0,compactness:1,blobIntensity:2,edgeMargin:2,fillIntensity:90,autoFit:true,roundness:1,...input};
    const {font,stylePreset,autoFit}=options;
    const rawText=String(options.text||'').trim();
    const text=rawText.replace(/\s+/g,' ');
    if(!text)return {shapes:[],glyphs:[],rows:[],bevelSize:0,coverage:0,metrics:{},candidates:[],safeRadius:options.plateRadius-options.edgeMargin};
    if(!font?.data?.glyphs)throw new Error('The selected font is not ready.');
    if(Array.from(text).length>24)throw new Error('Use at most 24 characters on this 39 mm cap.');
    const missing=Array.from(text).find(c=>!font.data.glyphs[c]);
    if(missing)throw new Error(`The selected font does not contain “${missing}”. Choose another font.`);
    for(const key of ['size','plateRadius','letterSpacing','compactness','blobIntensity','edgeMargin','fillIntensity','roundness'])if(!Number.isFinite(options[key]))throw new Error(`Invalid typography setting: ${key}`);
    // The supplied cap is fixed-size; template metadata cannot enlarge it.
    const safeRadius=Math.min(19.5,options.plateRadius)-Math.max(0,options.edgeMargin);
    if(safeRadius<2||options.size<=0)throw new Error('The circular text area is too small.');
    const target=safeRadius*clamp(options.fillIntensity/100,.5,1)-.15;
    const organic=stylePreset==='organic-circular', candidates=[];
    if (organic) {
        candidates.push(...buildOrganicCandidates({...options,text:rawText},target,safeRadius));
    } else {
    for(const rows of lineBreaks(text,organic)) {
        if (options.layoutMode === '1-line' && rows.length !== 1) continue;
        if (options.layoutMode === '2-lines' && rows.length !== 2) continue;
        
        for(const arched of (organic?[true,false]:[false])) {
            let glyphs=compose(rows,options,arched);
            
            // Capture aspect ratio before distortion to penalize highly stretched inputs
            const naturalB = bounds(glyphs.flatMap(g => g.shapes));
            const naturalAspect = naturalB.size.y > 0 ? (naturalB.size.x / naturalB.size.y) : 1;
            
            if (organic) {
                glyphs = applyTrueCircularEnvelope(glyphs, options);
            }
            const scale=autoFit?target/radius(glyphs.flatMap(g=>g.shapes)):1;
        glyphs=glyphs.map(g=>{
            const original=transformTypographyShapes(g.shapes,p=>p.multiplyScalar(scale));
            return {...g,...inflateGlyph(openSmallCounters(original),clamp(options.blobIntensity,0,5)*.015),original};
        });
        const validation=evaluate(glyphs,safeRadius), shapes=glyphs.flatMap(g=>g.shapes), b=bounds(shapes);
        const visibleArea=typographyArea(booleanShapes(shapes,[],Clipper.ClipType.ctUnion));
        const coverage=visibleArea/(Math.PI*safeRadius*safeRadius);
        
        // Compute how close to the edges it gets overall
        const conformity = getCircleConformity(shapes);
        
        // Height coverage thresholding
        const heightCoverage = b.size.y / (2 * target);
        let heightPenalty = 0;
        const minHeight = organic ? 0.65 : stylePreset === 'groovy-vertical' ? 0.6 : 0.35;
        if (heightCoverage < minHeight) {
            heightPenalty = (minHeight - heightCoverage) * 10;
            // Flatness is aesthetic, not a printing failure. Never reject a
            // readable, valid legacy preset merely for leaving base visible.
        }
        
        const targetAspect=organic?1.05:stylePreset==='groovy-vertical'?1.15:1.55;
        const aspectToScore = organic ? naturalAspect : (b.size.x/b.size.y);
        const balance=Math.abs(Math.log(aspectToScore/targetAspect)) * (organic ? 2.5 : 1.0);
        // Hard geometry/readability gate first; balance outranks ink coverage.
        
        const physicalRowWidths = rows.map((_, rowIndex) => {
            const rowShapes = glyphs.filter(g => g.row === rowIndex).flatMap(g => g.shapes);
            if (!rowShapes.length) return 0;
            return bounds(rowShapes).size.x;
        });
        const maxRowWidth = Math.max(...physicalRowWidths, 1);
        const physicalWidthImbalance = (Math.max(...physicalRowWidths) - Math.min(...physicalRowWidths)) / maxRowWidth;
        const rowImbalancePenalty = physicalWidthImbalance * (text.includes(' ') ? 0.3 : 1.2);
        
        // Score combines radial packing, height penalty, balance, and coverage
        let score = (conformity.avgCoverage * 2.0) - balance - heightPenalty - rowImbalancePenalty - (rows.length-1)*.1 + (organic&&arched?.04:0) + coverage*.15;
        
        if (organic) {
            // Heavily reward a perfect circular silhouette
            score += conformity.smoothness * 2.5;
            score += conformity.minCoverage * 1.5;
        }
        
        candidates.push({glyphs,rows,shapes,coverage,radialScore: conformity.avgCoverage,heightCoverage,score,arched,...validation});
        }
    }
    }
    const accepted=candidates.filter(c=>!c.reasons.length).sort((a,b)=>b.score-a.score);
    if(!accepted.length)throw new Error(`Text cannot fit safely: ${[...new Set(candidates.flatMap(c=>c.reasons))].join('; ')}. Reduce text or adjust spacing/font.`);
    const chosen=accepted[0];
    if(options.manualPlacement) {
        chosen.glyphs=chosen.glyphs.map(g=>{
            const a=options.glyphAdjustments?.[g.index]||{};
            const x=Number(a.x||0),y=Number(a.y||0),angle=Number(a.rotation||0)*Math.PI/180,scale=Number(a.scale??1);
            const width=Number(a.width??1),height=Number(a.height??1),stretch=Number(a.stretch??0);
            if (![width,height,stretch].every(Number.isFinite)||width<.7||width>1.3||height<.7||height>1.3||Math.abs(stretch)>1)throw new Error('Manual width, height, or local stretch exceeds readable limits.');
            if(![x,y,angle,scale].every(Number.isFinite)||Math.abs(angle)>Math.PI/12||scale<.8||scale>1.2)throw new Error('Manual glyph adjustments exceed readable limits.');
            const center=bounds(g.shapes).center;
            const extent=bounds(g.shapes).size;
            const move=p=>{p.sub(center);p.x*=width;p.y*=height;p.x+=Math.sin(p.y/Math.max(.1,extent.y)*Math.PI)*extent.x*.08*stretch;return p.multiplyScalar(scale).rotateAround(new THREE.Vector2(),angle).add(center).add(new THREE.Vector2(x,y));};
            return {...g,shapes:transformTypographyShapes(g.shapes,move),original:transformTypographyShapes(g.original,move)};
        });
        const check=evaluate(chosen.glyphs,safeRadius,options);
        if(check.reasons.length) {
            const error = new Error(`Manual placement: ${check.reasons.join('; ')}.`);
            error.layout = { ...chosen, safeRadius, collisions: check.collisions };
            throw error;
        }
        chosen.shapes=chosen.glyphs.flatMap(g=>g.shapes);chosen.coverage=typographyArea(chosen.shapes)/(Math.PI*safeRadius*safeRadius);
    }
    let bevelSize=Math.min(.28,clamp(options.roundness,0,3)*.24);
    while(bevelSize>.01&&chosen.glyphs.some(g=>!countersRetained(g.shapes,offset(g.shapes,-bevelSize))||!printable(offset(g.shapes,-bevelSize),options.minFeature??MIN_FEATURE)))bevelSize*=.65;
    if(bevelSize<=.01)bevelSize=0;
    return {...chosen,safeRadius,bevelSize,candidates:candidates.map(c=>({rows:c.rows,arched:c.arched,score:c.score,coverage:c.coverage,reasons:c.reasons})),metrics:{glyphs:chosen.glyphs.length,counters:holeCount(chosen.shapes),maxRadius:radius(chosen.shapes),clearance:options.minGap??MIN_GAP,minFeature:options.minFeature??MIN_FEATURE,collisions:0}};
}
export function generateAdvancedTypography(options) {return generateTypographyLayout(options).shapes;}

// ExtrudeGeometry triangulates the un-bevelled outline, then moves the cap
// vertices. An inward bevel can make that triangulation invalid (or open gaps
// where Earcut removed collinear outline vertices). Triangulate the actual
// cap boundary instead, retaining every side-wall boundary vertex.
function rebuildBevelCaps(source) {
    source.computeBoundingBox();
    const minZ=source.boundingBox.min.z,maxZ=source.boundingBox.max.z;
    const position=source.attributes.position, normal=source.attributes.normal;
    const output=[],normals=[],edges=[[],[]];
    const v=i=>new THREE.Vector3().fromBufferAttribute(position,i);
    const key=p=>`${p.x},${p.y}`;
    for(const group of source.groups.filter(g=>g.materialIndex===1))for(let i=group.start;i<group.start+group.count;i+=3) {
        const vertices=[v(i),v(i+1),v(i+2)];
        for(let j=0;j<3;j++) {output.push(...vertices[j].toArray());normals.push(normal.getX(i+j),normal.getY(i+j),normal.getZ(i+j));}
        for(let j=0;j<3;j++) {
            const a=vertices[j],b=vertices[(j+1)%3];
            if(a.z===minZ&&b.z===minZ)edges[0].push([a,b]);
            if(a.z===maxZ&&b.z===maxZ)edges[1].push([a,b]);
        }
    }
    for(let side=0;side<2;side++) {
        const adjacency=new Map(), coords=new Map();
        for(const [a,b] of edges[side]) {
            const ka=key(a),kb=key(b);if(ka===kb)continue;
            coords.set(ka,a);coords.set(kb,b);
            if(!adjacency.has(ka))adjacency.set(ka,[]);if(!adjacency.has(kb))adjacency.set(kb,[]);
            adjacency.get(ka).push(kb);adjacency.get(kb).push(ka);
        }
        if([...adjacency.values()].some(a=>a.length!==2))throw new Error('Text bevel has an invalid boundary. Reduce roundness.');
        const visited=new Set(),loops=[];
        for(const first of adjacency.keys()) {
            if(visited.has(first))continue;
            const loop=[];let previous=null,current=first;
            do {
                if(visited.has(current))throw new Error('Text bevel boundary crosses itself.');
                visited.add(current);const p=coords.get(current);loop.push(new THREE.Vector2(p.x,p.y));
                const next=adjacency.get(current).find(k=>k!==previous);previous=current;current=next;
            }while(current!==first);
            loops.push(loop);
        }
        loops.sort((a,b)=>area(b)-area(a));
        const polygons=[];
        for(const loop of loops) {
            const container=polygons.find(s=>Clipper.Clipper.PointInPolygon({X:Math.round(loop[0].x*SCALE),Y:Math.round(loop[0].y*SCALE)},paths([s])[0])!==0);
            if(container)container.holes.push(new THREE.Path(loop));else polygons.push(new THREE.Shape(loop));
        }
        if(!validTopology(polygons))throw new Error('The bevel folds a glyph contour. Reduce roundness.');
        for(const shape of polygons) {
            const outer=clean(shape.getPoints()),holes=shape.holes.map(h=>clean(h.getPoints()));
            const points=[outer,...holes].flat();
            const triangles=THREE.ShapeUtils.triangulateShape(outer,holes);
            const used=new Set(triangles.flat());
            // Split boundary edges for any collinear point Earcut omitted.
            for(let i=0;i<points.length;i++)if(!used.has(i)) {
                const p=points[i];let split=false;
                for(let t=0;t<triangles.length&&!split;t++)for(let e=0;e<3&&!split;e++) {
                    const tri=triangles[t],a=points[tri[e]],b=points[tri[(e+1)%3]];
                    const ab=b.clone().sub(a),ap=p.clone().sub(a),u=ap.dot(ab)/ab.lengthSq();
                    if(u>0&&u<1&&Math.abs(ab.cross(ap))<1e-5) {
                        const c=tri[(e+2)%3];triangles.splice(t,1,[tri[e],i,c],[i,tri[(e+1)%3],c]);split=true;
                    }
                }
                if(!split)throw new Error('Unable to close the text cap triangulation.');
            }
            for(const tri of triangles) {
                const [a,b,c]=tri.map(i=>points[i]);
                const sign=b.clone().sub(a).cross(c.clone().sub(a));
                if((sign>0)!==(side===1))tri.reverse();
                for(const i of tri) {output.push(points[i].x,points[i].y,side?maxZ:minZ);normals.push(0,0,side?1:-1);}
            }
        }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(output,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    return geometry;
}
export function createTypographyGeometry(layout, depth = 1.5) {
    if(!Number.isFinite(depth)||depth<=0)throw new Error('Text depth must be positive.');
    let bevel=Math.min(layout.bevelSize,depth*.25), geometry;
    for(let attempt=0;attempt<8;attempt++) {
        const extruded=new THREE.ExtrudeGeometry(layout.shapes,{depth:depth-2*bevel,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelOffset:-bevel,bevelSegments:5,curveSegments:12,steps:1});
        try { geometry=rebuildBevelCaps(extruded); break; }
        catch(error) {if(attempt===7)throw error;bevel=attempt===6?0:bevel*.5;}
        finally { extruded.dispose(); }
    }
    geometry.userData.bevelSize=bevel;
    // Inward bevel preserves the validated envelope. Seat text 0.03 mm into cap.
    geometry.translate(0,0,bevel-.03);geometry.rotateX(-Math.PI/2);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++)if(!Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i))||Math.hypot(p.getX(i),p.getZ(i))>layout.safeRadius+.001){geometry.dispose();throw new Error('The text bevel exceeds the safe geometry envelope.');}
    return geometry;
}
export function resolveTypographyFont(allFonts, fontId) {
    const key=s=>String(s||'').replace(/\s+/g,'').toLowerCase();
    return allFonts.find(f=>key(f.id)===key(fontId)||key(f.label)===key(fontId));
}
