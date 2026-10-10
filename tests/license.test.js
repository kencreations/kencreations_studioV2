import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLicenses, evaluateGeneratorAccess, validateClaim } from '../src/utils/licensePolicy.js';
import { observeAccount } from '../src/services/accountObserver.js';
const license = (extra = {}) => ({ status: 'active', claimedByUid: 'alice', entitlements: ['charms'], ...extra });
const options = { uid: 'alice', now: Date.parse('2026-10-09T00:00:00Z') };
const charm = { id: 'charms', isExclusive: true };
test('combines all owned active records and excludes invalid licenses', () => {
    const summary = summarizeLicenses([license(), license({ entitlements: ['keycap-maker'] }), license({ claimedByUid: 'bob', entitlements: ['vip'] }), license({ status: 'revoked', entitlements: ['vip'] }), license({ disabled: true, entitlements: ['vip'] }), license({ expiresAt: { seconds: 1 }, entitlements: ['vip'] })], options);
    assert.deepEqual(summary.entitlements, ['charms', 'keycap-maker']);
    assert.equal(summary.isVip, false);
    assert.equal(evaluateGeneratorAccess(charm, summary).allowed, true);
});
test('VIP opens all exclusive generators; PRO and perpetual duration do not grant missing add-ons', () => {
    assert.equal(evaluateGeneratorAccess(charm, summarizeLicenses([license({ entitlements: ['vip'] })], options)).allowed, true);
    assert.equal(evaluateGeneratorAccess(charm, summarizeLicenses([license({ plan_type: 'vip', entitlements: [] })], options)).allowed, true);
    assert.equal(evaluateGeneratorAccess(charm, summarizeLicenses([license({ tier: 'pro', isPerpetual: true, entitlements: [] })], options)).allowed, false);
});
test('requiredEntitlement, availability and explicit verification states', () => {
    assert.equal(evaluateGeneratorAccess({ id: 'client-icon-tag', isExclusive: true, requiredEntitlement: 'client-tag' }, { entitlements: ['client-tag'] }).allowed, true);
    for (const status of ['loading', 'error']) assert.equal(evaluateGeneratorAccess(charm, { status }).state, status);
    assert.equal(evaluateGeneratorAccess({ ...charm, status: 'disabled' }, { isVip: true }).allowed, false);
    assert.equal(evaluateGeneratorAccess({ id: 'free', isFree: true }, {}).allowed, true);
    assert.equal(evaluateGeneratorAccess({ ...charm, isFree: true }, {}).allowed, false);
    assert.equal(evaluateGeneratorAccess(null, { isVip: true }).allowed, false);
});
test('claims reject expired, disabled, revoked, invalid, wrong owner and wrong device', () => {
    for (const extra of [{ status: 'revoked' }, { status: 'disabled' }, { expiresAt: 'invalid' }, { expiresAt: '2020-01-01' }, { claimedByUid: 'bob' }, { hwid: 'other' }]) assert.throws(() => validateClaim(license(extra), 'alice', 'device', options.now));
    assert.doesNotThrow(() => validateClaim(license({ status: 'unclaimed', claimedByUid: null }), 'alice', 'device', options.now));
});
test('desktop licenses require activation, expiry and device verification', () => {
    const opts = { desktop: true, hwid: 'device', now: options.now };
    assert.equal(summarizeLicenses([{ activated: false, entitlements: ['vip'] }], opts).isVip, false);
    assert.equal(summarizeLicenses([{ activated: true, hwid: 'other', entitlements: ['vip'] }], opts).isVip, false);
    assert.equal(summarizeLicenses([{ activated: true, expiresAt: '2020-01-01', entitlements: ['vip'] }], opts).isVip, false);
});
test('auth switches, logout, listener errors and late callbacks cannot retain grants', () => {
    let authNext; const subscriptions = []; const states = []; let stops = 0;
    const stop = observeAccount({
        auth: next => { authNext = next; return () => stops++; },
        profile: () => () => stops++,
        licenses: (uid, next, error) => { subscriptions.push({ uid, next, error }); return () => stops++; },
    }, state => states.push(state));
    authNext({ uid: 'alice' }); subscriptions[0].next([license()], true);
    assert.equal(states.at(-1).licenses.length, 1);
    authNext({ uid: 'bob' }); subscriptions[0].next([license()], true);
    assert.equal(states.at(-1).licenses.length, 0);
    subscriptions[1].next([license()], false);
    assert.equal(states.at(-1).status, 'loading');
    subscriptions[1].error(new Error('permission-denied'));
    assert.equal(states.at(-1).status, 'error');
    authNext(null); subscriptions[1].next([license()], true);
    assert.equal(states.at(-1).currentUser, null);
    stop(); assert.equal(stops, 5);
});
