import test from 'node:test';
import assert from 'node:assert/strict';
import { submitOrder, transitionOrder, allocateStock, adjustStock, aggregateBOM } from '../src/engine/bazaar/orderWorkflow.js';
import { calculateItemPrice } from '../src/engine/bazaar/pricing.js';
import { decomposeProductBOM } from '../src/engine/bazaar/bom.js';
import { publicClickerOptions, validateClickerConfiguration } from '../src/engine/bazaar/configuration.js';

const product = { productId: 'clicker', name: 'Personalized Clicker', shopId: 'shop_seller', type: 'made_to_order', status: 'active', isPublished: true, retailPrice: 100,
    customizationOptions: { available_slots: [2,4], allowed_characters: 'KENAB', colors: [{id:'pink',name:'Pink',hex:'#ff99cc'}, {id:'blue',name:'Blue',hex:'#1199ff', extraPrice:2}], base_colors: [{id:'black',name:'Black',hex:'#111111'}], casing_styles:[{id:'standard',name:'Standard'}], switches:[{consumableId:'mx',name:'Switch',extraPrice:3,unitCost:99,stockQty:10}], add_ons:[{id:'ring',name:'Ring',price:5}], base_included_letters:2,extra_per_letter_price:10, slot_pricing:{2:0,4:20} } };
const customization = { slots:4, text:'KENA', casing_color:'black',casing_style_id:'standard',switch_type_id:'mx',selected_add_on_ids:['ring'], slotsData: Array.from('KENA', (char,i)=>({char,colorId:i%2?'blue':'pink',switchId:'mx'})) };
const payload = { shopId:'shop_seller',eventId:'ev_one',idempotencyKey:'request-one',customerName:'Fixture', items:[{productId:'clicker',quantity:1,customization}], estimatedTotal:1 };
function fixture() {
    const records = new Map([
        ['shops/shop_seller',{ownerUid:'seller',isPublished:true}],
        ['shops/shop_seller/products/clicker',structuredClone(product)],
        ['shops/shop_seller/events/ev_one',{shopId:'shop_seller',status:'Active',isPublished:true,catalog:{clicker:{enabled:true,price_override:90}}}],
    ]);
    for (const part of decomposeProductBOM({product,customization})) records.set('shops/shop_seller/inventory/'+part.component_key,{on_hand:0,reserved:0,total_allocated_to_events:0});
    let sequence = Promise.resolve();
    const store = { records, denyTracking:false, transaction(callback) {
        const execution = sequence.then(async()=>{
            const pending = new Map(); let wrote = false;
            const result = await callback({list:async(path,filters={})=>{assert.equal(wrote,false);return [...records].filter(([key,value])=>key.startsWith(path+'/') && key.split('/').length===path.split('/').length+1 && Object.entries(filters).every(([k,v])=>(value[k] ?? null)===v)).map(([,value])=>structuredClone(value));},get:async path=>{assert.equal(wrote,false,'Firestore requires reads before writes');return structuredClone(records.get(path)||null);},set:(path,value)=>{
                wrote = true;
                if(store.denyTracking && path.startsWith('order_tracking/'))throw Object.assign(new Error('Tracking write denied'),{code:'permission-denied'});
                pending.set(path,structuredClone(value));
            }});
            for(const [key,value]of pending)records.set(key,value);
            return result;
        });
        sequence = execution.catch(()=>{}); return execution;
    }};
    return store;
}
async function stocked() {
    const store=fixture(), allocations={};
    for(const part of decomposeProductBOM({product,customization})){
        await adjustStock(store,'seller',{shopId:'shop_seller',itemKey:part.component_key,delta:20,name:part.name,reason:'Fixture initial stock'});
        allocations[part.component_key]=10;
    }
    await allocateStock(store,'seller',{shopId:'shop_seller',eventId:'ev_one',allocations});
    return store;
}
test('seller options preserve product choices and strip nested private stock/costs',()=>{
    const schema=publicClickerOptions(product);
    assert.equal(schema.allowed_switch_types[0].id,'mx');
    assert.equal('unitCost'in schema.allowed_switch_types[0],false);
    assert.equal('stockQty'in schema.allowed_switch_types[0],false);
    assert.deepEqual(schema.available_slots,[2,4]);
});
test('customization pricing and BOM use configured per-slot options and inventory SKU names',()=>{
    assert.equal(calculateItemPrice({product,customization,quantity:2}).totalPrice,322);
    const bom=decomposeProductBOM({product,customization});
    assert.ok(bom.some(p=>p.component_key==='base_casing_black_4key'));
    assert.equal(bom.find(p=>p.component_key==='consumable_mx').required_qty,4);
    const repeated={...customization,text:'KAKA',slotsData:customization.slotsData.map(s=>({...s,char:'K',colorId:'pink'}))};
    assert.equal(decomposeProductBOM({product,customization:repeated,quantity:2}).find(p=>p.component_key==='cap_K_pink').required_qty,8);
    assert.throws(()=>validateClickerConfiguration(product,{...customization,slots:3}),/slot count/);
    assert.throws(()=>validateClickerConfiguration(product,{...customization,slotsData:customization.slotsData.map(s=>({...s,colorId:'forged'}))}),/color/);
});
test('event customer to seller fulfillment is atomic and each stock movement occurs once',async()=>{
    const store=await stocked();
    const [first,retry]=await Promise.all([submitOrder(store,payload),submitOrder(store,payload)]);
    assert.deepEqual(first,retry);assert.equal(first.totalAmount,151);
    const req={shopId:'shop_seller',orderId:first.orderId};
    await transitionOrder(store,'seller',{...req,action:'accept'});
    await transitionOrder(store,'seller',{...req,action:'accept'});
    assert.equal(store.records.get('shops/shop_seller/event_allocations/ev_one').reservations.consumable_mx,4);
    await transitionOrder(store,'seller',{...req,action:'prepare'});
    await transitionOrder(store,'seller',{...req,action:'prepare'});
    assert.equal(store.records.get('shops/shop_seller/inventory/consumable_mx').on_hand,16);
    await transitionOrder(store,'seller',{...req,action:'ready'});
    await transitionOrder(store,'seller',{...req,action:'collect'});
    assert.equal(store.records.get('order_tracking/'+first.trackingToken).fulfillmentStatus,'collected');
    assert.equal([...store.records.keys()].filter(p=>p.includes('/orders/')).length,1);
});
test('tracking failure cannot leave a partial committed order; retry and lost response return same result',async()=>{
    const store=fixture();store.denyTracking=true;
    await assert.rejects(submitOrder(store,payload),/denied/);
    assert.equal([...store.records.keys()].filter(p=>p.includes('/orders/')).length,0);
    store.denyTracking=false;
    const committed=await submitOrder(store,payload);
    assert.deepEqual(await submitOrder(store,payload),committed);
    await assert.rejects(submitOrder(store,{...payload,items:[{...payload.items[0],quantity:2}]}),/different cart/);
});
test('pending decline does not consume stock, preserves reason and rejects cross-account changes',async()=>{
    const store=fixture(),order=await submitOrder(store,payload);
    const req={shopId:'shop_seller',orderId:order.orderId,action:'cancel',reason:'Unable to fulfill'};
    await assert.rejects(transitionOrder(store,'intruder',req),/belong/);
    const rejected=await transitionOrder(store,'seller',req);
    assert.equal(rejected.fulfillmentStatus,'rejected');assert.equal(rejected.cancellationReason,req.reason);
    assert.ok([...store.records].filter(([p])=>p.includes('/inventory/')).every(([,v])=>v.on_hand===0));
    assert.equal(store.records.get('order_tracking/'+order.trackingToken).fulfillmentStatus,'rejected');
});
test('missing event stock reports component and blocks acceptance without mutations',async()=>{
    const store=fixture(),order=await submitOrder(store,payload);
    await assert.rejects(transitionOrder(store,'seller',{shopId:'shop_seller',orderId:order.orderId,action:'accept'}),/Pink keycap K.*Required 1, Event available 0/);
    assert.equal(store.records.get(`shops/shop_seller/orders/${order.orderId}`).fulfillmentStatus,'pending');
});
test('shop orders cannot consume event-allocated stock; event allocations cannot overcommit',async()=>{
    const store=await stocked();
    const direct=await submitOrder(store,{...payload,eventId:null,items:[{...payload.items[0],quantity:3}]});
    await assert.rejects(transitionOrder(store,'seller',{shopId:'shop_seller',orderId:direct.orderId,action:'accept'}),/Shop available/);
    await assert.rejects(allocateStock(store,'seller',{shopId:'shop_seller',eventId:'ev_one',allocations:{consumable_mx:99}}),/shop available/);
});
test('unpublished events, disabled catalog items and invalid variants fail before writes',async()=>{
    const store=fixture();const ev=store.records.get('shops/shop_seller/events/ev_one');ev.isPublished=false;
    await assert.rejects(submitOrder(store,payload),/not accepting/);ev.isPublished=true;ev.catalog.clicker.enabled=false;
    await assert.rejects(submitOrder(store,payload),/unavailable/);
    assert.throws(()=>calculateItemPrice({product:{...product,type:'ready_made',variants:[{id:'pink',price:99}]},customization:{selected_variant_id:'wrong'}}),/variant/);
    assert.equal(aggregateBOM([{requiredBOM:[{component_key:'x',required_qty:1}]},{requiredBOM:[{component_key:'x',required_qty:2}]}])[0].required_qty,3);
});

test('missing inventory references cannot create an order or tracking document',async()=>{
    const store=fixture();store.records.delete('shops/shop_seller/inventory/cap_K_pink');
    await assert.rejects(submitOrder(store,payload),/inventory reference cap_K_pink does not exist/);
    assert.equal([...store.records.keys()].some(p=>p.includes('/orders/') || p.startsWith('order_tracking/')),false);
    assert.throws(()=>aggregateBOM([{requiredBOM:[{component_key:'finished_undefined',required_qty:1}]}]),/review/);
});

test('seller library is resolved at checkout; archived artwork is unavailable and snapshots survive rename',async()=>{
    const store=fixture();
    const master=store.records.get('shops/shop_seller/products/clicker');
    master.customizationOptions.icon_caps_enabled=true;
    master.customizationOptions.available_icons=[{id:'cat',libraryId:'art-cat',name:'Old name',imageUrl:'https://example.test/stale.png'}];
    const art={name:'Seller cat',imageUrl:'https://example.test/current.png',fulfillmentMode:'preprinted',inventorySku:'cat_ready',archived:false};
    store.records.set('shops/shop_seller/icons/art-cat',art);
    store.records.set('shops/shop_seller/inventory/cat_ready',{on_hand:1});
    const orderRequest={...payload,items:[{...payload.items[0],customization:{...customization,slotsData:customization.slotsData.map((s,i)=>i===0?{type:'icon',iconId:'cat',imageUrl:'https://example.test/forged.png'}:s)}}]};
    const result=await submitOrder(store,orderRequest);
    const slot=store.records.get(`shops/shop_seller/orders/${result.orderId}`).items[0].customization.slotsData[0];
    assert.equal(slot.iconName,'Seller cat');assert.equal(slot.imageUrl,art.imageUrl);
    art.name='Renamed';art.archived=true;
    assert.equal(slot.iconName,'Seller cat');
    await assert.rejects(submitOrder(store,{...orderRequest,idempotencyKey:'archived-request'}),/configured icon/);
    assert.deepEqual(await submitOrder(store,orderRequest),result);
});
