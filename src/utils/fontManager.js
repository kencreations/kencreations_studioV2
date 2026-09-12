import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";

const fontFiles = import.meta.glob("../assets/fonts/*.ttf", {
    query: "?url",
    import: "default",
    eager: true,
});

export const BUNDLED_FONTS = Object.keys(fontFiles).map((filepath) => ({
    id: filepath.split("/").pop().replace(".ttf", ""),
    label: filepath.split("/").pop().replace(".ttf", "").replace(/_/g, " "),
    url: fontFiles[filepath],
}));

export const normalizeFontOption = (fontOption) => {
    if (!fontOption) return null;
    const filePath = fontOption.filePath || fontOption.file_path || null;
    return {
        ...fontOption,
        filePath,
        file_path: filePath,
    };
};

/**
 * Converts an IPC-returned Buffer/Uint8Array into a clean ArrayBuffer that TTFLoader.parse() expects.
 *
 * Electron's IPC bridge serializes a Node Buffer into a Uint8Array on the renderer side. That buffer may
 * still carry an underlying ArrayBuffer with a non-zero byteOffset. If we pass the raw typed array directly,
 * TTFLoader.parse() can misread the font data because the parser expects a real ArrayBuffer view over the actual
 * bytes, not a sliced array whose underlying buffer starts earlier than the slice. The explicit slice below
 * guarantees a contiguous binary payload and avoids the silent parse corruption/crash that happens with custom
 * uploaded fonts.
 */
const toArrayBuffer = (raw) => {
    if (!raw) return null;

    // Electron serializes Node Buffers across IPC as a Uint8Array-ish payload.
    // In practice this can arrive as:
    //   - Uint8Array
    //   - ArrayBuffer
    //   - { type: 'Buffer', data: [...] }
    //   - plain arrays/typed arrays
    // We normalize all variants into a single contiguous Uint8Array before slicing
    // to a clean ArrayBuffer because TTFLoader.parse() is strict about the binary input.
    let uint8 = null;

    if (raw instanceof Uint8Array) {
        uint8 = raw;
    } else if (raw instanceof ArrayBuffer) {
        uint8 = new Uint8Array(raw);
    } else if (ArrayBuffer.isView(raw)) {
        uint8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    } else if (Array.isArray(raw?.data)) {
        uint8 = new Uint8Array(raw.data);
    } else if (Array.isArray(raw)) {
        uint8 = new Uint8Array(raw);
    } else if (raw && typeof raw === "object" && Array.isArray(raw.data)) {
        uint8 = new Uint8Array(raw.data);
    } else {
        uint8 = new Uint8Array(raw ?? []);
    }

    const start = uint8.byteOffset ?? 0;
    const end = start + uint8.byteLength;
    return uint8.buffer.slice(start, end);
};

/**
 * Universally loads a TTF font and converts it to a Three.js Font object.
 * Handles both standard URL fetching for bundled web fonts and direct IPC Buffer extraction
 * for locally uploaded custom fonts to bypass Chromium web restrictions.
 */
export const load3DFont = async (fontOption) => {
    const normalized = normalizeFontOption(fontOption);
    const fontLoader = new FontLoader();
    const ttfLoader = new TTFLoader();

    if (normalized?.isCustom) {
        const filePath = normalized.filePath || normalized.file_path;
        if (!filePath || !window.electronAPI?.readFontBuffer) {
            throw new Error(
                "Custom font is missing a file path or the Electron IPC bridge is unavailable.",
            );
        }

        const raw = await window.electronAPI.readFontBuffer(filePath);
        const arrayBuffer = toArrayBuffer(raw);
        if (!arrayBuffer) {
            throw new Error(
                `Failed to convert the custom font bytes for ${filePath}`,
            );
        }

        const fontJson = ttfLoader.parse(arrayBuffer);
        return fontLoader.parse(fontJson);
    }

    const getAssetPath = (path) => {
        if (!path) return path;
        return path.startsWith('/') ? '.' + path : path;
    };

    return new Promise((resolve, reject) => {
        ttfLoader.load(
            getAssetPath(fontOption.url),
            (json) => resolve(fontLoader.parse(json)),
            undefined,
            reject,
        );
    });
};

const fontCache = new Map();

/**
 * Loads and caches a fully parsed Three.js Font object.
 * This prevents massive CPU spikes when rendering many text meshes with the same font.
 */
export const getCached3DFont = async (fontOption) => {
    const normalized = normalizeFontOption(fontOption);
    const fontId = normalized?.id || "default";
    
    if (fontCache.has(fontId)) {
        return fontCache.get(fontId);
    }
    
    const fontPromise = (async () => {
        const fontJson = await load3DFontJson(fontOption);
        return new FontLoader().parse(fontJson);
    })();
    
    fontCache.set(fontId, fontPromise);
    return fontPromise;
};

/**
 * Loads a TTF font and returns just the unparsed JSON metadata.
 * This is primarily used by CharmMesh which directly creates 2D ShapeGeometry.
 */
export const load3DFontJson = async (fontOption) => {
    const normalized = normalizeFontOption(fontOption);
    const ttfLoader = new TTFLoader();

    if (normalized?.isCustom) {
        const filePath = normalized.filePath || normalized.file_path;
        if (!filePath || !window.electronAPI?.readFontBuffer) {
            throw new Error(
                "Custom font is missing a file path or the Electron IPC bridge is unavailable.",
            );
        }

        const raw = await window.electronAPI.readFontBuffer(filePath);
        const arrayBuffer = toArrayBuffer(raw);
        if (!arrayBuffer) {
            throw new Error(
                `Failed to convert the custom font bytes for ${filePath}`,
            );
        }
        return ttfLoader.parse(arrayBuffer);
    }

    const getAssetPath = (path) => {
        if (!path) return path;
        return path.startsWith('/') ? '.' + path : path;
    };

    return new Promise((resolve, reject) => {
        ttfLoader.load(getAssetPath(fontOption.url), resolve, undefined, reject);
    });
};
