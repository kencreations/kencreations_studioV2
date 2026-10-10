import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";

const MATERIALS = [
    "PLA",
    "PLA+",
    "PLA Silk",
    "PETG",
    "ABS",
    "ASA",
    "TPU",
    "PC",
    "Nylon",
    "Resin",
    "Other"
];

const FILAMENT_BRANDS = [
    "Generic",
    "Amolen",
    "Anycubic",
    "Bambu Lab",
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
    "Prusament",
    "Sunlu",
    "Other"
];

const STATUSES = ["New", "In Use", "Low", "Empty"];

const PRESET_HEXES = [
    "#000000", "#FFFFFF", "#64748B", "#EF4444", "#F97316",
    "#F59E0B", "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
    "#6366F1", "#8B5CF6", "#EC4899", "#78350F"
];

export default function FilamentModal({ isOpen, onClose, filament = null, onSave }) {
    const isEditing = !!filament;

    const [name, setName] = useState("");
    const [brand, setBrand] = useState("Bambu Lab");
    const [material, setMaterial] = useState("PLA");
    const [colorName, setColorName] = useState("");
    const [colorHex, setColorHex] = useState("#14b8a6");
    const [spoolId, setSpoolId] = useState("");
    const [spoolWeightG, setSpoolWeightG] = useState(1000);
    const [remainingWeightG, setRemainingWeightG] = useState(1000);
    const [purchasePrice, setPurchasePrice] = useState(750);
    const [supplier, setSupplier] = useState("");
    const [purchaseDate, setPurchaseDate] = useState("");
    const [minThresholdG, setMinThresholdG] = useState(100);
    const [status, setStatus] = useState("New");
    const [notes, setNotes] = useState("");
    const [productUrl, setProductUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (filament) {
            setName(filament.name || "");
            setBrand(filament.brand || "Generic");
            setMaterial(filament.material || "PLA");
            setColorName(filament.color_name || "");
            setColorHex(filament.color_hex || "#14b8a6");
            setSpoolId(filament.spool_id || "");
            setSpoolWeightG(filament.spool_weight_g ?? 1000);
            setRemainingWeightG(filament.remaining_weight_g ?? filament.spool_weight_g ?? 1000);
            setPurchasePrice(filament.purchase_price ?? 0);
            setSupplier(filament.supplier || "");
            setPurchaseDate(filament.purchase_date || new Date().toISOString().slice(0, 10));
            setMinThresholdG(filament.min_threshold_g ?? 100);
            setStatus(filament.status || "In Use");
            setNotes(filament.notes || "");
            setProductUrl(filament.product_url || "");
        } else {
            setName("");
            setBrand("Bambu Lab");
            setMaterial("PLA");
            setColorName("");
            setColorHex("#14b8a6");
            setSpoolId("");
            setSpoolWeightG(1000);
            setRemainingWeightG(1000);
            setPurchasePrice(750);
            setSupplier("");
            setPurchaseDate(new Date().toISOString().slice(0, 10));
            setMinThresholdG(100);
            setStatus("New");
            setNotes("");
            setProductUrl("");
        }
        setError("");
    }, [filament, isOpen]);

    if (!isOpen) return null;

    const costPerGram = spoolWeightG > 0 ? (purchasePrice / spoolWeightG) : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Spool name is required.");
            return;
        }
        if (spoolWeightG <= 0) {
            setError("Spool weight must be greater than zero.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            await onSave({
                name: name.trim(),
                brand,
                material,
                color_name: colorName.trim(),
                color_hex: colorHex,
                spool_id: spoolId.trim(),
                spool_weight_g: Number(spoolWeightG),
                remaining_weight_g: Number(remainingWeightG),
                purchase_price: Number(purchasePrice),
                cost_per_gram: Number(costPerGram.toFixed(4)),
                supplier: supplier.trim(),
                purchase_date: purchaseDate,
                min_threshold_g: Number(minThresholdG),
                status,
                notes: notes.trim(),
                product_url: productUrl.trim(),
            });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save filament.");
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
                            {isEditing ? "Edit Filament Spool" : "Add New Filament Spool"}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Keep track of spool stock, material costs, and usage
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
                    {/* Primary Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                Spool / Color Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Bambu Lab Matte Dark Teal"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Brand</label>
                            <select
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                            >
                                {FILAMENT_BRANDS.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Material</label>
                            <select
                                value={material}
                                onChange={(e) => setMaterial(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                            >
                                {MATERIALS.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Color Swatch & Custom Hex */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Color Swatch & Hex</label>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {PRESET_HEXES.map((hex) => (
                                <button
                                    key={hex}
                                    type="button"
                                    onClick={() => setColorHex(hex)}
                                    style={{ backgroundColor: hex }}
                                    className={`w-7 h-7 rounded-lg border shadow-xs transition-transform ${
                                        colorHex.toLowerCase() === hex.toLowerCase() ? "scale-115 ring-2 ring-teal-500 border-white" : "border-black/10 hover:scale-105"
                                    }`}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1">
                                <input
                                    type="color"
                                    value={colorHex}
                                    onChange={(e) => setColorHex(e.target.value)}
                                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                                />
                                <input
                                    type="text"
                                    value={colorHex}
                                    onChange={(e) => setColorHex(e.target.value)}
                                    className="bg-transparent font-mono text-sm uppercase text-gray-800 font-semibold outline-none w-24"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Color label (e.g. Jade White)"
                                value={colorName}
                                onChange={(e) => setColorName(e.target.value)}
                                className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>
                    </div>

                    {/* Weight & Cost Details */}
                    <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/70 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-teal-800 uppercase tracking-wider">Weight & Cost Metrics</h3>
                            <div className="text-xs font-mono font-bold text-teal-700">
                                Unit Cost: <span className="text-sm font-black text-teal-900">₱{costPerGram.toFixed(3)}/g</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Spool Size</label>
                                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-2">
                                    <input
                                        type="number"
                                        min="50"
                                        step="50"
                                        value={spoolWeightG}
                                        onChange={(e) => {
                                            const v = Number(e.target.value) || 0;
                                            setSpoolWeightG(v);
                                            if (!isEditing) setRemainingWeightG(v);
                                        }}
                                        className="w-full text-right font-mono font-bold text-sm outline-none"
                                    />
                                    <span className="text-xs text-gray-400 font-bold ml-1">g</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Remaining</label>
                                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={remainingWeightG}
                                        onChange={(e) => setRemainingWeightG(Number(e.target.value) || 0)}
                                        className="w-full text-right font-mono font-bold text-sm outline-none"
                                    />
                                    <span className="text-xs text-gray-400 font-bold ml-1">g</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Purchase Price</label>
                                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-2">
                                    <span className="text-xs text-gray-400 font-bold mr-1">₱</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={purchasePrice}
                                        onChange={(e) => setPurchasePrice(Number(e.target.value) || 0)}
                                        className="w-full text-right font-mono font-bold text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Low-Stock Alert</label>
                                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="10"
                                        value={minThresholdG}
                                        onChange={(e) => setMinThresholdG(Number(e.target.value) || 0)}
                                        className="w-full text-right font-mono font-bold text-sm outline-none"
                                    />
                                    <span className="text-xs text-gray-400 font-bold ml-1">g</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Operational Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Spool / Batch ID</label>
                            <input
                                type="text"
                                placeholder="e.g. SP-042 or RFID #1"
                                value={spoolId}
                                onChange={(e) => setSpoolId(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Supplier</label>
                            <input
                                type="text"
                                placeholder="e.g. Shopee, Lazada, Polymaker PH"
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Product / Reorder Link</label>
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
                            placeholder="Printing temperature tips, retraction notes, or special project tags..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-teal-500"
                        />
                    </div>

                    {/* Actions */}
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
                            {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Spool"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
