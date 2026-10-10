import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";

const PAYMENT_STATUSES = ["Paid", "Pending", "Refunded"];

export default function SaleModal({
    isOpen,
    onClose,
    sale = null,
    linkedJob = null,
    onSave,
}) {
    const isEditing = !!sale;

    const [productName, setProductName] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [saleDate, setSaleDate] = useState("");
    const [quantitySold, setQuantitySold] = useState(1);
    const [sellingPrice, setSellingPrice] = useState(0);
    const [productionCost, setProductionCost] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState("Paid");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (sale) {
            setProductName(sale.product_name || "");
            setCustomerName(sale.customer_name || "");
            setSaleDate(sale.sale_date || new Date().toISOString().slice(0, 10));
            setQuantitySold(sale.quantity_sold ?? 1);
            setSellingPrice(sale.selling_price ?? 0);
            setProductionCost(sale.production_cost ?? 0);
            setPaymentStatus(sale.payment_status || "Paid");
            setNotes(sale.notes || "");
        } else if (linkedJob) {
            setProductName(linkedJob.product_name || "3D Print");
            setCustomerName(linkedJob.customer_name || "");
            setSaleDate(new Date().toISOString().slice(0, 10));
            setQuantitySold(1);
            setSellingPrice(linkedJob.selling_price || 0);
            setProductionCost(linkedJob.actual_cost || linkedJob.estimated_cost || 0);
            setPaymentStatus("Paid");
            setNotes(`Linked to Print Job ${linkedJob.job_number}`);
        } else {
            setProductName("");
            setCustomerName("");
            setSaleDate(new Date().toISOString().slice(0, 10));
            setQuantitySold(1);
            setSellingPrice(500);
            setProductionCost(150);
            setPaymentStatus("Paid");
            setNotes("");
        }
        setError("");
    }, [sale, linkedJob, isOpen]);

    if (!isOpen) return null;

    const grossProfit = Number((sellingPrice - productionCost).toFixed(2));
    const marginPercent = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(1)) : 0;

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
                sale_date: saleDate,
                quantity_sold: Number(quantitySold),
                selling_price: Number(sellingPrice),
                production_cost: Number(productionCost),
                gross_profit: grossProfit,
                margin_percent: marginPercent,
                payment_status: paymentStatus,
                linked_job_id: linkedJob?.id || sale?.linked_job_id || null,
                notes: notes.trim(),
            });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to record sale.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full mx-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                            {isEditing ? "Edit Sale Record" : "Record Completed Sale"}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Track revenue, production costs, and actual profit margins
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

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Product Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. 3D Printed Desk Standee"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-teal-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Customer (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. John Santos"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Sale Date</label>
                            <input
                                type="date"
                                required
                                value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Qty Sold</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={quantitySold}
                                onChange={(e) => setQuantitySold(Number(e.target.value) || 1)}
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
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Prod. Cost (₱)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={productionCost}
                                onChange={(e) => setProductionCost(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                            />
                        </div>
                    </div>

                    {/* Calculated Profit Display */}
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200/70 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-teal-800 uppercase">Gross Profit</span>
                            <div className="text-2xl font-black font-mono text-teal-900">₱{grossProfit.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-teal-800 uppercase">Profit Margin</span>
                            <div className="text-lg font-black font-mono text-teal-700">{marginPercent}%</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Payment Status</label>
                        <select
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                        >
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Invoice reference, payment method (GCash, Cash, Bank Transfer)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-teal-500"
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
                            {saving ? "Saving..." : isEditing ? "Update Sale" : "Record Sale"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
