# KenCreations Studio stabilization audit

Audit date: 2026-10-09. The checkout contained extensive existing modifications; those are the starting point, not changes attributable to this audit. No production data, billing, hosting or deployed rules were changed.

## Architecture and baseline

- React 19 / Vite 8, HashRouter, JavaScript with several TS/TSX geometry modules. `src/main.jsx` → `App.jsx`; Auth, Trial, Profile and Printer contexts.
- Firebase browser SDK 12; hardcoded public Firebase project configuration in `src/firebase.js`. No checked-in Firestore rules or indexes. Auth uses Google popup and `users/{uid}`. Licenses use `licenses/{key}.claimedByUid`.
- Three.js 0.185, React Three Fiber 9, drei, Manifold WASM, geometry/CSG workers, STLExporter and three-3mf-exporter 45.2.0. Most editors export through `EditorCanvas`; Lithophane also has independent handlers. The unused `engine/export/threemfExport.ts` imports missing `@vostok/*` and `plateLayout` modules; it is not the live export pipeline.
- Electron 43: context-isolated preload IPC, native save dialog, SQLite license/cache/telemetry storage, RSA offline certificates, REST license activation and background sync. Packaged app loads generated `.jsc`; source changes need bytecode rebuild.
- Functions folder contains an optional callable statistics function, but the frontend writes counters directly. No deployment is assumed. No automated test script or type-check configuration existed.
- Baseline production build: PASS outside Windows sandbox (sandbox realpath EPERM). Warnings: large entry bundle and Manifold node:module externalization. Baseline lint: 322 errors, 26 warnings across 128 files.

## Evidence-based issue inventory

| Severity | Confirmed issue / affected files | Root cause | Verification |
|---|---|---|---|
| High | Valid licenses ignored: AuthContext, DesktopHome, EditorCanvas | First matching document only; one-shot load; card click uses only desktop array; export desktop array never populated | Multiple claimed-license fixtures, account switch, revocation, web/desktop gates |
| High | Wrong base-license purchase message: DesktopHome → ExclusiveModal | Dialog receives only desktop entitlement length, ignoring web license | Claimed web license + missing add-on fixture |
| High | Conflicting authorization: AuthUtils, accessControl, catalog, homepage | VIP/perpetual overrides conflict with named-entitlement registry; local display name grants admin UI bypass; loading/errors collapse into absence | Policy matrix; user clarification required for commercial policy |
| High | Claim race / expired activation: LicenseService | Read then batch write; rejects only revoked; profile entitlement flags client written; HWID lookup failure ignored | Transaction fixtures, expired/disabled/wrong-owner/device rejection |
| High | Insecure boundaries cannot be assessed fully | No deployed rules available; desktop REST calls are unauthenticated; client-owned flags and counters cannot prove licenses/downloads | Deployed rules review and emulators required before rollout |
| High | Browser Lithophane exports do nothing | Three custom handlers only call Electron save IPC | Web download regression |
| High | 3MF loss/invalid XML possible: installed exporter | Mesh names interpolated without escaping; arrays use only first material; vertex colors ignored; nested children of meshes skipped | ZIP/XML/geometry/material fixtures and ThreeMFLoader roundtrip |
| Medium | False exports / trial/points consumed on failure: EditorCanvas, FloatingExportBar | STL cancellation ignored, trial and points charged before successful save, no synchronous double-click lock | Cancellation, rejected save, blocked auth, repeated export fixtures |
| Medium | Statistics inconsistency: ExportService | Time bucket dedupe loses legitimate exports and misses boundary doubles; arbitrary format increments total; missing sibling counters; global writes depend on unknown rules | Atomic transaction/idempotency fixtures; security limitation report |
| Medium | Homepage leak/spinner: DesktopHome | Async setup creates listener after cleanup; snapshot error never stops loading; duplicate catalog implementations | StrictMode subscription and error fixtures |
| Medium | Route/ID mismatch: editors.js, App | clicker, lithophane and whistle catalog URLs disagree with routes; monogram routes missing static definitions | Every registry entry resolves; legacy route aliases |
| Medium | Cached catalog crash: useGenerators | JSON.parse/localStorage unguarded; document payload can override authoritative doc ID | Invalid data/cache fixtures |
| Medium | Migration can overwrite concurrent increments | CommonJS script in ESM package; stale reads write existing counters back | Dry-run and transaction migration tests, no production execution |
| Medium | Desktop disabled/expiry changes not enforced live | Sync only checks revoked/expired status and entitlement hash, not date/device/disabled | Desktop fixtures; native packaged QA remains required |

## Review constraints

VIP inclusion and Base Commercial field semantics are being clarified. Preserve named entitlements and ownership; do not infer grants from user profile badges. No database migration or Firestore security-policy change is authorized without a concrete proposal. Spark cannot provide server-verified public download counts using only browser increments. Browser download initiation does not prove that a user saved the file or successfully sliced it.
