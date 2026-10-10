import React from "react";
import {
    Activity,
    Layers,
    AlertTriangle,
    DollarSign,
    TrendingUp,
    Printer,
    Plus,
    Calculator,
    ArrowUpRight,
    ArrowDownRight,
    Package,
    Clock,
} from "lucide-react";

export default function OverviewTab({
    filaments = [],
    consumables = [],
    printJobs = [],
    sales = [],
    movements = [],
    onNavigateTab,
    onOpenAddFilament,
    onOpenAddConsumable,
    onOpenCreateJob,
}) {
    // 1. Calculations from real user data
    const activeJobs = printJobs.filter((j) => j.status === "Printing" || j.status === "Queued");
    const completedJobs = printJobs.filter((j) => j.status === "Completed");

    const totalFilamentStockG = filaments.reduce(
        (sum, f) => sum + (f.remaining_weight_g ?? f.spool_weight_g ?? 0),
        0
    );

    const lowFilaments = filaments.filter(
        (f) => (f.remaining_weight_g ?? f.spool_weight_g ?? 0) <= (f.min_threshold_g ?? 100)
    );
    const lowConsumables = consumables.filter(
        (c) => (c.quantity ?? 0) <= (c.reorder_threshold ?? 10)
    );
    const totalLowStock = lowFilaments.length + lowConsumables.length;

    // Current month sales
    const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const thisMonthSales = sales.filter((s) => (s.sale_date || "").startsWith(currentMonthKey));

    const monthlyRevenue = thisMonthSales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0);
    const monthlyCost = thisMonthSales.reduce((sum, s) => sum + (Number(s.production_cost) || 0), 0);
    const monthlyGrossProfit = monthlyRevenue - monthlyCost;
    const monthlyMargin = monthlyRevenue > 0 ? ((monthlyGrossProfit / monthlyRevenue) * 100).toFixed(1) : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Active Jobs */}
                <div
                    onClick={() => onNavigateTab("jobs")}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Active Print Jobs
                        </span>
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Printer size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 tracking-tight font-mono">
                        {activeJobs.length}
                    </div>
                    <p className="text-xs text-gray-400 font-medium mt-1">
                        {completedJobs.length} completed all-time
                    </p>
                </div>

                {/* Filament In Stock */}
                <div
                    onClick={() => onNavigateTab("filaments")}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Filament Stock
                        </span>
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Layers size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 tracking-tight font-mono">
                        {(totalFilamentStockG / 1000).toFixed(2)} <span className="text-lg text-gray-500">kg</span>
                    </div>
                    <p className="text-xs text-gray-400 font-medium mt-1">
                        Across {filaments.length} spools
                    </p>
                </div>

                {/* Low Stock Alerts */}
                <div
                    onClick={() => onNavigateTab(lowFilaments.length > 0 ? "filaments" : "consumables")}
                    className={`bg-white rounded-3xl p-6 border shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer group ${
                        totalLowStock > 0 ? "border-amber-200" : "border-gray-100"
                    }`}
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Low Stock Items
                        </span>
                        <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                                totalLowStock > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"
                            }`}
                        >
                            <AlertTriangle size={20} />
                        </div>
                    </div>
                    <div
                        className={`text-3xl font-black tracking-tight font-mono ${
                            totalLowStock > 0 ? "text-amber-600" : "text-gray-900"
                        }`}
                    >
                        {totalLowStock}
                    </div>
                    <p className="text-xs text-gray-400 font-medium mt-1">
                        {lowFilaments.length} spools · {lowConsumables.length} supplies
                    </p>
                </div>

                {/* Monthly Revenue */}
                <div
                    onClick={() => onNavigateTab("sales")}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Monthly Revenue
                        </span>
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 tracking-tight font-mono">
                        ₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-emerald-600 font-semibold mt-1">
                        ₱{monthlyGrossProfit.toFixed(2)} profit ({monthlyMargin}%)
                    </p>
                </div>
            </div>

            {/* Quick Actions & Low Stock Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Quick Actions & Production Status */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Action Bar */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Studio Actions</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => onNavigateTab("calculator")}
                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-teal-50/70 hover:bg-teal-100/70 text-teal-900 font-bold text-xs transition-colors border border-teal-100"
                            >
                                <div className="w-8 h-8 rounded-xl bg-teal-500 text-white flex items-center justify-center shadow-xs">
                                    <Calculator size={16} />
                                </div>
                                <span>Calculate Cost</span>
                            </button>

                            <button
                                onClick={onOpenCreateJob}
                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs transition-colors border border-gray-100"
                            >
                                <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-xs">
                                    <Printer size={16} />
                                </div>
                                <span>Queue Print Job</span>
                            </button>

                            <button
                                onClick={onOpenAddFilament}
                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs transition-colors border border-gray-100"
                            >
                                <div className="w-8 h-8 rounded-xl bg-[#14b8a6] text-white flex items-center justify-center shadow-xs">
                                    <Plus size={16} />
                                </div>
                                <span>Add Spool</span>
                            </button>
                        </div>
                    </div>

                    {/* Active Print Queue Mini-Table */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Current Print Queue</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Jobs currently printing or scheduled</p>
                            </div>
                            <button
                                onClick={() => onNavigateTab("jobs")}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                            >
                                View all <ArrowUpRight size={14} />
                            </button>
                        </div>

                        {activeJobs.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                <Printer size={28} className="mx-auto text-gray-300 mb-2" />
                                <p className="text-xs font-bold text-gray-600">No active print jobs</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Click "Queue Print Job" to schedule your next 3D print.</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {activeJobs.slice(0, 4).map((job) => (
                                    <div
                                        key={job.id}
                                        className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100/70 border border-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                                            <div>
                                                <div className="text-xs font-bold text-gray-900">{job.product_name}</div>
                                                <div className="text-[11px] text-gray-500 font-mono">
                                                    {job.job_number} · {job.assigned_printer}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-bold font-mono text-gray-600">
                                                {job.actual_duration_hrs} hrs
                                            </span>
                                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
                                                {job.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col: Low Stock Alerts & Recent Movements */}
                <div className="space-y-6">
                    {/* Low Stock Warning Card */}
                    {totalLowStock > 0 && (
                        <div className="bg-amber-50/80 rounded-3xl p-6 border border-amber-200">
                            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase mb-3">
                                <AlertTriangle size={16} /> Reorder Attention Needed
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {lowFilaments.map((f) => (
                                    <div key={f.id} className="flex justify-between items-center text-xs p-2 bg-white/80 rounded-xl">
                                        <span className="font-semibold text-gray-800 truncate max-w-[140px]">{f.name}</span>
                                        <span className="font-mono text-amber-700 font-bold">
                                            {f.remaining_weight_g ?? f.spool_weight_g}g left
                                        </span>
                                    </div>
                                ))}
                                {lowConsumables.map((c) => (
                                    <div key={c.id} className="flex justify-between items-center text-xs p-2 bg-white/80 rounded-xl">
                                        <span className="font-semibold text-gray-800 truncate max-w-[140px]">{c.name}</span>
                                        <span className="font-mono text-amber-700 font-bold">
                                            {c.quantity} {c.unit_of_measure}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Inventory Movements */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-900">Inventory Activity</h3>
                            <Clock size={16} className="text-gray-400" />
                        </div>

                        {movements.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-4 text-center">No inventory transactions logged yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {movements.slice(0, 5).map((m) => (
                                    <div key={m.id} className="flex items-start justify-between text-xs pb-2 border-b border-gray-50 last:border-0 last:pb-0">
                                        <div>
                                            <div className="font-bold text-gray-800">{m.item_name}</div>
                                            <div className="text-[11px] text-gray-400">{m.reason}</div>
                                        </div>
                                        <div
                                            className={`font-mono font-bold text-right ${
                                                m.quantity_change > 0 ? "text-emerald-600" : "text-amber-600"
                                            }`}
                                        >
                                            {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change} {m.unit}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
