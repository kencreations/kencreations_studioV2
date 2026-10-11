import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAccess } from "../../contexts/AccessContext";
import { evaluateBazaarAccess } from "../../utils/licensePolicy";
import ActivateLicenseModal from "../UI/ActivateLicenseModal";
import PricingModal from "../UI/PricingModal";
import {
    Store,
    Calendar,
    ArrowLeft,
    Sparkles,
    Lock,
    Package,
    Layers,
    ClipboardList,
    LayoutDashboard,
    KeyRound,
    ShoppingBag,
    BarChart3,
} from "lucide-react";

export default function BazaarLayout({ children, activeTab = "dashboard" }) {
    const navigate = useNavigate();
    const { currentUser, loginWithGoogle } = useAuth();
    const access = useAccess();
    const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

    // License loading spinner (avoids flashing unauthorized gate while Firestore resolves)
    if (access?.status === "loading") {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-gray-400">Verifying Bazaar Hub Access...</p>
                </div>
            </div>
        );
    }

    // Authoritative Bazaar Hub Entitlement Policy Evaluation
    const bazaarDecision = access?.evaluateBazaar
        ? access.evaluateBazaar()
        : evaluateBazaarAccess(access);

    // Any valid active license on the account grants Studio Pro / Bazaar Hub access
    const isAuthorized = Boolean(
        bazaarDecision?.allowed ||
        (access?.hasActiveLicense &&
            (access?.active || []).every(
                (l) => String(l.tier || l.tier_id || l.plan_type || l.plan || "").toLowerCase() !== "maker",
            ))
    );

    // Unauthenticated State
    if (!currentUser && !window.electronAPI) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6">
                    <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
                        <Lock size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            Bazaar Hub Authentication
                        </h2>
                        <p className="text-sm text-gray-500 mt-2">
                            Please sign in with your Google account to access your personalized seller dashboard and event booth tools.
                        </p>
                    </div>
                    <button
                        onClick={loginWithGoogle}
                        className="w-full py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        Sign In with Google
                    </button>
                    <Link
                        to="/studio"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <ArrowLeft size={14} /> Back to Studio Hub
                    </Link>
                </div>
            </div>
        );
    }

    // Access Denied / Upgrade Required State
    if (!isAuthorized) {
        const isExpired = bazaarDecision.state === "expired" || access?.hasExpired;
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                        <Store size={32} />
                    </div>
                    <div>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 mb-2">
                            <Sparkles size={12} className="text-amber-500" /> Commercial Feature
                        </span>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            {isExpired ? "Subscription Expired" : "Bazaar Hub Subscription Required"}
                        </h2>
                        <p className="text-sm text-gray-500 mt-2">
                            KenCreations Bazaar Hub is an in-person point-of-sale and event ordering hub reserved for Commercial, Studio Pro, and VIP subscribers.
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left text-xs space-y-2">
                        <div className="flex justify-between text-gray-600">
                            <span>Account:</span>
                            <span className="font-bold text-gray-800">{currentUser?.email || "Signed In"}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Access Status:</span>
                            <span className="font-bold text-amber-600">
                                {isExpired ? "Subscription Expired" : "Active License Required"}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => setIsActivateModalOpen(true)}
                            className="w-full py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <KeyRound size={16} /> Activate License Key
                        </button>
                        <button
                            onClick={() => setIsPricingModalOpen(true)}
                            className="w-full py-3 px-6 rounded-2xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm border border-gray-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Sparkles size={16} className="text-amber-500" /> Upgrade to Studio Pro
                        </button>
                        <Link
                            to="/studio"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors pt-1"
                        >
                            <ArrowLeft size={14} /> Return to Studio Hub
                        </Link>
                    </div>

                    <ActivateLicenseModal
                        isOpen={isActivateModalOpen}
                        onClose={() => setIsActivateModalOpen(false)}
                    />
                    <PricingModal
                        isOpen={isPricingModalOpen}
                        onClose={() => setIsPricingModalOpen(false)}
                    />
                </div>
            </div>
        );
    }

    const navTabs = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/studio/bazaar" },
        { id: "shop", label: "Shop Profile", icon: Store, path: "/studio/bazaar/shop" },
        { id: "products", label: "Products", icon: Package, path: "/studio/bazaar/products" },
        { id: "inventory", label: "Inventory", icon: Layers, path: "/studio/bazaar/inventory" },
        { id: "events", label: "Events & Bazaars", icon: Calendar, path: "/studio/bazaar/events" },
        { id: "orders", label: "Orders Queue", icon: ShoppingBag, path: "/studio/bazaar/orders" },
        { id: "reports", label: "Reports & Profit", icon: BarChart3, path: "/studio/bazaar/reports" },
    ];

    return (
        <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans">
            {/* Top Navigation Header */}
            <header className="bg-white border-b border-gray-100 px-6 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/studio")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200/80 transition-all cursor-pointer"
                        title="Return to Studio Hub"
                    >
                        <ArrowLeft size={15} />
                        <span className="hidden sm:inline">Studio Hub</span>
                    </button>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                            <Store size={18} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none flex items-center gap-1.5">
                                Bazaar Hub
                                <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                                    POS & Events
                                </span>
                            </h1>
                            <span className="text-[11px] text-gray-400 font-medium">
                                In-Person Retail & QR Ordering
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Profile & Badge */}
                <div className="flex items-center gap-3">
                    <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200/60">
                        <Sparkles size={11} /> {bazaarDecision.reason || "Subscriber"}
                    </span>
                    {currentUser && (
                        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                            <img
                                src={
                                    currentUser.photoURL ||
                                    `https://ui-avatars.com/api/?name=${currentUser.displayName || "Seller"}&background=14b8a6&color=fff`
                                }
                                alt="User"
                                className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                            />
                            <div className="text-left hidden lg:block">
                                <span className="text-xs font-bold text-gray-800 block truncate max-w-[120px]">
                                    {currentUser.displayName || "Seller"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Sub-Navigation Tabs Bar */}
            <div className="bg-white border-b border-gray-100 px-6 sm:px-8 sticky top-[57px] z-30">
                <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar">
                    {navTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <Link
                                key={tab.id}
                                to={tab.path}
                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                                    isActive
                                        ? "bg-teal-50 text-teal-700 shadow-xs border border-teal-200/60"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                            >
                                <Icon size={15} className={isActive ? "text-teal-600" : "text-gray-400"} />
                                <span>{tab.label}</span>
                            </Link>
                        );
                    })}

                    <div className="h-4 w-px bg-gray-200 mx-2" />

                    {/* Milestone 5-6 Preview Shortcuts */}
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-400 bg-gray-50 border border-dashed border-gray-200 cursor-not-allowed">
                        <ClipboardList size={13} /> Order Queue <span className="text-[10px] text-gray-400 font-mono">M5</span>
                    </span>
                </div>
            </div>

            {/* Main Content View */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8">
                {children}
            </main>
        </div>
    );
}
