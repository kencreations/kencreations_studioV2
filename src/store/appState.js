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
    keyringEnabled: true,
    ringOuter: 10,
    ringInner: 4,
    ringX: 0,
    ringY: 0,
};

// --- Charms Editor -----------------------------------------------------------
export const CHARMS_DEFAULTS = {
    iconId: "mdi:heart",
    size: 10,
    depth: 1,
    baseOffset: 2,
    baseHeight: 6,
    baseColor: "#EC008C", // Magenta
    charmColor: "#ffffff", // Pink
    holeOrientation: "front-to-back", // or "horizontal"
    holeCount: 1,
    holeDiameter: 4.8, // 4mm paracord hole
    holeDistance: 4, // edge-to-edge gap between 2 holes (center-to-center = gap + diameter)
    bubbleMode: false,
    bubbleSize: 2, // bevel radius in mm when bubble mode is on
};

// --- Letter Beads Editor -----------------------
// src/store/appState.js
export const LETTER_BEADS_DEFAULTS = {
    text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    font: "Titan One",
    size: 10,
    depth: 1,
    baseOffset: 1,
    baseHeight: 6,
    baseColor: "#00B1B7", // BambuLab Turquoise
    charmColor: "#ffffff", // Fix 1: Matches "Jade White"
    textColor: "#ffffff",
    holeOrientation: "horizontal",
    holeCount: 1,
    holeDiameter: 4.8,
    holeDistance: 10,
    bubbleMode: false,
    bubbleSize: 2,
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
    importMode: "image", // 'image' | 'svg' | 'icon' | 'text'
    iconId: "lucide:heart",
    textContent: "KC",
    textFont: "BebasNeue", // matches filename in /src/assets/fonts/

    // ── Image processing ──────────────────────────────────────────────────────
    colorCount: 4, // k-means clusters: 2–12
    smoothing: 0, // blur radius before k-means (0 = off, 5 = heavy)
    removeBackground: true, // auto-detect / strip background

    // ── Cap geometry ──────────────────────────────────────────────────────────
    baseShape: "outline", // "square" | "circle" | "outline" | "rect" | "hexagon" | "heart" | "star" | "egg"
    capSize: 35.0, // mm — top cap footprint
    capDepth: 3.0, // mm — cap body thickness
    imageDepth: 1.5, // mm — default lift height for image color layers

    // ── Corner fillet (square mode) ───────────────────────────────────────────
    filletRadius: 2.0, // mm

    // ── Edge profiles — cap top & base (simulated via ExtrudeGeometry bevel) ─
    edgeCapTop: "none", // 'none' | 'fillet' | 'chamfer'
    edgeCapTopRadius: 0.5, // mm
    edgeBase: "none", // 'none' | 'fillet' | 'chamfer'
    edgeBaseRadius: 0.5, // mm

    // ── Tolerances ────────────────────────────────────────────────────────────
    switchSocketTol: 0.0, // mm — delta on 14.2 mm cavity (−0.5 to +1.0)
    switchStemTol: 0.0, // mm — delta on cruciform arm width (−0.3 to +0.3)

    // ── Keychain hole ─────────────────────────────────────────────────────────
    keychainHole: false,
    keychainHoleDiam: 4.0, // mm
    keychainPosition: "right", // 'top' | 'bottom' | 'left' | 'right'
    keychainSlideOffset: 0.0, // mm offset along the chosen edge

    // ── Multi-switch layout ───────────────────────────────────────────────────
    switchCount: 1, // 1 | 2 | 3
    switchOffsets: [
        // per-switch X / Y offset + rotation (degrees)
        { x: 0, y: 0, rotation: 0 },
        { x: 0, y: 0, rotation: 0 },
        { x: 0, y: 0, rotation: 0 },
    ],

    // ── Viewport ─────────────────────────────────────────────────────────────
    viewMode: "exploded", // 'assembled' | 'exploded'
    showMXSwitch: true,

    // ── Filament colours ──────────────────────────────────────────────────────
    shellColor: "#000000", // BambuLab Black  — shell + stem
    capBaseColor: "#FFFFFF", // BambuLab Jade White — cap substrate
};

// --- Pencil Sleeve Editor ----------------------------------------------------
export const PENCIL_SLEEVE_DEFAULTS = {
    text: "Name",
    font: "Coiny", // or any default
    size: 15,
    depth: 1.0, // Text thickness
    baseHeight: 9.8, // Base thickness
    baseOffset: 2.0, // Outline width
    holeDiameter: 7.8, // Pencil hole size
    holeYOffset: 0.0, // Hole up/down offset
    baseColor: "#00B1B7", // BambuLab Turquoise
    textColor: "#ffffff",
};

// --- Straw Topper Editor ----------------------------------------------------
export const STRAW_TOPPER_DEFAULTS = {
    text: "Name",
    font: "Coiny",
    size: 15,
    depth: 1.0,
    baseHeight: 9.8, // Thinner base for straw toppers
    baseOffset: 2.0,
    holeOrientation: "vertical",
    holeDiameter: 6.0, // Standard tumbler straw size
    holeZOffset: 0.0,
    baseColor: "#00B1B7",
    textColor: "#ffffff",
};

// --- Leather Slider Editor ---------------------------------------------------
export const LEATHER_SLIDER_DEFAULTS = {
    ...LETTER_BEADS_DEFAULTS,
    depth: 3,
    strapWidth: 8,
    strapThickness: 2,
    holeShape: "box",
    enableBase: false,
    holeZOffset: 1.5,
    holeYOffset: 0,
};

// --- Macropad Editor ---------------------------------------------------------
export const MACROPAD_DEFAULTS = {
    rows: 1,
    columns: 4,
    pitchX: 19.05,
    pitchY: 19.05,
    style: "joined", // 'joined' | 'unified'
    baseShape: "hexagon", // 'square', 'circle', 'hexagon', 'scalloped'
    margin: 2.5,
    floorThickness: 1.6,
    sidePattern: "none", // 'none', 'ribbed', 'wavy', 'knurled', 'brick'
    socketToleranceMm: 0,
    keychainHole: true,
    keychainHoleDiam: 5.2,
    keychainSlideOffset: 0,
    shellColor: "#6B7280",
};

// --- Lithophane Keychain Editor -----------------------------------------------
export const LITHOPHANE_DEFAULTS = {
    // Image source
    imageUrl: null,
    cropShape: "rectangle", // rectangle | circle | heart | hexagon | alpha

    // Thickness mapping (mm)
    minThick: 0.8,
    maxThick: 3.2,

    // Resolution grid (longest axis pixel count)
    resolution: "mid", // low (64) | mid (128) | high (256)

    // Layer quantization — snaps Z to nearest multiple for clean slicer layers
    quantizeLayerHeight: 0.08, // mm — matches Bambu Lab 0.08mm layer height
    // Physical output size
    physicalWidth: 50, // mm

    // Frame
    frameWidth: 2.5, // mm — border thickness
    frameDepth: 3.2, // mm
    frameProfile: "flat", // flat | fillet | chamfer
    frameColor: "#EC008C",

    // Keyring
    keyringEnabled: true,
    keyringStyle: "tab", // inset | tab
    keyringThickness: 3.2, // mm — decoupled from frameDepth
    keyringDiameter: 10, // mm — outer boss
    keyringHole: 4, // mm — inner hole
    keyringPosition: "top", // top | bottom | left | right
    keyringReinforced: true, // adds ~1.5mm thickened donut around the hole
    keyringOffset: 50, // 0-100% sliding offset

    // Border text
    borderText: "",
    borderTextSide: "bottom", // top | bottom | left | right
    borderTextFont: "Titan One",
    borderTextSize: 5, // mm
    borderTextDepth: 0.6, // mm
    borderTextColor: "#ffffff",
    borderTextMode: "emboss", // emboss | deboss
};

// --- Modular Desk Organizer Editor ------------------------------------------
export const ORGANIZER_DEFAULTS = {
    // ── Base Plate ────────────────────────────────────────────────────────────
    baseWidth: 170, // mm — total base plate width
    baseDepth: 70, // mm — total base plate depth (front-to-back)
    baseThickness: 4, // mm — base plate slab height
    baseRadius: 5, // mm — corner fillet radius (updated from 4 to 5)
    baseColor: "#00B1B7", // BambuLab Turquoise

    // ── Organizer Cup ─────────────────────────────────────────────────────────
    cupDiameter: 60, // mm — outer cup cylinder diameter
    cupHeight: 60, // mm — cup height above the base
    cupWallThick: 2, // mm — shell wall thickness
    cupStyle: "Plain", // 'Plain' | 'Hexagon' | 'Octagon' | 'Low-Poly (12-Sided)'
    cupColor: "#FF9016", // BambuLab Orange

    // ── Text Block ────────────────────────────────────────────────────────────
    line1Text: "Mrs.",
    line1Font: "Pacifico",
    line1Size: 18, // mm
    line1OffsetX: 0, // mm — horizontal offset of Line 1 relative to Line 2
    lineSpacing: 0, // mm — extra vertical spacing between Line 1 and Line 2
    textAlign: "center", // 'left' | 'center' | 'right' — Line 1 alignment relative to Line 2
    line2Text: "CAMSON",
    line2Font: "BebasNeue",
    line2Size: 24, // mm
    textDepth: 1, // mm — foreground extrusion depth
    backingDepth: 10, // mm — backing plate depth
    textPosX: 35, // mm — text module X offset on the base
    textBackingPad: 1, // mm — bevelSize contour padding around text
    textColor: "#ffffff", // Jade White
    backingColor: "#EC008C", // BambuLab Magenta

    // ── Hardware / Tolerances ─────────────────────────────────────────────────
    // Male peg radius  = 3.8 mm  (hardcoded in CupModule / TextModule)
    // Female slot radius = 4.0 mm (hardcoded in BasePlate)
    // pegHeight = baseThickness - 1 (computed)
    tolerance: 0.2, // mm — delta between male and female radii

    // ── Viewport ──────────────────────────────────────────────────────────────
    viewMode: "assembled", // 'assembled' | 'exploded'
};

// --- PopSocket / PopGrip Generator -------------------------------------------
export const POPSOCKET_DEFAULTS = {
    // ── Text ──────────────────────────────────────────────────────────────────
    text: "MY NAME",
    fontId: "Coiny",
    fontSize: 8,          // mm — auto-shrinks to fit plate if autoFit is true
    textDepth: 1.5,        // mm — extrusion height
    letterSpacing: 0,      // mm — extra gap between letters
    textMode: "raised",    // "raised" | "engraved"
    stylePreset: "chunky-rounded", // "chunky-rounded" | "groovy-vertical" | "organic-circular"
    
    // ── Advanced Text Shaping ─────────────────────────────────────────────────
    layoutMode: "auto",    // "auto" | "1-line" | "2-lines"
    blobIntensity: 2.0,    // 0 to 5 — bounded outline shaping intensity
    roundness: 1.0,        // 0 to 3 — how much to smooth corners (bevel segments & size)
    compactness: 1.0,      // 0 to 2 — how tight the circular arrangement is
    autoFit: true,         // automatically resize to fit within the cap radius
    edgeMargin: 2.0,       // mm — safety margin from the edge
    fillIntensity: 90,     // % — radial extent of the usable circle (not ink coverage)

    // ── Colors ────────────────────────────────────────────────────────────────
    baseColor: "#E63946",  // The red attachment piece
    textColor: "#F1FAEE",  // Text color

    // ── Geometry ──────────────────────────────────────────────────────────────
    topRadius: 19.5,       // mm - radius of the circular top plate (~39mm dia)
    topThickness: 2.0,     // mm - thickness of the top plate
};

// --- Screw Top Container Generator -------------------------------------------
export const SCREW_CONTAINER_DEFAULTS = {
    // What to Print
    printMode: "full",            // 'full' | 'lid' | 'body' | 'fitTest'

    // Style
    containerStyle: "classic",    // 'classic' | 'knurled'
    lidStyle: "plain",            // 'plain' | 'personalized'

    // Preset / Size
    preset: "katinko",            // 'katinko' | 'small' | 'medium' | 'large' | 'custom'

    // Dimensions
    innerDiameter: 50,            // mm - inner cavity diameter
    innerHeight: 12.5,            // mm - inner cavity height
    wallThickness: 2,             // mm - wall thickness
    bottomThickness: 1.2,         // mm - bottom floor thickness
    lidTopThickness: 1.2,         // mm - solid cap thickness
    lidHeight: 10,                // mm - total lid height
    threadHeight: 10,             // mm - threaded portion height
    clearance: 0.25,              // mm - print tolerance / thread clearance
    lipDepth: 2.5,                // mm - thread engagement / lip overlap

    // Colors
    bodyColor: "#14B8A6",         // Studio teal
    lidColor: "#647D94",          // Slate blue
    textColor: "#FFFFFF",         // Crisp white

    // Personalization
    personalized: false,
    personText: "MY NAME",
    personFont: "BebasNeue",
    personStyle: "embossed",      // 'embossed' | 'engraved'
    personDepth: 0.8,             // mm - text relief depth
    personSize: 8,                // mm - text height
    personAutoFit: true,          // auto-scale text to fit lid safe area

    // Viewport
    viewMode: "assembled",        // 'assembled' | 'exploded'
    addKeychainHole: false,
    keychainHoleDiameter: 4.2,    // mm - clean through-hole diameter
    keychainWallThickness: 3.2,   // mm - solid wall around hole
    keychainLugLength: 4.0,       // mm - extension from flange

    // Base / Push-out Hole
    pushOutHoleEnabled: false,    // default OFF: solid base
    pushOutHoleDiameterMm: 12,    // mm - push-out hole diameter
};

