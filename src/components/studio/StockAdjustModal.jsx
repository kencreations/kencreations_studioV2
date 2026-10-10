import React, { useState } from "react";
import { X, Check, ArrowRight } from "lucide-react";
import { adjustFilamentWeight, adjustConsumableQuantity } from "../../services/studioService";

export default function StockAdjustModal({ isOpen, onClose, item, type = "filament", userId, onRefresh }) {
    if (!isOpen || !item) return null;

    const isFilament = type === "filament";
    const currentQty = isFilament ? (item.remaining_weight_g ?? item.spool_weight_g ?? 0) : (item.quantity ?? 0);
    const unit = isFilament ? "g" : (item.unit_of_measure || "pcs");

    const [newVal, setNewVal] = useState(currentQty);
    const [reason, setReason] = useState("Manual physical inventory count");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const diff = Number(newVal) - Number(currentQty);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            if (isFilament) {
                await adjustFilamentWeight(userId, item.id, Number(newVal), reason);
            } else {
                await adjustConsumableQuantity(userId, item.id, Number(newVal), reason);
            }
            await onRefresh();
            onClose();
        } catch (err) {
            setError(err.message || "Failed to adjust stock.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-auto animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Adjust Stock</h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">{item.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSave} className="mt-5 space-y-4">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                        <div>
                            <span className="text-[11px] font-bold text-gray-400 uppercase">Current Stock</span>
                            <div className="text-base font-black text-gray-800 font-mono">
                                {currentQty} {unit}
                            </div>
                        </div>
                        <ArrowRight size={18} className="text-gray-400" />
                        <div>
                            <span className="text-[11px] font-bold text-teal-600 uppercase">New Stock</span>
                            <div className="text-base font-black text-teal-700 font-mono">
                                {newVal} {unit}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            New Quantity / Weight ({unit}) *
                        </label>
                        <input
                            type="number"
                            min="0"
                            step={isFilament ? "1" : "0.01"}
                            required
                            value={newVal}
                            onChange={(e) => setNewVal(Number(e.target.value) || 0)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold font-mono focus:bg-white focus:border-teal-500 outline-none"
                        />
                        <div className="text-xs mt-1 font-semibold">
                            Change:{" "}
                            <span className={diff > 0 ? "text-emerald-600" : diff < 0 ? "text-amber-600" : "text-gray-400"}>
                                {diff > 0 ? `+${diff}` : diff} {unit}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            Adjustment Reason / Note
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Weighed spool with tare, Spool broke, Restock batch"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-teal-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold px-5 py-2 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            <Check size={16} />
                            {saving ? "Saving..." : "Save Adjustment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
