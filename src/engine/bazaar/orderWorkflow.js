import { stockAvailability } from './stockAvailability.js';
import { validComponentKey } from './icons.js';
import { calculateItemPrice } from './pricing.js';
import { decomposeProductBOM } from './bom.js';
import { canonicalClickerConfiguration } from './configuration.js';

const fail = message => { throw new Error(message); };
const integer = value => Number.isSafeInteger(value) && value > 0;
const segment = value => typeof value === 'string' && /^[\w-]{1,160}$/.test(value);
export function aggregateBOM(items) {
    const parts = new Map();
    for (const item of items) for (const part of item.requiredBOM || []) {
        if (!validComponentKey(part.component_key) || !integer(part.required_qty)) fail('Invalid component requirement. Seller must review this order.');
        const old = parts.get(part.component_key);
        parts.set(part.component_key, { ...part, required_qty: (old?.required_qty || 0) + part.required_qty });
    }
    return [...parts.values()];
}
export function trackingProjection(order) {
    return {
        shopId: order.shopId, sellerUid: order.sellerUid, orderId: order.orderId,
        orderNumber: order.orderNumber, fulfillmentStatus: order.fulfillmentStatus,
        paymentStatus: order.paymentStatus, pickupCode: order.pickupCode,
        pickupInstructions: order.pickupInstructions || '',
        itemsSummary: order.items.map(item => ({ title: item.productName, summary: `${item.quantity} × ${item.customization?.text || item.productName}` })),
        expiresAt: order.expiresAt, revoked: false, updatedAt: order.updatedAt,
    };
}

// TRUSTED execution only. `store.transaction` must commit all writes atomically
// and retry conflicts. No browser SDK or customer-supplied prices are trusted.
export async function submitOrder(store, payload, { now = Date.now(), uuid = () => crypto.randomUUID() } = {}) {
    if (!segment(payload.shopId) || !segment(payload.idempotencyKey) || !Array.isArray(payload.items) || !payload.items.length || payload.items.length > 30) fail('Invalid checkout request.');
    if (payload.eventId && !segment(payload.eventId)) fail('Invalid event.');
    const requestPath = `shops/${payload.shopId}/order_requests/${payload.idempotencyKey}`;
    const orderId = `ord_${uuid()}`, trackingToken = `trk_${uuid()}`;
    return store.transaction(async tx => {
        const previous = await tx.get(requestPath);
        const fingerprint = JSON.stringify([payload.eventId || null, payload.items.map(i => [i.productId, i.quantity, i.customization, i.selectedVariant?.id])]);
        if (previous) {
            if (previous.fingerprint !== fingerprint) fail('This request key belongs to a different cart. Reconcile the previous order first.');
            return previous.result;
        }
        const shop = await tx.get(`shops/${payload.shopId}`);
        if (!shop || !(shop.isPublished === true || shop.is_published === true)) fail('This shop is unpublished.');
        const event = payload.eventId ? await tx.get(`shops/${payload.shopId}/events/${payload.eventId}`) : null;
        if (payload.eventId && (!event || event.shopId !== payload.shopId || event.isPublished === false || ['Ended', 'Draft'].includes(event.status) || ['closed', 'paused', 'unpublished'].includes(event.queueStatus) || event.isAcceptingOrders === false)) fail('This event is not accepting orders.');
        const queuePath = `shops/${payload.shopId}/queue_locks/${payload.eventId || 'general'}`;
        const queueLock = await tx.get(queuePath);
        const queuedOrders = await tx.list(`shops/${payload.shopId}/orders`, {eventId:payload.eventId || null});
        const pendingCount = queuedOrders.filter(order=>order.fulfillmentStatus==='pending').length;
        const pendingLimit = Number(event?.pendingQueueCapacity ?? shop.pendingQueueCapacity ?? 10);
        if (!Number.isSafeInteger(pendingLimit) || pendingLimit<1 || pendingCount>=pendingLimit) fail('The order queue is full. Please try again shortly.');
        if ((payload.paymentMethod==='gcash' && shop.gcashEnabled!==true) || (payload.paymentMethod!=='gcash' && shop.cashEnabled===false)) fail('This payment method is unavailable.');
        const items = [];
        for (const input of payload.items) {
            if (!segment(input.productId) || !integer(input.quantity)) fail('Invalid product or quantity.');
            let product = await tx.get(`shops/${payload.shopId}/products/${input.productId}`);
            const eventConfig = event?.catalog?.[input.productId];
            if (!product || product.status !== 'active' || product.isPublished !== true || (event && (!eventConfig || eventConfig.enabled !== true))) fail('A product is unavailable in this catalog.');
            if (input.quantity > Math.min(product.maxOrderQty || 10, eventConfig?.max_order_qty || 100)) fail('Quantity exceeds the seller limit.');
            if (!['made_to_order', 'ready_made'].includes(product.type)) fail('Seller must configure the product type.');
            const options = product.customizationOptions || product.customization_schema;
            if (options?.available_icons?.some(icon => icon?.libraryId)) {
                const icons = [];
                for (const icon of options.available_icons) {
                    if (!icon?.libraryId) { icons.push(icon); continue; }
                    if (!segment(icon.libraryId)) fail('Invalid seller icon reference.');
                    const current = await tx.get(`shops/${payload.shopId}/icons/${icon.libraryId}`);
                    // Archived icons are omitted, so selecting one fails normal configuration validation.
                    if (current && !current.archived) icons.push({...current,id:icon.id,libraryId:icon.libraryId});
                }
                product = {...product,customizationOptions:{...options,available_icons:icons}};
            }
            const customization = product.type === 'made_to_order' ? canonicalClickerConfiguration(product, input.customization || {}) : {};
            if (product.type === 'ready_made') customization.selected_variant_id = input.selectedVariant?.id || input.customization?.selected_variant_id || '';
            const priced = calculateItemPrice({ product, customization, eventConfig, quantity: input.quantity });
            const requiredBOM = decomposeProductBOM({ product: { ...product, productId: input.productId }, customization, quantity: input.quantity });
            items.push({ productId: input.productId, productName: product.name, type: product.type, quantity: input.quantity, customization, authoritativeUnitPrice: priced.unitPrice, lineTotal: priced.totalPrice, requiredBOM });
        }
        for (const part of aggregateBOM(items)) {
            const stock = await tx.get(`shops/${payload.shopId}/inventory/${part.component_key}`);
            if (!stock) fail(`Seller configuration needs review: inventory reference ${part.component_key} does not exist. No order was created.`);
        }
        const order = {
            shopId: payload.shopId, sellerUid: shop.ownerUid, eventId: payload.eventId || null,
            orderId, orderNumber: orderId.slice(4, 12).toUpperCase(), pickupCode: uuid().replace(/-/g, '').slice(0, 8).toUpperCase(), trackingToken,
            customerName: String(payload.customerName || '').trim().slice(0, 120), customerContact: String(payload.customerContact || '').slice(0, 200),
            orderNotes: String(payload.orderNotes || '').slice(0, 1000), paymentMethod: payload.paymentMethod === 'gcash' ? 'gcash' : 'cash',
            fulfillmentStatus: 'pending', paymentStatus: 'unpaid', inventoryVersion:1, items,
            totalAmount: Math.round(items.reduce((n, i) => n + i.lineTotal, 0) * 100) / 100,
            pickupInstructions: event?.pickupInstructions || shop.pickupInstructions || '',
            submittedAt: now, updatedAt: now, expiresAt: now + 30 * 86400000,
        };
        if (!order.customerName || !order.sellerUid) fail('Pickup name and seller ownership are required.');
        const result = { success: true, orderId, orderNumber: order.orderNumber, trackingToken, pickupCode: order.pickupCode, totalAmount: order.totalAmount };
        // All reads precede writes. Idempotency result and tracking commit together.
        tx.set(`shops/${payload.shopId}/orders/${orderId}`, order);
        tx.set(`order_tracking/${trackingToken}`, trackingProjection(order));
        tx.set(requestPath, { fingerprint, result, createdAt: now });
        tx.set(queuePath,{revision:(queueLock?.revision || 0)+1});
        return result;
    });
}

export async function transitionOrder(store, uid, { shopId, orderId, action, reason = '', recoverStock = false }, now = Date.now()) {
    if (!uid || !segment(shopId) || !segment(orderId)) fail('Authenticated seller and order are required.');
    return store.transaction(async tx => {
        const path = `shops/${shopId}/orders/${orderId}`;
        const shop = await tx.get(`shops/${shopId}`), order = await tx.get(path);
        if (!shop || shop.ownerUid !== uid || !order || order.sellerUid !== uid || order.shopId !== shopId) fail('This order does not belong to this seller.');
        const states = { accept: ['pending','accepted'], prepare: ['accepted','preparing'], ready: ['preparing','ready'], collect: ['ready','collected'] };
        const current = order.fulfillmentStatus;
        const target = action === 'cancel' ? (current === 'pending' || current === 'rejected' ? 'rejected' : 'cancelled') : states[action]?.[1];
        if (!target) fail('Invalid order action.');
        if (current === target) return order;
        if (action === 'cancel') {
            if (!['pending','accepted','preparing','ready'].includes(current) || !reason.trim()) fail('A reason and eligible order state are required.');
            if (recoverStock) fail('Consumed components require an explicit inspected inventory adjustment; automatic recovery is disabled.');
        } else if (current !== states[action][0]) fail(`Cannot ${action} an order with status ${current}.`);
        if (action === 'accept') {
            if (order.inventoryVersion !== 1) fail('Legacy order requires verified inventory reconciliation before acceptance.');
            const event = order.eventId ? await tx.get(`shops/${shopId}/events/${order.eventId}`) : null;
            const queue = await tx.list(`shops/${shopId}/orders`, {eventId:order.eventId || null});
            const active = queue.filter(o=>['accepted','preparing'].includes(o.fulfillmentStatus)).length;
            const capacity = Number(event?.activeProductionCapacity ?? shop.activeProductionCapacity ?? 5);
            if (!Number.isSafeInteger(capacity) || capacity<1 || active>=capacity) fail('Production capacity is full. Keep this order pending until a slot is available.');
        }
        const changeStock = action === 'accept' || action === 'prepare' || (action === 'cancel' && current === 'accepted');
        const allocationPath = order.eventId ? `shops/${shopId}/event_allocations/${order.eventId}` : null;
        const allocation = allocationPath ? (await tx.get(allocationPath) || { allocations: {}, reservations: {}, consumed: {} }) : null;
        const stockUpdates = [];
        const resolvedItems = (order.items || []).map(item => {
            if (item.requiredBOM && item.requiredBOM.length > 0) return item;
            try {
                const bom = decomposeProductBOM({ product: item, customization: item.customization, quantity: item.quantity });
                return { ...item, requiredBOM: bom };
            } catch {
                return item;
            }
        });
        if (changeStock) for (const part of aggregateBOM(resolvedItems)) {
            const key = part.component_key, quantity = part.required_qty, stockPath = `shops/${shopId}/inventory/${key}`;
            const stock = await tx.get(stockPath);
            const physical = Number(stock?.on_hand ?? stock?.physical_on_hand ?? 0);
            const reserved = Number(stock?.reserved || 0), allocated = Number(stock?.total_allocated_to_events || 0);
            const eventReserved = Number(allocation?.reservations?.[key] || 0), consumed = Number(allocation?.consumed?.[key] || 0);
            const state = stockAvailability(stock || {},allocation,key);
            if (stock && !state.valid) fail(`Stock balances for ${key} need seller reconciliation.`);
            const available = state.available;
            if (!stock || (action === 'accept' && (available < quantity || physical < quantity))) fail(`Cannot accept: ${part.name || key} [${key}] — Required ${quantity}, ${allocation ? 'Event' : 'Shop'} available ${Math.max(0, available)}.`);
            const next = { ...stock, updated_at: now };
            if (action === 'accept') {
                if (allocation) allocation.reservations = { ...allocation.reservations, [key]: eventReserved + quantity };
                else next.reserved = reserved + quantity;
            } else {
                if ((allocation ? eventReserved : reserved) < quantity) fail(`Inconsistent reservation for ${part.name || key}. Review inventory before continuing.`);
                if (allocation) allocation.reservations = { ...allocation.reservations, [key]: eventReserved - quantity };
                else next.reserved = reserved - quantity;
                if (action === 'prepare') {
                    if (physical < quantity || (allocation && allocated < quantity)) fail(`Inconsistent physical stock for ${part.name || key}.`);
                    next.on_hand = physical - quantity; next.physical_on_hand = next.on_hand;
                    if (allocation) {
                        allocation.consumed = { ...allocation.consumed, [key]: consumed + quantity };
                        next.total_allocated_to_events = allocated - quantity;
                    }
                }
            }
            stockUpdates.push({ path: stockPath, data: next, part });
        }
        const updated = { ...order, items: resolvedItems, fulfillmentStatus: target, updatedAt: now, ...(action === 'cancel' ? { cancellationReason: reason.trim(), cancelledAt: now } : {}) };
        for (const update of stockUpdates) {
            tx.set(update.path, update.data);
            tx.set(`shops/${shopId}/inventory_movements/${orderId}_${action}_${encodeURIComponent(update.part.component_key)}`, { shopId, ownerUid: uid, orderId, itemKey: update.part.component_key, type: action, qty: update.part.required_qty, createdAt: now });
        }
        if (allocationPath && changeStock) tx.set(allocationPath, allocation);
        tx.set(path, updated);
        if (!order.trackingToken) fail('Order has no tracking capability. Reconcile this legacy order before changing status.');
        tx.set(`order_tracking/${order.trackingToken}`, trackingProjection(updated));
        return updated;
    });
}

export async function allocateStock(store, uid, { shopId, eventId, allocations }, now = Date.now()) {
    if (!segment(shopId) || !segment(eventId) || !allocations || typeof allocations !== 'object') fail('Invalid allocation.');
    return store.transaction(async tx => {
        const shop = await tx.get(`shops/${shopId}`), event = await tx.get(`shops/${shopId}/events/${eventId}`);
        if (shop?.ownerUid !== uid || event?.shopId !== shopId) fail('Event ownership could not be verified.');
        const path = `shops/${shopId}/event_allocations/${eventId}`;
        const old = await tx.get(path) || { allocations: {}, reservations: {}, consumed: {} };
        const updates = [];
        for (const key of new Set([...Object.keys(old.allocations || {}), ...Object.keys(allocations)])) {
            if (!validComponentKey(key)) fail('Invalid SKU.');
            const amount = allocations[key] ?? 0;
            if (!Number.isSafeInteger(amount) || amount < 0) fail('Allocation must be a nonnegative integer.');
            const reserved = old.reservations?.[key] || 0, consumed = old.consumed?.[key] || 0;
            if (amount < reserved + consumed) fail(`Cannot remove committed allocation for ${key}.`);
            const stockPath = `shops/${shopId}/inventory/${key}`, stock = await tx.get(stockPath);
            const delta = amount - (old.allocations?.[key] || 0);
            const available = (stock?.on_hand || 0) - (stock?.reserved || 0) - (stock?.total_allocated_to_events || 0);
            if (!stock || delta > available) fail(`Cannot allocate ${key}: requested increase ${delta}, shop available ${Math.max(0, available)}.`);
            const total = (stock.total_allocated_to_events || 0) + delta;
            if (total < 0) fail(`Legacy allocation totals for ${key} need reconciliation.`);
            updates.push([stockPath, { ...stock, total_allocated_to_events: total, updated_at: now }]);
        }
        for (const [stockPath, stock] of updates) tx.set(stockPath, stock);
        const next = { ...old, allocations, shopId, eventId, ownerUid: uid, updatedAt: now };
        tx.set(path, next);
        return next.allocations;
    });
}

export async function adjustStock(store, uid, { shopId, itemKey, delta, name, itemType, reason, char = '', color = '', lowThreshold = 5 }, now = Date.now()) {
    if (!segment(shopId) || !validComponentKey(itemKey) || !Number.isSafeInteger(delta) || delta === 0 || !reason?.trim()) fail('SKU, integer adjustment and reason are required.');
    return store.transaction(async tx => {
        const shop = await tx.get(`shops/${shopId}`);
        if (shop?.ownerUid !== uid) fail('Stock does not belong to this seller.');
        const path = `shops/${shopId}/inventory/${itemKey}`;
        const old = await tx.get(path) || { on_hand: 0, reserved: 0, total_allocated_to_events: 0 };
        const onHand = old.on_hand + delta;
        if (onHand < (old.reserved || 0) + (old.total_allocated_to_events || 0)) fail('Adjustment would remove reserved or event-allocated stock.');
        const stock = { ...old, shopId, ownerUid: uid, item_key: itemKey, name: name || old.name || itemKey, item_type: itemType || old.item_type || 'component', char, color, low_threshold: lowThreshold, on_hand: onHand, physical_on_hand: onHand, updated_at: now };
        tx.set(path, stock);
        tx.set(`shops/${shopId}/inventory_movements/adjust_${crypto.randomUUID()}`, { shopId, ownerUid: uid, itemKey, type: 'adjustment', qty: delta, reason, createdAt: now });
        return stock;
    });
}

export async function reconcileOrder(store, uid, {shopId,orderId,expectedUpdatedAt=null,mappings,reason,confirmed=false}, now=Date.now()) {
    if (!uid || !segment(shopId) || !segment(orderId) || !confirmed || !reason?.trim() || !Array.isArray(mappings) || !mappings.length) fail('Review the original order, confirm matching variants and provide a reconciliation reason.');
    return store.transaction(async tx=>{
        const path=`shops/${shopId}/orders/${orderId}`;
        const shop=await tx.get(`shops/${shopId}`), order=await tx.get(path);
        if (shop?.ownerUid!==uid || order?.sellerUid!==uid || order?.shopId!==shopId) fail('This order does not belong to this seller.');
        const version=value=>value?.toMillis?.() ?? (value?.seconds!=null ? value.seconds*1000+Math.floor((value.nanoseconds || 0)/1000000) : value ?? null);
        if (version(order.updatedAt)!==version(expectedUpdatedAt)) fail('This order changed. Reload it before reconciling.');
        const movements=await tx.list(`shops/${shopId}/inventory_movements`,{orderId});
        const originalParts=order.items?.flatMap((item,itemIndex)=>{
            let itemBOM = item.requiredBOM;
            if (!itemBOM || !itemBOM.length) {
                try {
                    itemBOM = decomposeProductBOM({ product: item, customization: item.customization, quantity: item.quantity });
                } catch {
                    itemBOM = [];
                }
            }
            return (itemBOM || []).map((part,partIndex)=>({itemIndex,partIndex,part}));
        }) || [];
        if(!originalParts.length || mappings.length!==originalParts.length) fail('Every original component must be mapped. Orders without an original BOM require a separate manual audit.');
        const items=structuredClone(order.items).map(item => {
            if (item.requiredBOM && item.requiredBOM.length > 0) return item;
            try {
                const bom = decomposeProductBOM({ product: item, customization: item.customization, quantity: item.quantity });
                return { ...item, requiredBOM: bom };
            } catch {
                return { ...item, requiredBOM: [] };
            }
        }), seen=new Set();
        for(const mapping of mappings) {
            const identity=`${mapping.itemIndex}:${mapping.partIndex}`;
            const original=originalParts.find(p=>p.itemIndex===mapping.itemIndex && p.partIndex===mapping.partIndex)?.part;
            if(!original || seen.has(identity) || !validComponentKey(mapping.component_key) || !integer(original.required_qty)) fail('Mappings must preserve each original component quantity exactly.');
            seen.add(identity);
            const stock=await tx.get(`shops/${shopId}/inventory/${mapping.component_key}`);
            if(!stock) fail(`Inventory item ${mapping.component_key} does not exist.`);
            items[mapping.itemIndex].requiredBOM[mapping.partIndex]={...original,component_key:mapping.component_key,name:stock.name || mapping.component_key};
        }
        const allocation=order.eventId ? await tx.get(`shops/${shopId}/event_allocations/${order.eventId}`) || {} : null;
        for(const part of aggregateBOM(items)) {
            const stock=await tx.get(`shops/${shopId}/inventory/${part.component_key}`);
            const state=stockAvailability(stock,allocation,part.component_key);
            if(!state.valid || state.available<part.required_qty) fail(`Cannot reconcile ${part.component_key}: required ${part.required_qty}, ${allocation?'booth':'workshop'} available ${Math.max(0,state.available)}.`);
        }
        const revision=(order.reconciliationRevision || 0)+1;
        const updated={...order,items,inventoryVersion:1,reconciliationRevision:revision,updatedAt:now,
            trackingToken:order.trackingToken || `trk_${crypto.randomUUID()}`,expiresAt:order.expiresAt || now+30*86400000};
        tx.set(`shops/${shopId}/order_reconciliations/${orderId}_${revision}`,{orderId,sellerUid:uid,originalItems:order.items,mappings,reason:reason.trim(),createdAt:now});
        tx.set(path,updated);
        tx.set(`order_tracking/${updated.trackingToken}`,trackingProjection(updated));
        return updated;
    });
}

export async function listOrders(store,uid,{shopId,eventId=null}) {
    if(!uid || !segment(shopId) || (eventId && !segment(eventId))) fail('Invalid seller order query.');
    return store.transaction(async tx=>{
        const shop=await tx.get(`shops/${shopId}`);
        if(shop?.ownerUid!==uid) fail('This shop does not belong to this seller.');
        const orders=await tx.list(`shops/${shopId}/orders`,eventId?{eventId}:{});
        return {orders:orders.sort((a,b)=>Number(b.submittedAt || 0)-Number(a.submittedAt || 0)).slice(0,100)};
    });
}
