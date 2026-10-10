import * as THREE from 'three';
import Clipper from 'clipper-lib';

// PopSocket only. Distances after fitting are millimetres. No word-level union.
const SCALE = 10000, MIN_GAP = 0.5, MIN_FEATURE = 0.6;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const area = p => Math.abs(THREE.ShapeUtils.area(p));
const holeCount = shapes => shapes.reduce((n, s) => n + s.holes.length, 0);
const rings = shapes => shapes.flatMap(s => [s.getPoints(), ...s.holes.map(h => h.getPoints())]);
const clean = points => {
    const result = points.filter((p, i) => !i || p.distanceToSquared(points[i - 1]) > 1e-10);
    if (result.length > 1 && result[0].distanceToSquared(result.at(-1)) < 1e-10) result.pop();
    return result;
};
export function transformTypographyShapes(shapes, fn) {
    return shapes.map(s => {
        const shape = new THREE.Shape(clean(s.getPoints(12)).map(p => fn(p.clone())));
        shape.holes = s.holes.map(h => new THREE.Path(clean(h.getPoints(12)).map(p => fn(p.clone()))));
        return shape;
    });
}
function bounds(shapes) {
    const box = new THREE.Box2().setFromPoints(shapes.flatMap(s => s.getPoints()));
    return { box, center: box.getCenter(new THREE.Vector2()), size: box.getSize(new THREE.Vector2()) };
}
function paths(shapes) {
    return shapes.flatMap(s => [s, ...s.holes].map((ring, i) => {
        const p = clean(ring.getPoints()).map(v => ({ X: Math.round(v.x * SCALE), Y: Math.round(v.y * SCALE) }));
        if (Clipper.Clipper.Orientation(p) !== (i === 0)) p.reverse();
        return p;
    }));
}
function treeShapes(tree, cleanup = .005) {
    const result = [];
    function visit(node) {
        for (const child of node.Childs()) {
            if (!child.IsHole()) {
                const convert = n => (cleanup ? Clipper.Clipper.CleanPolygon(n.Contour(), cleanup * SCALE) : n.Contour()).map(p => new THREE.Vector2(p.X / SCALE, p.Y / SCALE));
                const outline = convert(child);
                if (outline.length >= 3) {
                    const shape = new THREE.Shape(outline);
                    shape.holes = child.Childs().filter(h => h.IsHole()).map(convert).filter(p=>p.length>=3).map(p => new THREE.Path(p));
                    result.push(shape);
                }
            }
            visit(child);
        }
    }
    visit(tree); return result;
}
function offset(shapes, distance) {
    if (Math.abs(distance) < 1e-6) return shapes;
    const co = new Clipper.ClipperOffset(2, 0.012 * SCALE);
    co.AddPaths(paths(shapes), Clipper.JoinType.jtRound, Clipper.EndType.etClosedPolygon);
    const tree = new Clipper.PolyTree(); co.Execute(tree, distance * SCALE);
    return treeShapes(tree);
}
export function typographyArea(shapes) {
    return shapes.reduce((n, s) => n + area(s.getPoints()) - s.holes.reduce((a, h) => a + area(h.getPoints()), 0), 0);
}
function booleanShapes(a, b, operation, cleanup = .005) {
    const clipper = new Clipper.Clipper();
    clipper.AddPaths(paths(a), Clipper.PolyType.ptSubject, true);
    if (b.length) clipper.AddPaths(paths(b), Clipper.PolyType.ptClip, true);
    const tree = new Clipper.PolyTree();
    clipper.Execute(operation, tree, Clipper.PolyFillType.pftNonZero, Clipper.PolyFillType.pftNonZero);
    return treeShapes(tree, cleanup);
}
function validTopology(shapes) {
    if (!shapes.length) return false;
    for (const ring of rings(shapes)) {
        const p = clean(ring);
        if (p.length < 3 || p.some(v => !Number.isFinite(v.x + v.y)) || area(p) < 0.001) return false;
        const orient = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
        for (let i=0;i<p.length;i++) for(let j=i+2;j<p.length;j++) {
            if(i===0&&j===p.length-1)continue;
            const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
            if(orient(a,b,c)*orient(a,b,d)<-1e-12&&orient(c,d,a)*orient(c,d,b)<-1e-12)return false;
        }
    }
    const normalized = booleanShapes(shapes, [], Clipper.ClipType.ctUnion, 0);
    return normalized.length === shapes.length && holeCount(normalized) === holeCount(shapes)
        && Math.abs(typographyArea(normalized)-typographyArea(shapes)) < Math.max(.005,typographyArea(shapes)*.001);
}
// Erosion tests printable stroke/component and counter cores. Conservative
// polygon checks are not a guarantee for every printer or custom font.
function printable(shapes, feature = MIN_FEATURE) {
    const core = offset(shapes, -feature / 2);
    if (core.length !== shapes.length || holeCount(core) !== holeCount(shapes)) return false;
    if (typographyArea(core) < typographyArea(shapes) * 0.2) return false;
    return shapes.every(s => s.holes.every(h => offset([new THREE.Shape(h.getPoints())], -feature/2).length === 1));
}
function countersRetained(original, next) {
    if (original.length !== next.length || holeCount(original) !== holeCount(next)) return false;
    const previous = original.flatMap(s => s.holes).map(h => area(h.getPoints())).sort((a,b)=>a-b);
    const current = next.flatMap(s => s.holes).map(h => area(h.getPoints())).sort((a,b)=>a-b);
    return previous.every((a,i) => current[i] >= a * 0.8);
}
function perimeter(shapes) {
    return rings(shapes).reduce((total,ring) => total + clean(ring).reduce((n,p,i,ps)=>n+p.distanceTo(ps[(i+1)%ps.length]),0),0);
}
function inflateGlyph(shapes, amount) {
    let distance = Math.min(amount, typographyArea(shapes)/perimeter(shapes)*0.08);
    for(let attempt=0;attempt<6;attempt++,distance/=2) {
        const next=offset(shapes,distance);
        if(countersRetained(shapes,next)&&printable(next)&&validTopology(next))return {shapes:next,inflation:distance};
    }
    return {shapes,inflation:0};
}
function openSmallCounters(shapes, feature = MIN_FEATURE) {
    // Retain the existing counter's shape and location, but give a tiny font
    // counter enough clearance for printing. Never fill or invent a counter.
    return shapes.map(s => {
        const copy = new THREE.Shape(s.getPoints());
        copy.holes = s.holes.map(h => {
            const source = [new THREE.Shape(h.getPoints())];
            for (let growth = 0; growth <= .3; growth += .025) {
                const expanded = offset(source, growth);
                const core = offset(expanded, -feature / 2);
                if (expanded.length === 1 && core.length === 1 && typographyArea(core) > .005) return new THREE.Path(expanded[0].getPoints());
            }
            return new THREE.Path(h.getPoints());
        });
        return copy;
    });
}
function overlaps(glyphs, clearance = 0) {
    const enlarged = glyphs.map(g=>offset(g.shapes, clearance/2));
    const boxes = enlarged.map(s=>bounds(s).box), collisions=[];
    for(let i=0;i<glyphs.length;i++)for(let j=i+1;j<glyphs.length;j++) {
        if(!boxes[i].intersectsBox(boxes[j]))continue;
        const intersection=booleanShapes(enlarged[i],enlarged[j],Clipper.ClipType.ctIntersection);
        if(typographyArea(intersection)>0.0001)collisions.push({a:i,b:j,shapes:intersection});
    }
    return collisions;
}

export { SCALE, MIN_GAP, MIN_FEATURE, clamp, area, holeCount, rings, clean, bounds, paths, offset, booleanShapes, validTopology, printable, countersRetained, inflateGlyph, openSmallCounters, overlaps };
