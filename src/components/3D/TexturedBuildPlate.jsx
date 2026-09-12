import React, { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three-stdlib";
import * as THREE from "three";

const getAssetPath = (path) => {
    if (!path) return path;
    return path.startsWith('/') ? '.' + path : path;
};

const TexturedBuildPlate = ({ activePrinter }) => {
    // 1. Load and center the STL
    const stlPath = getAssetPath(activePrinter.modelPath);
    const plateGeometry = useLoader(STLLoader, stlPath);
    useMemo(() => {
        plateGeometry.center();
    }, [plateGeometry]);

    // 2. Load the SVG decals
    const bottomTex = useLoader(
        THREE.TextureLoader,
        getAssetPath("/textures/printers/bbl_bed_pei_bottom.svg"),
    );
    const leftTex = useLoader(
        THREE.TextureLoader,
        getAssetPath("/textures/printers/bbl_bed_pei_left.svg"),
    );

    // Prevent texture blurring for crisp realistic text
    useMemo(() => {
        [bottomTex, leftTex].forEach((tex) => {
            if (tex) {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.generateMipmaps = false;
                tex.minFilter = THREE.LinearFilter;
            }
        });
    }, [bottomTex, leftTex]);

    const isBambu = activePrinter.name.includes("Bambu");
    const isMini = activePrinter.name.includes("Mini");

    // 1. Base proportional sizes
    let bottomWidth = activePrinter.width * 0.55;
    let leftHeight = activePrinter.depth * 0.75;

    // 2. Default boundaries (tucked cleanly inside the edges)
    let bottomY = activePrinter.depth / 2 - 8;
    let leftX = activePrinter.width / 2 - 12;
    let bottomX = 0; // Centered by default

    // 3. Brand/Model specific overrides
    if (isBambu) {
        if (isMini) {
            // A1 Mini (180x180) - Needs narrower text tucked further up from the front edge
            bottomWidth = activePrinter.width * 0.5;
            bottomY = activePrinter.depth / 2 + 4;
            bottomX = activePrinter.width / 2 - bottomWidth / 2 - 25;
        } else {
            // Standard A1/P1/X1 (256x256) - Matches original layout
            bottomY = activePrinter.depth / 2 + 5;
            bottomX = activePrinter.width / 2 - bottomWidth / 2 - 35;
        }
    }

    return (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            {/* THE REALISTIC BASE - Lightened to catch scene lighting */}
            <mesh geometry={plateGeometry} receiveShadow>
                <meshStandardMaterial
                    color="#666666"
                    roughness={0.8}
                    metalness={0.2}
                />
            </mesh>

            {/* THE DECAL STICKERS */}
            {isBambu && (
                <group position={[0, 0, 0.5]}>
                    {/* BOTTOM TEXT: Right-aligned, corrected aspect ratio */}
                    <mesh position={[bottomX, -bottomY, 0]} receiveShadow>
                        <planeGeometry args={[bottomWidth, 12]} />
                        <meshBasicMaterial
                            map={bottomTex}
                            transparent={true}
                            side={THREE.FrontSide}
                            depthWrite={false}
                            polygonOffset={true}
                            polygonOffsetFactor={-4}
                            polygonOffsetUnits={-4}
                        />
                    </mesh>

                    {/* LEFT TEXT: Centered on the left edge, corrected aspect ratio */}
                    <mesh position={[-leftX, 0, 0]} receiveShadow>
                        <planeGeometry args={[12, leftHeight]} />
                        <meshBasicMaterial
                            map={leftTex}
                            transparent={true}
                            side={THREE.FrontSide}
                            depthWrite={false}
                            polygonOffset={true}
                            polygonOffsetFactor={-5}
                            polygonOffsetUnits={-5}
                        />
                    </mesh>
                </group>
            )}
        </group>
    );
};

export default TexturedBuildPlate;
