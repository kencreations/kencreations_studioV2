import React, {
    useEffect,
    useRef,
    useMemo,
    useState,
    useImperativeHandle,
    forwardRef,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ── Available fonts ───────────────────────────────────────────────────────────
export const FONT_OPTIONS = [
    { label: "Titan One", path: "/fonts/TitanOne.ttf" },
    { label: "Showpop", path: "/fonts/Showpop.ttf" },
    { label: "Bebas Neue", path: "/fonts/BebasNeue.ttf" },
    { label: "Kindergo", path: "/fonts/Kindergo.ttf" },
    { label: "Retro Dolly", path: "/fonts/RetroDolly.ttf" },
    { label: "DynaPuff", path: "/fonts/DynaPuff.ttf" },
    { label: "Pacifico", path: "/fonts/Pacifico.ttf" },
    { label: "Coiny", path: "/fonts/Coiny.ttf" },
];
export const AVAILABLE_FONTS = FONT_OPTIONS.map((f) => f.label);

// ── State ─────────────────────────────────────────────────────────────────────
export type KeycapState = {
    legends: string;
    capColor: string;
    legendColor: string;
    legendSizePct: number;
    legendDepth: number;
    fontLabel: string;
    topBorder: boolean;
    mergeForExport: boolean;
};

// ── Export handle ─────────────────────────────────────────────────────────────
export type SceneKeycapHandle = {
    exportMergedGeometry: () => {
        caps: THREE.BufferGeometry;
        legends: THREE.BufferGeometry;
    } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if the legend item is an icon token like [mdi:heart] */
export function isIconToken(s: string): boolean {
    return /^\[[\w-]+:[\w-]+\]$/.test(s);
}
/** Extract the iconify id from a token: "[mdi:heart]" → "mdi:heart" */
export function iconIdFromToken(token: string): string {
    return token.slice(1, -1);
}

/**
 * Parse the legends string into an array of legend items.
 * Supports plain characters AND icon tokens [set:name].
 */
export function lettersFromLegends(legends: string): string[] {
    const result: string[] = [];
    // Match [set:name] icon tokens first, then any single non-whitespace char
    const re = /\[[\w-]+:[\w-]+\]|[^\s]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(legends)) !== null) {
        result.push(m[0]);
    }
    return result;
}

const SCALE = 0.28;
const GAP_MM = 1.5; // mm gap between caps
const MAX_COLS = 6;

// spacing is computed dynamically once cap BB is known
function computeSpacing(capBB: THREE.Box3 | null): number {
    if (!capBB) return 20;
    const sz = new THREE.Vector3();
    capBB.getSize(sz);
    return sz.x * SCALE + GAP_MM;
}

export function gridPositions(
    count: number,
    spacing: number,
): [number, number, number][] {
    const cols = Math.min(count, MAX_COLS);
    const rows = Math.ceil(count / cols);
    return Array.from({ length: count }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return [
            (c - (cols - 1) / 2) * spacing,
            ((rows - 1) / 2 - r) * spacing,
            0,
        ] as [number, number, number];
    });
}

export function computeSetBounds(
    count: number,
    capBB: THREE.Box3 | null,
): { x: number; y: number; z: number } {
    if (!capBB || count === 0) return { x: 0, y: 0, z: 0 };
    const sz = new THREE.Vector3();
    capBB.getSize(sz);
    const spacing = computeSpacing(capBB);
    const cols = Math.min(count, MAX_COLS);
    const rows = Math.ceil(count / cols);
    const capW = sz.x * SCALE;
    const capH = sz.y * SCALE;
    return {
        x: Math.round((cols * capW + (cols - 1) * GAP_MM) * 10) / 10,
        y: Math.round((rows * capH + (rows - 1) * GAP_MM) * 10) / 10,
        z: Math.round(sz.z * SCALE * 10) / 10,
    };
}

// ── Geometry cache ────────────────────────────────────────────────────────────
const geoCache = new Map<string, THREE.ExtrudeGeometry | null>();

// ── Icon SVG + geometry caches (module-level for persistence) ─────────────────
const iconSvgCache = new Map<string, string | null>(); // iconId → svg text
const iconGeoCache = new Map<string, THREE.BufferGeometry | null>(); // key → geo

/** Fetch an SVG string from the Iconify API (cached). */
async function fetchIconSVG(iconId: string): Promise<string | null> {
    if (iconSvgCache.has(iconId)) return iconSvgCache.get(iconId) ?? null;
    const [set, name] = iconId.split(":");
    if (!set || !name) {
        iconSvgCache.set(iconId, null);
        return null;
    }
    try {
        const res = await fetch(
            `https://api.iconify.design/${set}/${name}.svg?width=100&height=100`,
        );
        if (!res.ok) {
            iconSvgCache.set(iconId, null);
            return null;
        }
        const svg = await res.text();
        iconSvgCache.set(iconId, svg);
        return svg;
    } catch {
        iconSvgCache.set(iconId, null);
        return null;
    }
}

/** Convert an SVG string to an extruded BufferGeometry, normalised to `size` × `size`. */
function buildIconGeoFromSVG(
    svgText: string,
    size: number,
    depth: number,
): THREE.BufferGeometry | null {
    // SVGLoader can't parse CSS color keywords. Replace before parsing.
    const sanitized = svgText
        .replace(/currentColor/gi, "#000000")
        .replace(/stroke="none"/g, "");

    const loader = new SVGLoader();
    const data = loader.parse(sanitized);
    const geos: THREE.BufferGeometry[] = [];

    // SVG Y axis points DOWN; THREE Y points UP.
    // We negate Y on every shape/hole point BEFORE creating ExtrudeGeometry so
    // the geometry is built with the correct winding order from the start.
    // (Negating Y after the fact reverses face winding, causing inverted normals
    // that make the mesh look hollow / inside-out.)
    const flipShapeY = (shape: THREE.Shape): void => {
        for (const pt of shape.getPoints()) {
            void pt;
        } // ensure curves resolved
        shape.curves.forEach((c) => {
            if ("v1" in c) {
                (c as any).v1.y *= -1;
            }
            if ("v2" in c) {
                (c as any).v2.y *= -1;
            }
            if ("v" in c) {
                (c as any).v.y *= -1;
            }
            if ("aX" in c) {
                (c as any).aY *= -1;
                (c as any).aStartAngle *= -1;
                (c as any).aEndAngle *= -1;
            }
        });
        shape.currentPoint.y *= -1;
        shape.holes.forEach((hole) => {
            hole.curves.forEach((c) => {
                if ("v1" in c) {
                    (c as any).v1.y *= -1;
                }
                if ("v2" in c) {
                    (c as any).v2.y *= -1;
                }
                if ("v" in c) {
                    (c as any).v.y *= -1;
                }
            });
            hole.currentPoint.y *= -1;
        });
    };

    for (const path of data.paths) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
            // Build extruded geometry from shape points in SVG space (Y-down),
            // then flip the bounding box. Simpler: flip the raw vector2 points.
            // Actually the cleanest approach: let THREE.Shape handle points.
            // We apply a 2D scale to the shape's underlying points array.
            void flipShapeY; // defined above but the cleanest way is below:

            // Collect all shape + hole points, negate Y, rebuild as ExtrudeGeo
            const pts = shape.extractPoints(12);
            const outer = pts.shape.map((p) => new THREE.Vector2(p.x, -p.y));
            const holes = pts.holes.map((h) =>
                h.map((p) => new THREE.Vector2(p.x, -p.y)),
            );

            const s2 = new THREE.Shape(outer);
            holes.forEach((h) => {
                const holePath = new THREE.Path(h);
                s2.holes.push(holePath);
            });

            const geo = new THREE.ExtrudeGeometry(s2, {
                depth,
                bevelEnabled: true,
                bevelThickness: depth * 0.1,
                bevelSize: depth * 0.04,
                bevelSegments: 1,
                curveSegments: 10,
            });
            geos.push(geo);
        }
    }
    if (geos.length === 0) return null;

    const merged =
        geos.length === 1
            ? geos[0]
            : BufferGeometryUtils.mergeGeometries(geos, false);
    if (!merged) return null;

    // Normalise XY to target size, keep Z (depth) intact, then centre
    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const sz = new THREE.Vector3();
    bb.getSize(sz);
    const longest = Math.max(sz.x, sz.y);
    if (longest === 0) return null;

    const s = size / longest;
    merged.scale(s, s, 1);
    merged.computeBoundingBox();
    merged.center();
    return merged;
}

function buildLetterGeo(
    font: Font,
    ch: string,
    sizeUnits: number,
    depth: number,
): THREE.ExtrudeGeometry | null {
    if (!ch.trim()) return null;
    const k = `${font.data.familyName}|${ch}|${sizeUnits.toFixed(2)}|${depth.toFixed(2)}`;
    if (geoCache.has(k)) return geoCache.get(k)!;
    const shapes = font.generateShapes(ch, sizeUnits);
    if (!shapes.length) {
        geoCache.set(k, null);
        return null;
    }
    const g = new THREE.ExtrudeGeometry(shapes, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.04,
        bevelSegments: 1,
        curveSegments: 14,
    });
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
    geoCache.set(k, g);
    return g;
}

// ── Instanced cap bodies ──────────────────────────────────────────────────────
const CapInstances = React.memo(
    ({
        capGeo,
        positions,
        color,
    }: {
        capGeo: THREE.BufferGeometry;
        positions: [number, number, number][];
        color: string;
    }) => {
        const ref = useRef<THREE.InstancedMesh>(null);
        const mat = useMemo(
            () =>
                new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.28,
                    metalness: 0.06,
                }),
            [color],
        );

        useEffect(() => {
            const mesh = ref.current;
            if (!mesh) return;
            const m4 = new THREE.Matrix4();
            const sc = new THREE.Vector3(SCALE, SCALE, SCALE);
            positions.forEach((p, i) => {
                m4.compose(new THREE.Vector3(...p), new THREE.Quaternion(), sc);
                mesh.setMatrixAt(i, m4);
            });
            mesh.instanceMatrix.needsUpdate = true;
        }, [positions]);

        return (
            <instancedMesh
                ref={ref}
                args={[capGeo, mat, positions.length]}
                castShadow
                receiveShadow
            />
        );
    },
);

// ── Letter meshes ─────────────────────────────────────────────────────────────
const LetterMeshes = React.memo(
    ({
        letters,
        positions,
        font,
        sizeUnits,
        depth,
        color,
        letterZ,
    }: {
        letters: string[];
        positions: [number, number, number][];
        font: Font;
        sizeUnits: number;
        depth: number;
        color: string;
        letterZ: number;
    }) => {
        const mat = useMemo(
            () =>
                new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.22,
                    metalness: 0.04,
                }),
            [color],
        );
        return (
            <>
                {letters.map((ch, i) => {
                    if (isIconToken(ch)) return null; // icons rendered by IconMeshes
                    const geo = buildLetterGeo(font, ch, sizeUnits, depth);
                    if (!geo) return null;
                    const [x, y] = positions[i];
                    return (
                        <mesh
                            key={`${ch}-${i}`}
                            geometry={geo}
                            material={mat}
                            position={[x, y, letterZ]}
                            castShadow
                        />
                    );
                })}
            </>
        );
    },
);

// ── Border rings ──────────────────────────────────────────────────────────────
const BorderRings = React.memo(
    ({
        positions,
        capBB,
        color,
    }: {
        positions: [number, number, number][];
        capBB: THREE.Box3;
        color: string;
    }) => {
        const sz = new THREE.Vector3();
        capBB.getSize(sz);
        const r = (Math.min(sz.x, sz.y) * SCALE) / 2;
        const geo = useMemo(
            () => new THREE.TorusGeometry(r * 0.88, r * 0.06, 10, 64),
            [r],
        );
        const mat = useMemo(
            () =>
                new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.25,
                    metalness: 0.06,
                }),
            [color],
        );
        const borderZ = capBB.max.z * SCALE + 0.1;
        return (
            <>
                {positions.map((p, i) => (
                    <mesh
                        key={i}
                        geometry={geo}
                        material={mat}
                        position={[p[0], p[1], borderZ]}
                        castShadow
                    />
                ))}
            </>
        );
    },
);

// ── Icon meshes (SVG extruded items) ─────────────────────────────────────────
const IconMeshes = React.memo(
    ({
        allLetters,
        positions,
        svgMap,
        size,
        depth,
        color,
        letterZ,
    }: {
        allLetters: string[];
        positions: [number, number, number][];
        svgMap: Map<string, string>;
        size: number;
        depth: number;
        color: string;
        letterZ: number;
    }) => {
        const mat = useMemo(
            () =>
                new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.22,
                    metalness: 0.04,
                }),
            [color],
        );
        return (
            <>
                {allLetters.map((token, i) => {
                    if (!isIconToken(token)) return null;
                    const iconId = iconIdFromToken(token);
                    const svgText = svgMap.get(iconId);
                    if (!svgText) return null;

                    // Build (or retrieve) cached icon geometry (v3 = Y-flip-before-extrude)
                    const cacheKey = `v3|${iconId}|${size.toFixed(2)}|${depth.toFixed(2)}`;
                    let geo = iconGeoCache.get(cacheKey);
                    if (geo === undefined) {
                        geo = buildIconGeoFromSVG(svgText, size, depth) ?? null;
                        iconGeoCache.set(cacheKey, geo);
                    }
                    if (!geo) return null;

                    const [x, y] = positions[i];
                    return (
                        <mesh
                            key={`icon-${token}-${i}`}
                            geometry={geo}
                            material={mat}
                            position={[x, y, letterZ]}
                            castShadow
                        />
                    );
                })}
            </>
        );
    },
);

// ── SceneInner exposes export function via ref ────────────────────────────────
interface SceneInnerProps {
    state: KeycapState;
    onCapBB?: (bb: THREE.Box3 | null) => void;
    customGeo?: THREE.BufferGeometry | null;
}
interface SceneInnerHandle {
    buildExportGeo: () => {
        caps: THREE.BufferGeometry;
        legends: THREE.BufferGeometry;
    } | null;
}

const SceneInner = forwardRef<SceneInnerHandle, SceneInnerProps>(
    ({ state, onCapBB, customGeo }, ref) => {
        const [capGeo, setCapGeo] = useState<THREE.BufferGeometry | null>(null);
        const [capBB, setCapBB] = useState<THREE.Box3 | null>(null);
        const [font, setFont] = useState<Font | null>(null);
        // Map of iconId → fetched SVG text for icons currently in the legends
        const [iconSvgMap, setIconSvgMap] = useState<Map<string, string>>(
            new Map(),
        );

        // Helper to normalize geometry to ~65 units so SCALE=0.28 works
        const normalizeGeo = (g) => {
            const TEMPLATE_RAW_SIZE = 65;
            const sz = new THREE.Vector3();
            g.boundingBox.getSize(sz);
            const longestAxis = Math.max(sz.x, sz.y);
            if (longestAxis > 0) {
                const normScale = TEMPLATE_RAW_SIZE / longestAxis;
                g.scale(normScale, normScale, normScale);
                g.computeBoundingBox();
            }
            return g;
        };

        // Load geometry: prefer customGeo if provided, else fall back to template.stl
        useEffect(() => {
            if (customGeo) {
                const g = customGeo.clone();
                g.computeVertexNormals();
                g.center();
                g.computeBoundingBox();
                normalizeGeo(g);

                setCapGeo(g);
                const bb = g.boundingBox.clone();
                setCapBB(bb);
                onCapBB?.(bb);
                return;
            }
            new STLLoader().load(
                "./models/keycaps/template.stl",
                (g) => {
                    g.computeVertexNormals();
                    g.center();
                    g.computeBoundingBox();
                    normalizeGeo(g);

                    setCapGeo(g);
                    const bb = g.boundingBox.clone();
                    setCapBB(bb);
                    onCapBB?.(bb);
                },
                undefined,
                (e) => console.error("STL error", e),
            );
        }, [customGeo]);

        useEffect(() => {
            const opt =
                FONT_OPTIONS.find((f) => f.label === state.fontLabel) ??
                FONT_OPTIONS[0];
            const fl = new FontLoader();
            const tl = new TTFLoader();
            tl.load(
                opt.path,
                (json: any) => setFont(fl.parse(json)),
                undefined,
                (e) => console.error("Font error", e),
            );
        }, [state.fontLabel]);

        // Fetch SVG data for any icon tokens present in the current legends
        const letters = lettersFromLegends(state.legends);
        useEffect(() => {
            const iconTokens = letters.filter(isIconToken);
            if (iconTokens.length === 0) return;
            let cancelled = false;
            (async () => {
                const entries = await Promise.all(
                    iconTokens.map(async (token) => {
                        const id = iconIdFromToken(token);
                        const svg = await fetchIconSVG(id);
                        return [id, svg] as [string, string | null];
                    }),
                );
                if (cancelled) return;
                setIconSvgMap((prev) => {
                    const next = new Map(prev);
                    for (const [id, svg] of entries) {
                        if (svg) next.set(id, svg);
                    }
                    return next;
                });
            })();
            return () => {
                cancelled = true;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [state.legends]);

        const spacing = computeSpacing(capBB);
        const positions = useMemo(
            () => gridPositions(letters.length, spacing),
            [letters.length, spacing, letters.join("")],
        );

        const letterSizeUnits = useMemo(() => {
            if (!capBB) return 5;
            const sz = new THREE.Vector3();
            capBB.getSize(sz);
            return (sz.x * SCALE * state.legendSizePct) / 100;
        }, [capBB, state.legendSizePct]);

        // The keycap body is rendered at SCALE=0.28 of its raw geometry.
        // legendDepth is in real mm — we must also scale it by SCALE so the
        // displayed depth is proportional to the scaled keycap body.
        // (Export code uses the raw mm value unchanged.)
        const displayDepth = state.legendDepth * SCALE;
        const letterZ = capBB ? capBB.max.z * SCALE - displayDepth * 0.05 : 0;

        // ── Export geometry builder (NATIVE mm scale — no display SCALE applied) ──
        useImperativeHandle(
            ref,
            () => ({
                buildExportGeo(): {
                    caps: THREE.BufferGeometry;
                    legends: THREE.BufferGeometry;
                } | null {
                    if (!capGeo || !font || !capBB) return null;

                    // Real cap dimensions in STL mm units, scaled exactly to 18x18mm
                    const capSz = new THREE.Vector3();
                    capBB.getSize(capSz);

                    const TARGET_SIZE = 18; // mm
                    const scaleX = TARGET_SIZE / capSz.x;
                    const scaleY = TARGET_SIZE / capSz.y;
                    const scaleZ = scaleX; // keep Z proportional to X

                    const realSpacing = TARGET_SIZE + GAP_MM; // centre-to-centre mm
                    const realCapTopZ = capBB.max.z * scaleZ; // top surface in mm
                    const realLetterZ = realCapTopZ - 0.05; // barely proud of top
                    const realLetterSz =
                        (TARGET_SIZE * state.legendSizePct) / 100; // mm

                    // Recompute grid positions in real mm (not display units)
                    const count = letters.length;
                    const cols = Math.min(count, MAX_COLS);
                    const rows = Math.ceil(count / cols);
                    const realPos: [number, number, number][] = Array.from(
                        { length: count },
                        (_, i) => [
                            ((i % cols) - (cols - 1) / 2) * realSpacing,
                            ((rows - 1) / 2 - Math.floor(i / cols)) *
                                realSpacing,
                            0,
                        ],
                    );

                    const capGeos: THREE.BufferGeometry[] = [];
                    const legendGeos: THREE.BufferGeometry[] = [];

                    // Caps scaled to exactly 18x18mm
                    realPos.forEach((pos) => {
                        const g = capGeo.clone();
                        g.applyMatrix4(
                            new THREE.Matrix4().makeScale(
                                scaleX,
                                scaleY,
                                scaleZ,
                            ),
                        );
                        g.applyMatrix4(
                            new THREE.Matrix4().makeTranslation(...pos),
                        );
                        capGeos.push(g);
                    });

                    // Legends: text letters + icons, placed on cap top surface
                    letters.forEach((item, i) => {
                        const [x, y] = realPos[i];
                        if (isIconToken(item)) {
                            // SVG icon — use cached SVG data (already fetched for preview)
                            const svg = iconSvgMap.get(iconIdFromToken(item));
                            if (!svg) return;
                            const geo = buildIconGeoFromSVG(
                                svg,
                                realLetterSz,
                                state.legendDepth,
                            );
                            if (!geo) return;
                            const g = geo.clone();
                            g.applyMatrix4(
                                new THREE.Matrix4().makeTranslation(
                                    x,
                                    y,
                                    realLetterZ,
                                ),
                            );
                            legendGeos.push(g);
                        } else {
                            // Text letter
                            const geo = buildLetterGeo(
                                font,
                                item,
                                realLetterSz,
                                state.legendDepth,
                            );
                            if (!geo) return;
                            const g = geo.clone();
                            g.applyMatrix4(
                                new THREE.Matrix4().makeTranslation(
                                    x,
                                    y,
                                    realLetterZ,
                                ),
                            );
                            legendGeos.push(g);
                        }
                    });

                    const mergedCaps = capGeos.length
                        ? BufferGeometryUtils.mergeGeometries(capGeos, false)
                        : new THREE.BufferGeometry();
                    const mergedLegends = legendGeos.length
                        ? BufferGeometryUtils.mergeGeometries(legendGeos, false)
                        : new THREE.BufferGeometry();

                    return { caps: mergedCaps, legends: mergedLegends };
                },
            }),
            [
                capGeo,
                capBB,
                font,
                letters,
                state.legendSizePct,
                state.legendDepth,
                iconSvgMap,
            ],
        );

        if (!capGeo) return null;

        return (
            <>
                <CapInstances
                    capGeo={capGeo}
                    positions={positions}
                    color={state.capColor}
                />
                {state.topBorder && capBB && (
                    <BorderRings
                        positions={positions}
                        capBB={capBB}
                        color={state.legendColor}
                    />
                )}
                {font && (
                    <LetterMeshes
                        letters={letters}
                        positions={positions}
                        font={font}
                        sizeUnits={letterSizeUnits}
                        depth={displayDepth}
                        color={state.legendColor}
                        letterZ={letterZ}
                    />
                )}
                <IconMeshes
                    allLetters={letters}
                    positions={positions}
                    svgMap={iconSvgMap}
                    size={letterSizeUnits}
                    depth={displayDepth}
                    color={state.legendColor}
                    letterZ={letterZ}
                />
            </>
        );
    },
);

// ── Inner canvas wrapper to bridge ref into R3F context ───────────────────────
const InnerWrapper = forwardRef<SceneInnerHandle, SceneInnerProps>(
    (props, ref) => {
        return <SceneInner ref={ref} {...props} />;
    },
);

const SceneKeycap = InnerWrapper;
export default SceneKeycap;
export type { SceneInnerHandle };
