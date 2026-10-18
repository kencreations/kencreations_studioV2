import { useState } from "react";
import { useGenerators } from "../hooks/useGenerators";
import { useAccess } from "../contexts/AccessContext";
import { catalogStats, exportTotal } from "../utils/generatorCatalog";
import { useNavigate } from "react-router-dom";
import {
    Wrench,
    Clock,
    Sparkles,
    Download,
    Boxes,
    Box,
} from "lucide-react";
import LegalModal from "../components/UI/LegalModal";
import ExclusiveModal from "../components/UI/ExclusiveModal";
import PricingModal from "../components/UI/PricingModal";
import Navbar from "../components/Navbar";

// ─── Skeleton Card ────────────────────────────────────────────────────────────
/**
 * Shown while the Firebase editor list is loading.
 * Matches the exact dimensions of a real generator card so the layout
 * doesn't jump when content arrives.
 */
function SkeletonCard() {
    return (
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] animate-pulse flex flex-col min-h-[300px]">
            {/* Thumbnail placeholder */}
            <div className="h-[200px] w-full bg-gray-100" />
            {/* Body placeholder */}
            <div className="p-4 flex flex-col gap-3 bg-white">
                <div className="h-4 w-3/4 rounded-md bg-gray-200" />
                <div className="h-3 w-full rounded-md bg-gray-100" />
                <div className="h-3 w-2/3 rounded-md bg-gray-100" />
                <div className="h-6 w-24 rounded-md bg-gray-100 mt-2" />
            </div>
        </div>
    );
}

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
export default function DesktopHome({ isWeb = false }) {
    const navigate = useNavigate();
    const access = useAccess();
    const { generators: editors, isLoading, status: catalogStatus } = useGenerators();
    const [accessMessage, setAccessMessage] = useState("");
    const [legalDoc, setLegalDoc] = useState(null);
    const [selectedExclusive, setSelectedExclusive] = useState(null);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

    const isLicensed = access.hasActiveLicense;
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");


    const { availableCount: activeGeneratorsCount, totalExports: globalExports, visible: visibleEditors } = catalogStats(editors, { isReady: catalogStatus === 'ready' });
    const accessibleIds = new Set(editors.filter(editor => access.evaluate(editor).allowed).map(editor => editor.id));

    const categories = [
        "All",
        "Keychains",
        "Tags",
        "Toppers",
        "Keyboard",
        "Signs",
        "Others",
    ];

    const sortedGenerators = [...visibleEditors]
        .filter((editor) => {
            if (activeCategory !== "All") {
                // Mock logic for category filtering - in real life would use editor.category
                const cat = activeCategory.toLowerCase();
                const title = editor.title.toLowerCase();
                if (cat === "keychains" && !title.includes("keychain"))
                    return false;
                if (cat === "tags" && !title.includes("tag")) return false;
                if (cat === "toppers" && !title.includes("topper"))
                    return false;
                if (
                    cat === "keyboard" &&
                    !(
                        title.includes("keycap") ||
                        title.includes("macropad") ||
                        title.includes("clicker")
                    )
                )
                    return false;
                if (
                    cat === "signs" &&
                    !title.includes("standee") &&
                    !title.includes("nameplate")
                )
                    return false;
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    editor.title.toLowerCase().includes(q) ||
                    editor.description.toLowerCase().includes(q)
                );
            }
            return true;
        })
        .sort((a, b) => {
            const aUnlocked = accessibleIds.has(a.id);
            const bUnlocked = accessibleIds.has(b.id);

            if (aUnlocked === bUnlocked) return (a.sort_order || 0) - (b.sort_order || 0);
            return aUnlocked ? -1 : 1;
        });

    const handleCardClick = (generator) => {
        const decision = access.evaluate(generator);
        if (catalogStatus !== 'ready' && !window.electronAPI || decision.state === 'loading' || decision.state === 'error') {
            setAccessMessage(decision.state === 'loading' || catalogStatus === 'loading' ? 'Verifying access…' : 'Unable to verify access. Check your connection and retry.');
            return;
        }
        if (!decision.allowed) {
            if (decision.reason === 'UNAVAILABLE') setAccessMessage('This generator is currently unavailable.');
            else setSelectedExclusive(generator);
            return;
        }
        setAccessMessage('');
        navigate(generator.link);
    };

    return (
        <div className="relative h-screen w-screen overflow-hidden font-sans bg-[#f8f9fc]">
            {/* Foreground UI Layer */}
            <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto overflow-x-hidden pointer-events-auto">
                {/* Top Nav — drag region for frameless window */}
                <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    isLicensed={isLicensed}
                    onPricingClick={() => {
                        if (!isLicensed) setIsPricingModalOpen(true);
                        else navigate("/studio");
                    }}
                />

                <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 pt-8 pb-32">
                    {/* Hero Section */}
                    <div className="w-full bg-white rounded-3xl p-8 mb-10 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col md:flex-row gap-8 items-center justify-between">
                        <div className="flex-1 space-y-6">
                            <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1]">
                                Choose. Create.{" "}
                                <span className="text-[#14b8a6]">Print.</span>
                            </h1>
                            <p className="text-lg text-gray-500 max-w-md leading-relaxed">
                                Select a generator, customize your model, and
                                export STL or 3MF files for your next 3D
                                printing project.
                            </p>
                            <div className="flex gap-4 pt-2">
                                <button className="bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-sm flex items-center gap-2">
                                    Browse models{" "}
                                    <span className="text-xl leading-none">
                                        →
                                    </span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-8 pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-teal-50 text-teal-600 p-2 rounded-lg">
                                        <Download size={20} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div className="text-gray-900 font-black text-lg leading-tight">
                                            {globalExports !== null
                                                ? globalExports.toLocaleString()
                                                : "---"}
                                        </div>
                                        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                                            Total exports
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-teal-50 text-teal-600 p-2 rounded-lg">
                                        <Boxes size={20} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div className="text-gray-900 font-black text-lg leading-tight">
                                            {activeGeneratorsCount}
                                        </div>
                                        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                                            3D generators
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-teal-50 text-teal-600 p-2 rounded-lg">
                                        <Box size={20} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div className="text-gray-900 font-black text-lg leading-tight">
                                            STL · 3MF
                                        </div>
                                        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                                            Export formats
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hero Image Collage */}
                        <div className="hidden md:flex flex-1 relative h-[320px] rounded-2xl overflow-hidden bg-gray-50 justify-center items-center">
                            {/* Placeholder for collage */}
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-orange-50 opacity-50"></div>
                            <div className="relative z-10 flex gap-4 p-6">
                                <div className="w-48 h-48 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center -rotate-6 transform hover:rotate-0 transition-transform duration-500 overflow-hidden">
                                    <img
                                        src="thumbnails/monograminsert.png"
                                        alt="Monogram Insert 3D Preview"
                                        className="w-full h-full object-contain p-2"
                                    />
                                </div>
                                <div className="w-56 h-40 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center justify-center rotate-3 transform translate-y-8 hover:rotate-0 transition-transform duration-500 overflow-hidden relative">
                                    <img
                                        src="thumbnails/namekeychain.png"
                                        alt="Name Keychain 3D Preview"
                                        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Community/Growth Banners */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        {/* Card 1: Dynamic Subscription Status */}
                        {!isLicensed ? (
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-gray-900 font-bold">
                                        <Sparkles
                                            size={16}
                                            className="text-teal-500"
                                        />{" "}
                                        Unlock everything
                                    </div>
                                    <p className="text-sm text-gray-500 leading-relaxed mb-4">
                                        Full export and all designers with a PRO
                                        license.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() =>
                                            setIsPricingModalOpen(true)
                                        }
                                        className="bg-teal-500 hover:bg-teal-600 transition-colors text-white text-xs font-bold px-4 py-2 rounded-full">
                                        View pricing
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute -right-6 -top-6 w-24 h-24 bg-teal-500/10 rounded-full blur-xl"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2 text-white font-bold">
                                        <Sparkles
                                            size={16}
                                            className="text-teal-400"
                                        />{" "}
                                        {access.isVip
                                            ? "VIP All-Access Active"
                                            : access.tier === "pro_plus"
                                            ? "Pro+ Lifetime Active"
                                            : access.tier === "pro"
                                            ? "Studio Pro Active"
                                            : access.tier === "basic"
                                            ? "Basic Plan Active"
                                            : "Active License"}
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                                        {access.isVip
                                            ? "Your VIP lifetime pass gives you all-inclusive access to all tools and hubs."
                                            : access.tier === "pro_plus"
                                            ? "Your lifetime Pro+ license gives you permanent access to all Pro tools and hubs."
                                            : access.tier === "pro"
                                            ? "Your Pro subscription includes all Premium tools, Studio Hub, and Bazaar Hub."
                                            : access.tier === "basic"
                                            ? "Your Basic commercial license gives you full print sales rights for basic tools."
                                            : "Your commercial license is active. You have commercial export rights."}
                                    </p>
                                </div>
                                <div className="flex gap-2 relative z-10">
                                    <div className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold px-4 py-2 rounded-full cursor-default uppercase tracking-wider">
                                        {access.isVip ? "VIP" : access.tier?.replace("_", "+") || "Active"}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Card 2: Desktop Application Promo */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-gray-900 font-bold">
                                    <Download
                                        size={16}
                                        className="text-teal-500"
                                    />{" "}
                                    Get the Desktop App
                                </div>
                                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                                    Download KenCreations Studio for Windows for
                                    hardware-bound licenses and faster local
                                    performance.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href="https://kencreations.com/download"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1">
                                    Download for Windows
                                </a>
                            </div>
                        </div>

                        {/* Card 3: Request a Tool / Support */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-gray-900 font-bold">
                                    <Wrench
                                        size={16}
                                        className="text-teal-500"
                                    />{" "}
                                    Need a specific generator?
                                </div>
                                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                                    Can't find what you need? Request a custom
                                    3D generator and we might add it to the
                                    Studio.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() =>
                                        console.log("Request Tool clicked")
                                    }
                                    className="bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-100 transition-colors">
                                    Request Tool
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-6 custom-scrollbar">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-all ${
                                    activeCategory === cat
                                        ? "bg-[#14b8a6] text-white shadow-md shadow-teal-500/20"
                                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                                }`}>
                                {cat}
                            </button>
                        ))}
                    </div>

                    {accessMessage && <p role="status" className="mb-4 text-teal-700">{accessMessage}</p>}
                    {catalogStatus === "error" && <p role="status">Live generator data is unavailable. Please check your connection.</p>}
                    {/* Generator Cards Grid */}
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <SkeletonCard key={i} />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {sortedGenerators.map((editor) => {
                                const rawStatus = editor.status
                                    ? editor.status.toLowerCase()
                                    : "";
                                const isMaintenance =
                                    rawStatus === "maintenance" ||
                                    rawStatus === "under maintenance" ||
                                    rawStatus === "under upgrade";
                                const isComingSoon =
                                    rawStatus === "coming soon" ||
                                    rawStatus === "coming_soon";
                                const isBeta = rawStatus === "beta";
                                const isUpdated = editor.isRecentlyUpdated === true;

                                const decision = access.evaluate(editor);
                                const isDisabled = decision.reason === 'UNAVAILABLE';
                                const isLocked = decision.state === 'unauthorized' && !isDisabled;
                                const isDevPreview = decision.developerPreview === true;
                                const rawExportCount = exportTotal(editor);
                                const exportCount = catalogStatus === 'ready' ? (rawExportCount ?? 0) : rawExportCount;

                                return (
                                    <div
                                        key={editor.id}
                                        onClick={() =>
                                            !isDisabled &&
                                            handleCardClick(editor)
                                        }
                                        className={`
                                            group flex flex-col relative rounded-2xl overflow-hidden
                                            bg-white border border-gray-100
                                            shadow-[0_2px_12px_rgba(0,0,0,0.04)]
                                            transition-all duration-300 ease-out
                                            ${!isDisabled ? "hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:scale-[1.02] cursor-pointer" : "opacity-60 cursor-not-allowed"}
                                        `}>
                                        {/* Top Image Container */}
                                        <div className="relative h-[200px] w-full bg-gray-100 overflow-hidden">
                                            <img
                                                src={`./thumbnails/${editor.id}.png`}
                                                alt=""
                                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src =
                                                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                                                    e.target.className =
                                                        "h-full w-full bg-gradient-to-br from-gray-100 to-gray-200";
                                                }}
                                            />

                                            {/* Status & Category Badges */}
                                            <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
                                                {editor.category === "exclusive" ? (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md shadow-sm border border-white/40 backdrop-blur-md">
                                                            Exclusive
                                                        </div>
                                                        <div className="bg-slate-900/80 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm backdrop-blur-md border border-white/20">
                                                            {typeof editor.purchasePricePHP === "number" && editor.purchasePricePHP > 0
                                                                ? `₱${editor.purchasePricePHP.toLocaleString("en-PH")}`
                                                                : "Config Pending"}
                                                        </div>
                                                    </div>
                                                ) : editor.category === "premium" ? (
                                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-sm border border-white/40 backdrop-blur-md">
                                                        Premium
                                                    </div>
                                                ) : null}
                                                {isBeta && (
                                                    <div className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-white/50 backdrop-blur-md">
                                                        Beta
                                                    </div>
                                                )}
                                                {isDevPreview && (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <div className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm border border-amber-200 backdrop-blur-md">
                                                            Developer Preview
                                                        </div>
                                                        {isComingSoon && (
                                                            <div className="bg-teal-900/80 text-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-teal-500/40 backdrop-blur-md">
                                                                Coming Soon
                                                            </div>
                                                        )}
                                                        {isMaintenance && (
                                                            <div className="bg-orange-950/80 text-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-orange-500/40 backdrop-blur-md">
                                                                Under Maintenance
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur text-gray-900 w-8 h-8 rounded-full flex items-center justify-center shadow-md">
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                            </div>

                                            {/* Overlays */}
                                            {isMaintenance && !isDevPreview && (
                                                <div className="absolute inset-0 backdrop-blur-sm bg-white/70 flex flex-col items-center justify-center z-20">
                                                    <Wrench
                                                        className="text-gray-800 mb-2"
                                                        size={24}
                                                    />
                                                    <span className="text-gray-900 font-bold text-xs uppercase">
                                                        Under Maintenance
                                                    </span>
                                                </div>
                                            )}
                                            {isComingSoon && !isDevPreview && (
                                                <div className="absolute inset-0 backdrop-blur-sm bg-white/70 flex flex-col items-center justify-center z-20">
                                                    <Clock
                                                        className="text-teal-600 mb-2"
                                                        size={24}
                                                    />
                                                    <span className="text-gray-900 font-bold text-xs uppercase">
                                                        Coming Soon
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-4 flex flex-col flex-grow bg-white">
                                            <h3 className="text-base font-black text-gray-900 mb-1 leading-tight group-hover:text-[#14b8a6] transition-colors">
                                                {editor.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-medium line-clamp-2 flex-1 mb-2">
                                                {editor.description}
                                            </p>

                                            {isDevPreview && (
                                                <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200/70 text-[10px] text-amber-900 leading-tight">
                                                    <span className="font-bold">Developer Preview:</span> This generator is not publicly released. Features may be incomplete or unstable.
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1 text-[#14b8a6] font-bold text-xs bg-teal-50/50 w-fit px-2 py-1 rounded-md border border-teal-100/50">
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line
                                                        x1="12"
                                                        x2="12"
                                                        y1="15"
                                                        y2="3"
                                                    />
                                                </svg>
                                                {exportCount == null ? "—" : exportCount.toLocaleString()} exports
                                            </div>

                                            {isLocked && (
                                                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="bg-white text-gray-900 font-bold text-xs px-4 py-2 rounded-full shadow-xl flex items-center gap-1.5 border border-gray-100">
                                                        <span>🔒</span> {editor.category === "exclusive" ? (typeof editor.purchasePricePHP === "number" && editor.purchasePricePHP > 0 ? `Unlock (₱${editor.purchasePricePHP.toLocaleString("en-PH")})` : "Unlock Exclusive") : "Unlock with Pro"}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

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
                generator={selectedExclusive}
                isLicensed={isLicensed}
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

                        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
                            All-Access Unlocked!
                        </h2>
                        <p className="text-gray-600 mb-8 font-medium text-lg leading-relaxed">
                            Enjoy unlimited access to{" "}
                            <span className="text-secondary font-bold">
                                ALL VIP and Exclusive generators
                            </span>{" "}
                            for a limited time.
                        </p>

                        <button
                            onClick={() => setShowPromoModal(false)}
                            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-xl hover:-translate-y-1 text-lg">
                            Start Creating Now
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
