import React, { useState } from "react";
import { Plus, Search, Filter, Upload, Scale, Trash2, Edit2, ExternalLink, Package, AlertCircle } from "lucide-react";

export default function ConsumablesTab({
    consumables = [],
    onOpenAdd,
    onOpenEdit,
    onDelete,
    onOpenAdjust,
    onOpenCsv,
}) {
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    const categories = ["All", ...new Set(consumables.map((c) => c.category).filter(Boolean))];

    const filtered = consumables.filter((c) => {
        const matchesSearch =
            (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (c.supplier || "").toLowerCase().includes(search.toLowerCase()) ||
            (c.category || "").toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "All" || c.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Consumables & Supplies</h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Keyrings, magnets, boxes, packaging, and hardware linked to printing costs
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
                        <Plus size={16} /> Add Consumable
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search items, categories, suppliers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-teal-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Category:</span>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:border-teal-500"
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Consumables Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs">
                    <div className="text-4xl mb-3">📦</div>
                    <h3 className="text-sm font-bold text-gray-800">No consumable supplies found</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {consumables.length === 0
                            ? "Track keyrings, magnets, or shipping supplies to automatically include their cost in calculations."
                            : "No items match your filter criteria."}
                    </p>
                    {consumables.length === 0 && (
                        <button
                            onClick={onOpenAdd}
                            className="mt-4 px-4 py-2 bg-[#14b8a6] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold transition-all"
                        >
                            Add First Consumable
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((item) => {
                        const unitCost =
                            item.pack_quantity > 0
                                ? (item.pack_price / item.pack_quantity)
                                : 0;
                        const isLow = (item.quantity ?? 0) <= (item.reorder_threshold || 10);

                        return (
                            <div
                                key={item.id}
                                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">
                                                {item.category}
                                            </span>
                                            <h3 className="text-sm font-bold text-gray-900 mt-1 leading-snug">
                                                {item.name}
                                            </h3>
                                        </div>

                                        <span
                                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                item.quantity <= 0
                                                    ? "bg-red-100 text-red-700"
                                                    : isLow
                                                    ? "bg-amber-100 text-amber-700"
                                                    : "bg-emerald-100 text-emerald-700"
                                            }`}
                                        >
                                            {item.status}
                                        </span>
                                    </div>

                                    {/* Stock on Hand display */}
                                    <div className="my-3 p-3 rounded-2xl bg-gray-50 border border-gray-100/70 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase text-gray-400">Available Stock</span>
                                            <div className="text-base font-black font-mono text-gray-800">
                                                {item.quantity} <span className="text-xs text-gray-500 font-medium">{item.unit_of_measure}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-gray-400">Derived Unit Cost</span>
                                            <div className="text-sm font-black font-mono text-teal-700">
                                                ₱{unitCost.toFixed(2)} <span className="text-[11px] text-gray-500 font-normal">/ {item.unit_of_measure}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-400 font-mono mb-2 flex justify-between">
                                        <span>Pack: ₱{Number(item.pack_price).toFixed(2)} / {item.pack_quantity} {item.unit_of_measure}</span>
                                        {item.supplier && <span className="truncate max-w-[120px]">{item.supplier}</span>}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs font-bold">
                                    <button
                                        onClick={() => onOpenAdjust(item)}
                                        className="text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                        title="Quickly adjust stock"
                                    >
                                        <Scale size={14} /> Adjust Stock
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {item.product_url && (
                                            <a
                                                href={item.product_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                                                title="Reorder link"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => onOpenEdit(item)}
                                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                                            title="Edit item"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(item.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                                            title="Delete item"
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
