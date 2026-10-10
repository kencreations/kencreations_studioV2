import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Store,
    ShoppingBag,
    MapPin,
    Calendar,
    AlertCircle,
    ArrowLeft,
    Sparkles,
    ShieldCheck,
    Check,
} from "lucide-react";

/**
 * Mobile-first customer storefront layout.
 * Clean, lightweight, and completely decoupled from administrative sidebar.
 */
export default function StorefrontLayout({
    shop = null,
    event = null,
    cartItemCount = 0,
    cartSubtotal = 0,
    showBackButton = false,
    backTo = null,
    backLabel = "Back to Shop",
    children,
}) {
    const navigate = useNavigate();

    const isEventClosed = event && (event.isAcceptingOrders === false || event.queueStatus === "paused" || event.queueStatus === "closed");
    const shopSlug = shop?.slug || "";
    const cartUrl = event?.slug
        ? `/shop/${shopSlug}/cart?event=${event.slug || event.eventId || event.id}`
        : `/shop/${shopSlug}/cart`;

    return (
        <div className="min-h-screen bg-[#f8f9fc] text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-2xs transition-all">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    {/* Left: Back button or Brand */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        {showBackButton ? (
                            <button
                                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                                className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
                                aria-label="Go back"
                            >
                                <ArrowLeft size={18} />
                                <span className="hidden sm:inline">{backLabel}</span>
                            </button>
                        ) : (
                            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-500 text-white flex items-center justify-center shadow-xs shrink-0">
                                {shop?.logoUrl ? (
                                    <img
                                        src={shop.logoUrl}
                                        alt={shop.name}
                                        className="w-full h-full object-cover rounded-2xl"
                                    />
                                ) : (
                                    <Store size={18} />
                                )}
                            </div>
                        )}

                        <div className="truncate">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-sm font-black text-gray-900 truncate tracking-tight">
                                    {shop?.name || "Bazaar Storefront"}
                                </h1>
                                <span title="Verified Studio Seller">
                                    <ShieldCheck size={14} className="text-teal-600 shrink-0" />
                                </span>
                            </div>
                            {event ? (
                                <p className="text-[11px] font-bold text-teal-700 flex items-center gap-1 truncate">
                                    <MapPin size={11} className="shrink-0 text-teal-600" />
                                    <span>
                                        {event.name} {event.boothNumber && `• Booth ${event.boothNumber}`}
                                    </span>
                                </p>
                            ) : (
                                <p className="text-[11px] text-gray-400 font-medium truncate">
                                    Personalized 3D Prints & Clickers
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: Cart Button */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            to={cartUrl}
                            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all shadow-xs cursor-pointer ${
                                cartItemCount > 0
                                    ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20"
                                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                            }`}
                        >
                            <ShoppingBag size={16} />
                            <span className="hidden xs:inline">
                                {cartItemCount > 0 ? `₱${Number(cartSubtotal).toFixed(0)}` : "Cart"}
                            </span>
                            {cartItemCount > 0 && (
                                <span className="w-5 h-5 rounded-full bg-white text-teal-800 text-[10px] font-black flex items-center justify-center shadow-2xs">
                                    {cartItemCount}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>
            </header>

            {/* Event Paused / Closed Banner */}
            {isEventClosed && (
                <div className="bg-amber-500 text-white px-4 py-2.5 shadow-xs text-xs font-bold text-center flex items-center justify-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>
                        Ordering is temporarily paused for this booth. Please check with the booth staff for assistance.
                    </span>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 pb-24">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
                <div className="max-w-2xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 font-medium">
                        <Sparkles size={13} className="text-teal-600" />
                        <span>Powered by <strong className="text-gray-700 font-bold">KenCreations Bazaar Hub</strong></span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                        Scan-to-order • Real-time booth production
                    </p>
                </div>
            </footer>
        </div>
    );
}
