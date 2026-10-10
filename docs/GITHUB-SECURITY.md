# GitHub publication preparation

## What is protected

Keep the **source repository private** and grant access only to trusted collaborators. Repository visibility has not been verified or changed from this workspace. No push, deployment, credential rotation or history rewrite was performed.

Browser JavaScript, WebAssembly, fonts and model assets are downloaded to the visitor's device. They can be copied, even when the source repository is private. Obfuscation cannot enforce licensing or keep client algorithms secret. This build explicitly enables minification and disables source maps; aggressive obfuscation was not added because it does not provide confidentiality and would need additional performance/export regression validation. Existing Electron bytecode compilation is also a reverse-engineering deterrent, not secret storage.

Protecting an algorithm from client inspection requires keeping it on a trusted server, which is an architectural/infrastructure decision outside this change. Do not put signing secrets in `VITE_*` variables: Vite includes them in the client bundle. The Firebase web configuration and RSA **public** verification key are intentionally public identifiers/key material, not signing credentials.

## Changes made

- Expanded `.gitignore` for environment variants, credentials, private/signing key files, license files, local databases, Firebase caches/exports, reports and local automation state. Sanitized `.env.example` files remain eligible for version control.
- Stopped tracking `browser_logs.txt`, preserving the local file. Its deletion from Git's index is staged; other task edits have not been automatically staged.
- Removed the literal legacy signing secret from `generate-key.cjs`. This admin utility now requires `KENCREATIONS_LEGACY_SIGNING_SECRET` and fails closed when absent. Do not distribute that variable with the client.
- Removed the insecure browser HMAC fallback from `ActivationScreen.jsx`. The desktop verification bridge remains intact; web visitors are directed to the existing account/profile activation flow.
- Added `scripts/check-secrets.mjs` and a local pre-commit hook. The checker prints paths/rule names only. It scans common private-key/service-account/token patterns and literal signing secrets; it is not a comprehensive credential or personal-data detector.
- Explicitly disabled production source maps and enabled minification in `vite.config.js`.

## Before committing or publishing

1. Confirm the GitHub repository is **Private** in repository settings. A public source repository exposes source regardless of `.gitignore` or bundle obfuscation.
2. Review `git status` and `git diff --cached` locally. This workspace contains extensive preexisting changes; do not blindly commit all files. Keep the actual source, package lock, build configuration and required model/font assets tracked in the private repo.
3. Run `node scripts/check-secrets.mjs`, then `npm run build` and `node scripts/check-secrets.mjs --dist`.
4. After staging your intended files, run `node scripts/check-secrets.mjs --staged`. It reads index contents, so fixing only the working copy does not hide an older staged secret.
5. The local hook is enabled using `git config --local core.hooksPath .githooks`. Each fresh clone needs that command. Hooks can be bypassed; enable GitHub secret scanning/push protection where available and enforce a server-side review/check policy.
6. Deploy only the contents of `dist` as the public static site. Do not publish the repository root, `src`, tests, audit reports, Electron scripts or environment files as hosting assets. GitHub Pages availability for private repositories depends on the GitHub plan; keep the source private even if using a different static host.

## Findings requiring separate action

The legacy signing secret was already tracked in source. Removing it from current files or adding `.gitignore` does not remove historical copies. If any installed release/admin system still uses it, treat it as exposed and coordinate a signing/validation migration before rotation; blindly changing it could invalidate legitimate existing licenses. No production license records or signing configuration were changed. History cleanup, if needed, requires a reviewed rewrite and collaborator coordination; rotation is still necessary even after cleanup.

The completed scan of locally available Git history found literal signing-secret matches in historical versions of `generate-key.cjs`, `src/components/ActivationScreen.jsx` and `src/components/UI/PricingModal.jsx`. Current versions pass the configured checks. Historical values were not printed by the scanner. The history scan deliberately exits nonzero for these findings; the repository is not cleared for public-source publication.

`extractKey.cjs` references a separate admin project's `VITE_RSA_PRIVATE_KEY_B64` variable. That external project was not inspected. A real private signing key must never be supplied to a browser-exposed Vite variable. Audit that admin build and rotate the key if it was delivered to browsers; do not assume changing the variable name recovers an exposed key.

The Firestore rules supplied earlier in this conversation allow public app configuration writes and broad authenticated writes, including a catch-all rule. Those permissions can undermine licensing independently of source visibility. Proposed rules already exist in `docs/firestore.proposed.rules`, but they were not deployed by this task. Verify and resolve the actual deployed rules before treating a public launch as secure. This task does not change billing or deploy paid Firebase services.

## Validation and boundaries

Production build passed. The current tracked/non-ignored source and `dist` passed the configured pattern scan, and no `.map` files were found in `dist`. Ignore behavior was checked for production/development env files, service account credentials, license files and local SQLite files; `.env.example` remains allowed. The local hook configuration and preservation of the browser log were verified.

`npm test` passed all 63 current tests. Targeted lint was run for the changed activation screen, key utility, secret checker and Vite configuration. Repository-wide lint failures recorded in the earlier audit remain outside this change.

The scanner does not inspect remote-only history, cloud account configuration, arbitrary encoded secrets or all forms of personal data. Build success is not a security certification. No copy-proof protection is claimed.

References: [Vite environment exposure](https://vite.dev/guide/env-and-mode), [Vite build options](https://vite.dev/config/build-options), [GitHub sensitive-data removal](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository), [GitHub Pages repository requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
