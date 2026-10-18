import { evaluateGeneratorAccess } from "../utils/licensePolicy.js";
/**
 * editors.js — Generator registry.
 *
 * Each entry defines a generator available in the desktop app.
 *
 * Fields:
 *   id                  — unique stable identifier (used in Firestore entitlements arrays)
 *   title               — display name
 *   description         — card description
 *   status              — "Stable" | "Beta" | "Alpha"
 *   icon                — emoji icon for the card
 *   link                — React Router path
 *   isExclusive         — if true, this generator requires a license entitlement to access
 *   requiredEntitlement — the entitlement ID that must appear in the license's entitlements[]
 *                         array. Ignored if isExclusive = false.
 *   isFree              — legacy flag; kept for backward compatibility
 */

export const editors = [
    {
        id: "katinko-inhaler-pod",
        title: "Katinko Inhaler Pod",
        description: "Provisional three-part inhaler capsule. Dimensions and physical fit are unverified; pickup disabled.",
        status: "Coming Soon",
        icon: "💊",
        link: "/editor/katinko-inhaler-pod",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "monograminsert",
        title: "Monogram Insert",
        description: "Custom monogram inserts.",
        link: "/editor/monograminsert",
        category: "basic",
        isFree: true,
        isExclusive: false,
    },
    {
        id: "monogram-stand",
        title: "Monogram Stand",
        description: "Custom monogram stands.",
        link: "/editor/monogram-stand",
        category: "basic",
        isFree: true,
        isExclusive: false,
    },
    {
        id: "whistle-bagtag",
        title: "Whistle Bagtag",
        description: "Customizable 3D printed whistle with a lanyard hole.",
        status: "Beta",
        icon: "哨",
        link: "/editor/whistlebagtag",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "client-icon-tag",
        title: "Icon Tag Generator",
        description: "Exclusive generator for client custom icon tags.",
        status: "Beta",
        icon: "🏷️",
        link: "/editor/client-icon-tag",
        category: "exclusive",
        isExclusive: true,
        isVipEligible: true,
        requiredEntitlement: "client-tag",
        isFree: false,
        purchasePricePHP: null, // Requires administrator pricing configuration
    },
    {
        id: "namekeychain",
        title: "Name Keychain",
        description:
            "Standalone Name Keychain Editor with 3D Preview and Export Options.",
        status: "Stable",
        icon: "🆔",
        link: "/editor/namekeychain",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "charms",
        title: "Chunky Charms",
        description: "Design custom 3D icon charms with paracord holes.",
        status: "Stable",
        icon: "✨",
        link: "/editor/charms",
        category: "exclusive",
        isExclusive: true,
        isVipEligible: true,
        requiredEntitlement: "charms",
        isFree: false,
        purchasePricePHP: null, // Requires administrator pricing configuration
    },
    {
        id: "letter-beads",
        title: "Letter Beads",
        description: "Create custom 3D text and letter beads.",
        status: "Stable",
        icon: "🔤",
        link: "/editor/letter-beads",
        category: "premium",
        isExclusive: false,
        requiredEntitlement: "letter-beads",
        isFree: false,
    },
    {
        id: "keycap-maker",
        title: "Keycap Maker",
        description:
            "Create custom 3D printable mechanical keyboard keycap sets.",
        status: "Beta",
        icon: "⌨️",
        link: "/editor/keycap-maker",
        category: "premium",
        isExclusive: false,
        requiredEntitlement: "keycap-maker",
        isFree: false,
    },
    {
        id: "clicker-v2",
        title: "MX Clicker Pro",
        description:
            "Design multi-layer AMS-ready MX keycap clickies with image-to-3D conversion.",
        status: "Beta",
        icon: "🖱️",
        link: "/editor/clicker-v2",
        category: "premium",
        isExclusive: false,
        requiredEntitlement: "clicker-v2",
        isFree: false,
    },
    {
        id: "macropad",
        title: "Macropad Builder",
        description:
            "Generate fully parametric MX macropad cases from a flexible grid layout.",
        status: "Beta",
        icon: "🎮",
        link: "/editor/macropad",
        category: "premium",
        isExclusive: false,
        requiredEntitlement: "macropad",
        isFree: false,
    },
    {
        id: "pencil-sleeve",
        title: "Pencil Sleeves",
        description:
            "Design customizable 3D printable pencil sleeves with embossed names.",
        status: "Beta",
        icon: "✏️",
        link: "/editor/pencil-sleeve",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: "pencil-sleeve",
        isFree: true,
    },
    {
        id: "straw-toppers",
        title: "Straw Toppers",
        description:
            "Design customizable 3D printable tumbler straw toppers with embossed names.",
        status: "Beta",
        icon: "🥤",
        link: "/editor/straw-toppers",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "lithophane",
        title: "Lithophane Keychain",
        description:
            "Convert image pixels into a beautiful 3D printable lithophane keychain.",
        status: "Beta",
        icon: "🖼️",
        link: "/editor/lithophane",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "leather-sliders",
        title: "Leather Sliders",
        description: "Create custom 3D text sliders for flat leather straps.",
        status: "Beta",
        icon: "🏷️",
        link: "/editor/leather-sliders",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "qr-standee",
        title: "QR Standee",
        description: "Modular QR desk sign with interchangeable snap-in links.",
        status: "Beta",
        icon: "📱",
        link: "/editor/qr-standee",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "modular-organizer",
        title: "Modular Organizer",
        description: "Snap-together desk nameplate & organizer with a pen cup and multi-line text block.",
        status: "Beta",
        icon: "🗂️",
        link: "/editor/modular-organizer",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "popsocket",
        title: "PopSocket Generator",
        description: "Design personalized 3D printable phone PopSockets with custom text, colors, and style presets.",
        status: "Beta",
        icon: "📱",
        link: "/editor/popsocket",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "screw-top-container",
        title: "Screw Top Container",
        description:
            "A round container with a screw-on lid for small items, gifts, samples, or balm-style packaging. Supports personalized lid text.",
        status: "Beta",
        icon: "🫙",
        link: "/editor/screw-top-container",
        category: "basic",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
];

/**
 * Returns the subset of editors the given entitlements array unlocks.
 * Non-exclusive editors are always included.
 *
 * @param {string[]} entitlements — from the active license
 * @returns {typeof editors}
 */
export function getAccessibleEditors(access = {}) {
    return editors.filter(editor => evaluateGeneratorAccess(editor, access).allowed);
}
