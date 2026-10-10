import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { nextExportStats } from '../../src/utils/exportStats.js';
import { validateClaim } from '../../src/utils/licensePolicy.js';

if (process.env.GCLOUD_PROJECT !== 'demo-kencreations-audit' || !/^127\.0\.0\.1:8080$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('This test only runs against the local demo emulator.');
const projectId = 'demo-kencreations-audit';
const supplied = await fs.readFile('tests/firestore.supplied.rules', 'utf8');
const proposed = await fs.readFile('docs/firestore.proposed.rules', 'utf8');
let env;
const seed = async () => env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'licenses', 'fixture-key'), { claimedByUid: 'alice', status: 'active', entitlements: ['charms'] });
    await setDoc(doc(db, 'licenses', 'unclaimed'), { status: 'unclaimed', entitlements: ['keycap-maker'] });
    await setDoc(doc(db, 'generators', 'charms'), { title: 'Charms', stlExports: 4 });
});
try {
    env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules: supplied } });
    await env.clearFirestore(); await seed();
    const attacker = env.authenticatedContext('ordinary-user').firestore();
    await assertSucceeds(updateDoc(doc(attacker, 'licenses', 'fixture-key'), { entitlements: ['vip'] }));
    await assertSucceeds(setDoc(doc(env.unauthenticatedContext().firestore(), 'app_config', 'fixture'), { editableByAnyone: true }));
    console.log('PASS: supplied rules reproduce ordinary-user VIP escalation and anonymous config writes.');

    // Actual concurrent transactions and event replay with deterministic IDs.
    const increment = id => runTransaction(attacker, async transaction => {
        const eventRef = doc(attacker, 'generators', 'charms', 'export_events', id);
        if ((await transaction.get(eventRef)).exists()) return;
        const ref = doc(attacker, 'generators', 'charms');
        const snapshot = await transaction.get(ref);
        transaction.update(ref, nextExportStats(snapshot.data(), '3mf'));
        transaction.set(eventRef, { format: 'threeMf' });
    });
    await Promise.all([increment('one'), increment('two'), increment('one')]);
    const counts = (await getDoc(doc(attacker, 'generators', 'charms'))).data();
    assert.equal(counts.totalExports, 6); assert.equal(counts.threeMfExports, 2); assert.equal(counts.stlExports, 4);
    const claim = uid => {
        const db = env.authenticatedContext(uid).firestore();
        return runTransaction(db, async transaction => {
            const ref = doc(db, 'licenses', 'unclaimed');
            const license = (await transaction.get(ref)).data(); validateClaim(license, uid);
            transaction.update(ref, { claimedByUid: uid, status: 'active' });
        });
    };
    const claimed = await Promise.allSettled([claim('alice'), claim('bob')]);
    assert.equal(claimed.filter(result => result.status === 'fulfilled').length, 1);
    console.log('PASS: concurrent counter writes, event deduplication and competing claims.');
    await env.cleanup();
    env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules: proposed } });
    await env.clearFirestore(); await seed();
    const alice = env.authenticatedContext('alice').firestore();
    const bob = env.authenticatedContext('bob').firestore();
    const anonymous = env.unauthenticatedContext().firestore();
    const admin = env.authenticatedContext('admin-fixture', { admin: true }).firestore();
    await assertSucceeds(getDocs(query(collection(alice, 'licenses'), where('claimedByUid', '==', 'alice'))));
    await assertFails(getDocs(collection(alice, 'licenses')));
    await assertFails(getDoc(doc(bob, 'licenses', 'fixture-key')));
    await assertFails(getDoc(doc(anonymous, 'licenses', 'fixture-key')));
    await assertFails(updateDoc(doc(alice, 'licenses', 'fixture-key'), { entitlements: ['vip'] }));
    await assertFails(setDoc(doc(bob, 'licenses', 'fake-vip'), { status: 'active', entitlements: ['vip'] }));
    await assertFails(deleteDoc(doc(bob, 'licenses', 'fixture-key')));
    await assertSucceeds(updateDoc(doc(alice, 'licenses', 'fixture-key'), { lastSyncAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(alice, 'generators', 'charms'), { totalExports: 999 }));
    await assertFails(setDoc(doc(anonymous, 'app_config', 'fixture'), { attack: true }));
    await assertSucceeds(updateDoc(doc(admin, 'licenses', 'fixture-key'), { entitlements: ['vip'] }));
    await assertSucceeds(getDoc(doc(anonymous, 'generators', 'charms')));

    // Bazaar Hub Authorization & Negative Isolation Tests
    // 1. Ordinary user without Bazaar Hub entitlement cannot create a shop
    await assertFails(setDoc(doc(alice, 'shops', 'shop_alice'), { ownerUid: 'alice' }));
    // 2. User with bazaarHub claim can create their deterministic shop
    const bazaarSubscriber = env.authenticatedContext('subscriber-joe', { bazaarHub: true }).firestore();
    await assertSucceeds(setDoc(doc(bazaarSubscriber, 'shops', 'shop_subscriber-joe'), {
        shopId: 'shop_subscriber-joe',
        ownerUid: 'subscriber-joe',
    }));
    // 3. Cannot forge arbitrary shop ID or another seller's shop ID
    await assertFails(setDoc(doc(bazaarSubscriber, 'shops', 'shop_someone_else'), { ownerUid: 'subscriber-joe' }));
    await assertFails(setDoc(doc(bazaarSubscriber, 'shops', 'shop_alice'), { ownerUid: 'alice' }));
    // 4. Bob cannot read or modify Joe's private shop
    await assertFails(getDoc(doc(bob, 'shops', 'shop_subscriber-joe')));
    await assertFails(updateDoc(doc(bob, 'shops', 'shop_subscriber-joe'), { name: 'Hacked' }));
    // 5. Inventory movements subcollection is immutable (tamper-proof audit ledger)
    await assertSucceeds(setDoc(doc(bazaarSubscriber, 'shops', 'shop_subscriber-joe', 'inventory_movements', 'mov_1'), {
        movementId: 'mov_1',
        shopId: 'shop_subscriber-joe',
        ownerUid: 'subscriber-joe',
        type: 'allocation',
        qty: 10,
        createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(bazaarSubscriber, 'shops', 'shop_subscriber-joe', 'inventory_movements', 'mov_1'), { qty: 999 }));
    await assertFails(deleteDoc(doc(bazaarSubscriber, 'shops', 'shop_subscriber-joe', 'inventory_movements', 'mov_1')));
    // 6. Public tracking token listing is strictly denied to anonymous users (anti-enumeration)
    await assertFails(getDocs(collection(anonymous, 'order_tracking')));
    // 7. Unpublished storefront cannot be viewed by anonymous users
    await assertSucceeds(setDoc(doc(bazaarSubscriber, 'public_shops', 'shop_subscriber-joe'), {
        shopId: 'shop_subscriber-joe',
        ownerUid: 'subscriber-joe',
        name: "Joe's 3D Shop",
        isPublished: false,
    }));
    await assertFails(getDoc(doc(anonymous, 'public_shops', 'shop_subscriber-joe')));
    // 8. Anonymous order submission to order_inbox is blocked in production rules
    await assertFails(setDoc(doc(anonymous, 'order_inbox', 'order_anon'), { sellerUid: 'subscriber-joe' }));
    // 9. Slug update is denied (immutable registry)
    await assertSucceeds(setDoc(doc(bazaarSubscriber, 'shop_slugs', 'joe-prints'), {
        ownerUid: 'subscriber-joe',
        shopId: 'shop_subscriber-joe',
        slug: 'joe-prints',
    }));
    await assertFails(updateDoc(doc(bazaarSubscriber, 'shop_slugs', 'joe-prints'), { ownerUid: 'bob' }));

    console.log('PASS: proposed owner queries, admin grants, immutable entitlements, Bazaar Hub isolation, and tamper-proof ledgers.');
    await env.cleanup();
    env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules: supplied } });
    if (process.env.AUDIT_BROWSER === 'true') {
        const { runBrowserTests } = await import('../browser/run.mjs');
        await runBrowserTests(env);
    }
} finally { await env?.cleanup(); }
