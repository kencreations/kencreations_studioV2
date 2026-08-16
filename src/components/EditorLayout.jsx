import React from "react";
import { Link } from "react-router-dom";

export default function EditorLayout({
    title,
    sidebarContent,
    children,
    canvasFooter,
    onExportSTL,
}) {
    const isDesktop = !!window.electronAPI;

    return (
        <div className="flex flex-col h-screen w-screen bg-[#f0f4f8] font-sans">
            {/* Top Navigation */}
            <nav className="flex items-center justify-between px-6 py-3.5 bg-white shadow-sm z-10 drop-shadow-xl">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/"
                        className="flex items-center text-xl font-black tracking-tighter">
                        <span className="text-teal-500">K</span>
                        <span className="text-orange-500">C</span>
                        <span className="ml-2 text-gray-800 font-bold tracking-normal text-lg">
                            KENCREATIONS
                        </span>
                    </Link>
                    <div className="h-6 w-px bg-gray-200" />
                </div>

                {!isDesktop && (
                    <div className="flex items-center space-x-3 text-sm font-medium text-gray-600">
                        <span className="text-gray-400 mr-1 text-xs">
                            Trial Active — 9/10
                        </span>
                        <button className="border border-teal-500 text-teal-600 px-4 py-1.5 rounded-lg hover:bg-teal-50 transition-colors text-sm font-semibold">
                            Upgrade
                        </button>
                        <button className="hover:text-gray-900 px-2 transition-colors">
                            Settings
                        </button>
                        <button className="hover:text-gray-900 px-2 transition-colors">
                            Help
                        </button>
                        <button className="hover:text-gray-900 px-2 transition-colors">
                            Sign Out
                        </button>
                    </div>
                )}
            </nav>

            {/* Main Workspace */}
            <main className="flex flex-1 overflow-hidden p-4 gap-4 w-full">
                {/* Sidebar */}
                <aside className=" w-1/5 flex flex-col bg-white rounded-2xl shadow-md flex-shrink-0 border border-secondary">
                    <div className="bg-secondary text-white text-sm font-bold text-center py-3.5 tracking-widest uppercase rounded-t-2xl">
                        {title}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        {sidebarContent}
                    </div>
                </aside>

                {/* Canvas Area */}
                <section className="flex-1 relative bg-[#fff4f8] rounded-2xl shadow-md overflow-hidden flex flex-col border border-secondary">
                    {/* Canvas */}
                    <div className="flex-1 relative min-h-0">{children}</div>
                    {/* Optional footer below the canvas (e.g. Color Extrude Panel) */}
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
