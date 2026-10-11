import IconArtwork from '../../../components/bazaar/IconArtwork';
import { bazaarOperation } from '../../../services/bazaarDiagnostics';
import { clickerOptions, canonicalClickerConfiguration } from '../../../engine/bazaar/configuration';
import { decomposeProductBOM } from '../../../engine/bazaar/bom';
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
    getPublicShopBySlug,
    getPublicProduct,
    getPublicEventBySlugOrId,
} from "../../../services/bazaarService";
import { calculateItemPrice } from "../../../engine/bazaar/pricing";
import { addToCart, loadCart, calculateCartSummary } from "../../../utils/bazaarCart";
import StorefrontLayout from "../../../components/bazaar/storefront/StorefrontLayout";
import ClickerVisualPreview from "../../../components/bazaar/storefront/ClickerVisualPreview";
import {
    ShoppingBag,
    Check,
    Plus,
    Minus,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    ShieldAlert,
    WifiOff,
    RefreshCw,
} from "lucide-react";

export default function ProductCustomizer() {
    const { shopSlug, productId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const eventParam = searchParams.get("event") || "";

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [eventNotice, setEventNotice] = useState(null);
    const [retry, setRetry] = useState(0);
    const [shop, setShop] = useState(null);
    const [event, setEvent] = useState(null);
    const [product, setProduct] = useState(null);
    const [cartItems, setCartItems] = useState([]);
    const [addedSuccess, setAddedSuccess] = useState(false);

    // Quantity
    const [quantity, setQuantity] = useState(1);

    // Ready-Made Variant selection
    const [selectedVariantId, setSelectedVariantId] = useState("");

    // Made-to-Order Clicker Customization state
    const [textSequence, setTextSequence] = useState("");
    const [slotCount, setSlotCount] = useState(0);
    const [activeSlotIndex, setActiveSlotIndex] = useState(0);

    // Per-slot customization: Array of { char, colorHex, colorName, isIcon, iconEmoji, iconId }
    const [slotConfigs, setSlotConfigs] = useState([]);

    // Casing color & style
    const [selectedCasingColor, setSelectedCasingColor] = useState({ id: "black", name: "Matte Black", hex: "#1e293b" });
    const [selectedCasingStyleId, setSelectedCasingStyleId] = useState("");

    // Switch selection
    const [selectedSwitchId, setSelectedSwitchId] = useState("");

    // Add-ons selection (array of add-on IDs)
    const [selectedAddonIds, setSelectedAddonIds] = useState([]);

    // Active sub-tab in customizer: 'slots' | 'casing' | 'switch' | 'addons'
    const [activeSection, setActiveSection] = useState("slots");

    // Refresh cart items
    const refreshCart = useCallback(() => {
        if (!shopSlug) return;
        const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";
        const items = loadCart(shopSlug, evKey);
        setCartItems(items);
    }, [shopSlug, event, eventParam]);

    // Initial load
    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            setLoading(true);
            setEventNotice(null);
            try {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    throw Object.assign(new Error('You appear to be offline. Check your internet connection and try again.'), { code: 'unavailable' });
                }

                const [resolvedShop, resolvedProd] = await Promise.all([
                    bazaarOperation('read-shop', 'shop_slugs/{slug}', () => getPublicShopBySlug(shopSlug)),
                    bazaarOperation('read-product', 'public_products/{product}', () => getPublicProduct(productId)),
                ]);

                if (!resolvedShop) throw new Error(`Shop "${shopSlug}" is not available or has not been published.`);
                if (!resolvedProd) throw new Error(`Product "${productId}" is not available or has been archived.`);
                if (resolvedProd.shopId && resolvedShop.shopId && resolvedProd.shopId !== (resolvedShop.shopId || resolvedShop.id)) {
                    throw new Error('This product belongs to a different maker shop.');
                }

                // Resilient Event Resolution: event failure must never black-screen product customizer
                let resolvedEvent = null;
                if (eventParam) {
                    try {
                        resolvedEvent = await bazaarOperation('read-event', 'public_events/{event}', () => getPublicEventBySlugOrId(eventParam));
                        if (!resolvedEvent) {
                            setEventNotice({
                                type: 'not-found',
                                message: `Event "${eventParam}" is not active or has not been published. Showing standard catalog.`,
                            });
                        } else if (resolvedEvent.shopId && resolvedEvent.shopId !== (resolvedShop.shopId || resolvedShop.id)) {
                            resolvedEvent = null;
                            setEventNotice({
                                type: 'mismatch',
                                message: `Event "${eventParam}" belongs to a different shop. Showing standard catalog.`,
                            });
                        } else if (resolvedEvent.queueStatus === 'paused' || resolvedEvent.isAcceptingOrders === false) {
                            setEventNotice({
                                type: 'paused',
                                message: `Orders for "${resolvedEvent.name}" are temporarily paused. You can customize products, but order checkout is currently paused.`,
                            });
                        } else if (resolvedEvent.queueStatus === 'closed' || resolvedEvent.status === 'Ended') {
                            setEventNotice({
                                type: 'closed',
                                message: `Event "${resolvedEvent.name}" has concluded. Orders are closed for this event.`,
                            });
                        }
                    } catch (evErr) {
                        console.warn('[ProductCustomizer] Safe event load fallback:', evErr?.code || evErr?.message);
                        setEventNotice({
                            type: evErr?.code === 'permission-denied' ? 'permission' : 'error',
                            message: `Notice: Event "${eventParam}" could not be verified (${evErr?.code || 'offline'}). Showing standard catalog.`,
                        });
                    }
                }

                if (!isMounted) return;
                setLoadError(null);

                setShop(resolvedShop);
                setProduct(resolvedProd);
                setEvent(resolvedEvent);

                // Initialize Ready-Made variant
                if (resolvedProd?.variants && resolvedProd.variants.length > 0) {
                    setSelectedVariantId(resolvedProd.variants[0].id || "");
                }

                // Initialize Customization options for Made-to-Order
                const schema = clickerOptions(resolvedProd);
                
                // Set initial switch
                const switches = schema.allowed_switch_types || schema.switch_types || [];
                if (switches.length > 0) {
                    setSelectedSwitchId(switches[0].id || switches[0].name);
                }

                // Set initial casing style
                const styles = schema.casing_styles || [];
                if (styles.length > 0) {
                    setSelectedCasingStyleId(styles[0].id || styles[0].name);
                }

                // Set initial casing color
                const casingColors = schema.casing_base_colors || [];
                if (casingColors.length > 0) {
                    setSelectedCasingColor(casingColors[0]);
                }

                const count = schema.available_slots[0] || 0;
                const color = schema.colors[0];
                const char = Array.from(schema.allowed_characters || '')[0] || '';
                setSlotConfigs(Array.from({length: count}, () => ({char, colorId: color?.id || '', colorHex: color?.hex || '#ffffff', colorName: color?.name || '', type: "letter", isIcon: false, styleId: schema.keycap_styles[0]?.id || '', switchId: schema.allowed_switch_types[0]?.id || ''})));
                setTextSequence(char.repeat(count)); setSlotCount(count);

            } catch (err) {
                if (isMounted) {
                    setLoadError({
                        message: err.message || "Product could not be loaded.",
                        code: err.code || "unknown",
                    });
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();
        return () => { isMounted = false; };
    }, [shopSlug, productId, eventParam, retry]);

    useEffect(() => {
        let active = true;
        queueMicrotask(() => { if (active) refreshCart(); });
        return () => { active = false; };
    }, [refreshCart]);

    const { itemCount, subtotal } = useMemo(() => {
        return calculateCartSummary(cartItems);
    }, [cartItems]);

    const schema = useMemo(() => clickerOptions(product), [product]);
    const availableColors = schema.colors;
    const availableCasingColors = schema.casing_base_colors;
    const availableCasingStyles = schema.casing_styles;
    const availableSwitches = schema.allowed_switch_types;
    const availableAddons = schema.add_ons;
    const iconOptions = schema.available_icons;
    const availableSlots = schema.available_slots;
    const [configurationError, setConfigurationError] = useState('');

    // Change slot count (1 to 8 keys)
    const handleSlotCountChange = (newCount) => {
        const count = Number(newCount);
        if (!availableSlots.includes(count)) return;
        setSlotCount(count);

        // Adjust slotConfigs
        setSlotConfigs((prev) => {
            const next = [...prev];
            if (next.length < count) {
                for (let i = next.length; i < count; i++) {
                    const fallbackColor = availableColors[i % availableColors.length];
                    next.push({
                        char: Array.from(schema.allowed_characters || '')[0] || '',
                        colorId: fallbackColor?.id || '', styleId: schema.keycap_styles[0]?.id || '', switchId: selectedSwitchId,
                        colorHex: fallbackColor?.hex || "#14b8a6",
                        colorName: fallbackColor?.name || "Teal",
                        isIcon: false,
                    });
                }
            } else if (next.length > count) {
                next.splice(count);
            }
            return next;
        });

        // Update text sequence
        setTextSequence((prev) => {
            if (prev.length < count) {
                let add = "";
                for (let i = prev.length; i < count; i++) {
                    add += Array.from(schema.allowed_characters || '')[0] || '';
                }
                return prev + add;
            }
            return prev.substring(0, count);
        });

        if (activeSlotIndex >= count) {
            setActiveSlotIndex(count - 1);
        }
    };

    // Update text input
    const handleTextInputChange = (raw) => {
        const limited = Array.from(raw.toUpperCase()).filter(char => Array.from(schema.allowed_characters || '').includes(char)).slice(0, slotCount).join('');
        setTextSequence(limited);

        // Update characters on slots
        setSlotConfigs((prev) => {
            return prev.map((slot, idx) => {
                if (idx < limited.length) {
                    return { ...slot, char: limited[idx], isIcon: false };
                }
                return { ...slot, char: "", isIcon: false };
            });
        });
    };

    // Update specific slot color
    const handleSetSlotColor = (colorObj) => {
        setSlotConfigs((prev) => {
            const copy = [...prev];
            if (copy[activeSlotIndex]) {
                copy[activeSlotIndex] = {
                    ...copy[activeSlotIndex],
                    colorId: colorObj.id,
                    colorHex: colorObj.hex,
                    colorName: colorObj.name,
                };
            }
            return copy;
        });
    };

    // Set slot to icon
    const handleSetSlotIcon = (iconObj) => {
        setSlotConfigs((prev) => {
            const copy = [...prev];
            if (copy[activeSlotIndex]) {
                copy[activeSlotIndex] = {
                    ...copy[activeSlotIndex],
                    type: "icon", isIcon: true,
                    iconId: iconObj.id,
                    iconEmoji: iconObj.emoji || '',
                    iconName: iconObj.name,
                    imageUrl: iconObj.imageUrl,
                    thumbnailUrl: iconObj.thumbnailUrl,
                };
            }
            return copy;
        });
    };

    // Selected Switch details
    const activeSwitchObj = useMemo(() => {
        return availableSwitches.find((s) => (s.id || s.name) === selectedSwitchId) || availableSwitches[0] || {};
    }, [availableSwitches, selectedSwitchId]);

    // Authoritative Item Price Calculation using pure engine
    const priceBreakdown = useMemo(() => {
        if (!product) return { finalUnitPrice: 0, total: 0, breakdown: {} };

        // Build customization payload for engine
        const customizationPayload = {
            text: textSequence,
            slots: slotCount,
            casing_slots: slotCount,
            casing_style_id: selectedCasingStyleId,
            switch_type_id: selectedSwitchId,
            selected_add_on_ids: selectedAddonIds,
            slotsData: slotConfigs,
            casing_color: selectedCasingColor.id,
            selected_variant_id: selectedVariantId,
            letter_color_array: slotConfigs.map((s) => s.colorName),
        };

        try {
        const result = calculateItemPrice({
            product: {
                ...product,
                base_price: product.retailPrice ?? product.price ?? 0,
                customization_schema: schema,
            },
            customization: customizationPayload,
            eventConfig: event?.catalog ? event.catalog[product.productId || product.id] : null,
            quantity: 1,
        });

        return {
            finalUnitPrice: result.finalUnitPrice,
            total: result.finalUnitPrice * quantity,
            breakdown: result.breakdown,
        };
        } catch (error) { return { finalUnitPrice: 0, total: 0, breakdown: {}, error: error.message }; }
    }, [
        product,
        textSequence,
        slotCount,
        selectedCasingStyleId,
        selectedCasingColor,
        selectedVariantId,
        selectedSwitchId,
        selectedAddonIds,
        slotConfigs,
        schema,
        event,
        quantity,
    ]);

    // Toggle add-on checkbox
    const handleToggleAddon = (addonId) => {
        setSelectedAddonIds((prev) =>
            prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
        );
    };

    // Add to cart handler
    const handleAddToCart = () => {
        if (!shopSlug || !product) return;
        if (priceBreakdown.error) { setConfigurationError(priceBreakdown.error); return; }

        const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";
        const isMadeToOrder = product.type === "made_to_order";

        const cartItem = {
            productId: product.productId || product.id,
            productName: product.name,
            type: product.type || "made_to_order",
            quantity: quantity,
            finalUnitPrice: priceBreakdown.finalUnitPrice,
            image: product.images?.[0] || "",
            maxOrderQty: product.maxOrderQty || 10,
            
            // Customization payload for Made-to-Order
            customization: isMadeToOrder ? {
                text: textSequence,
                slots: slotCount,
                casing_style_id: selectedCasingStyleId,
                casing_color: selectedCasingColor.id,
                switch_type_id: selectedSwitchId,
                selected_add_on_ids: selectedAddonIds,
                letter_color_array: slotConfigs.map(s => s.colorId),
                casingStyle: selectedCasingStyleId,
                casingColor: selectedCasingColor,
                switchType: activeSwitchObj,
                addons: availableAddons.filter((a) => selectedAddonIds.includes(a.id)),
                slotsData: slotConfigs,
                letterColorArray: slotConfigs.map((s) => s.colorName),
            } : null,

            // Variant payload for Ready-Made
            selectedVariant: !isMadeToOrder ? (
                product.variants?.find((v) => v.id === selectedVariantId) || null
            ) : null,
        };

        try {
            if (!['made_to_order', 'ready_made'].includes(product.type)) throw new Error('The seller must republish this product with its product type.');
            if (isMadeToOrder) cartItem.customization = canonicalClickerConfiguration(product, cartItem.customization);
            cartItem.requiredBOM = decomposeProductBOM({ product, customization: cartItem.customization, quantity: cartItem.quantity });
        } catch (error) { setConfigurationError(error.message); return; }
        setConfigurationError('');
        addToCart(shopSlug, evKey, cartItem);
        refreshCart();

        setAddedSuccess(true);
        setTimeout(() => setAddedSuccess(false), 3000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-gray-500">Loading Product Customizer...</p>
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
                            {isPermission ? 'Security & Permissions' : isOffline ? 'Connection Status' : 'Product Error'}
                        </span>
                        <h2 className="text-lg font-black text-gray-900 tracking-tight">
                            {isPermission ? 'Access Denied' : isOffline ? 'Connection Unavailable' : 'Unable to Load Product'}
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
                            <span>Retry</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/shop/${shopSlug}`)}
                            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                        >
                            Browse Shop
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!product || !shop) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <AlertCircle size={24} />
                    </div>
                    <h2 className="text-lg font-black text-gray-900">Product Not Found</h2>
                    <p className="text-xs text-gray-500">This product is either unavailable or has been archived.</p>
                    <button
                        onClick={() => navigate(`/shop/${shopSlug}`)}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold"
                    >
                        Return to Shop
                    </button>
                </div>
            </div>
        );
    }

    const isMadeToOrder = product.type === "made_to_order";
    const hasKeyringSelected = selectedAddonIds.includes("keyring") || selectedAddonIds.includes("lobster");
    const isEventClosedOrPaused = event && (event.isAcceptingOrders === false || event.queueStatus === "paused" || event.queueStatus === "closed");

    return (
        <StorefrontLayout
            shop={shop}
            event={event}
            cartItemCount={itemCount}
            cartSubtotal={subtotal}
            showBackButton={true}
            backTo={`/shop/${shopSlug}${eventParam && event ? `?event=${eventParam}` : ""}`}
            backLabel="Catalog"
        >
            <div className="space-y-6">
                {/* Event Notice / Status Notification */}
                {eventNotice && (
                    <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-2xs ${
                        eventNotice.type === 'paused' || eventNotice.type === 'closed'
                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : 'bg-teal-50 border border-teal-200 text-teal-900'
                    }`}>
                        <div className="flex items-center gap-2.5">
                            <AlertCircle size={16} className={eventNotice.type === 'paused' || eventNotice.type === 'closed' ? 'text-amber-600 shrink-0' : 'text-teal-600 shrink-0'} />
                            <span>{eventNotice.message}</span>
                        </div>
                        {eventParam && (
                            <button
                                type="button"
                                onClick={() => navigate(`/shop/${shopSlug}/product/${productId}`)}
                                className="text-[11px] font-bold text-gray-500 hover:text-gray-800 underline whitespace-nowrap cursor-pointer"
                            >
                                Clear event filter
                            </button>
                        )}
                    </div>
                )}
                {/* Header Information */}
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200/60 uppercase tracking-wider">
                            {isMadeToOrder ? "Custom 3D Print" : product.type === "ready_made" ? "Ready-Made Product" : "Seller must republish product"}
                        </span>
                        {event && (
                            <span className="text-[11px] font-bold text-gray-400">
                                • {event.name}
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                        {product.name}
                    </h1>
                    {product.description && (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {product.description}
                        </p>
                    )}
                </div>

                {/* ── Case 1: Made-to-Order Letter Clicker Builder ── */}
                {isMadeToOrder ? (
                    <div className="space-y-6">
                        {/* 1. Live Visual Preview */}
                        <ClickerVisualPreview
                            slotCount={slotCount}
                            slotsData={slotConfigs}
                            casingColorHex={selectedCasingColor.hex}
                            casingStyle={selectedCasingStyleId}
                            activeSlotIndex={activeSlotIndex}
                            onSelectSlot={(idx) => {
                                setActiveSlotIndex(idx);
                                setActiveSection("slots");
                            }}
                            switchColor={activeSwitchObj.color || "#3b82f6"}
                            switchName={activeSwitchObj.name || "Mechanical Switch"}
                            hasKeyring={hasKeyringSelected}
                        />

                        {/* Navigation Section Tabs */}
                        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setActiveSection("slots")}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer ${
                                    activeSection === "slots"
                                        ? "bg-white text-gray-900 shadow-2xs"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                1. Keys & Colors
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("casing")}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer ${
                                    activeSection === "casing"
                                        ? "bg-white text-gray-900 shadow-2xs"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                2. Base Casing
                            </button>
                            {availableSwitches.length > 0 && <button
                                type="button"
                                onClick={() => setActiveSection("switch")}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer ${
                                    activeSection === "switch"
                                        ? "bg-white text-gray-900 shadow-2xs"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                3. Switches
                            </button>}
                            {availableAddons.length > 0 && <button
                                type="button"
                                onClick={() => setActiveSection("addons")}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer ${
                                    activeSection === "addons"
                                        ? "bg-white text-gray-900 shadow-2xs"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                4. Add-ons
                            </button>}
                        </div>

                        {(configurationError || priceBreakdown.error) && <p role="alert" className="text-red-700">{configurationError || priceBreakdown.error}</p>}
                        {/* SECTION 1: KEYS & COLORS */}
                        {activeSection === "slots" && (
                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-5 animate-in fade-in duration-150">
                                <div>
                                    <label className="block text-xs font-black text-gray-900 mb-1.5">
                                        Word / Name on Clicker ({slotCount} {slotCount === 1 ? "Key" : "Keys"})
                                    </label>
                                    <input
                                        type="text"
                                        value={textSequence}
                                        maxLength={slotCount}
                                        onChange={(e) => handleTextInputChange(e.target.value)}
                                        placeholder="E.g. ANNA, KEN, 2026"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-base font-black text-gray-900 tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Enter one character for each selected slot. You can choose individual colors for each key below!
                                    </p>
                                </div>

                                {/* Slot Count Selector */}
                                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <span className="text-xs font-black text-gray-900 block">
                                                Number of Key Slots
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                Choose how many keys your custom clicker will have.
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                                            {availableSlots.map((n) => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    aria-label={`Select ${n} slots`}
                                                    onClick={() => handleSlotCountChange(n)}
                                                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center ${
                                                        slotCount === n
                                                            ? "bg-teal-600 text-white shadow-xs scale-105"
                                                            : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                                                    }`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {schema.keycap_styles.length > 0 && !slotConfigs[activeSlotIndex]?.isIcon && (
                                        <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-gray-700">Keycap Profile</span>
                                            <select
                                                aria-label="Keycap style"
                                                value={slotConfigs[activeSlotIndex]?.styleId || ""}
                                                onChange={(e) =>
                                                    setSlotConfigs((prev) =>
                                                        prev.map((v, i) =>
                                                            i === activeSlotIndex ? { ...v, styleId: e.target.value } : v
                                                        )
                                                    )
                                                }
                                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                                            >
                                                {schema.keycap_styles.map((v) => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {configurationError && <p role="alert" className="text-xs font-bold text-red-600">{configurationError}</p>}

                                {/* Active Slot Selector */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2">
                                        Customize Individual Key:
                                    </label>
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                        {slotConfigs.map((slot, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setActiveSlotIndex(idx)}
                                                className={`px-3 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                                                    activeSlotIndex === idx
                                                        ? "border-teal-500 bg-teal-50/60 text-teal-900 ring-2 ring-teal-400/30"
                                                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                                                }`}
                                            >
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full inline-block shadow-2xs border border-black/10"
                                                    style={{ backgroundColor: slot.colorHex }}
                                                />
                                                <span>
                                                    {slot.isIcon ? (
                                                        <IconArtwork icon={{ ...slot, id: slot.iconId, name: slot.iconName }} className="w-7 h-7" />
                                                    ) : (
                                                        slot.char || idx + 1
                                                    )}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Icons use the seller artwork unchanged. */}
                                {!slotConfigs[activeSlotIndex]?.isIcon && <div className="pt-2 border-t border-gray-100">
                                    <label className="block text-xs font-bold text-gray-700 mb-2">
                                        Select Color for Key #{activeSlotIndex + 1} ({slotConfigs[activeSlotIndex]?.char}):
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {availableColors.map((col) => {
                                            const isSelected = slotConfigs[activeSlotIndex]?.colorHex === col.hex;
                                            return (
                                                <button
                                                    key={col.id || col.name}
                                                    type="button"
                                                    onClick={() => handleSetSlotColor(col)}
                                                    className={`p-2.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                                                        isSelected
                                                            ? "border-teal-500 bg-teal-50 text-teal-900 shadow-2xs"
                                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                    }`}
                                                >
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-xs"
                                                        style={{ backgroundColor: col.hex }}
                                                    />
                                                    <span className="truncate">{col.name}</span>
                                                    {isSelected && <Check size={14} className="ml-auto text-teal-600 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                }
                                {slotConfigs[activeSlotIndex]?.isIcon && <button type="button" onClick={() => setSlotConfigs(prev => prev.map((s,i) => i === activeSlotIndex ? {...s, type:"letter", isIcon:false} : s))} className="text-sm font-bold text-teal-700">Use a letter on this key</button>}
                                {/* Icon Keycaps (if enabled) */}
                                {iconOptions.length > 0 && (
                                    <div className="pt-3 border-t border-gray-100">
                                        <label className="block text-xs font-bold text-gray-700 mb-2">
                                            Or Replace Key #{activeSlotIndex + 1} with an Icon Keycap:
                                        </label>
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                            {iconOptions.map((icon) => (
                                                <button
                                                    key={icon.id}
                                                    type="button"
                                                    onClick={() => handleSetSlotIcon(icon)}
                                                    className="px-3 py-2 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                                                >
                                                    <IconArtwork icon={icon} /><span>{icon.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 2: CASING COLOR & STYLE */}
                        {activeSection === "casing" && (
                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-5 animate-in fade-in duration-150">
                                <div>
                                    <label className="block text-xs font-black text-gray-900 mb-2">
                                        Base Casing Color
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {availableCasingColors.map((col) => {
                                            const isSelected = selectedCasingColor.id === col.id;
                                            return (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    onClick={() => setSelectedCasingColor(col)}
                                                    className={`p-2.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                                                        isSelected
                                                            ? "border-teal-500 bg-teal-50 text-teal-900 shadow-2xs"
                                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                    }`}
                                                >
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-xs"
                                                        style={{ backgroundColor: col.hex }}
                                                    />
                                                    <span className="truncate">{col.name}</span>
                                                    {isSelected && <Check size={14} className="ml-auto text-teal-600 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100">
                                    <label className="block text-xs font-black text-gray-900 mb-2">
                                        Casing Body Style
                                    </label>
                                    <div className="space-y-2">
                                        {availableCasingStyles.map((style) => {
                                            const isSelected = selectedCasingStyleId === style.id;
                                            return (
                                                <button
                                                    key={style.id}
                                                    type="button"
                                                    onClick={() => setSelectedCasingStyleId(style.id)}
                                                    className={`w-full p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                                                        isSelected
                                                            ? "border-teal-500 bg-teal-50 text-teal-900 shadow-2xs"
                                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                    }`}
                                                >
                                                    <div className="text-left">
                                                        <div className="font-extrabold">{style.name}</div>
                                                        <span className="text-[10px] text-gray-400 font-normal">
                                                            {style.extraPrice > 0 ? `+₱${style.extraPrice}` : "Included"}
                                                        </span>
                                                    </div>
                                                    {isSelected && <Check size={16} className="text-teal-600 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECTION 3: SWITCHES */}
                        {activeSection === "switch" && (
                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-4 animate-in fade-in duration-150">
                                <label className="block text-xs font-black text-gray-900">
                                    Mechanical Switch Feel
                                </label>
                                <div className="space-y-2.5">
                                    {availableSwitches.map((sw) => {
                                        const swId = sw.id || sw.name;
                                        const isSelected = selectedSwitchId === swId;
                                        return (
                                            <button
                                                key={swId}
                                                type="button"
                                                onClick={() => { setSelectedSwitchId(swId); setSlotConfigs(prev => prev.map(slot => ({...slot, switchId: swId}))); }}
                                                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "border-teal-500 bg-teal-50 text-teal-900 shadow-2xs"
                                                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-4 h-4 rounded-xs border border-black/10 shrink-0 shadow-xs"
                                                        style={{ backgroundColor: sw.color || "#3b82f6" }}
                                                    />
                                                    <div className="text-left">
                                                        <div className="font-extrabold">{sw.name}</div>
                                                        <span className="text-[11px] text-gray-400 font-normal">
                                                            {sw.extraPrice > 0 ? `+₱${sw.extraPrice} per key` : "Standard Switch"}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isSelected && <Check size={16} className="text-teal-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* SECTION 4: ADD-ONS */}
                        {activeSection === "addons" && (
                            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-4 animate-in fade-in duration-150">
                                <label className="block text-xs font-black text-gray-900">
                                    Keychain Hardware & Packaging
                                </label>
                                <div className="space-y-2.5">
                                    {availableAddons.map((add) => {
                                        const isChecked = selectedAddonIds.includes(add.id);
                                        return (
                                            <label
                                                key={add.id}
                                                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                                                    isChecked
                                                        ? "border-teal-500 bg-teal-50/70 text-teal-900 shadow-2xs"
                                                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleAddon(add.id)}
                                                        className="w-4 h-4 text-teal-600 rounded-md border-gray-300 focus:ring-teal-500 cursor-pointer"
                                                    />
                                                    <div>
                                                        <div className="font-extrabold">{add.name}</div>
                                                        <span className="text-[11px] text-teal-700 font-medium">
                                                            +₱{Number(add.extraPrice || add.price || 0).toFixed(0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Case 2: Ready-Made Product Picker ── */
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs space-y-6">
                        {product.variants && product.variants.length > 0 && (
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-gray-900">
                                    Select Variant / Color
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {product.variants.map((v) => {
                                        const isSelected = selectedVariantId === v.id;
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => setSelectedVariantId(v.id)}
                                                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "border-teal-500 bg-teal-50 text-teal-900 shadow-2xs"
                                                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                                                }`}
                                            >
                                                <div className="text-left">
                                                    <div>{v.color || v.name || "Default Style"}</div>
                                                    <span className="text-[10px] text-gray-400">
                                                        {v.style && `${v.style} • `}₱{Number(v.price || product.retailPrice || 0).toFixed(0)}
                                                    </span>
                                                </div>
                                                {isSelected && <Check size={16} className="text-teal-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sticky Bottom Actions & Price Summary */}
                <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.12)] space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">Qty:</span>
                            <div className="flex items-center bg-gray-100 rounded-xl p-1">
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="w-8 text-center text-xs font-black text-gray-900">
                                    {quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.min(product.maxOrderQty || 10, q + 1))}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Total Price */}
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Total Price
                            </span>
                            <span className="text-xl font-black text-gray-900">
                                ₱{Number(priceBreakdown.total).toFixed(0)}
                            </span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleAddToCart}
                            className="flex-1 py-3 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <ShoppingBag size={17} />
                            <span>Add to Cart (₱{Number(priceBreakdown.total).toFixed(0)})</span>
                        </button>

                        {isEventClosedOrPaused ? (
                            <div className="py-3 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs whitespace-nowrap flex items-center gap-1.5" title="Event orders are currently paused">
                                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                                <span>Orders Paused</span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    handleAddToCart();
                                    navigate(`/shop/${shopSlug}/cart${eventParam ? `?event=${eventParam}` : ""}`);
                                }}
                                className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs transition-all cursor-pointer whitespace-nowrap"
                            >
                                Buy Now
                            </button>
                        )}
                    </div>

                    {addedSuccess && (
                        <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                                <span>Customized Clicker added to your cart!</span>
                            </div>
                            <button
                                onClick={() => navigate(`/shop/${shopSlug}/cart${eventParam ? `?event=${eventParam}` : ""}`)}
                                className="text-teal-700 hover:underline font-black text-xs cursor-pointer"
                            >
                                View Cart →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </StorefrontLayout>
    );
}
