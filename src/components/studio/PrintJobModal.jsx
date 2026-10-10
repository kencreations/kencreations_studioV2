import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, AlertCircle } from "lucide-react";

const STATUSES = ["Queued", "Printing", "Completed", "Failed", "Cancelled"];

export default function PrintJobModal({
    isOpen,
    onClose,
    job = null,
    filaments = [],
    consumables = [],
    printers = [],
    onSave,
}) {
    const isEditing = !!job;

    const [productName, setProductName] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [assignedPrinter, setAssignedPrinter] = useState(
        printers.find((p) => p.is_default)?.name || printers[0]?.name || "Default 3D Printer"
    );
    const [estimatedDurationHrs, setEstimatedDurationHrs] = useState(2.5);
    const [actualDurationHrs, setActualDurationHrs] = useState(2.5);
    const [filamentsUsed, setFilamentsUsed] = useState([]);
    const [consumablesUsed, setConsumablesUsed] = useState([]);
    const [estimatedCost, setEstimatedCost] = useState(0);
    const [actualCost, setActualCost] = useState(0);
    const [sellingPrice, setSellingPrice] = useState(0);
    const [status, setStatus] = useState("Queued");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (job) {
            setProductName(job.product_name || "");
            setCustomerName(job.customer_name || "");
            setAssignedPrinter(job.assigned_printer || "Default 3D Printer");
            setEstimatedDurationHrs(job.estimated_duration_hrs ?? 2);
            setActualDurationHrs(job.actual_duration_hrs ?? job.estimated_duration_hrs ?? 2);
            setFilamentsUsed(job.filaments_used || []);
            setConsumablesUsed(job.consumables_used || []);
            setEstimatedCost(job.estimated_cost ?? 0);
            setActualCost(job.actual_cost ?? job.estimated_cost ?? 0);
            setSellingPrice(job.selling_price ?? 0);
            setStatus(job.status || "Queued");
            setNotes(job.notes || "");
        } else {
            setProductName("");
            setCustomerName("");
            setAssignedPrinter(printers.find((p) => p.is_default)?.name || printers[0]?.name || "Default 3D Printer");
            setEstimatedDurationHrs(2.5);
            setActualDurationHrs(2.5);
            setFilamentsUsed(
                filaments.length > 0
                    ? [{ filament_id: filaments[0].id, name: filaments[0].name, grams: 35, color_hex: filaments[0].color_hex }]
                    : []
            );
            setConsumablesUsed([]);
            setEstimatedCost(0);
            setActualCost(0);
            setSellingPrice(0);
            setStatus("Queued");
            setNotes("");
        }
        setError("");
    }, [job, isOpen, filaments, printers]);

    // Recalculate estimated cost when items change if not editing fixed numbers
    useEffect(() => {
        if (isEditing) return;
        let filCost = 0;
        filamentsUsed.forEach((f) => {
            const match = filaments.find((item) => item.id === f.filament_id);
            if (match && match.spool_weight_g > 0) {
                filCost += (Number(f.grams) || 0) * (match.purchase_price / match.spool_weight_g);
            }
        });
        let conCost = 0;
        consumablesUsed.forEach((c) => {
            const match = consumables.find((item) => item.id === c.consumable_id);
            if (match && match.pack_quantity > 0) {
                conCost += (Number(c.qty) || 0) * (match.pack_price / match.pack_quantity);
            }
        });
        const total = Number((filCost + conCost).toFixed(2));
        setEstimatedCost(total);
        setActualCost(total);
        if (sellingPrice === 0) {
            setSellingPrice(Number((total * 2).toFixed(2)));
        }
    }, [filamentsUsed, consumablesUsed, filaments, consumables, isEditing]);

    if (!isOpen) return null;

    const addFilamentRow = () => {
        if (filaments.length === 0) return;
        setFilamentsUsed((prev) => [
            ...prev,
            { filament_id: filaments[0].id, name: filaments[0].name, grams: 20, color_hex: filaments[0].color_hex },
        ]);
    };

    const updateFilamentRow = (index, field, value) => {
        setFilamentsUsed((prev) => {
            const next = [...prev];
            const row = { ...next[index], [field]: value };
            if (field === "filament_id") {
                const match = filaments.find((f) => f.id === value);
                if (match) {
                    row.name = match.name;
                    row.color_hex = match.color_hex;
                }
            }
            next[index] = row;
            return next;
        });
    };

    const removeFilamentRow = (index) => {
        setFilamentsUsed((prev) => prev.filter((_, i) => i !== index));
    };

    const addConsumableRow = () => {
        if (consumables.length === 0) return;
        setConsumablesUsed((prev) => [
            ...prev,
            { consumable_id: consumables[0].id, name: consumables[0].name, qty: 1, unit: consumables[0].unit_of_measure },
        ]);
    };

    const updateConsumableRow = (index, field, value) => {
        setConsumablesUsed((prev) => {
            const next = [...prev];
            const row = { ...next[index], [field]: value };
            if (field === "consumable_id") {
                const match = consumables.find((c) => c.id === value);
                if (match) {
                    row.name = match.name;
                    row.unit = match.unit_of_measure;
                }
            }
            next[index] = row;
            return next;
        });
    };

    const removeConsumableRow = (index) => {
        setConsumablesUsed((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!productName.trim()) {
            setError("Product name is required.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            await onSave({
                product_name: productName.trim(),
                customer_name: customerName.trim(),
                assigned_printer: assignedPrinter,
                estimated_duration_hrs: Number(estimatedDurationHrs),
                actual_duration_hrs: Number(actualDurationHrs),
                filaments_used: filamentsUsed.map((f) => ({
                    filament_id: f.filament_id,
                    name: f.name,
                    grams: Number(f.grams) || 0,
                    color_hex: f.color_hex || "#14b8a6",
                })),
                consumables_used: consumablesUsed.map((c) => ({
                    consumable_id: c.consumable_id,
                    name: c.name,
                    qty: Number(c.qty) || 0,
                    unit: c.unit || "pcs",
                })),
                estimated_cost: Number(estimatedCost),
                actual_cost: Number(actualCost),
                selling_price: Number(sellingPrice),
                status,
                notes: notes.trim(),
            });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save print job.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-2xl w-full mx-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                            {isEditing ? `Edit Job (${job.job_number})` : "Create Print Job"}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Track production, printer assignment, and materials consumed
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Product / Model Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Personalized Name Keychain (KEN - 50 pcs)"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Customer Name (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. Maria Santos"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Assigned Printer</label>
                            <select
                                value={assignedPrinter}
                                onChange={(e) => setAssignedPrinter(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            >
                                {printers.length > 0 ? (
                                    printers.map((p) => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))
                                ) : (
                                    <option value="Default 3D Printer">Default 3D Printer</option>
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Linked Filaments */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">Filament Consumption</h3>
                            <button
                                type="button"
                                onClick={addFilamentRow}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Color / Spool
                            </button>
                        </div>

                        {filamentsUsed.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No filaments assigned to this print job.</p>
                        ) : (
                            filamentsUsed.map((row, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <select
                                        value={row.filament_id}
                                        onChange={(e) => updateFilamentRow(idx, "filament_id", e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none"
                                    >
                                        {filaments.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                {f.name} ({f.material} · {f.remaining_weight_g ?? f.spool_weight_g}g stock)
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 w-28">
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            value={row.grams}
                                            onChange={(e) => updateFilamentRow(idx, "grams", parseFloat(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-mono font-bold outline-none"
                                        />
                                        <span className="text-[11px] text-gray-400 font-bold ml-1">g</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFilamentRow(idx)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Linked Consumables */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">Consumables & Hardware</h3>
                            <button
                                type="button"
                                onClick={addConsumableRow}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Supply Item
                            </button>
                        </div>

                        {consumablesUsed.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No consumables linked to this job.</p>
                        ) : (
                            consumablesUsed.map((row, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <select
                                        value={row.consumable_id}
                                        onChange={(e) => updateConsumableRow(idx, "consumable_id", e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none"
                                    >
                                        {consumables.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.quantity} {c.unit_of_measure} stock)
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 w-28">
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={row.qty}
                                            onChange={(e) => updateConsumableRow(idx, "qty", parseFloat(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-mono font-bold outline-none"
                                        />
                                        <span className="text-[11px] text-gray-400 font-bold ml-1">{row.unit}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeConsumableRow(idx)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Duration & Financials */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Print Hours</label>
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={actualDurationHrs}
                                onChange={(e) => setActualDurationHrs(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Total Cost (₱)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={actualCost}
                                onChange={(e) => setActualCost(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Selling Price (₱)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={sellingPrice}
                                onChange={(e) => setSellingPrice(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Job Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Slicer settings, infill, nozzle size, delivery notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {saving ? "Saving..." : isEditing ? "Update Job" : "Create Job"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
