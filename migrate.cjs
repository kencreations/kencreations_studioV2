const fs = require('fs');
const file = 'c:\\Users\\Ken\\Desktop\\kencreations-v2\\src\\pages\\ClickerEditor.jsx';
let content = fs.readFileSync(file, 'utf8');

// We already replaced imports. Now let's remove the old ClickerModel and GEOMETRY HELPERS
// and replace them with the new ClickerModel.

content = content.replace(/\/\/ ───+[\s\S]*?\/\/ GEOMETRY HELPERS[\s\S]*?\/\/ ───+[\s\S]*?(?=\/\/ ───+[\n\r]+\/\/ UI PRIMITIVES)/g, '');

const newModelCode = `
// ────────────────────────────────────────────────────────────────────────────
// 3D CLICKER MODEL
// ────────────────────────────────────────────────────────────────────────────

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

content = content.replace(/\/\/ ───+[\s\S]*?\/\/ 3D CLICKER MODEL[\s\S]*?(?=\/\/ ───+[\n\r]+\/\/ VIEWPORT OVERLAY)/g, newModelCode);

// Add regionSet to ClickerEditor state
content = content.replace(/const \[imageSrc, setImageSrc\] = useState\(null\);/g, "const [regionSet, setRegionSet] = useState(null);\n    const [imageSrc, setImageSrc] = useState(null);");

// Compute buildParams
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
            colorBleed: 0.1, stepHeight: 0.25, travel: 3.5, floorThickness: HOUSING_FLOOR,
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

content = content.replace(/const onLayerColorChange = useCallback/g, buildParamsCode + "\n    const onLayerColorChange = useCallback");

// Replace applyResult
const applyResultCode = `
    const applyResult = useCallback((result) => {
        if (!result) return;
        
        // Setup colorLayers from regionSet
        const layers = [];
        if (result.regions) {
            result.regions.forEach((r, i) => {
                const hex = '#' + r.quantRgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
                layers.push({ id: \`layer_\${i}\`, hex, name: \`Color \${i+1}\`, liftHeight: 0 });
            });
        }
        setColorLayers(layers);
        setRegionSet(result);
    }, []);
`;
content = content.replace(/const applyResult = useCallback\(\(result\) => \{[\s\S]*?\}, \[\]\);/g, applyResultCode);

// Replace runProcessing
const runProcessingCode = `
    const runProcessing = useCallback(async (src, count) => {
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
    }, [smoothing, removeBackground, applyResult]);
`;
content = content.replace(/const runProcessing = useCallback\(async \(src, count\) => \{[\s\S]*?\}, \[.*?\]\);/g, runProcessingCode);

// Replace runTextProcessing
const runTextProcessingCode = `
    const runTextProcessing = useCallback(async (text, fontId) => {
        if (!text?.trim()) { setColorLayers([]); setRegionSet(null); return; }
        setIsTextLoading(true);
        // Note: the reference text processor requires full implementation in letter.ts
        setIsTextLoading(false);
    }, []);
`;
content = content.replace(/const runTextProcessing = useCallback\(async \(text, fontId\) => \{[\s\S]*?\}, \[.*?\]\);/g, runTextProcessingCode);

// Replace handleSvgLoaded
const handleSvgLoadedCode = `
    const handleSvgLoaded = useCallback((svgString) => {
        setIsProcessing(true);
        try {
            const result = parseSvg(svgString, { removeBg: removeBackground });
            applyResult(result);
        } catch (err) {
            console.error('SVG processing failed:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [removeBackground, applyResult]);
`;
content = content.replace(/const handleSvgLoaded = useCallback\(\(svgString\) => \{[\s\S]*?\}, \[.*?\]\);/g, handleSvgLoadedCode);

// Update ClickerModel props in JSX
content = content.replace(/<ClickerModel[\s\S]*?\/>/g, '<ClickerModel regionSet={regionSet} buildParams={buildParams} viewMode={viewMode} showMXSwitch={showMXSwitch} />');

fs.writeFileSync(file, content, 'utf8');
