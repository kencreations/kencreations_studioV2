import React, { useState } from "react";
import { Plus, Search, DollarSign, TrendingUp, CheckCircle, Clock, Trash2, Edit2 } from "lucide-react";

export default function SalesTab({
    sales = [],
    onOpenRecordSale,
    onOpenEdit,
    onDelete,
}) {
    const [search, setSearch] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("All");

    const filtered = sales.filter((s) => {
        const matchesSearch =
            (s.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
            (s.customer_name || "").toLowerCase().includes(search.toLowerCase());
        const matchesPayment = paymentFilter === "All" || s.payment_status === paymentFilter;
        return matchesSearch && matchesPayment;
    });

    // Summary Totals
    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0);
    const paidRevenue = sales
        .filter((s) => s.payment_status === "Paid")
        .reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0);
    const pendingRevenue = sales
        .filter((s) => s.payment_status === "Pending")
        .reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0);
    const totalCost = sales.reduce((sum, s) => sum + (Number(s.production_cost) || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const avgProfitPerSale = sales.length > 0 ? (totalProfit / sales.length).toFixed(2) : "0.00";
    const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Sales & Profit Tracking</h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Financial performance, recorded revenue, manufacturing costs, and real margins
                    </p>
                </div>
                <button
                    onClick={onOpenRecordSale}
                    className="px-4 py-2 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                    <Plus size={16} /> Record Sale
                </button>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Recorded Revenue</span>
                    <div className="text-2xl font-black font-mono text-gray-900 mt-1">
                        ₱{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-semibold text-emerald-600 mt-1">
                        ₱{paidRevenue.toFixed(2)} paid · ₱{pendingRevenue.toFixed(2)} pending
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Production Costs</span>
                    <div className="text-2xl font-black font-mono text-gray-900 mt-1">
                        ₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Materials, electricity & wear</div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Gross Profit</span>
                    <div className="text-2xl font-black font-mono text-teal-700 mt-1">
                        ₱{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-bold text-teal-600 mt-1">{overallMargin}% gross margin</div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Average Profit / Sale</span>
                    <div className="text-2xl font-black font-mono text-gray-900 mt-1">
                        ₱{avgProfitPerSale}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{sales.length} completed sales</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search sales by product or customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-teal-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Payment:</span>
                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:border-teal-500"
                    >
                        <option value="All">All</option>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                        <option value="Refunded">Refunded</option>
                    </select>
                </div>
            </div>

            {/* Sales Table */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs">
                    <DollarSign size={36} className="mx-auto text-gray-300 mb-2" />
                    <h3 className="text-sm font-bold text-gray-800">No sales recorded yet</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Record customer transactions to track your 3D printing shop's revenues and margins.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Product</th>
                                    <th className="py-3 px-4">Customer</th>
                                    <th className="py-3 px-4 text-center">Qty</th>
                                    <th className="py-3 px-4 text-right">Selling Price</th>
                                    <th className="py-3 px-4 text-right">Cost</th>
                                    <th className="py-3 px-4 text-right">Profit</th>
                                    <th className="py-3 px-4 text-center">Payment</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-3.5 px-4 font-mono text-gray-500">{sale.sale_date}</td>
                                        <td className="py-3.5 px-4 font-bold text-gray-900">{sale.product_name}</td>
                                        <td className="py-3.5 px-4 text-gray-600">{sale.customer_name || "—"}</td>
                                        <td className="py-3.5 px-4 text-center font-mono font-semibold">{sale.quantity_sold}</td>
                                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                                            ₱{(Number(sale.selling_price) || 0).toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-gray-500">
                                            ₱{(Number(sale.production_cost) || 0).toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-black text-teal-700">
                                            +₱{(Number(sale.gross_profit) || 0).toFixed(2)} ({sale.margin_percent}%)
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span
                                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    sale.payment_status === "Paid"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : sale.payment_status === "Pending"
                                                        ? "bg-amber-100 text-amber-800"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {sale.payment_status}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => onOpenEdit(sale)}
                                                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(sale.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
