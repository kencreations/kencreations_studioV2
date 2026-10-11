import test from 'node:test';
import assert from 'node:assert/strict';
import { activateLicenseInStore, sanitizeLicense } from '../src/engine/licensing/licenseWorkflow.js';
import { summarizeLicenses, evaluateGeneratorAccess, evaluateExportAccess } from '../src/utils/licensePolicy.js';

function createMockStore(seed = {}) {
    const records = new Map(Object.entries(seed));
    let inTransaction = false;

    return {
        transaction: async callback => {
            // Emulate atomic concurrency lock
            while (inTransaction) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            inTransaction = true;
            try {
                const txCopies = new Map();
                for (const [k, v] of records) {
                    txCopies.set(k, structuredClone(v));
                }
                const tx = {
                    get: async path => (txCopies.has(path) ? structuredClone(txCopies.get(path)) : null),
                    set: (path, data) => txCopies.set(path, structuredClone(data)),
                };
                const result = await callback(tx);
                for (const [k, v] of txCopies) {
                    records.set(k, v);
                }
                return result;
            } finally {
                inTransaction = false;
            }
        },
        getRaw: path => (records.has(path) ? structuredClone(records.get(path)) : null),
        setRaw: (path, data) => records.set(path, structuredClone(data)),
    };
}

const NOW = Date.parse('2026-10-11T12:00:00Z');
const FUTURE_DATE = '2027-10-11T12:00:00Z';
const PAST_DATE = '2025-01-01T00:00:00Z';

test('1. Valid unclaimed license: claims atomically, binds to UID, preserves immutable tier and entitlements', async () => {
    const store = createMockStore({
        'licenses/KC-VALID01': {
            licenseKey: 'KC-VALID01',
            status: 'unclaimed',
            claimedByUid: null,
            tier: 'pro',
            plan_type: 'pro',
            entitlements: ['keycap-maker', 'charms'],
            expiresAt: FUTURE_DATE,
            commercial_license: true,
        },
    });

    const result = await activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-VALID01' }, NOW);

    assert.equal(result.success, true);
    assert.equal(result.idempotent, false);
    assert.match(result.message, /activated successfully/i);
    assert.equal(result.license.claimedByUid, 'alice_uid');
    assert.equal(result.license.status, 'active');
    assert.equal(result.license.tier, 'pro');
    assert.deepEqual(result.license.entitlements, ['keycap-maker', 'charms']);

    // Authoritative record check in store
    const stored = store.getRaw('licenses/KC-VALID01');
    assert.equal(stored.claimedByUid, 'alice_uid');
    assert.equal(stored.status, 'active');
    assert.equal(stored.tier, 'pro');
    assert.equal(stored.commercial_license, true);
    assert.equal(stored.claimedAt, NOW);
});

test('2. Invalid license: non-existent, empty, or malformed key is rejected', async () => {
    const store = createMockStore({});

    await assert.rejects(
        () => activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-NONEXISTENT' }, NOW),
        /Invalid License Code/i
    );

    await assert.rejects(
        () => activateLicenseInStore(store, 'alice_uid', { licenseKey: '' }, NOW),
        /Sign in and enter a valid license code/i
    );

    await assert.rejects(
        () => activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC/MALFORMED/SLASH' }, NOW),
        /Sign in and enter a valid license code/i
    );
});

test('3. Already-claimed license owned by current user: handled idempotently and binds new HWID', async () => {
    const store = createMockStore({
        'licenses/KC-OWNED': {
            licenseKey: 'KC-OWNED',
            status: 'active',
            claimedByUid: 'alice_uid',
            tier: 'vip',
            entitlements: ['vip'],
            expiresAt: FUTURE_DATE,
            claimedAt: NOW - 100000,
            hwid: null,
        },
    });

    // Idempotent retry without HWID
    const firstRetry = await activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-OWNED' }, NOW);
    assert.equal(firstRetry.success, true);
    assert.equal(firstRetry.idempotent, true);
    assert.match(firstRetry.message, /already active/i);

    // Idempotent retry with new desktop HWID binding
    const hwidRetry = await activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-OWNED', hwid: 'hwid_alice_laptop' }, NOW);
    assert.equal(hwidRetry.success, true);
    assert.equal(hwidRetry.idempotent, true);
    assert.equal(hwidRetry.license.hwid, 'hwid_alice_laptop');

    const updated = store.getRaw('licenses/KC-OWNED');
    assert.equal(updated.hwid, 'hwid_alice_laptop');
    assert.equal(updated.claimedByUid, 'alice_uid');
});

test('4. License owned by another user: rejected with cross-account protection', async () => {
    const store = createMockStore({
        'licenses/KC-BOB-KEY': {
            licenseKey: 'KC-BOB-KEY',
            status: 'active',
            claimedByUid: 'bob_uid',
            tier: 'standard',
            entitlements: ['charms'],
            expiresAt: FUTURE_DATE,
        },
    });

    await assert.rejects(
        () => activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-BOB-KEY' }, NOW),
        /already bound to another Google account/i
    );

    // Verify Bob's license was not tampered with
    const stored = store.getRaw('licenses/KC-BOB-KEY');
    assert.equal(stored.claimedByUid, 'bob_uid');
});

test('5. Expired license: activation is rejected', async () => {
    const store = createMockStore({
        'licenses/KC-EXPIRED': {
            licenseKey: 'KC-EXPIRED',
            status: 'unclaimed',
            claimedByUid: null,
            tier: 'standard',
            entitlements: ['keycap-maker'],
            expiresAt: PAST_DATE,
        },
    });

    await assert.rejects(
        () => activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-EXPIRED' }, NOW),
        /expired or has an invalid expiration date/i
    );
});

test('6. Revoked or disabled license: activation is rejected', async () => {
    const storeRevoked = createMockStore({
        'licenses/KC-REVOKED': {
            licenseKey: 'KC-REVOKED',
            status: 'revoked',
            claimedByUid: null,
            expiresAt: FUTURE_DATE,
        },
    });
    await assert.rejects(
        () => activateLicenseInStore(storeRevoked, 'alice_uid', { licenseKey: 'KC-REVOKED' }, NOW),
        /not available for activation/i
    );

    const storeDisabled = createMockStore({
        'licenses/KC-DISABLED': {
            licenseKey: 'KC-DISABLED',
            status: 'active',
            disabled: true,
            claimedByUid: null,
            expiresAt: FUTURE_DATE,
        },
    });
    await assert.rejects(
        () => activateLicenseInStore(storeDisabled, 'alice_uid', { licenseKey: 'KC-DISABLED' }, NOW),
        /not available for activation/i
    );
});

test('7. Concurrent activation attempts: atomic execution ensures exactly one winner', async () => {
    const store = createMockStore({
        'licenses/KC-COMPETE': {
            licenseKey: 'KC-COMPETE',
            status: 'unclaimed',
            claimedByUid: null,
            tier: 'standard',
            entitlements: ['keycap-maker'],
            expiresAt: FUTURE_DATE,
        },
    });

    const [aliceAttempt, bobAttempt] = await Promise.allSettled([
        activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-COMPETE' }, NOW),
        activateLicenseInStore(store, 'bob_uid', { licenseKey: 'KC-COMPETE' }, NOW),
    ]);

    const successes = [aliceAttempt, bobAttempt].filter(r => r.status === 'fulfilled');
    const failures = [aliceAttempt, bobAttempt].filter(r => r.status === 'rejected');

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.match(failures[0].reason.message, /already bound to another Google account/i);

    const winner = successes[0].value.license.claimedByUid;
    const finalDoc = store.getRaw('licenses/KC-COMPETE');
    assert.equal(finalDoc.claimedByUid, winner);
});

test('8. Unauthenticated activation: rejected if UID is missing or empty', async () => {
    const store = createMockStore({
        'licenses/KC-UNAUTH': {
            licenseKey: 'KC-UNAUTH',
            status: 'unclaimed',
            expiresAt: FUTURE_DATE,
        },
    });

    await assert.rejects(
        () => activateLicenseInStore(store, null, { licenseKey: 'KC-UNAUTH' }, NOW),
        /Sign in and enter a valid license code/i
    );

    await assert.rejects(
        () => activateLicenseInStore(store, '', { licenseKey: 'KC-UNAUTH' }, NOW),
        /Sign in and enter a valid license code/i
    );
});

test('9. Activation retry after network interruption: state remains intact and returns idempotent success', async () => {
    const store = createMockStore({
        'licenses/KC-NETRETRY': {
            licenseKey: 'KC-NETRETRY',
            status: 'unclaimed',
            claimedByUid: null,
            tier: 'vip',
            entitlements: ['vip'],
            expiresAt: FUTURE_DATE,
        },
    });

    // 1st request succeeds on server
    const firstCall = await activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-NETRETRY' }, NOW);
    assert.equal(firstCall.success, true);
    assert.equal(firstCall.idempotent, false);

    // Client retries (e.g. after socket drop or timeout)
    const retryCall = await activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-NETRETRY' }, NOW + 5000);
    assert.equal(retryCall.success, true);
    assert.equal(retryCall.idempotent, true);
    assert.equal(retryCall.license.tier, 'vip');
});

test('10. Correct user entitlement refresh: claimed license immediately updates access policies', async () => {
    const exclusiveGenerator = { id: 'keycap-maker', isExclusive: true, isFree: false };

    // Initially: Alice has no licenses
    const beforeSummary = summarizeLicenses([], { uid: 'alice_uid', now: NOW });
    assert.equal(beforeSummary.hasActiveLicense, false);
    assert.equal(beforeSummary.entitlements.length, 0);
    assert.equal(evaluateGeneratorAccess(exclusiveGenerator, beforeSummary).allowed, false);
    assert.equal(evaluateExportAccess(exclusiveGenerator, 'stl', beforeSummary).allowed, false);

    // Backend claims license
    const store = createMockStore({
        'licenses/KC-REFRESH': {
            licenseKey: 'KC-REFRESH',
            status: 'unclaimed',
            claimedByUid: null,
            tier: 'maker',
            entitlements: ['keycap-maker'],
            expiresAt: FUTURE_DATE,
        },
    });
    const activation = await activateLicenseInStore(store, 'alice_uid', { licenseKey: 'KC-REFRESH' }, NOW);

    // AuthContext summary recomputation with newly claimed record
    const aliceLicenses = [activation.license];
    const afterSummary = summarizeLicenses(aliceLicenses, { uid: 'alice_uid', now: NOW });

    assert.equal(afterSummary.hasActiveLicense, true);
    assert.deepEqual(afterSummary.entitlements, ['keycap-maker']);
    assert.equal(evaluateGeneratorAccess(exclusiveGenerator, afterSummary).allowed, true);
    assert.equal(evaluateExportAccess(exclusiveGenerator, 'stl', afterSummary).allowed, true);
});

test('11. Existing active licenses continue working and evaluate correctly', async () => {
    const existing = {
        licenseKey: 'KC-EXISTING',
        status: 'active',
        claimedByUid: 'alice_uid',
        tier: 'vip',
        entitlements: ['vip'],
        expiresAt: FUTURE_DATE,
    };
    const summary = summarizeLicenses([existing], { uid: 'alice_uid', now: NOW });
    assert.equal(summary.isVip, true);
    assert.equal(summary.hasActiveLicense, true);

    const charmGen = { id: 'charms', isExclusive: true, isFree: false };
    assert.equal(evaluateGeneratorAccess(charmGen, summary).allowed, true);
    assert.equal(evaluateExportAccess(charmGen, '3mf', summary).allowed, true);
});

test('12. New unlicensed accounts remain restricted from protected features', async () => {
    const newAccountSummary = summarizeLicenses([], { uid: 'newbie_uid', now: NOW });
    assert.equal(newAccountSummary.hasActiveLicense, false);
    assert.equal(newAccountSummary.isVip, false);

    const exclusiveTool = { id: 'exclusive-tool', isExclusive: true, isFree: false };
    const toolAccess = evaluateGeneratorAccess(exclusiveTool, newAccountSummary);
    assert.equal(toolAccess.allowed, false);
    assert.equal(toolAccess.reason, 'LICENSE_REQUIRED');

    const exportAccess = evaluateExportAccess(exclusiveTool, 'stl', newAccountSummary);
    assert.equal(exportAccess.allowed, false);
    assert.equal(exportAccess.reason, 'LICENSE_REQUIRED');
});
