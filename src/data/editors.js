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
 *   exclusive           — if true, this generator requires a license entitlement to access
 *   requiredEntitlement — the entitlement ID that must appear in the license's entitlements[]
 *                         array. Ignored if exclusive = false.
 *   isFree              — legacy flag; kept for backward compatibility
 */

export const editors = [
    {
        id: "namekeychain",
        title: " Name Keychain",
        description:
            "Standalone Name Keychain Editor with 3D Preview and Export Options.",
        status: "Stable",
        icon: "🆔",
        link: "/editor/namekeychain",
        // Standard generator — available to all activated users
        exclusive: false,
        requiredEntitlement: null,
        isFree: true,
    },
    {
        id: "charms",
        title: " Chunky Charms",
        description:
            "Design chunky 3D charms with SVG icons and paracord holes.",
        status: "Beta",
        icon: "✨",
        link: "/editor/charms",
        // Exclusive — requires entitlement "charms" in the license
        exclusive: true,
        requiredEntitlement: "charms",
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
        exclusive: true,
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
        exclusive: true,
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
        exclusive: true,
        requiredEntitlement: "macropad",
        isFree: false,
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
    return editors.filter(editor => {
        if (!editor.exclusive) return true;
        return entitlements.includes(editor.requiredEntitlement);
    });
}
