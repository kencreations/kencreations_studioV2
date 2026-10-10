# Organic Circular typography rework

## Scope and outcome

This change replaces the Organic Circular composition path with per-glyph vector shaping. It preserves the original cap asset, snap-fit geometry, transforms, editor theme and export integration. Firebase, pricing, licensing and unrelated generators were not changed for this rework. The workspace already contains extensive changes from earlier work; this report does not attribute those changes to this task.

The results form curved compositions while retaining counters and explicit printing constraints. They do **not** reproduce the bespoke mixed-case calligraphy of the supplied black Faith / Over / Fear reference. Font-based deformation remains visibly more regular, and some forced arrangements leave substantial base visible. Manual refinement controls are available.

## Architecture and confirmed root causes

The editor supplies settings to `PopSocketMesh`, which loads a font and generates outlines through `advancedTypography.js`. The same extruded text geometry feeds preview and export alongside the original cap.

At the checkpoint, Organic Circular used whole-composition mapping into a disc. This produced a rounded boundary without enough independent control over glyph anatomy. Layout candidate selection and radial hard rejection could sacrifice useful readable arrangements. Three-line selection was not implemented consistently. A legacy hard flatness rejection also rejected the otherwise valid Groovy `MY NAME` regression case; it now remains a scoring consideration rather than a rejection.

Earlier work in this task corrected whole-word inflation/counter loss, the `Titan One` font-name mismatch, stale async font/geometry results and export clones sharing disposable preview resources. Those repairs are retained. The final extrusion work reconstructs inset bevel caps from their actual boundary loops and splits omitted collinear boundary vertices; this fixes missing/crossed bevel triangles and open text surfaces found during mesh checks.

Recoverable pre-rework sources are in `audit-artifacts/typography/checkpoint-2026-10-11/`. The executable comparison is `tests/typography/checkpoint.js`. The older `before.js` fixture captures the earlier inflation implementation.

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/utils/organicTypography.js` | Dedicated line enumeration, individual envelopes, deformation, optical spacing and candidate scoring |
| `src/utils/typographyContours.js` | Shared Clipper contour operations, topology, clearance, counter and feature checks |
| `src/utils/advancedTypography.js` | Organic dispatch, final/manual validation, canonical extrusion and bevel cap repair |
| `src/pages/PopSocketEditor.jsx` | Four Organic layout modes, explicit newlines, printing limits and manual dimensions/stretch |
| `src/components/3D/PopSocketMesh.jsx` | Retained async readiness, font resolution and canonical preview/export integration |
| `src/components/3D/TypographyDiagnostics.jsx` | Retained development-only contour/collision visualization |
| `tests/organicTypography.test.js` | 28 requested cases plus line-policy and manual/font checks |
| `tests/typography/meshChecks.js` | Finite, closed, consistently wound text-surface checks |
| `tests/typography/organic-preview.js`, `organic.html`, `capture-organic.mjs` | Real vector and cap-mesh comparison renders |
| `tests/typography/editor-browser.mjs` | Actual editor controls, downloads, stale/error recovery and mobile regression |
| `docs/POPSOCKET-FONT-LICENSE.txt` | Existing Coiny font licensing notice |

## Shaping and layout behavior

Each glyph receives an individual curved top/bottom envelope. Width weighting, lateral bending, taper and smooth internal deformation shape outlines and holes together. Aspect/stretch limits protect readability. Small existing counters can be opened slightly; safe morphological opening rounds terminal tips. There is no circle clipping, whole-word union or outward inflation used to manufacture the circular silhouette. Final shrink only enforces containment after spacing.

- **Auto Fit:** evaluates one, two and three rows; honors explicit newlines.
- **1 Line:** exactly one row; explicit newlines become spaces.
- **2 Lines / 3 Lines:** exactly that many nonempty rows. Explicit breaks must match. Too few characters or unsafe geometry produces an explanatory error, not a silently different layout.
- Whole-word partitions are preferred when available. Input case is preserved.
- Manual X/Y, scale, rotation, independent width/height and local stretch operate after automatic fitting. Reset removes adjustments. Invalid edits are rejected without silently fitting away the user's placement.

## Circular envelope and negative space

Seventy-two rays intersect the actual outline segments. A trimmed radial conformity score tolerates intentional letter gaps; it is not a percentage of ink coverage or a guarantee of artistic quality. Scoring also considers quadrant ink balance, distortion, gap variation, row imbalance and word breaks. Ink area has only a small weight.

Spacing optimization moves adjacent same-word glyphs using dilated polygon collision checks. Word gaps remain distinct. The default minimum letter gap is 0.5 mm and the feature setting is 0.6 mm; both have bounded user controls. Counters, finite contours, self-intersections, safe-radius containment and eroded stroke cores are checked separately. These are conservative geometric checks, not calibrated printer/material guarantees.

## Visual iterations and evidence

Reviewed all seven names in four modes as black vector silhouettes and top-view renders using the original cap and actual Coiny TTF. Refinements included whole-word breaks, stretch limits for short three-row layouts, optical channels and rounded terminal tips. The final Auto choices include KEN, NA/TE, CAMI, NA/ME, ALD/RIN, HELLO/PHOEZ and FAITH/OVER/FEAR.

- [Complete checkpoint gallery](../audit-artifacts/typography/organic-before.png)
- [Complete final gallery](../audit-artifacts/typography/organic-after.png)
- [ALDRIN before](../audit-artifacts/typography/organic-before-4.png) / [after](../audit-artifacts/typography/organic-after-4.png)
- [FAITH OVER FEAR before](../audit-artifacts/typography/organic-before-6.png) / [after](../audit-artifacts/typography/organic-after-6.png)
- [Actual desktop editor](../audit-artifacts/typography/editor-desktop.png)
- [Actual mobile editor](../audit-artifacts/typography/editor-mobile.png)
- Per-case metrics: `audit-artifacts/typography/organic-after.json`.

Artifacts are local, gitignored files. The capture harness can regenerate them. Before images use the executable checkpoint; after images use production typography code.

## Validation results

- `npm test`: **60 passed, 0 failed** after final geometry changes.
- Requested Organic matrix: **28 cases checked; 26 successful closed text meshes and STL/3MF serializations; 2 expected safe rejections.** FAITH OVER FEAR in forced one/two rows fails the default 0.6 mm feature check. Its Auto and three-row modes pass.
- Successful cases check character order, selected row count, hole retention, real polygon clearance, finite triangles, nonzero area, positive volume, edges used exactly twice and safe-radius containment.
- STL tests verify binary size and triangle count. 3MF tests inspect genuine ZIP parts, XML, millimeter units and triangle counts. Shared export regression tests additionally verify OPC relationships, triangle references, materials and colors.
- Actual editor browser regression uses only local demo Auth/Firestore emulators, with external requests blocked. It checks STL, 3MF and repeated STL downloads; original cap/text parts and two colors; line controls/newlines; rapid edits; invalid-character export blocking and recovery. Analytics permission failures do not cancel downloads.
- Browser regression: **passed**, including the mounted editor at 390 px with no document overflow and no uncaught runtime exceptions. Mobile emulation reloads the editor to its defaults; this is a responsive-layout check, not persistence verification. Screenshots include the development-only diagnostics overlay.
- Targeted ESLint for current typography source and unit tests: **passed**.
- `npm run build`: **passed**. Existing large-chunk and Manifold `node:module` externalization warnings remain.
- `npm run lint`: **failed, 284 errors and 23 warnings**. This includes three errors in the frozen historical `tests/typography/before.js` fixture; the remainder are outside the targeted current typography files. Full lint is not clean.
- No standalone typecheck command is configured.

## Geometry preservation and limitations

The original `src/assets/models/popsocket.3mf` SHA-256 remains `CBAE80F9F089822D9FF1726E2F19C78EC1FDDC50C3310FC1325B4BCB2EBBD7C0`. Its snap fit and orientation transforms are preserved. Raised text uses the same canonical mesh for preview/export, faces outward and seats 0.03 mm into the cap. 3MF retains separate cap/text colors and parts.

No physical print, commercial slicer import or packaged Electron run was performed. The original cap's manufacturing tolerance and manifoldness are not newly certified. STL preserves touching/overlapping cap/text volumes rather than destructively remeshing the snap fit. Engraving remains explicitly unavailable rather than exporting a false recessed model.

The engine is font-derived, not a custom glyph drawing system. It cannot automatically reproduce the reference's swashes, asymmetric terminals and hand-designed mixed-case anatomy for arbitrary text. Long single-line text can remain small; forced three-line short names can look stretched. The manual controls are meaningful contour transforms, not a Bezier-node editor. Complex-script shaping/bidi is not implemented; unsupported glyphs fail explicitly. Text is limited to 24 characters. These artistic and fabrication limitations remain even when all structural tests pass.
