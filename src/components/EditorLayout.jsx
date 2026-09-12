import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSecureTrial } from "../contexts/TrialContext";

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
    backLink = "/",
    topBarActions,
}) {
    const { exportsLeft, loadingTrial, isLicensed } = useSecureTrial() || {};
    const isDesktop = !!window.electronAPI;

    return (
        <div className="flex h-screen w-screen flex-col bg-[#f0f4f8] font-sans">
            <nav className="z-10 flex items-center justify-between bg-white px-6 py-3.5 shadow-sm drop-shadow-xl">
                <div className="flex items-center space-x-4">
                    <Link
                        to={backLink}
                        className="flex items-center text-xl font-black tracking-tighter">
                        <span className="text-teal-500">K</span>
                        <span className="text-orange-500">C</span>
                        <span className="ml-2 text-lg font-bold tracking-normal text-gray-800">
                            KENCREATIONS
                        </span>
                    </Link>
                </div>

                {isDesktop && !isLicensed && (
                    <div className="flex items-center space-x-3 text-sm font-medium text-gray-600">
                        <span className="mr-1 text-xs font-semibold text-gray-500">
                            {loadingTrial
                                ? "Trial Active — Checking..."
                                : `Trial Active — ${exportsLeft}/5`}
                        </span>
                        <button
                            className="rounded-lg border border-teal-500 px-4 py-1.5 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal-50"
                            onClick={() => {
                                if (window.dispatchEvent) {
                                    window.dispatchEvent(
                                        new CustomEvent("local-notification", {
                                            detail: {
                                                id: Date.now(),
                                                type: "info",
                                                title: "Upgrade Required",
                                                body: "Visit the studio dashboard to upgrade to a full license.",
                                            },
                                        }),
                                    );
                                }
                            }}>
                            Upgrade
                        </button>
                    </div>
                )}
            </nav>

            <main className="flex w-full flex-1 gap-4 overflow-hidden p-4">
                <aside className="flex min-w-[320px] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-secondary bg-white shadow-md">
                    <div className="border-b border-secondary/20 bg-secondary px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-black uppercase tracking-[0.2em] text-white">
                                {title}
                            </span>
                            <div className="flex gap-2 items-center">
                                {topBarActions}
                                <Link
                                    to="/"
                                    className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/20">
                                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Studio
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-w-0">
                        {sidebarContent}
                    </div>
                </aside>

                <section className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-secondary bg-[#fff4f8] shadow-md">
                    <div className="relative min-h-0 flex-1">
                        <SceneErrorBoundary>{children}</SceneErrorBoundary>
                    </div>
                    {canvasFooter && (
                        <div className="flex-shrink-0 border-t border-secondary/20 bg-white/80 backdrop-blur-sm">
                            {canvasFooter}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
