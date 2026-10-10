import React, { useState, useCallback } from "react";
import SmartText3D from "./Shared/SmartText3D";
import SmartCSGBase from "./Shared/SmartCSGBase";

/**
 * LetterCharmInstance — A single letter bead for the Letter Charms Editor.
 *
 * Composes SmartText3D → SmartCSGBase via a unidirectional callback chain:
 *   1. SmartText3D generates 2D shapes → fires onShapesReady
 *   2. Parent stores shapes → passes to SmartCSGBase
 *   3. SmartCSGBase builds contour base, punches holes via CSG worker,
 *      centers it → fires onGeometryReady
 *   4. Parent stores centerOffset → passes to SmartText3D
 *   5. SmartText3D repositions mesh
 */
const LetterCharmInstance = React.memo(({ charm }) => {
    const [textShapes, setTextShapes] = useState([]);
    const [centerOffset, setCenterOffset] = useState({ cx: 0, cy: 0 });

    const handleShapesReady = useCallback((shapes) => {
        setTextShapes(shapes);
    }, []);

    const handleBaseReady = useCallback((geo, bb, offset) => {
        setCenterOffset(offset || { cx: 0, cy: 0 });
    }, []);

    // Counteract EditorCanvas +2.5 Y offset and plate at -0.5
    const layoutZ = Number(charm.baseHeight || 6) - 3.0;

    return (
        <group position={[charm.layoutX, charm.layoutY, layoutZ]}>
            {/* ── 1. Text mesh (fires shapes upstream) ── */}
                <SmartText3D
                    text={charm.text || "A"}
                    fontId={charm.font}
                    size={Number(charm.size || 10)}
                    depth={Number(charm.depth || 1)}
                    bubbleMode={charm.bubbleMode}
                    bubbleSize={Number(charm.bubbleSize ?? 2)}
                    offsetZ={0}
                    color={charm.charmColor || "#ffffff"}
                    centerOffset={centerOffset}
                    onShapesReady={handleShapesReady}
                />

            {/* ── 2. CSG Base plate (consumes shapes, drills holes, reports centering) ── */}
            <SmartCSGBase
                textShapes={textShapes}
                thickness={Number(charm.baseHeight || 6)}
                padding={Number(charm.baseOffset || 2)}
                color={charm.baseColor || "#00A3A3"}
                holeCount={Number(charm.holeCount || 1)}
                holeDiameter={Number(charm.holeDiameter || 4.8)}
                holeOrientation={charm.holeOrientation || "horizontal"}
                holeDistance={Number(charm.holeDistance || 4)}
                onGeometryReady={handleBaseReady}
            />
        </group>
    );
});

LetterCharmInstance.displayName = "LetterCharmInstance";
export default LetterCharmInstance;
