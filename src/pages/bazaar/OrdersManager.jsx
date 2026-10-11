import ReconcileOrderDialog from '../../components/bazaar/ReconcileOrderDialog';
import { validComponentKey } from '../../engine/bazaar/icons.js';
import { decomposeProductBOM } from '../../engine/bazaar/bom.js';
import IconArtwork from '../../components/bazaar/IconArtwork';
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getSellerEvents,
} from "../../services/bazaarService";
import {
    getSellerOrders,
    acceptSellerOrder,
    startOrderProduction,
    markOrderReady,
    markOrderCollected,
    cancelOrRejectOrder,
} from "../../services/orderSubmissionService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import {
    ShoppingBag,
    Clock,
    CheckCircle2,
    Play,
    Gift,
    XCircle,
    RotateCcw,
    MapPin,
    Calendar,
    Search,
    Filter,
    Volume2,
    VolumeX,
    CreditCard,
    Banknote,
    Tag,
    AlertCircle,
    ChevronDown,
    ExternalLink,
    RefreshCw,
} from "lucide-react";

export default function OrdersManager() {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();

    const [shop, setShop] = useState(null);
    const [events, setEvents] = useState([]);
    const [reviewOrder,setReviewOrder]=useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Filters
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pending' | 'accepted' | 'preparing' | 'ready' | 'collected' | 'cancelled'
    const [selectedEventId, setSelectedEventId] = useState(searchParams.get("event") || "all");
    const [searchQuery, setSearchQuery] = useState("");

    // Audio chime preference for new orders
    const [soundEnabled, setSoundEnabled] = useState(true);

    const loadOrdersData = useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [shopData, eventsData, ordersData] = await Promise.all([
                getSellerShop(currentUser.uid),
                getSellerEvents(currentUser.uid),
                getSellerOrders(currentUser.uid, selectedEventId === "all" ? null : selectedEventId),
            ]);
            setShop(shopData);
            setEvents(eventsData);
            setOrders(ordersData);
        } catch (err) {
            console.error("[OrdersManager] Failed to load orders:", err);
            setErrorMessage("Failed to load seller orders.");
        } finally {
            setLoading(false);
        }
    }, [currentUser, selectedEventId]);

    useEffect(() => {
        loadOrdersData();
        // Poll every 8 seconds for new kiosk orders at live booths
        const timer = setInterval(() => {
            getSellerOrders(currentUser?.uid, selectedEventId === "all" ? null : selectedEventId)
                .then((fresh) => {
                    setOrders(fresh);
                })
                .catch(() => {});
        }, 8000);

        return () => clearInterval(timer);
    }, [loadOrdersData, currentUser, selectedEventId]);

    // Filtered orders
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            // Status filter
            if (statusFilter !== "all") {
                const s = (o.fulfillmentStatus || "pending").toLowerCase();
                if (statusFilter === "pending" && s !== "pending") return false;
                if (statusFilter === "accepted" && s !== "accepted") return false;
                if (statusFilter === "preparing" && s !== "preparing") return false;
                if (statusFilter === "ready" && s !== "ready") return false;
                if (statusFilter === "collected" && s !== "collected") return false;
                if (statusFilter === "cancelled" && s !== "cancelled" && s !== "rejected") return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const name = (o.customerName || "").toLowerCase();
                const num = (o.orderNumber || "").toLowerCase();
                const code = (o.pickupCode || "").toLowerCase();
                if (!name.includes(q) && !num.includes(q) && !code.includes(q)) return false;
            }

            return true;
        });
    }, [orders, statusFilter, searchQuery]);

    // Order action handlers
    const handleAccept = async (orderId) => {
        setActionLoadingId(orderId);
        setErrorMessage("");
        try {
            await acceptSellerOrder(currentUser.uid, orderId);
            setSuccessMessage("Order accepted and inventory components reserved.");
            await loadOrdersData();
        } catch (err) {
            console.error("Accept error:", err);
            setErrorMessage(err.message || "Failed to accept order.");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleStartProduction = async (orderId) => {
        setActionLoadingId(orderId);
        setErrorMessage("");
        try {
            await startOrderProduction(currentUser.uid, orderId);
            setSuccessMessage("Production started. Materials consumed from inventory.");
            await loadOrdersData();
        } catch (err) {
            console.error("Start production error:", err);
            setErrorMessage(err.message || "Failed to start production.");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkReady = async (orderId) => {
        setActionLoadingId(orderId);
        setErrorMessage("");
        try {
            await markOrderReady(currentUser.uid, orderId);
            setSuccessMessage("Order marked Ready for customer pickup!");
            await loadOrdersData();
        } catch (err) {
            console.error("Mark ready error:", err);
            setErrorMessage(err.message || "Failed to mark order ready.");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkCollected = async (orderId) => {
        setActionLoadingId(orderId);
        setErrorMessage("");
        try {
            await markOrderCollected(currentUser.uid, orderId);
            setSuccessMessage("Order completed and marked collected.");
            await loadOrdersData();
        } catch (err) {
            console.error("Mark collected error:", err);
            setErrorMessage(err.message || "Failed to complete order.");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleCancel = async (orderId, isPending = false) => {
        const reason = window.prompt(
            isPending ? "Reason for declining order:" : "Reason for cancellation:",
            "Customer request / Out of stock"
        );
        if (reason === null) return;

        setActionLoadingId(orderId);
        setErrorMessage("");
        try {
            await cancelOrRejectOrder(currentUser.uid, orderId, { reason });
            setSuccessMessage(isPending ? "Order declined." : "Order cancelled. Unconsumed reservations released; consumed stock requires an inspected adjustment.");
            await loadOrdersData();
        } catch (err) {
            console.error("Cancel error:", err);
            setErrorMessage(err.message || "Failed to cancel order.");
        } finally {
            setActionLoadingId(null);
        }
    };

    // Tab counts
    const counts = useMemo(() => {
        const c = { pending: 0, accepted: 0, preparing: 0, ready: 0, collected: 0, cancelled: 0 };
        for (const o of orders) {
            const s = (o.fulfillmentStatus || "pending").toLowerCase();
            if (s === "pending") c.pending++;
            else if (s === "accepted") c.accepted++;
            else if (s === "preparing") c.preparing++;
            else if (s === "ready") c.ready++;
            else if (s === "collected") c.collected++;
            else if (s === "cancelled" || s === "rejected") c.cancelled++;
        }
        return c;
    }, [orders]);

    return (
        <BazaarLayout activeTab="orders">
            {reviewOrder && <ReconcileOrderDialog uid={currentUser.uid} order={reviewOrder} onClose={()=>setReviewOrder(null)} onSaved={()=>{setReviewOrder(null);loadOrdersData();setSuccessMessage("Mapping verified. Review the order and retry acceptance.");}} />}
            <div className="space-y-6 animate-in fade-in duration-150">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                            <ShoppingBag className="text-teal-600" size={26} />
                            Order Queue & Booth Fulfillment
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Real-time order intake, atomic component reservations, and counter pickup workflow.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            onClick={() => setSoundEnabled((s) => !s)}
                            className={`p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                soundEnabled
                                    ? "bg-teal-50 border-teal-200 text-teal-800"
                                    : "bg-gray-50 border-gray-200 text-gray-500"
                            }`}
                            title={soundEnabled ? "Audio chimes active" : "Audio muted"}
                        >
                            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
                        </button>

                        <button
                            onClick={loadOrdersData}
                            className="p-2.5 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <RefreshCw size={15} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                {errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={18} className="text-red-600 shrink-0" />
                            <span>{errorMessage} <Link to="/studio/bazaar/inventory" className="underline">Review inventory</Link> · <Link to="/studio/bazaar/events" className="underline">Review event allocations</Link></span>
                        </div>
                        <button onClick={() => setErrorMessage("")} className="text-red-500 hover:text-red-700">×</button>
                    </div>
                )}
                {successMessage && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-teal-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                        <button onClick={() => setSuccessMessage("")} className="text-teal-500 hover:text-teal-700">×</button>
                    </div>
                )}

                {/* Filters & Event Selector */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-2xs">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by customer name, order #, or pickup code..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        >
                            <option value="all">All Events & Direct</option>
                            {events.map((ev) => (
                                <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                                    {ev.name} ({ev.status})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {[
                        { id: "all", label: "All Orders", count: orders.length },
                        { id: "pending", label: "New (Pending)", count: counts.pending, alert: counts.pending > 0 },
                        { id: "accepted", label: "Accepted", count: counts.accepted },
                        { id: "preparing", label: "Assembling", count: counts.preparing },
                        { id: "ready", label: "Ready for Pickup", count: counts.ready },
                        { id: "collected", label: "Collected", count: counts.collected },
                        { id: "cancelled", label: "Cancelled", count: counts.cancelled },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                                statusFilter === tab.id
                                    ? "bg-teal-600 text-white shadow-xs"
                                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/80"
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                    statusFilter === tab.id
                                        ? "bg-white/20 text-white"
                                        : tab.alert
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-gray-100 text-gray-600"
                                }`}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
                        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-gray-500">Loading Order Records...</span>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                            <ShoppingBag size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">No orders found</h3>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                            {searchQuery
                                ? "No orders matched your search query."
                                : "No orders are currently waiting in this queue."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map((ord) => {
                            const orderId = ord.orderId || ord.id;
                            const status = (ord.fulfillmentStatus || "pending").toLowerCase();
                            const isActionLoading = actionLoadingId === orderId;
                            const getResolvedBOM = (item) => {
                                if (item.requiredBOM && item.requiredBOM.length > 0) return item.requiredBOM;
                                try {
                                    return decomposeProductBOM({
                                        product: item,
                                        customization: item.customization,
                                        quantity: item.quantity,
                                    });
                                } catch {
                                    return [];
                                }
                            };
                            const invalidInventory = ord.inventoryVersion!==1 || !ord.items?.length || ord.items.some(item => {
                                const bom = getResolvedBOM(item);
                                return !bom?.length || bom.some(part => !validComponentKey(part.component_key));
                            }); 

                            return (
                                <div
                                    key={orderId}
                                    className={`bg-white rounded-3xl p-5 border shadow-2xs space-y-4 transition-all ${
                                        status === "pending"
                                            ? "border-amber-300 ring-2 ring-amber-400/20"
                                            : status === "ready"
                                            ? "border-emerald-300"
                                            : "border-gray-100"
                                    }`}
                                >
                                    {/* Top Bar: Order ID, Customer, Status */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-black text-sm text-gray-900 bg-gray-100 px-2.5 py-1 rounded-xl">
                                                {ord.orderNumber}
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                                                    <span>{ord.customerName}</span>
                                                    {ord.pickupCode && (
                                                        <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded-md border border-teal-200/60">
                                                            Code: {ord.pickupCode}
                                                        </span>
                                                    )}
                                                </h3>
                                                <span className="text-[11px] text-gray-400">
                                                    {ord.eventName ? `${ord.eventName} (Booth #${ord.boothNumber || "General"})` : "Storefront Order"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Status Badge */}
                                            <span
                                                className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                                    status === "pending"
                                                        ? "bg-amber-100 text-amber-800"
                                                        : status === "accepted"
                                                        ? "bg-blue-100 text-blue-800"
                                                        : status === "preparing"
                                                        ? "bg-purple-100 text-purple-800"
                                                        : status === "ready"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : status === "collected"
                                                        ? "bg-gray-100 text-gray-700"
                                                        : "bg-red-100 text-red-800"
                                                }`}
                                            >
                                                {ord.fulfillmentStatus}
                                            </span>

                                            {/* Payment Badge */}
                                            <span
                                                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                                                    ord.paymentStatus === "paid"
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                                        : "bg-amber-50 text-amber-700 border border-amber-200/60"
                                                }`}
                                            >
                                                {ord.paymentMethod === "gcash" ? <CreditCard size={12} /> : <Banknote size={12} />}
                                                <span className="capitalize">{ord.paymentMethod}</span>
                                                <span>•</span>
                                                <span className="uppercase">{ord.paymentStatus || "unpaid"}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Order Items Breakdown */}
                                    <div className="space-y-3">
                                        {(ord.items || []).map((item, idx) => {
                                            const custom = item.customization;
                                            return (
                                                <div key={idx} className="bg-gray-50/70 rounded-2xl p-3 text-xs space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-extrabold text-gray-900">
                                                            {item.quantity}× {item.productName}
                                                        </span>
                                                        <span className="font-mono font-bold text-gray-800">
                                                            ₱{Number(item.lineTotal || item.authoritativeUnitPrice * item.quantity).toFixed(0)}
                                                        </span>
                                                    </div>

                                                    {(() => {
                                                        const itemBOM = getResolvedBOM(item);
                                                        return itemBOM?.length > 0 ? (
                                                            <details><summary>Required components</summary><ul>{itemBOM.map(part => <li key={part.component_key}>{part.name}: {part.required_qty} — {part.component_key}</li>)}</ul></details>
                                                        ) : null;
                                                    })()}
                                                    {custom?.slotsData?.map((slot, index) => <div key={index}>Slot {index + 1}: {slot.isIcon ? slot.iconName || slot.iconId : `${slot.char} — ${slot.colorName}`} {slot.styleName || slot.styleId || ''} {slot.switchName || slot.switchId || ''}</div>)}
                                                    {/* Customized clicker specifications */}
                                                    {custom && (
                                                        <div className="space-y-1 text-[11px] text-gray-600">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-gray-400">Word:</span>
                                                                <span className="font-mono font-black text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded-md">
                                                                    {custom.text} ({custom.slots}-Key)
                                                                </span>
                                                            </div>

                                                            {custom.slotsData && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {custom.slotsData.map((s, sIdx) => (
                                                                        <span
                                                                            key={sIdx}
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-white border border-gray-200 text-gray-700 font-bold"
                                                                        >
                                                                            <span
                                                                                className="w-2 h-2 rounded-full inline-block"
                                                                                style={{ backgroundColor: s.isIcon ? "transparent" : s.colorHex }}
                                                                            />
                                                                            <span>{s.isIcon ? <IconArtwork icon={{...s,id:s.iconId,name:s.iconName}} /> : `${s.char}: ${s.colorName}`}</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="text-gray-500">
                                                                Casing: <strong>{custom.casingColor?.name || custom.casing_color}</strong> • Switch: <strong>{custom.switchType?.name || custom.switch_type_id}</strong>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Customer Note or GCash Reference */}
                                    {(ord.orderNotes || ord.gcashReference) && (
                                        <div className="p-3 rounded-2xl bg-gray-50 text-xs text-gray-600 space-y-1">
                                            {ord.orderNotes && (
                                                <p><strong>Note:</strong> "{ord.orderNotes}"</p>
                                            )}
                                            {ord.gcashReference && (
                                                <p className="font-mono">
                                                    <strong>GCash Ref:</strong> {ord.gcashReference}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Bottom Bar: Total and Action Buttons */}
                                    <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="text-xs">
                                            <span className="text-gray-400">Total: </span>
                                            <strong className="text-base font-black text-gray-900">
                                                ₱{Number(ord.totalAmount).toFixed(0)}
                                            </strong>
                                        </div>

                                        {invalidInventory && <p role="alert" className="text-xs text-red-700">Legacy inventory references need seller review. Verify and map the actual stock items before fulfillment; no automatic remapping or stock creation will occur. <button className="underline font-bold" onClick={()=>setReviewOrder(ord)}>Review inventory mapping</button></p>}
                                        {/* State Machine Transition Actions */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {status === "pending" && (
                                                <>
                                                    <button
                                                        disabled={isActionLoading || invalidInventory}
                                                        onClick={() => handleAccept(orderId)}
                                                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        <span>Accept & Reserve Stock</span>
                                                    </button>
                                                    <button
                                                        disabled={isActionLoading}
                                                        onClick={() => handleCancel(orderId, true)}
                                                        className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-all cursor-pointer"
                                                    >
                                                        Decline
                                                    </button>
                                                </>
                                            )}

                                            {status === "accepted" && (
                                                <>
                                                    <button
                                                        disabled={isActionLoading}
                                                        onClick={() => handleStartProduction(orderId)}
                                                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Play size={14} />
                                                        <span>Start Assembly (Consume Stock)</span>
                                                    </button>
                                                    <button
                                                        disabled={isActionLoading}
                                                        onClick={() => handleCancel(orderId, false)}
                                                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-all cursor-pointer"
                                                    >
                                                        Cancel & Release
                                                    </button>
                                                </>
                                            )}

                                            {status === "preparing" && (
                                                <button
                                                    disabled={isActionLoading}
                                                    onClick={() => handleMarkReady(orderId)}
                                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Gift size={14} />
                                                    <span>Mark Ready for Pickup</span>
                                                </button>
                                            )}

                                            {status === "ready" && (
                                                <button
                                                    disabled={isActionLoading}
                                                    onClick={() => handleMarkCollected(orderId)}
                                                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    <span>Mark Collected / Complete</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </BazaarLayout>
    );
}
