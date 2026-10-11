import { getSellerOrders } from '../../services/orderSubmissionService.js';
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getSellerEvent,
    toggleEventAcceptingOrders,
    updateEventStatus,
} from "../../services/bazaarService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import QrCodeModal from "../../components/bazaar/QrCodeModal";
import {
    Calendar,
    MapPin,
    Clock,
    QrCode,
    Pause,
    Play,
    StopCircle,
    ArrowLeft,
    AlertCircle,
    Package,
    ListOrdered,
    Receipt,
    ArrowRight,
} from "lucide-react";

export default function EventDashboard() {
    const { eventId } = useParams();
    const { currentUser } = useAuth();

    const [shop, setShop] = useState(null);
    const [eventOrders,setEventOrders]=useState(null);
    const [readError,setReadError]=useState('');
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [isTogglingOrders, setIsTogglingOrders] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!currentUser?.uid || !eventId) return;

        async function fetchEventDetails() {
            setLoading(true);
            try {
                const [shopData, eventData, ordersData] = await Promise.all([
                    getSellerShop(currentUser.uid),
                    getSellerEvent(currentUser.uid, eventId),
                    getSellerOrders(currentUser.uid,eventId).catch(()=>null),
                ]);
                if (isMounted) {
                    setShop(shopData);
                    setEvent(eventData);
                    setEventOrders(ordersData);
                }
            } catch (err) {
                if(isMounted)setReadError(err.message || "Event could not be loaded.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchEventDetails();
        return () => { isMounted = false; };
    }, [currentUser?.uid, eventId]);

    const handleToggleOrders = async () => {
        if (!event) return;
        setIsTogglingOrders(true);
        try {
            const nextVal = !event.isAcceptingOrders;
            await toggleEventAcceptingOrders(currentUser.uid, eventId, nextVal);
            setEvent((prev) => (prev ? { ...prev, isAcceptingOrders: nextVal, queueStatus: nextVal ? "open" : "paused" } : null));
        } catch (err) {
            console.error("Failed to toggle intake:", err);
        } finally {
            setIsTogglingOrders(false);
        }
    };

    const handleStatusTransition = async (newStatus) => {
        if (!event) return;
        if (newStatus === "Ended" && !window.confirm("Ending this event closes the order queue permanently. Proceed?")) {
            return;
        }
        setStatusUpdating(true);
        try {
            await updateEventStatus(currentUser.uid, eventId, newStatus);
            setEvent((prev) =>
                prev
                    ? {
                          ...prev,
                          status: newStatus,
                          isAcceptingOrders: newStatus === "Active",
                          queueStatus: newStatus === "Ended" ? "closed" : (newStatus === "Active" ? "open" : prev.queueStatus),
                      }
                    : null
            );
        } catch (err) {
            console.error("Failed to update status:", err);
        } finally {
            setStatusUpdating(false);
        }
    };

    const qrUrl = eventId ? `${window.location.origin}/#/bazaar/e/${eventId}` : "";

    if (loading) {
        return (
            <BazaarLayout activeTab="events">
                <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
                    <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-gray-500">Loading event dashboard...</span>
                </div>
            </BazaarLayout>
        );
    }

    if (!event) {
        return (
            <BazaarLayout activeTab="events">
                <div className="max-w-md mx-auto py-20 text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900">Event Not Found</h3>
                    <p className="text-xs text-gray-500">
                        This event does not exist or belongs to another seller shop.
                    </p>
                    <Link
                        to="/studio/bazaar/events"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 text-white font-bold text-xs"
                    >
                        <ArrowLeft size={16} /> Return to Events
                    </Link>
                </div>
            </BazaarLayout>
        );
    }

    const isLive = event.status === "Active";
    const isEnded = event.status === "Ended";

    return (
        <BazaarLayout activeTab="events">
            <div className="space-y-8 animate-in fade-in duration-150">
                {/* Back Link & Navigation Breadcrumb */}
                <div className="flex items-center justify-between">
                    <Link
                        to="/studio/bazaar/events"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft size={14} /> Back to All Events
                    </Link>

                    <button
                        onClick={() => setIsQrModalOpen(true)}
                        className="px-4 py-2 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 font-bold text-xs shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                        <QrCode size={16} className="text-teal-600" /> Event QR Code & Poster
                    </button>
                </div>

                {/* Event Hero Header Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                                        isLive
                                            ? "bg-teal-500 text-white shadow-xs"
                                            : isEnded
                                            ? "bg-gray-100 text-gray-600"
                                            : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}
                                >
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            isLive ? "bg-white animate-pulse" : isEnded ? "bg-gray-400" : "bg-blue-500"
                                        }`}
                                    />
                                    {event.status || "Scheduled"}
                                </span>

                                {event.boothNumber && (
                                    <span className="text-xs font-mono font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                                        Booth {event.boothNumber}
                                    </span>
                                )}

                                <span className="text-xs font-mono text-gray-400 px-2">
                                    ID: {event.eventId || eventId}
                                </span>
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                {event.name}
                            </h2>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <MapPin size={15} className="text-teal-600" />
                                    {event.venue}
                                </span>
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Calendar size={15} className="text-teal-600" />
                                    {event.startDate || "Date TBD"} {event.endDate ? `to ${event.endDate}` : ""}
                                </span>
                                {event.openingHours && (
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <Clock size={15} className="text-teal-600" />
                                        {event.openingHours}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Operational State Controls */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                            {!isEnded ? (
                                <>
                                    <button
                                        onClick={handleToggleOrders}
                                        disabled={isTogglingOrders}
                                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            event.isAcceptingOrders
                                                ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                                                : "bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                                        }`}
                                    >
                                        {event.isAcceptingOrders ? (
                                            <>
                                                <Pause size={15} /> Pause Order Intake
                                            </>
                                        ) : (
                                            <>
                                                <Play size={15} /> Resume Order Intake
                                            </>
                                        )}
                                    </button>

                                    {event.status !== "Active" && (
                                        <button
                                            onClick={() => handleStatusTransition("Active")}
                                            disabled={statusUpdating}
                                            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                                        >
                                            Go Live (Activate)
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleStatusTransition("Ended")}
                                        disabled={statusUpdating}
                                        className="px-3.5 py-2.5 rounded-2xl bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-700 border border-gray-200 text-xs font-bold transition-all cursor-pointer"
                                        title="End Event and Close Queue"
                                    >
                                        <StopCircle size={15} />
                                    </button>
                                </>
                            ) : (
                                <span className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs">
                                    Event Concluded
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Operational Limits Bar */}
                    <div className="pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                            <span className="text-[11px] font-bold text-gray-400 block uppercase">
                                Queue Limit
                            </span>
                            <span className="text-sm font-black text-gray-800 font-mono">
                                {event.pendingQueueCapacity || 10} pending orders
                            </span>
                        </div>
                        <div>
                            <span className="text-[11px] font-bold text-gray-400 block uppercase">
                                Production Limit
                            </span>
                            <span className="text-sm font-black text-gray-800 font-mono">
                                {event.activeProductionCapacity || 5} active prints
                            </span>
                        </div>
                        <div>
                            <span className="text-[11px] font-bold text-gray-400 block uppercase">
                                Queue Status
                            </span>
                            <span className="text-sm font-black text-gray-800 capitalize">
                                {event.queueStatus || "open"}
                            </span>
                        </div>
                        <div>
                            <span className="text-[11px] font-bold text-gray-400 block uppercase">
                                Pickup Counter
                            </span>
                            <span className="text-sm font-medium text-gray-800 truncate block">
                                {event.pickupInstructions || "At booth counter"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Event Operational Workspaces</h3>
                        <span className="text-xs text-gray-400 font-medium">Booth Modules & Tooling</span>
                    </div>
                    {readError && (
                        <div role="alert" className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-600 shrink-0" />
                            <span>{readError}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* 1. Product Catalog & Booth Stock */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                                        <Package size={20} />
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Operational
                                    </span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">Product Catalog & Booth Stock</h4>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        {Object.values(event.catalog || {}).filter(item => item.enabled).length} active products. Configure event pricing, allocate components, and audit booth BOM readiness.
                                    </p>
                                </div>
                            </div>
                            <Link
                                to={`/studio/bazaar/events/${eventId}/catalog`}
                                className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors"
                            >
                                <span>Manage Catalog & Stock</span>
                                <ArrowRight size={14} />
                            </Link>
                        </div>

                        {/* 2. Live Order Queue */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                        <ListOrdered size={20} />
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                        Active Queue
                                    </span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">Live Order Queue</h4>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        {eventOrders ? `${eventOrders.filter(order => ['pending', 'accepted', 'preparing', 'ready'].includes(order.fulfillmentStatus)).length} active orders (${eventOrders.length} total recorded). Process acceptance, reserve stock, and update status.` : 'Open the queue to review incoming customer orders.'}
                                    </p>
                                </div>
                            </div>
                            <Link
                                to={`/studio/bazaar/orders?event=${encodeURIComponent(eventId)}`}
                                className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs transition-colors"
                            >
                                <span>Open Live Orders</span>
                                <ArrowRight size={14} />
                            </Link>
                        </div>

                        {/* 3. Booth Reports & Expenses */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                                        <Receipt size={20} />
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                        Cash Tracking
                                    </span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">Booth Cash & Financials</h4>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        Track event sales totals, register booth expenses, and audit cash drawer balance.
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Automated payment gateway verification: <span className="font-bold text-gray-500">Coming Soon</span>.
                                    </p>
                                </div>
                            </div>
                            <Link
                                to={`/studio/bazaar/reports?event=${encodeURIComponent(eventId)}`}
                                className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs transition-colors"
                            >
                                <span>View Financial Reports</span>
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Event QR Code Modal */}
            <QrCodeModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                title={`${event.name} QR`}
                subtitle={`Customer self-service QR code for booth at ${event.venue}`}
                url={qrUrl}
                badgeText={`Booth: ${event.boothNumber || "General"}`}
                pickupInstructions={event.pickupInstructions}
                shopName={shop?.name || "KenCreations Studio"}
            />
        </BazaarLayout>
    );
}
