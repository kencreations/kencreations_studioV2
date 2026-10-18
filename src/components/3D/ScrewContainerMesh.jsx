import React, { useMemo, useEffect, useState, useRef, useImperativeHandle } from 'react';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { load3DFont } from '../../utils/fontManager';
import { useFontStore } from '../../hooks/useFontStore';
import {
    createContainerGeometry,
    personalizeLid,
    createLidTextGeometry,
    addBodyKeychainLoop,
    addBodyPushOutHole,
    previewPlacement,
    createContainerPrintScene,
    initializeContainerKernel
} from '../../utils/screwContainerGeometry';

function Part({ config, part, geometry, textGeometry, isEngraved }) {
    const mesh = useRef();
    const target = previewPlacement(config, part);
    const [initialZ] = useState(target.z);
    useFrame((_, delta) => {
        if (!mesh.current) return;
        mesh.current.position.z = THREE.MathUtils.damp(mesh.current.position.z, target.z, 12, Math.min(delta, 0.05));
    });
    return (
        <group ref={mesh} position={[0, 0, initialZ]} rotation={[target.rotationX, 0, 0]}>
            <mesh geometry={geometry} name={`Container_${part}`} castShadow receiveShadow>
                <meshStandardMaterial
                    color={(part === 'body' ? config.bodyColor : config.lidColor)?.slice(0, 7)}
                    roughness={0.48}
                    metalness={0.03}
                />
            </mesh>
            {part === 'lid' && textGeometry && (
                <mesh geometry={textGeometry} name="Container_text" castShadow receiveShadow>
                    <meshStandardMaterial
                        color={(config.textColor || '#FFFFFF')?.slice(0, 7)}
                        roughness={0.48}
                        metalness={0.03}
                        polygonOffset={true}
                        polygonOffsetFactor={-2}
                        polygonOffsetUnits={-2}
                    />
                </mesh>
            )}
        </group>
    );
}

export default React.memo(function ScrewContainerMesh({ config, ref }) {
    const { allFonts } = useFontStore();
    const [font, setFont] = useState(null);
    const [kernelReady, setKernelReady] = useState(false);
    const [kernelError, setKernelError] = useState(null);

    useEffect(() => {
        let active = true;
        initializeContainerKernel(wasmUrl).then(() => { if (active) setKernelReady(true); })
            .catch(error => { if (active) setKernelError(error); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        if (config.personalized && config.personText) {
            const choice = allFonts.find(f => f.id === config.personFont || f.label === config.personFont) || allFonts[0];
            if (choice) load3DFont(choice).then(f => { if (active) setFont({ id: config.personFont, data: f }); }).catch(() => {});
        }
        return () => { active = false; };
    }, [config.personalized, config.personFont, config.personText, allFonts]);

    // View changes and color changes animate or update existing material without rebuilding CSG.
    const geometryKey = JSON.stringify({
        ...config,
        viewMode: undefined,
        bodyColor: undefined,
        lidColor: undefined,
        textColor: undefined
    });
    const geometryConfig = useMemo(() => JSON.parse(geometryKey), [geometryKey]);
    const activeFont = font?.id === config.personFont ? font.data : null;

    const geometries = useMemo(() => {
        const c = geometryConfig, result = {};
        if (!kernelReady) return result;
        for (const part of ['body', 'lid']) {
            if (c.printMode === (part === 'body' ? 'lid' : 'body')) continue;
            const shell = createContainerGeometry(c, part, c.printMode === 'fitTest');
            let final = shell;
            if (part === 'body') {
                if (c.printMode !== 'fitTest') {
                    if (c.pushOutHoleEnabled) {
                        const withHole = addBodyPushOutHole(final, c);
                        if (withHole !== final) {
                            if (final !== shell) final.dispose();
                            final = withHole;
                        }
                    }
                    if (c.addKeychainHole) {
                        const withLoop = addBodyKeychainLoop(final, c);
                        if (withLoop !== final) {
                            if (final !== shell) final.dispose();
                            final = withLoop;
                        }
                    }
                }
            } else {
                if (c.printMode === 'fitTest' || !c.personalized || !c.personText?.trim() || !activeFont) {
                    final = shell;
                } else {
                    const textInfo = createLidTextGeometry(c, activeFont);
                    final = personalizeLid(shell, c, activeFont);
                    if (textInfo) {
                        if (c.personStyle === 'embossed') {
                            const shiftZ = textInfo.reliefDepth;
                            textInfo.textGeo.translate(0, 0, shiftZ);
                            result.text = textInfo.textGeo;
                            const baseCopy = shell.clone();
                            baseCopy.translate(0, 0, shiftZ);
                            result.lidBase = baseCopy;
                        } else {
                            textInfo.textGeo.dispose();
                            result.text = null;
                        }
                        result.isEngraved = textInfo.isEngraved;
                    }
                }
            }
            if (final !== shell && final !== result.lidBase) shell.dispose();
            result[part] = final;
        }
        return result;
    }, [geometryConfig, activeFont, kernelReady]);

    useEffect(() => () => {
        Object.values(geometries).forEach(g => {
            if (g && typeof g.dispose === 'function') g.dispose();
        });
    }, [geometries]);

    useImperativeHandle(ref, () => ({
        getPrintScene(format) {
            if (config.personalized && config.personText?.trim() && config.printMode !== 'body' && config.printMode !== 'fitTest' && !activeFont)
                throw new Error('Lid font is still loading. Please wait before exporting.');
            return createContainerPrintScene(config, geometries, format);
        },
    }), [config, geometries, activeFont]);

    if (kernelError) throw kernelError;

    const isEmbossedPreview = config.personalized && config.personStyle === 'embossed' && geometries.text;
    const lidGeometry = isEmbossedPreview && geometries.lidBase ? geometries.lidBase : geometries.lid;
    const textGeometry = isEmbossedPreview ? geometries.text : null;

    return (
        <group name="ScrewContainer">
            {geometries.body && (
                <Part
                    key={geometries.body.uuid}
                    config={config}
                    part="body"
                    geometry={geometries.body}
                />
            )}
            {geometries.lid && (
                <Part
                    key={geometries.lid.uuid}
                    config={config}
                    part="lid"
                    geometry={lidGeometry}
                    textGeometry={textGeometry}
                    isEngraved={geometries.isEngraved}
                />
            )}
        </group>
    );
});
