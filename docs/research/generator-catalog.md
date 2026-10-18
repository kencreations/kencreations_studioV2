# Generator catalog

**Confirmed:** Acorn parsed `audit-artifacts/pixnprints-input/chunks/Di08Zc4b.js` as an ES module and resolved the 54 identifiers in registry array `i` (export alias `D`) to 54 object declarations with distinct IDs. This does not execute the captured bundle. All objects are on source line 2; exact one-based columns below disambiguate them.

**Unavailable:** No authenticated editor was opened during this audit. Category A therefore has zero independently verified entries. The user reports that Name Keychain opens with a free account; this is recorded as user-supplied context, not a runtime finding. Absence of an access field does not establish free access.

**Confirmed:** 14 entries explicitly advertise Pro and/or subscriber restrictions (Category B); 40 are Category C pending access verification. Two Category C entries advertise coming soon. Letter Beads has conflicting levels of detail: flags indicate Pro/subscriber restriction, while its update note explicitly says anyone can design and Pro includes exports. Treat this as an advertised export restriction; editor access is unverified. Puffy Letter Keychain is not marked restricted in this capture.

**Confirmed:** None of the 54 direct dynamic definition-module imports is present in the supplied chunk directory. Catalog metadata is available; generator implementations are not recovered by these references. Static imports for the catalog itself and transitive dependency maps are covered by dependency-graph.md.

**Confirmed:** `DDp_pUQ9.js:1`, functions `n` and `f`, derive URL paths from catalog titles using `DR0tZGP-.js:1` function `r`: lowercase, replace runs of non-ASCII-alphanumeric characters with a hyphen, trim edge hyphens. **Inferred static routes:** each path below applies that observed resolver rule; none was live verified here. `/name-keychain` is additionally supported by the supplied HTML. Resolver aliases include `/chunky-charm` → `iconCharm`, `/qr-code-keychain` → `qrCodeMaker`, `/print-in-place-box` → `snapFitBox`, and `/character-fidget-clicker` → `imageToClicker`. Preview URLs below are source strings, not evidence that those images were retrieved or inspected. Advertised controls below consist only of descriptions and update notes, not confirmed editor widgets or bounds.

Complete machine-readable literal metadata, including dependency-map expressions, is in [generator-catalog-data.json](generator-catalog-data.json).

## 1. Name Coin Bank

- **Confirmed source:** `Di08Zc4b.js:2:43`, object `r`; ID `nameCoinBank`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{"comingSoon":false}` (empty means unspecified).
- **Advertised description:** Chunky name-shaped coin bank with a hollow body, drop-in front plate, coin slot and twist-lock cap.
- **Advertised controls/change note:** New Flat bottom slider: raise it to cut the base lower so letters that float because of the font shape sit flat.
- **Inferred static route:** `/name-coin-bank` (resolver-derived; not live verified).
- **Definition reference:** `./4L5Wywzv.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/name-coin-bank.png`; alt text: Name Coin Bank preview. OG: `/images/og/name-coin-bank.jpg`.

## 2. Classic Coin Bank

- **Confirmed source:** `Di08Zc4b.js:2:755`, object `n`; ID `personalizedCoinBank`.
- **Classification:** B — advertised access restriction.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro"}` (empty means unspecified).
- **Advertised description:** Ready-made coin bank with your text on the front: embossed, as puzzle inserts, or inlaid for multicolor.
- **Advertised controls/change note:** New: turn off the access cap for a sealed bank, and pick from six colour presets. The front plate no longer shows dark smudges.
- **Inferred static route:** `/classic-coin-bank` (resolver-derived; not live verified).
- **Definition reference:** `./C0Fxf5N9.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/classic-coin-bank.png`; alt text: Classic Coin Bank preview.

## 3. Name Fidget Clicker

- **Confirmed source:** `Di08Zc4b.js:2:1470`, object `s`; ID `fidgetClicker`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Text-shaped mechanical clicker — thick silhouette base and keycap, molded or shell, optional keyring.
- **Advertised controls/change note:** Up to 3 lines of text — each line has its own font, size, justify and colour, and the clicker outline wraps them all.
- **Inferred static route:** `/name-fidget-clicker` (resolver-derived; not live verified).
- **Definition reference:** `./BhQR1nAL.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/name-fidget-clicker.png`; alt text: Name Fidget Clicker preview. OG: `/images/og/name-fidget-clicker.jpg`.

## 4. Image to Clicker

- **Confirmed source:** `Di08Zc4b.js:2:2214`, object `g`; ID `imageToClicker`.
- **Classification:** B — advertised access restriction.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro","subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Turn a character from your Art gallery into a mechanical clicker: a hollow base shaped like it and a matching multicolor keycap.
- **Advertised controls/change note:** Smoother outlines: Fill gaps closes deep notches between letters, so the keycap and base have no thin slivers. Click a colour part to drag its height arrow, now in the exploded view too, with a live see-through preview.
- **Inferred static route:** `/image-to-clicker` (resolver-derived; not live verified).
- **Definition reference:** `./_mbw_tyt.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/image-to-clicker.png`; alt text: Image to Clicker preview. OG: `/images/og/image-to-clicker.jpg`.

## 5. Name Desk Standee

- **Confirmed source:** `Di08Zc4b.js:2:3127`, object `l`; ID `nameDeskStandee`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Multi-line desk name with a solid stand bar; optional outline.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/name-desk-standee` (resolver-derived; not live verified).
- **Definition reference:** `./VL4ABEE-.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/name-desk-standee.png`; alt text: Name Desk Standee preview. OG: `/images/og/name-desk-standee.jpg`.

## 6. Sweeping Name Standee

- **Confirmed source:** `Di08Zc4b.js:2:3656`, object `c`; ID `sweepingNameStandee`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Name text swept along an arc into a self-standing curved wedge with a name-shaped foot.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/sweeping-name-standee` (resolver-derived; not live verified).
- **Definition reference:** `./BDp6mqH6.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/sweeping-name-standee.png`; alt text: Sweeping Name Standee preview. OG: `/images/og/sweeping-name-standee.jpg`.

## 7. Letter Rail

- **Confirmed source:** `Di08Zc4b.js:2:4237`, object `d`; ID `letterRail`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Big initial with your name running across it — placement tuned for every letter A–Z.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/letter-rail` (resolver-derived; not live verified).
- **Definition reference:** `./DhMDeRS4.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/letter-rail.png`; alt text: Letter Rail preview. OG: `/images/og/letter-rail.jpg`.

## 8. Text Blocks

- **Confirmed source:** `Di08Zc4b.js:2:4787`, object `m`; ID `textBlocks`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Stacked blocks with a different letter on each side; spin them to spell names or words.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/text-blocks` (resolver-derived; not live verified).
- **Definition reference:** `./CiqLHj2R.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/text-blocks.png`; alt text: Text Blocks preview. OG: `/images/og/text-blocks.jpg`.

## 9. Flexi Name Keychain

- **Confirmed source:** `Di08Zc4b.js:2:5315`, object `p`; ID `articulated`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Flexible keychain where each letter of your name links together.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/flexi-name-keychain` (resolver-derived; not live verified).
- **Definition reference:** `./D8EuboZH.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/flexi-name-keychain.png`; alt text: Flexi Name Keychain preview. OG: `/images/og/flexi-name-keychain.jpg`.

## 10. Multicolor Whistle

- **Confirmed source:** `Di08Zc4b.js:2:5859`, object `h`; ID `multicolorWhistle`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `whistles`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Working whistle in up to three colors, with your name on top.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/multicolor-whistle` (resolver-derived; not live verified).
- **Definition reference:** `./CmWWKdn6.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/multicolor-whistle.png`; alt text: Multicolor Whistle Keychain preview.

## 11. Whistle Bag Tag

- **Confirmed source:** `Di08Zc4b.js:2:6377`, object `u`; ID `whistleBagTag`.
- **Classification:** B — advertised access restriction.
- **Category:** `whistles`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Whistle bag tag with your name — great for backpacks and luggage.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/whistle-bag-tag` (resolver-derived; not live verified).
- **Definition reference:** `./C5LF4Xkq.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/whistle-bag-tag.png`; alt text: Whistle Bag Tag preview. OG: `/images/og/whistle-bag-tag.jpg`.

## 12. Name Keychain

- **Confirmed source:** `Di08Zc4b.js:2:6986`, object `y`; ID `standaloneName`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Your name or words as a keychain, with optional border, text outline and keyring.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/name-keychain` (resolver-derived; not live verified).
- **Definition reference:** `./DO7EAprE.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/name-keychain.png`; alt text: Name Keychain preview. OG: `/images/og/name-keychain.jpg`.

## 13. QR Code Maker

- **Confirmed source:** `Di08Zc4b.js:2:7541`, object `w`; ID `qrCodeMaker`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Scannable QR keychain for a link, message, Wi‑Fi, or contact info.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/qr-code-maker` (resolver-derived; not live verified).
- **Definition reference:** `./Bh_rebx7.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/qr-code-maker.png`; alt text: QR Code Maker preview. OG: `/images/og/qr-code-maker.jpg`.

## 14. Spotify Code Keychain

- **Confirmed source:** `Di08Zc4b.js:2:8073`, object `_`; ID `spotifyCode`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Paste a Spotify link and get a scannable song code keychain.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/spotify-code-keychain` (resolver-derived; not live verified).
- **Definition reference:** `./D8NOSleC.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/spotify-code-keychain.png`; alt text: Spotify Code Keychain preview.

## 15. Freeform Design Canvas

- **Confirmed source:** `Di08Zc4b.js:2:8560`, object `k`; ID `freeformDesignCanvas`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Arrange text and shapes on a canvas, then turn it into a 3D print.
- **Advertised controls/change note:** Heads up: this designer will be retired soon, replaced by Artwork Maker (lay out text, shapes and art) and the upcoming Artwork to 3D designer. Export anything you want to keep.
- **Inferred static route:** `/freeform-design-canvas` (resolver-derived; not live verified).
- **Definition reference:** `./Ce-JR0R_.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/freeform-design-canvas.png`; alt text: Freeform Design Canvas preview. OG: `/images/og/freeform-design-canvas.jpg`.

## 16. Motorcycle Plate Bar

- **Confirmed source:** `Di08Zc4b.js:2:9379`, object `f`; ID `motorcyclePlateBar`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Custom bar accessory for motorcycle plates — add your text.
- **Advertised controls/change note:** Faster with decorative fonts like Kablammo, and reloading on the layout no longer shows a half-drawn bar first.
- **Inferred static route:** `/motorcycle-plate-bar` (resolver-derived; not live verified).
- **Definition reference:** `./63IsgDwW.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/motorcycle-plate-bar.png`; alt text: Motorcycle Plate Bar preview. OG: `/images/og/motorcycle-plate-bar.jpg`.

## 17. Cake Topper

- **Confirmed source:** `Di08Zc4b.js:2:10076`, object `v`; ID `cakeTopper`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `toppers`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Birthday topper with your message — pick one or two sticks.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/cake-topper` (resolver-derived; not live verified).
- **Definition reference:** `./BG69-bn6.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/cake-topper.png`; alt text: Cake Topper preview. OG: `/images/og/cake-topper.jpg`.

## 18. Wavy ID Badge

- **Confirmed source:** `Di08Zc4b.js:2:10566`, object `b`; ID `idNameTag`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `nameTags`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Badge-style name tag you can customize with text and colors.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/wavy-id-badge` (resolver-derived; not live verified).
- **Definition reference:** `./CZG2Eqy7.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/wavy-id-badge.png`; alt text: Wavy ID Badge preview. OG: `/images/og/wavy-id-badge.jpg`.

## 19. Shaped ID Tag

- **Confirmed source:** `Di08Zc4b.js:2:11076`, object `I`; ID `idNameTagV2`.
- **Classification:** B — advertised access restriction.
- **Category:** `nameTags`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Pick a ready-made tag shape, then add your name and colors.
- **Advertised controls/change note:** New default colorways (Creamberry, Sky Peach, Matcha Rose and more) with separate border, nickname and full-name colors.
- **Inferred static route:** `/shaped-id-tag` (resolver-derived; not live verified).
- **Definition reference:** `./C1zDlYGX.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/shaped-id-tag.png`; alt text: Shaped ID Tag preview. OG: `/images/og/shaped-id-tag.jpg`.

## 20. Classic Name Tag

- **Confirmed source:** `Di08Zc4b.js:2:11761`, object `A`; ID `classicNameTag`.
- **Classification:** B — advertised access restriction.
- **Category:** `nameTags`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Flat name tag with multiple text lines, alignment, hole styles and optional icons.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/classic-name-tag` (resolver-derived; not live verified).
- **Definition reference:** `./BACk-XZG.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/classic-name-tag.png`; alt text: Classic Name Tag preview. OG: `/images/og/classic-name-tag.jpg`.

## 21. Address Number Sign

- **Confirmed source:** `Di08Zc4b.js:2:12454`, object `T`; ID `addressNumberSign`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** House or unit number sign with optional frame and screw holes.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/address-number-sign` (resolver-derived; not live verified).
- **Definition reference:** `./NIrc_dzj.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/address-number-sign.png`; alt text: Address Number Sign preview. OG: `/images/og/address-number-sign.jpg`.

## 22. Door Name Plaque

- **Confirmed source:** `Di08Zc4b.js:2:13006`, object `E`; ID `doorNamePlaque`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Decorative door or room sign with raised name and fancy border.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/door-name-plaque` (resolver-derived; not live verified).
- **Definition reference:** `./3BxCUslp.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/door-name-plaque.png`; alt text: Door Name Plaque preview. OG: `/images/og/door-name-plaque.jpg`.

## 23. Letter Keycap Set

- **Confirmed source:** `Di08Zc4b.js:2:13583`, object `P`; ID `keycapSetMaker`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Type custom letters and symbols for a full keyboard keycap set.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/letter-keycap-set` (resolver-derived; not live verified).
- **Definition reference:** `./ZhIatps1.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/letter-keycap-set.png`; alt text: Letter Keycap Set preview. OG: `/images/og/letter-keycap-set.jpg`.

## 24. Letter Beads

- **Confirmed source:** `Di08Zc4b.js:2:14110`, object `N`; ID `letterBeads`.
- **Classification:** B — advertised access restriction.
- **Category:** `others`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro","subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Chunky rounded beads for each letter or number with a cord hole — defaults to A–Z and 0–9.
- **Advertised controls/change note:** Letter Beads is now a Pro designer: anyone can design with it, and exports come with Pro.
- **Inferred static route:** `/letter-beads` (resolver-derived; not live verified).
- **Definition reference:** `./2nF41W7N.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/letter-beads.png`; alt text: Letter Beads preview. OG: `/images/og/letter-beads.jpg`.

## 25. Engraved Name Tag

- **Confirmed source:** `Di08Zc4b.js:2:14884`, object `D`; ID `engraveNamePlate`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `nameTags`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Raised border with recessed name — fill in color on a second piece.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/engraved-name-tag` (resolver-derived; not live verified).
- **Definition reference:** `./gcXI_add.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/engraved-name-tag.png`; alt text: Engraved Name Tag preview. OG: `/images/og/engraved-name-tag.jpg`.

## 26. Bumpy Text

- **Confirmed source:** `Di08Zc4b.js:2:15447`, object `C`; ID `bumpyText`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Fun 3D name where each letter sticks out a different height.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/bumpy-text` (resolver-derived; not live verified).
- **Definition reference:** `./C9M-o-Wj.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/bumpy-text.png`; alt text: Bumpy Text preview. OG: `/images/og/bumpy-text.jpg`.

## 27. Ribbon Bow

- **Confirmed source:** `Di08Zc4b.js:2:15998`, object `R`; ID `ribbonBow`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Bow-shaped keychain with your name — sweet for bags and keys.
- **Advertised controls/change note:** New: move the name anywhere on the bow with the Pos X and Pos Y sliders.
- **Inferred static route:** `/ribbon-bow` (resolver-derived; not live verified).
- **Definition reference:** `./DtTJmE7Z.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/ribbon-bow.png`; alt text: Ribbon Bow preview. OG: `/images/og/ribbon-bow.jpg`.

## 28. Pickleball Paddle

- **Confirmed source:** `Di08Zc4b.js:2:16663`, object `O`; ID `pickleballPaddle`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Paddle-shaped keychain with an icon of your choice on the face, in two colors.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/pickleball-paddle` (resolver-derived; not live verified).
- **Definition reference:** `./BUS6wQA_.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/pickleball-paddle.png`; alt text: Pickleball Paddle preview. OG: `/images/og/pickleball-paddle.jpg`.

## 29. Pickleball Paddle End Cap

- **Confirmed source:** `Di08Zc4b.js:2:17235`, object `L`; ID `pickleballPaddleEndCap`.
- **Classification:** B — advertised access restriction.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Custom circular paddle end cap with adjustable size, raised border, and curved text.
- **Advertised controls/change note:** The face is now artwork: lay out text, icons, shapes and gallery art in Artwork Maker (kept inside the border, which the editor shows), then give each colour its own raised height and colour. Older designs open with their text and icons as artwork.
- **Inferred static route:** `/pickleball-paddle-end-cap` (resolver-derived; not live verified).
- **Definition reference:** `./C__Za_ab.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/pickleball-paddle-end-cap.png`; alt text: Pickleball Paddle End Cap preview. OG: `/images/og/pickleball-paddle-end-cap.jpg`.

## 30. Round Badge & Chip

- **Confirmed source:** `Di08Zc4b.js:2:18294`, object `V`; ID `badgeChip`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `nameTags`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Round badge or chip with adjustable size, raised border, curved text, and an optional keyring hole.
- **Advertised controls/change note:** The face is now artwork: lay out text, icons, shapes and gallery art in Artwork Maker (kept inside the border, which the editor shows), then give each colour its own raised height and colour. Older designs open with their text and icons as artwork.
- **Inferred static route:** `/round-badge-chip` (resolver-derived; not live verified).
- **Definition reference:** `./C0P97cvm.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/round-badge-chip.png`; alt text: Round Badge & Chip preview. OG: `/images/og/round-badge-chip.jpg`.

## 31. Instagram Tag

- **Confirmed source:** `Di08Zc4b.js:2:19282`, object `x`; ID `instagramTag`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":false}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Capsule keychain with Instagram logo and @username — auto-fit width, two colors, left keyring.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/instagram-tag` (resolver-derived; not live verified).
- **Definition reference:** `./Dw8Yleml.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/instagram-tag.png`; alt text: Instagram Tag keychain preview.

## 32. Basketball Hoop Tag

- **Confirmed source:** `Di08Zc4b.js:2:19796`, object `j`; ID `hoopTag`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Mini basketball hoop keychain with your name and team colors.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/basketball-hoop-tag` (resolver-derived; not live verified).
- **Definition reference:** `./BzNc3m45.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/basketball-hoop-tag.png`; alt text: Basketball Hoop Tag keychain preview. OG: `/images/og/basketball-hoop-tag.jpg`.

## 33. Name Puzzle

- **Confirmed source:** `Di08Zc4b.js:2:20336`, object `B`; ID `namePuzzle`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Letters pop in and out of a board — kids spell the name as they play.
- **Advertised controls/change note:** Exported boards now have the same corner rounding as the preview, including with very round corners.
- **Inferred static route:** `/name-puzzle` (resolver-derived; not live verified).
- **Definition reference:** `./ZMaXh1jd.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/name-puzzle.png`; alt text: Name Puzzle preview. OG: `/images/og/name-puzzle.jpg`.

## 34. Layered Monogram

- **Confirmed source:** `Di08Zc4b.js:2:21015`, object `$`; ID `layeredMonogram`.
- **Classification:** B — advertised access restriction.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Big initial with your full name beside it on one layered keychain.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/layered-monogram` (resolver-derived; not live verified).
- **Definition reference:** `./D1t4z5Wr.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/layered-monogram.png`; alt text: Layered Monogram preview. OG: `/images/og/layered-monogram.jpg`.

## 35. Monogram Insert

- **Confirmed source:** `Di08Zc4b.js:2:21632`, object `S`; ID `monogramInsert`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Large initial with a name piece that presses into it, for a clean two-color print.
- **Advertised controls/change note:** The 3D preview shows the initial cleanly: no more dark, shiny streaks on its flat faces.
- **Inferred static route:** `/monogram-insert` (resolver-derived; not live verified).
- **Definition reference:** `./bU72lt6U.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/monogram-insert.png`; alt text: Monogram Insert preview. OG: `/images/og/monogram-insert.jpg`.

## 36. Floral Initial

- **Confirmed source:** `Di08Zc4b.js:2:22277`, object `M`; ID `floralInitial`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Flower-shaped keychain with your initial in the center.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/floral-initial` (resolver-derived; not live verified).
- **Definition reference:** `./DvAhGOZV.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/floral-initial.png`; alt text: Flower & Initial preview. OG: `/images/og/floral-initial.jpg`.

## 37. Pet ID Tag

- **Confirmed source:** `Di08Zc4b.js:2:22879`, object `z`; ID `dogtag`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `nameTags`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Classic pet tag shape — add your dog or cat's name.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/pet-id-tag` (resolver-derived; not live verified).
- **Definition reference:** `./Bp-UJOVd.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/pet-id-tag.png`; alt text: Pet ID Tag preview. OG: `/images/og/pet-id-tag.jpg`.

## 38. Icon Charm

- **Confirmed source:** `Di08Zc4b.js:2:23435`, object `K`; ID `iconCharm`.
- **Classification:** B — advertised access restriction.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Pick an icon and turn it into a thick charm for cord or chain.
- **Advertised controls/change note:** Exports now work with a base offset of 0, and the cord hole always runs through the whole charm, also on large charms and in the vertical direction.
- **Inferred static route:** `/icon-charm` (resolver-derived; not live verified).
- **Definition reference:** `./CMxh42lq.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/icon-charm.png`; alt text: Icon Charm preview. OG: `/images/og/icon-charm.jpg`.

## 39. Icon Keycap

- **Confirmed source:** `Di08Zc4b.js:2:24139`, object `F`; ID `keycapMaker`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Add a small icon or logo on top of a single keycap.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/icon-keycap` (resolver-derived; not live verified).
- **Definition reference:** `./BRgP76n8.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/icon-keycap.png`; alt text: Icon Keycap preview. OG: `/images/og/icon-keycap.jpg`.

## 40. Basic Whistle

- **Confirmed source:** `Di08Zc4b.js:2:24672`, object `W`; ID `basicWhistle`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `whistles`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Simple working whistle keychain personalized with your name.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/basic-whistle` (resolver-derived; not live verified).
- **Definition reference:** `./p9uuFBTs.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/basic-whistle.png`; alt text: Basic Whistle preview. OG: `/images/og/basic-whistle.jpg`.

## 41. Straw Name Clip

- **Confirmed source:** `Di08Zc4b.js:2:25245`, object `q`; ID `strawNameClip`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `toppers`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Clips onto a straw so everyone knows whose drink is whose.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/straw-name-clip` (resolver-derived; not live verified).
- **Definition reference:** `./BmF_S1Ba.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/straw-name-clip.png`; alt text: Straw Name Clip preview. OG: `/images/og/straw-name-clip.jpg`.

## 42. Pencil Name Sleeve

- **Confirmed source:** `Di08Zc4b.js:2:25854`, object `G`; ID `pencilNameSleeve`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `toppers`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Name sleeve that slides onto a pencil for school or gifts.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/pencil-name-sleeve` (resolver-derived; not live verified).
- **Definition reference:** `./DnN9FKUO.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/pencil-name-sleeve.png`; alt text: Pencil Name Sleeve preview. OG: `/images/og/pencil-name-sleeve.jpg`.

## 43. Puffy Letter Keychain

- **Confirmed source:** `Di08Zc4b.js:2:26484`, object `H`; ID `puffyLetterKeychain`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Puffy two-part name keychain: a balloon cushion with letter pockets and separate puffy letters that press in after printing.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/puffy-letter-keychain` (resolver-derived; not live verified).
- **Definition reference:** `./CzpiPjG3.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/puffy-letter-keychain.png`; alt text: Puffy Letter Keychain preview. OG: `/images/og/puffy-letter-keychain.jpg`.

## 44. Valorant Keychain

- **Confirmed source:** `Di08Zc4b.js:2:27113`, object `Y`; ID `valorantKeychain`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":false}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Valorant-inspired keychain with layered red border and logo over white text on a black base.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/valorant-keychain` (resolver-derived; not live verified).
- **Definition reference:** `./RPQLSzep.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/valorant-keychain.png`; alt text: Valorant Keychain preview.

## 45. 3D Model Decal

- **Confirmed source:** `Di08Zc4b.js:2:27624`, object `Q`; ID `decal3d`.
- **Classification:** B — advertised access restriction.
- **Category:** `others`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro","subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Put text, icons or your Art gallery artwork on a flat face of your own STL or 3MF model, extruded or inlaid in color.
- **Advertised controls/change note:** Turned pieces now come out turned the way the layout shows them (they were mirrored before). Lay out art with Artwork Maker in the layout step, or pick an Artwork Maker design from your gallery.
- **Inferred static route:** `/3d-model-decal` (resolver-derived; not live verified).
- **Definition reference:** `./oUmszuFA.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/3d-model-decal.png`; alt text: 3D Model Decal preview. OG: `/images/og/3d-model-decal.jpg`.

## 46. Charm Maker

- **Confirmed source:** `Di08Zc4b.js:2:28572`, object `J`; ID `charmMaker`.
- **Classification:** B — advertised access restriction.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro","subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Turn your Art gallery artwork into a thick charm for cord or chain, in stacked or side-by-side colors.
- **Advertised controls/change note:** Click colour parts in the preview to select them (shift-click for more) and drag the orange arrow to change their height or the layer depth.
- **Inferred static route:** `/charm-maker` (resolver-derived; not live verified).
- **Definition reference:** `./DGzBXz-F.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/charm-maker.png`; alt text: Charm Maker preview. OG: `/images/og/charm-maker.jpg`.

## 47. Trinket Tray Maker

- **Confirmed source:** `Di08Zc4b.js:2:30395`, object `U`; ID `trinketTrayMaker`.
- **Classification:** B — advertised access restriction.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro","subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** Turn your Art gallery artwork into a trinket tray: the artwork inlaid flush in the floor, with a wall that follows its outline.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/trinket-tray-maker` (resolver-derived; not live verified).
- **Definition reference:** `./BVLHid48.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/trinket-tray-maker.png`; alt text: Trinket Tray Maker preview. OG: `/images/og/trinket-tray-maker.jpg`.

## 48. Screw Top Container

- **Confirmed source:** `Di08Zc4b.js:2:29319`, object `Z`; ID `screwTopContainer`.
- **Classification:** B — advertised access restriction.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"tier":"pro","subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** A round container with a screw-on lid that closes in about one turn: a keychain pill box, a charm case or a small jar, with text on the lid.
- **Advertised controls/change note:** Lid artwork now prints at the size you lay it out on the whole lid (anything past the flat top is cut off, never shrunk). Click artwork parts in the preview or the parts list, and with Embossed drag the arrow to raise each part to its own height.
- **Inferred static route:** `/screw-top-container` (resolver-derived; not live verified).
- **Definition reference:** `./CuqQSxPi.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/screw-top-container.png`; alt text: Screw Top Container preview. OG: `/images/og/screw-top-container.jpg`.

## 49. Snap-Fit Box

- **Confirmed source:** `Di08Zc4b.js:2:31043`, object `X`; ID `snapFitBox`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true,"beta":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** A personalized storage box with a compact snap-together hinge. Print the body and lid separately; no hinge pin needed.
- **Advertised controls/change note:** Create lid artwork right in the designer with Artwork Maker, then insert it or save it to your gallery. The lid now closes flush, and lid art reads the right way up from the latch side.
- **Inferred static route:** `/snap-fit-box` (resolver-derived; not live verified).
- **Definition reference:** `./CW6pVYLx.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/snap-fit-box.png`; alt text: Rounded storage box with a teal lid, cream inlay, and integrated hinge.

## 50. Phone Grip Topper

- **Confirmed source:** `Di08Zc4b.js:2:31952`, object `ee`; ID `phoneGripTopper`.
- **Classification:** B — advertised access restriction.
- **Category:** `toppers`; catalog flags: `{"listed":true}`; access flags: `{"subscriberOnly":true}` (empty means unspecified).
- **Advertised description:** A name topper for a round phone grip: groovy lettering packed into the circle, printed as a flat multicolor topper.
- **Advertised controls/change note:** New Topper diameter slider: make the printed disc smaller than the grip top, and the art scales with it.
- **Inferred static route:** `/phone-grip-topper` (resolver-derived; not live verified).
- **Definition reference:** `./CI906wMx.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/phone-grip-topper.png`; alt text: Phone Grip Topper preview: chunky pink bubble lettering filling a round yellow topper. OG: `/images/og/phone-grip-topper.jpg`.

## 51. Christmas Ornament

- **Confirmed source:** `Di08Zc4b.js:2:32805`, object `ae`; ID `christmasOrnament`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `decor`; catalog flags: `{"listed":true}`; access flags: `{"comingSoon":true}` (empty means unspecified).
- **Advertised description:** Personalized round ornament in four holiday styles: a name on a nameplate with snowflakes, evergreen trees and an integrated hanging loop, in up to four colors.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/christmas-ornament` (resolver-derived; not live verified).
- **Definition reference:** `./BD197YRE.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/christmas-ornament.png`; alt text: Christmas Ornament preview: an ivory-framed round ornament with a red nameplate, green fields and ivory snowflakes.

## 52. Vial Case

- **Confirmed source:** `Di08Zc4b.js:2:33509`, object `te`; ID `vialCase`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true,"beta":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** A holder for your vials with one reversible snap-on shell: a protective cap over the vials, or flip it to make a stable base. Sized from your vial measurements, 1–24 vials.
- **Advertised controls/change note:** Cap artwork parts can now be selected in the preview, and embossed art can be pulled taller with the orange arrow, part by part.
- **Inferred static route:** `/vial-case` (resolver-derived; not live verified).
- **Definition reference:** `./DE4kjosk.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/vial-case.png`; alt text: Vial Case: a cream two-vial holder with glass vials and black caps, its purple snap-on shell lifted above. OG: `/images/og/vial-case.jpg`.

## 53. Stackable Basket

- **Confirmed source:** `Di08Zc4b.js:2:34492`, object `ie`; ID `stackableBasket`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `others`; catalog flags: `{"listed":true,"beta":true}`; access flags: `{}` (empty means unspecified).
- **Advertised description:** Create customizable stackable storage baskets and organizer trays with adjustable dimensions, shapes, textures, handles, and dividers.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/stackable-basket` (resolver-derived; not live verified).
- **Definition reference:** `./CXlVgM03.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/stackable-basket.png`; alt text: Stackable Basket preview: two sage-green fluted storage baskets stacked, with rounded handle slots, beside a folded towel and a small plant. OG: `/images/og/stackable-basket.jpg`.

## 54. Image to Keychain

- **Confirmed source:** `Di08Zc4b.js:2:35217`, object `oe`; ID `imageToKeychain`.
- **Classification:** C — access/functionality not independently verified.
- **Category:** `keychains`; catalog flags: `{"listed":true}`; access flags: `{"comingSoon":true}` (empty means unspecified).
- **Advertised description:** Turn your Art gallery artwork into an outlined keychain with a keyring tab you can move around the edge.
- **Advertised controls/change note:** No additional note in this object.
- **Inferred static route:** `/image-to-keychain` (resolver-derived; not live verified).
- **Definition reference:** `./DgSBIRiz.js` — missing from supplied chunks.
- **Preview reference:** `/images/catalog/image-to-keychain.png`; alt text: Image to Keychain preview. OG: `/images/og/image-to-keychain.jpg`.

