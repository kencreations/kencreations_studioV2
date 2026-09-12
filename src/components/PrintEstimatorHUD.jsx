import React, { useMemo, useRef, useState } from "react";
import {
    ControlSlider,
    ControlSelect,
    ControlToggle,
} from "./UI/EditorControls";

export default function PrintEstimatorHUD({ dims }) {
    const [isOpen, setIsOpen] = useState(false);
    const [slicerSettings, setSlicerSettings] = useState({
        layer_height: 0.2,
        outer_wall_speed: 80,
        sparse_infill_density: 8,
        sparse_infill_pattern: "gyroid",
        bottom_shell_layers: 3,
        enable_support: true,
        wall_generator: "arachne",
        seam_position: "back",
    });

    const fileInputRef = useRef(null);

    const updateSetting = (key, value) => {
        setSlicerSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                const parseNumber = (val, fallback) => {
                    if (!val) return fallback;
                    const parsed = parseFloat(
                        Array.isArray(val) ? val[0] : val,
                    );
                    return isNaN(parsed) ? fallback : parsed;
                };

                const parseBoolean = (val, fallback) => {
                    if (val === undefined) return fallback;
                    return val === "1" || val === true;
                };

                setSlicerSettings((prev) => ({
                    ...prev,
                    layer_height: parseNumber(
                        data.layer_height,
                        prev.layer_height,
                    ),
                    outer_wall_speed: parseNumber(
                        data.outer_wall_speed,
                        prev.outer_wall_speed,
                    ),
                    sparse_infill_density: parseNumber(
                        data.sparse_infill_density,
                        prev.sparse_infill_density,
                    ),
                    sparse_infill_pattern:
                        data.sparse_infill_pattern ||
                        prev.sparse_infill_pattern,
                    bottom_shell_layers: parseNumber(
                        data.bottom_shell_layers,
                        prev.bottom_shell_layers,
                    ),
                    enable_support: parseBoolean(
                        data.enable_support,
                        prev.enable_support,
                    ),
                    wall_generator: data.wall_generator || prev.wall_generator,
                    seam_position: data.seam_position || prev.seam_position,
                }));

                alert(
                    `Successfully imported preset: ${data.name || "Custom Profile"}`,
                );
            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Invalid slicer JSON file.");
            }

            event.target.value = null;
        };
        reader.readAsText(file);
    };

    const { weight, time } = useMemo(() => {
        if (!dims || !dims.x || !dims.y || !dims.z)
            return { weight: 0, time: 0 };

        // 1. Calculate Weight
        const volume_cm3 = (dims.x * dims.y * dims.z) / 1000;

        // Bumped base multiplier to 0.22 for tighter accuracy
        const baseSolidMultiplier =
            0.22 + slicerSettings.bottom_shell_layers * 0.05;
        const supportPenalty = slicerSettings.enable_support ? 1.15 : 1.0;

        const estimatedWeightGrams =
            volume_cm3 *
            1.24 *
            (baseSolidMultiplier + slicerSettings.sparse_infill_density / 100) *
            supportPenalty;

        // 2. Calculate Time
        const actualVolumeMm3 = (estimatedWeightGrams / 1.24) * 1000;
        const lineCrossSectionArea = 0.42 * slicerSettings.layer_height;
        const totalExtrusionDistanceMm = actualVolumeMm3 / lineCrossSectionArea;

        // Increased average speed factor to 0.65 to drop the time slightly
        const averageSpeedMmS = slicerSettings.outer_wall_speed * 0.65;
        let timeMinutes = totalExtrusionDistanceMm / averageSpeedMmS / 60;

        timeMinutes += 6;
        timeMinutes += 2;

        return {
            weight: estimatedWeightGrams.toFixed(1),
            time: Math.round(timeMinutes),
        };
    }, [dims, slicerSettings]);

    return (
        <div className="relative flex flex-col items-end gap-2">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#00A3A3] shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
            >
                <span className="flex items-center gap-2">
                    <span>⏱️</span>
                    <span>{Math.max(1, time)}m</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-2">
                    <span>🧵</span>
                    <span>{weight}g</span>
                </span>
                <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3.5 w-3.5 transition-transform ${
                        isOpen ? "rotate-180" : "rotate-0"
                    }`}
                >
                    <path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" />
                </svg>
            </button>

            {isOpen && (
                <div className="mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl">
                    <div className="max-h-96 overflow-y-auto space-y-4 px-3 py-4">
                        <div className="mb-4 border-b border-slate-100 pb-3">
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-500/30 bg-teal-50/50 px-3 py-2 text-[11px] font-bold text-teal-700 shadow-sm transition-colors hover:border-teal-500 hover:bg-teal-50"
                            >
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                    />
                                </svg>
                                Import Bambu Preset
                            </button>
                        </div>

                        <div className="space-y-2">
                            <h4 className="border-b border-slate-100 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Quality
                            </h4>
                            <ControlSlider
                                label="Layer"
                                value={slicerSettings.layer_height}
                                min={0.08}
                                max={0.4}
                                step={0.02}
                                unit="mm"
                                onChange={(value) =>
                                    updateSetting("layer_height", value)
                                }
                            />
                            <ControlSlider
                                label="Bottom Layers"
                                value={slicerSettings.bottom_shell_layers}
                                min={1}
                                max={8}
                                step={1}
                                unit="ly"
                                onChange={(value) =>
                                    updateSetting("bottom_shell_layers", value)
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <h4 className="border-b border-slate-100 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Strength
                            </h4>
                            <ControlSlider
                                label="Infill"
                                value={slicerSettings.sparse_infill_density}
                                min={5}
                                max={100}
                                step={1}
                                unit="%"
                                onChange={(value) =>
                                    updateSetting(
                                        "sparse_infill_density",
                                        value,
                                    )
                                }
                            />
                            <ControlSelect
                                label="Pattern"
                                value={slicerSettings.sparse_infill_pattern}
                                onChange={(value) =>
                                    updateSetting(
                                        "sparse_infill_pattern",
                                        value,
                                    )
                                }
                                options={[
                                    { label: "Gyroid", value: "gyroid" },
                                    {
                                        label: "3D Honeycomb",
                                        value: "3dhoneycomb",
                                    },
                                    { label: "Grid", value: "grid" },
                                    {
                                        label: "Rectilinear",
                                        value: "rectilinear",
                                    },
                                ]}
                                prefixType="font"
                            />
                        </div>

                        <div className="space-y-2">
                            <h4 className="border-b border-slate-100 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Speed
                            </h4>
                            <ControlSlider
                                label="Outer Wall"
                                value={slicerSettings.outer_wall_speed}
                                min={20}
                                max={200}
                                step={5}
                                unit="mm/s"
                                onChange={(value) =>
                                    updateSetting("outer_wall_speed", value)
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <h4 className="border-b border-slate-100 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Advanced
                            </h4>
                            <ControlToggle
                                label="Support"
                                checked={slicerSettings.enable_support}
                                onChange={(value) =>
                                    updateSetting("enable_support", value)
                                }
                            />
                            <ControlSelect
                                label="Wall Gen"
                                value={slicerSettings.wall_generator}
                                onChange={(value) =>
                                    updateSetting("wall_generator", value)
                                }
                                options={[
                                    { label: "Arachne", value: "arachne" },
                                    { label: "Classic", value: "classic" },
                                ]}
                                prefixType="font"
                            />
                            <ControlSelect
                                label="Seam"
                                value={slicerSettings.seam_position}
                                onChange={(value) =>
                                    updateSetting("seam_position", value)
                                }
                                options={[
                                    { label: "Back", value: "back" },
                                    { label: "Aligned", value: "aligned" },
                                    { label: "Random", value: "random" },
                                ]}
                                prefixType="font"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
