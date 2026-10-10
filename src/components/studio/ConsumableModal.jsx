import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";

const CATEGORIES = [
    "Packaging",
    "Labels",
    "Hardware",
    "Keyrings",
    "Magnets",
    "Finishing",
    "Tools",
    "Fasteners",
    "General"
];

const UNITS = ["pcs", "pairs", "sets", "meters", "ml", "sheets", "rolls", "bags"];
const STATUSES = ["In Stock", "Low", "Out of Stock"];

export default function ConsumableModal({ isOpen, onClose, consumable = null, onSave }) {
    const isEditing = !!consumable;

    const [name, setName] = useState("");
    const [category, setCategory] = useState("Packaging");
    const [quantity, setQuantity] = useState(100);
    const [unitOfMeasure, setUnitOfMeasure] = useState("pcs");
    const [packPrice, setPackPrice] = useState(250);
    const [packQuantity, setPackQuantity] = useState(100);
    const [supplier, setSupplier] = useState("");
    const [reorderThreshold, setReorderThreshold] = useState(20);
    const [status, setStatus] = useState("In Stock");
    const [notes, setNotes] = useState("");
    const [productUrl, setProductUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (consumable) {
            setName(consumable.name || "");
            setCategory(consumable.category || "General");
            setQuantity(consumable.quantity ?? 1);
            setUnitOfMeasure(consumable.unit_of_measure || "pcs");
            setPackPrice(consumable.pack_price ?? 0);
            setPackQuantity(consumable.pack_quantity ?? 1);
            setSupplier(consumable.supplier || "");
            setReorderThreshold(consumable.reorder_threshold ?? 10);
            setStatus(consumable.status || "In Stock");
            setNotes(consumable.notes || "");
            setProductUrl(consumable.product_url || "");
        } else {
            setName("");
            setCategory("Packaging");
            setQuantity(100);
            setUnitOfMeasure("pcs");
            setPackPrice(250);
            setPackQuantity(100);
            setSupplier("");
            setReorderThreshold(20);
            setStatus("In Stock");
            setNotes("");
            setProductUrl("");
        }
        setError("");
    }, [consumable, isOpen]);

    if (!isOpen) return null;

    const unitCost = packQuantity > 0 ? (packPrice / packQuantity) : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Consumable item name is required.");
            return;
        }
        if (packQuantity <= 0) {
            setError("Pack quantity must be greater than zero.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            await onSave({
                name: name.trim(),
                category,
                quantity: Number(quantity),
                unit_of_measure: unitOfMeasure,
                pack_price: Number(packPrice),
                pack_quantity: Number(packQuantity),
                unit_cost: Number(unitCost.toFixed(4)),
                supplier: supplier.trim(),
                reorder_threshold: Number(reorderThreshold),
                status,
                notes: notes.trim(),
                product_url: productUrl.trim(),
            });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save consumable item.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-xl w-full mx-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                            {isEditing ? "Edit Consumable Item" : "Add Consumable Supply"}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Keyrings, packaging, magnets, glue, and accessories
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
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            Item Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. 25mm Heavy Duty Keyrings with Chain"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Unit of Measure</label>
                            <select
                                value={unitOfMeasure}
                                onChange={(e) => setUnitOfMeasure(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                            >
                                {UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Derived Pricing Card */}
                    <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/70 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-teal-800 uppercase tracking-wider">Pack Pricing & Derived Cost</h3>
                            <div className="text-xs font-mono font-bold text-teal-700">
                                Derived Unit Price: <span className="text-sm font-black text-teal-900">₱{unitCost.toFixed(3)} / {unitOfMeasure}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Pack Quantity</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={packQuantity}
                                    onChange={(e) => setPackQuantity(Number(e.target.value) || 1)}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Pack Price (₱)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={packPrice}
                                    onChange={(e) => setPackPrice(Number(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Stock on Hand</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold font-mono text-right outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reorder Alert Threshold</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={reorderThreshold}
                                onChange={(e) => setReorderThreshold(Number(e.target.value) || 0)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Supplier</label>
                        <input
                            type="text"
                            placeholder="e.g. Divisoria Wholesaler, Shopee, Amazon"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Product Link</label>
                        <input
                            type="url"
                            placeholder="https://..."
                            value={productUrl}
                            onChange={(e) => setProductUrl(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Usage guidelines, pack dimensions, reorder notes..."
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
                            {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Consumable"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
