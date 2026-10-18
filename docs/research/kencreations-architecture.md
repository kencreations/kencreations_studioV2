# KenCreations architecture audit

Scope: source inspection on 2026-10-16; no application edits, execution, external requests, or test runs performed for this audit. References describe the current working tree, including existing user changes. **Confirmed** means visible source behavior, not runtime certification; **Inferred** means a consequence needing validation; **Proposed** means independent future work; **Unavailable** means evidence was not gathered.

## Application and integration boundaries

| Status | Area | Evidence and reuse decision |
|---|---|---|
| Confirmed | React/Vite/Electron | `package.json` declares React 19, Vite 8, Three.js 0.185, React Three Fiber, Drei, Clipper, Manifold and Electron. `src/App.jsx:55` nests Auth, Access, Generator, Trial, Profile and Printer providers. Retain these boundaries. |
| Confirmed | Routing | React Router routes in `src/App.jsx:358` onward wrap editors in `GeneratorRoute`. Name Keychain is `/editor/namekeychain`; multiple legacy routes redirect. `src/utils/generatorCatalog.js` provides canonical identities; retain those identities for telemetry and entitlements. |
| Confirmed | Shared editor UI | `EditorLayout`, `EditorCanvas`, `FloatingExportBar`, `TemplateManager`, `HistoryControls`, printer selectors and batch/mass-production controls already exist. `EditorCanvas.jsx:112` calls the central export hook; imperative exports are exposed at lines 149-152. |
| Confirmed | Editing state | `KeychainEditor.jsx:getDefaultConfig` stores independent text lines, base and ring settings. `useHistoryState` implements undo/redo. `useTemplates(editorId)` persists JSON settings in localStorage; it is not a remote synchronization mechanism. |
| Confirmed | Existing generator coverage | `src/pages` already includes PopSocket, Charms, LetterBeads, Clicker, MonogramInsert, MonogramStand, Keycap and Name Keychain. New feature research should first map to these editors rather than create duplicate generators. |

## Typography and geometry

**Confirmed:** `src/utils/fontManager.js:load3DFont` converts bundled TTF URLs, uploaded web ArrayBuffers and Electron IPC font bytes into Three Font objects; `toArrayBuffer` preserves byte offsets. `getCached3DFont` is a shared loader option. Fonts are bundled in `src/assets/fonts`; asset availability does not independently establish redistribution rights.

**Confirmed:** `src/utils/textContour.ts:createTextShapesWithSpacing` samples each glyph, preserves hole contours, advances using `glyph.ha * size / resolution` plus spacing, and centers the combined bounds. Despite some comments elsewhere calling this kerning, the inspected loop does not use pair-specific kerning or script shaping. `src/utils/textEngine.ts:createTextGeometryWithSpacing` is a separate direct TextGeometry path with similar advance math. These are two overlapping text pipelines.

**Confirmed:** `SmartText3D.jsx:17` loads fonts through a component cache, debounces builds by 100 ms, calls the contour utility with spacing fixed at zero, applies line offsets, and extrudes. Bubble mode uses native bevels with a bevel amount capped by depth. It reports 2D shapes to its parent. `SmartBase.jsx` calls `unionShapes` then `offsetShapes`, extrudes, shifts its top surface to Z=0 and reports its centered bounds/offset. `SmartKeyring.jsx` extrudes an annulus and anchors it at the base bounding box top-left plus offsets.

**Confirmed:** `textContour.ts:unionShapes` deliberately drops glyph holes and unions outer contours; `offsetShapes` uses Clipper round offsets and a PolyTree to preserve hole hierarchy. These semantics are appropriate for some solid backings but must not be reused unmodified for text counters. The union operation merges overlapping polygons; contrary to a source comment, it cannot bridge arbitrary gaps between disconnected letters. Ring, base and text are separate rendered meshes in `KeychainEditor.jsx:817-843`.

**Inferred:** keyring/base connectivity is not guaranteed merely by bounding-box anchoring. Large offsets can yield detached parts, and overlapping solids are not automatically a watertight boolean union. A slicer may repair overlaps, but export validation should not rely on that behavior.

**Confirmed:** the more sophisticated typography path is `advancedTypography.js:generateTypographyLayout`, `generateAdvancedTypography`, `createTypographyGeometry` and `resolveTypographyFont`. It includes candidate layouts, circular envelopes, final constraint evaluation and bevel-cap reconstruction. `organicTypography.js:organicLineArrangements`, `buildOrganicCandidates`, and `organicQuality` handle line candidates, glyph envelope deformation, gap optimization, radial conformity and balance. `typographyContours.js` provides polygon booleans, offsets, topology, counter and printable-feature checks with millimetre assumptions. Its header scopes it to PopSocket; current constraints should not be assumed universal.

**Confirmed:** `SmartCSGBase.jsx:computeCSGAsync` and `src/engine/workers/csg.worker.js` provide an existing worker-based hole-drilling path. The component contains fallback-to-raw-base behavior on CSG failure. `useGeometryWorker` is specialized to socket/stem/switch/region parameters, rather than a generic typography scheduler. `binPacking.js:packItems` and `estimateKeychainSize` support mass production.

## Export and authorization

**Confirmed:** `EditorCanvas.jsx:runExport` obtains an export-only group, clears presentation translation/rotation, sends printer dimensions and delegates to `useModelExport`. Regular clones share live geometry; custom scenes declare disposal ownership. `engine/export/modelExport.js:prepareExportScene` bakes world transforms into owned geometry, repairs winding for reflections, handles visible nested/instanced/multi-material meshes, honors export exclusion flags, checks finite coordinates/index ranges and rejects empty output.

**Confirmed:** `serializeModel` writes binary STL or 3MF and disposes temporary scenes in `finally`. `build3MF` uses the existing 3MF exporter, preserves its ZIP files and adds standard base materials and per-corner color resources. Its XML modifications assume an upstream serialized object layout and explicitly reject unexpected part counts. STL carries triangles, not per-part color metadata.

**Confirmed:** `services/exportWorkflow.js:createExportRunner` locks concurrent clicks, authorizes before scene generation and again before save, records only successful saves, isolates analytics errors and releases resources/lock. `saveModel` distinguishes desktop cancellation from save errors; web success means download initiated, not verified disk persistence.

**Confirmed:** `AuthContext.jsx` uses Firebase Google sign-in and account observation. `AccessContext.jsx` merges web and desktop entitlement summaries, observes promotion configuration and desktop revocation/update events, and delegates policy decisions to `licensePolicy.js`. `GeneratorRoute` gates editor entry. `useModelExport` independently evaluates export access, requires ready catalog/sign-in on web, calls the common serializer and records successful exports through `ExportService`; trial decrement is initiated after success. Preserve all of these boundaries during geometry work.

**Inferred:** post-save asynchronous trial decrement is not evidence of atomic server reservation. Client gating is a UX boundary and cannot by itself secure privileged server operations. This audit did not perform a full Firebase rules/functions or Electron trust-boundary assessment; no claim of a demonstrated bypass is made.

## Existing validation and concrete gaps

**Confirmed:** `tests/export.test.js` covers OPC ZIP structure, triangle references, colors, STL millimetre bounds, transforms, invalid geometry, save cancellation, duplicate clicks, analytics failures and counters. `tests/typography.test.js` covers several presets/names, counters, explicit placement, circular constraints and font resolution. `tests/organicTypography.test.js` covers line-count constraints, font injection, print constraints and STL/3MF. `tests/typography/meshChecks.js:validateSurface` checks degenerate triangles, positive signed volume and edge incidence on non-indexed triangles. These are meaningful foundations, but edge incidence alone does not detect all self-intersections or overlapping closed components.

**Confirmed:** `tests/browser/run.mjs` includes real Name Keychain and Keycap STL/3MF downloads, VIP route smoke, revocation and mobile-width checks. The download assertions check basic format validity rather than assembled keychain connectivity. Browser typography capture/editor fixtures also exist. All tests were inspected, not run here.

**Proposed gaps to close:** keychain base/ring connectivity and hole wall thickness; disconnected backing islands; negative/zero/tiny extrusion and bevel limits; missing glyphs, combining marks and complex scripts; per-font kerning requirements; rapid edits and slow-font readiness; current geometry ownership/disposal; large batch cancellation and exact readiness. `KeychainEditor.jsx:handleStartBatch` waits a fixed 1000 ms before each export and does not inspect returned success before eventually reporting completion, making readiness and outcome tests particularly valuable.

**Unavailable:** current runtime performance numbers, slicer acceptance, physical print quality, test pass status, full font licenses, and comprehensive security review.

## Working tree protection

Existing modified paths observed before this audit: three thumbnails (`leather-sliders.png`, `straw-toppers.png`, `whistlebagtag.png`), `useModelExport.js`, `DesktopHome.jsx`, `ExportService.js`, `generatorCatalog.js`, `licensePolicy.js`, and `tests/export.test.js`. Their current content was treated as authoritative input; none was reverted or edited.
