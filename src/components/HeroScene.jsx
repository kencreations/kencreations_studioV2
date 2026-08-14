import React, { useRef, useMemo, useState, Component } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    Environment,
    Float,
    RoundedBox,
    PerspectiveCamera,
    Text,
} from "@react-three/drei";
import * as THREE from "three";

const GRID_SIZE = 40;
const SPACING = 1.2;
const CUBE_SIZE = 1.1;

// Base color of the cubes (Jasper style purple)
const BASE_COLOR = new THREE.Color("#FF6B00"); // Teal
// Highlight color when hovered
const HOVER_COLOR = new THREE.Color("#00A3A3"); // Orange

function CubeGrid() {
    const meshRef = useRef();
    const count = GRID_SIZE * GRID_SIZE;

    // We store the hover state per-instance to smoothly animate them
    const [hoveredId, setHoveredId] = useState(null);
    const hoverValues = useRef(new Float32Array(count)).current;
    const tempVec = useMemo(() => new THREE.Vector3(), []);

    // Precompute positions to avoid recalculating in useFrame
    const particles = useMemo(() => {
        const p = [];
        const offset = (GRID_SIZE * SPACING) / 2;
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                p.push({
                    x: x * SPACING - offset,
                    z: z * SPACING - offset,
                });
            }
        }
        return p;
    }, []);

    // Create the dummy object and color object used for matrix calculations
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);

    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.getElapsedTime();

        for (let i = 0; i < count; i++) {
            const { x, z } = particles[i];

            // 1. Calculate the base sine wave height (slowed down wave)
            const waveY = Math.sin(t * 0.5 + x * 0.2 + z * 0.2) * 0.5;

            // 2. Animate the hover value towards 1 if hovered, 0 if not
            const targetHover = hoveredId === i ? 1 : 0;
            // Smoothly interpolate the hover state
            hoverValues[i] += (targetHover - hoverValues[i]) * 0.1;

            // 3. The actual Y position is the wave + an extra lift from hovering
            const currentY = waveY + hoverValues[i] * 1.5;

            // Update the matrix
            // Use a large negative Y offset so the bottom of the long cubes is hidden
            dummy.position.set(x, currentY - 2.5, z);

            // Optionally, scale the cube up slightly on hover
            const scale = 1 + hoverValues[i] * 0.1;
            dummy.scale.set(scale, scale, scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // 4. Interpolate color
            tempColor.copy(BASE_COLOR).lerp(HOVER_COLOR, hoverValues[i]);
            meshRef.current.setColorAt(i, tempColor);
        }

        // Notify ThreeJS that the instance buffers have changed
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[null, null, count]}
            onPointerMove={(e) => {
                e.stopPropagation();
                if (e.instanceId !== undefined && e.instanceId !== hoveredId) {
                    setHoveredId(e.instanceId);
                }
            }}
            onPointerOut={() => setHoveredId(null)}>
            <instancedBufferAttribute
                attach="instanceColor"
                args={[new Float32Array(count * 3), 3]}
            />
            {/* Make the cube tall so you don't see the bottom edge when it goes down */}
            <boxGeometry args={[CUBE_SIZE, 5, CUBE_SIZE]} />
            {/* The glassy, translucent purple material */}
            <meshPhysicalMaterial
                transmission={0.8}
                roughness={0.2}
                metalness={0.1}
                thickness={2}
                ior={1.5}
                color="#c7d4d4ff"
                envMapIntensity={1.5}
                clearcoat={0.5}
            />
        </instancedMesh>
    );
}

class SceneErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900 text-white p-10 font-mono text-sm whitespace-pre-wrap">
                    Error in HeroScene: {this.state.error?.message}
                    {"\n\n"}
                    {this.state.error?.stack}
                </div>
            );
        }
        return this.props.children;
    }
}

export default function HeroScene() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-auto overflow-hidden">
            <SceneErrorBoundary>
                <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
                    {/* Position camera to simulate isometric feel: high up, looking down */}
                    <PerspectiveCamera
                        makeDefault
                        position={[0, 3, 20]}
                        fov={45}
                        onUpdate={(c) => c.lookAt(0, 1, 0)}
                    />

                    {/* Lighting */}
                    <ambientLight intensity={0.6} />
                    <directionalLight
                        position={[10, 20, 10]}
                        intensity={1.5}
                        color="#ffffff"
                    />
                    <directionalLight
                        position={[-10, 5, -10]}
                        intensity={2}
                        color="#FF6B00"
                    />
                    <pointLight
                        position={[0, 5, 0]}
                        intensity={2}
                        color="#00A3A3"
                        distance={30}
                    />

                    {/* Main Content */}
                    <CubeGrid />

                    {/* Environment for glass reflections */}
                    <Environment preset="city" />
                </Canvas>
            </SceneErrorBoundary>

            {/* A soft bottom overlay to fade out the grid at the very bottom edge if needed */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#FF6B00]/50 to-transparent pointer-events-none" />
        </div>
    );
}
