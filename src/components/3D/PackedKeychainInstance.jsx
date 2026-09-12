import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Center } from "@react-three/drei";
import { load3DFont } from "../../utils/fontManager";
import {
    createTextShapesWithSpacing,
    offsetShapes,
    unionShapes,
} from "../../utils/textContour";
import { useProfile } from "../../contexts/ProfileContext";

const PackedKeychainInstance = React.memo(
    ({
        instance,
        isActive,
        onClick,
        threeX,
        threeY,
        visible = true,
    }) => {
        const { allFonts } = useProfile();
        
        const [baseGeo, setBaseGeo] = useState(null);
        const [textGeo, setTextGeo] = useState(null);
        const [ringGeo, setRingGeo] = useState(null);

        const fontCacheRef = useRef({});
        const baseBBRef = useRef(null);
        const centerOffsetRef = useRef({ cx: 0, cy: 0 });

        const translateShape2D = (shape, dx, dy) => {
            const translatedOuter = shape
                .getPoints(16)
                .map((p) => new THREE.Vector2(p.x + dx, p.y + dy));
            const translatedShape = new THREE.Shape(translatedOuter);

            for (const hole of shape.holes) {
                const translatedHole = hole
                    .getPoints(16)
                    .map((p) => new THREE.Vector2(p.x + dx, p.y + dy));
                translatedShape.holes.push(new THREE.Path(translatedHole));
            }

            return translatedShape;
        };

        // Text & Base Geometry
        useEffect(() => {
            let active = true;

            const buildGeometry = async () => {
                const fontOption = allFonts.find(
                    (f) => f.id === instance.font || f.label === instance.font,
                ) || allFonts[0];

                if (!fontOption) return;

                if (!fontCacheRef.current[fontOption.id]) {
                    try {
                        fontCacheRef.current[fontOption.id] = await load3DFont(fontOption);
                    } catch (err) {
                        console.error("Failed to load font:", err);
                        return;
                    }
                }

                if (!active) return;

                const loadedFont = fontCacheRef.current[fontOption.id];
                
                const lineShapes = createTextShapesWithSpacing(
                    instance.text || "",
                    loadedFont,
                    instance.size || 20,
                    0,
                ).map((shape) => translateShape2D(shape, instance.textX || 0, instance.textY || 0));

                if (lineShapes.length === 0) {
                    setTextGeo(null);
                    setBaseGeo(null);
                    return;
                }

                const tGeo = new THREE.ExtrudeGeometry(lineShapes, {
                    depth: instance.depth || 2,
                    bevelEnabled: false,
                    curveSegments: 4,
                });
                
                const mergedText = BufferGeometryUtils.mergeVertices(tGeo);
                if (mergedText.attributes.uv) mergedText.deleteAttribute("uv");
                
                // Base
                const solidShapes = unionShapes(lineShapes);
                const baseShapes = offsetShapes(solidShapes, instance.basePadding || 4);
                
                const bHeight = instance.baseThickness || 3;
                let bGeo = baseShapes.length > 0
                        ? new THREE.ExtrudeGeometry(baseShapes, {
                              depth: bHeight,
                              bevelEnabled: false,
                              curveSegments: 16,
                          })
                        : new THREE.BoxGeometry(20, 10, bHeight);

                bGeo.computeBoundingBox();
                bGeo.translate(0, 0, -bHeight);
                
                const mergedBase = BufferGeometryUtils.mergeVertices(bGeo);
                if (mergedBase.attributes.uv) mergedBase.deleteAttribute("uv");

                // Center the geometry
                mergedBase.computeBoundingBox();
                const bb = mergedBase.boundingBox;
                const cx = -(bb.max.x + bb.min.x) / 2;
                const cy = -(bb.max.y + bb.min.y) / 2;
                centerOffsetRef.current = { cx, cy };
                
                mergedBase.translate(cx, cy, 0);
                mergedText.translate(cx, cy, 0);
                
                mergedBase.computeBoundingBox();
                baseBBRef.current = mergedBase.boundingBox.clone();

                setTextGeo(mergedText);
                setBaseGeo(mergedBase);
            };

            const handler = setTimeout(buildGeometry, 100);
            
            return () => {
                active = false;
                clearTimeout(handler);
            };
        }, [
            instance.text,
            instance.font,
            instance.size,
            instance.depth,
            instance.textX,
            instance.textY,
            instance.basePadding,
            instance.baseThickness,
            allFonts
        ]);

        // Keyring Geometry
        useEffect(() => {
            if (!instance.keyringEnabled || !baseBBRef.current) {
                setRingGeo(null);
                return;
            }

            const rShape = new THREE.Shape();
            rShape.absarc(0, 0, (instance.keyringDiameter || 10) / 2, 0, Math.PI * 2, false);
            
            const hole = new THREE.Path();
            hole.absarc(0, 0, (instance.keyringHole || 4) / 2, 0, Math.PI * 2, true);
            rShape.holes.push(hole);

            const rGeo = new THREE.ExtrudeGeometry(rShape, {
                depth: instance.baseThickness || 3,
                bevelEnabled: false,
                curveSegments: 32,
            });

            // Re-calculate the anchor point *before* the centering offset was applied
            // Since we applied cx/cy to the base, its min/max shifted. 
            // The original top-left corner was at `baseBBRef.current.min.x - cx`
            // Wait, we can just apply the same offset `cx` and `cy` to the keyring.
            
            // Re-create the un-centered bounding box approximation
            const origMinX = baseBBRef.current.min.x - centerOffsetRef.current.cx;
            const origMaxY = baseBBRef.current.max.y - centerOffsetRef.current.cy;
            
            const anchorX = origMinX;
            const anchorY = origMaxY;

            rGeo.translate(
                anchorX + (instance.keyringX || 0) + centerOffsetRef.current.cx,
                anchorY + (instance.keyringY || 0) + centerOffsetRef.current.cy,
                -(instance.baseThickness || 3),
            );

            const mergedRing = BufferGeometryUtils.mergeVertices(rGeo);
            if (mergedRing.attributes.uv) mergedRing.deleteAttribute("uv");

            setRingGeo(mergedRing);
        }, [
            instance.keyringEnabled,
            instance.keyringDiameter,
            instance.keyringHole,
            instance.keyringX,
            instance.keyringY,
            instance.baseThickness,
            baseGeo // re-run if base geo updates
        ]);
        
        return (
            <group 
                position={[threeX, threeY, 0]} 
                rotation={[0, 0, instance.rotation || 0]}
                visible={visible}
                raycast={visible ? undefined : () => null}
                onClick={(e) => {
                    if (!visible) return;
                    e.stopPropagation();
                    onClick(instance.id);
                }}
            >
                <Center>
                    {baseGeo && (
                        <mesh geometry={baseGeo} castShadow receiveShadow>
                            <meshStandardMaterial
                                color={
                                    instance.baseColor?.length > 7
                                        ? instance.baseColor.substring(0, 7)
                                        : instance.baseColor || "#EC008C"
                                }
                            />
                        </mesh>
                    )}
                    
                    {textGeo && (
                        <mesh geometry={textGeo} position={[0, 0, 0.1]} castShadow receiveShadow>
                            <meshStandardMaterial
                                color={
                                    instance.textColor?.length > 7
                                        ? instance.textColor.substring(0, 7)
                                        : instance.textColor || "#ffffff"
                                }
                            />
                        </mesh>
                    )}

                    {instance.keyringEnabled && ringGeo && (
                        <mesh geometry={ringGeo} castShadow receiveShadow>
                            <meshStandardMaterial
                                color={
                                    instance.baseColor?.length > 7
                                        ? instance.baseColor.substring(0, 7)
                                        : instance.baseColor || "#EC008C"
                                }
                            />
                        </mesh>
                    )}
                    
                    {isActive && (
                        <group position={[0, 0, 0.5]}>
                            <mesh>
                                <boxGeometry args={[instance.width + 2, instance.depthDim + 2, (instance.depth || 2) + (instance.baseThickness || 3) + 2]} />
                                <meshBasicMaterial color="#00ffff" wireframe opacity={0.5} transparent />
                            </mesh>
                        </group>
                    )}
                </Center>
            </group>
        );
    }
);

export default PackedKeychainInstance;
