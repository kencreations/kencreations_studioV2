import React, { useState } from "react";
import { Plus, Search, Filter, Download, Upload, SlidersHorizontal, Trash2, Edit2, Scale, ExternalLink } from "lucide-react";

export default function FilamentsTab({
    filaments = [],
    onOpenAdd,
    onOpenEdit,
    onDelete,
    onOpenAdjust,
    onOpenCsv,
}) {
    const [search, setSearch] = useState("");
    const [selectedMaterial, setSelectedMaterial] = useState("All");
    const [selectedStatus, setSelectedStatus] = useState("All");

    const materials = ["All", ...new Set(filaments.map((f) => f.material).filter(Boolean))];
    const statuses = ["All", "New", "In Use", "Low", "Empty"];

    const filtered = filaments.filter((f) => {
        const matchesSearch =
            (f.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (f.brand || "").toLowerCase().includes(search.toLowerCase()) ||
            (f.color_name || "").toLowerCase().includes(search.toLowerCase()) ||
            (f.spool_id || "").toLowerCase().includes(search.toLowerCase());
        const matchesMaterial = selectedMaterial === "All" || f.material === selectedMaterial;
        const matchesStatus = selectedStatus === "All" || f.status === selectedStatus;
        return matchesSearch && matchesMaterial && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Filament Spools Inventory</h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Track material weights, remaining stock, and exact cost per gram
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onOpenCsv}
                        className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                        <Upload size={14} /> CSV Tools
                    </button>
                    <button
                        onClick={onOpenAdd}
                        className="px-4 py-2 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                    >
                        <Plus size={16} /> Add Spool
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by spool name, brand, color, ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-teal-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Material:</span>
                    <select
                        value={selectedMaterial}
                        onChange={(e) => setSelectedMaterial(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:border-teal-500"
                    >
                        {materials.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Status:</span>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:border-teal-500"
                    >
                        {statuses.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Filament Cards Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs">
                    <div className="text-4xl mb-3">🧵</div>
                    <h3 className="text-sm font-bold text-gray-800">No filaments found</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {filaments.length === 0
                            ? "Get started by adding your first filament spool to begin tracking materials."
                            : "No filaments match your current search and filter criteria."}
                    </p>
                    {filaments.length === 0 && (
                        <button
                            onClick={onOpenAdd}
                            className="mt-4 px-4 py-2 bg-[#14b8a6] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold transition-all"
                        >
                            Add Your First Spool
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((f) => {
                        const spoolWeight = f.spool_weight_g || 1000;
                        const remaining = f.remaining_weight_g !== undefined ? f.remaining_weight_g : spoolWeight;
                        const percent = Math.min(100, Math.max(0, Math.round((remaining / spoolWeight) * 100)));
                        const costPerGram = spoolWeight > 0 ? (f.purchase_price / spoolWeight) : 0;
                        const isLow = remaining <= (f.min_threshold_g || 100);

                        return (
                            <div
                                key={f.id}
                                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div>
                                    {/* Top Row: Swatch & Badges */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-9 h-9 rounded-xl shadow-xs border border-black/10 flex-shrink-0"
                                                style={{ backgroundColor: f.color_hex || "#14b8a6" }}
                                            />
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 leading-snug truncate max-w-[180px]">
                                                    {f.name}
                                                </h3>
                                                <p className="text-xs text-gray-400 font-medium">
                                                    {f.brand} · <span className="font-semibold text-gray-700">{f.material}</span>
                                                    {f.color_name && ` · ${f.color_name}`}
                                                </p>
                                            </div>
                                        </div>

                                        <span
                                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                f.status === "Empty"
                                                    ? "bg-red-100 text-red-700"
                                                    : isLow || f.status === "Low"
                                                    ? "bg-amber-100 text-amber-700"
                                                    : f.status === "In Use"
                                                    ? "bg-teal-100 text-teal-700"
                                                    : "bg-emerald-100 text-emerald-700"
                                            }`}
                                        >
                                            {f.status}
                                        </span>
                                    </div>

                                    {/* Remaining Progress Bar */}
                                    <div className="my-3 space-y-1.5">
                                        <div className="flex justify-between items-baseline text-xs font-mono">
                                            <span className="font-bold text-gray-800">
                                                {remaining}g <span className="text-gray-400 font-normal">/ {spoolWeight}g</span>
                                            </span>
                                            <span className={`font-black ${isLow ? "text-amber-600" : "text-teal-600"}`}>
                                                {percent}% left
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    percent <= 15
                                                        ? "bg-red-500"
                                                        : percent <= 30
                                                        ? "bg-amber-500"
                                                        : "bg-teal-500"
                                                }`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Cost Stats */}
                                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-gray-50 text-xs font-mono mb-3">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Purchase</span>
                                            <span className="font-bold text-gray-800">₱{Number(f.purchase_price).toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Unit Cost</span>
                                            <span className="font-bold text-teal-700">₱{costPerGram.toFixed(3)}/g</span>
                                        </div>
                                    </div>

                                    {f.spool_id && (
                                        <div className="text-[11px] text-gray-400 font-mono mb-2">
                                            ID: <span className="font-semibold text-gray-600">{f.spool_id}</span>
                                            {f.supplier && ` · ${f.supplier}`}
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs font-bold">
                                    <button
                                        onClick={() => onOpenAdjust(f)}
                                        className="text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                        title="Quickly adjust spool weight"
                                    >
                                        <Scale size={14} /> Adjust Weight
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {f.product_url && (
                                            <a
                                                href={f.product_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                                                title="Reorder link"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => onOpenEdit(f)}
                                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                                            title="Edit spool"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(f.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                                            title="Delete spool"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
