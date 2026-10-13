# 7-Day Pro Beta Trial — local implementation review

Date: 13 October 2026 (Asia/Manila). Local implementation only. No emulator, deployment, issued license, Firestore data write, or production Auth-claim change was performed. The only authenticated Firebase request was the official Rules API source-compilation endpoint, projects.test, without test fixtures or a release.

## Activation and expiry

Admin issues a cryptographically random KC-BETA key (128 random bits) using a transaction that refuses to overwrite an existing key. Its classification is beta_trial, tier pro, billing trial, pricePHP 0, duration 7, validityStartPolicy at_activation, isPerpetual false, status unclaimed, empty entitlements, and null claimedAt/claimedByUid/expiresAt. It is an issuance option, not a new paid pricing tier.

Studio inspects the license before selecting any ordinary API, callable, Firestore fallback, or desktop route. The dedicated beta transaction reads the license and beta_trial_claims/{uid}; it atomically binds the license, sets status active and claimedAt/lastSyncAt using serverTimestamp(), and creates {uid, licenseId, claimedAt} in that permanent claim record. Returning to an already-active trial is read-only and preserves the original deadline. A used UID cannot claim another trial, including after expiry or revocation. The claim record also preserves the activation audit independently of the Admin administrative auditTrail.

The sole deadline is claimedAt + 604800 seconds. expiresAt remains null for beta, is immutable to customers, and never means lifetime. Rules use timestamp arithmetic against request.time; both apps calculate the same deadline from the Firestore timestamp. Studio schedules an entitlement refresh at expiry. The live notice and Admin page show the deadline in Asia/Manila and a countdown. Expiry is calculated, not a scheduled status write. All other valid license records and standalone entitlements are retained and recomputed to select the remaining highest tier.

## Rules review

- betaShape requires the fixed Pro/trial/free/seven-day schema and no standalone entitlements or perpetual expiry.
- claimBeta requires an unclaimed, ownerless license with no claimedAt, absence of a prior UID claim, request-time timestamps, and a narrowly allowed field diff.
- getAfter cross-checks the UID claim with the license in the same atomic commit; claim creation also checks the license before and after that commit.
- Both ordinary claim and ordinary heartbeat branches exclude beta. Customers cannot reset, release, delete, or edit the UID claim record, or modify trial timestamps, duration, ownership, or expiry fields.
- hasBetaBazaarEntitlement reads the UID claim and its current license, matches the owner and claimedAt, requires active/non-revoked validity, and checks request.time before the exact deadline.
- The helper is added only to existing Bazaar entitlement gates. Existing tenant/shop ownership checks are unchanged. No profile-tier authorization is added.
- Existing administrator privileges remain trusted. The pre-existing administrator catch-all and privileged Admin SDK/IAM access can bypass customer restrictions. This is not an administrator-proof audit ledger.

## Claims and ordinary activation

Beta trials never contribute to bazaarHub, vip, or admin custom claims. The local administrative claim resolver excludes them and skips writing beta claim-sync metadata. Existing paid licenses retain their existing claim calculation. Existing callable source and the shared ordinary API workflow reject beta records before mutation; the callable claim aggregator excludes beta. No new callable/backend was created or deployed. Electron activation, signed-file import, local validation, and sync reject beta records/keys. Beta account access coexists with the existing desktop paid license and never replaces its certificate or binding.

## Validation

- Pre-implementation candidate and final actual Firestore source: official Firebase Rules API compilation passed, zero errors; five warnings in the existing unused shopOwner helper.
- Studio local test suite: 159 passed, zero failed/skipped; includes 14 new beta tests, transaction races, replay, missing/malformed timestamps, exact expiry boundary, expiry tampering, revoked/duplicate trials, Pro-only access, and fallback across Basic/Pro monthly and annual, Pro+/VIP lifetime, legacy, QA, and standalone records.
- Cross-project tests compare Admin/Studio deadlines and verify beta exclusion from claims while paid claims are preserved. They skip only if the sibling Admin checkout is unavailable; it was available for this run.
- Studio production build and Admin TypeScript + production build passed (sandbox file-access failures were retried successfully with approved execution access). Existing bundle-size/dynamic-import warnings remain.
- Admin lint completed with warnings, no errors. Studio full lint reports 440 errors and 26 warnings; comparison of touched JavaScript/JSX with their pre-task contents found no additional diagnostics. New beta JS/JSX files and tests pass targeted lint.
- Existing callable and Electron sources passed Node syntax checks.
- Repository diff whitespace checking reports pre-existing whitespace in the already-modified callable and LicenseService source. Unrelated working-tree changes were preserved.

Compilation checks syntax/semantics, not real request authorization. The concurrency tests use a transactional in-memory fake, not Firestore. No live activation/tenant authorization test, UI sign-in test, or Electron package installation was performed. No emulator was used.

## Known boundaries

1. Expiry stops future entitlement-gated Bazaar operations. Existing rules intentionally retain owner reads, updates, deletes, and some operational writes after expiry. Studio Hub data ownership rules are likewise unchanged. UI lockout does not revoke those database permissions.
2. Existing unrelated stale bazaarHub/vip/commercial claims are preserved under current policy and can independently authorize access. This feature never mints a beta claim. Broader claim migration/revocation is separate work requiring approval.
3. UI countdowns depend on the local clock and scheduling; authoritative Bazaar decisions use Firestore request.time. Local generators/downloaded assets cannot be made tamper-proof by Firestore rules, and already downloaded data cannot be withdrawn.
4. One trial per UID does not prevent a person using multiple accounts. Strong random keys prevent practical guessing; no automatic trial issuance is introduced.
5. Privileged old API/Function deployments bypass Security Rules. Before any beta issuance, confirm they are absent/disabled or already contain the rejection guards. Local source changes cannot secure an old deployed endpoint. No Functions deployment is authorized or required for the Spark beta path.
6. Trusted administrators retain existing administrative access. Customer immutability is enforced by rules; credentials with administrative IAM access remain privileged.
7. New claim/license lookups consume Firestore read quota. No timer job, new index, external service, or billing upgrade is required.

## Approval-required rollout (nothing executed)

1. Review this change and verify the actual deployed rules and any privileged activation endpoints. If an unguarded privileged endpoint is live, stop beta issuance until it is disabled or separately secured with explicit approval; do not add a new backend or Functions deployment.
2. Approve deployment of the reviewed Firestore rules to the existing kencreations-studio project. Deploy rules before enabling beta issuance.
3. Approve release of the updated Studio web/desktop clients and Admin interface. Older desktop binaries do not contain these guards; distribute the updated client before testing beta keys.
4. Separately approve issuing specific beta keys and using designated test UIDs for live allow/deny checks (including cross-tenant denial, replay, duplicate UID, timestamp tampering, expiry, and revocation). Do not alter existing customer or QA licenses.
5. Any production Auth cleanup requires separate explicit approval. There is no beta claim-sync deployment step.

## Exact source files changed

- [C:/Users/Ken/Desktop/kencreations-v2/firestore.rules](C:/Users/Ken/Desktop/kencreations-v2/firestore.rules) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/utils/betaTrialPolicy.js](C:/Users/Ken/Desktop/kencreations-v2/src/utils/betaTrialPolicy.js) — added
- [C:/Users/Ken/Desktop/kencreations-v2/src/utils/licensePolicy.js](C:/Users/Ken/Desktop/kencreations-v2/src/utils/licensePolicy.js) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/contexts/AuthContext.jsx](C:/Users/Ken/Desktop/kencreations-v2/src/contexts/AuthContext.jsx) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/contexts/AccessContext.jsx](C:/Users/Ken/Desktop/kencreations-v2/src/contexts/AccessContext.jsx) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/engine/licensing/betaTrialWorkflow.js](C:/Users/Ken/Desktop/kencreations-v2/src/engine/licensing/betaTrialWorkflow.js) — added
- [C:/Users/Ken/Desktop/kencreations-v2/src/services/LicenseService.js](C:/Users/Ken/Desktop/kencreations-v2/src/services/LicenseService.js) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/engine/licensing/licenseWorkflow.js](C:/Users/Ken/Desktop/kencreations-v2/src/engine/licensing/licenseWorkflow.js) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/functions/index.js](C:/Users/Ken/Desktop/kencreations-v2/functions/index.js) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/electron/licenseManager.cjs](C:/Users/Ken/Desktop/kencreations-v2/electron/licenseManager.cjs) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/electron/syncWorker.cjs](C:/Users/Ken/Desktop/kencreations-v2/electron/syncWorker.cjs) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/components/UI/ActivateLicenseModal.jsx](C:/Users/Ken/Desktop/kencreations-v2/src/components/UI/ActivateLicenseModal.jsx) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/src/components/BetaTrialNotice.jsx](C:/Users/Ken/Desktop/kencreations-v2/src/components/BetaTrialNotice.jsx) — added
- [C:/Users/Ken/Desktop/kencreations-v2/src/App.jsx](C:/Users/Ken/Desktop/kencreations-v2/src/App.jsx) — updated
- [C:/Users/Ken/Desktop/kencreations-admin/src/lib/licenseAdminPolicy.ts](C:/Users/Ken/Desktop/kencreations-admin/src/lib/licenseAdminPolicy.ts) — updated
- [C:/Users/Ken/Desktop/kencreations-admin/src/lib/licensing.ts](C:/Users/Ken/Desktop/kencreations-admin/src/lib/licensing.ts) — updated
- [C:/Users/Ken/Desktop/kencreations-admin/scripts/sync-claims.mjs](C:/Users/Ken/Desktop/kencreations-admin/scripts/sync-claims.mjs) — updated
- [C:/Users/Ken/Desktop/kencreations-admin/src/lib/betaTrialPolicy.ts](C:/Users/Ken/Desktop/kencreations-admin/src/lib/betaTrialPolicy.ts) — added
- [C:/Users/Ken/Desktop/kencreations-admin/src/pages/Licenses.tsx](C:/Users/Ken/Desktop/kencreations-admin/src/pages/Licenses.tsx) — updated
- [C:/Users/Ken/Desktop/kencreations-v2/tests/betaTrial.test.js](C:/Users/Ken/Desktop/kencreations-v2/tests/betaTrial.test.js) — added
- [C:/Users/Ken/Desktop/kencreations-v2/scripts/check-beta-rules.mjs](C:/Users/Ken/Desktop/kencreations-v2/scripts/check-beta-rules.mjs) — added
- [C:/Users/Ken/Desktop/kencreations-v2/BETA-TRIAL-IMPLEMENTATION.md](C:/Users/Ken/Desktop/kencreations-v2/BETA-TRIAL-IMPLEMENTATION.md) — this review report

Build commands also regenerated local dist output and Admin TypeScript build metadata. No package manifest, dependency, price table, Firebase project configuration, or existing license document was changed by this feature.
