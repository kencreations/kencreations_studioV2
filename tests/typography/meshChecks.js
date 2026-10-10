import assert from 'node:assert/strict';
import * as THREE from 'three';
export function validateSurface(geometry) {
    const p=geometry.attributes.position, edges=new Map();
    const vertex=i=>new THREE.Vector3().fromBufferAttribute(p,i);
    const key=v=>v.toArray().map(n=>Math.round(n*10000)).join(',');
    let volume=0;
    for(let i=0;i<p.count;i+=3) {
        const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
        assert.ok(new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).length()>1e-10,'degenerate triangle');
        volume+=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
        const vertices=[key(a),key(b),key(c)];
        for(let j=0;j<3;j++) {const edge=[vertices[j],vertices[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
    }
    assert.ok(volume>0,'outward winding and positive volume');
    assert.equal([...edges.values()].filter(count=>count!==2).length,0,'closed text surface');
}

