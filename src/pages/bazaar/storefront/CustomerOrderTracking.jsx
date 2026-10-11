import { bazaarOperation } from '../../../services/bazaarDiagnostics';
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublicOrderTracking } from "../../../services/bazaarService";
import {
    Package,
    Clock,
    CheckCircle2,
    MapPin,
    AlertCircle,
    Sparkles,
    Gift,
    Hammer,
    Store,
    RotateCcw,
} from "lucide-react";

export default function CustomerOrderTracking() {
    const { privateToken } = useParams();
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [readError, setReadError] = useState('');

    useEffect(() => {
        let isMounted = true;
        let timer;

        async function fetchTracking() {
            setLoading(true);
            try {
                const res = await bazaarOperation('read-tracking', 'order_tracking/{capability}', () => getPublicOrderTracking(privateToken));
                if (!isMounted) return;
                if (!res) {
                    setOrder(null); setNotFound(true);
                } else {
                    setNotFound(false); setReadError(''); setOrder(res);
                }
            } catch (err) {
                if (isMounted) setReadError(err.code === "permission-denied" ? "Tracking access was denied. Contact the seller; do not resubmit the order." : "Tracking is temporarily unavailable. Retrying automatically.");
            } finally {
                if (isMounted) { setLoading(false); timer = setTimeout(fetchTracking, 10000); }
            }
        }

        queueMicrotask(() => { if (isMounted) { setOrder(null); setReadError(''); setNotFound(false); fetchTracking(); } });

        // Real-time polling or refreshing every 10 seconds for booth customers


        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [privateToken]);

    if (loading && !order) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-gray-500">Checking Order Status...</p>
            </div>
        );
    }

    if (readError && !order) return <div role="alert" className="p-8">{readError}</div>;
    if (notFound || !order) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4 font-sans">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <AlertCircle size={28} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Order Ticket Expired or Invalid</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        This order tracking link cannot be found, has expired, or was revoked. Please verify your tracking URL or speak with the booth seller.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    const status = (order.fulfillmentStatus || order.status || "pending").toLowerCase();

    // Map fulfillment states to display config
    const statusConfig = {
        pending: {
            label: "Pending Acceptance",
            color: "bg-amber-100 text-amber-800 border-amber-200",
            icon: Clock,
            description: "Your order is in the booth queue waiting for seller acceptance.",
        },
        accepted: {
            label: "Order Accepted & Reserved",
            color: "bg-blue-100 text-blue-800 border-blue-200",
            icon: Sparkles,
            description: "The seller accepted your order! Component stock is reserved.",
        },
        preparing: {
            label: "Assembling / Printing",
            color: "bg-purple-100 text-purple-800 border-purple-200",
            icon: Hammer,
            description: "Your custom 3D clicker is currently being hand-assembled at the booth!",
        },
        ready: {
            label: "Ready for Pickup! 🎁",
            color: "bg-emerald-100 text-emerald-800 border-emerald-300",
            icon: Gift,
            description: "Your order is finished and waiting for you at the booth counter!",
        },
        collected: {
            label: "Completed & Collected",
            color: "bg-gray-100 text-gray-800 border-gray-200",
            icon: CheckCircle2,
            description: "Order collected. Thank you for supporting our 3D print booth!",
        },
        cancelled: {
            label: "Order Cancelled",
            color: "bg-red-100 text-red-800 border-red-200",
            icon: AlertCircle,
            description: "This order was cancelled. Please check with the booth seller.",
        },
        rejected: {
            label: "Order Declined",
            color: "bg-red-100 text-red-800 border-red-200",
            icon: AlertCircle,
            description: "The seller was unable to fulfill this order due to capacity or stock.",
        },
    };

    const currentStatus = statusConfig[status] || statusConfig.pending;
    const StatusIcon = currentStatus.icon;

    return (
        <div className="min-h-screen bg-[#f8f9fc] text-slate-800 p-4 sm:p-6 font-sans">
            <div className="max-w-md w-full mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/60 inline-flex items-center gap-1">
                        <Store size={11} /> Live Booth Pickup Tracking
                    </span>
                    <h1 className="text-xl font-black text-gray-900 tracking-tight">
                        Order #{order.orderNumber || "BOOTH-ORDER"}
                    </h1>
                </div>

                {/* Primary Fulfillment Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-lg text-center space-y-6">
                    {/* Status Badge */}
                    <div className="inline-flex flex-col items-center gap-2">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner ${
                            status === "ready" ? "bg-emerald-50 text-emerald-600 animate-bounce" : "bg-teal-50 text-teal-600"
                        }`}>
                            <StatusIcon size={32} />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black border ${currentStatus.color}`}>
                            {currentStatus.label}
                        </span>
                    </div>

                    {/* Description message */}
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed font-medium">
                        {currentStatus.description}
                    </p>

                    {/* Pickup code / instructions */}
                    {order.pickupCode && (
                        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-center space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                                Counter Pickup Verification Code
                            </span>
                            <div className="text-2xl font-black font-mono text-teal-950 tracking-widest">
                                {order.pickupCode}
                            </div>
                        </div>
                    )}

                    {/* Step progress bar */}
                    <div className="grid grid-cols-4 gap-1.5 pt-2">
                        {["pending", "accepted", "preparing", "ready"].map((step, idx) => {
                            const stepsOrder = ["pending", "accepted", "preparing", "ready", "collected"];
                            const currentIdx = stepsOrder.indexOf(status);
                            const isDone = currentIdx >= idx;
                            return (
                                <div key={step} className="space-y-1 text-center">
                                    <div className={`h-2 rounded-full transition-all ${
                                        isDone ? "bg-teal-600 shadow-xs" : "bg-gray-100"
                                    }`} />
                                    <span className="text-[9px] font-bold text-gray-400 capitalize block">
                                        {step === "preparing" ? "Making" : step}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Pickup Instructions & Location */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-3 text-xs">
                    <h2 className="font-black text-gray-900 flex items-center gap-1.5">
                        <MapPin size={15} className="text-teal-600" />
                        Pickup Instructions
                    </h2>
                    <p className="text-gray-600 leading-relaxed">
                        {order.pickupInstructions || "Present your name and order number at the counter when called."}
                    </p>
                </div>

                {/* Items Summary (Sanitized for customer view) */}
                {order.itemsSummary && order.itemsSummary.length > 0 && (
                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-3 text-xs">
                        <h2 className="font-black text-gray-900 flex items-center gap-1.5">
                            <Package size={15} className="text-teal-600" />
                            Items in Order
                        </h2>
                        <div className="divide-y divide-gray-100">
                            {order.itemsSummary.map((item, idx) => (
                                <div key={idx} className="py-2 flex items-center justify-between">
                                    <span className="font-bold text-gray-800">{item.title}</span>
                                    <span className="text-gray-400 font-medium">{item.summary}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Auto-refresh hint */}
                <div className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-1">
                    <RotateCcw size={11} className="animate-spin" />
                    <span>Page automatically updates every 10 seconds</span>
                </div>
            </div>
        </div>
    );
}
