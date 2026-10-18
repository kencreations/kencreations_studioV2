import { useAccess } from "../contexts/AccessContext";
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSecureTrial } from "../contexts/TrialContext";
import { useGenerators } from "../hooks/useGenerators";
import { canonicalRoute } from "../utils/generatorCatalog";
import { formatFreeTrialBadgeText, DEFAULT_FREE_TRIAL_EXPORT_LIMIT } from "../utils/freeTrialPolicy";
import PricingModal from "./UI/PricingModal";

class SceneErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[EditorLayout] Scene crashed:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/90 p-6 text-left text-xs text-red-100">
                    <div className="max-w-lg rounded-2xl border border-red-500/40 bg-black/30 p-4 shadow-2xl">
                        <p className="mb-2 text-sm font-bold uppercase tracking-wider text-red-300">
                            3D Scene Error
                        </p>
                        <p className="font-mono whitespace-pre-wrap break-words">
                            {this.state.error?.message || "Unknown scene error"}
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function EditorLayout({
    title,
    sidebarContent,
    children,
    canvasFooter,
    onExportSTL,
    backLink = !!window.electronAPI ? "/" : "/app",
    topBarActions,
    stackedHeader = false,
}) {
    const { exportsLeft, loadingTrial, freeTrial, trialStatus } = useSecureTrial() || {};
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const access = useAccess();
    const { hasActiveLicense: isLicensed } = access;
    const isDesktop = !!window.electronAPI;
    const { pathname } = useLocation();
    const { generators = [] } = useGenerators() || {};
    const generator = generators.find(g => canonicalRoute(g.link) === canonicalRoute(pathname)) || generators.find(g => g.link === pathname);
    const decision = generator ? access.evaluate(generator) : null;
    const isDevPreview = decision?.developerPreview === true;
    const originalStatus = decision?.originalStatus || generator?.status || (decision?.isComingSoon ? "Coming Soon" : "Under Maintenance");

    return (
        <div className="flex h-screen w-screen flex-col bg-[#f8f9fc] font-sans">
            <nav
                className="z-10 flex items-center justify-between bg-white px-6 py-3.5 shadow-sm border-b border-gray-100"
                style={{ WebkitAppRegion: 'drag' }}
            >
                <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' }}>
                    <Link
                        to={backLink}
                        className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xl text-teal-600 bg-teal-50 px-2 py-1 rounded-lg font-bold">
                            K
                        </span>
                        <span className="text-lg font-bold tracking-tight text-gray-900">
                            KenCreations
                        </span>
                    </Link>
                </div>

                {!isLicensed && (
                    <div
                        className="flex items-center space-x-3 text-sm font-medium text-gray-600"
                        style={{ WebkitAppRegion: 'no-drag' }}
                    >
                        <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm ${
                            trialStatus === "error"
                                ? "text-red-700 bg-red-50 border border-red-200"
                                : "text-teal-800 bg-teal-50 border border-teal-200/60"
                        }`}>
                            {loadingTrial
                                ? "Checking free trial…"
                                : trialStatus === "error"
                                  ? "Trial Quota Unavailable"
                                  : formatFreeTrialBadgeText(exportsLeft, freeTrial?.limit ?? DEFAULT_FREE_TRIAL_EXPORT_LIMIT)}
                        </span>
                        <button
                            className="rounded-lg border border-teal-500 px-3.5 py-1 text-xs font-bold text-teal-600 transition-colors hover:bg-teal-50 shadow-sm"
                            onClick={() => setIsPricingModalOpen(true)}>
                            Upgrade
                        </button>
                    </div>
                )}
            </nav>

            {isDevPreview && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs text-amber-900 z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                            Developer Preview
                        </span>
                        <span className="bg-white text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                            {originalStatus}
                        </span>
                        <span className="font-semibold text-amber-900">
                            This generator is not publicly released. Features may be incomplete or unstable.
                        </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 hidden sm:inline-block">
                        Development Mode
                    </span>
                </div>
            )}

            <main className="flex w-full min-h-0 flex-1 flex-col md:flex-row gap-4 p-2 md:p-4 overflow-auto md:overflow-hidden">
                {/* Sidebar */}
                <aside className="flex w-full md:w-[320px] h-[40vh] md:h-auto shrink-0 flex-col overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] z-10">
                    <div className="border-b border-gray-100 bg-white px-5 py-4">
                        <div className={`flex ${stackedHeader ? 'flex-col items-start' : 'items-center justify-between'} gap-3`}>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
                                        Designer
                                    </span>
                                    {isDevPreview && (
                                        <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                            Developer Preview
                                        </span>
                                    )}
                                </div>
                                <span className="text-base font-black text-gray-900 leading-tight">
                                    {title}
                                </span>
                            </div>
                            <div className="flex gap-2 items-center">
                                {topBarActions}
                                <Link
                                    to={backLink}
                                    className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                    title="Back to Studio">
                                    <ArrowLeft size={18} strokeWidth={2.5} />
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 min-w-0">
                        {sidebarContent}
                    </div>
                </aside>

                {/* 3D Viewport Area */}
                <section className="relative flex min-h-[360px] md:min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-inner">
                    <div className="relative min-h-0 flex-1">
                        <SceneErrorBoundary>{children}</SceneErrorBoundary>
                    </div>
                    
                    {/* Floating Tools */}
                    {canvasFooter && (
                        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2 p-2 rounded-2xl bg-white/80 backdrop-blur-xl border border-gray-200 shadow-xl">
                            {canvasFooter}
                        </div>
                    )}
                </section>
            </main>

            <PricingModal
                isOpen={isPricingModalOpen}
                onClose={() => setIsPricingModalOpen(false)}
            />
        </div>
    );
}
