import React, { useState } from "react";

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "PLA Silk", "PLA+", "Resin", "Other"];
const STATUSES = ["New", "In Use", "Low", "Empty"];
const FILAMENT_BRANDS = [
  "Generic",
  "Amolen",
  "Anycubic",
  "Bambu Lab",
  "ColorFabb",
  "Creality",
  "Elegoo",
  "Eryone",
  "eSUN",
  "Flashforge",
  "Hatchbox",
  "Inland",
  "MatterHackers",
  "Overture",
  "Polymaker",
  "Protopasta",
  "Prusament",
  "Sunlu",
  "Tronxy",
  "Ziro",
  "Other"
];

const EMPTY_FORM = {
    name: "",
    brand: "",
    material: "PLA",
    color_hex: "#FF6B00",
    spool_weight_g: 1000,
    purchase_price: 0,
    status: "New",
    product_url: "",
};

export default function FilamentForm({ initial = null, onSave, onCancel }) {
    const [form, setForm] = useState(initial ?? EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required."); return; }
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
                        id="filament-name"
                        type="text"
                        value={form.name}
                        onChange={e => set("name", e.target.value)}
                        placeholder="e.g. BambuLab Flame Red"
                        className={inputCls}
                        required
                    />
                </div>
                <div>
                    <label className={labelCls}>Brand</label>
                    <select
                        id="filament-brand"
                        value={form.brand}
                        onChange={e => set("brand", e.target.value)}
                        className={inputCls}
                    >
                        <option value="" disabled>Select a brand...</option>
                        {FILAMENT_BRANDS.map((brand) => (
                            <option key={brand} value={brand}>{brand}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Material</label>
                    <select
                        id="filament-material"
                        value={form.material}
                        onChange={e => set("material", e.target.value)}
                        className={inputCls}
                    >
                        {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Spool Weight (g)</label>
                    <input
                        id="filament-spool-weight"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.spool_weight_g}
                        onChange={e => set("spool_weight_g", parseFloat(e.target.value) || 0)}
                        className={inputCls}
                    />
                </div>
                <div>
                    <label className={labelCls}>Purchase Price (₱)</label>
                    <input
                        id="filament-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.purchase_price}
                        onChange={e => set("purchase_price", parseFloat(e.target.value) || 0)}
                        className={inputCls}
                    />
                </div>
                <div>
                    <label className={labelCls}>Status</label>
                    <select
                        id="filament-status"
                        value={form.status}
                        onChange={e => set("status", e.target.value)}
                        className={inputCls}
                    >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Filament Color</label>
                    <div className="flex items-center gap-3">
                        <input
                            id="filament-color"
                            type="color"
                            value={form.color_hex}
                            onChange={e => set("color_hex", e.target.value)}
                            className="w-12 h-[42px] rounded-xl cursor-pointer p-0 border-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-gray-500">{form.color_hex}</span>
                    </div>
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Product URL (optional)</label>
                    <input
                        id="filament-url"
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
                    {saving ? "Saving…" : initial ? "Update Filament" : "Add Filament"}
                </button>
            </div>
        </form>
    );
}
