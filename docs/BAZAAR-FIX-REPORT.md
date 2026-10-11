# Bazaar Hub audit and fix report

Date: 2026-10-11. Scope: the two Bazaar attachments, including DIY clicker configuration, event loading, orders/stock/tracking and seller icon artwork. No customer records were modified and no service or rules were deployed. Existing unrelated repository changes were preserved.

## Confirmed defects and changes

| Severity | Evidence / root cause | Implemented change and affected files |
|---|---|---|
| High | Public product projection omitted product type and customization consumers disagreed about seller schema names. | `configuration.js` normalizes one schema; `bazaarService.js` preserves safe public type, variants and options; `ProductCustomizer.jsx` uses seller-configured slots, colors, styles, switches and accessories. |
| High | Event fetch depended on a callback tied to the event being fetched, causing repeated loading; legacy event URLs treated UID as a slug. | `CustomerStorefront.jsx` separates cart refresh from route loading and resolves shops by ID. Diagnostics distinguish missing, denied and timed-out reads. |
| High | Browser order submission read private data and performed separate order/tracking writes. Retries generated new keys. | `orderWorkflow.js` provides a trusted transaction core; `orderSubmissionService.js` is transport-only; `CustomerCheckout.jsx` persists retry identity and preserves cart until confirmed. Production checkout is disabled without its trusted endpoint. |
| High | Stock transitions could repeat, read after writes or miscount repeated components; allocation/global accounting disagreed. | Core aggregates BOM requirements, performs reads before writes, validates ownership/state, and updates balances, movements, order and tracking atomically. No automatic recovery of consumed stock. |
| High | Seller icons were stored as IDs but customer UI rendered `.emoji` / `.label` from incompatible objects. | `icons.js` supplies a shared legacy catalog; `IconArtwork.jsx` renders actual thumbnails or labeled failures; customizer, preview, cart and seller orders use it. |
| High | Icon slots shared letter color/style fields and invented color-based inventory identifiers. | Separate canonical letter/icon snapshots; icon pricing excludes stale letter color/style surcharges. `bom.js` uses explicit preprinted SKU or production components. Letter snapshots remove inactive icon metadata. |
| High | Ready-made BOM used `product.id` where private products use `productId`, allowing `finished_undefined`. | Validate IDs/SKUs, preserve valid legacy deterministic identifiers, support explicit variant inventory mapping, reject missing stock references before creating orders. Invalid legacy orders are marked for seller review; no automatic repair or stock creation. |
| Medium | Product master and public projection were saved separately, risking inconsistent published options. | `bazaarService.js` writes both in a single batch; safe projection replacement removes stale public fields. |
| Medium | No custom icon upload/storage pipeline existed. | `iconUpload.js` checks bytes/types and strictly filters SVG before PNG rasterization; `SellerIconLibrary.jsx` provides local previews and an API-backed library interface. Shared upload, rename/archive and persistence await a real backend. |
| Medium | Tracking polling could overlap; navigation could retain old ticket state. | Sequential polling with cleanup, explicit error states and state reset when the token changes. |

## Icon behavior and inventory

Customers select the seller's original artwork. Icon slots do not expose letter color/style controls; switching back to a letter restores the editor's letter choices. Canonical submissions discard inactive fields. Images retain aspect ratio/transparency; broken images show a labeled fallback. These are 2D artwork previews, not generated printable reliefs.

Custom artwork can be checked locally now. Uploading an image never increases stock. The library interface supports search, selection, rename/archive and explicit fulfillment data when connected. Built-in previews and ready-made variants have explicit inventory mapping inputs. A product-level `on_hand` field does not create or restock an authoritative inventory document.

Order creation verifies referenced inventory documents exist. Acceptance separately verifies sufficient shop/event stock. Existing invalid orders are retained. Seller reconciliation of legacy stock keys and event allocation balances is still required; there is no destructive migration.

## Validation

- Final full unit suite: **126 passed, 0 failed**, recorded in `audit-artifacts/bazaar-tests-final.txt`. The focused icon/workflow suite also passed **18/18**.
- Scoped lint passed for the Bazaar engine, services, new icon components, clicker preview/customizer, checkout, tracking and new unit tests.
- Repository-wide lint failed: **445 findings (420 errors, 25 warnings)** at the recorded checkpoint. Existing ProductManager/OrdersManager/CustomerCart files also have lint findings; do not interpret scoped success as a clean repository lint run.
- A full production build succeeded during this turn (12.50 seconds). The final rebuild was blocked again by intermittent Windows `EPERM` resolving `src/engine/workers/geometry.worker.ts` in the two worker hooks. Final source is not release-validated by that earlier build. Log: `audit-artifacts/bazaar-build.txt`.
- Browser QA not completed: Puppeteer Chromium launch failed with exit code 3221225506; Codex browser timed out opening the localhost fixture. No screenshots or mobile visual pass claimed.
- Firebase emulator/rules tests were prepared but not run. Earlier automatic approval review rejected the escalated emulator command because the review service hit a usage limit; no bypass was attempted. No live Firestore rules or customer data were used for testing.
- Fixtures cover repeated letters, per-slot pricing, BOM aggregation, duplicate/lost-response submission, rollback on tracking-write failure, transitions, cancellation, ownership, allocation, icon snapshots, archive handling, invalid inventory keys, URL filtering and active SVG rejection. Browser decoding/rasterization and actual uploads still need end-to-end testing.

## Firebase and release limitations

The owner confirmed there is **no backend yet**. `BAZAAR-BACKEND-CONTRACT.md` specifies the integration. Current core/tests are not a deployed order service. Checkout, fulfillment and shared upload require a trusted adapter and operational verification. A configured API URL alone is not evidence that an endpoint exists or is healthy.

`firestore.bazaar-candidate.rules` is a **proposal only**, not a replacement silently deployed to production. It denies direct client writes to orders, stock balances, movements, icon metadata and tracking, and isolates seller reads. It also tightens subcollection creation ownership. Uploaded-object storage rules are provider-dependent and not implemented. Existing payment writes need a trusted endpoint before adopting these rules. Review the complete candidate and run the emulator tests before any deployment.

Spark billing was not changed. No Cloud Function, storage bucket, credentials or new hosting service was provisioned. Server-side abuse controls, queue/payment enforcement, deployed license checks, shared library archive republishing and storage isolation remain backend work. Do not deploy this as a working production ordering system until those requirements and browser/rules QA pass.

No commit, push, public repository change, rules publication or hosting deployment was performed by this fix batch.
