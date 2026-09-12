import React, { useState, useEffect } from "react";
import { useGenerators } from "../hooks/useGenerators";
import { useNavigate } from "react-router-dom";
import { Wrench, Clock, Sparkles } from "lucide-react";
import HeroScene from "../components/HeroScene";
import LegalModal from "../components/UI/LegalModal";
import ExclusiveModal from "../components/UI/ExclusiveModal";
import PricingModal from "../components/UI/PricingModal";
import mockBootstrap from "../data/mockBootstrap.json";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * DesktopHome — Main launcher screen for the Electron desktop app.
 *
 * Receives `entitlements` from App.jsx (populated from the local license DB
 * and kept live by the SyncWorker). Uses `getAccessibleEditors()` to filter
 * the editor list — exclusive editors not in the entitlements array are
 * shown as locked cards instead of being hidden entirely.
 *
 * @param {{ entitlements: string[] }} props
 */
export default function DesktopHome({ entitlements = [] }) {
    const navigate = useNavigate();
    const [legalDoc, setLegalDoc] = useState(null);
    const [selectedExclusive, setSelectedExclusive] = useState(null);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

    const isLicensed = entitlements && entitlements.length > 0;

    const [editors, setEditors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [promoAllAccess, setPromoAllAccess] = useState(false);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [disable3D, setDisable3D] = useState(false);

    useEffect(() => {
        setDisable3D(localStorage.getItem("kc_pref_disable_3d") === "true");
    }, []);

    useEffect(() => {
        const fetchEditors = async () => {
            try {
                // 1. Fetch Global Promo Settings
                let isPromoValid = false;
                try {
                    const promoDoc = await getDoc(doc(db, "app_settings", "global"));
                    if (promoDoc.exists()) {
                        const promoData = promoDoc.data();
                        const isActive = promoData.promo_all_access === true;
                        const expiry = promoData.promo_expiry;

                        isPromoValid = isActive;

                        // Check if the current time is past the expiry date
                        if (isActive && expiry) {
                            if (new Date() > new Date(expiry)) {
                                isPromoValid = false; // Promo has expired!
                            }
                        }

                        setPromoAllAccess(isPromoValid);
                        localStorage.setItem("kc_offline_promo", JSON.stringify(isPromoValid));
                        
                        // Show the announcement modal if the promo is currently active and valid
                        if (isPromoValid) {
                            setShowPromoModal(true);
                        }
                    }
                } catch (configErr) {
                    console.error("Could not fetch promo settings:", configErr);
                }

                // 2. Fetch live generators data
                const querySnapshot = await getDocs(collection(db, "generators"));
                const fetchedEditors = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                    // Force strict boolean coercion
                    isExclusive: doc.data().is_exclusive === true || doc.data().isExclusive === true,
                    link: `/editor/${doc.id}`,
                }));

                fetchedEditors.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                // 3. Save to device
                localStorage.setItem("kc_offline_generators", JSON.stringify(fetchedEditors));
                setEditors(fetchedEditors);
                
            } catch (error) {
                console.error("No Wi-Fi or Firebase Error. Loading offline cache...");
                
                // OFFLINE FALLBACK: Load Promo
                const cachedPromo = localStorage.getItem("kc_offline_promo");
                if (cachedPromo) setPromoAllAccess(JSON.parse(cachedPromo));

                // OFFLINE FALLBACK: Load Generators
                const cachedData = localStorage.getItem("kc_offline_generators");
                if (cachedData) setEditors(JSON.parse(cachedData));
            } finally {
                setIsLoading(false);
            }
        };
        fetchEditors();
    }, []);

    // Temporary basic check until accessControl.js is fully integrated
    const accessibleIds = new Set(
        editors.filter((e) =>
            promoAllAccess || // <-- THE MAGIC UNLOCK FIX
            !e.isExclusive ||
            entitlements.includes(e.id) ||
            (isLicensed && (entitlements.includes("vip") || entitlements.includes("lifetime")))
        ).map((e) => e.id)
    );

    const sortedGenerators = [...editors].sort((a, b) => {
        const aUnlocked = !a.isExclusive || accessibleIds.has(a.id);
        const bUnlocked = !b.isExclusive || accessibleIds.has(b.id);

        if (aUnlocked === bUnlocked) return a.sort_order - b.sort_order;
        return aUnlocked ? -1 : 1;
    });

    const handleCardClick = (generator) => {
        const isAccessible = accessibleIds.has(generator.id);
        if (generator.isExclusive && !isAccessible) {
            setSelectedExclusive(generator); // Opens the up-sell modal
            return;
        }
        navigate(generator.link);
    };

    return (
        <div className="relative h-screen w-screen overflow-hidden font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fff0e5] via-teal-100 to-[#00A3A3]">
            {/* Interactive 3D Background */}
            {!disable3D && <HeroScene />}

            {/* Foreground UI Layer */}
            <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto overflow-x-hidden pointer-events-none">
                {/* Top Nav */}
                <nav className="sticky top-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 w-full flex items-center justify-between px-6 py-6 pointer-events-auto">
                    <div className="flex items-center space-x-2">
                        <div className="text-xl font-black tracking-tighter">
                            <span className="text-gray-900">K</span>
                            <span className="text-gray-900">C</span>
                            <span className="ml-2 text-gray-900 font-bold tracking-normal text-lg">
                                KENCREATIONS
                            </span>
                        </div>
                        <span className="text-xs bg-white/40 backdrop-blur-md text-gray-800 font-bold px-2 py-0.5 rounded-full border border-white/50">
                            PRO EDITION
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={(e) => {
                                if (!isLicensed) {
                                    e.preventDefault();
                                    setIsPricingModalOpen(true);
                                } else {
                                    navigate("/studio");
                                }
                            }}
                            className="bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/60 text-gray-800 font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2">
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                            </svg>
                            Studio Hub
                        </button>
                        <button
                            onClick={() => navigate("/profile")}
                            className="bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/60 text-gray-800 font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2">
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                            </svg>
                            Profile
                        </button>
                    </div>
                </nav>

                {/* Hero Section */}
                <main className="flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-32 text-center pointer-events-auto">
                    {/* License Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl text-gray-800 text-xs font-semibold px-4 py-1.5 rounded-full border border-white shadow-xl shadow-teal-900/10 mb-8 transition-transform hover:scale-105 cursor-default">
                        <span className="text-lg leading-none">✅</span>
                        Pro License Activated
                    </div>

                    <h1 className="text-6xl md:text-8xl font-bold text-gray-900 tracking-tighter mb-6 max-w-4xl leading-[1.05]">
                        Welcome to your Studio.
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-700 font-medium leading-relaxed mb-10">
                        Select an editor below to start creating 3D models right
                        from your desktop.
                    </p>
                </main>

                {/* Generator Cards Grid */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center h-full w-full pointer-events-auto pb-12">
                        <div className="text-gray-900 text-xl font-bold animate-pulse">
                            Loading Studio...
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-7xl mx-auto px-6 pb-12 pointer-events-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {sortedGenerators.map((editor) => {
                                const isAccessible = accessibleIds.has(editor.id);
                                
                                const rawStatus = editor.status ? editor.status.toLowerCase() : "";
                                const isMaintenance = rawStatus === "maintenance" || rawStatus === "under upgrade";
                                const isComingSoon = rawStatus === "coming soon" || rawStatus === "coming_soon";
                                const isBeta = rawStatus === "beta";
                                const isStable = rawStatus === "stable";
                                
                                // DEVELOPER BACKDOOR: Check if the user is an admin by entitlement or name
                                const currentUser = localStorage.getItem("kc_user_name") || "";
                                const isAdmin = entitlements.includes("admin") || currentUser.includes("Ken Samonte") || currentUser.includes("KenCreations");

                                // UPDATE: Ensure admins bypass the VIP/Exclusive paywall entirely!
                                const isLocked = editor.isExclusive && !isAccessible && !isAdmin;

                                // ONLY disable the button if they are NOT an admin
                                const isDisabled = (isMaintenance || isComingSoon) && !isAdmin;

                                return (
                                    <div
                                        key={editor.id}
                                        onClick={() =>
                                            !isDisabled &&
                                            handleCardClick(editor)
                                        }
                                        className={`group flex flex-col relative rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md border border-white/40 shadow-xl transition-transform ${
                                            !isDisabled
                                                ? "hover:-translate-y-1 cursor-pointer"
                                                : ""
                                        }`}>
                                        {/* Top Image Container */}
                                        <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                                            <img
                                                src={`./thumbnails/${editor.id}.png`}
                                                alt=""
                                                className="h-44 w-full object-cover bg-gradient-to-br from-teal-500/20 to-orange-500/20"
                                                onError={(e) => {
                                                    // If the local file is missing, show the transparent fallback
                                                    e.target.onerror = null;
                                                    e.target.src =
                                                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                                                    e.target.className =
                                                        "h-44 w-full bg-gradient-to-br from-teal-500/30 to-orange-500/30";
                                                }}
                                            />

                                            {/* Status & VIP Badges */}
                                            <div className="absolute top-3 right-3 flex flex-col gap-2 items-end z-10">
                                                {editor.isExclusive && (
                                                    <div className="bg-secondary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-secondary/50">
                                                        VIP
                                                    </div>
                                                )}
                                                {isBeta && (
                                                    <div className="bg-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md border border-secondary/30 backdrop-blur-md">
                                                        BETA
                                                    </div>
                                                )}
                                            </div>

                                            {/* Overlays */}
                                            {isMaintenance && (
                                                <div className="absolute inset-0 backdrop-blur-sm bg-neutral-900/70 flex flex-col items-center justify-center z-20">
                                                    <Wrench
                                                        className="text-white mb-2"
                                                        size={32}
                                                    />
                                                    <span className="text-white font-bold tracking-wider uppercase text-sm">
                                                        Under Maintenance
                                                    </span>
                                                </div>
                                            )}
                                            {isComingSoon && (
                                                <div className="absolute inset-0 backdrop-blur-md bg-neutral-900/60 flex flex-col items-center justify-center z-20">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock
                                                            className="text-teal-400"
                                                            size={24}
                                                        />
                                                        <Sparkles
                                                            className="text-yellow-400"
                                                            size={24}
                                                        />
                                                    </div>
                                                    <span className="text-white font-bold tracking-wider uppercase text-sm">
                                                        Coming Soon
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-5 flex flex-col flex-grow bg-transparent">
                                            <h3 className="text-lg font-black text-gray-900 mb-1 leading-tight">
                                                {editor.title}
                                            </h3>
                                            <p className="text-sm text-gray-600 font-medium line-clamp-2 flex-1 mb-4">
                                                {editor.description}
                                            </p>

                                            {isLocked ? (
                                                <button className="w-full bg-gray-100 text-gray-500 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 hover:bg-gray-200 shadow-inner">
                                                    <span>🔒</span> Unlock
                                                </button>
                                            ) : (
                                                <button
                                                    disabled={isDisabled}
                                                    className={`w-full font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                                                        isDisabled
                                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                            : "bg-primary hover:bg-primary/90 text-white hover:shadow-lg hover:-translate-y-0.5"
                                                    }`}>
                                                    {isDisabled
                                                        ? (isComingSoon ? "Coming Soon" : "Unavailable")
                                                        : ((isMaintenance || isComingSoon) && isAdmin ? "🔧 Test Mode (Admin) →" : "Launch Generator →")}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* NEW FOOTER LAYOUT */}
                <footer className="w-full flex items-center justify-center py-6 pointer-events-auto mt-auto">
                    <div className="flex items-center gap-4 text-xs font-semibold text-gray-500/70">
                        <button
                            onClick={() => setLegalDoc("terms")}
                            className="hover:text-gray-800 transition-colors">
                            Terms & Commercial License
                        </button>
                        <span>|</span>
                        <button
                            onClick={() => setLegalDoc("privacy")}
                            className="hover:text-gray-800 transition-colors">
                            Privacy Policy
                        </button>
                        <span>|</span>
                        <button
                            onClick={() => setLegalDoc("refund")}
                            className="hover:text-gray-800 transition-colors">
                            Refund Policy
                        </button>
                    </div>
                </footer>
            </div>

            <LegalModal
                isOpen={!!legalDoc}
                documentType={legalDoc}
                onClose={() => setLegalDoc(null)}
            />

            <ExclusiveModal
                isOpen={!!selectedExclusive}
                onClose={() => setSelectedExclusive(null)}
                generatorName={selectedExclusive?.title}
                isLicensed={entitlements && entitlements.length > 0}
                onUpgradeClick={() => {
                    setSelectedExclusive(null);
                    setIsPricingModalOpen(true);
                }}
            />

            <PricingModal
                isOpen={isPricingModalOpen}
                onClose={() => setIsPricingModalOpen(false)}
            />

            {/* PROMO ANNOUNCEMENT MODAL */}
            {showPromoModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative overflow-hidden text-center animate-in fade-in zoom-in duration-300">
                        {/* Decorative Top Bar */}
                        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-secondary to-primary"></div>
                        
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                            🎉
                        </div>
                        
                        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">All-Access Unlocked!</h2>
                        <p className="text-gray-600 mb-8 font-medium text-lg leading-relaxed">
                            Enjoy unlimited access to <span className="text-secondary font-bold">ALL VIP and Exclusive generators</span> for a limited time.
                        </p>
                        
                        <button 
                            onClick={() => setShowPromoModal(false)}
                            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-xl hover:-translate-y-1 text-lg"
                        >
                            Start Creating Now
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
