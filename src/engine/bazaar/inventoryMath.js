/**
 * src/engine/bazaar/inventoryMath.js
 * Authoritative inventory mathematics, state transitions, invariant validation,
 * queue limits, and financial analytics for KenCreations Bazaar Hub.
 *
 * Deterministic and free of side effects.
 */

// ─── Core Accounting Formulas ────────────────────────────────────────────────

/**
 * Calculates unallocated inventory at the shop level.
 * Unallocated stock is inventory not yet committed to any active event or shop reservation.
 *
 * Invariant: physicalOnHand >= totalAllocatedToEvents + shopReservations
 */
export function calculateUnallocatedStock({
    physicalOnHand,
    physical_on_hand,
    totalAllocatedToEvents,
    total_allocated_to_events,
    shopReservations,
    shop_reservations,
    onHand,
    on_hand,
    globalReserved,
    global_reserved,
} = {}) {
    const onHandVal = Number(physicalOnHand ?? physical_on_hand ?? onHand ?? on_hand ?? 0);
    const allocVal = Number(totalAllocatedToEvents ?? total_allocated_to_events ?? 0);
    const resVal = Number(shopReservations ?? shop_reservations ?? globalReserved ?? global_reserved ?? 0);
    const raw = onHandVal - allocVal - resVal;
    return Math.max(0, Math.floor(raw));
}

/**
 * Global available stock is identical to unallocated stock (for non-event/shop orders).
 */
export function calculateGlobalAvailable(params = {}) {
    return calculateUnallocatedStock(params);
}

/**
 * Calculates available stock dedicated to a specific event.
 *
 * CRITICAL ACCOUNTING CORRECTION:
 * Event available stock does NOT depend on unallocated shop inventory.
 * Once inventory is allocated to an event, that stock is physically present
 * at the event booth and available for sale at that event, even if shop
 * unallocated stock is 0.
 *
 * Invariant: eventAllocated >= eventReserved + eventConsumed
 */
export function calculateEventAvailable({
    eventAllocated,
    event_allocated,
    eventReserved,
    event_reserved,
    eventConsumed,
    event_consumed,
} = {}) {
    const allocVal = Number(eventAllocated ?? event_allocated ?? 0);
    const resVal = Number(eventReserved ?? event_reserved ?? 0);
    const consVal = Number(eventConsumed ?? event_consumed ?? 0);
    const raw = allocVal - resVal - consVal;
    return Math.max(0, Math.floor(raw));
}

/**
 * Calculates remaining physical stock physically present at the event booth.
 * Cumulative event allocation minus cumulative event consumption.
 */
export function calculateEventPhysicalRemaining({
    eventAllocated,
    event_allocated,
    eventConsumed,
    event_consumed,
} = {}) {
    const allocVal = Number(eventAllocated ?? event_allocated ?? 0);
    const consVal = Number(eventConsumed ?? event_consumed ?? 0);
    return Math.max(0, allocVal - consVal);
}

/**
 * Calculates available shop inventory for direct shop/online orders.
 */
export function calculateShopAvailable(params = {}) {
    return calculateUnallocatedStock(params);
}

// ─── Invariant Validation ────────────────────────────────────────────────────

/**
 * Validates inventory conservation laws and invariants across global and event records.
 * Throws an explicit invariant violation error if any constraint is breached.
 */
export function validateInventoryInvariants({
    globalStock = {},
    eventStocks = [],
} = {}) {
    const physicalOnHand = Number(globalStock.physical_on_hand ?? globalStock.on_hand ?? 0);
    const totalAllocated = Number(globalStock.total_allocated_to_events ?? globalStock.allocated_to_events ?? 0);
    const shopReservations = Number(globalStock.shop_reservations ?? globalStock.global_reserved ?? 0);

    if (physicalOnHand < 0) throw new Error(`Invariant violation: Negative physical on-hand stock (${physicalOnHand}).`);
    if (totalAllocated < 0) throw new Error(`Invariant violation: Negative allocated stock (${totalAllocated}).`);
    if (shopReservations < 0) throw new Error(`Invariant violation: Negative shop reservations (${shopReservations}).`);

    let sumActiveAllocated = 0;
    for (const ev of eventStocks) {
        const allocated = Number(ev.event_allocated || 0);
        const reserved = Number(ev.event_reserved || 0);
        const consumed = Number(ev.event_consumed || 0);

        if (allocated < 0 || reserved < 0 || consumed < 0) {
            throw new Error(`Invariant violation: Negative counters in event stock record for event "${ev.event_id || 'unknown'}".`);
        }
        if (reserved + consumed > allocated) {
            throw new Error(`Invariant violation: Event "${ev.event_id || 'unknown'}" commitments (${reserved} reserved + ${consumed} consumed) exceed allocation (${allocated}).`);
        }
        sumActiveAllocated += (allocated - consumed);
    }

    if (sumActiveAllocated > totalAllocated) {
        throw new Error(`Invariant violation: Sum of active event allocations (${sumActiveAllocated}) exceeds global total_allocated (${totalAllocated}).`);
    }

    if (totalAllocated + shopReservations > physicalOnHand) {
        throw new Error(`Invariant violation: Global allocations (${totalAllocated}) + shop reservations (${shopReservations}) exceed physical on-hand (${physicalOnHand}).`);
    }

    return true;
}

// ─── State Transitions ───────────────────────────────────────────────────────

/**
 * Allocates physical shop inventory to a specific event.
 */
export function transitionAllocateStockToEvent(globalStock, eventStock, qty) {
    const allocQty = Math.floor(Number(qty || 0));
    if (allocQty <= 0) throw new Error("Allocation quantity must be greater than zero.");

    const physicalOnHand = Number(globalStock?.physical_on_hand ?? globalStock?.on_hand ?? 0);
    const totalAllocated = Number(globalStock?.total_allocated_to_events ?? globalStock?.allocated_to_events ?? 0);
    const shopReservations = Number(globalStock?.shop_reservations ?? globalStock?.global_reserved ?? 0);
    const unallocated = calculateUnallocatedStock({ physicalOnHand, totalAllocatedToEvents: totalAllocated, shopReservations });

    if (allocQty > unallocated) {
        throw new Error(`Insufficient unallocated stock. Requested: ${allocQty}, Available to allocate: ${unallocated}`);
    }

    const currentEventAllocated = Number(eventStock?.event_allocated || 0);
    const currentEventReserved = Number(eventStock?.event_reserved || 0);
    const currentEventConsumed = Number(eventStock?.event_consumed || 0);

    const updatedGlobal = {
        physical_on_hand: physicalOnHand,
        total_allocated_to_events: totalAllocated + allocQty,
        shop_reservations: shopReservations,
        unallocated_stock: unallocated - allocQty,
    };

    const updatedEvent = {
        event_allocated: currentEventAllocated + allocQty,
        event_reserved: currentEventReserved,
        event_consumed: currentEventConsumed,
        event_available: calculateEventAvailable({
            eventAllocated: currentEventAllocated + allocQty,
            eventReserved: currentEventReserved,
            eventConsumed: currentEventConsumed,
        }),
    };

    validateInventoryInvariants({ globalStock: updatedGlobal, eventStocks: [updatedEvent] });

    return { globalStock: updatedGlobal, eventStock: updatedEvent };
}

/**
 * Deallocates unreserved event inventory back to global shop inventory.
 */
export function transitionDeallocateStockFromEvent(globalStock, eventStock, qty) {
    const deallocQty = Math.floor(Number(qty || 0));
    if (deallocQty <= 0) throw new Error("Deallocation quantity must be greater than zero.");

    const currentEventAllocated = Number(eventStock?.event_allocated || 0);
    const currentEventReserved = Number(eventStock?.event_reserved || 0);
    const currentEventConsumed = Number(eventStock?.event_consumed || 0);
    const eventAvailable = calculateEventAvailable({
        eventAllocated: currentEventAllocated,
        eventReserved: currentEventReserved,
        eventConsumed: currentEventConsumed,
    });

    if (deallocQty > eventAvailable) {
        throw new Error(`Cannot deallocate ${deallocQty} units. Only ${eventAvailable} units available at event (unreserved and unconsumed).`);
    }

    const physicalOnHand = Number(globalStock?.physical_on_hand ?? globalStock?.on_hand ?? 0);
    const totalAllocated = Number(globalStock?.total_allocated_to_events ?? globalStock?.allocated_to_events ?? 0);
    const shopReservations = Number(globalStock?.shop_reservations ?? globalStock?.global_reserved ?? 0);

    const updatedGlobal = {
        physical_on_hand: physicalOnHand,
        total_allocated_to_events: Math.max(0, totalAllocated - deallocQty),
        shop_reservations: shopReservations,
        unallocated_stock: calculateUnallocatedStock({
            physicalOnHand,
            totalAllocatedToEvents: Math.max(0, totalAllocated - deallocQty),
            shopReservations,
        }),
    };

    const updatedEvent = {
        event_allocated: currentEventAllocated - deallocQty,
        event_reserved: currentEventReserved,
        event_consumed: currentEventConsumed,
        event_available: eventAvailable - deallocQty,
    };

    validateInventoryInvariants({ globalStock: updatedGlobal, eventStocks: [updatedEvent] });

    return { globalStock: updatedGlobal, eventStock: updatedEvent };
}

/**
 * Reserves event stock upon seller acceptance of a customer order.
 */
export function transitionReserveStock(current, qty) {
    const reserveQty = Math.floor(Number(qty || 0));
    if (reserveQty <= 0) throw new Error("Reservation quantity must be greater than zero.");

    // Supports both event-level stock record or shop-level stock record
    if ("event_allocated" in current) {
        const allocated = Number(current.event_allocated || 0);
        const reserved = Number(current.event_reserved || 0);
        const consumed = Number(current.event_consumed || 0);
        const available = calculateEventAvailable({ eventAllocated: allocated, eventReserved: reserved, eventConsumed: consumed });

        if (reserveQty > available) {
            throw new Error(`Insufficient event stock to reserve. Requested: ${reserveQty}, Available: ${available}`);
        }

        return {
            ...current,
            event_allocated: allocated,
            event_reserved: reserved + reserveQty,
            event_consumed: consumed,
            available: available - reserveQty,
            event_available: available - reserveQty,
        };
    }

    // Fallback for simple single-pool global stock records
    const onHand = Number(current.on_hand ?? current.physical_on_hand ?? 0);
    const reserved = Number(current.reserved ?? current.global_reserved ?? current.shop_reservations ?? 0);
    const available = onHand - reserved;

    if (reserveQty > available) {
        throw new Error(`Insufficient stock to reserve. Requested: ${reserveQty}, Available: ${available}`);
    }

    return {
        ...current,
        on_hand: onHand,
        physical_on_hand: onHand,
        reserved: reserved + reserveQty,
        global_reserved: reserved + reserveQty,
        shop_reservations: reserved + reserveQty,
        available: available - reserveQty,
    };
}

/**
 * Consumes stock when physical production begins.
 * Decrements reservation and increments physical consumption.
 */
export function transitionConsumeStock(current, qty) {
    const consumeQty = Math.floor(Number(qty || 0));
    if (consumeQty <= 0) throw new Error("Consume quantity must be greater than zero.");

    if ("event_allocated" in current) {
        const allocated = Number(current.event_allocated || 0);
        const reserved = Number(current.event_reserved || 0);
        const consumed = Number(current.event_consumed || 0);

        if (consumeQty > reserved) {
            throw new Error(`Cannot consume ${consumeQty} units. Only ${reserved} units are currently reserved for production.`);
        }

        return {
            ...current,
            event_allocated: allocated,
            event_reserved: reserved - consumeQty,
            event_consumed: consumed + consumeQty,
            available: calculateEventAvailable({
                eventAllocated: allocated,
                eventReserved: reserved - consumeQty,
                eventConsumed: consumed + consumeQty,
            }),
            event_available: calculateEventAvailable({
                eventAllocated: allocated,
                eventReserved: reserved - consumeQty,
                eventConsumed: consumed + consumeQty,
            }),
            event_physical_remaining: calculateEventPhysicalRemaining({
                eventAllocated: allocated,
                eventConsumed: consumed + consumeQty,
            }),
        };
    }

    const onHand = Number(current.on_hand ?? current.physical_on_hand ?? 0);
    const reserved = Number(current.reserved ?? current.global_reserved ?? current.shop_reservations ?? 0);

    if (consumeQty > onHand) {
        throw new Error(`Cannot consume ${consumeQty} units. Only ${onHand} units on-hand.`);
    }

    return {
        ...current,
        on_hand: onHand - consumeQty,
        physical_on_hand: onHand - consumeQty,
        reserved: Math.max(0, reserved - consumeQty),
        global_reserved: Math.max(0, reserved - consumeQty),
        shop_reservations: Math.max(0, reserved - consumeQty),
        available: Math.max(0, onHand - consumeQty - Math.max(0, reserved - consumeQty)),
    };
}

/**
 * Atomically consumes physical event stock when production begins on an accepted order.
 *
 * UNIFIED ACCOUNTING INVARIANT & DOUBLE-DEDUCTION PREVENTION:
 * - `event_allocated` is the cumulative allocation sent to the booth. It is NOT decremented upon consumption.
 * - `event_consumed` is the cumulative components consumed at the booth. It increments by `qty`.
 * - `event_reserved` decrements by `qty` (reservation is fulfilled by physical consumption).
 * - Event available stock = `event_allocated - event_reserved - event_consumed`.
 * - Event physical remaining at booth = `event_allocated - event_consumed`.
 * - Global `physical_on_hand` decrements by `qty` (physical components are now fabricated into a customized item).
 * - Global `total_allocated_to_events` decrements by `qty` (reflects net active unconsumed stock remaining at events).
 *
 * This ensures:
 * 1. Event stock is not deducted twice.
 * 2. `event_available` and `event_physical_remaining` are consistent.
 * 3. Idempotency guards prevent duplicate execution from consuming stock again.
 */
export function transitionConsumeEventStock({ globalStock, eventStock, qty, orderId, processedOrderIds = [] }) {
    if (orderId && Array.isArray(processedOrderIds) && processedOrderIds.includes(orderId)) {
        throw new Error(`Idempotency guard: Order "${orderId}" has already consumed inventory.`);
    }

    const consumeQty = Math.floor(Number(qty || 0));
    if (consumeQty <= 0) throw new Error("Consume quantity must be greater than zero.");

    const allocated = Number(eventStock?.event_allocated || 0);
    const reserved = Number(eventStock?.event_reserved || 0);
    const consumed = Number(eventStock?.event_consumed || 0);

    if (consumeQty > reserved) {
        throw new Error(`Cannot consume ${consumeQty} units. Only ${reserved} units are currently reserved for production.`);
    }

    const physicalOnHand = Number(globalStock?.physical_on_hand ?? globalStock?.on_hand ?? 0);
    const totalAllocated = Number(globalStock?.total_allocated_to_events ?? globalStock?.allocated_to_events ?? 0);
    const shopReservations = Number(globalStock?.shop_reservations ?? globalStock?.global_reserved ?? 0);

    if (consumeQty > physicalOnHand) {
        throw new Error(`Cannot consume ${consumeQty} units. Insufficient physical on-hand stock (${physicalOnHand}).`);
    }

    const updatedEvent = {
        ...eventStock,
        event_allocated: allocated, // Cumulative allocation remains unchanged (no double deduction)
        event_reserved: reserved - consumeQty,
        event_consumed: consumed + consumeQty,
        event_available: calculateEventAvailable({
            eventAllocated: allocated,
            eventReserved: reserved - consumeQty,
            eventConsumed: consumed + consumeQty,
        }),
        event_physical_remaining: calculateEventPhysicalRemaining({
            eventAllocated: allocated,
            eventConsumed: consumed + consumeQty,
        }),
    };

    const updatedGlobal = {
        ...globalStock,
        physical_on_hand: physicalOnHand - consumeQty,
        total_allocated_to_events: Math.max(0, totalAllocated - consumeQty),
        shop_reservations: shopReservations,
        unallocated_stock: calculateUnallocatedStock({
            physicalOnHand: physicalOnHand - consumeQty,
            totalAllocatedToEvents: Math.max(0, totalAllocated - consumeQty),
            shopReservations,
        }),
    };

    validateInventoryInvariants({ globalStock: updatedGlobal, eventStocks: [updatedEvent] });

    return { globalStock: updatedGlobal, eventStock: updatedEvent };
}

/**
 * Releases reserved inventory upon pre-production order rejection or cancellation.
 */
export function transitionReleaseStock(current, qty) {
    const releaseQty = Math.floor(Number(qty || 0));
    if (releaseQty <= 0) throw new Error("Release quantity must be greater than zero.");

    if ("event_allocated" in current) {
        const allocated = Number(current.event_allocated || 0);
        const reserved = Number(current.event_reserved || 0);
        const consumed = Number(current.event_consumed || 0);
        const newReserved = Math.max(0, reserved - releaseQty);

        return {
            ...current,
            event_allocated: allocated,
            event_reserved: newReserved,
            event_consumed: consumed,
            available: calculateEventAvailable({ eventAllocated: allocated, eventReserved: newReserved, eventConsumed: consumed }),
            event_available: calculateEventAvailable({ eventAllocated: allocated, eventReserved: newReserved, eventConsumed: consumed }),
        };
    }

    const onHand = Number(current.on_hand ?? current.physical_on_hand ?? 0);
    const reserved = Number(current.reserved ?? current.global_reserved ?? current.shop_reservations ?? 0);
    const newReserved = Math.max(0, reserved - releaseQty);

    return {
        ...current,
        on_hand: onHand,
        physical_on_hand: onHand,
        reserved: newReserved,
        global_reserved: newReserved,
        shop_reservations: newReserved,
        available: Math.max(0, onHand - newReserved),
    };
}

/**
 * Handles post-production cancellation:
 * Reusable components (switches, keyrings) are returned to available stock;
 * Damaged / customized pieces (printed caps) are permanently logged as waste.
 */
export function transitionScrapOrRecoverStock(param1, recoveredQtyParam = 0, wastedQtyParam = 0) {
    let current = param1;
    let safeRecovered;
    let safeWasted;
    if (param1 && typeof param1 === "object" && "inventoryItem" in param1) {
        current = param1.inventoryItem;
        safeRecovered = Math.max(0, Math.floor(Number(param1.recoveredQty || param1.recovered_qty || 0)));
        safeWasted = Math.max(0, Math.floor(Number(param1.wastedQty || param1.wasted_qty || 0)));
    } else {
        safeRecovered = Math.max(0, Math.floor(Number(recoveredQtyParam || 0)));
        safeWasted = Math.max(0, Math.floor(Number(wastedQtyParam || 0)));
    }

    if ("event_allocated" in current) {
        const allocated = Number(current.event_allocated || 0);
        const reserved = Number(current.reserved ?? current.event_reserved ?? 0);
        const consumed = Number(current.event_consumed || 0);

        // Recovered items are unconsumed (returned to event availability)
        const newConsumed = Math.max(0, consumed - safeRecovered);

        return {
            ...current,
            event_allocated: allocated,
            reserved,
            event_reserved: reserved,
            event_consumed: newConsumed,
            wasted_count: safeWasted,
            available: calculateEventAvailable({ eventAllocated: allocated, eventReserved: reserved, eventConsumed: newConsumed }),
            event_available: calculateEventAvailable({ eventAllocated: allocated, eventReserved: reserved, eventConsumed: newConsumed }),
        };
    }

    const onHand = Number(current.on_hand ?? current.physical_on_hand ?? 0);
    const reserved = Number(current.reserved ?? current.global_reserved ?? current.shop_reservations ?? 0);

    return {
        ...current,
        on_hand: onHand + safeRecovered,
        physical_on_hand: onHand + safeRecovered,
        reserved,
        global_reserved: reserved,
        wasted_count: safeWasted,
        available: Math.max(0, onHand + safeRecovered - reserved),
    };
}

// ─── Queue Capacity Controls ─────────────────────────────────────────────────

/**
 * Evaluates event queue limits and booth acceptance state.
 */
export function checkQueueCapacity({
    pendingCount = 0,
    currentPendingCount,
    activeCount = 0,
    currentInProductionCount,
    eventConfig = {},
    event,
} = {}) {
    const ev = event || eventConfig || {};
    const pCount = Number(currentPendingCount ?? pendingCount) || 0;
    const aCount = Number(currentInProductionCount ?? activeCount) || 0;

    const isAccepting = ev.is_accepting_orders !== false && ev.isAcceptingOrders !== false && ev.queueStatus !== "paused" && ev.queueStatus !== "closed";
    if (!isAccepting) {
        return { allowed: false, canAccept: false, reason: "BOOTH_PAUSED", message: "This booth is currently paused and not accepting new orders." };
    }

    const pendingLimit = Number(ev.pending_queue_capacity ?? ev.pendingQueueCapacity) || 10;
    if (pCount >= pendingLimit) {
        return { allowed: false, canAccept: false, reason: "PENDING_QUEUE_FULL", message: `The order queue is currently at capacity (${pCount}/${pendingLimit}). Please try again in a few minutes.` };
    }

    const activeLimit = Number(ev.active_production_capacity ?? ev.activeProductionCapacity) || 25;
    if (aCount >= activeLimit) {
        return { allowed: false, canAccept: false, reason: "PRODUCTION_BUSY", message: `The production queue is busy (${aCount}/${activeLimit}). Please check back shortly.` };
    }

    return { allowed: true, canAccept: true, reason: null, message: null };
}

// ─── Financial Analytics & Ledger Accounting ─────────────────────────────────

/**
 * Calculates authoritative financial analytics from orders, expenses, and refunds.
 */
export function calculateFinancialSummary({
    orders = [],
    expenses = [],
    refunds = [],
} = {}) {
    let grossOrderValue = 0;
    let collectedCash = 0;
    let collectedGcash = 0;
    let uncollectedBalance = 0;
    let totalCogs = 0;
    let completedOrderCount = 0;
    let pendingOrderCount = 0;

    for (const order of orders) {
        const total = Number(order.total_amount ?? order.totalAmount) || 0;
        const status = (order.fulfillment_status ?? order.fulfillmentStatus ?? "pending").toLowerCase();
        const paymentStatus = (order.payment_status ?? order.paymentStatus ?? "unpaid").toLowerCase();
        const paymentMethod = (order.payment_method ?? order.paymentMethod ?? "cash").toLowerCase();
        const paid = Number(order.paid_amount ?? order.paidAmount ?? (paymentStatus === "paid" ? total : 0));

        // Exclude cancelled and rejected orders from gross order value
        if (status !== "cancelled" && status !== "rejected") {
            grossOrderValue += total;

            if (status === "pending") {
                pendingOrderCount += 1;
            } else if (status === "collected" || status === "ready") {
                completedOrderCount += 1;
            }

            collectedCash += paid;
            if (paymentMethod === "gcash") {
                collectedGcash += paid;
            }

            const remaining = Math.max(0, total - paid);
            uncollectedBalance += remaining;

            // Calculate COGS if order was accepted or produced
            if (status !== "pending") {
                if (order.cogs != null) {
                    totalCogs += Number(order.cogs);
                } else {
                    for (const item of order.items || []) {
                        const unitCost = Number(item.unit_cost_snapshot ?? item.unitCost ?? 0);
                        const qty = Number(item.quantity) || 1;
                        totalCogs += unitCost * qty;
                    }
                }
            }
        }
    }

    const explicitRefunds = Array.isArray(refunds)
        ? refunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
        : (Number(refunds) || 0);

    const totalRefunds = explicitRefunds;
    const netCollectedCash = Number((collectedCash - totalRefunds).toFixed(2));

    const totalExpenses = Array.isArray(expenses)
        ? expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        : (Number(expenses) || 0);

    const grossProfit = Number((netCollectedCash - totalCogs).toFixed(2));
    const netEventProfit = Number((grossProfit - totalExpenses).toFixed(2));

    const grossMarginPercent = netCollectedCash > 0
        ? Number(((grossProfit / netCollectedCash) * 100).toFixed(1))
        : 0;

    return {
        grossOrderValue: Number(grossOrderValue.toFixed(2)),
        collectedCash: Number(collectedCash.toFixed(2)),
        collectedGcash: Number(collectedGcash.toFixed(2)),
        totalCollections: Number(collectedCash.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        netCashCollections: netCollectedCash,
        netCollectedCash,
        uncollectedBalance: Number(uncollectedBalance.toFixed(2)),
        outstandingBalance: Number(uncollectedBalance.toFixed(2)),
        totalCogs: Number(totalCogs.toFixed(2)),
        cogs: Number(totalCogs.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        grossProfit,
        netEventProfit,
        estimatedProfit: netEventProfit,
        grossMarginPercent,
        orderMetrics: {
            totalOrders: orders.length,
            completedOrders: completedOrderCount,
            pendingOrders: pendingOrderCount,
        },
    };
}

// ─── Matrix & Variant Inventory Domain Helpers ────────────────────────────────

/**
 * Builds a 2D matrix structure for Letter Caps across colors.
 *
 * @param {Object} params
 * @param {Array<Object>} [params.inventoryItems=[]] - Flat inventory items
 * @param {Array<string>} [params.letters] - Letters array (default A-Z, 0-9)
 * @param {Array<string>} [params.colors] - Colors array (default Pink, Teal, Purple, White, Black)
 * @returns {Object} Matrix rows, columns, and cell map
 */
export function buildLetterColorMatrix({
    inventoryItems = [],
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""),
    colors = ["Pink", "Teal", "Purple", "White", "Black"],
    itemType = "letter_cap",
} = {}) {
    const isIcon = itemType === "icon_cap";
    const itemMap = new Map();
    for (const item of inventoryItems) {
        if (item.char && item.color) {
            const key = isIcon
                ? `cap_icon_${String(item.char).toLowerCase()}_${String(item.color).toLowerCase()}`
                : `cap_${String(item.char).toUpperCase()}_${String(item.color).toLowerCase()}`;
            itemMap.set(key.toLowerCase(), item);
        }
        if (item.item_key) {
            itemMap.set(item.item_key.toLowerCase(), item);
        }
    }

    const rows = [];
    for (const char of letters) {
        const cells = {};
        for (const col of colors) {
            const key = isIcon
                ? `cap_icon_${String(char).toLowerCase()}_${String(col).toLowerCase()}`
                : `cap_${String(char).toUpperCase()}_${String(col).toLowerCase()}`;
            const existing = itemMap.get(key.toLowerCase()) || {};
            const onHand = Number(existing.on_hand ?? existing.onHand ?? 0);
            const reserved = Number(existing.reserved ?? 0);
            const available = Math.max(0, onHand - reserved);

            cells[col] = {
                key,
                itemKey: key,
                char,
                color: col,
                itemType: isIcon ? "icon_cap" : "letter_cap",
                onHand,
                reserved,
                available,
                lowThreshold: Number(existing.low_threshold ?? 5),
                isLow: onHand <= Number(existing.low_threshold ?? 5),
            };
        }
        rows.push({
            char,
            cells,
        });
    }

    return {
        letters,
        colors,
        rows,
    };
}

/**
 * Validates and executes an inventory balance adjustment.
 * Strictly prevents negative balances.
 *
 * @param {Object} currentStock - Current stock record
 * @param {number} delta - Quantity change (+/-)
 * @returns {Object} Updated stock values and movement record
 */
export function adjustStockBalance(currentStock = {}, delta = 0) {
    const change = Number(delta);
    if (!Number.isFinite(change) || change === 0) {
        throw new Error("A non-zero quantity change is required.");
    }

    const currentOnHand = Number(currentStock.on_hand ?? currentStock.onHand ?? 0);
    const currentReserved = Number(currentStock.reserved ?? 0);
    const newOnHand = currentOnHand + change;

    if (newOnHand < 0) {
        throw new Error(`Insufficient inventory: adjustment of ${change} would reduce balance (${currentOnHand}) below zero.`);
    }

    if (newOnHand < currentReserved) {
        throw new Error(`Cannot reduce physical stock below reserved quantity (${currentReserved}). Active orders require this stock.`);
    }

    const newAvailable = Math.max(0, newOnHand - currentReserved);

    return {
        on_hand: newOnHand,
        reserved: currentReserved,
        available: newAvailable,
        previous_on_hand: currentOnHand,
        delta: change,
    };
}

