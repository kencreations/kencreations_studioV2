const fs = require('fs');

const file = 'c:\\Users\\Ken\\Desktop\\kencreations-v2\\src\\pages\\ClickerEditor.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

function replaceBlock(startMarker, endMarker, newContent) {
    const startIdx = lines.findIndex(l => l.includes(startMarker));
    const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes(endMarker));
    if (startIdx !== -1 && endIdx !== -1) {
        lines.splice(startIdx, endIdx - startIdx + 1, newContent);
    }
}

// 1. Imports
const importsIndex = lines.findIndex(l => l.includes('import { processClickerImage }'));
if (importsIndex !== -1) {
    lines.splice(importsIndex, 3, 
        "import { processImage } from '../engine/image/pipeline';",
        "import { loadUrlToImage } from '../engine/image/decode';",
        "import { parseSvg } from '../engine/image/logo';",
        "import { loadBundledFonts, FONT_OPTIONS } from '../engine/image/letter';",
        "import { useGeometryWorker } from '../hooks/useGeometryWorker';"
    );
}

// 2. Add regionSet state
const stateIdx = lines.findIndex(l => l.includes('const [imageSrc, setImageSrc] = useState(null);'));
if (stateIdx !== -1) {
    lines.splice(stateIdx, 0, '    const [regionSet, setRegionSet] = useState(null);');
}

// 3. Delete GEOMETRY HELPERS
replaceBlock('// GEOMETRY HELPERS', '// UI PRIMITIVES', '// UI PRIMITIVES');

// 4. Update ClickerModel Component
const newClickerModel = `
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function PartMesh({ part }) {
    const geo = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        let positions;
        if (part.numProp === 3) {
            positions = part.vertProperties;
        } else {
            const count = part.vertProperties.length / part.numProp;
            positions = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                positions[i * 3] = part.vertProperties[i * part.numProp];
                positions[i * 3 + 1] = part.vertProperties[i * part.numProp + 1];
                positions[i * 3 + 2] = part.vertProperties[i * part.numProp + 2];
            }
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(part.triVerts, 1));
        const creased = toCreasedNormals(geometry, (35 * Math.PI) / 180);
        geometry.dispose();
        return creased;
    }, [part]);

    const material = useMemo(() => {
        const hex = \`#\${part.colorRgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}\`;
        return new THREE.MeshStandardMaterial({ color: hex, side: THREE.DoubleSide });
    }, [part.colorRgb]);

    return (
        <mesh geometry={geo} material={material} castShadow receiveShadow />
    );
}

function ClickerModel({
    regionSet, buildParams, viewMode, showMXSwitch
}) {
    const socketUrl = '/switch/socket.3mf';
    const stemUrl = '/switch/stem.3mf';
    const switchUrl = '/switch/switch.3mf';

    const { parts, switchPlacements, isBuilding } = useGeometryWorker(socketUrl, stemUrl, switchUrl, regionSet?.regions, regionSet?.outline, buildParams);

    const capOffsetRef = useRef(0);
    const targetCapOffset = viewMode === 'exploded' ? buildParams?.imageDepth * 1.5 + 10 : 0;
    useFrame((_, delta) => {
        capOffsetRef.current += (targetCapOffset - capOffsetRef.current) * Math.min(1, delta * 5);
    });

    return (
        <group>
            {parts?.map((p, i) => (
                <group key={i} position={[0, 0, p.group === 'top' ? capOffsetRef.current : 0]}>
                    <PartMesh part={p} />
                </group>
            ))}
            {showMXSwitch && switchPlacements?.map((c, i) => (
                <group key={\`sw-\${i}\`} position={[c.x, c.y, 0]} rotation={[0, 0, c.rotation]}>
                    <MXSwitchMesh zOffset={buildParams?.floorThickness + 4.5} />
                </group>
            ))}
        </group>
    );
}
`;
replaceBlock('function ClickerModel({', '// VIEWPORT OVERLAY', newClickerModel + '\n// ────────────────────────────────────────────────────────────────────────────\n// VIEWPORT OVERLAY');

// 5. Build Params Memo
const buildParamsCode = `
    const buildParams = useMemo(() => {
        const parseHex = (hex) => {
            const c = new THREE.Color(hex);
            return [Math.round(c.r*255), Math.round(c.g*255), Math.round(c.b*255)];
        };
        const componentHeights = {};
        colorLayers.forEach(l => { componentHeights[l.name] = l.liftHeight; });
        return {
            baseShape, capWidthMm: capSize, topThickness: capDepth - imageDepth,
            imageDepth, imageMargin: 1, borderWidth: 1.5, capProud: 1.5,
            tolerance: switchSocketTol, stemTolerance: switchStemTol,
            colorBleed: 0.1, stepHeight: 0.25, travel: 3.5, floorThickness: 8.0,
            switches: switchOffsets.slice(0, switchCount).map(o => ({ x: o.x ?? 0, y: o.y ?? 0, rotation: o.rotation ?? 0 })),
            keychain: { enabled: keychainHole, style: 'loop', angleDeg: 90, holeDiameterMm: keychainHoleDiam, offsetMm: keychainSlideOffset },
            baseFilamentRgb: parseHex(capBaseColor),
            bodyColorRgb: parseHex(shellColor),
            componentHeights,
            edgeSettings: [
                { target: 'capTop', style: edgeCapTop, radius: edgeCapTopRadius },
                { target: 'baseTop', style: edgeBase, radius: edgeBaseRadius },
            ],
            extrudeChamfer: true,
        };
    }, [baseShape, capSize, capDepth, imageDepth, switchSocketTol, switchStemTol, switchCount, switchOffsets, keychainHole, keychainHoleDiam, keychainSlideOffset, capBaseColor, shellColor, colorLayers, edgeCapTop, edgeCapTopRadius, edgeBase, edgeBaseRadius]);
`;
const onLayerColorChangeIdx = lines.findIndex(l => l.includes('const onLayerColorChange = useCallback('));
if (onLayerColorChangeIdx !== -1) {
    lines.splice(onLayerColorChangeIdx, 0, buildParamsCode);
}

// 6. Update handlers
const applyResultCode = `    const applyResult = useCallback((result) => {
        if (!result) return;
        const layers = [];
        if (result.regions) {
            result.regions.forEach((r, i) => {
                const hex = '#' + r.quantRgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
                layers.push({ id: \`layer_\${i}\`, hex, name: \`Color \${i+1}\`, liftHeight: 0 });
            });
        }
        setColorLayers(layers);
        setRegionSet(result);
    }, []);`;
replaceBlock('const applyResult = useCallback((result) => {', '}, []);', applyResultCode);

const runProcessingCode = `    const runProcessing = useCallback(async (src, count) => {
        if (!src) return;
        setIsProcessing(true);
        try {
            const img = await loadUrlToImage(src);
            const result = processImage(img, count, {
                smoothing: smoothing / 5,
                removeBg: removeBackground,
                preserveDetail: true
            });
            applyResult(result);
        } catch (err) {
            console.error('Image processing failed:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [smoothing, removeBackground, applyResult]);`;
replaceBlock('const runProcessing = useCallback(async (src, count) => {', '}, [capSize, smoothing, removeBackground, imageDepth, applyResult]);', runProcessingCode);

const handleSvgLoadedCode = `    const handleSvgLoaded = useCallback((svgString) => {
        setIsProcessing(true);
        try {
            const result = parseSvg(svgString, { removeBg: removeBackground });
            applyResult(result);
        } catch (err) {
            console.error('SVG processing failed:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [removeBackground, applyResult]);`;
replaceBlock('const handleSvgLoaded = useCallback((svgString) => {', '}, [colorCount, capSize, imageDepth, applyResult]);', handleSvgLoadedCode);

const runTextProcessingCode = `    const runTextProcessing = useCallback(async (text, fontId) => {
        if (!text?.trim()) { setColorLayers([]); setRegionSet(null); return; }
        setIsTextLoading(true);
        setIsTextLoading(false);
    }, []);`;
replaceBlock('const runTextProcessing = useCallback(async (text, fontId) => {', '}, [shellColor, capSize, imageDepth, applyResult]);', runTextProcessingCode);

// Update ClickerModel JSX props
const jsxStart = lines.findIndex(l => l.includes('<ClickerModel'));
const jsxEnd = lines.findIndex((l, i) => i > jsxStart && l.includes('/>'));
if (jsxStart !== -1 && jsxEnd !== -1) {
    lines.splice(jsxStart, jsxEnd - jsxStart + 1, '                <ClickerModel regionSet={regionSet} buildParams={buildParams} viewMode={viewMode} showMXSwitch={showMXSwitch} />');
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Done mapping ClickerEditor');
