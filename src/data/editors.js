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
        id: "whistle-bagtag",
        title: " Whistle Bagtag",
        description: "Customizable 3D printed whistle with a lanyard hole.",
        status: "Beta",
        icon: "哨",
        link: "/editor/whistle-bagtag",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "client-icon-tag",
        title: " Icon Tag Generator",
        description: "Exclusive generator for client custom icon tags.",
        status: "Beta",
        icon: "🏷️",
        link: "/editor/client-icon-tag",
        isExclusive: true,
        requiredEntitlement: "client-tag",
        isFree: false,
    },
    {
        id: "namekeychain",
        title: " Name Keychain",
        description:
            "Standalone Name Keychain Editor with 3D Preview and Export Options.",
        status: "Stable",
        icon: "🆔",
        link: "/editor/namekeychain",
        // Standard generator — available to all activated users
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "charms",
        title: " Chunky Charms",
        description: "Design custom 3D icon charms with paracord holes.",
        status: "Stable",
        icon: "✨",
        link: "/editor/charms",
        // Exclusive — requires entitlement "charms" in the license
        isExclusive: true,
        requiredEntitlement: "charms",
        isFree: false,
    },
    {
        id: "letter-beads",
        title: " Letter Beads",
        description: "Create custom 3D text and letter beads.",
        status: "Stable",
        icon: "🔤",
        link: "/editor/letter-beads",
        // Exclusive — requires entitlement "letter-beads" in the license
        isExclusive: true,
        requiredEntitlement: "letter-beads",
        isFree: false,
    },
    {
        id: "keycap-maker",
        title: " Keycap Maker",
        description:
            "Create custom 3D printable mechanical keyboard keycap sets.",
        status: "Beta",
        icon: "⌨️",
        link: "/editor/keycap-maker",
        // Exclusive — requires entitlement "keycap-maker" in the license
        isExclusive: true,
        requiredEntitlement: "keycap-maker",
        isFree: false,
    },
    {
        id: "clicker-v2",
        title: " MX Clicker Pro",
        description:
            "Design multi-layer AMS-ready MX keycap clickies with image-to-3D conversion.",
        status: "Beta",
        icon: "🖱️",
        link: "/editor/clicker",
        // Exclusive — requires entitlement "clicker-v2"
        isExclusive: true,
        requiredEntitlement: "clicker-v2",
        isFree: false,
    },
    {
        id: "macropad",
        title: " Macropad Builder",
        description:
            "Generate fully parametric MX macropad cases from a flexible grid layout.",
        status: "Beta",
        icon: "🎮",
        link: "/editor/macropad",
        // Exclusive — requires entitlement "macropad"
        isExclusive: true,
        requiredEntitlement: "macropad",
        isFree: false,
    },
    {
        id: "pencil-sleeve",
        title: " Pencil Sleeves",
        description:
            "Design customizable 3D printable pencil sleeves with embossed names.",
        status: "Beta",
        icon: "✏️",
        link: "/editor/pencil-sleeve",
        isExclusive: true,
        requiredEntitlement: "pencil-sleeve",
        isFree: false,
    },
    {
        id: "straw-toppers",
        title: " Straw Toppers",
        description:
            "Design customizable 3D printable tumbler straw toppers with embossed names.",
        status: "Beta",
        icon: "🥤",
        link: "/editor/straw-toppers",
        isExclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "leather-sliders",
        title: " Leather Sliders",
        description: "Create custom 3D text sliders for flat leather straps.",
        status: "Beta",
        icon: "🏷️",
        link: "/editor/leather-sliders",
        isExclusive: false,
        requiredEntitlement: null,
    },
    {
        id: "qr-standee",
        title: " QR Standee",
        description: "Modular QR desk sign with interchangeable snap-in links.",
        status: "Beta",
        icon: "📱",
        link: "/editor/qr-standee",
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
export function getAccessibleEditors(entitlements = []) {
    return editors.filter((editor) => {
        if (!editor.isExclusive) return true;
        return entitlements.includes(editor.requiredEntitlement);
    });
}
