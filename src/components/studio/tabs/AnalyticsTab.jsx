import React from "react";
import { BarChart2, PieChart, TrendingUp, Layers, DollarSign, Activity } from "lucide-react";

export default function AnalyticsTab({
    filaments = [],
    consumables = [],
    printJobs = [],
    sales = [],
}) {
    // 1. Material breakdown from print jobs
    const materialUsageMap = {};
    const filamentUsageMap = {};

    printJobs.forEach((job) => {
        (job.filaments_used || []).forEach((f) => {
            const grams = Number(f.grams) || 0;
            // Lookup spool material
            const matchedFil = filaments.find((item) => item.id === f.filament_id);
            const mat = matchedFil?.material || "PLA";
            materialUsageMap[mat] = (materialUsageMap[mat] || 0) + grams;

            const name = f.name || "Unknown Filament";
            if (!filamentUsageMap[name]) {
                filamentUsageMap[name] = { grams: 0, colorHex: f.color_hex || "#14b8a6" };
            }
            filamentUsageMap[name].grams += grams;
        });
    });

    const totalGramsUsed = Object.values(materialUsageMap).reduce((a, b) => a + b, 0);

    // Top filaments sorted by usage
    const topFilaments = Object.entries(filamentUsageMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.grams - a.grams)
        .slice(0, 5);

    // 2. Monthly Revenue and Profit Aggregation
    const monthlyDataMap = {};
    sales.forEach((s) => {
        const month = (s.sale_date || "").slice(0, 7) || "Recent";
        if (!monthlyDataMap[month]) {
            monthlyDataMap[month] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        }
        const rev = Number(s.selling_price) || 0;
        const cost = Number(s.production_cost) || 0;
        monthlyDataMap[month].revenue += rev;
        monthlyDataMap[month].cost += cost;
        monthlyDataMap[month].profit += (rev - cost);
        monthlyDataMap[month].count += 1;
    });

    const monthlyTrends = Object.entries(monthlyDataMap)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const hasData = printJobs.length > 0 || sales.length > 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Studio Business Analytics</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Insights and metrics generated in real time from your actual print jobs and sales records
                </p>
            </div>

            {!hasData ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-xs">
                    <BarChart2 size={40} className="mx-auto text-gray-300 mb-2" />
                    <h3 className="text-sm font-bold text-gray-800">No analytics data yet</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Complete print jobs and record sales to generate material consumption charts and financial performance trends.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Material Consumption Chart */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Layers size={16} className="text-teal-600" /> Material Consumption by Type
                            </h3>
                            <span className="text-xs font-mono font-bold text-gray-500">
                                Total: {totalGramsUsed.toFixed(0)}g
                            </span>
                        </div>

                        {Object.keys(materialUsageMap).length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-6 text-center">No print jobs with material consumption logged yet.</p>
                        ) : (
                            <div className="space-y-3 pt-2">
                                {Object.entries(materialUsageMap).map(([mat, grams]) => {
                                    const percent = totalGramsUsed > 0 ? Math.round((grams / totalGramsUsed) * 100) : 0;
                                    return (
                                        <div key={mat} className="space-y-1">
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span className="text-gray-800">{mat}</span>
                                                <span className="font-mono text-gray-500">
                                                    {grams.toFixed(0)}g ({percent}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-[#14b8a6]"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Top Used Filaments */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Activity size={16} className="text-teal-600" /> Most Frequently Used Spools
                        </h3>

                        {topFilaments.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-6 text-center">No filament usage history found.</p>
                        ) : (
                            <div className="space-y-3 pt-2">
                                {topFilaments.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded-full border border-black/10"
                                                style={{ backgroundColor: f.colorHex }}
                                            />
                                            <span className="text-xs font-bold text-gray-800 truncate max-w-[200px]">
                                                {f.name}
                                            </span>
                                        </div>
                                        <span className="text-xs font-mono font-black text-gray-900">
                                            {f.grams.toFixed(0)}g
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Monthly Financial Performance */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <TrendingUp size={16} className="text-teal-600" /> Monthly Revenue & Gross Profit Trends
                            </h3>
                            <span className="text-xs text-gray-400">Strictly derived from saved sales records</span>
                        </div>

                        {monthlyTrends.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-6 text-center">No sales recorded yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-4">Period</th>
                                            <th className="py-2.5 px-4 text-center">Orders</th>
                                            <th className="py-2.5 px-4 text-right">Revenue</th>
                                            <th className="py-2.5 px-4 text-right">Prod. Cost</th>
                                            <th className="py-2.5 px-4 text-right">Gross Profit</th>
                                            <th className="py-2.5 px-4 text-right">Margin %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-mono">
                                        {monthlyTrends.map((t) => {
                                            const margin = t.revenue > 0 ? ((t.profit / t.revenue) * 100).toFixed(1) : 0;
                                            return (
                                                <tr key={t.month} className="hover:bg-gray-50/50">
                                                    <td className="py-3 px-4 font-bold text-gray-900 font-sans">{t.month}</td>
                                                    <td className="py-3 px-4 text-center">{t.count}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-gray-900">₱{t.revenue.toFixed(2)}</td>
                                                    <td className="py-3 px-4 text-right text-gray-500">₱{t.cost.toFixed(2)}</td>
                                                    <td className="py-3 px-4 text-right font-black text-teal-700">+₱{t.profit.toFixed(2)}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{margin}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
