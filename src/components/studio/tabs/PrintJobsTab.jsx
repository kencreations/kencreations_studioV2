import React, { useState } from "react";
import {
    Plus,
    Search,
    Filter,
    Printer,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    DollarSign,
    Trash2,
    Edit2,
    RotateCcw,
} from "lucide-react";

const STATUS_FILTERS = ["All", "Queued", "Printing", "Completed", "Failed", "Cancelled"];

export default function PrintJobsTab({
    printJobs = [],
    onOpenCreate,
    onOpenEdit,
    onDelete,
    onCompleteJob,
    onCancelJob,
    onRecordSaleFromJob,
}) {
    const [search, setSearch] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("All");
    const [processingId, setProcessingId] = useState(null);

    const filtered = printJobs.filter((job) => {
        const matchesSearch =
            (job.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
            (job.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
            (job.job_number || "").toLowerCase().includes(search.toLowerCase()) ||
            (job.assigned_printer || "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus = selectedStatus === "All" || job.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const handleComplete = async (job) => {
        if (!confirm(`Mark job ${job.job_number} as Completed? This will deduct materials used from your inventory.`)) {
            return;
        }
        setProcessingId(job.id);
        try {
            await onCompleteJob(job.id);
        } catch (err) {
            alert(err.message || "Failed to complete print job.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleRevert = async (job) => {
        if (!confirm(`Cancel/Revert job ${job.job_number}? If materials were previously deducted, they will be returned to stock.`)) {
            return;
        }
        setProcessingId(job.id);
        try {
            await onCancelJob(job.id);
        } catch (err) {
            alert(err.message || "Failed to cancel print job.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Print Job Tracker</h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Manage production batches. Materials are deducted automatically upon completion.
                    </p>
                </div>
                <button
                    onClick={onOpenCreate}
                    className="px-4 py-2 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                    <Plus size={16} /> New Print Job
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search jobs, customers, printers, job IDs..."
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
                        {STATUS_FILTERS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Print Jobs List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs">
                    <Printer size={36} className="mx-auto text-gray-300 mb-2" />
                    <h3 className="text-sm font-bold text-gray-800">No print jobs found</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {printJobs.length === 0
                            ? "Queue your first 3D printing batch to track material deductions and production timing."
                            : "No jobs match your filter criteria."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((job) => {
                        const isCompleted = job.status === "Completed";
                        const isCancelled = job.status === "Cancelled";
                        const isPrinting = job.status === "Printing";

                        return (
                            <div
                                key={job.id}
                                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="font-mono text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
                                            {job.job_number}
                                        </span>
                                        <h3 className="text-sm font-bold text-gray-900">{job.product_name}</h3>
                                        <span
                                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                isCompleted
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : isPrinting
                                                    ? "bg-teal-100 text-teal-800"
                                                    : isCancelled
                                                    ? "bg-gray-100 text-gray-600"
                                                    : job.status === "Failed"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-amber-100 text-amber-800"
                                            }`}
                                        >
                                            {job.status}
                                        </span>
                                        {job.deducted && (
                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                <CheckCircle size={12} className="text-emerald-500" /> Stock Deducted
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
                                        <span>🖨️ {job.assigned_printer}</span>
                                        {job.customer_name && <span>👤 {job.customer_name}</span>}
                                        <span>⏱️ {job.actual_duration_hrs}h print duration</span>
                                    </div>

                                    {/* Linked Materials Pills */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {(job.filaments_used || []).map((f, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-mono text-gray-700"
                                            >
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full border border-black/10"
                                                    style={{ backgroundColor: f.color_hex || "#14b8a6" }}
                                                />
                                                {f.name}: {f.grams}g
                                            </span>
                                        ))}
                                        {(job.consumables_used || []).map((c, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-mono text-gray-600"
                                            >
                                                📦 {c.name}: {c.qty} {c.unit}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Financials & Status Actions */}
                                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                                    <div className="text-right font-mono">
                                        <div className="text-xs text-gray-400">Production Cost: ₱{(Number(job.actual_cost) || 0).toFixed(2)}</div>
                                        <div className="text-base font-black text-gray-900">₱{(Number(job.selling_price) || 0).toFixed(2)}</div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!isCompleted && !isCancelled && (
                                            <button
                                                onClick={() => handleComplete(job)}
                                                disabled={processingId === job.id}
                                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all disabled:opacity-50"
                                                title="Complete Job and deduct inventory"
                                            >
                                                <CheckCircle size={14} /> Mark Completed
                                            </button>
                                        )}

                                        {isCompleted && (
                                            <button
                                                onClick={() => onRecordSaleFromJob?.(job)}
                                                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-colors flex items-center gap-1"
                                                title="Record completed sale"
                                            >
                                                <DollarSign size={14} /> Record Sale
                                            </button>
                                        )}

                                        {isCompleted && (
                                            <button
                                                onClick={() => handleRevert(job)}
                                                disabled={processingId === job.id}
                                                className="p-2 text-gray-400 hover:text-amber-600 rounded-lg transition-colors"
                                                title="Revert / Return deducted stock"
                                            >
                                                <RotateCcw size={15} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => onOpenEdit(job)}
                                            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                            title="Edit job"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(job.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Delete job"
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
