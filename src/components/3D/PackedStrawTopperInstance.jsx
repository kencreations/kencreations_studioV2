import React, { useState, useCallback } from "react";
import SmartText3D from "./Shared/SmartText3D";
import SmartCSGBase from "./Shared/SmartCSGBase";

const PackedStrawTopperInstance = React.memo(
    ({
        instance,
        isActive,
        onClick,
        threeX,
        threeY,
        visible = true,
    }) => {
        const [textShapes, setTextShapes] = useState([]);
        const [centerOffset, setCenterOffset] = useState({ cx: 0, cy: 0 });

        const handleShapesReady = useCallback((shapes) => {
            setTextShapes(shapes);
        }, []);

        const handleBaseReady = useCallback((geo, bb, offset) => {
            setCenterOffset(offset || { cx: 0, cy: 0 });
        }, []);

        if (!visible) return null;

        // Ensure the base sits on Z=0
        const layoutZ = Number(instance.baseHeight || 6) - 3.0;

        return (
            <group 
                position={[threeX, threeY, layoutZ]}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onClick) onClick(instance.id);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    document.body.style.cursor = "pointer";
                }}
                onPointerOut={(e) => {
                    document.body.style.cursor = "default";
                }}
            >
                <SmartText3D
                    text={instance.text || "Name"}
                    fontId={instance.font}
                    size={Number(instance.size || 20)}
                    depth={Number(instance.depth || 2)}
                    color={isActive ? "#FFD700" : (instance.textColor || "#ffffff")}
                    centerOffset={centerOffset}
                    onShapesReady={handleShapesReady}
                />

                <SmartCSGBase
                    textShapes={textShapes}
                    thickness={Number(instance.baseHeight || 6)}
                    padding={Number(instance.baseOffset || 4)}
                    color={isActive ? "#FFA500" : (instance.baseColor || "#EC008C")}
                    holeCount={1}
                    holeDiameter={Number(instance.holeDiameter || 8)}
                    holeOrientation="vertical"
                    holeDistance={0}
                    holeZOffset={Number(instance.holeZOffset || 0)}
                    onGeometryReady={handleBaseReady}
                />
            </group>
        );
    }
);

PackedStrawTopperInstance.displayName = "PackedStrawTopperInstance";
export default PackedStrawTopperInstance;
