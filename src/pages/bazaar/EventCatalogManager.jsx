import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getSellerEvent,
    getSellerProducts,
    getEventProducts,
    updateEventProductCatalog,
    getShopInventory,
    allocateEventStock,
    getEventStockAllocations,
} from "../../services/bazaarService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import {
    Calendar,
    ArrowLeft,
    Package,
    Tag,
    Layers,
    Save,
    CheckCircle2,
    AlertCircle,
    X,
    Eye,
    Percent,
    Sliders,
    Store,
    MapPin,
    AlertTriangle,
} from "lucide-react";

export default function EventCatalogManager() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [shop, setShop] = useState(null);
    const [event, setEvent] = useState(null);
    const [masterProducts, setMasterProducts] = useState([]);
    const [eventProductsMap, setEventProductsMap] = useState({});
    const [inventoryItems, setInventoryItems] = useState([]);
    const [eventAllocations, setEventAllocations] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Active Tab: 'products' | 'booth_stock'
    const [activeTab, setActiveTab] = useState("products");

    // Notifications
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Preview Modal
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const loadData = useCallback(async () => {
        if (!currentUser?.uid || !eventId) return;
        setLoading(true);
        try {
            const [shopData, eventData, prodsData, eventProdsData, invData, allocsData] =
                await Promise.all([
                    getSellerShop(currentUser.uid).catch(() => null),
                    getSellerEvent(currentUser.uid, eventId).catch(() => null),
                    getSellerProducts(currentUser.uid).catch(() => []),
                    getEventProducts(currentUser.uid, eventId).catch(() => ({})),
                    getShopInventory(currentUser.uid).catch(() => []),
                    getEventStockAllocations(currentUser.uid, eventId).catch(() => ({})),
                ]);

            if (!eventData) {
                setErrorMessage("Event not found or unauthorized access.");
                return;
            }

            setShop(shopData);
            setEvent(eventData);
            setMasterProducts(prodsData);
            setEventProductsMap(eventProdsData || {});
            setInventoryItems(invData);
            setEventAllocations(allocsData || {});
        } catch (err) {
            console.error("[EventCatalogManager] Failed to load data:", err);
            setErrorMessage("Failed to load event catalog configuration.");
        } finally {
            setLoading(false);
        }
    }, [currentUser, eventId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Toggle Product for Event
    const handleToggleProduct = (productId) => {
        const current = eventProductsMap[productId] || { enabled: false };
        setEventProductsMap({
            ...eventProductsMap,
            [productId]: {
                ...current,
                enabled: !current.enabled,
            },
        });
    };

    // Update Price Override for Product
    const handlePriceOverride = (productId, val) => {
        const current = eventProductsMap[productId] || { enabled: true };
        setEventProductsMap({
            ...eventProductsMap,
            [productId]: {
                ...current,
                price_override: val === "" ? null : Number(val),
            },
        });
    };

    // Update Max Order Limit for Product
    const handleLimitChange = (productId, val) => {
        const current = eventProductsMap[productId] || { enabled: true };
        setEventProductsMap({
            ...eventProductsMap,
            [productId]: {
                ...current,
                max_order_qty: val === "" ? null : Number(val),
            },
        });
    };

    // Save Event Products Catalog
    const handleSaveCatalog = async () => {
        setSaving(true);
        setErrorMessage("");
        try {
            await updateEventProductCatalog(currentUser.uid, eventId, eventProductsMap);
            setSuccessMessage("Event product catalog and pricing overrides saved successfully.");
        } catch (err) {
            console.error("[EventCatalogManager] Failed to save catalog:", err);
            setErrorMessage(err.message || "Failed to save event catalog.");
        } finally {
            setSaving(false);
        }
    };

    // Update Booth Stock Allocation Input
    const handleAllocationChange = (itemKey, qty) => {
        const safeQty = Math.max(0, Number(qty) || 0);
        setEventAllocations({
            ...eventAllocations,
            [itemKey]: safeQty,
        });
    };

    // Save Booth Stock Allocations with Invariant Check
    const handleSaveAllocations = async () => {
        setSaving(true);
        setErrorMessage("");
        try {
            // Verify allocation invariants: cannot allocate more than on-hand stock
            const itemMap = new Map();
            for (const item of inventoryItems) {
                itemMap.set(item.item_key, item);
            }

            for (const [key, allocQty] of Object.entries(eventAllocations)) {
                const item = itemMap.get(key);
                const onHand = Number(item?.on_hand || 0);
                if (allocQty > onHand) {
                    throw new Error(
                        `Cannot allocate ${allocQty} for "${item?.name || key}". Only ${onHand} units on hand in workshop.`
                    );
                }
            }

            await allocateEventStock(currentUser.uid, eventId, eventAllocations);
            setSuccessMessage("Booth inventory allocations saved successfully.");
        } catch (err) {
            console.error("[EventCatalogManager] Allocation error:", err);
            setErrorMessage(err.message || "Failed to save booth allocations.");
        } finally {
            setSaving(false);
        }
    };

    // Enabled count
    const enabledProductsCount = useMemo(() => {
        return Object.values(eventProductsMap).filter((p) => p?.enabled).length;
    }, [eventProductsMap]);

    if (loading) {
        return (
            <BazaarLayout activeTab="events">
                <div className="p-16 text-center">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <span className="text-xs text-gray-400 font-bold">Loading event catalog...</span>
                </div>
            </BazaarLayout>
        );
    }

    if (!event) {
        return (
            <BazaarLayout activeTab="events">
                <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center space-y-4">
                    <AlertCircle size={32} className="text-red-500 mx-auto" />
                    <h3 className="text-base font-bold text-gray-900">Event Not Found</h3>
                    <Link
                        to="/studio/bazaar/events"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs"
                    >
                        Return to Events
                    </Link>
                </div>
            </BazaarLayout>
        );
    }

    return (
        <BazaarLayout activeTab="events">
            <div className="space-y-6">
                {/* Header Back & Context */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            to={`/studio/bazaar/events/${eventId}`}
                            className="p-2 rounded-2xl bg-white border border-gray-200 text-gray-600 hover:text-gray-900 shadow-2xs transition-all"
                            title="Return to Event Dashboard"
                        >
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                                    Milestone 3 Event Catalog
                                </span>
                                <span className="text-xs text-gray-400 font-medium">
                                    {event.venue}
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">
                                {event.name} — Booth Catalog & Stock
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            onClick={() => setIsPreviewOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 transition-all cursor-pointer shadow-2xs"
                        >
                            <Eye size={14} /> Preview Storefront
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                {errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>{errorMessage}</span>
                        </div>
                        <button onClick={() => setErrorMessage("")} className="cursor-pointer">
                            <X size={14} />
                        </button>
                    </div>
                )}
                {successMessage && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            <span>{successMessage}</span>
                        </div>
                        <button onClick={() => setSuccessMessage("")} className="cursor-pointer">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* View Tabs */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab("products")}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === "products"
                                        ? "bg-teal-600 text-white shadow-xs"
                                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80"
                                }`}
                            >
                                <Package size={14} /> Product Menu & Pricing ({enabledProductsCount} enabled)
                            </button>

                            <button
                                onClick={() => setActiveTab("booth_stock")}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === "booth_stock"
                                        ? "bg-teal-600 text-white shadow-xs"
                                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80"
                                }`}
                            >
                                <Layers size={14} /> Booth Stock Allocation
                            </button>
                        </div>

                        {activeTab === "products" ? (
                            <button
                                onClick={handleSaveCatalog}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                                <Save size={14} /> {saving ? "Saving..." : "Save Product Menu"}
                            </button>
                        ) : (
                            <button
                                onClick={handleSaveAllocations}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                                <Save size={14} /> {saving ? "Saving..." : "Save Stock Allocations"}
                            </button>
                        )}
                    </div>

                    {/* TAB 1: EVENT PRODUCT MENU & PRICING */}
                    {activeTab === "products" && (
                        <div className="p-6 space-y-4">
                            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200/40 text-xs text-teal-900 leading-relaxed">
                                Select which products from your master catalog appear on this event's customer self-service QR kiosk. You can apply event-specific prices (e.g. fair promo) and order caps without modifying your master shop defaults.
                            </div>

                            {masterProducts.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 space-y-2">
                                    <Package size={32} className="mx-auto text-gray-300" />
                                    <p className="text-xs font-semibold">No products in your catalog.</p>
                                    <Link
                                        to="/studio/bazaar/products"
                                        className="text-xs text-teal-600 font-bold underline"
                                    >
                                        Create products in Master Catalog first
                                    </Link>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-200">
                                                <th className="py-3 px-4 font-bold text-gray-600 w-12 text-center">Enable</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Product Name</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Type</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Master Price</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Event Price Override (₱)</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Order Cap</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {masterProducts.map((prod) => {
                                                const config = eventProductsMap[prod.id] || { enabled: false };
                                                const isEnabled = config.enabled;
                                                const priceOverride = config.price_override ?? "";
                                                const limitOverride = config.max_order_qty ?? prod.maxOrderQty ?? 5;

                                                return (
                                                    <tr
                                                        key={prod.id}
                                                        className={`transition-colors ${
                                                            isEnabled ? "bg-teal-50/20 hover:bg-teal-50/30" : "hover:bg-gray-50/60"
                                                        }`}
                                                    >
                                                        <td className="py-3 px-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isEnabled}
                                                                onChange={() => handleToggleProduct(prod.id)}
                                                                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-gray-900">
                                                            <div>{prod.name}</div>
                                                            <span className="text-[10px] font-mono text-gray-400">{prod.sku}</span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                                                prod.type === "ready_made"
                                                                    ? "bg-amber-50 text-amber-700"
                                                                    : "bg-purple-50 text-purple-700"
                                                            }`}>
                                                                {prod.type === "ready_made" ? "Ready-Made" : "Made-to-Order"}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-gray-600">
                                                            ₱{prod.retailPrice?.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="5"
                                                                disabled={!isEnabled}
                                                                value={priceOverride}
                                                                onChange={(e) => handlePriceOverride(prod.id, e.target.value)}
                                                                placeholder={`₱${prod.retailPrice || 0} (Master)`}
                                                                className="w-32 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-mono font-bold text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 outline-none"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="50"
                                                                disabled={!isEnabled}
                                                                value={limitOverride}
                                                                onChange={(e) => handleLimitChange(prod.id, e.target.value)}
                                                                className="w-20 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-mono text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 outline-none"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: BOOTH STOCK ALLOCATION */}
                    {activeTab === "booth_stock" && (
                        <div className="p-6 space-y-4">
                            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/40 text-xs text-amber-900 leading-relaxed">
                                Allocate physical component stock (letter caps, switches, casings) from your workshop to this event booth. The inventory engine validates that allocated stock does not exceed workshop on-hand balances.
                            </div>

                            {inventoryItems.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 space-y-2">
                                    <Layers size={32} className="mx-auto text-gray-300" />
                                    <p className="text-xs font-semibold">No variant inventory records found.</p>
                                    <Link
                                        to="/studio/bazaar/inventory"
                                        className="text-xs text-teal-600 font-bold underline"
                                    >
                                        Stock workshop inventory first
                                    </Link>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-200">
                                                <th className="py-3 px-4 font-bold text-gray-600">Item Component</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Category</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Workshop On-Hand</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Allocated to Booth</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Available Remaining</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {inventoryItems.map((item) => {
                                                const onHand = Number(item.on_hand || 0);
                                                const allocated = Number(eventAllocations[item.item_key] || 0);
                                                const remaining = Math.max(0, onHand - allocated);

                                                return (
                                                    <tr key={item.item_key} className="hover:bg-gray-50/60 transition-colors">
                                                        <td className="py-3 px-4 font-bold text-gray-900">
                                                            <div>{item.name || item.item_key}</div>
                                                            <span className="text-[10px] font-mono text-gray-400">{item.item_key}</span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-semibold text-[10px]">
                                                                {item.item_type || "Component"}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-gray-800">
                                                            {onHand}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={onHand}
                                                                value={allocated}
                                                                onChange={(e) => handleAllocationChange(item.item_key, e.target.value)}
                                                                className="w-24 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-mono font-bold text-teal-800 outline-none"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                                                            {remaining}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* EVENT STOREFRONT PREVIEW MODAL */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg border border-gray-100 shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">
                                    Customer Storefront Kiosk
                                </span>
                                <h3 className="text-base font-black text-gray-900">
                                    {event.name} Storefront Preview
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Customer Kiosk Header Simulation */}
                        <div className="p-4 rounded-2xl bg-teal-600 text-white space-y-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                                {shop?.name || "KenCreations Studio"}
                            </span>
                            <h4 className="text-base font-black">{event.name}</h4>
                            <p className="text-xs text-teal-100 flex items-center gap-1">
                                <MapPin size={12} /> Booth {event.boothNumber || "Main Table"} · {event.venue}
                            </p>
                        </div>

                        {/* Public Products List */}
                        <div className="space-y-3">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                Available at this event ({enabledProductsCount})
                            </span>

                            {masterProducts
                                .filter((p) => eventProductsMap[p.id]?.enabled)
                                .map((p) => {
                                    const cfg = eventProductsMap[p.id] || {};
                                    const displayPrice = cfg.price_override ?? p.retailPrice;

                                    return (
                                        <div
                                            key={p.id}
                                            className="p-3 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                                    {p.images?.[0] ? (
                                                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package size={18} className="text-gray-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black text-gray-900">{p.name}</h5>
                                                    <span className="text-[10px] text-gray-400">{p.category}</span>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-sm font-black text-gray-900 font-mono">
                                                    ₱{displayPrice?.toFixed(2)}
                                                </span>
                                                {cfg.price_override && (
                                                    <span className="block text-[10px] text-teal-600 font-semibold">
                                                        Fair Special
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Security check footer */}
                        <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200/50 text-[11px] text-teal-900 flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-teal-600 shrink-0" />
                            <span>
                                Sanitized: Zero private costs, margins, or internal BOM details exposed.
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </BazaarLayout>
    );
}
