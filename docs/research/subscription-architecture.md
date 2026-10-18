# Subscription and access architecture

Static evidence only. All references are to supplied `audit-artifacts/pixnprints-input/chunks` files; offsets are zero-based decoded character positions. No account, RPC, database, checkout, or protected endpoint was called.

## Confirmed client behavior

- `CYz_3vwf.js`, final constants and export near 173324: a Supabase client is initialized with a project URL and a browser publishable key. That is client configuration, not an administrative credential. SDK code occupies most of this file; SDK capabilities alone do not establish application usage.
- `Dj0F4wNJ.js`, import alias `h` references that client. `Je` at about 9500 invokes `get_user_access_tier` and `get_user_export_access`, queries `subscriptions` for status, plan, end and renewal timestamps, and combines those results with other entitlement sources.
- `me` recognizes `active` with no end or a future end, and canceled/cancelled subscriptions with a future end. `on_trial` and `past_due` produce inactive results in the inspected branch. `Ye` near 9250 queries unexpired granted `perk_redemptions`; an applicable grant can produce a Pro entitlement when a subscription is not active.
- `He` near 5400 fetches same-origin `/api/patreon/status`; its result includes configuration, session, entitlement, access tier, Shop Maker and next-charge state. Login uses `/api/patreon/login?return=...`; logout POSTs `/api/patreon/logout`. `We` converts status to client entitlement shape.
- `Je` near 10932 checks `/api/license/status` using the user's bearer access token for expired-license messaging. `Pt` near 12811 POSTs `/api/lemonsqueezy/upgrade` with the bearer token. These paths establish frontend integration points; provider webhook and billing implementations are absent.
- Trial helpers call `get_trial_credit_status` (2483), `get_trial_designer_status` (3199) and `consume_trial_designer_export` (4196). The consume call passes designer ID, base allowance and fingerprint hash, and honors returned `allowed`, `remaining`, `effective_max`, and fingerprint permission. Its failure path denies the trial export. The client base allowance is five, with an initial device account limit of two; server results may alter effective values.
- `j`, `Be`, `Ue`, `Ne` near the start derive a SHA-256 fingerprint from browser, screen, timezone and canvas data, cached in sessionStorage. This is a client fingerprint mechanism, not proof of a reliable device identity.
- `Ge` invokes `get_user_block_status` (6519), recognizes account/fingerprint/device_limit block kinds, and populates a restriction dialog. Its catch path clears client blocking state. Server authorization cannot be inferred from that client fallback.
- `wt` invokes `get_user_feature_flags` (7757); flags support expiration. `vt` near 12100 checks block status, route access, existing entitlement, sign-in, fingerprint status and trial consumption before returning a boolean. `kt` near 11380 generates restriction/upgrade/trial button copy. `Se`/`Ke` cache license-shaped client data in sessionStorage; this is not an authorization authority.

## Inferred

Entitlements combine subscription, license, points grants and Patreon, with separate feature flags and route-specific access rules. The client presents access decisions and initiates export checks; Supabase RPC names suggest backend participation in credit accounting. This does not prove transactions, row-level security, token verification or webhook authenticity.

## Unavailable

No SQL schema, RLS policy, RPC bodies, webhook handlers, payment signatures, checkout price IDs, server-side entitlement enforcement, refund behavior or atomic-credit-consumption implementation was supplied. Subscription querying is visible, but database policy isolation cannot be audited from browser code. A frontend disabled button cannot establish backend security. No security bypass was attempted.

## Proposed architecture for Ken Creations

Keep identity and entitlement separate. Validate sessions on owned backend routes, verify payment webhooks, store immutable billing-event IDs for idempotency, and derive a normalized entitlement record. Credit consumption should be transactional and idempotent, with user ownership enforced by database policies and server checks. Restrict privileged keys to server infrastructure. Treat UI flags/cache as presentation hints; use only the new application's own account and billing services. Add tests for duplicate webhook events, expiration/cancellation boundaries, concurrent credit requests and cross-user reads. These are independent design proposals, not claims about the inspected service.
