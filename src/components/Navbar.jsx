import React, { useState, useRef, useEffect } from "react";
import { Search, Download, Wrench, ChevronDown, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSecureTrial } from "../contexts/TrialContext";
import { formatFreeTrialBadgeText, DEFAULT_FREE_TRIAL_EXPORT_LIMIT } from "../utils/freeTrialPolicy";
import ActivateLicenseModal from "./UI/ActivateLicenseModal";

export default function Navbar({ searchQuery, setSearchQuery, isLicensed, onPricingClick }) {
    const navigate = useNavigate();
    const { currentUser, userData, loginWithGoogle, logout } = useAuth();
    const { exportsLeft, freeTrial, loadingTrial, trialStatus } = useSecureTrial() || {};
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
    const dropdownRef = useRef(null);

    const isSubscribed = isLicensed;

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAuthAction = async () => {
        if (!currentUser) {
            try {
                await loginWithGoogle();
            } catch (err) {
                console.error("Login failed:", err);
            }
        }
    };

    const handleActivateClick = async () => {
        if (!currentUser) {
            try {
                await loginWithGoogle();
                setIsActivateModalOpen(true);
            } catch (err) {
                console.error("Login failed:", err);
            }
        } else {
            setIsActivateModalOpen(true);
        }
    };

    const handleLogout = async () => {
        await logout();
        setIsDropdownOpen(false);
        navigate("/");
    };

    return (
        <nav
            className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 w-full flex items-center justify-between px-8 py-4 pointer-events-auto shadow-sm"
            style={{ WebkitAppRegion: 'drag' }}
        >
            <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'no-drag' }}>
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                    <span className="text-xl text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">
                        <Wrench size={20} strokeWidth={2.5} />
                    </span>
                    <span className="text-lg font-bold tracking-tight text-gray-900">
                        KC KenCreations
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search models..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                </div>


                <button
                    onClick={() => navigate("/studio")}
                    className="text-sm font-bold text-gray-700 hover:text-teal-600 px-3 py-2 flex items-center gap-1.5 transition-colors"
                >
                    Studio Hub
                </button>

                {!isSubscribed && currentUser && (
                    <button
                        onClick={onPricingClick}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all shadow-sm ${
                            trialStatus === "error"
                                ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                                : "bg-teal-50 border border-teal-200/80 hover:bg-teal-100 text-teal-700"
                        }`}
                    >
                        {loadingTrial
                            ? "Free Trial…"
                            : trialStatus === "error"
                              ? "Trial Quota Unavailable"
                              : formatFreeTrialBadgeText(exportsLeft, freeTrial?.limit ?? DEFAULT_FREE_TRIAL_EXPORT_LIMIT)}
                    </button>
                )}

                {!isSubscribed && (
                    <button
                        onClick={onPricingClick}
                        className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2">
                        Pricing
                    </button>
                )}

                {!isSubscribed && (
                    <button
                        onClick={handleActivateClick}
                        className="text-sm font-bold text-teal-600 border border-teal-200 bg-white hover:bg-teal-50 px-4 py-2 rounded-full transition-colors shadow-sm"
                    >
                        Activate License
                    </button>
                )}

                {currentUser ? (
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-2 focus:outline-none"
                        >
                            <img 
                                src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=14b8a6&color=fff`} 
                                alt="Avatar" 
                                className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover"
                            />
                            <ChevronDown size={14} className="text-gray-500" />
                        </button>
                        
                        {isDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-2 border-b border-gray-50">
                                    <p className="text-sm font-bold text-gray-900 truncate">{currentUser.displayName}</p>
                                    <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        navigate("/studio");
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-600 flex items-center gap-2"
                                >
                                    <Wrench size={14} /> Studio Hub
                                </button>
                                <button
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        navigate("/profile");
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-teal-600 flex items-center gap-2"
                                >
                                    <User size={14} /> Profile
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <LogOut size={14} /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={handleAuthAction}
                        className="bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-sm transition-all flex items-center gap-2">
                        Sign In
                    </button>
                )}
            </div>
            
            <ActivateLicenseModal 
                isOpen={isActivateModalOpen} 
                onClose={() => setIsActivateModalOpen(false)} 
            />
        </nav>
    );
}
