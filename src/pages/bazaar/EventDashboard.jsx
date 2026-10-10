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
    Layers,
    ClipboardList,
    DollarSign,
} from "lucide-react";

export default function EventDashboard() {
    const { eventId } = useParams();
    const { currentUser } = useAuth();

    const [shop, setShop] = useState(null);
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
                const [shopData, eventData] = await Promise.all([
                    getSellerShop(currentUser.uid).catch(() => null),
                    getSellerEvent(currentUser.uid, eventId).catch(() => null),
                ]);
                if (isMounted) {
                    setShop(shopData);
                    setEvent(eventData);
                }
            } catch (err) {
                console.error("[EventDashboard] Failed to load event:", err);
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

                {/* Upcoming Milestone Workspaces Placeholders */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                        Event Modules Roadmap
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Milestone 3: Catalog Assignment Placeholder */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                        <Package size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900">
                                            Product Catalog Assignment
                                        </h4>
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            Select products and event price overrides
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                    Milestone 3
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                In Milestone 3, configure which keychains, bagtags, and pop sockets are active for this event with BOM formulas and customization schemas.
                            </p>
                            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-400 font-medium flex items-center justify-between">
                                <span>Catalog Assignment module ready in Milestone 3</span>
                                <span className="font-mono text-gray-400">0 products assigned</span>
                            </div>
                        </div>

                        {/* Milestone 4: Inventory Allocation Placeholder */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                        <Layers size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900">
                                            Event Catalog & Stock Allocation
                                        </h4>
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            Product menu, pricing overrides, and booth stock
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                                    Milestone 3 Live
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Select products from your master catalog, set event-specific price discounts, and allocate component variant stock to this booth.
                            </p>
                            <Link
                                to={`/studio/bazaar/events/${eventId}/catalog`}
                                className="w-full py-2.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Layers size={14} /> Manage Event Catalog & Stock
                            </Link>
                        </div>

                        {/* Milestone 5: Order Queue Placeholder */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                        <ClipboardList size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900">
                                            Live Order Queue & POS
                                        </h4>
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            Acceptance, print tracking, and pickup
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                    Milestone 5
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                In Milestone 5, view incoming customer self-service orders, counter orders, and live print job status updates with capability tracking tokens.
                            </p>
                            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-400 font-medium flex items-center justify-between">
                                <span>Live Order Queue module ready in Milestone 5</span>
                                <span className="font-mono text-gray-400">0 orders in queue</span>
                            </div>
                        </div>

                        {/* Milestone 6: Financial Expenses Placeholder */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                        <DollarSign size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-900">
                                            Booth Cash & Expenses
                                        </h4>
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            Table fees, petty cash float, and P&L
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                    Milestone 6
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                In Milestone 6, record booth registration fees, transportation costs, cash float, and live event gross margins.
                            </p>
                            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-400 font-medium flex items-center justify-between">
                                <span>Financial Ledger module ready in Milestone 6</span>
                                <span className="font-mono text-gray-400">0 expenses logged</span>
                            </div>
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
