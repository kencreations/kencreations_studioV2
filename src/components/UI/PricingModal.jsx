import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { activateLicense } from "../../services/LicenseService";
import GlassModal from "./GlassModal";
import LegalModal from "./LegalModal";
import {
    PRICING_PLANS,
    COMPARISON_FEATURES,
    PRICING_FAQS,
    SINGLE_EXCLUSIVE_PRICE,
    formatPhp,
} from "../../data/pricingPlans";

const CheckIcon = () => (
    <svg className="w-5 h-5 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const CrossIcon = () => (
    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export default function PricingModal({ isOpen = true, onClose, embedded = false }) {
    const { currentUser, loginWithGoogle, fetchUserData } = useAuth();
    const [view, setView] = useState("pricing"); // "pricing" | "activate" | "checkout_request"
    const [billingCycle, setBillingCycle] = useState("monthly"); // "monthly" | "yearly"
    const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState(null);
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    // Activation State
    const [licenseKey, setLicenseKey] = useState("");
    const [legalAgreed, setLegalAgreed] = useState(false);
    const [legalDoc, setLegalDoc] = useState(null);
    const [hwid, setHwid] = useState("");
    const [activationStatus, setActivationStatus] = useState("idle"); // 'idle' | 'activating' | 'success' | 'error'
    const [activationMessage, setActivationMessage] = useState("");
    const [copiedHwid, setCopiedHwid] = useState(false);

    const isDesktop = typeof window !== "undefined" && Boolean(window.electronAPI);

    useEffect(() => {
        const loadHwid = async () => {
            if (window.electronAPI?.getHwid) {
                try {
                    const id = await window.electronAPI.getHwid();
                    setHwid(id);
                } catch {
                    setHwid("HWID-UNAVAILABLE");
                }
            } else {
                setHwid("WEB-CLIENT-" + (currentUser?.uid ? currentUser.uid.slice(0, 10) : "DEV"));
            }
        };
        loadHwid();
    }, [currentUser]);

    const handleCopyHwid = useCallback(() => {
        if (!hwid) return;
        navigator.clipboard.writeText(hwid).then(() => {
            setCopiedHwid(true);
            setTimeout(() => setCopiedHwid(false), 2000);
        });
    }, [hwid]);

    if (!isOpen && !embedded) return null;

    const handleSelectPlan = (planKey, cycle = billingCycle) => {
        const plan = PRICING_PLANS[planKey];
        if (!plan) return;
        const priceInfo = plan.prices[cycle] || plan.prices.lifetime || plan.prices.monthly;
        setSelectedCheckoutPlan({
            planKey,
            planName: plan.name,
            badge: plan.badge,
            cycle,
            amount: priceInfo.amount,
            formatted: priceInfo.formatted,
            period: priceInfo.period,
            description: plan.description,
            hubAccess: plan.hubAccess,
            generatorAccess: plan.generatorAccess,
        });
        setView("checkout_request");
    };

    const handleSelectSingleExclusive = () => {
        setSelectedCheckoutPlan({
            planKey: "single_exclusive",
            planName: "Individual Exclusive Generator",
            badge: "LIFETIME ADD-ON",
            cycle: "lifetime",
            amount: 0,
            formatted: "Individually Priced",
            period: "one-time per generator",
            description: SINGLE_EXCLUSIVE_PRICE.description,
            hubAccess: "None",
            generatorAccess: "Selected Single Exclusive Generator Only",
        });
        setView("checkout_request");
    };

    const handleContactMessenger = (planRef) => {
        const url = `https://www.facebook.com/kenjovenie.samonte?ref=plan_${encodeURIComponent(planRef || "inquiry")}`;
        if (window.electronAPI && window.electronAPI.openExternalUrl) {
            window.electronAPI.openExternalUrl(url);
        } else {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const handleOnlineActivate = async () => {
        if (!licenseKey.trim()) {
            setActivationMessage("Please enter a valid license key.");
            setActivationStatus("error");
            return;
        }

        setActivationStatus("activating");
        setActivationMessage("Verifying license with server...");

        try {
            if (isDesktop) {
                const result = await window.electronAPI.activateWithKey(licenseKey.trim());
                if (result.success) {
                    setActivationStatus("success");
                    setActivationMessage(result.message || "License activated successfully!");
                    setTimeout(() => {
                        onClose();
                        window.dispatchEvent(new Event("license-activated"));
                    }, 1200);
                } else {
                    setActivationStatus("error");
                    setActivationMessage(result.message || "Activation failed. Please check your key.");
                }
            } else {
                const user = currentUser || (await loginWithGoogle());
                const result = await activateLicense(licenseKey.trim(), user);
                if (!result.success) throw new Error(result.message);
                await fetchUserData(user.uid);
                setActivationStatus("success");
                setActivationMessage("License activated successfully!");
                setTimeout(() => {
                    onClose();
                }, 1200);
            }
        } catch (err) {
            console.error(err);
            setActivationStatus("error");
            setActivationMessage(err.message || "An unexpected error occurred during activation.");
        }
    };

    const handleLoadOfflineLicense = async () => {
        if (!isDesktop) {
            setActivationMessage("Offline license loading is only supported in the desktop application.");
            setActivationStatus("error");
            return;
        }

        setActivationStatus("activating");
        setActivationMessage("Loading offline license file...");

        try {
            const result = await window.electronAPI.loadOfflineLicense();
            if (result.success) {
                setActivationStatus("success");
                setActivationMessage(result.message || "License file verified successfully!");
                setTimeout(() => {
                    onClose();
                    window.dispatchEvent(new Event("license-activated"));
                }, 1200);
            } else {
                setActivationStatus("error");
                setActivationMessage(result.message || "Failed to load offline license file.");
            }
        } catch (err) {
            console.error(err);
            setActivationStatus("error");
            setActivationMessage("An error occurred reading the license file.");
        }
    };

    const plans = [PRICING_PLANS.basic, PRICING_PLANS.pro, PRICING_PLANS.pro_plus, PRICING_PLANS.vip];

    const modalTitle =
        view === "activate"
            ? "Activate Purchased License"
            : view === "checkout_request"
            ? "Complete Your License Order"
            : "KenCreations Studio Plans";

    const content = (
        <>
            {view === "pricing" && (
                <div className="flex flex-col text-gray-900 w-full">
                    {/* Header Section */}
                    <div className="text-center max-w-3xl mx-auto mb-8 pt-2">
                        <span className="inline-block bg-teal-50 text-teal-700 text-xs font-black tracking-widest px-3 py-1 rounded-full uppercase mb-3 border border-teal-200/60">
                            Pricing & License Tiers
                        </span>
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-3">
                            Choose Your Creative Plan
                        </h1>
                        <p className="text-base md:text-lg text-gray-600 font-medium leading-relaxed">
                            Professional 3D design tools for creators and printing businesses.
                        </p>

                        {/* Simplified Segmented Billing Toggle */}
                        <div className="flex flex-col items-center justify-center mt-6">
                            <div className="inline-flex items-center p-1.5 bg-gray-100 border border-gray-200/90 rounded-2xl shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle("monthly")}
                                    className={`px-6 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-200 ${
                                        billingCycle === "monthly"
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle("yearly")}
                                    className={`px-6 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-200 flex items-center gap-2 ${
                                        billingCycle === "yearly"
                                            ? "bg-teal-600 text-white shadow-sm"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    <span>Yearly</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                        billingCycle === "yearly"
                                            ? "bg-white/20 text-white"
                                            : "bg-emerald-100 text-emerald-800"
                                    }`}>
                                        Save ~17%
                                    </span>
                                </button>
                            </div>
                            <span className="text-[11px] text-gray-500 font-medium mt-2">
                                {billingCycle === "yearly"
                                    ? "Annual billing applied to Basic & Pro (Pro+ & VIP remain Lifetime)"
                                    : "Standard monthly billing for Basic & Pro"}
                            </span>
                        </div>
                    </div>

                    {/* Four Pricing Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full items-stretch">
                        {plans.map((plan) => {
                            const isPro = plan.id === "pro";
                            const isVip = plan.id === "vip";
                            const isProPlus = plan.id === "pro_plus";
                            const isBasic = plan.id === "basic";

                            const isRecurring = isBasic || isPro;
                            const activePrice = isRecurring
                                ? plan.prices[billingCycle]
                                : plan.prices.lifetime;

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-3xl p-6 flex flex-col justify-between h-full transition-all duration-300 ${
                                        isPro
                                            ? "bg-white border-2 border-teal-500 shadow-[0_8px_30px_rgba(20,184,166,0.18)] scale-[1.02] z-10"
                                            : isVip
                                            ? "bg-gradient-to-b from-slate-900 to-slate-950 text-white border border-slate-700 shadow-2xl"
                                            : isProPlus
                                            ? "bg-white border-2 border-amber-300/80 shadow-lg hover:border-amber-400"
                                            : "bg-white border border-gray-200 shadow-sm hover:border-gray-300"
                                    }`}
                                >
                                    {/* Card Top Section */}
                                    <div>
                                        {/* Badge Header */}
                                        <div className="flex items-center justify-between mb-3 min-h-[26px]">
                                            <span
                                                className={`text-[10px] font-black tracking-wider px-3 py-1 rounded-full uppercase ${
                                                    isPro
                                                        ? "bg-teal-500 text-white shadow-sm"
                                                        : isVip
                                                        ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md"
                                                        : isProPlus
                                                        ? "bg-amber-50 text-amber-900 border border-amber-200 font-black"
                                                        : "bg-gray-100 text-gray-700 border border-gray-200 font-bold"
                                                }`}
                                            >
                                                {plan.badge}
                                            </span>
                                            {isRecurring && billingCycle === "yearly" && (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                    {plan.id === "basic" ? "Save ₱398" : "Save ₱798"}
                                                </span>
                                            )}
                                        </div>

                                        {/* Plan Name & Tagline */}
                                        <h3
                                            className={`text-2xl font-black mb-1 tracking-tight ${
                                                isVip ? "text-white" : "text-gray-900"
                                            }`}
                                        >
                                            {plan.name}
                                        </h3>
                                        <p
                                            className={`text-xs leading-relaxed min-h-[42px] mb-4 ${
                                                isVip ? "text-slate-300" : "text-gray-500"
                                            }`}
                                        >
                                            {plan.description}
                                        </p>

                                        {/* Price Block */}
                                        <div className="py-4 my-2 border-y border-dashed border-gray-200/80 flex flex-col justify-center min-h-[96px]">
                                            <div className="flex items-baseline gap-1.5">
                                                <span
                                                    className={`text-4xl font-black tracking-tight ${
                                                        isVip ? "text-white" : "text-gray-900"
                                                    }`}
                                                >
                                                    {activePrice.formatted}
                                                </span>
                                                <span
                                                    className={`text-xs font-bold uppercase tracking-wider ${
                                                        isVip ? "text-slate-400" : "text-gray-500"
                                                    }`}
                                                >
                                                    {activePrice.period}
                                                </span>
                                            </div>
                                            <div className="text-[11px] font-semibold mt-1">
                                                {isRecurring ? (
                                                    <span className={isVip ? "text-slate-400" : "text-gray-500"}>
                                                        {billingCycle === "yearly"
                                                            ? `₱${activePrice.rawMonthlyEquivalent.toFixed(2)} / mo billed annually`
                                                            : "Standard monthly auto-billing"}
                                                    </span>
                                                ) : (
                                                    <span className={isVip ? "text-amber-400 font-bold" : "text-teal-600 font-bold"}>
                                                        One-time payment • Never expires
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Spec Summary Checklist */}
                                        <div className="space-y-2.5 my-4 text-xs">
                                            <div className="flex items-start gap-2">
                                                <CheckIcon />
                                                <span className={isVip ? "text-slate-200" : "text-gray-700"}>
                                                    <strong className={isVip ? "text-white" : "text-gray-900"}>Generators:</strong>{" "}
                                                    {plan.generatorAccess}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                {plan.hubAccess === "None" ? <CrossIcon /> : <CheckIcon />}
                                                <span className={plan.hubAccess === "None" ? (isVip ? "text-slate-400 line-through" : "text-gray-400") : (isVip ? "text-slate-200" : "text-gray-700")}>
                                                    <strong className={isVip ? "text-white" : "text-gray-900"}>Hubs:</strong>{" "}
                                                    {plan.hubAccess}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckIcon />
                                                <span className={isVip ? "text-slate-200" : "text-gray-700"}>
                                                    <strong className={isVip ? "text-white" : "text-gray-900"}>Exclusives:</strong>{" "}
                                                    {plan.exclusivePolicy}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckIcon />
                                                <span className={isVip ? "text-slate-200" : "text-gray-700"}>
                                                    <strong className={isVip ? "text-white" : "text-gray-900"}>Commercial Rights:</strong>{" "}
                                                    {plan.commercialPrinting}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectPlan(plan.id, isRecurring ? billingCycle : "lifetime")}
                                        className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 mt-4 ${
                                            isPro
                                                ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20 shadow-md hover:shadow-lg active:scale-[0.99]"
                                                : isVip
                                                ? "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black shadow-amber-500/30 shadow-lg active:scale-[0.99]"
                                                : isProPlus
                                                ? "bg-gray-900 hover:bg-black text-white hover:shadow-md active:scale-[0.99]"
                                                : "bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 active:scale-[0.99]"
                                        }`}
                                    >
                                        {isPro
                                            ? "Get Studio Pro"
                                            : isVip
                                            ? "Join VIP All-Access"
                                            : isProPlus
                                            ? "Get Pro+ Lifetime"
                                            : "Choose Basic"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Individual Exclusive Generator Banner */}
                    <div className="mt-8 bg-gradient-to-r from-teal-50 via-teal-100/50 to-teal-50 border border-teal-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full">
                        <div className="flex items-center gap-3.5 text-center sm:text-left">
                            <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                                ⭐
                            </div>
                            <div>
                                <h4 className="font-extrabold text-gray-900 text-sm md:text-base">
                                    Need a single exclusive tool?
                                </h4>
                                <p className="text-xs text-gray-600">
                                    Purchase individual permanent access to any Exclusive Generator without upgrading to VIP. Separately purchased tools remain owned permanently.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSelectSingleExclusive}
                            className="whitespace-nowrap px-5 py-2.5 bg-white hover:bg-gray-50 text-teal-800 border border-teal-300 rounded-xl font-bold text-xs shadow-sm transition-all"
                        >
                            Inquire Exclusive Tools
                        </button>
                    </div>

                        {/* Detailed Comparison Table */}
                        <div className="mt-10 max-w-7xl mx-auto w-full">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                    Compare All Plan Features
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Detailed breakdown of generator categories, business hubs, and commercial capabilities.
                                </p>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-2xl bg-white shadow-sm">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="py-4 px-4 font-black text-gray-900 w-2/5">Feature</th>
                                            <th className="py-4 px-3 font-bold text-gray-700 text-center w-[15%]">Basic</th>
                                            <th className="py-4 px-3 font-black text-teal-700 bg-teal-50/50 text-center w-[15%]">Pro (Rec.)</th>
                                            <th className="py-4 px-3 font-bold text-gray-700 text-center w-[15%]">Pro+</th>
                                            <th className="py-4 px-3 font-black text-slate-900 text-center w-[15%]">VIP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {COMPARISON_FEATURES.map((section, sIdx) => (
                                            <React.Fragment key={sIdx}>
                                                <tr className="bg-gray-50/80 font-black text-gray-800 text-xs uppercase tracking-wider">
                                                    <td colSpan={5} className="py-2.5 px-4 bg-slate-50 border-y border-gray-200">
                                                        {section.category}
                                                    </td>
                                                </tr>
                                                {section.items.map((item, iIdx) => (
                                                    <tr key={iIdx} className="hover:bg-gray-50/60 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="font-bold text-gray-900">{item.name}</div>
                                                            {item.note && <div className="text-[11px] text-gray-400 font-normal">{item.note}</div>}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            {typeof item.basic === "boolean" ? (
                                                                item.basic ? <span className="inline-flex justify-center"><CheckIcon /></span> : <span className="inline-flex justify-center"><CrossIcon /></span>
                                                            ) : (
                                                                <span className="font-semibold text-gray-700 text-xs">{item.basic}</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-center bg-teal-50/20">
                                                            {typeof item.pro === "boolean" ? (
                                                                item.pro ? <span className="inline-flex justify-center"><CheckIcon /></span> : <span className="inline-flex justify-center"><CrossIcon /></span>
                                                            ) : (
                                                                <span className="font-bold text-teal-800 text-xs">{item.pro}</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            {typeof item.pro_plus === "boolean" ? (
                                                                item.pro_plus ? <span className="inline-flex justify-center"><CheckIcon /></span> : <span className="inline-flex justify-center"><CrossIcon /></span>
                                                            ) : (
                                                                <span className="font-semibold text-gray-700 text-xs">{item.pro_plus}</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            {typeof item.vip === "boolean" ? (
                                                                item.vip ? <span className="inline-flex justify-center"><CheckIcon /></span> : <span className="inline-flex justify-center"><CrossIcon /></span>
                                                            ) : (
                                                                <span className="font-black text-gray-900 text-xs">{item.vip}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Frequently Asked Questions Section */}
                        <div className="mt-10 max-w-4xl mx-auto w-full pb-6">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                    Frequently Asked Questions
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Clear answers about licenses, exclusivity, and commercial selling rights.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {PRICING_FAQS.map((faq, idx) => {
                                    const isOpenFaq = openFaqIndex === idx;
                                    return (
                                        <div
                                            key={idx}
                                            className="border border-gray-200 rounded-2xl bg-white overflow-hidden transition-all shadow-sm"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setOpenFaqIndex(isOpenFaq ? null : idx)}
                                                className="w-full py-4 px-5 flex items-center justify-between text-left font-bold text-gray-900 text-sm md:text-base hover:text-teal-700 transition-colors"
                                            >
                                                <span>{faq.q}</span>
                                                <svg
                                                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ml-3 ${
                                                        isOpenFaq ? "rotate-180 text-teal-600" : ""
                                                    }`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {isOpenFaq && (
                                                <div className="px-5 pb-5 pt-1 text-xs md:text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/50">
                                                    {faq.a}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer Switcher to Activation */}
                        <div className="mt-8 text-center pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => setView("activate")}
                                className="text-sm font-bold text-teal-600 hover:text-teal-700 transition-colors"
                            >
                                Already have a license key? Click here to activate →
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW B: Checkout Order Request Modal */}
                {view === "checkout_request" && selectedCheckoutPlan && (
                    <div className="max-w-xl mx-auto w-full py-4">
                        <button
                            type="button"
                            onClick={() => setView("pricing")}
                            className="text-xs font-bold text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-1.5 transition-colors"
                        >
                            ← Back to plan choices
                        </button>

                        <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <span className="bg-teal-50 text-teal-800 text-xs font-black px-3 py-1 rounded-full uppercase border border-teal-200">
                                    {selectedCheckoutPlan.badge}
                                </span>
                                <span className="text-xs font-bold text-gray-400">
                                    Order Summary
                                </span>
                            </div>

                            <h2 className="text-2xl font-black text-gray-900 mb-1">
                                {selectedCheckoutPlan.planName}
                            </h2>
                            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                                {selectedCheckoutPlan.description}
                            </p>

                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 mb-6 flex items-baseline justify-between">
                                <div>
                                    <span className="text-xs font-semibold text-gray-500 block">Total Due</span>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {selectedCheckoutPlan.cycle === "yearly" ? "Billed annually" : selectedCheckoutPlan.period}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-gray-900">
                                        {selectedCheckoutPlan.formatted}
                                    </span>
                                    <span className="text-xs font-bold text-gray-500 block">PHP</span>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6 text-xs text-gray-600 bg-teal-50/40 p-4 rounded-xl border border-teal-100">
                                <div className="flex items-center gap-2">
                                    <CheckIcon />
                                    <span><strong>Generators:</strong> {selectedCheckoutPlan.generatorAccess}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckIcon />
                                    <span><strong>Hub Access:</strong> {selectedCheckoutPlan.hubAccess}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckIcon />
                                    <span><strong>Commercial Rights:</strong> Full rights to sell printed models</span>
                                </div>
                            </div>

                            {/* Manual Fulfillment Information */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-900 leading-relaxed">
                                <strong className="font-bold block mb-1">Direct Manual Fulfillment Notice:</strong>
                                KenCreations Studio currently operates on manual payment confirmation (GCash / Bank Transfer). To activate your software immediately:
                                <ol className="list-decimal list-inside mt-2 space-y-1 font-medium">
                                    <li>Copy your Hardware ID below.</li>
                                    <li>Message Ken directly on Facebook Messenger with your chosen plan.</li>
                                    <li>Receive your official license code for instant activation.</li>
                                </ol>
                            </div>

                            {/* HWID copy helper */}
                            <div className="mb-6">
                                <label className="block text-gray-900 text-xs font-bold mb-1.5">
                                    Your Device Hardware ID:
                                </label>
                                <div className="bg-gray-100 p-3 rounded-xl font-mono text-xs text-gray-800 break-all border border-gray-200 flex items-center justify-between gap-3">
                                    <span className="select-all font-semibold">{hwid || "Loading..."}</span>
                                    <button
                                        type="button"
                                        onClick={handleCopyHwid}
                                        className="text-xs font-bold px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg border border-gray-300 shadow-sm shrink-0"
                                    >
                                        {copiedHwid ? "✅ Copied" : "📋 Copy"}
                                    </button>
                                </div>
                            </div>

                            {/* Messenger Order Button */}
                            <button
                                type="button"
                                onClick={() => handleContactMessenger(selectedCheckoutPlan.planKey)}
                                className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 mb-3"
                            >
                                <span>💬 Message Ken to Order ({selectedCheckoutPlan.formatted})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setView("activate")}
                                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-xs transition-colors"
                            >
                                I already received my code → Activate Now
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW C: License Activation View */}
                {view === "activate" && (
                    <div className="max-w-md mx-auto w-full py-6">
                        <button
                            type="button"
                            onClick={() => setView("pricing")}
                            className="text-xs font-bold text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-1 transition-colors"
                        >
                            ← Back to Pricing
                        </button>

                        <h2 className="text-2xl font-black text-gray-900 mb-2">
                            Enter License Key
                        </h2>
                        <p className="text-xs text-gray-600 mb-6 leading-relaxed">
                            Enter your official KenCreations license key below. Hardware-bound desktop users can also load an offline <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono">.lic</code> file.
                        </p>

                        {/* HWID Display */}
                        <div className="mb-6">
                            <label className="block text-gray-900 text-xs font-bold mb-1.5">
                                Your Hardware ID
                            </label>
                            <div className="bg-gray-100 p-3.5 rounded-xl text-teal-900 font-mono text-xs break-all border border-gray-200 shadow-inner flex flex-col gap-2.5">
                                <span className="select-all block leading-relaxed">{hwid || "Loading..."}</span>
                                <button
                                    type="button"
                                    onClick={handleCopyHwid}
                                    disabled={!hwid}
                                    className="self-end text-xs font-bold text-gray-800 bg-white hover:bg-gray-50 active:scale-95 px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {copiedHwid ? "✅ Copied!" : "📋 Copy HWID"}
                                </button>
                            </div>
                        </div>

                        <label className="block text-gray-900 text-xs font-bold mb-1.5">
                            License Key
                        </label>
                        <input
                            type="text"
                            value={licenseKey}
                            onChange={(e) => {
                                setLicenseKey(e.target.value);
                                setActivationStatus("idle");
                                setActivationMessage("");
                            }}
                            disabled={activationStatus === "activating"}
                            placeholder="KC-XXXXXX or XXXX-XXXX-XXXX"
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 font-mono tracking-widest outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 mb-6 disabled:opacity-60 text-sm"
                            onKeyDown={(e) => e.key === "Enter" && legalAgreed && licenseKey.trim() && handleOnlineActivate()}
                        />

                        {/* Legal Agreement Checkbox */}
                        <div className="flex items-start gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <input
                                type="checkbox"
                                id="legal-agree"
                                checked={legalAgreed}
                                onChange={(e) => setLegalAgreed(e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-teal-600 cursor-pointer"
                            />
                            <label htmlFor="legal-agree" className="text-xs text-gray-600 leading-relaxed cursor-pointer select-none">
                                I agree to the{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc("terms");
                                    }}
                                    className="text-teal-600 font-bold hover:underline"
                                >
                                    Terms & Conditions
                                </button>
                                ,{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc("privacy");
                                    }}
                                    className="text-teal-600 font-bold hover:underline"
                                >
                                    Privacy Policy
                                </button>
                                , and{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc("refund");
                                    }}
                                    className="text-teal-600 font-bold hover:underline"
                                >
                                    Refund Policy
                                </button>
                                .
                            </label>
                        </div>

                        {activationMessage && (
                            <div
                                className={`px-4 py-3 rounded-xl text-xs font-semibold mb-4 text-center transition-all ${
                                    activationStatus === "error"
                                        ? "bg-red-50 border border-red-200 text-red-700"
                                        : activationStatus === "success"
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                        : "bg-blue-50 border border-blue-200 text-blue-700"
                                }`}
                            >
                                {activationStatus === "activating" && (
                                    <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                                )}
                                {activationMessage}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleOnlineActivate}
                            disabled={!legalAgreed || !licenseKey.trim() || activationStatus === "activating"}
                            className={`w-full font-bold py-3.5 rounded-xl shadow-md transition-all text-sm mb-3 flex items-center justify-center gap-2 ${
                                legalAgreed && licenseKey.trim() && activationStatus !== "activating"
                                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            {activationStatus === "activating" ? (
                                <>
                                    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Verifying with Server...
                                </>
                            ) : (
                                "Activate Software"
                            )}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">OR</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Load Offline License Button */}
                        <button
                            type="button"
                            onClick={handleLoadOfflineLicense}
                            disabled={activationStatus === "activating" || !isDesktop}
                            className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl border border-gray-300 shadow-sm transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            📁 Load Offline License (.lic)
                        </button>
                    </div>
                )}
        </>
    );

    if (embedded) {
        return (
            <div className="w-full">
                {content}
                <LegalModal
                    isOpen={Boolean(legalDoc)}
                    documentType={legalDoc}
                    onClose={() => setLegalDoc(null)}
                />
            </div>
        );
    }

    return (
        <>
            <GlassModal
                isOpen={true}
                onClose={onClose}
                maxWidth="max-w-7xl"
                title={modalTitle}
            >
                {content}
            </GlassModal>

            {/* Legal Documents Modal */}
            <LegalModal
                isOpen={Boolean(legalDoc)}
                documentType={legalDoc}
                onClose={() => setLegalDoc(null)}
            />
        </>
    );
}
