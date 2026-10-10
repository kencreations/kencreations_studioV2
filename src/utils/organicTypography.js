import * as THREE from 'three';
import Clipper from 'clipper-lib';
import {
    SCALE, clamp, bounds, holeCount, transformTypographyShapes as transform,
    overlaps, validTopology, printable, openSmallCounters, typographyArea, paths, offset, countersRetained,
} from './typographyContours.js';

/** Enumerate nonempty, reading-order-preserving partitions. Newlines are
 * explicit composition instructions, not whitespace to discard. */
export function organicLineArrangements(input, mode = 'auto') {
    const raw=String(input).trim().replace(/\r/g,'');
    const explicit=raw.split('\n').map(row=>row.trim().replace(/[\t ]+/g,' '));
    const count={'1-line':1,'2-lines':2,'3-lines':3}[mode];
    if(!['auto','1-line','2-lines','3-lines'].includes(mode))throw new Error('Choose Auto Fit, 1 Line, 2 Lines, or 3 Lines.');
    if(explicit.some(row=>!row))throw new Error('Each entered line must contain at least one letter.');
    if(count===1)return [[explicit.join(' ')]];
    if(explicit.length>1) {
        if(explicit.length>3 || (count&&explicit.length!==count))throw new Error(`Enter exactly ${count||'one to three'} nonempty lines, or remove the explicit line breaks.`);
        return [explicit];
    }
    const chars=Array.from(raw),letters=chars.filter(c=>c!==' ').length;
    if(count&&letters<count)throw new Error(`${count} Lines requires at least ${count} characters for nonempty rows.`);
    const result=[];
    for(const rows of (count?[count]:[1,2,3].filter(n=>n<=letters))) {
        const partitions=[];
        function split(start,left,lines) {
            if(left===1) {
                const last=chars.slice(start).join('').trim();
                if(last)partitions.push([...lines,last]);return;
            }
            for(let end=start+1;end<=chars.length-left+1;end++) {
                const line=chars.slice(start,end).join('').trim();
                if(line)split(end,left-1,[...lines,line]);
            }
        }
        split(0,rows,[]);
        let unique=[...new Map(partitions.map(p=>[p.join('\n'),p])).values()];
        const wholeWords=unique.filter(p=>p.join(' ')===raw);
        if(raw.includes(' ')&&wholeWords.length)unique=wholeWords;
        const quality=lines=>{
            const widths=lines.map(line=>Array.from(line.replace(/ /g,'')).length);
            const mean=letters/rows;
            const imbalance=widths.reduce((s,w)=>s+(w-mean)**2,0)/letters;
            // Whole-word breaks are preferred, but short words may share a row.
            const breaks=lines.slice(0,-1).reduce((n,line,i)=>{
                const position=lines.slice(0,i+1).join('').replace(/ /g,'').length;
                let consumed=0,wordBoundary=false;
                for(const word of raw.split(' ')){consumed+=word.length;if(consumed===position)wordBoundary=true;}
                return n+(wordBoundary?0:raw.includes(' ')?1.8:0);
            },0);
            return imbalance+breaks;
        };
        unique.sort((a,b)=>quality(a)-quality(b));
        result.push(...unique.slice(0,rows===1?1:4));
    }
    return result;
}

function sourceGlyphs(font,text,size) {
    const result=new Map();
    for(const char of Array.from(text.replace(/\s/g,'')))if(!result.has(char)) {
        const shapes=font.generateShapes(char,size);
        if(!shapes.length)throw new Error(`The font has no printable outline for “${char}”.`);
        const box=bounds(shapes);
        if(box.size.x<=0||box.size.y<=0)throw new Error(`The font outline for “${char}” is empty.`);
        result.set(char,{shapes,...box,counters:holeCount(shapes)});
    }
    return result;
}

/** Per-glyph envelopes have independently curved top/bottom boundaries.
 * Applying the SAME continuous field to an outer outline and its counters
 * preserves anatomy. There is no clipping or rectangular-block-to-disc map. */
function composeEnvelopes(rows, sources, options, target, variant) {
    const intensity=clamp(options.blobIntensity/5,0,1);
    const flow=(.35+.65*intensity)*(variant? .75:1);
    const gap=Math.max(options.minGap+.18, (.85+Math.max(-.2,options.letterSpacing))/clamp(options.compactness,.5,2));
    const rowCount=rows.length,glyphs=[];let index=0;
    rows.forEach((row,rowIndex)=>{
        const chars=Array.from(row), letters=chars.filter(c=>c!==' ');
        const weights=letters.map(char=>Math.pow(sources.get(char).size.x/sources.get(char).size.y,.72));
        const totalWeight=weights.reduce((n,w)=>n+w,0);
        const halfWidth=target*(rowCount===3&&rowIndex!==1?.82:.94);
        const spaces=chars.filter(c=>c===' ').length;
        const wordGap=gap*1.6;
        const available=halfWidth*2-gap*(letters.length-1)-wordGap*spaces;
        if(available<=0)return;
        let cursor=-halfWidth,n=0,word=0;
        for(const char of chars) {
            if(char===' '){cursor+=wordGap;word++;continue;}
            const source=sources.get(char),cellWidth=available*weights[n]/totalWeight;
            const center=cursor+cellWidth/2;
            const centerArc=Math.sqrt(Math.max(0,target*target-center*center));
            const centerHeight=rowCount===1?centerArc*2:rowCount===2?centerArc:rowIndex===1?target*.62:centerArc-target*.31;
            const width=Math.min(cellWidth,centerHeight*source.size.x/source.size.y*2.2);
            const left=center-width/2;
            const phase=index*1.618+rowIndex*.8;
            // Readability caps on anisotropy. Long forced lines leave base
            // visible instead of stretching narrow glyphs into vertical ribbons.
            const naturalHeight=width*source.size.y/source.size.x;
            const maxHeight=naturalHeight*(rowCount===1?2.9:2.35);
            const minHeight=naturalHeight/2.8;
            let truncated=width<cellWidth,distortion=0;
            const map=p=>{
                const u=(p.x-source.box.min.x)/source.size.x;
                const v=(p.y-source.box.min.y)/source.size.y;
                const window=Math.sin(Math.PI*u);
                // Smooth taper, terminal swell and fluid local bending; this
                // never uses the discontinuous sign(x) bulge of the old code.
                const bend=window*Math.sin(2*Math.PI*v+phase)*width*.075*flow;
                const taper=window*(v-.5)*width*.08*Math.sin(phase)*flow;
                const x=left+u*width+bend+taper;
                const arc=Math.sqrt(Math.max(0,target*target-x*x));
                const seam=Math.sin(x/target*Math.PI*.85+variant*.5)*target*.065*flow;
                let top,bottom;
                if(rowCount===1){top=arc;bottom=-arc;}
                else if(rowCount===2){top=rowIndex===0?arc:seam-gap/2;bottom=rowIndex===0?seam+gap/2:-arc;}
                else {
                    const upper=target*.31+seam,lower=-target*.31+seam*.6;
                    top=rowIndex===0?arc:rowIndex===1?upper-gap/2:lower-gap/2;
                    bottom=rowIndex===0?upper+gap/2:rowIndex===1?lower+gap/2:-arc;
                }
                let height=top-bottom;
                const mid=(top+bottom)/2;
                if(height>maxHeight){height=maxHeight;truncated=true;}
                if(height<minHeight)truncated=true;
                // Preserve the envelope edges while varying interior stroke
                // proportions, including the connected counter coordinates.
                const vv=v+Math.sin(Math.PI*v)*Math.sin(2*Math.PI*u+phase)*.055*flow;
                distortion=Math.max(distortion,Math.abs(Math.log(Math.max(.01,height/naturalHeight))));
                return new THREE.Vector2(x,mid+(vv-.5)*height);
            };
            const shaped=transform(source.shapes,map);
            glyphs.push({char,index:index++,row:rowIndex,word,shapes:shaped,original:shaped,originalCounters:source.counters,distortion,truncated,cell:{left,width,center},inflation:0});
            cursor+=cellWidth+gap;n++;
        }
    });
    return glyphs;
}

function moveGlyph(g,dx,dy=0) {
    return {...g,shapes:transform(g.shapes,p=>p.add(new THREE.Vector2(dx,dy)))};
}
// Optical packing uses actual dilated outlines, not bounding-box separation.
// Small movement limits retain the circular envelope and intentional word gaps.
function optimizeChannels(glyphs,rows,minimum) {
    let result=[];
    for(let row=0;row<rows.length;row++) {
        const current=glyphs.filter(g=>g.row===row);
        for(let i=1;i<current.length;i++) {
            const a=current[i-1],b=current[i];
            // Only bring same-word neighbours closer; retain semantic spaces.
            if(a.word!==b.word)continue;
            let low=0,high=.45;
            for(let iteration=0;iteration<5;iteration++) {
                const shift=(low+high)/2;
                if(overlaps([a,moveGlyph(b,-shift)],minimum+.08).length)high=shift;else low=shift;
            }
            current[i]=moveGlyph(b,-low);
        }
        const before=bounds(glyphs.filter(g=>g.row===row).flatMap(g=>g.shapes)).center.x;
        const after=bounds(current.flatMap(g=>g.shapes)).center.x;
        result.push(...current.map(g=>moveGlyph(g,before-after)));
    }
    // Keep every warped contour inside the safe envelope after optical packing.
    return result;
}

function exteriorRadii(shapes,count=72) {
    const contours=shapes.map(s=>s.getPoints());
    return Array.from({length:count},(_,i)=>{
        const theta=i*Math.PI*2/count,d=new THREE.Vector2(Math.cos(theta),Math.sin(theta));let r=0;
        for(const points of contours)for(let j=0;j<points.length;j++) {
            const a=points[j],b=points[(j+1)%points.length],edge=b.clone().sub(a);
            const determinant=d.cross(edge);if(Math.abs(determinant)<1e-9)continue;
            const distance=a.cross(edge)/determinant,t=a.cross(d)/determinant;
            if(distance>r&&t>=0&&t<=1)r=distance;
        }
        return r;
    });
}
function outlineDistance(a,b) {
    let min=Infinity;
    const aa=a.flatMap(s=>s.getPoints()),bb=b.flatMap(s=>s.getPoints());
    // Vertex distance is a scoring estimate only; collision/print-gap gates
    // use polygon dilation and intersection, which also test entire edges.
    for(const p of aa)for(const q of bb)min=Math.min(min,p.distanceToSquared(q));
    return Math.sqrt(min);
}
export function organicQuality(glyphs,target) {
    const shapes=glyphs.flatMap(g=>g.shapes),radii=exteriorRadii(shapes);
    const normalized=radii.map(r=>Math.min(1,r/target)).sort((a,b)=>a-b);
    // Lowest 15% of rays may be deliberate channels. Do not demand a solid disc.
    const conformity=normalized.slice(Math.floor(normalized.length*.15)).reduce((n,r)=>n+r,0)/(normalized.length-Math.floor(normalized.length*.15));
    const quadrants=[0,0,0,0],allPaths=paths(shapes);
    const inside=(x,y)=>{
        let winding=0;
        for(const ring of allPaths)if(Clipper.Clipper.PointInPolygon({X:x*SCALE,Y:y*SCALE},ring)!==0)winding+=Clipper.Clipper.Orientation(ring)?1:-1;
        return winding>0;
    };
    // Deterministic ink occupancy samples: holes do not count as ink.
    for(let x=-target;x<=target;x+=target/14)for(let y=-target;y<=target;y+=target/14)if(inside(x,y))quadrants[(x>=0?1:0)+(y>=0?2:0)]++;
    const total=quadrants.reduce((n,v)=>n+v,0)||1;
    const balance=1-quadrants.reduce((n,v)=>n+Math.abs(v/total-.25),0);
    const gaps=[];
    for(let i=1;i<glyphs.length;i++)if(glyphs[i].row===glyphs[i-1].row)gaps.push(outlineDistance(glyphs[i-1].shapes,glyphs[i].shapes));
    const meanGap=gaps.length?gaps.reduce((n,g)=>n+g,0)/gaps.length:0;
    const gapVariation=gaps.length?gaps.reduce((n,g)=>n+(g-meanGap)**2,0)/gaps.length:0;
    return {conformity,balance,meanGap,gapVariation,radii,quadrants};
}

export function buildOrganicCandidates(options,target,safeRadius) {
    const rows=organicLineArrangements(options.text,options.layoutMode||'auto');
    const sources=sourceGlyphs(options.font,options.text,options.size);
    const minimum=options.minGap??.5,feature=options.minFeature??.6;
    if(!Number.isFinite(minimum)||minimum<.4||minimum>2||!Number.isFinite(feature)||feature<.4||feature>1.5)throw new Error('Printing limits must use a 0.4–2 mm gap and 0.4–1.5 mm feature size.');
    const candidates=[];
    for(const lines of rows)for(const variant of [0,1]) {
        let glyphs=composeEnvelopes(lines,sources,{...options,minGap:minimum},target,variant);
        if(!glyphs.length)continue;
        glyphs=optimizeChannels(glyphs,lines,minimum);
        const maxRadius=Math.max(...glyphs.flatMap(g=>g.shapes.flatMap(s=>s.getPoints().map(p=>p.length()))));
        const scale=options.autoFit===false?options.size/8:Math.min(1,(target-.05)/maxRadius);
        glyphs=glyphs.map(g=>{
            let shapes=openSmallCounters(transform(g.shapes,p=>p.multiplyScalar(scale)),feature);
            const rounding=clamp((options.roundness??1)*.22,0,.45);
            if(rounding>0) {
                // A per-letter morphological opening rounds pointed terminal
                // tips without joining neighbours or creating new ink coverage.
                const rounded=offset(offset(shapes,-rounding),rounding);
                if(countersRetained(shapes,rounded)&&typographyArea(rounded)>typographyArea(shapes)*.96&&printable(rounded,feature)&&validTopology(rounded))shapes=rounded;
            }
            return {...g,shapes};
        });
        const shapes=glyphs.flatMap(g=>g.shapes),reasons=[],collisions=overlaps(glyphs,minimum);
        if(collisions.length)reasons.push(`letter gaps below ${minimum} mm`);
        if(glyphs.some(g=>holeCount(g.shapes)!==g.originalCounters))reasons.push('lost essential counters');
        if(glyphs.some(g=>!validTopology(g.shapes)))reasons.push('invalid or intersecting outlines');
        if(glyphs.some(g=>!printable(g.shapes,feature)))reasons.push(`features below ${feature} mm`);
        if(shapes.some(s=>s.getPoints().some(p=>p.length()>safeRadius+.0001)))reasons.push('outside safe circle');
        const quality=organicQuality(glyphs,target);
        const coverage=typographyArea(shapes)/(Math.PI*safeRadius*safeRadius);
        const distortion=glyphs.reduce((n,g)=>n+g.distortion,0)/glyphs.length;
        const counts=lines.map(line=>Array.from(line.replace(/ /g,'')).length);
        const rowImbalance=(Math.max(...counts)-Math.min(...counts))/Math.max(...counts);
        const brokenWord=options.text.includes(' ')&&lines.join(' ')!==options.text.replace(/\s+/g,' ')? .15:0;
        const score=quality.conformity*1.6+quality.balance*.7-distortion*.32-Math.min(1,quality.gapVariation)*.25+coverage*.08-(lines.length-1)*.025-rowImbalance*.65-brokenWord;
        const warnings=[];
        if(glyphs.some(g=>g.truncated)||quality.conformity<.75)warnings.push('This arrangement leaves extra base visible to preserve readable proportions. Try Auto Fit or a different line count.');
        candidates.push({glyphs,rows:lines,shapes,coverage,score,quality,warnings,reasons,collisions,variant});
    }
    return candidates;
}
