import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getSellerShop, getSellerEvents } from "../../services/bazaarService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import QrCodeModal from "../../components/bazaar/QrCodeModal";
import {
    Store,
    Calendar,
    Plus,
    QrCode,
    Sparkles,
    Clock,
    AlertCircle,
    ArrowRight,
    MapPin,
    Package,
    ClipboardList,
    ChevronRight,
} from "lucide-react";

export default function BazaarDashboard() {
    const { currentUser } = useAuth();
    const [shop, setShop] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isShopQrOpen, setIsShopQrOpen] = useState(false);

    useEffect(() => {
        if (!currentUser?.uid) return;
        let isMounted = true;

        async function loadDashboard() {
            setLoading(true);
            try {
                const [shopData, eventsData] = await Promise.all([
                    getSellerShop(currentUser.uid).catch(() => null),
                    getSellerEvents(currentUser.uid).catch(() => []),
                ]);
                if (isMounted) {
                    setShop(shopData);
                    setEvents(eventsData);
                }
            } catch (err) {
                console.error("[BazaarDashboard] Error loading data:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadDashboard();
        return () => { isMounted = false; };
    }, [currentUser?.uid]);

    // Compute real event statuses
    const activeEvent = events.find((e) => e.status === "Active" || e.status === "active");
    const upcomingEvents = events.filter((e) => e.status === "Scheduled" || e.status === "Draft");
    const endedEvents = events.filter((e) => e.status === "Ended" || e.status === "ended");

    const shopUrl = shop?.slug ? `${window.location.origin}/#/bazaar/${shop.slug}` : "";

    return (
        <BazaarLayout activeTab="dashboard">
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
                    <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-gray-500">Loading Bazaar Hub...</span>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-150">
                    {/* Top Hero / Welcome Banner */}
                    <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
                        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/20 to-transparent pointer-events-none" />
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 max-w-xl">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 text-teal-200 border border-white/10 backdrop-blur-xs">
                                    <Sparkles size={12} /> Point-of-Sale & Live Pop-up Fair Booth
                                </span>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                                    {shop?.name || "Welcome to Bazaar Hub"}
                                </h2>
                                <p className="text-sm text-teal-100/90 leading-relaxed">
                                    Self-service QR ordering and live booth fulfillment designed for in-person 3D printing sellers.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {shop ? (
                                    <>
                                        <button
                                            onClick={() => setIsShopQrOpen(true)}
                                            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 backdrop-blur-xs flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <QrCode size={16} /> Shop QR Code
                                        </button>
                                        <Link
                                            to="/studio/bazaar/events"
                                            className="px-5 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-md hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <Plus size={16} /> Manage Events
                                        </Link>
                                    </>
                                ) : (
                                    <Link
                                        to="/studio/bazaar/shop"
                                        className="px-6 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-md hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                                    >
                                        <Store size={16} /> Setup Your Shop
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Shop Status Banner if not setup */}
                    {!shop && (
                        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                    <AlertCircle size={22} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-amber-900">
                                        Shop Profile Incomplete
                                    </h4>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        Configure your permanent seller profile, unique URL slug, and payment instructions before launching event booths.
                                    </p>
                                </div>
                            </div>
                            <Link
                                to="/studio/bazaar/shop"
                                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 self-start sm:self-auto transition-all"
                            >
                                Configure Shop
                            </Link>
                        </div>
                    )}

                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Shop Status */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Shop Profile
                                </span>
                                <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                    <Store size={18} />
                                </div>
                            </div>
                            <div className="text-lg font-black text-gray-900 truncate">
                                {shop?.name || "Not Configured"}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                        shop?.isPublished
                                            ? "bg-teal-50 text-teal-700 border border-teal-200"
                                            : "bg-gray-100 text-gray-600 border border-gray-200"
                                    }`}
                                >
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            shop?.isPublished ? "bg-teal-500" : "bg-gray-400"
                                        }`}
                                    />
                                    {shop?.isPublished ? "Published" : "Draft / Private"}
                                </span>
                                {shop?.slug && (
                                    <span className="text-[11px] font-mono text-gray-400 truncate">
                                        /{shop.slug}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Active Event */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Active Event
                                </span>
                                <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                    <Calendar size={18} />
                                </div>
                            </div>
                            <div className="text-lg font-black text-gray-900 truncate">
                                {activeEvent?.name || "None Active"}
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-1 truncate">
                                {activeEvent ? (
                                    <span className="flex items-center gap-1 text-teal-600 font-bold">
                                        <MapPin size={12} /> {activeEvent.venue || "Booth Active"}
                                    </span>
                                ) : (
                                    "No event running right now"
                                )}
                            </p>
                        </div>

                        {/* Total Events */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Total Events
                                </span>
                                <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                    <Clock size={18} />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-gray-900 font-mono">
                                {events.length}
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-1">
                                {upcomingEvents.length} upcoming · {endedEvents.length} ended
                            </p>
                        </div>

                        {/* Order Queue (Real Live State) */}
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Order Intake
                                </span>
                                <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                                    <ClipboardList size={18} />
                                </div>
                            </div>
                            <div className="text-lg font-black text-gray-900">
                                {activeEvent?.isAcceptingOrders ? "Accepting Orders" : "Standby"}
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-1">
                                {activeEvent ? "Booth POS connected" : "Inactive when no event active"}
                            </p>
                        </div>
                    </div>

                    {/* Active Event Banner or Empty State */}
                    {activeEvent ? (
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-teal-200/60 shadow-[0_4px_20px_rgba(13,148,136,0.06)] relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-500 text-white">
                                            LIVE BOOTH
                                        </span>
                                        <span className="text-xs font-mono text-gray-400">
                                            Booth {activeEvent.boothNumber || "N/A"}
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                                        {activeEvent.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-2">
                                        <MapPin size={14} className="text-teal-600" />
                                        {activeEvent.venue} · {activeEvent.openingHours || "All Day"}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Link
                                        to={`/studio/bazaar/events/${activeEvent.eventId || activeEvent.id}`}
                                        className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                                    >
                                        Open Event Dashboard <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                                <Calendar size={24} />
                            </div>
                            <div className="max-w-md mx-auto">
                                <h3 className="text-base font-black text-gray-900">
                                    No Active Bazaar Event
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Create and activate an event to generate booth QR codes, allocate stock, and receive custom orders.
                                </p>
                            </div>
                            <Link
                                to="/studio/bazaar/events"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
                            >
                                <Plus size={15} /> Create an Event
                            </Link>
                        </div>
                    )}

                    {/* Quick Shortcuts & Upcoming Roadmap Modules */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <Link
                            to="/studio/bazaar/shop"
                            className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all group flex items-start gap-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Store size={22} />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-black text-gray-900 flex items-center gap-1">
                                    Shop Settings <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <p className="text-xs text-gray-400">
                                    Configure branding, GCash QR, and contact details.
                                </p>
                            </div>
                        </Link>

                        <Link
                            to="/studio/bazaar/events"
                            className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all group flex items-start gap-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Calendar size={22} />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-black text-gray-900 flex items-center gap-1">
                                    Events & Fairs <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                                <p className="text-xs text-gray-400">
                                    Schedule pop-up markets, set queue limits, and manage booths.
                                </p>
                            </div>
                        </Link>

                        <div className="bg-white/60 rounded-3xl p-6 border border-dashed border-gray-200 flex items-start gap-4 opacity-80">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                                <Package size={22} />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    Catalog & Inventory
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">
                                        M3-M4
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Product customization BOMs and event booth stock allocation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Shop QR Code Modal */}
            {shop && (
                <QrCodeModal
                    isOpen={isShopQrOpen}
                    onClose={() => setIsShopQrOpen(false)}
                    title={`${shop.name} Storefront`}
                    subtitle="Permanent storefront QR code for your shop."
                    url={shopUrl}
                    badgeText={`Shop: /${shop.slug}`}
                    pickupInstructions={shop.pickupInstructions}
                    shopName={shop.name}
                />
            )}
        </BazaarLayout>
    );
}
