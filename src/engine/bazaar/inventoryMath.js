/**
 * src/engine/bazaar/inventoryMath.js
 * Pure inventory math, state transitions, queue limits, and financial analytics for Bazaar Hub.
 *
 * Deterministic and free of side effects.
 */

/**
 * Calculates global available inventory.
 * Invariant: Available cannot exceed (on_hand - global_reserved - allocated_to_events).
 */
export function calculateGlobalAvailable({
    onHand = 0,
    globalReserved = 0,
    allocatedToEvents = 0,
} = {}) {
    const raw = Number(onHand || 0) - Number(globalReserved || 0) - Number(allocatedToEvents || 0);
    return Math.max(0, Math.floor(raw));
}

/**
 * Calculates event-specific available inventory bounded by both event quota and global inventory.
 * Invariant: Prevents overselling across multiple events.
 */
export function calculateEventAvailable({
    eventAllocated = 0,
    eventReserved = 0,
    eventConsumed = 0,
    globalAvailable = Infinity,
} = {}) {
    const eventRemaining = Math.max(0, Number(eventAllocated || 0) - Number(eventReserved || 0) - Number(eventConsumed || 0));
    return Math.min(eventRemaining, Math.max(0, Number(globalAvailable || 0)));
}

/**
 * Reserves inventory on order acceptance.
 *
 * @param {Object} current - Current stock record { on_hand, global_reserved }
 * @param {number} qty - Quantity to reserve
 * @returns {Object} Updated counters
 */
export function transitionReserveStock(current, qty) {
    const onHand = Number(current?.on_hand || 0);
    const reserved = Number(current?.global_reserved || 0);
    const available = onHand - reserved;

    if (qty > available) {
        throw new Error(`Insufficient stock to reserve. Requested: ${qty}, Available: ${available}`);
    }

    return {
        on_hand: onHand,
        global_reserved: reserved + qty,
        available: available - qty,
    };
}

/**
 * Consumes inventory when physical production starts.
 *
 * @param {Object} current - Current stock record { on_hand, global_reserved }
 * @param {number} qty - Quantity consumed
 * @returns {Object} Updated counters
 */
export function transitionConsumeStock(current, qty) {
    const onHand = Number(current?.on_hand || 0);
    const reserved = Number(current?.global_reserved || 0);

    if (qty > onHand) {
        throw new Error(`Cannot consume ${qty} units. Only ${onHand} units on-hand.`);
    }

    return {
        on_hand: onHand - qty,
        global_reserved: Math.max(0, reserved - qty),
        available: Math.max(0, onHand - qty - Math.max(0, reserved - qty)),
    };
}

/**
 * Releases reserved inventory upon order rejection or pre-production cancellation.
 *
 * @param {Object} current - Current stock record { on_hand, global_reserved }
 * @param {number} qty - Quantity to release
 * @returns {Object} Updated counters
 */
export function transitionReleaseStock(current, qty) {
    const onHand = Number(current?.on_hand || 0);
    const reserved = Number(current?.global_reserved || 0);
    const newReserved = Math.max(0, reserved - qty);

    return {
        on_hand: onHand,
        global_reserved: newReserved,
        available: Math.max(0, onHand - newReserved),
    };
}

/**
 * Handles post-production cancellation: recovers reusable components and logs damaged scrap.
 *
 * @param {Object} current - Current stock record { on_hand, global_reserved }
 * @param {number} recoveredQty - Reusable units returned to stock
 * @param {number} wastedQty - Damaged / customized units scrapped
 * @returns {Object} Updated counters and waste log
 */
export function transitionScrapOrRecoverStock(current, recoveredQty = 0, wastedQty = 0) {
    const onHand = Number(current?.on_hand || 0);
    const reserved = Number(current?.global_reserved || 0);

    const safeRecovered = Math.max(0, Number(recoveredQty || 0));
    const safeWasted = Math.max(0, Number(wastedQty || 0));

    return {
        on_hand: onHand + safeRecovered,
        global_reserved: reserved,
        wasted_count: safeWasted,
        available: Math.max(0, onHand + safeRecovered - reserved),
    };
}

/**
 * Evaluates event queue limits and booth acceptance state.
 *
 * @param {Object} params
 * @param {number} params.pendingCount - Current orders awaiting review
 * @param {number} params.activeCount - Current orders in active production (Accepted + Preparing)
 * @param {Object} params.eventConfig - Event configuration
 * @returns {Object} { allowed: boolean, reason: string | null }
 */
export function checkQueueCapacity({
    pendingCount = 0,
    activeCount = 0,
    eventConfig = {},
} = {}) {
    if (eventConfig.is_accepting_orders === false) {
        return { allowed: false, reason: "BOOTH_PAUSED", message: "This booth is currently paused and not accepting new orders." };
    }

    const pendingLimit = Number(eventConfig.pending_queue_capacity) || 10;
    if (pendingCount >= pendingLimit) {
        return { allowed: false, reason: "PENDING_QUEUE_FULL", message: `The order queue is currently at capacity (${pendingCount}/${pendingLimit}). Please try again in a few minutes.` };
    }

    const activeLimit = Number(eventConfig.active_production_capacity) || 25;
    if (activeCount >= activeLimit) {
        return { allowed: false, reason: "PRODUCTION_BUSY", message: `The production queue is busy (${activeCount}/${activeLimit}). Please check back shortly.` };
    }

    return { allowed: true, reason: null, message: null };
}

/**
 * Calculates authoritative financial analytics from orders, expenses, and refunds.
 *
 * @param {Object} params
 * @param {Array<Object>} params.orders - All orders for event/shop
 * @param {Array<Object>} [params.expenses=[]] - Seller event expenses
 * @param {Array<Object>} [params.refunds=[]] - Refund records
 * @returns {Object} Accurate financial summary
 */
export function calculateFinancialSummary({
    orders = [],
    expenses = [],
    refunds = [],
} = {}) {
    let grossOrderValue = 0;
    let collectedCash = 0;
    let uncollectedBalance = 0;
    let totalCogs = 0;
    let completedOrderCount = 0;
    let pendingOrderCount = 0;

    for (const order of orders) {
        const total = Number(order.total_amount) || 0;
        const status = order.fulfillment_status || "pending";
        const paymentStatus = order.payment_status || "unpaid";

        // Exclude cancelled and rejected orders from gross order value
        if (status !== "cancelled" && status !== "rejected") {
            grossOrderValue += total;

            if (status === "pending") {
                pendingOrderCount += 1;
            } else if (status === "collected" || status === "ready") {
                completedOrderCount += 1;
            }

            if (paymentStatus === "paid") {
                collectedCash += total;
            } else {
                uncollectedBalance += total;
            }

            // Calculate COGS if order was accepted or produced
            if (status !== "pending") {
                for (const item of order.items || []) {
                    const unitCost = Number(item.unit_cost_snapshot) || 0;
                    const qty = Number(item.quantity) || 1;
                    totalCogs += unitCost * qty;
                }
            }
        }
    }

    const totalRefunds = refunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const netCollectedCash = Number((collectedCash - totalRefunds).toFixed(2));
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const grossProfit = Number((netCollectedCash - totalCogs).toFixed(2));
    const netEventProfit = Number((grossProfit - totalExpenses).toFixed(2));

    const grossMarginPercent = netCollectedCash > 0
        ? Number(((grossProfit / netCollectedCash) * 100).toFixed(1))
        : 0;

    return {
        grossOrderValue: Number(grossOrderValue.toFixed(2)),
        collectedCash: Number(collectedCash.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        netCollectedCash,
        uncollectedBalance: Number(uncollectedBalance.toFixed(2)),
        totalCogs: Number(totalCogs.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        grossProfit,
        netEventProfit,
        grossMarginPercent,
        orderMetrics: {
            totalOrders: orders.length,
            completedOrders: completedOrderCount,
            pendingOrders: pendingOrderCount,
        },
    };
}
