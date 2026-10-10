import React, { useState } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";
import { addPrinterProfile, deletePrinterProfile, updatePrinterProfile } from "../../services/studioService";

export default function PrinterProfileModal({ isOpen, onClose, userId, profiles = [], onRefresh }) {
    const [name, setName] = useState("");
    const [wattage, setWattage] = useState(350);
    const [electricityRate, setElectricityRate] = useState(11.5);
    const [wearRate, setWearRate] = useState(5.0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Profile name is required.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await addPrinterProfile(userId, {
                name: name.trim(),
                wattage: Number(wattage) || 350,
                electricity_rate: Number(electricityRate) || 11.5,
                wear_rate: Number(wearRate) || 5.0,
                is_default: profiles.length === 0,
            });
            setName("");
            setWattage(350);
            setElectricityRate(11.5);
            setWearRate(5.0);
            await onRefresh();
        } catch (err) {
            setError(err.message || "Failed to save profile.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this printer profile?")) return;
        try {
            await deletePrinterProfile(userId, id);
            await onRefresh();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSetDefault = async (profile) => {
        try {
            for (const p of profiles) {
                if (p.id === profile.id) {
                    await updatePrinterProfile(userId, p.id, { is_default: true });
                } else if (p.is_default) {
                    await updatePrinterProfile(userId, p.id, { is_default: false });
                }
            }
            await onRefresh();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-xl w-full mx-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Printer Profiles</h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">Configure hardware specs and operating costs</p>
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

                {/* Existing Profiles List */}
                <div className="mt-6 space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saved Printers ({profiles.length})</h3>
                    {profiles.length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-2">No printer profiles saved yet. Add your first printer below.</p>
                    ) : (
                        profiles.map((p) => (
                            <div
                                key={p.id}
                                className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-teal-200 transition-colors"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-gray-900">{p.name}</span>
                                        {p.is_default && (
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 flex gap-3 font-mono">
                                        <span>⚡ {p.wattage}W</span>
                                        <span>₱{p.electricity_rate}/kWh</span>
                                        <span>₱{p.wear_rate}/hr wear</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {!p.is_default && (
                                        <button
                                            type="button"
                                            onClick={() => handleSetDefault(p)}
                                            className="px-2.5 py-1 text-xs font-bold rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
                                            title="Set as default"
                                        >
                                            Set Default
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(p.id)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Delete printer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Add New Profile Form */}
                <form onSubmit={handleAdd} className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add New Printer Profile</h3>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Printer Model / Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Bambu Lab X1-Carbon, Creality Ender 3 V3"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Power (Watts)</label>
                            <input
                                type="number"
                                min="10"
                                step="10"
                                value={wattage}
                                onChange={(e) => setWattage(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-right focus:bg-white focus:border-teal-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">₱ / kWh</label>
                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={electricityRate}
                                onChange={(e) => setElectricityRate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-right focus:bg-white focus:border-teal-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Wear ₱ / hr</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={wearRate}
                                onChange={(e) => setWearRate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-right focus:bg-white focus:border-teal-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            {saving ? "Adding Printer..." : "Add Printer Profile"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
