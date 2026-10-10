import React, { useState } from "react";
import { Plus, Search, FileText, Printer, CheckCircle, Trash2, Edit2, ArrowRight } from "lucide-react";

export default function QuotationsTab({
    quotations = [],
    onOpenCreate,
    onOpenEdit,
    onDelete,
    onOpenPrintView,
    onConvertQuoteToJob,
}) {
    const [search, setSearch] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("All");

    const statuses = ["All", "Draft", "Sent", "Accepted", "Rejected"];

    const filtered = quotations.filter((q) => {
        const matchesSearch =
            (q.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
            (q.quote_number || "").toLowerCase().includes(search.toLowerCase()) ||
            (q.customer_email || "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus = selectedStatus === "All" || q.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Quotations & Invoicing</h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Build customer proposals, print official PDF invoices, and convert accepted quotes to print jobs
                    </p>
                </div>
                <button
                    onClick={onOpenCreate}
                    className="px-4 py-2 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                    <Plus size={16} /> New Quotation
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search quotations, customers, quote IDs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-teal-500 outline-none"
                    />
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

            {/* Quotations List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs">
                    <FileText size={36} className="mx-auto text-gray-300 mb-2" />
                    <h3 className="text-sm font-bold text-gray-800">No quotations found</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {quotations.length === 0
                            ? "Create customer proposals directly from your cost calculations."
                            : "No quotes match your filter criteria."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((quote) => {
                        const isAccepted = quote.status === "Accepted";

                        return (
                            <div
                                key={quote.id}
                                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="font-mono text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
                                            {quote.quote_number}
                                        </span>
                                        <h3 className="text-sm font-bold text-gray-900">{quote.customer_name}</h3>
                                        <span
                                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                isAccepted
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : quote.status === "Sent"
                                                    ? "bg-teal-100 text-teal-800"
                                                    : quote.status === "Rejected"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-700"
                                            }`}
                                        >
                                            {quote.status}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
                                        {quote.customer_email && <span>📧 {quote.customer_email}</span>}
                                        {quote.customer_phone && <span>📞 {quote.customer_phone}</span>}
                                        <span>📅 Valid Until: {quote.valid_until}</span>
                                    </div>

                                    <div className="text-xs text-gray-600">
                                        Line items: {(quote.items || []).map((i) => `${i.description} (${i.quantity}x)`).join(", ")}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                                    <div className="text-right font-mono">
                                        <div className="text-xs text-gray-400">Total Price</div>
                                        <div className="text-lg font-black text-gray-900">₱{(Number(quote.total_price) || 0).toFixed(2)}</div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onOpenPrintView(quote)}
                                            className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                                            title="View and print PDF quotation"
                                        >
                                            <Printer size={14} /> Print PDF
                                        </button>

                                        {isAccepted && (
                                            <button
                                                onClick={() => onConvertQuoteToJob?.(quote)}
                                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors flex items-center gap-1"
                                                title="Create production print job"
                                            >
                                                <ArrowRight size={14} /> Start Job
                                            </button>
                                        )}

                                        <button
                                            onClick={() => onOpenEdit(quote)}
                                            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                            title="Edit quote"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(quote.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Delete quote"
                                        >
                                            <Trash2 size={15} />
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
