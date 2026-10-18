# Independent designs for eight advertised generators

Scope: public metadata in the supplied `Di08Zc4b.js`, not authenticated editor operation. **Confirmed** below means the claim is present in that catalog, not that printing or the editor was tested. The direct implementation module for every generator below is absent from the supplied files. **Unavailable:** exact competitor algorithms, control ranges, tolerances, export internals, and runtime behavior. No protected requests were issued and no premium gates were bypassed. Public descriptions and change notes are sufficient for this initial design exercise; external descriptions, videos, and preview images have not been independently inspected.

All algorithm steps and validation criteria below are **Proposed** independent designs. They are not recovered competitor implementation. See `generator-catalog.md` and its JSON companion for exact source columns, full metadata, and reference paths. No competitor source, font outlines, or brand assets should enter application code through this work.

## Shared original geometry contract

**Proposed:** Use millimeters, consistent XY artwork coordinates, and +Z thickness. A job returns named closed solid parts, material IDs, a single explicit assembly transform, bounds, and validation diagnostics. The same result supplies preview and export. Keep model-space parts separate from exploded-view transforms. Flatten transforms exactly once for STL; retain valid component transforms and material assignments in 3MF. A collection of intersecting closed meshes is not automatically a manifold Boolean union.

**Proposed:** Normalize licensed glyph/vector contours, resolve winding and nesting, simplify to a physical error tolerance, and use robust polygon operations before extrusion. Preserve holes and islands intentionally. Perform 3D Boolean operations only when the shape cannot be expressed by reliable 2D operations plus extrusion. Cache contours by font identity, glyph and tolerance; cache solids by normalized parameters. Use cancellable worker jobs for expensive Boolean or field operations, and dispose superseded preview resources.

**Proposed acceptance:** finite coordinates, nonzero triangles, consistent outward normals, closed edge incidence, no unintended self-intersections, expected connected components, correct bounds in millimeters, and minimum walls after holes and inlays. Edge incidence alone is insufficient to prove a valid solid. Parse exported STL/3MF back into an independent validation path and compare world-space bounds and volumes within explicit tolerances. Check multicolor parts for unintended positive-volume overlaps and unsupported islands. A slicer review and physical fit samples remain necessary for mechanical parts.

## Phone Grip Topper

**Confirmed metadata:** `Di08Zc4b.js`, object `ee`, ID `phoneGripTopper`; missing definition `CI906wMx.js`. Describes lettering packed into a circular flat multicolor topper. Its update note advertises a topper diameter slider that scales artwork with the disc. Subscriber-only flag. One/two/three-line packing and per-glyph anisotropic scaling are requested design goals, not verified competitor controls.

**Proposed inputs:** text, licensed font, line count 1–3, disc diameter, edge margin, base/art thickness, color, and bounded X/Y stretch. Add optional advanced per-letter adjustments after autofit.

**Proposed algorithm:** enumerate valid line breaks; shape glyphs with kerning; optimize line positions, spacing, and bounded glyph scales. For a circle of usable radius R, a horizontal band at y has available width `2*sqrt(R²-y²)`; use the minimum width over the whole line-height band for a conservative initial fit. Refine against actual transformed glyph contours: every point must remain within the inset circle and neighboring glyphs must satisfy the intended spacing/overlap policy. Maximize coverage while penalizing anisotropy, uneven gaps, rotation, and departures from the baseline. Use deterministic seeds, iteration limits, and a fallback centered fit. Exact polygon containment checks validate the final result; sampled bounds alone are not the final certificate. Preserve readable counters rather than maximizing area without constraint.

**Proposed solids/export:** extrude a closed disc and separate colored letter regions. For flush multicolor geometry, subtract lettering footprints from the corresponding disc layer and fill with nonoverlapping art solids. For raised art, join at a shared plane or create an explicitly Boolean-unioned single-material result. Export labeled material parts in 3MF; offer combined watertight STL where appropriate.

**Proposed tests:** one glyph, long names, three unequal lines, punctuation, missing glyphs, holes in B/O, and extreme stretch bounds. Verify radial containment, minimum stroke width, stable ordering, disc diameter, and unchanged dimensions after export.

## Puffy Letter Keychain

**Confirmed metadata:** `Di08Zc4b.js`, object `H`, ID `puffyLetterKeychain`; missing definition `CzpiPjG3.js`. Advertises a balloon cushion with letter pockets and separate puffy letters pressed in after printing. No explicit access flag in this capture: restricted status is **Unavailable**, despite its inclusion in the requested premium research list.

**Proposed inputs:** text, font, cushion margin, puff height, insert depth, fit clearance, ring dimensions, and print orientation.

**Proposed algorithm:** union expanded glyph footprints into a connected cushion boundary, explicitly bridge isolated islands where necessary, and produce a rounded upper surface from an inward distance field. One possible height law is `z = z0 + h*sqrt(max(0,1-(1-clamp(d/r,0,1))²))`, where d is inward boundary distance. This gives a rising dome from the edge; cap the medial region smoothly to avoid ridges. Generate an adaptive triangulation and close it with sidewalls and a flat bottom. Use the glyph footprint for insert stems and subtract offset pocket solids from the cushion, keeping adequate pocket floors. The decorative puff can overhang a narrower insert stem only within a tested printing constraint. Preserve glyph counters and avoid merging adjacent pockets.

**Proposed fit/export:** expose signed radial clearance and optional lead-in chamfer. Do not hardcode a universal press fit: material, printer, shrinkage and orientation require calibration coupons. Export cushion and inserts as separate labeled parts with an assembly preview.

**Proposed tests:** narrow strokes, neighboring pockets, floating dots, ring ligament thickness, maximum puff curvature, wall/floor minima, independent closed shells, and a printed fit ladder before selecting defaults.

## Charm Maker

**Confirmed metadata:** `Di08Zc4b.js`, object `J`, ID `charmMaker`; missing definition `DGzBXz-F.js`. Art-gallery artwork becomes a cord/chain charm with stacked or side-by-side colors. Update note advertises selecting parts, shift multi-selection, and dragging a height/layer-depth arrow. Pro and subscriber-only flags.

**Proposed inputs:** user-owned vector or raster artwork, physical width, color segmentation, layer mode, per-part thickness, base margin, and cord-hole axis/diameter/location.

**Proposed algorithm:** raster input uses palette segmentation and contour tracing, followed by controlled simplification and topology repair; vectors follow a sanitized path pipeline. Resolve color regions into a planar partition. In stacked mode use explicit Z intervals; in side-by-side mode extrude disjoint regions within one common layer. Union a backing silhouette if loose islands require support. Subtract an oriented cylindrical hole from every intersected solid, extending the cutter beyond the assembly bounds. Provide minimum ligament diagnostics rather than silently moving the hole.

**Proposed tests:** zero base offset, transparent holes, touching color regions, nested contours, horizontal/vertical cord holes through the whole model, multi-selection height edits, and material grouping after export.

## Layered Monogram

**Confirmed metadata:** `Di08Zc4b.js`, object `$`, ID `layeredMonogram`; missing definition `D1t4z5Wr.js`. A large initial with a full name beside it on one layered keychain; subscriber-only flag. Precise placement, fonts, and connector design are **Unavailable**.

**Proposed inputs:** initial, full name, two licensed fonts, relative placement, layer heights, backing offset, and ring location.

**Proposed algorithm:** normalize both text outlines to physical heights, place the full name beside or overlapping the initial, and build a connected offset backing from their silhouette union. Detect disconnected components and require an explicit bridge or increased backing margin. Partition layers before extrusion; support either raised name geometry or flush inlays. Add a ring tab with a planar union and subtract its hole before extrusion to avoid intersecting primitive shells.

**Proposed tests:** narrow initial I, wide W, counters in B, detached script marks, empty text, large name-to-initial ratios, connectivity of backing and ring, and no unwanted cross-material overlap.

## 3D Model Decal

**Confirmed metadata:** `Di08Zc4b.js`, object `Q`, ID `decal3d`; missing definition `oUmszuFA.js`. Describes text/icons/gallery artwork on a flat face of a user STL/3MF, extruded or inlaid. Update note claims corrected orientation of turned pieces and artwork layout/gallery selection. Pro and subscriber-only flags. Arbitrary curved-surface wrapping is not advertised here.

**Proposed inputs:** local STL/3MF, chosen planar face, artwork, width, planar offset/rotation, emboss or inlay depth, and material.

**Proposed algorithm:** parse models with resource/triangle limits; preserve original units and scene transforms. Group adjacent coplanar triangles by normal and plane-distance tolerances. Build a right-handed local basis `(u,v,n)` satisfying `u×v=n`; map artwork as `p = origin + x*u + y*v + z*n`. Clip artwork against the selected face region, including holes. For embossing, union with the target or create intentional material regions; for inlays, subtract a bounded-depth cutter then insert a matching closed solid. Reject nonmanifold inputs or unresolved Booleans with explicit diagnostics. Offer repair as an explicit, inspectable step; never silently claim that a failed Boolean was repaired.

**Proposed tests:** rotated and translated input components, reversed normals, mirrored imports, small face holes, artwork crossing an edge, multiple 3MF objects, negative or nonuniform transforms, and saved/reloaded orientation. Validate signed volume, handedness and world-space placement before and after export.

## Screw Top Container

**Confirmed metadata:** `Di08Zc4b.js`, object `Z`, ID `screwTopContainer`; missing definition `CuqQSxPi.js`. Round container and screw lid closing in about one turn; keychain/charm/small jar uses and lid text. Update note advertises clipping artwork to the flat top without shrinking and per-part emboss heights. Pro and subscriber-only flags. Thread profile, number of starts, pitch, and actual clearances are **Unavailable**.

**Proposed inputs:** outer diameter, cavity height, wall/floor thickness, lid thickness, thread pitch/profile, clearance, optional keyring, and lid artwork.

**Proposed algorithm:** construct concentric vessel/lid bodies and sweep a truncated thread profile around a helix `p(t)=(r*cos(t),r*sin(t),pitch*t/(2π))`. Use matching thread handedness with complementary male/female profiles and calibrated radial/axial clearance. Choose engagement length and pitch to approach the desired closing rotation; a one-turn closure does not itself prove a multistart thread. Add entry chamfers, run-out, and a seating shoulder so tightening does not bottom unpredictably on thread tips. Clip lid artwork to the flat top footprint at its authored scale. Generate thread geometry with adaptive chord error and use solid unions/subtractions with validated topology.

**Proposed tests:** clearance coupon pairs, full screw motion/collision sampling, minimum root walls, start/run-out continuity, closed lid alignment, unsupported overhangs, and no art beyond the top boundary. Physical fit and cycle testing are necessary; model watertightness does not imply a liquid-tight container.

## Letter Beads

**Confirmed metadata:** `Di08Zc4b.js`, object `N`, ID `letterBeads`; missing definition `2nF41W7N.js`. Rounded letter/number beads with cord holes; defaults A–Z and 0–9. Pro/subscriber flags; update note says anyone may design and exports come with Pro. Do not conflate editor and export entitlement.

**Proposed inputs:** glyph set, font, height, depth, rounding radius, cord-hole axis/diameter, and batch spacing.

**Proposed algorithm:** create each normalized glyph solid, round its perimeter with conservative offsets or a controlled bevel, and subtract a through-cylinder along the chosen cord axis. Reject characters with too little material around the bore rather than relying on bounding boxes. For detached dots, offer either an explicit connection or a separate-part warning. Keep a local origin and unique part name per bead; pack laid-flat parts onto a bed with a user-specified gap, without changing their physical scale.

**Proposed tests:** all selected glyphs, 0/O/B/8 counters, narrow I/1, non-Latin missing glyph handling, drill/bore clearance, component count, consistent batch heights, and 3MF per-bead identity.

## Image to Clicker

**Confirmed metadata:** `Di08Zc4b.js`, object `g`, ID `imageToClicker`; missing definition `_mbw_tyt.js`. Artwork becomes a shaped hollow base and matching multicolor keycap. Update note advertises gap filling to remove deep notches/slivers, part-height arrows, exploded view, and a see-through preview. Pro and subscriber-only flags. Switch model, mount dimensions, travel, and mechanical tolerances are **Unavailable**.

**Proposed inputs:** user artwork, outline size, gap-fill radius, wall thickness, keycap skin, colors, and an explicit mechanical switch specification supplied by the hardware manufacturer or measured by the user.

**Proposed algorithm:** contour the artwork and apply a controlled morphological closing (outward then inward offset) to remove narrow notches, previewing the changed silhouette. Construct a hollow base by subtracting an inward-offset cavity while keeping wall/floor minima. Add mount features from the independently specified switch interface. Create a matching cap with travel clearance, a constrained stem mount, and color regions partitioned into closed solids. Check collisions over the intended travel range. Exploded and translucent previews must operate on presentation transforms/materials only.

**Proposed tests:** deep notches, disconnected raster islands, very small color regions, switches near the outline, cap/base clearance over full travel, switch retention and stem fit coupons, and identical assembled export geometry regardless of preview mode.

## Suggested implementation order

**Proposed:** First establish contour normalization, dimension-aware extrusion, transform-safe exports, and validation fixtures. Then implement Layered Monogram and Phone Grip Topper as tests of shared typography/layout; Charm Maker adds artwork partitioning; Letter Beads adds oriented bores; Puffy Letter Keychain adds curved surfaces and fit calibration. Defer 3D Model Decal until imported-mesh Booleans are reliable, and mechanical containers/clickers until physical interface specifications and fit-testing are available. These are proposals for a later approved implementation phase, not changes made by this research task.
