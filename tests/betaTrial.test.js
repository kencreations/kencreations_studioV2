import test from 'node:test';
import assert from 'node:assert/strict';
import { betaExpiryMillis, activeBetaTrial } from '../src/utils/betaTrialPolicy.js';
import { summarizeLicenses, evaluateGeneratorAccess, validateClaim } from '../src/utils/licensePolicy.js';
import { activateBetaTrialInStore } from '../src/engine/licensing/betaTrialWorkflow.js';
import { activateLicenseInStore, sanitizeLicense } from '../src/engine/licensing/licenseWorkflow.js';
const NOW = Date.parse('2026-10-13T12:00:00Z');
const stamp = ms => ({ seconds: Math.floor(ms / 1000), nanoseconds: ms % 1000 * 1e6 });
const beta = (extra = {}) => ({licenseType:'beta_trial', tier:'pro', billingType:'trial', trialDurationDays:7,
    pricePHP:0, isPerpetual:false, validityStartPolicy:'at_activation', entitlements:[], expiresAt:null,
    status:'unclaimed', claimedAt:null, claimedByUid:null, ...extra});
const active = extra => beta({status:'active', claimedAt:stamp(NOW), claimedByUid:'alice', ...extra});
// Serial transactional fake with isolated writes and rollback. No Firebase/emulator calls.
function store(seed = {}) {
    let records = new Map(Object.entries(seed));
    let tail = Promise.resolve();
    return {
        serverTimestamp: () => stamp(NOW),
        get: path => records.get(path),
        transaction(callback) {
            const result = tail.then(async () => {
                const copy = new Map([...records].map(([k,v]) => [k, structuredClone(v)]));
                const result = await callback({get: async p => copy.get(p) || null,
                    set: (p,v) => copy.set(p,v), update:(p,v) => copy.set(p,{...copy.get(p),...v})});
                records = copy; return result;
            });
            tail = result.catch(() => {}); return result;
        },
    };
}
test('beta expiry derives exactly seven days from trusted claim, including fractional seconds', () => {
    assert.equal(betaExpiryMillis(active()), NOW + 604800000);
    assert.equal(betaExpiryMillis(active({claimedAt: stamp(NOW + 123)})), NOW + 123 + 604800000);
    assert.equal(activeBetaTrial(active(), 'alice', NOW + 604800000 - 1), true);
    assert.equal(activeBetaTrial(active(), 'alice', NOW + 604800000), false);
    assert.equal(activeBetaTrial(active(), 'alice', NOW - 1), false);
});
test('beta null expiry is never lifetime; missing and malformed claim timestamps fail closed', () => {
    for (const claimedAt of [null, undefined, NOW, new Date(NOW).toISOString(), {}, {seconds:NOW/1000}, {seconds:NOW/1000,nanoseconds:1e9}]) {
        assert.equal(activeBetaTrial(active({claimedAt}), 'alice', NOW), false);
    }
    assert.equal(activeBetaTrial(beta(), 'alice', NOW), false);
});
test('changed duration, price, tier, expiry, owner, status and exclusive grants do not validate', () => {
    for (const patch of [{trialDurationDays:8},{pricePHP:1},{tier:'vip'},{isPerpetual:true},
        {expiresAt:stamp(NOW+999999999)},{entitlements:['charms']},{status:'revoked'},
        {status:'expired'},{revoked:true},{disabled:true},{claimedByUid:'bob'}]) {
        assert.equal(activeBetaTrial(active(patch), 'alice', NOW), false);
    }
});
test('atomic activation creates permanent UID audit, preserves expiry and supports read-only retry', async () => {
    const s=store({'licenses/B':beta()});
    await activateBetaTrialInStore(s,'alice','B',NOW);
    const original=structuredClone(s.get('licenses/B'));
    assert.deepEqual(s.get('beta_trial_claims/alice'), {uid:'alice',licenseId:'B',claimedAt:stamp(NOW)});
    const result=await activateBetaTrialInStore(s,'alice','B',NOW+60000);
    assert.equal(result.idempotent,true);
    assert.deepEqual(s.get('licenses/B'),original);
    await assert.rejects(activateBetaTrialInStore(s,'alice','B',NOW+604800000),/already used/);
    assert.deepEqual(s.get('licenses/B'),original);
});
test('concurrent users claiming one key produce exactly one owner and one claim', async () => {
    const s=store({'licenses/B':beta()});
    const results=await Promise.allSettled(['alice','bob'].map(uid=>activateBetaTrialInStore(s,uid,'B',NOW)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(Number(!!s.get('beta_trial_claims/alice'))+Number(!!s.get('beta_trial_claims/bob')),1);
});
test('one UID concurrently claiming two keys can consume only one trial', async () => {
    const s=store({'licenses/B':beta(),'licenses/C':beta()});
    const results=await Promise.allSettled(['B','C'].map(key=>activateBetaTrialInStore(s,'alice',key,NOW)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal([s.get('licenses/B'),s.get('licenses/C')].filter(l=>l.status==='active').length,1);
});
test('revoked, expired, duplicate and unauthenticated activations cannot start another timer', async () => {
    for(const license of [beta({status:'revoked'}),active(),beta({disabled:true})]) {
        const s=store({'licenses/B':license});
        await assert.rejects(activateBetaTrialInStore(s,'bob','B',NOW));
        assert.equal(s.get('beta_trial_claims/bob'),undefined);
    }
    const s=store({'licenses/B':beta(),'beta_trial_claims/alice':{uid:'alice',licenseId:'old',claimedAt:stamp(NOW-999999999)}});
    await assert.rejects(activateBetaTrialInStore(s,'alice','B',NOW),/already used/);
    await assert.rejects(activateBetaTrialInStore(s,null,'B',NOW),/Sign in/);
    assert.equal(s.get('licenses/B').status,'unclaimed');
});
test('beta grants Pro capabilities but never VIP, exclusive tools, or promotional all-access', () => {
    const summary=summarizeLicenses([active()],{uid:'alice',now:NOW});
    assert.equal(summary.tier,'pro'); assert.equal(summary.billingType,'trial'); assert.equal(summary.isVip,false);
    assert.equal(summary.capabilities.studioHub,true); assert.equal(summary.capabilities.bazaarHub,true);
    for(const category of ['basic','premium']) assert.equal(evaluateGeneratorAccess({id:'tool',category,isFree:false},summary).allowed,true);
    assert.equal(evaluateGeneratorAccess({id:'charms',category:'exclusive'}, {...summary,promoAllAccess:true}).allowed,false);
});
test('expiry restores every other tier and preserves purchased generator entitlements', () => {
    for(const tier of ['basic','pro','pro_plus','vip','standard']) {
        const paid={status:'active',claimedByUid:'alice',tier,expiresAt:NOW+999999999,entitlements:['charms']};
        const expected=summarizeLicenses([paid],{uid:'alice',now:NOW+604800000});
        for(const licenses of [[paid,active()],[active(),paid]]) {
            const result=summarizeLicenses(licenses,{uid:'alice',now:NOW+604800000});
            assert.equal(result.tier,expected.tier);
            assert.deepEqual(result.entitlements,expected.entitlements);
            assert.ok(result.endedBetaTrial);
            assert.equal(evaluateGeneratorAccess({id:'charms',category:'exclusive'},result).allowed,true);
        }
    }
});
test('paid Pro and lifetime billing are not replaced by beta metadata', () => {
    const paid={tier:'pro',status:'active',claimedByUid:'alice',expiresAt:NOW+999999999,entitlements:[]};
    const expected=summarizeLicenses([paid],{uid:'alice',now:NOW});
    for(const licenses of [[paid,active()],[active(),paid]]) {
        const result=summarizeLicenses(licenses,{uid:'alice',now:NOW});
        assert.equal(result.billingType,expected.billingType); assert.equal(result.expiresAt,expected.expiresAt);
    }
});
test('ordinary activation and local-license summaries reject beta records', async () => {
    assert.throws(()=>validateClaim(beta(),'alice',null,NOW),/beta activation/);
    assert.throws(()=>sanitizeLicense(active()),/ordinary licenses/);
    await assert.rejects(activateLicenseInStore(store({'licenses/B':beta()}),'alice',{licenseKey:'B'},NOW),/beta activation/);
    assert.equal(summarizeLicenses([active()],{desktop:true,uid:'alice',now:NOW}).hasActiveLicense,false);
});

// Cross-project checks are optional when Studio is cloned without its sibling Admin checkout.
const adminDirectory = new URL('../../kencreations-admin/', import.meta.url);
const { existsSync } = await import('node:fs');
const adminPresent = existsSync(new URL('src/lib/betaTrialPolicy.ts', adminDirectory));
test('Admin and Studio derive identical deadlines and distinguish inactive/expired beta', {skip:!adminPresent}, async () => {
    const policy = await import(new URL('src/lib/betaTrialPolicy.ts', adminDirectory));
    assert.equal(policy.betaExpiryMillis(active()), betaExpiryMillis(active()));
    assert.equal(policy.betaStatus(beta(),NOW),'unclaimed');
    assert.equal(policy.betaStatus(active(),NOW),'active');
    assert.equal(policy.betaStatus(active(),NOW+604800000),'expired');
    assert.equal(policy.betaStatus(active({status:'revoked'}),NOW),'revoked');
});
test('Admin claims ignore all beta trials while retaining paid Pro and VIP claims', {skip:!adminPresent}, async () => {
    const {resolveAggregatedClaims} = await import(new URL('scripts/sync-claims.mjs',adminDirectory));
    const trial=active({isPerpetual:true}); // Even malformed beta must never mint claims.
    assert.deepEqual(resolveAggregatedClaims([trial]).requiredClaims,{bazaarHub:false,vip:false});
    for(const tier of ['basic','pro','pro_plus','vip']) {
        const paid={tier,status:'active',isPerpetual:true};
        assert.deepEqual(resolveAggregatedClaims([trial,paid]).requiredClaims,resolveAggregatedClaims([paid]).requiredClaims);
    }
});

test('monthly, annual, lifetime, legacy, QA and standalone licenses survive trial expiry unchanged', () => {
    const records = [
        ...['basic','pro'].flatMap(tier => ['monthly','annual'].map(billingType => ({tier,billingType,expiresAt:NOW+999999999}))),
        {tier:'pro_plus',billingType:'lifetime',isPerpetual:true,expiresAt:null},
        {tier:'vip',billingType:'lifetime',isPerpetual:true,expiresAt:null},
        {plan_type:'12mo',expires_at:NOW+999999999},
        {tier:'pro',licenseType:'qa',expiresAt:NOW+999999999},
        {tier:'standalone',entitlements:['charms'],expiresAt:null},
    ].map(l=>({status:'active',claimedByUid:'alice',...l}));
    for (const record of records) {
        const before=structuredClone(record);
        const options={uid:'alice',now:NOW+604800000};
        const expected=summarizeLicenses([record],options);
        const after=summarizeLicenses([record,active()],options);
        assert.equal(after.tier,expected.tier);
        assert.deepEqual(after.capabilities,expected.capabilities);
        assert.deepEqual(after.entitlements,expected.entitlements);
        assert.deepEqual(record,before);
    }
});
