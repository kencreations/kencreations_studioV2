# Reference silhouette revision — 19 October 2026

This revision keeps three separate printed parts and the existing housing screw thread / independently captured loop. Pickup remains disabled, and the original inhaler closure is not replaced.

## Geometry changes

- Housing: increased the rounded lower shoulder from a small 2 mm edge treatment to a dimension-dependent radius up to 7 mm, retaining a flat printing foot and clearance around the cavity. Default exposed gripping length is now 8 mm, giving a taller 59 mm housing for the unchanged provisional 16 × 65 mm inhaler envelope.
- Loop: replaced the horizontal washer lug with a rounded downturned ribbon/tab and elongated through-slot. The closed neck ring and three internal retention arms remain one connected printed part. Its tab stays outside the housing; the cap is not needed to capture the ring.
- Cap: replaced the long straight side and flared bell skirt with an elliptical crown and curved lower edge. Its wider, continuous pebble silhouette surrounds the same mating thread and headspace. Lettering remains inside its flat crown patch. Large custom exposure settings necessarily create taller caps to preserve inhaler clearance.
- Preview: enabled the optional translucent inhaler envelope by default and differentiated its original closure. The generic closure illustration is a provisional visualization, not a measured replica. It remains inserted in the housing, is excluded from exports, and is not mechanically coupled to the printed cap.
- Exploded order: body at Z=0, loop raised above the housing by the full tab drop plus a 10 mm gap, cap above the loop by another 10 mm gap. This accounts for the whole part bounds, rather than merely separating part origins. Animated vertical transitions remain in place.
- Camera: framing is local to this generator and recomputed for part dimensions and assembled/exploded state.

## Printing and limitations

The loop now exports top-face down, with its downturned tab rising upward. Inspect the tab and slot overhangs in the slicer; supports may be required. Housing exports upright and cap exterior-top down. Preview transforms and the reference envelope never enter exported geometry. Embossed cap text may require support in this orientation.

The spring arms, tab roots, slot walls, screw fit and real inhaler clearance still require physical testing. Dimensions remain provisional. No pickup socket or automatic withdrawal is provided. The reference's cap-plus-inhaler withdrawal remains deferred under the earlier approval conditions.

## Verification

All 229 tests pass, including 14 dedicated pod tests. These cover connected manifold geometry, minimum/maximum settings, embossed and engraved text, kit/individual exports, STL and 3MF reimport, loop capture without the cap, sampled thread-opening clearance, complete exploded bounds and installed cap/loop/body collision checks at several settings. The production build and scoped lint also pass. The live developer-preview editor was inspected for assembled and exploded appearance. A pod-only minimum preview height at narrow widths prevents the toolbar from obscuring the model; other editors are unaffected.

## Files changed in this revision

- `src/utils/inhalerPodGeometry.js`
- `src/data/inhalerPodDefaults.js`
- `src/components/3D/InhalerPodMesh.jsx`
- `src/pages/KatinkoInhalerPodEditor.jsx`
- `tests/inhalerPod.test.js`
- `docs/inhaler-pod-reference-revision.md`

This revision supersedes the earlier report's 12 mm exposure default, small horizontal lug, flat-loop print orientation and catalog-access limitation. The current live account can open the existing developer-preview route; no access or catalog logic was changed in this revision.
