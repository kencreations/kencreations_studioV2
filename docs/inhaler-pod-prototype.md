# Katinko Inhaler Pod — provisional prototype

This is an initial parametric prototype, not a measured Katinko preset or a physically validated product. The original inhaler's closure stays intact. No pickup socket is generated; template inputs cannot enable it or mark dimensions verified.

## Mechanism and assembly

1. Insert the complete, originally capped inhaler into the housing.
2. Slide the separate closed loop over the exposed neck. Three tangential internal spring arms pass the lead-in bead and seat in the housing groove. A lower shoulder and upper bead capture the loop independently of the cap.
3. Screw the rounded outer cap onto the printed housing's single-start right-hand thread.

Opening removes the printed cap only. Lift out the inhaler by hand using its exposed gripping section, without twisting its original closure. Automatic cap-plus-inhaler withdrawal shown in the reference remains deferred until a pickup interface can be measured and tested. There is no contact intended between the printed cap and the original closure.

The outer ring remains closed; this is not a split collar. Its three flexible arms are a provisional snap-retention design. Geometric capture is not a strength or durability rating. The housing groove, arm thickness, and clearance are configurable. A rigid ring captured by a separate screwed retainer is an alternative if fatigue tests fail, but requires a fourth part and another assembly operation. A keyed bayonet ring would require a positive anti-rotation lock to avoid accidental release. Neither alternative is silently substituted for the approved three-part assembly.

## Provisional inputs (mm)

| Parameter | Default | Meaning |
|---|---:|---|
| Capped inhaler diameter | 16 | Unmeasured maximum cylindrical envelope |
| Capped inhaler length | 65 | Unmeasured complete envelope |
| Exposed gripping length | 12 | Portion above housing rim |
| Cavity radial clearance | 0.35 | Added on each side |
| Axial headspace | 1 | Above inhaler envelope |
| Neck/cap wall | 2 | Nominal wall |
| Bottom/cap roof | 2 | Nominal thickness |
| Thread pitch / engagement | 5 | One nominal revolution, with faded thread ends |
| Thread radial clearance | 0.3 | Prototype clearance |
| Loop groove clearance | 0.25 | Retention-arm clearance |
| Arm radial thickness | 1.2 | Flexible arms, untested |
| Keychain hole diameter | 4.5 | Through-hole |

Body cavity, headspace, mating helix and placement are derived from the same dimensions. The cap's skirt clears the retention bead and stops above the loop. Engraved/embossed cap lettering is limited to the flat top surface. Engraving preserves at least 0.8 mm of roof. Independent body, cap, loop and text colors are available; STL has no color, while 3MF carries surface colors (not a printer-specific filament assignment).

## Printing and fit testing

Exports always place separate components on Z=0: housing upright, cap exterior top down with its opening upward, loop flat. Assembled/exploded preview and the translucent reference never change export layout. Embossed lettering on the downward-facing cap may need support; use plain or engraved text for initial fit tests. Rounded shoulders, thread flanks and the retaining bead must be checked in the target slicer for overhangs and local support needs.

Start with the short housing-neck/cap/loop fit kit. Check thread insertion and release torque, clearance through the loop, arm deflection during installation, full seating, and pull-off force with the cap absent. Repeat opening cycles and apply off-axis chain loads. Inspect arm roots, lug and bead for whitening, cracking or permanent deformation. Test more than one print and orientation/material setting before accepting the mechanism. The model is not approved to secure valuables.

Then print the full housing and test insertion/removal with the actual closed inhaler. Verify clearance at its label, closure, bottom details and widest section, and verify that hand removal does not loosen the original cap. Only after that should a separately replaceable pickup interface be prototyped.

## Measurements still needed

- Exact inhaler variant and complete length with its original closure installed.
- Maximum diameter at several heights, including label seams, ribs and any protrusions; ovality across axes.
- Original closure outside diameter, height, grip details, opening direction and torque; location of its separation line.
- Safe gripping/extraction section and required exposed length, without pulling on or loosening the original closure.
- Bottom shape and any projecting features; desired insertion/removal force.
- Actual keyring/chain wire diameter and intended carrying load.
- Printer, nozzle, material and measured clearance/deflection behavior from printed coupons.

## Integration and verification

The dedicated editor uses the existing EditorLayout, EditorCanvas, history, template, font and guarded export architecture. A local registry entry and protected route are added. Existing generators, access policy and Firebase records are not changed by this implementation.

The live Firestore catalog replaces the local catalog and does not yet contain this generator. The normal route currently encounters the existing access guard. Publishing an appropriate catalog entry is a separate deployment step; end-to-end licensed editor/export UI testing remains pending. The isolated `tests/fixtures/inhaler-pod-preview.html` fixture previews geometry without connecting to Firebase or licensing.

Verification performed:

- 13 dedicated Node tests pass: default/minimum/maximum configurations, short fit kit, embossed and engraved geometry, independent loop capture, cap opening path, selected-part exports, exploded placement, and forced unverified/pickup-disabled state.
- Each generated part is a single connected manifold solid with positive volume and no zero-area triangles.
- Installed cap/body and loop/body clear; lifting the loop intersects the retaining bead. Sampled screw-opening positions clear the housing within numerical tolerance.
- Serialized STL reimports as three solids; extracted 3MF geometry reimports as three manifold solids with millimetre units and surface colors. Preview-mode exports are identical and exclude the reference.
- Full `npm test`, production `npm run build`, and scoped ESLint complete successfully.
- Actual provisional kit, body, cap, loop and fit-test STL/3MF samples are saved outside the repository in this chat's `inhaler-pod` visualization folder.
- Assembled and exploded geometry inspected in the isolated browser fixture. No physical prints, load tests, slicer toolpaths or real-inhaler fit tests have been performed.

## Files added or changed for this feature

- `src/data/inhalerPodDefaults.js`
- `src/utils/inhalerPodGeometry.js`
- `src/components/3D/InhalerPodMesh.jsx`
- `src/pages/KatinkoInhalerPodEditor.jsx`
- `src/App.jsx` — dedicated protected route/import only
- `src/data/editors.js` — provisional Coming Soon registry entry only
- `tests/inhalerPod.test.js`
- `tests/fixtures/inhaler-pod-preview.html`
- `docs/inhaler-pod-prototype.md`

Other pre-existing workspace changes are outside this feature.
