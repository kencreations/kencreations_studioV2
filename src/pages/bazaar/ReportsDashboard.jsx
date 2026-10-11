import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getSellerEvents,
} from "../../services/bazaarService";
import {
    getEventAnalytics,
    addEventExpense,
    deleteEventExpense,
} from "../../services/paymentService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import {
    BarChart3,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Calendar,
    Receipt,
    Plus,
    Trash2,
    Download,
    Printer,
    CheckCircle2,
    Clock,
    AlertCircle,
    ShoppingBag,
    Tag,
    Layers,
    Banknote,
    CreditCard,
    ArrowUpRight,
} from "lucide-react";

export default function ReportsDashboard() {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();

    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(searchParams.get("event") || "");
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    // Expense Form Modal State
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseCategory, setExpenseCategory] = useState("Booth Rental");
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseDescription, setExpenseDescription] = useState("");
    const [savingExpense, setSavingExpense] = useState(false);
    const [message, setMessage] = useState("");

    // Initial load of events
    useEffect(() => {
        if (!currentUser?.uid) return;
        let isMounted = true;

        async function fetchEvents() {
            try {
                const evList = await getSellerEvents(currentUser.uid).catch(() => []);
                if (!isMounted) return;
                setEvents(evList);

                // Auto-select active event if none selected
                if (!selectedEventId && evList.length > 0) {
                    const active = evList.find((e) => e.status === "Active") || evList[0];
                    setSelectedEventId(active.eventId || active.id);
                }
            } catch (err) {
                console.error("[ReportsDashboard] Error loading events:", err);
            }
        }

        fetchEvents();
        return () => { isMounted = false; };
    }, [currentUser, selectedEventId]);

    // Fetch analytics for selected event
    const loadAnalytics = useCallback(async () => {
        if (!currentUser?.uid || !selectedEventId) return;
        setLoading(true);
        try {
            const data = await getEventAnalytics(currentUser.uid, selectedEventId);
            setAnalytics(data);
        } catch (err) {
            console.error("[ReportsDashboard] Analytics error:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUser, selectedEventId]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const activeEventObj = useMemo(() => {
        return events.find((e) => (e.eventId || e.id) === selectedEventId) || null;
    }, [events, selectedEventId]);

    // Handle adding an event operational expense
    const handleAddExpense = async (e) => {
        e.preventDefault();
        const amt = Number(expenseAmount);
        if (!amt || amt <= 0) return;

        setSavingExpense(true);
        try {
            await addEventExpense(currentUser.uid, selectedEventId, {
                category: expenseCategory,
                amount: amt,
                description: expenseDescription,
            });
            setExpenseAmount("");
            setExpenseDescription("");
            setIsExpenseModalOpen(false);
            setMessage("Expense recorded successfully.");
            setTimeout(() => setMessage(""), 3000);
            await loadAnalytics();
        } catch (err) {
            console.error("Expense error:", err);
            alert("Failed to record expense.");
        } finally {
            setSavingExpense(false);
        }
    };

    // Handle deleting an expense
    const handleDeleteExpense = async (expId) => {
        if (!window.confirm("Remove this recorded expense?")) return;
        try {
            await deleteEventExpense(currentUser.uid, selectedEventId, expId);
            await loadAnalytics();
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    // CSV Order Export
    const handleExportCSV = () => {
        if (!analytics?.orders || analytics.orders.length === 0) {
            alert("No orders to export for this event.");
            return;
        }

        const headers = ["Order Number", "Customer", "Date", "Status", "Payment Method", "Payment Status", "Items Summary", "Total Amount"];
        const rows = analytics.orders.map((o) => {
            const itemsStr = (o.items || []).map((i) => `${i.quantity}x ${i.productName}`).join("; ");
            const dateStr = o.submittedAt?.toDate ? o.submittedAt.toDate().toLocaleString() : "";
            return [
                `"${o.orderNumber || ""}"`,
                `"${o.customerName || ""}"`,
                `"${dateStr}"`,
                `"${o.fulfillmentStatus || ""}"`,
                `"${o.paymentMethod || ""}"`,
                `"${o.paymentStatus || ""}"`,
                `"${itemsStr}"`,
                Number(o.totalAmount || 0).toFixed(2),
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `bazaar_orders_${activeEventObj?.slug || "event"}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <BazaarLayout activeTab="reports">
            <div className="space-y-6 animate-in fade-in duration-150">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                            <BarChart3 className="text-teal-600" size={26} />
                            Event Reports & Financial Analytics
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Accounting summaries, cash vs. GCash collections, operational expenses, and net profit margins.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        {events.length > 0 && (
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="px-3.5 py-2 rounded-2xl bg-white border border-gray-200 text-xs font-black text-gray-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                            >
                                {events.map((ev) => (
                                    <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                                        {ev.name} ({ev.status})
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            onClick={handleExportCSV}
                            className="px-3.5 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Export order list to CSV"
                        >
                            <Download size={14} />
                            <span className="hidden sm:inline">Export CSV</span>
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="px-3.5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Print report"
                        >
                            <Printer size={14} />
                            <span className="hidden sm:inline">Print</span>
                        </button>
                    </div>
                </div>

                {message && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                        <span>{message}</span>
                    </div>
                )}

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
                        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-gray-500">Calculating Event Ledger...</span>
                    </div>
                ) : !activeEventObj ? (
                    <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200 space-y-2">
                        <Calendar size={28} className="text-gray-400 mx-auto" />
                        <h3 className="text-sm font-bold text-gray-800">No events found</h3>
                        <p className="text-xs text-gray-400">
                            Create an event under Events & Bazaars to begin tracking booth sales and revenue.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Event Hero Card */}
                        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-teal-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                                    {activeEventObj.status} Bazaar Event
                                </span>
                                <h3 className="text-2xl font-black tracking-tight mt-1">
                                    {activeEventObj.name}
                                </h3>
                                <p className="text-xs text-teal-100/80 mt-0.5">
                                    {activeEventObj.venue} {activeEventObj.boothNumber && `• Booth #${activeEventObj.boothNumber}`}
                                </p>
                            </div>

                            <div className="text-left sm:text-right">
                                <span className="text-[10px] text-teal-200 font-bold uppercase tracking-wider block">
                                    Estimated Event Net Profit
                                </span>
                                <span className="text-3xl font-black text-emerald-400">
                                    ₱{Number(analytics?.estimatedProfit || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Top Financial KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                                    Gross Order Value
                                </span>
                                <div className="text-2xl font-black text-gray-900">
                                    ₱{Number(analytics?.grossOrderValue || 0).toFixed(0)}
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium block">
                                    {analytics?.totalOrders || 0} total submitted orders
                                </span>
                            </div>

                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                                    Collected Cash
                                </span>
                                <div className="text-2xl font-black text-emerald-700">
                                    ₱{Number(analytics?.collectedCash || 0).toFixed(0)}
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium block">
                                    In counter cash float
                                </span>
                            </div>

                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                                    GCash Collections
                                </span>
                                <div className="text-2xl font-black text-blue-700">
                                    ₱{Number(analytics?.collectedGcash || 0).toFixed(0)}
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium block">
                                    Manually verified receipts
                                </span>
                            </div>

                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                                    Uncollected Balance
                                </span>
                                <div className="text-2xl font-black text-amber-700">
                                    ₱{Number(analytics?.outstandingBalance || 0).toFixed(0)}
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium block">
                                    Pending counter collection
                                </span>
                            </div>
                        </div>

                        {/* Financial Ledger Summary Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Card 1: Revenue & Cash Flow Statement */}
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs space-y-4">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Receipt size={16} className="text-teal-600" />
                                    Cash Flow & Revenue Statement
                                </h3>

                                <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Total Cash Collected:</span>
                                        <span className="font-bold font-mono text-gray-900">₱{Number(analytics?.collectedCash || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Total GCash Collected:</span>
                                        <span className="font-bold font-mono text-gray-900">₱{Number(analytics?.collectedGcash || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Total Customer Refunds:</span>
                                        <span className="font-bold font-mono text-red-600">-₱{Number(analytics?.totalRefunds || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100 flex justify-between font-black text-gray-900">
                                        <span>Net Cash Collections:</span>
                                        <span className="font-mono text-teal-800">₱{Number(analytics?.netCashCollections || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100 flex justify-between text-gray-500">
                                        <span>Material & Consumable COGS:</span>
                                        <span className="font-mono text-purple-700">₱{Number(analytics?.cogs || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500">
                                        <span>Event Operational Expenses:</span>
                                        <span className="font-mono text-red-600">-₱{Number(analytics?.totalExpenses || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-3 border-t-2 border-gray-100 flex justify-between text-sm font-black text-gray-900">
                                        <span>Net Accounting Profit:</span>
                                        <span className="font-mono text-emerald-600">₱{Number(analytics?.estimatedProfit || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Event Operational Expenses Tracker */}
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <DollarSign size={16} className="text-red-500" />
                                        Operational Expenses ({analytics?.expenses?.length || 0})
                                    </h3>
                                    <button
                                        onClick={() => setIsExpenseModalOpen(true)}
                                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={13} /> Add Expense
                                    </button>
                                </div>

                                {analytics?.expenses?.length === 0 ? (
                                    <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                                        No operational expenses recorded for this event yet.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                                        {analytics.expenses.map((exp) => (
                                            <div key={exp.id || exp.expenseId} className="py-2.5 flex items-center justify-between text-xs">
                                                <div>
                                                    <div className="font-extrabold text-gray-900">{exp.category}</div>
                                                    {exp.description && (
                                                        <span className="text-[11px] text-gray-400">{exp.description}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-black text-red-600">
                                                        -₱{Number(exp.amount).toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteExpense(exp.id || exp.expenseId)}
                                                        className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                                                        title="Delete expense"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-black text-gray-900">
                                    <span>Total Operational Costs:</span>
                                    <span className="font-mono text-red-600">₱{Number(analytics?.totalExpenses || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Add Expense */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
                        <h3 className="text-base font-black text-gray-900">
                            Record Operational Expense
                        </h3>
                        <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Expense Category</label>
                                <select
                                    value={expenseCategory}
                                    onChange={(e) => setExpenseCategory(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                                >
                                    <option value="Booth Rental">Booth Rental Fee</option>
                                    <option value="Transportation">Gas & Transportation</option>
                                    <option value="Staff Wages">Staff / Assistant Allowance</option>
                                    <option value="Electricity">Electricity / Socket Fee</option>
                                    <option value="Food & Drinks">Food & Refreshments</option>
                                    <option value="Packaging">Extra Bags & Packaging</option>
                                    <option value="Miscellaneous">Miscellaneous Expense</option>
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Amount (₱)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    placeholder="E.g. 500"
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Description / Receipt Note</label>
                                <input
                                    type="text"
                                    value={expenseDescription}
                                    onChange={(e) => setExpenseDescription(e.target.value)}
                                    placeholder="E.g. Grab to SM Megamall"
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsExpenseModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingExpense}
                                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black shadow-xs cursor-pointer"
                                >
                                    {savingExpense ? "Saving..." : "Save Expense"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </BazaarLayout>
    );
}
