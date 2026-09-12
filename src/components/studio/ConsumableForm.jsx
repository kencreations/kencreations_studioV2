import React, { useState } from "react";

const CATEGORIES = ["Packaging", "Labels", "Hardware", "Finishing", "Tools", "General"];
const UNITS = ["pcs", "meters", "sheets", "ml", "rolls", "bags", "pairs", "sets"];
const STATUSES = ["In Stock", "Low", "Out of Stock"];

const EMPTY_FORM = {
    name: "",
    category: "Packaging",
    pack_quantity: 1,
    pack_price: 0,
    unit_of_measure: "pcs",
    status: "In Stock",
    product_url: "",
};

export default function ConsumableForm({ initial = null, onSave, onCancel }) {
    const [form, setForm] = useState(initial ?? EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required."); return; }
        if (form.pack_quantity <= 0) { setError("Pack quantity must be greater than 0."); return; }
        setSaving(true);
        setError("");
        try {
            await onSave(form);
        } catch (err) {
            setError(err.message || "Failed to save.");
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full bg-white/60 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-[#00A3A3] focus:ring-2 focus:ring-[#00A3A3]/20 transition-all duration-200";
    const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className={labelCls}>Name *</label>
                    <input
                        id="consumable-name"
                        type="text"
                        value={form.name}
                        onChange={e => set("name", e.target.value)}
                        placeholder="e.g. Kraft Paper Bag (5x8)"
                        className={inputCls}
                        required
                    />
                </div>
                <div>
                    <label className={labelCls}>Category</label>
                    <select
                        id="consumable-category"
                        value={form.category}
                        onChange={e => set("category", e.target.value)}
                        className={inputCls}
                    >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Status</label>
                    <select
                        id="consumable-status"
                        value={form.status}
                        onChange={e => set("status", e.target.value)}
                        className={inputCls}
                    >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Pack Quantity</label>
                    <div className="flex gap-2">
                        <input
                            id="consumable-pack-qty"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.pack_quantity}
                            onChange={e => set("pack_quantity", parseFloat(e.target.value) || 1)}
                            className={inputCls}
                        />
                        <select
                            id="consumable-unit"
                            value={form.unit_of_measure}
                            onChange={e => set("unit_of_measure", e.target.value)}
                            className="bg-white/60 border border-gray-200/60 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-[#00A3A3] focus:ring-2 focus:ring-[#00A3A3]/20 transition-all duration-200"
                        >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Pack Price (₱)</label>
                    <input
                        id="consumable-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.pack_price}
                        onChange={e => set("pack_price", parseFloat(e.target.value) || 0)}
                        className={inputCls}
                    />
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Product URL (optional)</label>
                    <input
                        id="consumable-url"
                        type="url"
                        value={form.product_url}
                        onChange={e => set("product_url", e.target.value)}
                        placeholder="https://store.example.com/product"
                        className={inputCls}
                    />
                </div>
            </div>

            {error && (
                <p className="text-sm font-semibold text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-primary hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all text-sm"
                >
                    {saving ? "Saving…" : initial ? "Update Consumable" : "Add Consumable"}
                </button>
            </div>
        </form>
    );
}
