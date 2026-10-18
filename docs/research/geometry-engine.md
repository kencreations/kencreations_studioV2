# Geometry, typography, preview, and export evidence

Scope: static, bounded reads of the supplied files under `audit-artifacts/pixnprints-input`; no imported application code executed. Offsets below are zero-based decoded JavaScript character offsets, not byte offsets. Symbols are minified and apply only to this build.

## Confirmed

- `chunks/Di08Zc4b.js`, entry `id:"standaloneName"` near offset 14100, identifies Name Keychain and describes optional border, text outline, and keyring. Its definition dynamically imports `DO7EAprE.js` and selects `standaloneName`. That target is absent from the supplied chunks. The saved HTML advertises STL and 3MF and renders a designer loading shell; it is not a captured working editor.
- `chunks/D-jG3l7M.js`, class `X.generateShapes` at 669 and functions `Z`/`q1` at 1164: font outlines are converted into shapes using JSON glyph data. Coordinates scale by requested size / font resolution; glyph advance moves the pen; newline moves the baseline. Outline commands include move, line, quadratic and cubic curves. Missing glyphs fall back to `?`. This is a shared helper, not proof of the missing route implementation.
- The same file, registry `g` and defaults `p9`, `F9`, `w9`, `S9` near its end: embedded font options include Titan One, Kablammo, Pacifico, and others. Shared defaults specify text size 13, outline offset 10, base depth 3, text depth 2, white text, pink outline, enabled keyring; ring defaults include outer size 8, hole size 4, round style, top-left position, tab extension 4. These are shared defaults; final Name Keychain controls may override them. Do not assume the outline field named `Px` is millimeters.
- `D-jG3l7M.js`, `O9` at 19114301 constructs an outer circle with an inner circular hole, clamps outer radius to at least 0.1 and hole radius between 0.05 and outer minus 0.1, and extrudes it with bevel disabled and a default of 64 curve segments. This documents an available ring helper, not a verified assembled keychain union.
- `DB60o4L_.js`, `Fh="182"`, `ExtrudeGeometry` near 179938 and `triangulateShape` near 179436: bundled Three.js geometry primitives include extrusion, hole-aware shape triangulation and shape geometry. Their presence does not establish which operations the missing designer calls.
- `D-jG3l7M.js`, custom-font storage code at 1850 onward: IndexedDB stores original font bytes and converted JSON; localStorage stores a manifest; generated `@font-face` rules expose uploaded fonts for browser display. `y9` near 5650 accepts TTF/OTF up to 8 MB and calls `convertFontBuffer` from missing `DNuqB2pD.js`, with charset and reverse-outline options. The actual conversion algorithm is unavailable.
- `D-jG3l7M.js`, `M9` at 19114558 disposes descendant geometries and materials; `t9` creates a temporary object URL and download link; `L9` renders then uses canvas `toBlob` for a PNG. These are shared lifecycle/download helpers.
- `CO825_kz.js`, symbols `G`, `E`, `R`, `K` near the end, supplies printer dimensions, filament/profile settings, application metadata including a 3MF version field, and a remembered printer ID. It is printer configuration, not the mesh serializer.

## Inferred

The bundle is designed around client-side font shapes and Three.js geometry, with shared resources reused by multiple designers. The registry suggests Name Keychain should consume some of this stack. Its precise call graph is incomplete because the definition chunk is missing.

## Unavailable

The supplied files do not establish Name Keychain's offset/union library, kerning strategy beyond the shared glyph helper, ring attachment/boolean algorithm, disconnected-letter repair, exact preview camera/lights, actual STL/3MF serializer, multi-material packaging, manifoldness, dimensional correctness, or slicer compatibility. The shared font warning mentioning “Fix hollow letters” is UI text, not evidence that a repair algorithm was inspected. Neither 3MF metadata strings nor an export label demonstrate a successful export. Font licensing cannot be inferred from embedded availability.

## Proposed independent implementation

The following maps recovered primitives to independent designs. These are not instructions to copy the captured implementation.

| Confirmed primitive and source | Mathematical principle / dependencies | Proposed independent equivalent |
|---|---|---|
| `D-jG3l7M.js:X.generateShapes,Z,q1` | Scale outline coordinates by size/resolution; translate by accumulated glyph advance and baseline; ShapePath preserves curve commands before shape extraction. Depends on Three.js primitives from `DB60o4L_.js` and font JSON. | Use KenCreations' licensed fonts and contour utility; define millimetre conversion explicitly, preserve counters, and diagnose unsupported glyphs. Add kerning/shaping separately where required. |
| `D-jG3l7M.js:O9` | Annular 2D region between concentric circles, extruded along Z. Depends on Shape/Path/ExtrudeGeometry. | Construct an annulus from requested inner/outer diameters, validate positive wall/depth, and union its attachment with the backing. Require an attachment test; a ring mesh alone is insufficient. |
| `DB60o4L_.js:ExtrudeGeometry,triangulateShape` | Triangulate planar polygons with holes, then connect corresponding boundary vertices across depth layers; bevel adds offset boundary layers. | Reuse the repository's licensed Three.js dependency, validate contour winding/holes before extrusion, and test bevels against minimum features and self-intersections. Library capability does not prove competitor settings. |
| `D-jG3l7M.js:y9` and custom-font storage | Persist bytes and converted glyph data; browser font display is a separate representation from geometry. Conversion dependency `DNuqB2pD.js` is missing. | Use existing `fontManager.js` and versioned font cache keys; invalidate geometry when fonts change, and associate license/provenance information with assets. Do not reproduce an unknown converter. |
| `D-jG3l7M.js:M9` | Traverse mesh resources and release geometry/material allocations. Depends on object hierarchy and disposal methods. | Give preview/cache/export geometries explicit owners; dispose temporary clones in `finally` and retain shared cached resources until references are released. A traversal does not establish safe shared-resource ownership. |
| `D-jG3l7M.js:t9,L9` | Browser Blob/object-URL download and canvas raster capture. | Retain the repository's export/save workflow, release temporary URLs and distinguish canceled saves from success. These helpers do not supply STL/3MF serialization. |

Use independently licensed font assets and a separately implemented pipeline: text layout → sampled glyph contours → nesting/hole classification → integer-scaled polygon unions/offsets → backing and ring boolean union → triangulation/extrusion → mesh validation → preview/export. Keep physical dimensions in millimeters, explicitly convert font units, and expose a connectivity warning when a backing is disabled. Test counters such as B/8/O, detached dots, overlapping script glyphs, empty text, unicode fallback, minimum wall thickness, edge incidence and signed volume. A color-separated 3MF implementation needs package validation and slicer import tests; binary STL loses material separation. These are recommendations, not recovered competitor algorithms.
