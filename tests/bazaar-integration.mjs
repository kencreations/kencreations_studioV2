import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,getDocs,collection} from 'firebase/firestore';
import {decomposeProductBOM} from '../src/engine/bazaar/bom.js';
import {stockAvailability} from '../src/engine/bazaar/stockAvailability.js';
if(process.env.GCLOUD_PROJECT!=='demo-kencreations-audit' || process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Only local demo emulators are allowed.');
const env=await initializeTestEnvironment({projectId:'demo-kencreations-audit',firestore:{host:'127.0.0.1',port:8080,rules:await fs.readFile('docs/firestore.bazaar-candidate.rules','utf8')}});
const {server}=await import('../server/local.mjs');
const require=createRequire(new URL('../server/package.json',import.meta.url));
const db=require('firebase-admin/firestore').getFirestore(),auth=require('firebase-admin/auth').getAuth();
const shopId='shop_seller', eventId='maker-faire-2026';
async function api(action,payload,token) {
    const response=await fetch('http://127.0.0.1:5191/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)});
    return {status:response.status,data:await response.json()};
}
try {
    await env.clearFirestore();
    for(const uid of ['seller','stranger']) {
        try {await auth.createUser({uid,email:`${uid}@example.test`,password:'LocalFixture123!'});}catch(error){if(error.code!=='auth/uid-already-exists' && error.code!=='auth/email-already-exists')throw error;}
    }
    const signed=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'seller@example.test',password:'LocalFixture123!',returnSecureToken:true})});
    const token=(await signed.json()).idToken;assert.ok(token);
    await db.doc(`shops/${shopId}`).set({shopId,ownerUid:'seller',isPublished:true,cashEnabled:true});
    const product={productId:'clicker',name:'Two A clicker',shopId,ownerUid:'seller',type:'made_to_order',status:'active',isPublished:true,retailPrice:100,customizationOptions:{available_slots:[2],allowed_characters:'A',colors:[{id:'teal',name:'Teal'}],base_colors:[{id:'teal',name:'Teal'}],switches:[{id:'mx',name:'MX'}],base_included_letters:2}};
    const customization={slots:2,casing_color:'teal',slotsData:[{char:'A',colorId:'teal',switchId:'mx'},{char:'A',colorId:'teal',switchId:'mx'}]};
    await db.doc(`shops/${shopId}/products/clicker`).set(product);
    for(const [id,name]of [[eventId,'Maker Faire 2026'],['bazaar2026','Bazaar2026']])await db.doc(`shops/${shopId}/events/${id}`).set({eventId:id,shopId,ownerUid:'seller',name,status:'Active',isPublished:true,pendingQueueCapacity:10,activeProductionCapacity:5,catalog:{clicker:{enabled:true}}});
    const bom=decomposeProductBOM({product,customization}), allocations={};
    for(const part of bom){allocations[part.component_key]=part.required_qty*5;assert.equal((await api('adjust',{shopId,itemKey:part.component_key,delta:part.required_qty*5,reason:'Local fixture',name:part.name},token)).status,200);}
    assert.equal((await api('allocate',{shopId,eventId,allocations},token)).status,200);
    for(const part of bom)assert.equal(stockAvailability((await db.doc(`shops/${shopId}/inventory/${part.component_key}`).get()).data()).workshopAvailable,0);
    const payload={shopId,eventId,idempotencyKey:'fixture-order',customerName:'Fixture only',items:[{productId:'clicker',quantity:1,customization}]};
    const [first,retry]=await Promise.all([api('submit',payload),api('submit',payload)]);assert.equal(first.status,200);assert.deepEqual(first.data,retry.data);
    assert.equal((await api('orders',{shopId,eventId},token)).data.orders.length,1);
    const req={shopId,orderId:first.data.orderId};
    assert.equal((await api('transition',{...req,action:'accept'})).status,401);
    assert.equal((await api('transition',{...req,shopId:'shop_stranger',action:'accept'},token)).status,400);
    const other=await api('submit',{...payload,eventId:'bazaar2026',idempotencyKey:'other-event'});assert.equal(other.status,200);
    const rejected=await api('transition',{shopId,orderId:other.data.orderId,action:'accept'},token);assert.equal(rejected.status,400);assert.match(rejected.data.message,/Event available 0/);
    for(const action of ['accept','accept','prepare','prepare','ready','collect','collect'])assert.equal((await api('transition',{...req,action},token)).status,200);
    for(const part of bom)assert.equal((await db.doc(`shops/${shopId}/inventory/${part.component_key}`).get()).data().on_hand,part.required_qty*4);
    const tracking=(await db.doc('order_tracking/'+first.data.trackingToken).get()).data();assert.equal(tracking.fulfillmentStatus,'collected');assert.equal(tracking.paymentStatus,'unpaid');
    const cancellation=await api('submit',{...payload,idempotencyKey:'cancel-order'});const cancelReq={shopId,orderId:cancellation.data.orderId};
    await api('transition',{...cancelReq,action:'accept'},token);await api('transition',{...cancelReq,action:'cancel',reason:'Fixture cancellation'},token);
    const cancelledAllocation=(await db.doc(`shops/${shopId}/event_allocations/${eventId}`).get()).data();assert.ok(Object.values(cancelledAllocation.reservations).every(v=>v===0));
    const legacy=await api('submit',{...payload,idempotencyKey:'legacy-order'}), legacyPath=db.doc(`shops/${shopId}/orders/${legacy.data.orderId}`);
    const original=(await legacyPath.get()).data();const broken=structuredClone(original.items);broken[0].requiredBOM[0].component_key='finished_undefined';
    await legacyPath.update({items:broken,inventoryVersion:0});
    assert.equal((await api('transition',{shopId,orderId:legacy.data.orderId,action:'accept'},token)).status,400);
    const mappings=original.items.flatMap((item,itemIndex)=>item.requiredBOM.map((part,partIndex)=>({itemIndex,partIndex,component_key:part.component_key})));
    const review=await api('reconcile',{shopId,orderId:legacy.data.orderId,expectedUpdatedAt:original.updatedAt,mappings,reason:'Verified same physical variants in local fixture',confirmed:true},token);assert.equal(review.status,200,review.data.message);
    assert.equal((await db.doc(`shops/${shopId}/order_reconciliations/${legacy.data.orderId}_1`).get()).data().originalItems[0].requiredBOM[0].component_key,'finished_undefined');
    assert.equal((await api('transition',{shopId,orderId:legacy.data.orderId,action:'accept'},token)).status,200);
    assert.equal((await api('reconcile',{shopId,orderId:legacy.data.orderId,expectedUpdatedAt:review.data.updatedAt,mappings,reason:'Cannot double reserve',confirmed:true},token)).status,400);
    const guest=env.unauthenticatedContext().firestore(),owner=env.authenticatedContext('seller').firestore(),stranger=env.authenticatedContext('stranger').firestore();
    await assertSucceeds(getDoc(doc(owner,`shops/${shopId}/orders/${first.data.orderId}`)));
    await assertFails(getDoc(doc(stranger,`shops/${shopId}/orders/${first.data.orderId}`)));
    for(const client of [guest,owner,stranger])for(const path of [`shops/${shopId}/orders/forged`,`shops/${shopId}/inventory/cap_A_teal`,`shops/${shopId}/event_allocations/${eventId}`,`shops/${shopId}/order_reconciliations/forged`])await assertFails(setDoc(doc(client,path),{on_hand:999,paymentStatus:'paid'}));
    await assertSucceeds(getDoc(doc(guest,'order_tracking/'+first.data.trackingToken)));await assertFails(getDocs(collection(guest,'order_tracking')));
    await db.doc(`shops/${shopId}/events/${eventId}`).update({pendingQueueCapacity:1});
    await api('submit',{...payload,idempotencyKey:'queue-slot'});
    const full=await api('submit',{...payload,idempotencyKey:'queue-overflow'});assert.equal(full.status,400);assert.match(full.data.message,/queue is full/);
    const offline=await fetch('http://127.0.0.1:5191/health');assert.equal(offline.status,200);
    console.log('PASS: HTTP guest checkout, Firebase token verification, two-event conservation, repeated letters, idempotency, queue limits, seller retrieval, lifecycle, cancellation, legacy reconciliation, immutable audit, tracking and owner/guest rule isolation.');
} finally {await new Promise(resolve=>server.close(resolve));await env.cleanup();}
