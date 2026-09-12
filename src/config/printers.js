/**
 * printers.js — 3D Printer bed presets for Mass Produce packing.
 *
 * Each preset defines the physical build plate dimensions and any
 * exclusion zones (e.g. the Bambu wiper area) that the packing
 * algorithm must avoid.
 *
 * All dimensions are in millimeters.
 */

export const PRINTER_PRESETS = [
    {
        id: "bambu_a1",
        brand: "Bambu Lab",
        name: "Bambu Lab A1 / P1 / X1",
        label: "Bambu A1 / P1 / X1",
        width: 256,
        depth: 256,
        usableWidth: 250,
        usableDepth: 250,
        exclusionZones: [
            { x: 0, y: 236, width: 20, depth: 20 },
        ],
        uiThumbnail: "/images/printers/Bambu Lab A1_cover.png",
        modelPath: "/models/printers/bbl-3dp-X1.stl",
        decals: [
            "/textures/printers/bbl_bed_pei_middle.svg",
            "/textures/printers/bbl_bed_pei_bottom.svg",
            "/textures/printers/bbl_bed_pei_left.svg"
        ]
    },
    {
        id: "bambu_a1_mini",
        brand: "Bambu Lab",
        name: "Bambu Lab A1 Mini",
        label: "Bambu Lab A1 Mini",
        width: 180,
        depth: 180,
        usableWidth: 175,
        usableDepth: 175,
        exclusionZones: [],
        uiThumbnail: "/images/printers/Bambu Lab A1 mini_cover.png",
        modelPath: "/models/printers/bbl-3dp-A1M.stl",
        decals: [
            "/textures/printers/bbl_bed_pei_middle.svg",
            "/textures/printers/bbl_bed_pei_bottom.svg",
            "/textures/printers/bbl_bed_pei_left.svg"
        ]
    },
    {
        id: "generic-220",
        brand: "Generic",
        name: "Generic 220×220",
        label: "Generic 220×220",
        width: 220,
        depth: 220,
        usableWidth: 215,
        usableDepth: 215,
        exclusionZones: [],
        uiThumbnail: "",
        modelPath: null, // use fallback grid
        decals: []
    },
];

export const DEFAULT_PRINTER = PRINTER_PRESETS[0];

/**
 * Returns a printer preset by ID, falling back to the first preset.
 * @param {string} id
 * @returns {typeof PRINTER_PRESETS[0]}
 */
export function getPresetById(id) {
    return PRINTER_PRESETS.find((p) => p.id === id) || PRINTER_PRESETS[0];
}
