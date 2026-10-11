import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
    getPublicShopBySlug,
    getPublicShopById,
    getPublicEventBySlugOrId,
    getPublicProducts,
} from "../../../services/bazaarService";
import { loadCart, calculateCartSummary } from "../../../utils/bazaarCart";
import { bazaarOperation } from '../../../services/bazaarDiagnostics';
import StorefrontLayout from "../../../components/bazaar/storefront/StorefrontLayout";
import {
    Search,
    Sparkles,
    ArrowRight,
    Tag,
    MapPin,
    AlertCircle,
    AlertTriangle,
    ShieldAlert,
    WifiOff,
    RefreshCw,
} from "lucide-react";

export default function CustomerStorefront() {
    const { shopSlug: paramShopSlug, slug: legacySlug, eventSlug, eventId: legacyEventId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Support both modern /shop/:shopSlug and legacy /bazaar/:slug
    const activeShopSlug = paramShopSlug || legacySlug || "";
    const activeEventParam = eventSlug || legacyEventId || searchParams.get("event") || "";

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [eventNotice, setEventNotice] = useState(null);
    const [retry, setRetry] = useState(0);
    const [shop, setShop] = useState(null);
    const [event, setEvent] = useState(null);
    const [products, setProducts] = useState([]);
    const [eventCatalogMap, setEventCatalogMap] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [cartItems, setCartItems] = useState([]);

    // Refresh cart items from storage
    const refreshCart = useCallback(() => {
        if (!shop?.slug && !activeShopSlug) return;
        const evKey = event?.slug || event?.eventId || event?.id || activeEventParam || "general";
        const items = loadCart(shop?.slug || activeShopSlug, evKey);
        setCartItems(items);
    }, [activeShopSlug, shop?.slug, event?.slug, event?.eventId, event?.id, activeEventParam]);

    // Fetch lifetime depends on route identity only, never loaded event objects.
    useEffect(() => {
        let active = true;
        queueMicrotask(() => { if (active) { setLoading(true); setLoadError(null); setEventNotice(null); setProducts([]); setEventCatalogMap({}); } });
        bazaarOperation('load-storefront', 'public_events/{event}/public_shops/{shop}/public_products', async () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw Object.assign(new Error('You appear to be offline. Check your internet connection and try again.'), { code: 'unavailable' });
            }

            let ev = null;
            let notice = null;
            if (activeEventParam) {
                try {
                    ev = await getPublicEventBySlugOrId(activeEventParam);
                    if (!ev) {
                        notice = `Event "${activeEventParam}" could not be found or has not been published yet. Showing full shop catalog.`;
                    }
                } catch (e) {
                    console.warn('[CustomerStorefront] Safe event resolution fallback:', e?.message);
                    notice = `Notice: Event "${activeEventParam}" could not be verified (${e?.code || 'offline'}). Showing full shop catalog.`;
                }
            }

            const seller = activeShopSlug ? await getPublicShopBySlug(activeShopSlug) : ev?.shopId ? await getPublicShopById(ev.shopId) : null;
            if (!seller) throw new Error('This maker shop is missing or has not been published yet.');
            if (ev && ev.shopId && ev.shopId !== (seller.shopId || seller.id)) {
                ev = null;
                notice = `Event "${activeEventParam}" belongs to a different shop. Showing full catalog.`;
            }

            const catalog = await getPublicProducts(seller.shopId || seller.id);
            return { ev, seller, catalog, notice };
        }).then(({ ev, seller, catalog, notice }) => {
            if (!active) return;
            setEvent(ev);
            setShop(seller);
            setProducts(catalog);
            setEventCatalogMap(ev?.catalog || {});
            if (notice) setEventNotice(notice);
        }).catch(error => {
            if (!active) return;
            setLoadError({
                message: error.code === 'permission-denied'
                    ? 'Storefront access was denied. Please ask the seller to verify publication status.'
                    : (error.message || 'Storefront could not be loaded.'),
                code: error.code || 'unknown',
            });
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [activeShopSlug, activeEventParam, retry]);
    useEffect(() => {
        let active = true;
        queueMicrotask(() => { if (active) refreshCart(); });
        window.addEventListener('bazaar_cart_updated', refreshCart);
        return () => { active = false; window.removeEventListener('bazaar_cart_updated', refreshCart); };
    }, [refreshCart]);

    // Compute cart summary
    const { itemCount, subtotal } = useMemo(() => {
        return calculateCartSummary(cartItems);
    }, [cartItems]);

    // Filter products based on event availability, category, and search query
    const displayedProducts = useMemo(() => {
        return products.filter((prod) => {
            // 1. If in event context, check if product is enabled for this event
            if (event && eventCatalogMap && Object.keys(eventCatalogMap).length > 0) {
                const eventConfig = eventCatalogMap[prod.productId || prod.id];
                if (!eventConfig || eventConfig.enabled === false) {
                    return false;
                }
            }

            // 2. Category filter
            if (selectedCategory !== "all") {
                const prodCat = String(prod.category || "").toLowerCase();
                if (prodCat !== selectedCategory.toLowerCase()) return false;
            }

            // 3. Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = (prod.name || prod.title || "").toLowerCase().includes(q);
                const descMatch = (prod.description || "").toLowerCase().includes(q);
                if (!nameMatch && !descMatch) return false;
            }

            return true;
        });
    }, [products, event, eventCatalogMap, selectedCategory, searchQuery]);

    // Categories list
    const categories = useMemo(() => {
        const set = new Set(["all"]);
        for (const p of products) {
            if (p.category) set.add(p.category.toLowerCase());
        }
        return Array.from(set);
    }, [products]);

    // Navigate to product customization
    const handleSelectProduct = (product) => {
        const prodId = product.productId || product.id;
        const currentShopSlug = shop?.slug || activeShopSlug;
        const evQuery = event ? `?event=${event.slug || event.eventId || event.id}` : "";
        navigate(`/shop/${currentShopSlug}/product/${prodId}${evQuery}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-gray-500">Loading Storefront Catalog...</p>
            </div>
        );
    }

    if (loadError) {
        const isPermission = loadError.code === 'permission-denied' || String(loadError.message).toLowerCase().includes('permission');
        const isOffline = loadError.code === 'unavailable' || loadError.code === 'deadline-exceeded' || (typeof navigator !== 'undefined' && !navigator.onLine);

        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div role="alert" className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-5 animate-in fade-in duration-200">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                        isPermission ? 'bg-red-50 text-red-600' : isOffline ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-700'
                    }`}>
                        {isPermission ? <ShieldAlert size={28} /> : isOffline ? <WifiOff size={28} /> : <AlertTriangle size={28} />}
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                            {isPermission ? 'Security & Permissions' : isOffline ? 'Connection Status' : 'Storefront Error'}
                        </span>
                        <h2 className="text-lg font-black text-gray-900 tracking-tight">
                            {isPermission ? 'Access Denied' : isOffline ? 'Connection Unavailable' : 'Storefront Unavailable'}
                        </h2>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            {loadError.message}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setRetry((n) => n + 1)}
                            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw size={14} />
                            <span>Retry Storefront</span>
                        </button>
                        <Link
                            to="/"
                            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all text-center"
                        >
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!shop) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                        <AlertCircle size={28} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Storefront Not Found</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        This seller shop does not exist or has not been published yet. Please double check the QR code link.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <StorefrontLayout
            shop={shop}
            event={event}
            cartItemCount={itemCount}
            cartSubtotal={subtotal}
        >
            <div className="space-y-6">
                {/* Event Notice / Status Notification */}
                {eventNotice && (
                    <div className="p-4 rounded-2xl text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-900 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                            <AlertCircle size={16} className="text-teal-600 shrink-0" />
                            <span>{eventNotice}</span>
                        </div>
                        {activeEventParam && (
                            <button
                                type="button"
                                onClick={() => navigate(`/shop/${shop?.slug || activeShopSlug}`)}
                                className="text-[11px] font-bold text-gray-500 hover:text-gray-800 underline whitespace-nowrap cursor-pointer"
                            >
                                Clear event filter
                            </button>
                        )}
                    </div>
                )}
                {/* Hero / Event Banner */}
                {event ? (
                    <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
                        <div className="relative z-10 space-y-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-teal-200 border border-white/15 backdrop-blur-xs">
                                <Sparkles size={11} /> Live Bazaar Booth
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                                {event.name}
                            </h2>
                            <p className="text-xs text-teal-100/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                                {event.venue && (
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} className="text-teal-300" /> {event.venue}
                                    </span>
                                )}
                                {event.boothNumber && (
                                    <span>• Booth #{event.boothNumber}</span>
                                )}
                            </p>
                        </div>
                    </div>
                ) : shop.description ? (
                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-1.5">
                        <h2 className="text-sm font-black text-gray-900">About Our Shop</h2>
                        <p className="text-xs text-gray-500 leading-relaxed">{shop.description}</p>
                    </div>
                ) : null}

                {/* Search & Filter Bar */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products or toys..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-2xs"
                        />
                    </div>

                    {/* Category Filter Pills */}
                    {categories.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all cursor-pointer ${
                                        selectedCategory === cat
                                            ? "bg-teal-600 text-white shadow-xs"
                                            : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
                                    }`}
                                >
                                    {cat === "all" ? "All Items" : cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Catalog Grid */}
                {displayedProducts.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                            <Tag size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800">No products available</h3>
                        <p className="text-xs text-gray-400 max-w-xs mx-auto">
                            {searchQuery
                                ? `No items matched "${searchQuery}". Try a different keyword.`
                                : "The seller hasn't listed any public products for this catalog yet."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {displayedProducts.map((prod) => {
                            const prodId = prod.productId || prod.id;
                            const isMadeToOrder = prod.type === "made_to_order";
                            
                            // Event price override if configured
                            const eventConfig = eventCatalogMap[prodId];
                            const hasOverride = eventConfig && typeof eventConfig.price_override === "number";
                            const displayPrice = hasOverride ? eventConfig.price_override : prod.retailPrice || prod.price || 0;

                            const isOutOfStock = prod.inStock === false;

                            return (
                                <div
                                    key={prodId}
                                    onClick={() => !isOutOfStock && handleSelectProduct(prod)}
                                    className={`group bg-white rounded-3xl p-4 border border-gray-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer ${
                                        isOutOfStock ? "opacity-60 cursor-not-allowed" : "hover:border-teal-200"
                                    }`}
                                >
                                    <div className="space-y-3">
                                        {/* Product Image / Icon placeholder */}
                                        <div className="w-full h-36 rounded-2xl bg-gradient-to-tr from-gray-100 to-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden relative">
                                            {prod.images && prod.images[0] ? (
                                                <img
                                                    src={prod.images[0]}
                                                    alt={prod.name}
                                                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1.5 text-gray-300">
                                                    <Sparkles size={28} className="text-teal-400" />
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                        {prod.category || "3D Print"}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Top badges */}
                                            <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/90 text-teal-800 shadow-2xs backdrop-blur-xs">
                                                    {isMadeToOrder ? "Customizable" : "Ready-Made"}
                                                </span>
                                                {hasOverride && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-2xs">
                                                        Special
                                                    </span>
                                                )}
                                            </div>

                                            {isOutOfStock && (
                                                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                                                    <span className="px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-md">
                                                        Sold Out
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Title & Description */}
                                        <div>
                                            <h3 className="text-sm font-black text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                                                {prod.name}
                                            </h3>
                                            {prod.description && (
                                                <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                                                    {prod.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price & Action */}
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-gray-400 font-medium">Price</div>
                                            <div className="text-base font-black text-gray-900 flex items-center gap-1">
                                                ₱{Number(displayPrice).toFixed(0)}
                                                {hasOverride && prod.retailPrice > displayPrice && (
                                                    <span className="text-[11px] text-gray-400 line-through font-normal">
                                                        ₱{Number(prod.retailPrice).toFixed(0)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            disabled={isOutOfStock}
                                            className="px-3.5 py-1.5 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-700 group-hover:text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>{isMadeToOrder ? "Customize" : "Choose"}</span>
                                            <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </StorefrontLayout>
    );
}
