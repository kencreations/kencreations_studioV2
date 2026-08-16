import React from "react";
import { editors, getAccessibleEditors } from "../data/editors";
import { useNavigate } from "react-router-dom";
import HeroScene from "../components/HeroScene";

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

    // Split editors into accessible and locked
    const accessibleIds = new Set(getAccessibleEditors(entitlements).map(e => e.id));

    return (
        <div className="relative h-screen w-screen overflow-hidden font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fff0e5] via-teal-100 to-[#00A3A3]">
            {/* Interactive 3D Background */}
            <HeroScene />

            {/* Foreground UI Layer */}
            <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto overflow-x-hidden pointer-events-none">

                {/* Top Nav */}
                <nav className="flex items-center justify-between px-6 py-6 pointer-events-auto">
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
                    
                    <button 
                        onClick={() => navigate('/profile')} 
                        className="bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/60 text-gray-800 font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                    </button>
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
                        Select an editor below to start creating 3D models right from your desktop.
                    </p>
                </main>

                {/* Generator Cards Grid */}
                <div className="w-full max-w-7xl mx-auto px-6 pb-12 pointer-events-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {editors.map((editor) => {
                            const isAccessible = accessibleIds.has(editor.id);
                            const isLocked = editor.exclusive && !isAccessible;

                            return (
                                <div
                                    key={editor.id}
                                    className={`group flex flex-col p-6 rounded-2xl border shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] transition-all duration-300 overflow-hidden relative ${
                                        isLocked
                                            ? 'bg-white/10 backdrop-blur-md border-white/20 opacity-60 cursor-not-allowed'
                                            : 'bg-white/20 backdrop-blur-xl border-white/40 hover:bg-white/30 hover:-translate-y-1 cursor-pointer'
                                    }`}
                                >
                                    {/* Lock overlay badge */}
                                    {isLocked && (
                                        <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10">
                                            🔒 Upgrade Required
                                        </div>
                                    )}

                                    <div className="p-2 flex-1">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-12 h-12 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl flex items-center justify-center text-2xl shadow-sm transition-transform ${!isLocked ? 'group-hover:scale-110' : ''}`}>
                                                {editor.icon}
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 mb-2 drop-shadow-sm">
                                            {editor.title}
                                        </h3>
                                        <p className="text-sm text-gray-700 font-medium leading-relaxed drop-shadow-sm">
                                            {editor.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-white/30 flex justify-between items-center">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${
                                            isLocked ? 'text-gray-500/70' : 'text-gray-600/80'
                                        }`}>
                                            {editor.status} {editor.exclusive ? '· Exclusive' : '· Standard'}
                                        </span>

                                        {isLocked ? (
                                            <span className="text-xs font-bold text-gray-500 bg-white/30 px-3 py-1.5 rounded-lg">
                                                Locked
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => navigate(editor.link)}
                                                className="text-sm font-bold text-gray-900 bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/50 px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 group-hover:pr-3"
                                            >
                                                Launch <span className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all">→</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}
