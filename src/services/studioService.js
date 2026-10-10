import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * studioService.js
 * Cloud Firestore Data Layer for KenCreations Studio Hub.
 *
 * User-owned document isolation: all records live under `users/{userId}/{subcollection}`.
 */

// Helper to get collection ref scoped to a user
export const userCol = (userId, colName) => {
    if (!userId) throw new Error("A valid authenticated user ID is required.");
    return collection(db, "users", userId, colName);
};

export const userDoc = (userId, colName, docId) => {
    if (!userId) throw new Error("A valid authenticated user ID is required.");
    return doc(db, "users", userId, colName, docId);
};

// ─── Filaments ─────────────────────────────────────────────────────────────

export async function getFilaments(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "filaments"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addFilament(userId, filamentData) {
    const colRef = userCol(userId, "filaments");
    const spoolWeight = Number(filamentData.spool_weight_g) || 1000;
    const purchasePrice = Number(filamentData.purchase_price) || 0;
    const remainingWeight = filamentData.remaining_weight_g !== undefined
        ? Number(filamentData.remaining_weight_g)
        : spoolWeight;
    const costPerGram = spoolWeight > 0 ? Number((purchasePrice / spoolWeight).toFixed(4)) : 0;

    const newDoc = {
        name: filamentData.name || "Untitled Filament",
        brand: filamentData.brand || "Generic",
        material: filamentData.material || "PLA",
        color_name: filamentData.color_name || "",
        color_hex: filamentData.color_hex || "#14b8a6",
        spool_id: filamentData.spool_id || "",
        spool_weight_g: spoolWeight,
        remaining_weight_g: remainingWeight,
        purchase_price: purchasePrice,
        cost_per_gram: costPerGram,
        supplier: filamentData.supplier || "",
        purchase_date: filamentData.purchase_date || new Date().toISOString().slice(0, 10),
        min_threshold_g: Number(filamentData.min_threshold_g) || 100,
        status: filamentData.status || (remainingWeight <= 0 ? "Empty" : remainingWeight <= 150 ? "Low" : "New"),
        notes: filamentData.notes || "",
        product_url: filamentData.product_url || "",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, newDoc);

    // Log initial inventory movement
    await logMovement(userId, {
        type: "initial",
        item_type: "filament",
        item_id: docRef.id,
        item_name: newDoc.name,
        quantity_change: remainingWeight,
        unit: "g",
        reason: "Initial Spool Stocking",
    });

    return { id: docRef.id, ...newDoc };
}

export async function updateFilament(userId, id, updates) {
    const docRef = userDoc(userId, "filaments", id);
    const spoolWeight = updates.spool_weight_g !== undefined ? Number(updates.spool_weight_g) : undefined;
    const purchasePrice = updates.purchase_price !== undefined ? Number(updates.purchase_price) : undefined;

    const dataToSave = {
        ...updates,
        updated_at: serverTimestamp(),
    };

    if (spoolWeight !== undefined && purchasePrice !== undefined && spoolWeight > 0) {
        dataToSave.cost_per_gram = Number((purchasePrice / spoolWeight).toFixed(4));
    }

    await updateDoc(docRef, dataToSave);
    return { id, ...dataToSave };
}

export async function deleteFilament(userId, id) {
    const docRef = userDoc(userId, "filaments", id);
    await deleteDoc(docRef);
    return { success: true };
}

export async function adjustFilamentWeight(userId, id, newWeight, reason = "Manual adjustment") {
    const docRef = userDoc(userId, "filaments", id);
    let diff = 0;
    let filamentName = "";

    await runTransaction(db, async (txn) => {
        const snap = await txn.get(docRef);
        if (!snap.exists()) throw new Error("Filament not found");
        const curr = snap.data();
        filamentName = curr.name;
        diff = Number(newWeight) - Number(curr.remaining_weight_g || 0);
        const threshold = Number(curr.min_threshold_g || 100);
        let newStatus = curr.status;
        if (newWeight <= 0) newStatus = "Empty";
        else if (newWeight <= threshold) newStatus = "Low";
        else if (curr.status === "Empty" || curr.status === "Low") newStatus = "In Use";

        txn.update(docRef, {
            remaining_weight_g: Number(newWeight),
            status: newStatus,
            updated_at: serverTimestamp(),
        });
    });

    if (diff !== 0) {
        await logMovement(userId, {
            type: diff > 0 ? "addition" : "adjustment",
            item_type: "filament",
            item_id: id,
            item_name: filamentName,
            quantity_change: diff,
            unit: "g",
            reason,
        });
    }

    return { success: true };
}

// ─── Consumables ───────────────────────────────────────────────────────────

export async function getConsumables(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "consumables"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addConsumable(userId, consumableData) {
    const colRef = userCol(userId, "consumables");
    const packQty = Number(consumableData.pack_quantity) || 1;
    const packPrice = Number(consumableData.pack_price) || 0;
    const unitCost = packQty > 0 ? Number((packPrice / packQty).toFixed(4)) : 0;
    const quantity = consumableData.quantity !== undefined ? Number(consumableData.quantity) : packQty;

    const newDoc = {
        name: consumableData.name || "Untitled Consumable",
        category: consumableData.category || "General",
        quantity: quantity,
        unit_of_measure: consumableData.unit_of_measure || "pcs",
        pack_quantity: packQty,
        pack_price: packPrice,
        unit_cost: unitCost,
        supplier: consumableData.supplier || "",
        reorder_threshold: Number(consumableData.reorder_threshold) || 10,
        status: consumableData.status || (quantity <= 0 ? "Out of Stock" : quantity <= 10 ? "Low" : "In Stock"),
        notes: consumableData.notes || "",
        product_url: consumableData.product_url || "",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, newDoc);

    await logMovement(userId, {
        type: "initial",
        item_type: "consumable",
        item_id: docRef.id,
        item_name: newDoc.name,
        quantity_change: quantity,
        unit: newDoc.unit_of_measure,
        reason: "Initial Stocking",
    });

    return { id: docRef.id, ...newDoc };
}

export async function updateConsumable(userId, id, updates) {
    const docRef = userDoc(userId, "consumables", id);
    const packQty = updates.pack_quantity !== undefined ? Number(updates.pack_quantity) : undefined;
    const packPrice = updates.pack_price !== undefined ? Number(updates.pack_price) : undefined;

    const dataToSave = {
        ...updates,
        updated_at: serverTimestamp(),
    };

    if (packQty !== undefined && packPrice !== undefined && packQty > 0) {
        dataToSave.unit_cost = Number((packPrice / packQty).toFixed(4));
    }

    await updateDoc(docRef, dataToSave);
    return { id, ...dataToSave };
}

export async function deleteConsumable(userId, id) {
    const docRef = userDoc(userId, "consumables", id);
    await deleteDoc(docRef);
    return { success: true };
}

export async function adjustConsumableQuantity(userId, id, newQty, reason = "Manual adjustment") {
    const docRef = userDoc(userId, "consumables", id);
    let diff = 0;
    let itemName = "";
    let unit = "pcs";

    await runTransaction(db, async (txn) => {
        const snap = await txn.get(docRef);
        if (!snap.exists()) throw new Error("Consumable not found");
        const curr = snap.data();
        itemName = curr.name;
        unit = curr.unit_of_measure || "pcs";
        diff = Number(newQty) - Number(curr.quantity || 0);
        const threshold = Number(curr.reorder_threshold || 10);
        let newStatus = curr.status;
        if (newQty <= 0) newStatus = "Out of Stock";
        else if (newQty <= threshold) newStatus = "Low";
        else newStatus = "In Stock";

        txn.update(docRef, {
            quantity: Number(newQty),
            status: newStatus,
            updated_at: serverTimestamp(),
        });
    });

    if (diff !== 0) {
        await logMovement(userId, {
            type: diff > 0 ? "addition" : "adjustment",
            item_type: "consumable",
            item_id: id,
            item_name: itemName,
            quantity_change: diff,
            unit,
            reason,
        });
    }

    return { success: true };
}

// ─── Printer Profiles ──────────────────────────────────────────────────────

export async function getPrinterProfiles(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "printer_profiles"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addPrinterProfile(userId, data) {
    const colRef = userCol(userId, "printer_profiles");
    const newDoc = {
        name: data.name || "Default 3D Printer",
        wattage: Number(data.wattage) || 350,
        electricity_rate: Number(data.electricity_rate) || 11.5,
        wear_rate: Number(data.wear_rate) || 5.0,
        is_default: data.is_default || false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };
    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
}

export async function updatePrinterProfile(userId, id, updates) {
    const docRef = userDoc(userId, "printer_profiles", id);
    await updateDoc(docRef, { ...updates, updated_at: serverTimestamp() });
    return { id, ...updates };
}

export async function deletePrinterProfile(userId, id) {
    const docRef = userDoc(userId, "printer_profiles", id);
    await deleteDoc(docRef);
    return { success: true };
}

// ─── Cost Estimates ────────────────────────────────────────────────────────

export async function getCostEstimates(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "cost_estimates"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveCostEstimate(userId, data) {
    const colRef = userCol(userId, "cost_estimates");
    const newDoc = {
        title: data.title || "Custom Estimate",
        materials: data.materials || [],
        consumables: data.consumables || [],
        print_hours: Number(data.print_hours) || 0,
        labor_hours: Number(data.labor_hours) || 0,
        pricing_mode: data.pricing_mode || "markup", // "markup" | "margin"
        margin_percent: Number(data.margin_percent) || 30,
        failure_buffer_percent: Number(data.failure_buffer_percent) || 10,
        overhead_cost: Number(data.overhead_cost) || 0,
        material_cost: Number(data.material_cost) || 0,
        consumable_cost: Number(data.consumable_cost) || 0,
        electricity_cost: Number(data.electricity_cost) || 0,
        machine_wear_cost: Number(data.machine_wear_cost) || 0,
        labor_cost: Number(data.labor_cost) || 0,
        base_cost: Number(data.base_cost) || 0,
        buffered_cost: Number(data.buffered_cost) || 0,
        selling_price: Number(data.selling_price) || 0,
        gross_profit: Number(data.gross_profit) || 0,
        created_at: serverTimestamp(),
    };
    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
}

export async function deleteCostEstimate(userId, id) {
    const docRef = userDoc(userId, "cost_estimates", id);
    await deleteDoc(docRef);
    return { success: true };
}

// ─── Print Jobs (Production Tracker) ────────────────────────────────────────

export async function getPrintJobs(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "print_jobs"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPrintJob(userId, jobData) {
    const colRef = userCol(userId, "print_jobs");
    const countSnap = await getDocs(userCol(userId, "print_jobs"));
    const jobNumber = `JOB-${new Date().getFullYear()}-${String(countSnap.size + 1).padStart(3, "0")}`;

    const newDoc = {
        job_number: jobNumber,
        product_name: jobData.product_name || "Custom 3D Print",
        customer_name: jobData.customer_name || "",
        assigned_printer: jobData.assigned_printer || "Default Printer",
        estimated_duration_hrs: Number(jobData.estimated_duration_hrs) || 0,
        actual_duration_hrs: Number(jobData.actual_duration_hrs) || 0,
        filaments_used: jobData.filaments_used || [], // [{ filament_id, name, grams, color_hex }]
        consumables_used: jobData.consumables_used || [], // [{ consumable_id, name, qty, unit }]
        estimated_cost: Number(jobData.estimated_cost) || 0,
        actual_cost: Number(jobData.actual_cost) || Number(jobData.estimated_cost) || 0,
        selling_price: Number(jobData.selling_price) || 0,
        status: jobData.status || "Queued", // Queued, Printing, Completed, Failed, Cancelled
        deducted: false, // Idempotency flag
        notes: jobData.notes || "",
        created_at: serverTimestamp(),
        completed_at: null,
    };

    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
}

export async function updatePrintJob(userId, id, updates) {
    const docRef = userDoc(userId, "print_jobs", id);
    await updateDoc(docRef, { ...updates, updated_at: serverTimestamp() });
    return { id, ...updates };
}

/**
 * Marks print job Completed and ATOMICALLY/IDEMPOTENTLY deducts inventory.
 */
export async function completePrintJob(userId, jobId) {
    const jobRef = userDoc(userId, "print_jobs", jobId);

    let finalJob = null;

    await runTransaction(db, async (txn) => {
        // --- PHASE 1: ALL READS FIRST ---
        const jobSnap = await txn.get(jobRef);
        if (!jobSnap.exists()) throw new Error("Print job not found");
        const job = jobSnap.data();
        finalJob = job;

        // Idempotency: if already deducted, do not deduct again
        if (job.deducted) {
            txn.update(jobRef, {
                status: "Completed",
                updated_at: serverTimestamp(),
            });
            return;
        }

        // Read all filament documents
        const filamentUpdates = [];
        for (const fil of job.filaments_used || []) {
            if (!fil.filament_id || !fil.grams) continue;
            const fRef = userDoc(userId, "filaments", fil.filament_id);
            const fSnap = await txn.get(fRef);
            if (fSnap.exists()) {
                const fData = fSnap.data();
                const newRemaining = Math.max(0, Number((fData.remaining_weight_g - fil.grams).toFixed(2)));
                const threshold = Number(fData.min_threshold_g || 100);
                let newStatus = fData.status;
                if (newRemaining <= 0) newStatus = "Empty";
                else if (newRemaining <= threshold) newStatus = "Low";
                else newStatus = "In Use";

                filamentUpdates.push({
                    ref: fRef,
                    data: {
                        remaining_weight_g: newRemaining,
                        status: newStatus,
                        updated_at: serverTimestamp(),
                    },
                });
            }
        }

        // Read all consumable documents
        const consumableUpdates = [];
        for (const item of job.consumables_used || []) {
            if (!item.consumable_id || !item.qty) continue;
            const cRef = userDoc(userId, "consumables", item.consumable_id);
            const cSnap = await txn.get(cRef);
            if (cSnap.exists()) {
                const cData = cSnap.data();
                const newQty = Math.max(0, Number((cData.quantity - item.qty).toFixed(2)));
                const threshold = Number(cData.reorder_threshold || 10);
                let newStatus = cData.status;
                if (newQty <= 0) newStatus = "Out of Stock";
                else if (newQty <= threshold) newStatus = "Low";
                else newStatus = "In Stock";

                consumableUpdates.push({
                    ref: cRef,
                    data: {
                        quantity: newQty,
                        status: newStatus,
                        updated_at: serverTimestamp(),
                    },
                });
            }
        }

        // --- PHASE 2: ALL WRITES AFTER ALL READS COMPLETED ---
        for (const u of filamentUpdates) {
            txn.update(u.ref, u.data);
        }

        for (const u of consumableUpdates) {
            txn.update(u.ref, u.data);
        }

        txn.update(jobRef, {
            status: "Completed",
            deducted: true,
            completed_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        });
    });

    // Log movements outside transaction
    if (finalJob && !finalJob.deducted) {
        for (const fil of finalJob.filaments_used || []) {
            await logMovement(userId, {
                type: "deduction",
                item_type: "filament",
                item_id: fil.filament_id,
                item_name: fil.name || "Filament",
                quantity_change: -Math.abs(Number(fil.grams)),
                unit: "g",
                reason: `Print Job Completed (${finalJob.job_number})`,
                reference_id: jobId,
            });
        }
        for (const item of finalJob.consumables_used || []) {
            await logMovement(userId, {
                type: "deduction",
                item_type: "consumable",
                item_id: item.consumable_id,
                item_name: item.name || "Consumable",
                quantity_change: -Math.abs(Number(item.qty)),
                unit: item.unit || "pcs",
                reason: `Print Job Completed (${finalJob.job_number})`,
                reference_id: jobId,
            });
        }
    }

    return { success: true };
}

/**
 * Reverts deduction if job cancelled or rolled back.
 */
export async function revertPrintJobDeduction(userId, jobId, newStatus = "Cancelled") {
    const jobRef = userDoc(userId, "print_jobs", jobId);

    let finalJob = null;

    await runTransaction(db, async (txn) => {
        // --- PHASE 1: ALL READS FIRST ---
        const jobSnap = await txn.get(jobRef);
        if (!jobSnap.exists()) throw new Error("Print job not found");
        const job = jobSnap.data();
        finalJob = job;

        if (!job.deducted) {
            txn.update(jobRef, { status: newStatus, updated_at: serverTimestamp() });
            return;
        }

        // Read all filament documents
        const filamentUpdates = [];
        for (const fil of job.filaments_used || []) {
            if (!fil.filament_id || !fil.grams) continue;
            const fRef = userDoc(userId, "filaments", fil.filament_id);
            const fSnap = await txn.get(fRef);
            if (fSnap.exists()) {
                const fData = fSnap.data();
                const newRemaining = Number((fData.remaining_weight_g + fil.grams).toFixed(2));
                filamentUpdates.push({
                    ref: fRef,
                    data: {
                        remaining_weight_g: newRemaining,
                        status: newRemaining > (fData.min_threshold_g || 100) ? "In Use" : fData.status,
                        updated_at: serverTimestamp(),
                    },
                });
            }
        }

        // Read all consumable documents
        const consumableUpdates = [];
        for (const item of job.consumables_used || []) {
            if (!item.consumable_id || !item.qty) continue;
            const cRef = userDoc(userId, "consumables", item.consumable_id);
            const cSnap = await txn.get(cRef);
            if (cSnap.exists()) {
                const cData = cSnap.data();
                const newQty = Number((cData.quantity + item.qty).toFixed(2));
                consumableUpdates.push({
                    ref: cRef,
                    data: {
                        quantity: newQty,
                        status: newQty > (cData.reorder_threshold || 10) ? "In Stock" : cData.status,
                        updated_at: serverTimestamp(),
                    },
                });
            }
        }

        // --- PHASE 2: ALL WRITES AFTER ALL READS COMPLETED ---
        for (const u of filamentUpdates) {
            txn.update(u.ref, u.data);
        }

        for (const u of consumableUpdates) {
            txn.update(u.ref, u.data);
        }

        txn.update(jobRef, {
            status: newStatus,
            deducted: false,
            updated_at: serverTimestamp(),
        });
    });

    // Log movements outside transaction
    if (finalJob && finalJob.deducted) {
        for (const fil of finalJob.filaments_used || []) {
            await logMovement(userId, {
                type: "return",
                item_type: "filament",
                item_id: fil.filament_id,
                item_name: fil.name || "Filament",
                quantity_change: Math.abs(Number(fil.grams)),
                unit: "g",
                reason: `Print Job Reverted / Cancelled (${finalJob.job_number})`,
                reference_id: jobId,
            });
        }
        for (const item of finalJob.consumables_used || []) {
            await logMovement(userId, {
                type: "return",
                item_type: "consumable",
                item_id: item.consumable_id,
                item_name: item.name || "Consumable",
                quantity_change: Math.abs(Number(item.qty)),
                unit: item.unit || "pcs",
                reason: `Print Job Reverted / Cancelled (${finalJob.job_number})`,
                reference_id: jobId,
            });
        }
    }

    return { success: true };
}

export async function deletePrintJob(userId, id) {
    const docRef = userDoc(userId, "print_jobs", id);
    await deleteDoc(docRef);
    return { success: true };
}

// ─── Quotations ────────────────────────────────────────────────────────────

export async function getQuotations(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "quotations"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createQuotation(userId, data) {
    const colRef = userCol(userId, "quotations");
    const countSnap = await getDocs(userCol(userId, "quotations"));
    const quoteNumber = `QT-${new Date().getFullYear()}-${String(countSnap.size + 1).padStart(3, "0")}`;

    const newDoc = {
        quote_number: quoteNumber,
        customer_name: data.customer_name || "Valued Client",
        customer_email: data.customer_email || "",
        customer_phone: data.customer_phone || "",
        items: data.items || [], // [{ description, quantity, unit_price, total }]
        subtotal: Number(data.subtotal) || 0,
        discount_percent: Number(data.discount_percent) || 0,
        discount_amount: Number(data.discount_amount) || 0,
        shipping_fee: Number(data.shipping_fee) || 0,
        total_price: Number(data.total_price) || 0,
        status: data.status || "Draft", // Draft, Sent, Accepted, Rejected
        valid_until: data.valid_until || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        notes: data.notes || "Thank you for considering our 3D printing services. Turnaround time starts after 50% deposit.",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
}

export async function updateQuotation(userId, id, updates) {
    const docRef = userDoc(userId, "quotations", id);
    await updateDoc(docRef, { ...updates, updated_at: serverTimestamp() });
    return { id, ...updates };
}

export async function deleteQuotation(userId, id) {
    const docRef = userDoc(userId, "quotations", id);
    await deleteDoc(docRef);
    return { success: true };
}

// ─── Sales & Profit Tracker ────────────────────────────────────────────────

export async function getSales(userId) {
    if (!userId) return [];
    const q = query(userCol(userId, "sales"), orderBy("sale_date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function recordSale(userId, data) {
    const colRef = userCol(userId, "sales");
    const sellingPrice = Number(data.selling_price) || 0;
    const productionCost = Number(data.production_cost) || 0;
    const grossProfit = Number((sellingPrice - productionCost).toFixed(2));
    const marginPercent = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(1)) : 0;

    const newDoc = {
        product_name: data.product_name || "Custom Print",
        customer_name: data.customer_name || "",
        quantity_sold: Number(data.quantity_sold) || 1,
        selling_price: sellingPrice,
        production_cost: productionCost,
        gross_profit: grossProfit,
        margin_percent: marginPercent,
        sale_date: data.sale_date || new Date().toISOString().slice(0, 10),
        payment_status: data.payment_status || "Paid", // Paid, Pending, Refunded
        linked_job_id: data.linked_job_id || null,
        linked_quote_id: data.linked_quote_id || null,
        notes: data.notes || "",
        created_at: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, newDoc);
    return { id: docRef.id, ...newDoc };
}

export async function updateSale(userId, id, updates) {
    const docRef = userDoc(userId, "sales", id);
    const sellingPrice = updates.selling_price !== undefined ? Number(updates.selling_price) : undefined;
    const productionCost = updates.production_cost !== undefined ? Number(updates.production_cost) : undefined;

    const dataToSave = { ...updates, updated_at: serverTimestamp() };
    if (sellingPrice !== undefined && productionCost !== undefined) {
        dataToSave.gross_profit = Number((sellingPrice - productionCost).toFixed(2));
        dataToSave.margin_percent = sellingPrice > 0 ? Number(((dataToSave.gross_profit / sellingPrice) * 100).toFixed(1)) : 0;
    }

    await updateDoc(docRef, dataToSave);
    return { id, ...dataToSave };
}

export async function deleteSale(userId, id) {
    const docRef = userDoc(userId, "sales", id);
    await deleteDoc(docRef);
    return { success: true };
}

// ─── Inventory Movements Audit ─────────────────────────────────────────────

export async function getInventoryMovements(userId, limitCount = 50) {
    if (!userId) return [];
    const q = query(userCol(userId, "inventory_movements"), orderBy("timestamp", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function logMovement(userId, movement) {
    try {
        const colRef = userCol(userId, "inventory_movements");
        await addDoc(colRef, {
            type: movement.type || "adjustment", // initial, addition, deduction, adjustment
            item_type: movement.item_type || "filament", // filament, consumable
            item_id: movement.item_id || "",
            item_name: movement.item_name || "",
            quantity_change: Number(movement.quantity_change) || 0,
            unit: movement.unit || "",
            reason: movement.reason || "Manual update",
            reference_id: movement.reference_id || null,
            timestamp: serverTimestamp(),
        });
    } catch (err) {
        console.warn("[studioService] Failed to log inventory movement:", err);
    }
}

// ─── Studio Settings ───────────────────────────────────────────────────────

export async function getStudioSettings(userId) {
    if (!userId) return null;
    try {
        const snap = await getDoc(userDoc(userId, "studio_settings", "config"));
        if (snap.exists()) return snap.data();
    } catch {
        // Fallback
    }
    return {
        currency: "₱",
        default_markup: 30,
        default_failure_margin: 10,
        default_labor_rate: 50,
        default_electricity_rate: 11.5,
        default_wattage: 350,
        default_wear_rate: 5.0,
    };
}

export async function saveStudioSettings(userId, settings) {
    const docRef = userDoc(userId, "studio_settings", "config");
    await setDoc(docRef, { ...settings, updated_at: serverTimestamp() }, { merge: true });
    return settings;
}
