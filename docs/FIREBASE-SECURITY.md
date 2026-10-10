# Firebase security decision — review before deployment

No rules have been deployed or added to the production deployment configuration. `firestore.proposed.rules` is an emulator-only proposal, not a drop-in production replacement.

## Confirmed exposure in the supplied rules

The authenticated catch-all grants every signed-in user full database control. Specific license update restrictions do not override it. Anonymous clients can enumerate all license keys and metadata, edit app configuration, replenish trials, and create/overwrite telemetry. Signed-in clients can mint VIP licenses, revoke someone else's license, modify generator metadata/counters, and change update notifications. Client-side checks cannot repair this boundary.

Reference: [Firebase overlapping match rules](https://firebase.google.com/docs/firestore/security/rules-structure#overlapping_match_statements).

## Proposed boundary

- Administrator identity comes from a trusted `admin` custom claim, provisioned using Admin SDK from a controlled environment. Never from display names or writable profile fields.
- Account holders can query/read only licenses already assigned to their UID. Only trusted administrators can change ownership, status, entitlements, expiry, or hardware binding.
- Public clients can read generator metadata/counters; only administrators can publish aggregate counts. Browser exports remain fully usable when analytics writes are denied.
- Profile owners may edit ordinary display fields/colors, but cannot mint points, subscription flags, or export totals.
- Reject unauthenticated telemetry/trial writes and protect release/update configuration. Unreviewed collections default to administrator-only.

## Compatibility decisions requiring approval and rollout work

1. Existing keys were publicly readable. Enabling self-service claims of unassigned keys is unsafe until keys are rotated/reissued or ownership is preassigned by a trusted administrator. Do not rotate or modify customer records as part of this audit. The application can activate an already-owned active web license; unassigned licenses need a trusted claim process.
2. The desktop license REST client sends no Firebase ID token. The proposed private-license rules will reject that legacy client. Authenticate desktop requests and verify ID tokens/ownership, or introduce a trusted licensing endpoint, before enforcing them. Existing signed offline certificates remain a separate offline mechanism; online revocation cannot be guaranteed while disconnected.
3. HWID fields are supplied by clients and are not hardware attestation. The proposal requires trusted device assignment rather than making arbitrary public binding writes legal.
4. Global counters and points become read-only to ordinary clients. Use reviewed administrator aggregation of untrusted events, or a trusted service with authentication/rate limits. Even an authenticated callable increment endpoint cannot prove that a local file was successfully saved or sliced.
5. Notification targeting, machine-ID profiles/colors, community gallery and other collections need a complete ownership schema before opening them. The proposal deliberately fails closed for these unreviewed collections.
6. Firebase Spark does not require deploying the existing Functions directory. This audit introduces no paid runtime service. A Functions deployment requires a billing/architecture decision outside this change.

## Counter behavior in the application

The existing client-reported counter path is retained with per-event transaction deduplication, strict format validation, safe missing-field initialization and no download dependency. It remains untrusted under the supplied rules. Missing documents are not created by exports. Existing numeric historical totals are preserved even if they disagree with the format breakdown; a trusted reconciliation is needed to resolve historical inconsistencies. The migration script is dry-run by default and must never be run against production without review.

## License interpretation

The owner confirmed that VIP includes every premium/exclusive generator. Non-VIP licenses require the named entitlement (including `client-tag` for `client-icon-tag`). Active records owned by one UID are combined. `isPerpetual` describes duration, not VIP permission. No Base Commercial discriminator was supplied; the UI says “active license” rather than asserting that every active add-on is a base license. No grants are inferred from user badges, points, local display names, or a cached profile.
