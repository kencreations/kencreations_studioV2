import React, { useMemo } from "react";
import {
    SidebarSection,
    ControlSlider,
    ControlSelect,
    ControlColorPicker,
    ControlToggle,
    editorIcons,
} from "./UI/EditorControls";
import { useFilamentBrands } from "../hooks/useFilamentBrands";
import { useProfile } from "../contexts/ProfileContext";
import { PackageOpen, X, Download } from "lucide-react";

export default function MassProduceSidebar({
    packedInstances,
    activeInstanceId,
    sidebarMode,
    setSidebarMode,
    onUpdateInstance,
    onApplyToAll,
    onClear,
    currentPlateView,
    setCurrentPlateView,
    plateCount,
    onExportPlate,
    onExportAll,
    isExporting
}) {
    const { brands: cloudColors } = useFilamentBrands();
    const { customColors, allFonts } = useProfile();

    const colorOptions = useMemo(() => {
        const merged = [];
        Object.entries(cloudColors || {}).forEach(([brand, brandColors]) => {
            brandColors.forEach((color) => {
                merged.push({
                    label: color.name,
                    value: color.hex,
                    hex: color.hex,
                    group: brand,
                });
            });
        });
        (customColors || []).forEach((color) => {
            merged.push({
                label: color.color_name,
                value: color.hex_code,
                hex: color.hex_code,
                group: color.brand || "Custom",
            });
        });
        return merged;
    }, [cloudColors, customColors]);

    const fontOptions = useMemo(
        () => allFonts.map((font) => ({ label: font.label, value: font.id })),
        [allFonts]
    );

    const activeInstance = packedInstances.find((i) => i.id === activeInstanceId);
    
    // Fallback object to render sliders when nothing is selected
    const displayConfig = sidebarMode === "editSelected" && activeInstance 
        ? activeInstance 
        : packedInstances[0] || {}; // Fallback to first item for "apply to all" defaults

    const handleUpdate = (key, value) => {
        if (sidebarMode === "editSelected") {
            if (activeInstanceId) {
                onUpdateInstance(activeInstanceId, { [key]: value });
            }
        } else {
            onApplyToAll({ [key]: value });
        }
    };

    return (
        <div className="flex h-full flex-col gap-4 text-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between rounded-xl bg-secondary/10 p-3">
                <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                    <PackageOpen size={18} />
                    Mass Produce
                </div>
                <button
                    onClick={onClear}
                    className="p-1.5 hover:bg-secondary/20 rounded-lg text-secondary transition-colors"
                    title="Exit Mass Produce"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Pagination & Export */}
            <SidebarSection title="Plates & Export">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2">
                        <button
                            onClick={() => setCurrentPlateView(Math.max(0, currentPlateView - 1))}
                            disabled={currentPlateView === 0}
                            className="px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
                        >
                            &lt; Back
                        </button>
                        <span className="text-xs font-bold text-gray-700">
                            Plate {currentPlateView + 1} of {plateCount}
                        </span>
                        <button
                            onClick={() => setCurrentPlateView(Math.min(plateCount - 1, currentPlateView + 1))}
                            disabled={currentPlateView === plateCount - 1}
                            className="px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
                        >
                            Next &gt;
                        </button>
                    </div>
                    
                    <button
                        onClick={() => onExportPlate(currentPlateView + 1)}
                        disabled={isExporting}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary hover:bg-secondary/90 px-3 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50"
                    >
                        <Download size={14} />
                        {isExporting ? "Exporting..." : "Export Current Plate (3MF)"}
                    </button>
                    <button
                        onClick={onExportAll}
                        disabled={isExporting || plateCount <= 1}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-secondary/30 bg-white hover:bg-secondary/5 px-3 py-2 text-xs font-bold text-secondary transition-colors disabled:opacity-50"
                    >
                        <PackageOpen size={14} />
                        {isExporting ? "Exporting..." : "Batch Export All Plates (3MF)"}
                    </button>
                </div>
            </SidebarSection>

            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                    onClick={() => setSidebarMode("editSelected")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                        sidebarMode === "editSelected"
                            ? "bg-white text-secondary shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Edit Selected
                </button>
                <button
                    onClick={() => setSidebarMode("applyToAll")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                        sidebarMode === "applyToAll"
                            ? "bg-white text-secondary shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Apply to All
                </button>
            </div>

            {/* Editing Controls */}
            <div className={`transition-opacity ${sidebarMode === "editSelected" && !activeInstance ? "opacity-40 pointer-events-none" : ""}`}>
                {sidebarMode === "editSelected" && !activeInstance && (
                    <div className="text-[10px] font-bold text-center text-gray-400 mb-2 uppercase tracking-wide">
                        Click an item on the plate to edit
                    </div>
                )}
                
                {sidebarMode === "editSelected" && activeInstance && (
                    <div className="mb-4 text-center rounded-lg bg-primary/10 border border-primary/20 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-0.5">Editing</span>
                        <span className="text-sm font-black text-gray-800">{activeInstance.text}</span>
                    </div>
                )}
                
                <SidebarSection title={sidebarMode === "applyToAll" ? "Global Text Settings" : "Text Settings"} icon={editorIcons.text}>
                    <div className="space-y-3">
                        <ControlSelect
                            label="Font"
                            value={displayConfig.font || ""}
                            onChange={(value) => handleUpdate("font", value)}
                            options={fontOptions}
                            prefixType="font"
                        />
                        <ControlColorPicker
                            label="Text Color"
                            value={displayConfig.textColor || "#ffffff"}
                            onChange={(value) => handleUpdate("textColor", value)}
                            options={colorOptions}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider
                                label="Size"
                                value={displayConfig.size || 20}
                                min={6}
                                max={32}
                                step={1}
                                unit="mm"
                                onChange={(value) => handleUpdate("size", value)}
                            />
                            <ControlSlider
                                label="Depth"
                                value={displayConfig.depth || 2}
                                min={1}
                                max={10}
                                step={0.1}
                                unit="mm"
                                onChange={(value) => handleUpdate("depth", value)}
                            />
                        </div>
                    </div>
                </SidebarSection>

                <SidebarSection title={sidebarMode === "applyToAll" ? "Global Base Settings" : "Base Settings"} icon={editorIcons.layers}>
                    <ControlSlider
                        label="Base Thickness"
                        value={displayConfig.baseThickness || 3}
                        min={0.5}
                        max={8}
                        step={0.1}
                        unit="mm"
                        onChange={(value) => handleUpdate("baseThickness", value)}
                    />
                    <ControlSlider
                        label="Base Outline"
                        value={displayConfig.basePadding || 4}
                        min={1}
                        max={10}
                        step={0.1}
                        unit="mm"
                        onChange={(value) => handleUpdate("basePadding", value)}
                    />
                    <ControlColorPicker
                        label="Base Color"
                        value={displayConfig.baseColor || "#EC008C"}
                        onChange={(value) => handleUpdate("baseColor", value)}
                        options={colorOptions}
                    />
                </SidebarSection>

                <SidebarSection title={sidebarMode === "applyToAll" ? "Global Keyring" : "Keyring"} icon={editorIcons.ring}>
                    <ControlToggle
                        label="Enable Keyring"
                        checked={displayConfig.keyringEnabled ?? true}
                        onChange={(value) => handleUpdate("keyringEnabled", value)}
                    />
                    <ControlSlider
                        label="Ring Diameter"
                        value={displayConfig.keyringDiameter || 10}
                        min={5}
                        max={15}
                        step={0.5}
                        unit="mm"
                        onChange={(value) => handleUpdate("keyringDiameter", value)}
                    />
                    <ControlSlider
                        label="Hole Size"
                        value={displayConfig.keyringHole || 4}
                        min={2}
                        max={8}
                        step={0.5}
                        unit="mm"
                        onChange={(value) => handleUpdate("keyringHole", value)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <ControlSlider
                            label="X Pos"
                            value={displayConfig.keyringX || 0}
                            min={-20}
                            max={20}
                            step={0.5}
                            unit="mm"
                            onChange={(value) => handleUpdate("keyringX", value)}
                        />
                        <ControlSlider
                            label="Y Pos"
                            value={displayConfig.keyringY || 0}
                            min={-20}
                            max={20}
                            step={0.5}
                            unit="mm"
                            onChange={(value) => handleUpdate("keyringY", value)}
                        />
                    </div>
                </SidebarSection>
            </div>
        </div>
    );
}
