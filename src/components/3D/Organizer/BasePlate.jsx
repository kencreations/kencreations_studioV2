import React, { useMemo } from "react";
import * as THREE from "three";
import { Evaluator, Brush, SUBTRACTION } from "three-bvh-csg";

const createRoundedRectShape = (w, d, r) => {
    const s = new THREE.Shape(), hw = w/2, hd = d/2, rad = Math.min(r, hw, hd);
    s.moveTo(-hw+rad, -hd); s.lineTo(hw-rad, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd+rad);
    s.lineTo(hw, hd-rad); s.quadraticCurveTo(hw, hd, hw-rad, hd); s.lineTo(-hw+rad, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd-rad); s.lineTo(-hw, -hd+rad); s.quadraticCurveTo(-hw, -hd, -hw+rad, -hd);
    return s;
};

export default function BasePlate({ width, depth, thickness, radius, color, slots = [], pegHeight }) {
    const slotKey = JSON.stringify(slots);

    const finalGeo = useMemo(() => {
        const shape = createRoundedRectShape(width, depth, radius);
        const baseGeo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
        baseGeo.rotateX(-Math.PI / 2); 

        if (slots.length === 0) return baseGeo;

        const evaluator = new Evaluator();
        
        // Make the cut cylinder exactly deep enough for the peg + 0.2mm tolerance
        const cutDepth = pegHeight + 0.2;
        const slotTemplate = new THREE.CylinderGeometry(4.0, 4.0, cutDepth, 24); 

        let result = new Brush(baseGeo);
        result.updateMatrixWorld();

        for (const pos of slots) {
            const slotGeo = slotTemplate.clone();
            // Position the cylinder so its top aligns with the top of the baseplate, leaving the bottom closed
            slotGeo.translate(pos.x, thickness - (cutDepth / 2) + 0.05, pos.z); 
            const slot = new Brush(slotGeo);
            slot.updateMatrixWorld();
            result = evaluator.evaluate(result, slot, SUBTRACTION);
        }
        return result.geometry;
    }, [width, depth, thickness, radius, pegHeight, slotKey]);

    return (
        <mesh geometry={finalGeo} castShadow receiveShadow>
            <meshStandardMaterial color={color} />
        </mesh>
    );
}
