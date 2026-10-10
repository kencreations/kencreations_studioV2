import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, AlertCircle } from "lucide-react";

const STATUSES = ["Draft", "Sent", "Accepted", "Rejected"];

export default function QuotationModal({
    isOpen,
    onClose,
    quote = null,
    initialEstimate = null,
    onSave,
}) {
    const isEditing = !!quote;

    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [items, setItems] = useState([
        { description: "Custom 3D Print", quantity: 1, unit_price: 250, total: 250 },
    ]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [shippingFee, setShippingFee] = useState(0);
    const [status, setStatus] = useState("Draft");
    const [validUntil, setValidUntil] = useState("");
    const [notes, setNotes] = useState(
        "Thank you for considering our 3D printing services. Turnaround time starts after 50% deposit. Valid for 14 days."
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (quote) {
            setCustomerName(quote.customer_name || "");
            setCustomerEmail(quote.customer_email || "");
            setCustomerPhone(quote.customer_phone || "");
            setItems(quote.items || [{ description: "Custom 3D Print", quantity: 1, unit_price: 250, total: 250 }]);
            setDiscountPercent(quote.discount_percent ?? 0);
            setShippingFee(quote.shipping_fee ?? 0);
            setStatus(quote.status || "Draft");
            setValidUntil(quote.valid_until || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
            setNotes(quote.notes || "");
        } else if (initialEstimate) {
            setCustomerName("");
            setCustomerEmail("");
            setCustomerPhone("");
            setItems([
                {
                    description: initialEstimate.title || "Custom 3D Print",
                    quantity: 1,
                    unit_price: Number(initialEstimate.selling_price) || 250,
                    total: Number(initialEstimate.selling_price) || 250,
                },
            ]);
            setDiscountPercent(0);
            setShippingFee(0);
            setStatus("Draft");
            setValidUntil(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
            setNotes(
                "Estimated manufacturing cost calculated via KenCreations Studio. Turnaround time: 2-3 business days upon confirmation."
            );
        } else {
            setCustomerName("");
            setCustomerEmail("");
            setCustomerPhone("");
            setItems([{ description: "3D Printed Prototype / Custom Item", quantity: 1, unit_price: 350, total: 350 }]);
            setDiscountPercent(0);
            setShippingFee(0);
            setStatus("Draft");
            setValidUntil(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
            setNotes(
                "Thank you for considering our 3D printing services. Turnaround time starts after 50% deposit. Valid for 14 days."
            );
        }
        setError("");
    }, [quote, initialEstimate, isOpen]);

    if (!isOpen) return null;

    const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
    const totalPrice = Number((subtotal - discountAmount + Number(shippingFee)).toFixed(2));

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            { description: "", quantity: 1, unit_price: 100, total: 100 },
        ]);
    };

    const updateItem = (index, field, value) => {
        setItems((prev) => {
            const next = [...prev];
            const updated = { ...next[index], [field]: value };
            if (field === "quantity" || field === "unit_price") {
                const qty = field === "quantity" ? Number(value) || 0 : Number(updated.quantity) || 0;
                const price = field === "unit_price" ? Number(value) || 0 : Number(updated.unit_price) || 0;
                updated.total = Number((qty * price).toFixed(2));
            }
            next[index] = updated;
            return next;
        });
    };

    const removeItem = (index) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!customerName.trim()) {
            setError("Customer name is required.");
            return;
        }
        if (items.length === 0) {
            setError("Please include at least one quotation line item.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            await onSave({
                customer_name: customerName.trim(),
                customer_email: customerEmail.trim(),
                customer_phone: customerPhone.trim(),
                items,
                subtotal: Number(subtotal.toFixed(2)),
                discount_percent: Number(discountPercent),
                discount_amount: discountAmount,
                shipping_fee: Number(shippingFee),
                total_price: totalPrice,
                status,
                valid_until: validUntil,
                notes: notes.trim(),
            });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save quotation.");
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
                            {isEditing ? `Edit Quotation (${quote.quote_number})` : "Create Quotation"}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Generate and deliver professional customer price quotes
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
                    {/* Customer Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Customer Name *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. John Doe"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email (Optional)</label>
                            <input
                                type="email"
                                placeholder="client@example.com"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Phone / Messenger</label>
                            <input
                                type="text"
                                placeholder="+63 9..."
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">Line Items</h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        {items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    required
                                    placeholder="Item description / model"
                                    value={item.description}
                                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none"
                                />
                                <div className="w-20">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-center outline-none"
                                    />
                                </div>
                                <div className="w-24">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unit_price}
                                        onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-right outline-none"
                                    />
                                </div>
                                <div className="w-24 px-2 py-2 text-right font-mono text-xs font-black text-gray-800">
                                    ₱{(Number(item.total) || 0).toFixed(2)}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeItem(idx)}
                                    disabled={items.length === 1}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg disabled:opacity-30"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Summary Adjustments */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Discount (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={discountPercent}
                                onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Shipping Fee (₱)</label>
                            <input
                                type="number"
                                min="0"
                                step="10"
                                value={shippingFee}
                                onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Valid Until</label>
                            <input
                                type="date"
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Status</label>
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

                    {/* Total Card */}
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-teal-800 uppercase">Quotation Grand Total</span>
                            <div className="text-2xl font-black font-mono text-teal-900">₱{totalPrice.toFixed(2)}</div>
                        </div>
                        <div className="text-right text-xs font-medium text-teal-700">
                            Subtotal: ₱{subtotal.toFixed(2)} {discountAmount > 0 && `· Discount: -₱${discountAmount.toFixed(2)}`}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Terms & Notes</label>
                        <textarea
                            rows={2}
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
                            {saving ? "Saving..." : isEditing ? "Update Quotation" : "Create Quotation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
