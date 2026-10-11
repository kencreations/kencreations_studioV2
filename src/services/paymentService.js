/**
 * src/services/paymentService.js
 * Immutable payment ledger, manual cash/GCash verification, event expenses,
 * and authoritative financial reporting for KenCreations Bazaar Hub.
 *
 * Implements:
 * 1. Explicit separation of cash flow from accounting profit.
 * 2. Immutable financial audit movements (/shops/{shopId}/financial_movements/).
 * 3. Manual seller payment verification (never automatic).
 * 4. Event operational expense tracking.
 * 5. Deterministic financial summaries via calculateFinancialSummary engine.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction,
} from "firebase/firestore";
import { db } from "../firebase.js";
import {
    getShopId,
    shopDoc,
    shopEventDoc,
    shopOrderDoc,
    shopOrdersCol,
    shopFinancialMovementDoc,
    shopFinancialMovementsCol,
    sanitizeForFirestore,
} from "./bazaarService.js";
import { calculateFinancialSummary } from "../engine/bazaar/inventoryMath.js";

export const eventExpensesCol = (shopId, eventId) => collection(db, "shops", shopId, "events", eventId, "expenses");
export const eventExpenseDoc = (shopId, eventId, expenseId) => doc(db, "shops", shopId, "events", eventId, "expenses", expenseId);

/**
 * Records a verified cash or GCash payment for an order.
 * Generates an immutable financial movement audit log.
 */
export async function recordOrderPayment(userId, orderId, {
    paymentType = "cash", // 'cash' | 'gcash'
    amount = 0,
    reference = "",
    notes = "",
} = {}) {
    if (!userId || !orderId) throw new Error("User ID and Order ID are required.");
    const numericAmount = Math.max(0, Number(amount) || 0);
    if (numericAmount <= 0) throw new Error("Payment amount must be greater than zero.");

    const shopId = getShopId(userId);
    const oRef = shopOrderDoc(shopId, orderId);

    let updatedOrder = null;

    await runTransaction(db, async (txn) => {
        const oSnap = await txn.get(oRef);
        if (!oSnap.exists()) throw new Error(`Order "${orderId}" not found.`);
        const order = oSnap.data();

        const currentPaid = Number(order.paidAmount || 0);
        const totalDue = Number(order.totalAmount || 0);
        const newPaid = currentPaid + numericAmount;

        let newPaymentStatus = "paid";
        if (newPaid < totalDue) {
            newPaymentStatus = "partial";
        }

        const updates = {
            paidAmount: newPaid,
            paymentStatus: newPaymentStatus,
            paymentMethod: paymentType,
            lastPaymentAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(reference ? { paymentReference: reference } : {}),
        };
        txn.update(oRef, updates);

        // Record immutable financial movement
        const movementId = `fin_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const mRef = shopFinancialMovementDoc(shopId, movementId);
        txn.set(mRef, {
            movementId,
            shopId,
            ownerUid: userId,
            orderId,
            orderNumber: order.orderNumber || "",
            eventId: order.eventId || null,
            type: paymentType === "gcash" ? "gcash_collection" : "cash_collection",
            amount: numericAmount,
            reference: reference || null,
            notes: notes || null,
            createdAt: serverTimestamp(),
        });

        updatedOrder = { ...order, ...updates };
    });

    return updatedOrder;
}

/**
 * Records an order refund and creates an immutable financial audit movement.
 */
export async function recordOrderRefund(userId, orderId, {
    amount = 0,
    reason = "Customer Refund",
} = {}) {
    if (!userId || !orderId) throw new Error("User ID and Order ID are required.");
    const refundAmount = Math.max(0, Number(amount) || 0);
    if (refundAmount <= 0) throw new Error("Refund amount must be greater than zero.");

    const shopId = getShopId(userId);
    const oRef = shopOrderDoc(shopId, orderId);

    let updatedOrder = null;

    await runTransaction(db, async (txn) => {
        const oSnap = await txn.get(oRef);
        if (!oSnap.exists()) throw new Error(`Order "${orderId}" not found.`);
        const order = oSnap.data();

        const currentPaid = Number(order.paidAmount || 0);
        if (refundAmount > currentPaid) {
            throw new Error(`Refund amount (₱${refundAmount}) cannot exceed paid balance (₱${currentPaid}).`);
        }

        const newPaid = Math.max(0, currentPaid - refundAmount);
        const newStatus = newPaid <= 0 ? "refunded" : "partial";

        const updates = {
            paidAmount: newPaid,
            paymentStatus: newStatus,
            totalRefunded: (Number(order.totalRefunded) || 0) + refundAmount,
            updatedAt: serverTimestamp(),
        };
        txn.update(oRef, updates);

        // Record immutable financial movement
        const movementId = `fin_ref_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const mRef = shopFinancialMovementDoc(shopId, movementId);
        txn.set(mRef, {
            movementId,
            shopId,
            ownerUid: userId,
            orderId,
            orderNumber: order.orderNumber || "",
            eventId: order.eventId || null,
            type: "refund",
            amount: -refundAmount,
            reason: reason || "Customer Refund",
            createdAt: serverTimestamp(),
        });

        updatedOrder = { ...order, ...updates };
    });

    return updatedOrder;
}

/**
 * Records an operational expense for a specific bazaar event.
 */
export async function addEventExpense(userId, eventId, {
    category = "Booth Rental",
    amount = 0,
    description = "",
} = {}) {
    if (!userId || !eventId) throw new Error("User ID and Event ID are required.");
    const numericAmount = Math.max(0, Number(amount) || 0);
    if (numericAmount <= 0) throw new Error("Expense amount must be greater than zero.");

    const shopId = getShopId(userId);
    const expenseId = `exp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const expenseRecord = sanitizeForFirestore({
        expenseId,
        shopId,
        ownerUid: userId,
        eventId,
        category,
        amount: numericAmount,
        description: description?.trim() || "",
        createdAt: serverTimestamp(),
    });

    await setDoc(eventExpenseDoc(shopId, eventId, expenseId), expenseRecord);
    return { id: expenseId, ...expenseRecord };
}

/**
 * Retrieves all operational expenses recorded for an event.
 */
export async function getEventExpenses(userId, eventId) {
    if (!userId || !eventId) return [];
    const shopId = getShopId(userId);
    try {
        const snap = await getDocs(eventExpensesCol(shopId, eventId));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
}

/**
 * Deletes an event expense.
 */
export async function deleteEventExpense(userId, eventId, expenseId) {
    if (!userId || !eventId || !expenseId) throw new Error("IDs required.");
    const shopId = getShopId(userId);
    const ref = eventExpenseDoc(shopId, eventId, expenseId);
    await updateDoc(ref, { isDeleted: true });
}

/**
 * Computes authoritative financial metrics for an event.
 */
export async function getEventAnalytics(userId, eventId) {
    if (!userId || !eventId) return null;
    const shopId = getShopId(userId);

    // 1. Fetch all orders for this event
    const oSnap = await getDocs(shopOrdersCol(shopId));
    const allOrders = oSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => o.eventId === eventId);

    // 2. Fetch expenses
    const expenses = await getEventExpenses(userId, eventId);
    const activeExpenses = expenses.filter((e) => !e.isDeleted);
    const totalExpenses = activeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // 3. Compute domain financial summary
    const summary = calculateFinancialSummary({
        orders: allOrders,
        expenses: totalExpenses,
    });

    return {
        ...summary,
        orders: allOrders,
        expenses: activeExpenses,
        totalExpenses,
    };
}
