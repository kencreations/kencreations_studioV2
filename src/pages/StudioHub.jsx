import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAccess } from "../contexts/AccessContext";
import {
    getFilaments,
    addFilament,
    updateFilament,
    deleteFilament,
    getConsumables,
    addConsumable,
    updateConsumable,
    deleteConsumable,
    getPrinterProfiles,
    getCostEstimates,
    getPrintJobs,
    createPrintJob,
    updatePrintJob,
    deletePrintJob,
    completePrintJob,
    revertPrintJobDeduction,
    getQuotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    getSales,
    recordSale,
    updateSale,
    deleteSale,
    getInventoryMovements,
} from "../services/studioService";

// Tab Components
import OverviewTab from "../components/studio/tabs/OverviewTab";
import FilamentsTab from "../components/studio/tabs/FilamentsTab";
import ConsumablesTab from "../components/studio/tabs/ConsumablesTab";
import CostCalculatorTab from "../components/studio/tabs/CostCalculatorTab";
import PrintJobsTab from "../components/studio/tabs/PrintJobsTab";
import QuotationsTab from "../components/studio/tabs/QuotationsTab";
import SalesTab from "../components/studio/tabs/SalesTab";
import AnalyticsTab from "../components/studio/tabs/AnalyticsTab";

// Modals
import FilamentModal from "../components/studio/FilamentModal";
import ConsumableModal from "../components/studio/ConsumableModal";
import StockAdjustModal from "../components/studio/StockAdjustModal";
import PrinterProfileModal from "../components/studio/PrinterProfileModal";
import PrintJobModal from "../components/studio/PrintJobModal";
import QuotationModal from "../components/studio/QuotationModal";
import QuotationPrintView from "../components/studio/QuotationPrintView";
import SaleModal from "../components/studio/SaleModal";
import CsvModal from "../components/studio/CsvModal";
import PricingModal from "../components/UI/PricingModal";
import ActivateLicenseModal from "../components/UI/ActivateLicenseModal";

// Icons
import {
    Layers,
    Package,
    Calculator,
    Printer,
    FileText,
    TrendingUp,
    BarChart2,
    Activity,
    ArrowLeft,
    Sparkles,
    Lock,
    AlertCircle,
    RotateCw,
    Wrench,
    Store,
} from "lucide-react";

// Tab Definitions
const TABS = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "filaments", label: "Filaments", icon: Layers },
    { id: "consumables", label: "Consumables", icon: Package },
    { id: "calculator", label: "Cost Calculator", icon: Calculator },
    { id: "jobs", label: "Print Jobs", icon: Printer },
    { id: "quotations", label: "Quotations", icon: FileText },
    { id: "sales", label: "Sales & Profit", icon: TrendingUp },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
];

export default function StudioHub() {
    const navigate = useNavigate();
    const { currentUser, loginWithGoogle } = useAuth();
    const access = useAccess();

    const [activeTab, setActiveTab] = useState("overview");

    // Primary State
    const [filaments, setFilaments] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [printerProfiles, setPrinterProfiles] = useState([]);
    const [printJobs, setPrintJobs] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [sales, setSales] = useState([]);
    const [movements, setMovements] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    // Modal Control State
    const [isFilamentModalOpen, setIsFilamentModalOpen] = useState(false);
    const [editingFilament, setEditingFilament] = useState(null);

    const [isConsumableModalOpen, setIsConsumableModalOpen] = useState(false);
    const [editingConsumable, setEditingConsumable] = useState(null);

    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [adjustItem, setAdjustItem] = useState(null);
    const [adjustType, setAdjustType] = useState("filament");

    const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

    const [isPrintJobModalOpen, setIsPrintJobModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState(null);

    const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState(null);
    const [quoteEstimatePayload, setQuoteEstimatePayload] = useState(null);

    const [printingQuote, setPrintingQuote] = useState(null);

    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [saleLinkedJob, setSaleLinkedJob] = useState(null);

    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [csvType, setCsvType] = useState("filaments");

    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);

    // Resolve user ID
    const effectiveUserId = currentUser?.uid || (window.electronAPI ? "desktop_local_user" : null);

    const [previewCalculator, setPreviewCalculator] = useState(false);

    // Evaluate entitlement for Studio Hub (Pro, Pro+, VIP required for full hub)
    const hubDecision = access?.evaluateStudioHub ? access.evaluateStudioHub() : { allowed: false, state: "unauthorized" };
    const isAuthorized = Boolean(
        hubDecision?.allowed ||
        access?.capabilities?.studioHub
    );

    // ── Data Loader ──────────────────────────────────────────────────────────
    const loadAllStudioData = useCallback(async () => {
        if (!effectiveUserId) {
            setDataLoading(false);
            return;
        }
        setDataLoading(true);
        try {
            const [fils, cons, printers, jobs, quotes, salesData, mvts] = await Promise.all([
                getFilaments(effectiveUserId).catch(() => []),
                getConsumables(effectiveUserId).catch(() => []),
                getPrinterProfiles(effectiveUserId).catch(() => []),
                getPrintJobs(effectiveUserId).catch(() => []),
                getQuotations(effectiveUserId).catch(() => []),
                getSales(effectiveUserId).catch(() => []),
                getInventoryMovements(effectiveUserId, 50).catch(() => []),
            ]);

            setFilaments(fils);
            setConsumables(cons);
            setPrinterProfiles(printers);
            setPrintJobs(jobs);
            setQuotations(quotes);
            setSales(salesData);
            setMovements(mvts);
        } catch (err) {
            console.error("[StudioHub] Failed to load data from Firestore:", err);
        } finally {
            setDataLoading(false);
        }
    }, [effectiveUserId]);

    useEffect(() => {
        if (isAuthorized) {
            loadAllStudioData();
        } else {
            setDataLoading(false);
        }
    }, [isAuthorized, loadAllStudioData]);

    // ── Handlers for CRUD Operations ─────────────────────────────────────────

    // Filaments
    const handleSaveFilament = async (data) => {
        if (editingFilament) {
            await updateFilament(effectiveUserId, editingFilament.id, data);
        } else {
            await addFilament(effectiveUserId, data);
        }
        await loadAllStudioData();
    };

    const handleDeleteFilament = async (id) => {
        if (!confirm("Are you sure you want to delete this filament spool?")) return;
        await deleteFilament(effectiveUserId, id);
        await loadAllStudioData();
    };

    // Consumables
    const handleSaveConsumable = async (data) => {
        if (editingConsumable) {
            await updateConsumable(effectiveUserId, editingConsumable.id, data);
        } else {
            await addConsumable(effectiveUserId, data);
        }
        await loadAllStudioData();
    };

    const handleDeleteConsumable = async (id) => {
        if (!confirm("Are you sure you want to delete this consumable?")) return;
        await deleteConsumable(effectiveUserId, id);
        await loadAllStudioData();
    };

    // Print Jobs
    const handleSavePrintJob = async (data) => {
        if (editingJob) {
            await updatePrintJob(effectiveUserId, editingJob.id, data);
        } else {
            await createPrintJob(effectiveUserId, data);
        }
        await loadAllStudioData();
    };

    const handleDeleteJob = async (id) => {
        if (!confirm("Delete this print job record?")) return;
        await deletePrintJob(effectiveUserId, id);
        await loadAllStudioData();
    };

    const handleCompleteJob = async (id) => {
        await completePrintJob(effectiveUserId, id);
        await loadAllStudioData();
    };

    const handleCancelJob = async (id) => {
        await revertPrintJobDeduction(effectiveUserId, id, "Cancelled");
        await loadAllStudioData();
    };

    // Quotations
    const handleSaveQuotation = async (data) => {
        if (editingQuote) {
            await updateQuotation(effectiveUserId, editingQuote.id, data);
        } else {
            await createQuotation(effectiveUserId, data);
        }
        await loadAllStudioData();
    };

    const handleDeleteQuotation = async (id) => {
        if (!confirm("Delete this customer quotation?")) return;
        await deleteQuotation(effectiveUserId, id);
        await loadAllStudioData();
    };

    const handleConvertQuoteToJob = (quote) => {
        setEditingJob(null);
        setIsPrintJobModalOpen(true);
    };

    // Sales
    const handleSaveSale = async (data) => {
        if (editingSale) {
            await updateSale(effectiveUserId, editingSale.id, data);
        } else {
            await recordSale(effectiveUserId, data);
        }
        await loadAllStudioData();
    };

    const handleDeleteSale = async (id) => {
        if (!confirm("Delete this sales entry?")) return;
        await deleteSale(effectiveUserId, id);
        await loadAllStudioData();
    };

    // Calculator Actions
    const handleCreateJobFromEstimate = (calc, title) => {
        setEditingJob({
            product_name: title || "Custom 3D Print",
            actual_duration_hrs: calc.printHoursTotal,
            estimated_duration_hrs: calc.printHoursTotal,
            estimated_cost: calc.bufferedCost,
            actual_cost: calc.bufferedCost,
            selling_price: calc.sellingPrice,
            filaments_used: calc.materialDetails.map((m) => ({
                filament_id: m.filamentId,
                name: m.filamentName,
                grams: m.totalGrams,
                color_hex: m.colorHex,
            })),
            consumables_used: calc.consumableDetails.map((c) => ({
                consumable_id: c.consumableId,
                name: c.consumableName,
                qty: c.qty,
                unit: c.unitOfMeasure,
            })),
        });
        setIsPrintJobModalOpen(true);
    };

    const handleCreateQuoteFromEstimate = (calc, title) => {
        setEditingQuote(null);
        setQuoteEstimatePayload({
            title: title || "Custom 3D Print",
            selling_price: calc.sellingPrice,
        });
        setIsQuotationModalOpen(true);
    };

    // CSV Bulk Import
    const handleImportCsv = async (rows) => {
        if (csvType === "filaments") {
            for (const r of rows) {
                await addFilament(effectiveUserId, {
                    name: r.name,
                    brand: r.brand || "Generic",
                    material: r.material || "PLA",
                    color_name: r.color_name || "",
                    color_hex: r.color_hex || "#14b8a6",
                    spool_weight_g: Number(r.spool_weight_g) || 1000,
                    remaining_weight_g: Number(r.remaining_weight_g || r.spool_weight_g) || 1000,
                    purchase_price: Number(r.purchase_price) || 0,
                    supplier: r.supplier || "",
                    status: r.status || "In Use",
                    min_threshold_g: Number(r.min_threshold_g) || 100,
                    notes: r.notes || "",
                });
            }
        } else {
            for (const r of rows) {
                await addConsumable(effectiveUserId, {
                    name: r.name,
                    category: r.category || "General",
                    pack_quantity: Number(r.pack_quantity) || 1,
                    pack_price: Number(r.pack_price) || 0,
                    quantity: Number(r.quantity) || 1,
                    unit_of_measure: r.unit_of_measure || "pcs",
                    supplier: r.supplier || "",
                    status: r.status || "In Stock",
                    reorder_threshold: Number(r.reorder_threshold) || 10,
                    notes: r.notes || "",
                });
            }
        }
        await loadAllStudioData();
    };

    // ── Access Guards & Paywalls ─────────────────────────────────────────────

    // Loading State
    if (access.status === "loading" || (isAuthorized && dataLoading)) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-6">
                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-gray-700">Loading Studio Hub Workspace...</p>
                <p className="text-xs text-gray-400 mt-1">Verifying subscription and syncing inventory</p>
            </div>
        );
    }

    // Unauthenticated State
    if (!currentUser && !window.electronAPI) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
                <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-teal-600 font-bold text-lg">
                        <Wrench size={20} /> KC KenCreations Studio
                    </Link>
                    <button
                        onClick={loginWithGoogle}
                        className="bg-[#14b8a6] hover:bg-[#0f766e] text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                    >
                        Sign In with Google
                    </button>
                </nav>

                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-5">
                        <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
                            <Sparkles size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            Studio Hub — Subscriber Workspace
                        </h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Sign in with your Google account to access your inventory tracking, unified cost calculator, print job queue, customer quotations, and sales analytics.
                        </p>
                        <div className="pt-2">
                            <button
                                onClick={loginWithGoogle}
                                className="w-full bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold py-3 rounded-2xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
                            >
                                Sign In to Open Studio Hub
                            </button>
                        </div>
                        <Link to="/" className="text-xs font-bold text-gray-400 hover:text-gray-600 block mt-4">
                            ← Return to Generators
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Unauthorized / Expired State with Standalone Preview Option
    if (!isAuthorized) {
        if (previewCalculator) {
            return (
                <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans">
                    <nav className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                        <div className="flex items-center gap-3">
                            <Link to="/" className="flex items-center gap-2 text-teal-600 font-bold text-base">
                                <Wrench size={18} /> KenCreations Studio
                            </Link>
                            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                                Standalone Calculator Preview
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 hidden md:inline">
                                Spool deductions, customer quotes, and print jobs require Studio Pro or Pro+
                            </span>
                            <button
                                onClick={() => setIsPricingModalOpen(true)}
                                className="text-xs bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold px-3 py-1.5 rounded-full shadow-sm transition-colors"
                            >
                                Upgrade
                            </button>
                            <button
                                onClick={() => setPreviewCalculator(false)}
                                className="text-xs text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-full transition-colors"
                            >
                                Exit Preview
                            </button>
                        </div>
                    </nav>

                    <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-4">
                        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
                            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Offline Sandbox Calculator</p>
                                <p className="text-amber-800/90 mt-0.5">
                                    This preview calculates print parameters locally without accessing or modifying protected Firestore inventories. To track physical spools, generate formal PDF customer quotes, and maintain production queues, upgrade to Studio Pro or Pro+.
                                </p>
                            </div>
                        </div>

                        <CostCalculatorTab
                            filaments={[
                                { id: "preview_pla", name: "Generic PLA (Preview)", material: "PLA", purchase_price: 850, spool_weight_g: 1000, remaining_weight_g: 1000, color_hex: "#14b8a6" },
                                { id: "preview_petg", name: "Generic PETG (Preview)", material: "PETG", purchase_price: 950, spool_weight_g: 1000, remaining_weight_g: 1000, color_hex: "#3b82f6" },
                                { id: "preview_abs", name: "Generic ABS (Preview)", material: "ABS", purchase_price: 900, spool_weight_g: 1000, remaining_weight_g: 1000, color_hex: "#f97316" }
                            ]}
                            consumables={[]}
                            printers={[
                                { id: "preview_printer", name: "Default 3D Printer", wattage: 350, electricity_rate: 11.5, wear_rate: 5.0, is_default: true }
                            ]}
                            userId={null}
                            onOpenPrinterProfiles={() => {}}
                            onSaveEstimateSuccess={() => {}}
                            onCreateJobFromEstimate={() => setIsPricingModalOpen(true)}
                            onCreateQuoteFromEstimate={() => setIsPricingModalOpen(true)}
                        />
                    </main>

                    <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
                </div>
            );
        }

        const isExpired = hubDecision.state === "expired" || access.hasExpired;
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
                <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-teal-600 font-bold text-lg">
                        <Wrench size={20} /> KC KenCreations Studio
                    </Link>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsActivateModalOpen(true)}
                            className="text-xs font-bold text-teal-600 border border-teal-200 px-3.5 py-1.5 rounded-full hover:bg-teal-50 transition-colors"
                        >
                            Activate License
                        </button>
                    </div>
                </nav>

                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-5">
                        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
                            <Lock size={30} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            {isExpired ? "Subscription Expired" : "Studio Hub Access Required"}
                        </h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            {isExpired
                                ? "Your Studio Pro subscription has expired. Your inventory records, estimates, and print jobs remain completely safe. Renew your plan to continue accessing the workspace."
                                : "Studio Hub is an exclusive business management workspace for Studio Pro and Pro+ subscribers. Manage spools, calculate multi-color print costs, and print quotes."}
                        </p>
                        <div className="flex flex-col gap-2.5 pt-2">
                            <button
                                onClick={() => setIsPricingModalOpen(true)}
                                className="w-full bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold py-3 rounded-2xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
                            >
                                <Sparkles size={16} /> {isExpired ? "Renew Subscription" : "Upgrade to Studio Pro"}
                            </button>
                            <button
                                onClick={() => setPreviewCalculator(true)}
                                className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-2.5 rounded-2xl border border-teal-200 text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Calculator size={15} /> Open Standalone Cost Calculator (Preview)
                            </button>
                            <button
                                onClick={() => setIsActivateModalOpen(true)}
                                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-2.5 rounded-2xl border border-gray-200 text-xs transition-colors"
                            >
                                Activate License Key
                            </button>
                        </div>
                        <Link to="/" className="text-xs font-bold text-gray-400 hover:text-gray-600 block mt-4">
                            ← Return to Generators
                        </Link>
                    </div>
                </div>

                <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
                <ActivateLicenseModal isOpen={isActivateModalOpen} onClose={() => setIsActivateModalOpen(false)} />
            </div>
        );
    }

    // ── Main Authenticated Studio Hub UI ─────────────────────────────────────
    return (
        <div className="min-h-screen w-full bg-[#f8f9fc] text-gray-900 flex flex-col font-sans">
            {/* Top Workspace Navbar */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-6 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-teal-50 text-gray-500 hover:text-teal-600 flex items-center justify-center transition-colors shadow-xs"
                        title="Back to Generator Catalog"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black text-gray-900 tracking-tight">Studio Hub</h1>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 tracking-wide">
                                Pro Workspace
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium hidden sm:block">
                            Materials, Consumables, Cost Calculator & Production Tracker
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to="/studio/bazaar"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 transition-all shadow-2xs"
                        title="Open Bazaar Hub POS & Event Management"
                    >
                        <Store size={15} className="text-teal-600" />
                        <span className="hidden sm:inline">Bazaar Hub</span>
                    </Link>
                    <button
                        onClick={loadAllStudioData}
                        className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                        title="Refresh data from Cloud Firestore"
                    >
                        <RotateCw size={16} />
                    </button>
                    {currentUser && (
                        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                            <img
                                src={
                                    currentUser.photoURL ||
                                    `https://ui-avatars.com/api/?name=${currentUser.displayName || "Maker"}&background=14b8a6&color=fff`
                                }
                                alt="User"
                                className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                            />
                            <div className="text-left hidden md:block">
                                <span className="text-xs font-bold text-gray-800 block truncate max-w-[120px]">
                                    {currentUser.displayName || "Subscriber"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Navigation Tabs Bar */}
            <div className="bg-white border-b border-gray-100 px-6 sm:px-8 sticky top-[61px] z-30">
                <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                id={`hub-tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                                    isActive
                                        ? "bg-teal-50 text-teal-700 shadow-xs border border-teal-200/60"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                            >
                                <Icon size={15} className={isActive ? "text-teal-600" : "text-gray-400"} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8">
                {activeTab === "overview" && (
                    <OverviewTab
                        filaments={filaments}
                        consumables={consumables}
                        printJobs={printJobs}
                        sales={sales}
                        movements={movements}
                        onNavigateTab={setActiveTab}
                        onOpenAddFilament={() => {
                            setEditingFilament(null);
                            setIsFilamentModalOpen(true);
                        }}
                        onOpenAddConsumable={() => {
                            setEditingConsumable(null);
                            setIsConsumableModalOpen(true);
                        }}
                        onOpenCreateJob={() => {
                            setEditingJob(null);
                            setIsPrintJobModalOpen(true);
                        }}
                    />
                )}

                {activeTab === "filaments" && (
                    <FilamentsTab
                        filaments={filaments}
                        onOpenAdd={() => {
                            setEditingFilament(null);
                            setIsFilamentModalOpen(true);
                        }}
                        onOpenEdit={(fil) => {
                            setEditingFilament(fil);
                            setIsFilamentModalOpen(true);
                        }}
                        onDelete={handleDeleteFilament}
                        onOpenAdjust={(fil) => {
                            setAdjustItem(fil);
                            setAdjustType("filament");
                            setIsAdjustModalOpen(true);
                        }}
                        onOpenCsv={() => {
                            setCsvType("filaments");
                            setIsCsvModalOpen(true);
                        }}
                    />
                )}

                {activeTab === "consumables" && (
                    <ConsumablesTab
                        consumables={consumables}
                        onOpenAdd={() => {
                            setEditingConsumable(null);
                            setIsConsumableModalOpen(true);
                        }}
                        onOpenEdit={(con) => {
                            setEditingConsumable(con);
                            setIsConsumableModalOpen(true);
                        }}
                        onDelete={handleDeleteConsumable}
                        onOpenAdjust={(con) => {
                            setAdjustItem(con);
                            setAdjustType("consumable");
                            setIsAdjustModalOpen(true);
                        }}
                        onOpenCsv={() => {
                            setCsvType("consumables");
                            setIsCsvModalOpen(true);
                        }}
                    />
                )}

                {activeTab === "calculator" && (
                    <CostCalculatorTab
                        filaments={filaments}
                        consumables={consumables}
                        printers={printerProfiles}
                        userId={effectiveUserId}
                        onOpenPrinterProfiles={() => setIsPrinterModalOpen(true)}
                        onSaveEstimateSuccess={loadAllStudioData}
                        onCreateJobFromEstimate={handleCreateJobFromEstimate}
                        onCreateQuoteFromEstimate={handleCreateQuoteFromEstimate}
                    />
                )}

                {activeTab === "jobs" && (
                    <PrintJobsTab
                        printJobs={printJobs}
                        onOpenCreate={() => {
                            setEditingJob(null);
                            setIsPrintJobModalOpen(true);
                        }}
                        onOpenEdit={(job) => {
                            setEditingJob(job);
                            setIsPrintJobModalOpen(true);
                        }}
                        onDelete={handleDeleteJob}
                        onCompleteJob={handleCompleteJob}
                        onCancelJob={handleCancelJob}
                        onRecordSaleFromJob={(job) => {
                            setEditingSale(null);
                            setSaleLinkedJob(job);
                            setIsSaleModalOpen(true);
                        }}
                    />
                )}

                {activeTab === "quotations" && (
                    <QuotationsTab
                        quotations={quotations}
                        onOpenCreate={() => {
                            setEditingQuote(null);
                            setQuoteEstimatePayload(null);
                            setIsQuotationModalOpen(true);
                        }}
                        onOpenEdit={(quote) => {
                            setEditingQuote(quote);
                            setQuoteEstimatePayload(null);
                            setIsQuotationModalOpen(true);
                        }}
                        onDelete={handleDeleteQuotation}
                        onOpenPrintView={(quote) => setPrintingQuote(quote)}
                        onConvertQuoteToJob={handleConvertQuoteToJob}
                    />
                )}

                {activeTab === "sales" && (
                    <SalesTab
                        sales={sales}
                        onOpenRecordSale={() => {
                            setEditingSale(null);
                            setSaleLinkedJob(null);
                            setIsSaleModalOpen(true);
                        }}
                        onOpenEdit={(sale) => {
                            setEditingSale(sale);
                            setSaleLinkedJob(null);
                            setIsSaleModalOpen(true);
                        }}
                        onDelete={handleDeleteSale}
                    />
                )}

                {activeTab === "analytics" && (
                    <AnalyticsTab
                        filaments={filaments}
                        consumables={consumables}
                        printJobs={printJobs}
                        sales={sales}
                    />
                )}
            </main>

            {/* Modals & Dialogs */}
            <FilamentModal
                isOpen={isFilamentModalOpen}
                onClose={() => setIsFilamentModalOpen(false)}
                filament={editingFilament}
                onSave={handleSaveFilament}
            />

            <ConsumableModal
                isOpen={isConsumableModalOpen}
                onClose={() => setIsConsumableModalOpen(false)}
                consumable={editingConsumable}
                onSave={handleSaveConsumable}
            />

            <StockAdjustModal
                isOpen={isAdjustModalOpen}
                onClose={() => setIsAdjustModalOpen(false)}
                item={adjustItem}
                type={adjustType}
                userId={effectiveUserId}
                onRefresh={loadAllStudioData}
            />

            <PrinterProfileModal
                isOpen={isPrinterModalOpen}
                onClose={() => setIsPrinterModalOpen(false)}
                userId={effectiveUserId}
                profiles={printerProfiles}
                onRefresh={loadAllStudioData}
            />

            <PrintJobModal
                isOpen={isPrintJobModalOpen}
                onClose={() => setIsPrintJobModalOpen(false)}
                job={editingJob}
                filaments={filaments}
                consumables={consumables}
                printers={printerProfiles}
                onSave={handleSavePrintJob}
            />

            <QuotationModal
                isOpen={isQuotationModalOpen}
                onClose={() => {
                    setIsQuotationModalOpen(false);
                    setQuoteEstimatePayload(null);
                }}
                quote={editingQuote}
                initialEstimate={quoteEstimatePayload}
                onSave={handleSaveQuotation}
            />

            <QuotationPrintView
                quote={printingQuote}
                onClose={() => setPrintingQuote(null)}
            />

            <SaleModal
                isOpen={isSaleModalOpen}
                onClose={() => {
                    setIsSaleModalOpen(false);
                    setSaleLinkedJob(null);
                }}
                sale={editingSale}
                linkedJob={saleLinkedJob}
                onSave={handleSaveSale}
            />

            <CsvModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                type={csvType}
                existingData={csvType === "filaments" ? filaments : consumables}
                onImport={handleImportCsv}
            />
        </div>
    );
}
