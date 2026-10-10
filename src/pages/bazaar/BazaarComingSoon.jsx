import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicEvent, getPublicShopBySlug } from "../../services/bazaarService";
import {
    Store,
    MapPin,
    Clock,
    Sparkles,
    CheckCircle2,
    ShoppingBag,
} from "lucide-react";

export default function BazaarComingSoon() {
    const { eventId, slug } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [isEvent, setIsEvent] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchDetails() {
            setLoading(true);
            try {
                if (eventId) {
                    setIsEvent(true);
                    const ev = await getPublicEvent(eventId);
                    if (isMounted) setData(ev);
                } else if (slug) {
                    setIsEvent(false);
                    const sh = await getPublicShopBySlug(slug);
                    if (isMounted) setData(sh);
                }
            } catch (err) {
                console.error("[BazaarComingSoon] Failed to fetch public details:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchDetails();
        return () => { isMounted = false; };
    }, [eventId, slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-gray-500">Loading Storefront...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fc] flex flex-col justify-between p-4 sm:p-8 font-sans">
            {/* Header / Brand */}
            <header className="max-w-md w-full mx-auto flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                        <Store size={18} />
                    </div>
                    <span className="text-xs font-black text-gray-900 tracking-tight">
                        KenCreations Bazaar
                    </span>
                </div>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/60">
                    Self-Service Kiosk
                </span>
            </header>

            {/* Main Coming Soon Card */}
            <main className="max-w-md w-full mx-auto my-auto py-8">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] text-center space-y-6">
                    {/* Visual Icon */}
                    <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
                        <Sparkles size={30} />
                    </div>

                    {/* Titles */}
                    <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-teal-50 text-teal-700 border border-teal-200/60">
                            {isEvent ? "Bazaar Event Booth" : "Custom 3D Printing Storefront"}
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                            {data?.name || "Self-Service Ordering Opens Soon"}
                        </h1>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                            Welcome to our booth! Our mobile self-service ordering kiosk and personalized 3D customization catalog are opening soon.
                        </p>
                    </div>

                    {/* Event or Shop Details Badge */}
                    {data && (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left space-y-2 text-xs">
                            {data.venue && (
                                <div className="flex items-center gap-2 text-gray-700 font-medium">
                                    <MapPin size={15} className="text-teal-600 shrink-0" />
                                    <span>{data.venue}</span>
                                </div>
                            )}
                            {data.boothNumber && (
                                <div className="flex items-center gap-2 text-gray-700 font-medium">
                                    <ShoppingBag size={15} className="text-teal-600 shrink-0" />
                                    <span>Booth {data.boothNumber}</span>
                                </div>
                            )}
                            {(data.startDate || data.openingHours) && (
                                <div className="flex items-center gap-2 text-gray-700 font-medium">
                                    <Clock size={15} className="text-teal-600 shrink-0" />
                                    <span>{data.startDate} {data.openingHours ? `· ${data.openingHours}` : ""}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* In-Person Note */}
                    <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100 text-xs text-teal-900 text-left flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-teal-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold block">Visit our booth counter!</span>
                            <span className="text-teal-800/80 text-[11px] block mt-0.5">
                                Browse our physical samples, test our mechanical clickers and name keychains, and order directly with our makers.
                            </span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-md w-full mx-auto text-center py-4 text-[11px] text-gray-400">
                Powered by <strong className="text-gray-600 font-bold">KenCreations Studio</strong>
            </footer>
        </div>
    );
}
