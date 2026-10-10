import React, { useMemo, useState, useEffect } from "react";
import { getCached3DFont } from "../../../utils/fontManager";
import BasePlate from "./BasePlate";
import CupModule from "./CupModule";
import TextModule from "./TextModule";

export default function SmartOrganizer({ config }) {
    const [font1, setFont1] = useState(null);
    const [font2, setFont2] = useState(null);

    // ── Load fonts to measure text width for dynamic centering ───────────
    useEffect(() => {
        let isMounted = true;
        const loadFont = async (fontName, setter) => {
            if (!fontName) return;
            try {
                let url = fontName;
                if (!url.includes('.')) url = `/src/assets/fonts/${fontName}.ttf`;
                const font = await getCached3DFont({ url, id: fontName });
                if (isMounted) setter(font);
            } catch (e) {
                try {
                    const fallback = await getCached3DFont({ url: "/src/assets/fonts/ARIAL.ttf", id: "ARIAL" });
                    if (isMounted) setter(fallback);
                } catch (e2) {}
            }
        };
        loadFont(config.line1Font, setFont1);
        loadFont(config.line2Font, setFont2);
        return () => { isMounted = false; };
    }, [config.line1Font, config.line2Font]);

    // ── Measure actual text width from font shapes ───────────────────────
    const actualTextWidth = useMemo(() => {
        if (!font2) return 60; // fallback width before fonts load
        const safeBackingPad = Number(config.textBackingPad) || 1;

        const getShapesWidth = (font, text, size) => {
            if (!font || !text) return 0;
            const shapes = font.generateShapes(text, Number(size));
            let minX = Infinity, maxX = -Infinity;
            shapes.forEach(shape => {
                shape.getPoints(20).forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                });
            });
            return maxX === -Infinity ? 0 : maxX - minX;
        };

        const w1 = config.line1Text ? getShapesWidth(font1, config.line1Text, config.line1Size) : 0;
        const w2 = getShapesWidth(font2, config.line2Text, config.line2Size);

        const align = config.textAlign || "center";
        const offsetX = Number(config.line1OffsetX) || 0;

        let minX2 = -w2 / 2;
        let maxX2 = w2 / 2;

        let minX1 = 0, maxX1 = 0;
        if (config.line1Text) {
            if (align === "left") {
                minX1 = minX2;
                maxX1 = minX2 + w1;
            } else if (align === "right") {
                maxX1 = maxX2;
                minX1 = maxX2 - w1;
            } else { // center
                minX1 = -w1 / 2;
                maxX1 = w1 / 2;
            }
            minX1 += offsetX;
            maxX1 += offsetX;
        }

        const overallMinX = Math.min(minX2, minX1);
        const overallMaxX = Math.max(maxX2, maxX1);
        const maxTextWidth = overallMaxX - overallMinX;

        // Total width includes backing pad on each side
        return maxTextWidth + (safeBackingPad * 2);
    }, [font1, font2, config.line1Text, config.line2Text, config.line1Size, config.line2Size, config.textBackingPad, config.line1OffsetX, config.textAlign]);

    // ── Dynamic layout math ──────────────────────────────────────────────
    const pegHeight = config.baseThickness - 1;
    const GAP = 15; // mm gap between cup and text

    const totalAssemblyWidth = config.cupDiameter + GAP + actualTextWidth;
    const cupX = -(totalAssemblyWidth / 2) + (config.cupDiameter / 2);
    const textX = (totalAssemblyWidth / 2) - (actualTextWidth / 2);

    const cupPegsLocal = [{ x: -15, z: 0 }, { x: 15, z: 0 }];
    const textPegsLocal = [{ x: -25, z: 0 }, { x: 25, z: 0 }];

    const globalSlots = [
        ...cupPegsLocal.map(p => ({ x: p.x + cupX, z: p.z })),
        ...textPegsLocal.map(p => ({ x: p.x + textX, z: p.z }))
    ];

    const isExploded = config.viewMode === "exploded";
    const moduleY = isExploded ? config.baseThickness + 40 : config.baseThickness;

    return (
        <group name="Smart_Organizer" rotation={[Math.PI / 2, 0, 0]}>
            <BasePlate color={config.baseColor} depth={config.baseDepth} pegHeight={pegHeight} radius={config.baseRadius} slots={globalSlots} thickness={config.baseThickness} width={config.baseWidth}/>
            <group position={[cupX, moduleY, 0]}>
                <CupModule color={config.cupColor} cupStyle={config.cupStyle} diameter={config.cupDiameter} height={config.cupHeight} pegHeight={pegHeight} pegLocalPositions={cupPegsLocal} wallThick={config.cupWallThick}/>
            </group>
            <group position={[textX, moduleY, 0]}>
                <TextModule config={config} pegHeight={pegHeight} pegLocalPositions={textPegsLocal}/>
            </group>
        </group>
    );
}
