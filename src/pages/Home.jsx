import React from "react";
import { editors } from "../data/editors";
import { useNavigate } from "react-router-dom";
import HeroScene from "../components/HeroScene";

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="relative min-h-screen w-screen overflow-hidden font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fff0e5] via-teal-100 to-[#00A3A3]">
            {/* The Interactive 3D Background */}
            <HeroScene />

            {/* Foreground UI Layer */}
            <div className="relative z-10 flex flex-col min-h-screen pointer-events-none">
                
                {/* Universal Top Nav */}
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
                            STUDIO
                        </span>
                    </div>
                    <div className="flex items-center space-x-8 text-sm font-semibold text-gray-700">
                        <button className="hover:text-black transition-colors">Platform</button>
                        <button className="hover:text-black transition-colors">Solutions</button>
                        <button className="hover:text-black transition-colors">Resources</button>
                        <button className="hover:text-black transition-colors">Pricing</button>
                        <div className="flex items-center space-x-4 pl-4 border-l border-gray-400/30">
                            <button className="hover:text-black transition-colors">Log In</button>
                            <button className="px-4 py-2 bg-[#00A3A3] text-white rounded-lg hover:bg-[#008f8f] transition-colors shadow-lg shadow-teal-500/30">
                                Open Studio
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Hero Section */}
                <main className="flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-32 text-center pointer-events-auto">
                    
                    {/* Glowing Pill Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl text-gray-800 text-xs font-semibold px-4 py-1.5 rounded-full border border-white shadow-xl shadow-teal-900/10 mb-8 transition-transform hover:scale-105 cursor-default">
                        <span className="text-lg leading-none">✨</span>
                        Studio Cloud Platform Engine Active
                        <span className="ml-1 opacity-50">→</span>
                    </div>
                    
                    {/* Massive Headline */}
                    <h1 className="text-6xl md:text-8xl font-bold text-gray-900 tracking-tighter mb-6 max-w-4xl leading-[1.05]">
                        The 3D Engine your creativity deserves.
                    </h1>
                    
                    {/* Subheadline */}
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-700 font-medium leading-relaxed mb-10">
                        Elevate your team, your brand, and your impact with a 3D modeling engine that's built directly into the cloud. No downloads required.
                    </p>
                    
                    {/* Call to Actions */}
                    <div className="flex items-center gap-4">
                        <button 
                            className="px-8 py-3.5 bg-transparent text-gray-900 font-semibold rounded-lg border-2 border-gray-900 hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        >
                            View Tools
                        </button>
                        <button 
                            className="px-8 py-3.5 bg-[#00A3A3] text-white font-semibold rounded-lg hover:bg-[#008f8f] hover:shadow-xl hover:shadow-teal-500/40 transition-all border-2 border-[#00A3A3]"
                            onClick={() => navigate('/editor/charms')}
                        >
                            Start Free Trial
                        </button>
                    </div>

                </main>

                {/* Glassmorphism Editor Cards Container */}
                <div className="w-full max-w-7xl mx-auto px-6 pb-12 pointer-events-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {editors.map((editor) => (
                            <div
                                key={editor.id}
                                className="group flex flex-col bg-white/20 backdrop-blur-xl p-6 rounded-2xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] hover:bg-white/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                            >
                                {/* Card Header Area */}
                                <div className="p-2 flex-1">
                                    <div className="flex items-start justify-between mb-4">
                                        {/* Decorative Icon Wrapper */}
                                        <div className="w-12 h-12 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                                            {editor.icon}
                                        </div>

                                        {/* Status Badges */}
                                        <div className="flex gap-1.5 items-center">
                                            {editor.isFree && (
                                                <span className="text-[10px] font-extrabold uppercase bg-teal-400/20 text-teal-800 px-2.5 py-1 rounded-md border border-teal-200/50 backdrop-blur-md">
                                                    Free
                                                </span>
                                            )}
                                            <span
                                                className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border backdrop-blur-md ${
                                                    editor.status === "Stable"
                                                        ? "bg-emerald-400/20 text-emerald-800 border-emerald-200/50"
                                                        : "bg-orange-400/20 text-orange-900 border-orange-200/50"
                                                }`}
                                            >
                                                {editor.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title and Description */}
                                    <h3 className="text-xl font-bold text-gray-900 mb-2 drop-shadow-sm">
                                        {editor.title}
                                    </h3>
                                    <p className="text-sm text-gray-700 font-medium leading-relaxed drop-shadow-sm">
                                        {editor.description}
                                    </p>
                                </div>

                                {/* Action Button Strip */}
                                <div className="mt-4 pt-4 border-t border-white/30 flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-600/80 uppercase tracking-wider">
                                        Engine V2.0
                                    </span>
                                    <button
                                        onClick={() => navigate(editor.link)}
                                        className="text-sm font-bold text-gray-900 bg-white/50 hover:bg-white/80 backdrop-blur-md border border-white/50 px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 group-hover:pr-3"
                                    >
                                        Launch <span className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all">→</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
