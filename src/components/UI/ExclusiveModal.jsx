import React from "react";
import GlassModal from "./GlassModal";
import { getExclusivePriceInfo } from "../../data/pricingPlans";

export default function ExclusiveModal({
    isOpen,
    onClose,
    generatorName,
    generator,
    isLicensed,
    onUpgradeClick,
}) {
    if (!isOpen) return null;

    const title = generatorName || generator?.title || "Exclusive Generator";
    const priceInfo = getExclusivePriceInfo(generator);

    const handlePurchaseAddOn = (planType) => {
        const url = `https://www.facebook.com/kenjovenie.samonte?ref=addon_${planType}`;
        if (window.electronAPI && window.electronAPI.openExternalUrl) {
            window.electronAPI.openExternalUrl(url);
        } else {
            window.open(url, "_blank");
        }
    };

    return (
        <GlassModal
            isOpen={true}
            onClose={onClose}
            title={`Unlock ${title}`}>
            <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="text-6xl mb-6">🔒</div>

                <h2 className="text-2xl font-black text-gray-900 mb-2">
                    Unlock {title}
                </h2>
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-xs text-amber-700 font-bold uppercase tracking-wider bg-amber-50 border border-amber-200/80 px-3 py-1 rounded-full">
                        Exclusive Generator
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        priceInfo.configured
                            ? "bg-teal-50 text-teal-800 border-teal-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                        {priceInfo.label}
                    </span>
                </div>

                <p className="text-gray-600 text-sm leading-relaxed mb-6 max-w-md">
                    Exclusive generators are specialized 3D creation tools. You can unlock this tool individually for permanent lifetime use, or upgrade to VIP All-Access to get all current and future VIP tools.
                </p>

                <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
                    {priceInfo.configured ? (
                        <button
                            onClick={() => handlePurchaseAddOn(`exclusive_${generator?.id || "single"}`)}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                        >
                            ⭐ Unlock {title} ({priceInfo.label})
                        </button>
                    ) : (
                        <button
                            onClick={() => handlePurchaseAddOn(`inquire_${generator?.id || "exclusive"}`)}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                        >
                            💬 Contact Admin to Inquire Pricing
                        </button>
                    )}
                    <button
                        onClick={() => handlePurchaseAddOn("vip")}
                        className="w-full bg-slate-900 hover:bg-black text-amber-300 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 border border-slate-700"
                    >
                        👑 Get VIP All-Access Pass (₱8,999 once)
                    </button>
                    <button
                        onClick={() => {
                            onUpgradeClick();
                            onClose();
                        }}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl transition-all text-xs"
                    >
                        View All Creative Plans & Tiers
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
                >
                    Close
                </button>
            </div>
        </GlassModal>
    );
}
