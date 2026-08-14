/**
 * appState.js  Centralized default state for all editors.
 * Import the relevant DEFAULTS object in each editor page to
 * keep initial values consistent and easy to change in one place.
 */

// --- Name Keychain Editor ------------------------------------------------------
export const KEYCHAIN_DEFAULTS = {
    // Content
    text: "Name",
    size: 20,
    depth: 2,
    font: "Titan One",
    baseOffset: 2,
    baseHeight: 3,

    // Colors
    baseColor: "#EC008C",
    textColor: "#ffffff",

    // Keyring
    keyringEnabled: false,
    ringOuter: 10,
    ringInner: 4,
    ringX: 0,
    ringY: 0,
};

// --- Charms Editor -----------------------------------------------------------
export const CHARMS_DEFAULTS = {
    type: "icon", // "icon" or "text"
    iconId: "mdi:heart",
    text: "A",
    font: "Titan One",
    size: 10,
    depth: 1,
    baseOffset: 2,
    baseHeight: 6,
    baseColor: "#EC008C", // Magenta
    charmColor: "#ffffff",
    holeOrientation: "front-to-back", // or "horizontal"
    holeCount: 1,
    holeDiameter: 4.8, // 4mm paracord hole
    holeDistance: 4, // edge-to-edge gap between 2 holes (center-to-center = gap + diameter)
    bubbleMode: false,
    bubbleSize: 2,   // bevel radius in mm when bubble mode is on
};

// --- Keycap Editor -----------------------------------------------------------
export const KEYCAP_DEFAULTS = {
    legends: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    capColor: "#ffffff",
    legendColor: "#3898ff",
    legendSizePct: 60,
    legendDepth: 0.5,
    fontLabel: "Titan One",
    topBorder: false,
    mergeForExport: false,
};

// --- Clicker Generator -------------------------------------------------------
export const CLICKER_DEFAULTS = {
    // ── Import mode ───────────────────────────────────────────────────────────
    importMode: 'image',    // 'image' | 'svg' | 'icon' | 'text'
    iconId: 'lucide:heart',
    textContent: 'KC',
    textFont: 'BebasNeue',  // matches filename in /public/fonts/

    // ── Image processing ──────────────────────────────────────────────────────
    colorCount: 4,          // k-means clusters: 2–12
    smoothing: 0,           // blur radius before k-means (0 = off, 5 = heavy)
    removeBackground: true, // auto-detect / strip background

    // ── Cap geometry ──────────────────────────────────────────────────────────
    baseShape: "custom",    // "square" | "circle" | "custom"
    capSize: 18.0,          // mm — top cap footprint
    capDepth: 3.0,          // mm — cap body thickness
    imageDepth: 1.5,        // mm — default lift height for image color layers

    // ── Corner fillet (square mode) ───────────────────────────────────────────
    filletRadius: 2.0,      // mm

    // ── Edge profiles — cap top & base (simulated via ExtrudeGeometry bevel) ─
    edgeCapTop: 'none',     // 'none' | 'fillet' | 'chamfer'
    edgeCapTopRadius: 0.5,  // mm
    edgeBase: 'none',       // 'none' | 'fillet' | 'chamfer'
    edgeBaseRadius: 0.5,    // mm

    // ── Tolerances ────────────────────────────────────────────────────────────
    switchSocketTol: 0.0,   // mm — delta on 14.2 mm cavity (−0.5 to +1.0)
    switchStemTol: 0.0,     // mm — delta on cruciform arm width (−0.3 to +0.3)

    // ── Keychain hole ─────────────────────────────────────────────────────────
    keychainHole: false,
    keychainHoleDiam: 4.0,     // mm
    keychainPosition: 'right', // 'top' | 'bottom' | 'left' | 'right'
    keychainSlideOffset: 0.0,  // mm offset along the chosen edge

    // ── Multi-switch layout ───────────────────────────────────────────────────
    switchCount: 1,            // 1 | 2 | 3
    switchOffsets: [           // per-switch X / Y offset + rotation (degrees)
        { x: 0, y: 0, rotation: 0 },
        { x: 0, y: 0, rotation: 0 },
        { x: 0, y: 0, rotation: 0 },
    ],

    // ── Viewport ─────────────────────────────────────────────────────────────
    viewMode: 'exploded',   // 'assembled' | 'exploded'
    showMXSwitch: true,

    // ── Filament colours ──────────────────────────────────────────────────────
    shellColor: "#000000",   // BambuLab Black  — shell + stem
    capBaseColor: "#FFFFFF", // BambuLab Jade White — cap substrate
};

// --- Macropad Editor ---------------------------------------------------------
export const MACROPAD_DEFAULTS = {
    rows: 1,
    columns: 4,
    pitchX: 19.05,
    pitchY: 19.05,
    style: 'joined', // 'joined' | 'unified'
    baseShape: 'hexagon', // 'square', 'circle', 'hexagon', 'scalloped'
    margin: 2.5,
    floorThickness: 1.6,
    sidePattern: 'none', // 'none', 'ribbed', 'wavy', 'knurled', 'brick'
    socketToleranceMm: 0,
    keychainHole: true,
    keychainHoleDiam: 5.2,
    keychainSlideOffset: 0,
    shellColor: '#6B7280',
};
