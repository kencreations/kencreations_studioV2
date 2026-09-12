import React from "react";
import GlassModal from "./GlassModal";

export default function ExclusiveModal({
    isOpen,
    onClose,
    generatorName,
    isLicensed,
    onUpgradeClick,
}) {
    if (!isOpen) return null;

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
            title={`Unlock ${generatorName}`}>
            <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="text-6xl mb-6">🔒</div>

                <h2 className="text-2xl font-black text-gray-900 mb-4">
                    Unlock {generatorName}
                </h2>

                {!isLicensed ? (
                    <>
                        <p className="text-gray-700 text-lg leading-relaxed mb-8 max-w-lg">
                            This is a Premium Exclusive Generator designed for
                            high-margin printing. To purchase this add-on, you
                            must first activate a Base Commercial License.
                        </p>
                        <button
                            onClick={() => {
                                onUpgradeClick();
                                onClose();
                            }}
                            className="w-full max-w-sm bg-[#FF6B00] hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all text-lg mb-4">
                            Get Base License First
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-gray-700 text-lg leading-relaxed mb-8 max-w-lg">
                            You have an active Studio Pro license! You can now
                            permanently unlock this exclusive generator, or get
                            the All-Access Pass.
                        </p>
                        <button
                            onClick={() => handlePurchaseAddOn("single")}
                            className="w-full max-w-sm bg-primary hover:bg-primary text-white font-bold py-4 rounded-xl shadow-lg transition-all text-lg mb-3">
                            Unlock {generatorName} (+₱2,999)
                        </button>
                        <button
                            onClick={() => handlePurchaseAddOn("lifetime")}
                            className="w-full max-w-sm bg-gray-900 hover:bg-gray-800 text-yellow-400 font-bold py-4 rounded-xl shadow-lg transition-all text-lg mb-4">
                            Get Lifetime All-Access Pass (+₱8,999)
                        </button>
                    </>
                )}

                <button
                    onClick={onClose}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
                    Cancel
                </button>
            </div>
        </GlassModal>
    );
}
