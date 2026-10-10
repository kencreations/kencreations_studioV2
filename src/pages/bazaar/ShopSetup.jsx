import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    createOrUpdateShop,
    normalizeSlug,
    isValidSlug,
} from "../../services/bazaarService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import QrCodeModal from "../../components/bazaar/QrCodeModal";
import {
    Store,
    Save,
    QrCode,
    CheckCircle2,
    AlertCircle,
    Globe,
    CreditCard,
    DollarSign,
    Phone,
    Image,
    Eye,
    EyeOff,
} from "lucide-react";

export default function ShopSetup() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [bannerUrl, setBannerUrl] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [pickupInstructions, setPickupInstructions] = useState("Please pick up your items at the booth counter.");
    const [cashEnabled, setCashEnabled] = useState(true);
    const [gcashEnabled, setGcashEnabled] = useState(false);
    const [gcashName, setGcashName] = useState("");
    const [gcashNumber, setGcashNumber] = useState("");
    const [gcashQrUrl, setGcashQrUrl] = useState("");
    const [isPublished, setIsPublished] = useState(true);

    useEffect(() => {
        if (!currentUser?.uid) return;
        let isMounted = true;

        async function loadShop() {
            setLoading(true);
            try {
                const existing = await getSellerShop(currentUser.uid);
                if (existing && isMounted) {
                    setName(existing.name || "");
                    setSlug(existing.slug || "");
                    setDescription(existing.description || "");
                    setLogoUrl(existing.logoUrl || existing.logo_url || "");
                    setBannerUrl(existing.bannerUrl || existing.banner_url || "");
                    setContactNumber(existing.contactNumber || existing.contact_number || "");
                    setContactEmail(existing.contactEmail || existing.contact_email || "");
                    setPickupInstructions(existing.pickupInstructions || existing.pickup_instructions || "Please pick up your items at the booth counter.");
                    setCashEnabled(existing.cashEnabled !== false && existing.cash_enabled !== false);
                    setGcashEnabled(existing.gcashEnabled === true || existing.gcash_enabled === true);
                    setGcashName(existing.gcashName || existing.gcash_name || "");
                    setGcashNumber(existing.gcashNumber || existing.gcash_number || "");
                    setGcashQrUrl(existing.gcashQrUrl || existing.gcash_qr_url || "");
                    setIsPublished(existing.isPublished !== false && existing.is_published !== false);
                } else if (isMounted) {
                    // Default values for new shop
                    const defaultName = `${currentUser.displayName || "Maker"}'s 3D Studio`;
                    setName(defaultName);
                    setSlug(normalizeSlug(defaultName));
                    setContactEmail(currentUser.email || "");
                }
            } catch (err) {
                console.error("[ShopSetup] Failed to load shop:", err);
                if (isMounted) setErrorMessage("Failed to load existing shop details.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadShop();
        return () => { isMounted = false; };
    }, [currentUser?.uid, currentUser?.displayName, currentUser?.email]);

    const handleSave = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const normalizedSlug = normalizeSlug(slug || name);
        if (!isValidSlug(normalizedSlug)) {
            setErrorMessage("Shop slug must be between 3 and 32 characters, lowercase letters, numbers, and hyphens only.");
            return;
        }

        setSaving(true);
        try {
            await createOrUpdateShop(currentUser.uid, {
                name: name.trim() || "My 3D Print Shop",
                slug: normalizedSlug,
                description: description.trim(),
                logoUrl: logoUrl.trim(),
                bannerUrl: bannerUrl.trim(),
                contactNumber: contactNumber.trim(),
                contactEmail: contactEmail.trim(),
                pickupInstructions: pickupInstructions.trim(),
                cashEnabled,
                gcashEnabled,
                gcashName: gcashName.trim(),
                gcashNumber: gcashNumber.trim(),
                gcashQrUrl: gcashQrUrl.trim(),
                isPublished,
            });

            setSlug(normalizedSlug);
            setSuccessMessage("Shop profile and storefront updated successfully!");
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (err) {
            console.error("[ShopSetup] Save error:", err);
            setErrorMessage(err.message || "Failed to save shop. Please check your inputs.");
        } finally {
            setSaving(false);
        }
    };

    const publicShopUrl = slug ? `${window.location.origin}/#/bazaar/${slug}` : "";

    return (
        <BazaarLayout activeTab="shop">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                            <Store className="text-teal-600" size={26} />
                            Shop Configuration
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Your permanent seller identity, public storefront branding, and in-person payment settings.
                        </p>
                    </div>

                    {slug && (
                        <button
                            type="button"
                            onClick={() => setIsQrModalOpen(true)}
                            className="px-4 py-2.5 rounded-2xl bg-white text-teal-700 hover:bg-teal-50 border border-teal-200/80 font-bold text-xs shadow-2xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                        >
                            <QrCode size={16} /> View Permanent QR
                        </button>
                    )}
                </div>

                {/* Notifications */}
                {successMessage && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-teal-600 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}
                {errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2.5">
                        <AlertCircle size={18} className="text-red-600 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
                        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-gray-500">Loading shop profile...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* 1. Identity & Slug */}
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
                            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                <Globe size={18} className="text-teal-600" />
                                Storefront Identity & URL
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Shop Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (!slug) setSlug(normalizeSlug(e.target.value));
                                        }}
                                        placeholder="e.g. KenCreations 3D Studio"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Unique Shop Slug *
                                    </label>
                                    <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500">
                                        <span className="px-3 py-2.5 bg-gray-50 text-gray-400 font-mono text-xs border-r border-gray-200">
                                            /bazaar/
                                        </span>
                                        <input
                                            type="text"
                                            required
                                            value={slug}
                                            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                                            placeholder="my-3d-shop"
                                            className="w-full px-3 py-2.5 text-xs font-mono text-gray-800 focus:outline-hidden"
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Must be 3-32 characters (lowercase letters, numbers, hyphens).
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Shop Description
                                </label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tell bazaar visitors about your personalized 3D printing specialties..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
                                />
                            </div>

                            {/* Storefront Visibility Toggle */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-gray-900 block flex items-center gap-1.5">
                                        {isPublished ? <Eye size={15} className="text-teal-600" /> : <EyeOff size={15} className="text-gray-400" />}
                                        Storefront Public Visibility
                                    </span>
                                    <span className="text-[11px] text-gray-500 block">
                                        {isPublished
                                            ? "Your storefront projection is live and scannable via QR."
                                            : "Storefront is hidden (draft mode). Visitors see Coming Soon."}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsPublished(!isPublished)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                        isPublished ? "bg-teal-600" : "bg-gray-200"
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            isPublished ? "translate-x-6" : "translate-x-1"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* 2. Visual Assets & Branding */}
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
                            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                <Image size={18} className="text-teal-600" />
                                Branding & Visual Assets
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Logo Image URL
                                    </label>
                                    <input
                                        type="url"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        placeholder="https://example.com/logo.png"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Banner Image URL
                                    </label>
                                    <input
                                        type="url"
                                        value={bannerUrl}
                                        onChange={(e) => setBannerUrl(e.target.value)}
                                        placeholder="https://example.com/banner.jpg"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Contact & Pickup Instructions */}
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
                            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                <Phone size={18} className="text-teal-600" />
                                Contact & Pickup Instructions
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Contact Phone / Mobile
                                    </label>
                                    <input
                                        type="text"
                                        value={contactNumber}
                                        onChange={(e) => setContactNumber(e.target.value)}
                                        placeholder="0917-000-0000"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        placeholder="seller@example.com"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Default Pickup Instructions *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={pickupInstructions}
                                    onChange={(e) => setPickupInstructions(e.target.value)}
                                    placeholder="e.g. Counter 4 next to the 3D printer display."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Displayed to customers when their customized order is marked Ready for Pickup.
                                </p>
                            </div>
                        </div>

                        {/* 4. Payment Methods */}
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
                            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                <CreditCard size={18} className="text-teal-600" />
                                Payment Methods
                            </h3>

                            {/* Cash Option */}
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                        <DollarSign size={15} className="text-teal-600" />
                                        Cash at Booth
                                    </span>
                                    <span className="text-[11px] text-gray-500">
                                        Allow customers to pay cash directly at your counter before or after printing.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCashEnabled(!cashEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                        cashEnabled ? "bg-teal-600" : "bg-gray-200"
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            cashEnabled ? "translate-x-6" : "translate-x-1"
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* GCash Option */}
                            <div className="space-y-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                            <CreditCard size={15} className="text-teal-600" />
                                            GCash Mobile Payment
                                        </span>
                                        <span className="text-[11px] text-gray-500">
                                            Display your GCash account details and payment QR to customers upon order submission.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGcashEnabled(!gcashEnabled)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                            gcashEnabled ? "bg-teal-600" : "bg-gray-200"
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                gcashEnabled ? "translate-x-6" : "translate-x-1"
                                            }`}
                                        />
                                    </button>
                                </div>

                                {gcashEnabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200/60">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                GCash Account Name
                                            </label>
                                            <input
                                                type="text"
                                                value={gcashName}
                                                onChange={(e) => setGcashName(e.target.value)}
                                                placeholder="e.g. Juan D."
                                                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                GCash Mobile Number
                                            </label>
                                            <input
                                                type="text"
                                                value={gcashNumber}
                                                onChange={(e) => setGcashNumber(e.target.value)}
                                                placeholder="0917-123-4567"
                                                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                GCash QR Image URL
                                            </label>
                                            <input
                                                type="url"
                                                value={gcashQrUrl}
                                                onChange={(e) => setGcashQrUrl(e.target.value)}
                                                placeholder="https://.../gcash-qr.png"
                                                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-8 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-black text-xs shadow-md hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                            >
                                <Save size={16} />
                                {saving ? "Saving Shop Profile..." : "Save Shop Profile"}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Permanent Shop QR Modal */}
            {slug && (
                <QrCodeModal
                    isOpen={isQrModalOpen}
                    onClose={() => setIsQrModalOpen(false)}
                    title={`${name} Storefront`}
                    subtitle="Permanent storefront QR code for your shop."
                    url={publicShopUrl}
                    badgeText={`Shop: /${slug}`}
                    pickupInstructions={pickupInstructions}
                    shopName={name}
                />
            )}
        </BazaarLayout>
    );
}
