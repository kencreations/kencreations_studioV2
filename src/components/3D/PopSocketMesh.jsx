import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { load3DFont } from "../../utils/fontManager";
import { generateTypographyLayout, createTypographyGeometry, resolveTypographyFont } from "../../utils/advancedTypography";
import { useProfile } from "../../contexts/ProfileContext";
import plateUrl from "../../assets/models/popsocket.3mf?url";

// Typography geometry is shared by the preview and the exported clone.
const ExtrudedText = React.memo(({ config, positionY, onTypographyState }) => {
    const { allFonts } = useProfile();
    const fontCache = useRef(new Map());
    const [result, setResult] = useState(null);
    const key = JSON.stringify(config);
    useEffect(() => {
        let active = true;
        let ownedGeometry;
        const settings = JSON.parse(key);
        onTypographyState?.({ key, status: 'loading' });
        const timer = setTimeout(async () => {
            try {
                if (settings.textMode === 'engraved') throw new Error('Engraving is not available for this cap. Select Raised to preview and export printable text.');
                const option = resolveTypographyFont(allFonts, settings.fontId || 'Coiny');
                if (!option) throw new Error('The selected font is unavailable. Choose a bundled font.');
                if (!fontCache.current.has(option.id)) fontCache.current.set(option.id, await load3DFont(option));
                if (!active) return;
                const layout = generateTypographyLayout({ ...settings, font: fontCache.current.get(option.id), size: settings.fontSize, plateRadius: settings.topRadius });
                ownedGeometry = createTypographyGeometry(layout, settings.textDepth);
                if (!active) { ownedGeometry.dispose(); return; }
                setResult({ key, geometry: ownedGeometry });
                onTypographyState?.({ key, status: 'ready', layout });
            } catch (error) {
                if (active) { setResult(null); onTypographyState?.({ key, status: 'error', error: error.message, layout: error.layout }); }
            }
        }, 120);
        return () => { active = false; clearTimeout(timer); ownedGeometry?.dispose(); };
    }, [key, allFonts, onTypographyState]);
    if (!result || result.key !== key) return null;
    const safeColor = config.textColor?.slice(0, 7) || '#ffffff';
    return <mesh geometry={result.geometry} position={[0, positionY, 0]} userData={{ typographyReady: key }} castShadow>
        <meshStandardMaterial color={safeColor} roughness={0.42} />
    </mesh>;
});
ExtrudedText.displayName = 'ExtrudedText';

// ─── Main Export ──────────────────────────────────────────────────────────────
const PopSocketMesh = React.memo(({ config, onTypographyState }) => {
    const { text = "MY NAME", baseColor = "#E63946" } = config;

    const [attachmentGeo, setAttachmentGeo] = useState(null);
    const [plateTopY, setPlateTopY] = useState(0); // Where to position text

    useEffect(() => {
        let active = true;
        let ownedGeometry;
        const getAssetPath = (path) => (path?.startsWith('/') ? '.' + path : path);
        
        const loader = new ThreeMFLoader();
        loader.load(getAssetPath(plateUrl), (group) => {
            let geom = null;
            group.traverse((child) => {
                if (child.isMesh && child.geometry && !geom) {
                    geom = child.geometry.clone();
                }
            });
            group.traverse(child => {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material?.dispose();
            });
            if (!active) { geom?.dispose(); return; }
            
            if (geom) {
                // Determine orientation and center it correctly
                geom.computeBoundingBox();
                const box = geom.boundingBox;
                
                // Typical STLs/3MFs for popsocket plates: 
                // The circular plate is on the X-Y or X-Z plane. 
                // We want the flat top surface to be facing UP (+Y in Threejs)
                const size = new THREE.Vector3();
                box.getSize(size);
                
                // Let's assume standard Z-up from CAD (meaning Y and Z might be swapped in Three.js depending on loader, but 3MFLoader usually applies transforms).
                // Actually, ThreeMFLoader imports with Z-up, returning objects rotated -90 deg X automatically.
                // We want to translate it so the center of the disc is at X=0, Z=0.
                const center = new THREE.Vector3();
                box.getCenter(center);
                geom.translate(-center.x, -center.y, -center.z);
                geom.computeBoundingBox();
                
                // Determine which axis is the "thickness" axis (the smallest dimension is usually thickness)
                const newBox = geom.boundingBox;
                const newSize = new THREE.Vector3();
                newBox.getSize(newSize);
                
                let upAxis = 'y';
                if (newSize.z < newSize.y && newSize.z < newSize.x) upAxis = 'z';
                if (newSize.x < newSize.y && newSize.x < newSize.z) upAxis = 'x';
                
                // Rotate so thickness is along Y
                if (upAxis === 'z') {
                    geom.rotateX(-Math.PI / 2);
                } else if (upAxis === 'x') {
                    geom.rotateZ(Math.PI / 2);
                }
                
                // FLIP 180 degrees: The original 3MF had the snap-fit facing the top.
                // We rotate around X to invert Y, ensuring the smooth face points UP (+Y).
                geom.rotateX(Math.PI);
                
                geom.computeBoundingBox();
                
                // Position so the LOWEST point rests perfectly on Y = 0
                const finalBox = geom.boundingBox;
                geom.translate(0, -finalBox.min.y, 0); 
                
                geom.computeBoundingBox();
                geom.computeBoundingSphere();
                
                ownedGeometry = geom;
                setAttachmentGeo(geom);
                // Top face is exactly at the new max Y
                setPlateTopY(geom.boundingBox.max.y);
            }
        }, undefined, () => {
            if (active) onTypographyState?.({ status: 'error', error: 'The original cap could not be loaded. Reload the editor to retry.' });
        });
        return () => { active = false; ownedGeometry?.dispose(); };
    }, [onTypographyState]);

    const safeBase = (baseColor?.length > 7 ? baseColor.substring(0, 7) : baseColor) || "#E63946";

    return (
        <group>
            {attachmentGeo && (
                <mesh geometry={attachmentGeo} userData={{ popSocketCap: true }} castShadow receiveShadow>
                    <meshStandardMaterial color={safeBase} roughness={0.55} metalness={0.05} />
                </mesh>
            )}

            {text.trim().length > 0 && attachmentGeo && (
                <ExtrudedText config={config} positionY={plateTopY} onTypographyState={onTypographyState} />
            )}
        </group>
    );
});

PopSocketMesh.displayName = "PopSocketMesh";
export default PopSocketMesh;
