import React from "react";

const STATUS_COLORS = {
    "In Stock":     "bg-emerald-100 text-emerald-700",
    "Low":          "bg-amber-100 text-amber-700",
    "Out of Stock": "bg-red-100 text-red-700",
};

const CATEGORY_ICONS = {
    "Packaging": "📦",
    "Labels":    "🏷️",
    "Hardware":  "🔩",
    "Finishing": "✨",
    "Tools":     "🔧",
    "General":   "🗂️",
};

// Default currency symbol — change this one variable to localise the whole app
const CURRENCY = "₱";

export default function ConsumableCard({ consumable, onEdit, onDelete }) {
    const { name, category, pack_quantity, pack_price, unit_of_measure, status, product_url } = consumable;
    const statusCls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
    const icon = CATEGORY_ICONS[category] ?? "🗂️";
    const unitCost = pack_quantity > 0 ? pack_price / pack_quantity : 0;

    const handleOpenUrl = () => {
        if (!product_url) return;
        if (window.electronAPI?.openExternalUrl) {
            window.electronAPI.openExternalUrl(product_url);
        } else {
            window.open(product_url, "_blank", "noreferrer");
        }
    };

    return (
        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 group transition-all hover:shadow-md">
            <div className="flex items-center gap-4 truncate flex-1 min-w-0">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                    {icon}
                </div>

                {/* Details */}
                <div className="truncate flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 truncate">{name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>{status}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                        {category} · {pack_quantity} {unit_of_measure} / pack
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {CURRENCY}{pack_price.toFixed(2)} pack &nbsp;·&nbsp; {CURRENCY}{unitCost.toFixed(3)}/{unit_of_measure}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3 opacity-0 group-hover:opacity-100 transition-all">
                {product_url && (
                    <button
                        title="Open product page"
                        onClick={handleOpenUrl}
                        className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-teal-50 hover:text-secondary flex items-center justify-center text-gray-400 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </button>
                )}
                <button
                    title="Edit consumable"
                    onClick={() => onEdit(consumable)}
                    className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-primary/10 hover:text-primary flex items-center justify-center text-gray-400 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>
                <button
                    title="Delete consumable"
                    onClick={() => onDelete(consumable.id)}
                    className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
