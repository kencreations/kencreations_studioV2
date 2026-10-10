import React, { useMemo } from "react";
import * as THREE from "three";
import { Geometry as CSG, Base, Subtraction } from "@react-three/csg";

export default function CupModule({ diameter, height, wallThick, color, pegHeight, pegLocalPositions = [], cupStyle = "Plain" }) {
    
    // Dynamically set segments to create physical 3D geometric textures
    const segments = useMemo(() => {
        switch (cupStyle) {
            case "Hexagon": return 6;
            case "Octagon": return 8;
            case "Low-Poly (12-Sided)": return 12;
            case "Plain":
            default: return 64; // Smooth
        }
    }, [cupStyle]);

    const outerGeo = useMemo(() => {
        const geo = new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, segments);
        geo.translate(0, height / 2, 0); 
        return geo;
    }, [diameter, height, segments]);

    const innerGeo = useMemo(() => {
        const cavityH = height - wallThick;
        const geo = new THREE.CylinderGeometry(diameter / 2 - wallThick, diameter / 2 - wallThick, cavityH + 1, segments);
        geo.translate(0, wallThick + cavityH / 2 + 0.5, 0); 
        return geo;
    }, [diameter, height, wallThick, segments]);

    const pegGeo = useMemo(() => new THREE.CylinderGeometry(3.8, 3.8, pegHeight, 16), [pegHeight]);

    return (
        <group>
            <mesh castShadow receiveShadow>
                <CSG>
                    <Base geometry={outerGeo}/>
                    {diameter / 2 - wallThick > 0 && <Subtraction geometry={innerGeo}/>}
                </CSG>
                <meshStandardMaterial color={color} flatShading={segments < 20} />
            </mesh>
            {pegLocalPositions.map((pos, i) => (
                <mesh key={i} position={[pos.x, -pegHeight / 2, pos.z]} castShadow>
                    <primitive object={pegGeo.clone()} attach="geometry" />
                    <meshStandardMaterial color={color} />
                </mesh>
            ))}
        </group>
    );
}
