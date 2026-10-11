import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { submitOrder, transitionOrder, adjustStock } from '../src/engine/bazaar/orderWorkflow.js';
if (process.env.GCLOUD_PROJECT !== 'demo-kencreations-audit' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Local demo emulator required.');
const env=await initializeTestEnvironment({projectId:'demo-kencreations-audit',firestore:{host:'127.0.0.1',port:8080,rules:await fs.readFile('docs/firestore.bazaar-candidate.rules','utf8')}});
try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context=>{
        const db=context.firestore();
        await setDoc(doc(db,'shops/shop_seller/inventory/finished_finished'),{on_hand:0,reserved:0,total_allocated_to_events:0});
        await setDoc(doc(db,'shops/shop_seller'),{ownerUid:'seller',isPublished:true});
        await setDoc(doc(db,'shops/shop_seller/products/finished'),{productId:'finished',name:'Finished fixture',type:'ready_made',status:'active',isPublished:true,retailPrice:100});
    });
    const store={transaction:callback=>env.withSecurityRulesDisabled(context=>{
        const db=context.firestore();
        return runTransaction(db,tx=>callback({get:async path=>{const snap=await tx.get(doc(db,path));return snap.exists()?snap.data():null;},set:(path,data)=>tx.set(doc(db,path),data)}));
    })};
    const payload={shopId:'shop_seller',idempotencyKey:'fixture-request',customerName:'Fixture only',items:[{productId:'finished',quantity:1}]};
    const [a,b]=await Promise.all([submitOrder(store,payload),submitOrder(store,payload)]);
    assert.equal(a.orderId,b.orderId);
    const owner=env.authenticatedContext('seller',{bazaarHub:true}).firestore(), stranger=env.authenticatedContext('stranger',{bazaarHub:true}).firestore(), guest=env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(owner,`shops/shop_seller/orders/${a.orderId}`)));
    await assertFails(getDoc(doc(stranger,`shops/shop_seller/orders/${a.orderId}`)));
    await assertFails(setDoc(doc(guest,'shops/shop_seller/orders/forged'),{totalAmount:1}));
    await assertFails(setDoc(doc(owner,'shops/shop_seller/inventory/finished_finished'),{on_hand:999}));
    await assertFails(updateDoc(doc(owner,`shops/shop_seller/orders/${a.orderId}`),{paymentStatus:'paid'}));
    await assertFails(getDocs(collection(guest,'order_tracking')));
    await assertSucceeds(getDoc(doc(guest,`order_tracking/${a.trackingToken}`)));
    await adjustStock(store,'seller',{shopId:'shop_seller',itemKey:'finished_finished',delta:2,reason:'Deterministic fixture restock'});
    for(const action of ['accept','prepare','ready','collect'])await transitionOrder(store,'seller',{shopId:'shop_seller',orderId:a.orderId,action});
    assert.equal((await getDoc(doc(guest,`order_tracking/${a.trackingToken}`))).data().fulfillmentStatus,'collected');
    const declined=await submitOrder(store,{...payload,idempotencyKey:'fixture-decline'});
    await transitionOrder(store,'seller',{shopId:'shop_seller',orderId:declined.orderId,action:'cancel',reason:'Fixture decline'});
    assert.equal((await getDoc(doc(guest,`order_tracking/${declined.trackingToken}`))).data().fulfillmentStatus,'rejected');
    console.log('PASS: real transactions, duplicate submit, full lifecycle, decline, cross-account denial, protected stock/payment and tracking capability rules.');
} finally {await env.cleanup();}
