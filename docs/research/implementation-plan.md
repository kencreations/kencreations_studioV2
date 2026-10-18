# Independent implementation plan

Status: **Proposed** work, grounded in the **Confirmed** current-source findings in `kencreations-architecture.md`. No application implementation is included in this research change. Competitor behavior is not assumed; proposals below are independent designs. Runtime baselines and print certification are **Unavailable** until the corresponding validation is performed.

## Priority 0: preserve the baseline and make failures observable

1. Record baseline `npm test`, `npm run build`, and relevant lint findings before modifying geometry. Use `npm run test:browser` with emulator fixtures for Name Keychain export and entitlement behavior; do not use production accounts or change production rules. Existing user modifications to policy/export/catalog must be preserved.
2. Add readiness/outcome regression cases around `KeychainEditor.jsx:handleStartBatch`, `SmartText3D` and `EditorCanvas:runExport`. **Confirmed** current batch code uses a 1000 ms delay. **Proposed:** expose a generation revision/readiness promise and export the matching revision; stop/report failed saves accurately and restore edited state in `finally`. Test slow font loading, rapid edits, cancel, expired access and failing exports.
3. Establish reference fixtures for bounds, holes, part count and materials using repository-owned fonts and simple geometric primitives. Store expected invariants rather than competitor mesh snapshots.

Acceptance: authorized save, cancellation and rejection remain distinct; a batch cannot report success for failed exports; no stale name geometry is exported.

## Priority 1: a shared typed typography contract, introduced incrementally

**Proposed:** add a small pure typography module under `src/engine/typography` with an input contract for text, resolved font, physical dimensions, line count, boundary kind, spacing, style, extrusion and minimum feature constraints. Return glyph contours, semantic parts, bounds, diagnostics, generation revision and explicit failure status. Keep loading, entitlement checks and React state outside the pure geometry functions.

Reuse `fontManager.js:load3DFont/getCached3DFont`, `textContour.ts:createTextShapesWithSpacing`, `advancedTypography.js:generateTypographyLayout/createTypographyGeometry`, and `organicTypography.js:buildOrganicCandidates`. Do not simply merge the hole-filling backing union with the hole-preserving text operations. Preserve current PopSocket behavior behind an adapter first; migrate Name Keychain separately.

**Proposed algorithm:** enumerate permitted one/two/three-row splits; construct glyph contours; fit with bounded uniform/anisotropic scale; evaluate boundary containment, minimum counter/stroke cores and neighbor gaps; score readable coverage and balance. Keep explicit row breaks/manual placement invariant. Add rectangular boundary support first; use existing circular/organic paths where their assumptions hold. If no printable candidate exists, return actionable diagnostics instead of silently changing the requested text.

Acceptance: deterministic output for fixed input; no silent row-count changes; known counters survive; shapes remain inside the requested boundary; unsupported glyph behavior is explicit. Complex script shaping is a separate design decision, not covered by simple glyph advances.

## Priority 2: physical topology and part semantics

**Proposed:** define whether each product requires one connected backing, separate color bodies, or intentionally separate printable parts. Carry stable part IDs/materials through geometry generation and export. Use 2D polygon unions before extrusion for same-height overlapping backing regions; retain actual glyph counters in text. Where 3D booleans are necessary, evaluate the existing CSG/Manifold dependencies using small fixtures before adopting either path.

For Name Keychain, validate the ring's outer diameter, inner diameter, wall thickness and overlap with the actual backing polygon. Offer an explicit placement error or independent automatic anchor strategy based on nearest backing contour; bounding-box anchoring alone is insufficient. Reject or deliberately bridge disconnected base islands according to product policy. Clamp or reject invalid bevel/depth combinations before extrusion.

Acceptance: connected backing where required; ring hole remains open; dimensions measured from exported geometry match specification; closed surfaces, positive volume, no degenerate triangles, plus self-intersection/overlap checks appropriate to intended solids. Keep color parts separate in 3MF where needed; do not assume STL can encode those colors.

## Priority 3: export integration and compatibility

Reuse `modelExport.js:serializeModel`, `exportWorkflow.js:createExportRunner`, and `useModelExport`; retain the second authorization check and success-only accounting. Do not create page-specific download or licensing paths.

**Proposed:** extend export fixtures with the semantic keychain/text/base/ring assembly, mirrored instances and packed plates. Re-import generated STL/3MF and compare bounds, part relationships and material metadata. Add a contract fixture around the exact upstream 3MF XML layout relied on by `build3MF`. Perform manual acceptance in selected slicers and record versions/results; format validity alone is insufficient.

Acceptance: millimetre dimensions and intended print orientation survive; no platform/helper meshes appear; original scene ownership is unchanged; access changes and cancellations never increment successful export counters.

## Priority 4: performance with measured thresholds

**Proposed:** first measure contour generation, fit search, extrusion, serialization and peak memory for short/long names and batches. Cache immutable font/shape/layout inputs by font identity plus geometry-relevant parameters; do not share mutable geometry ownership accidentally. Move expensive pure candidate search to a dedicated worker only when measurements justify it. Adopt request IDs, discard stale results, handle worker errors explicitly, and dispose superseded or temporary geometries.

The existing `useGeometryWorker` is specialized; do not stretch it into an unrelated typography contract. The current CSG worker/component pattern is useful evidence, but its raw-base fallback should not silently export an undrilled product.

Acceptance: bounded cache, no stale-response overwrite, no sustained geometry growth after repeated edits, recorded before/after responsiveness on the same fixture and machine. Numeric performance targets should be set after the baseline rather than invented now.

## Priority 5: expand existing generators before adding new ones

| Proposed feature | Existing integration point | First independent validation |
|---|---|---|
| Circular/organic phone-grip lettering | `PopSocketEditor.jsx`, advanced/organic typography | Containment, readability, line constraints, unmodified mounting dimensions |
| Puffy letter keychain | `KeychainEditor.jsx`, `SmartText3D` bevel mode | Tiny counters, bevel self-intersections, ring connectivity |
| Charm maker | `CharmsEditor.jsx`, `CharmMesh.jsx`, charm worker | Outline/hole integrity and attached loop |
| Layered monogram | `MonogramInsertEditor.jsx`, `MonogramStandEditor.jsx` | Layer intersection, alignment, intended separate bodies |
| Letter beads | `LetterBeadsEditor.jsx` | Through-hole clearance and minimum walls |
| Image to clicker | `ClickerEditor.jsx`, `engine/image` pipeline, `buildClicker.ts` | Image contour fidelity and mechanical clearances |
| Model decal | Existing 3MF import and image modules; new surface projection design needed | Surface attachment, curvature, offset and boolean failures |
| Screw-top container | New parametrized body/thread design needed | Thread clearance, wall thickness, interference and physical fit |

**Unavailable:** verified competitor algorithms for any feature not established in the separate artifact audit. Public visual descriptions can inform requirements, but do not prove internal geometry methods. Implement independently from requirements and standard geometry principles; never transplant recovered proprietary code or bypass access controls.

## Separate authorization follow-up

**Proposed:** audit backend export/trial authorization as a distinct task using existing Firebase functions/rules and emulator tests. Determine whether trial use needs an atomic reservation/commit/idempotency protocol; retain independent server checks for protected operations. This is a design review recommendation, not a confirmed exploit. Geometry development should not weaken route, export, desktop or backend entitlement enforcement.
