import IconArtwork from '../../../components/bazaar/IconArtwork';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
    getPublicShopBySlug,
    getPublicEvent,
    getPublicEventBySlugOrId,
} from "../../../services/bazaarService";
import {
    loadCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    calculateCartSummary,
} from "../../../utils/bazaarCart";
import StorefrontLayout from "../../../components/bazaar/storefront/StorefrontLayout";
import {
    ShoppingBag,
    Trash2,
    Plus,
    Minus,
    ArrowRight,
    MapPin,
    Tag,
    Sparkles,
    AlertCircle,
    ArrowLeft,
} from "lucide-react";

export default function CustomerCart() {
    const { shopSlug } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const eventParam = searchParams.get("event") || "";

    const [loading, setLoading] = useState(true);
    const [shop, setShop] = useState(null);
    const [event, setEvent] = useState(null);
    const [cartItems, setCartItems] = useState([]);

    const refreshCart = useCallback(() => {
        if (!shopSlug) return;
        const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";
        const items = loadCart(shopSlug, evKey);
        setCartItems(items);
    }, [shopSlug, event, eventParam]);

    useEffect(() => {
        let isMounted = true;

        async function loadShopAndEvent() {
            setLoading(true);
            try {
                const resolvedShop = await getPublicShopBySlug(shopSlug).catch(() => null);

                let resolvedEvent = null;
                if (eventParam) {
                    resolvedEvent = await getPublicEventBySlugOrId(eventParam).catch(() => null);
                    if (!resolvedEvent && eventParam.startsWith("ev_")) {
                        resolvedEvent = await getPublicEvent(eventParam).catch(() => null);
                    }
                }

                if (!isMounted) return;
                setShop(resolvedShop);
                setEvent(resolvedEvent);
            } catch (err) {
                console.error("[CustomerCart] Error loading:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadShopAndEvent();
        return () => { isMounted = false; };
    }, [shopSlug, eventParam]);

    useEffect(() => {
        refreshCart();
    }, [refreshCart]);

    const { itemCount, subtotal } = useMemo(() => {
        return calculateCartSummary(cartItems);
    }, [cartItems]);

    const handleUpdateQty = (cartItemId, newQty) => {
        const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";
        updateCartQuantity(shopSlug, evKey, cartItemId, newQty);
        refreshCart();
    };

    const handleRemove = (cartItemId) => {
        const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";
        removeFromCart(shopSlug, evKey, cartItemId);
        refreshCart();
    };

    const handleClearAll = () => {
        if (!window.confirm("Are you sure you want to empty your cart?")) return;
        const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";
        clearCart(shopSlug, evKey);
        refreshCart();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-gray-500">Loading Shopping Cart...</p>
            </div>
        );
    }

    const checkoutUrl = `/shop/${shopSlug}/checkout${eventParam ? `?event=${eventParam}` : ""}`;
    const catalogUrl = `/shop/${shopSlug}${eventParam ? `?event=${eventParam}` : ""}`;

    return (
        <StorefrontLayout
            shop={shop}
            event={event}
            cartItemCount={itemCount}
            cartSubtotal={subtotal}
            showBackButton={true}
            backTo={catalogUrl}
            backLabel="Catalog"
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                            Your Order Bag
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {itemCount} {itemCount === 1 ? "item" : "items"} ready for booth preparation
                        </p>
                    </div>

                    {cartItems.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                        >
                            Clear Cart
                        </button>
                    )}
                </div>

                {/* Event Booth Notice */}
                {event && (
                    <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200/60 text-teal-900 text-xs flex items-center gap-2.5">
                        <MapPin size={16} className="text-teal-600 shrink-0" />
                        <div>
                            <span className="font-extrabold">{event.name}</span>
                            {event.boothNumber && <span> • Booth #{event.boothNumber}</span>}
                            <div className="text-[11px] text-teal-700 font-medium">
                                Items will be prepared and collected at this booth counter.
                            </div>
                        </div>
                    </div>
                )}

                {/* Items List */}
                {cartItems.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200 space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                            <ShoppingBag size={28} />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-base font-black text-gray-900">Your bag is empty</h2>
                            <p className="text-xs text-gray-400 max-w-xs mx-auto">
                                Customize a mechanical letter clicker or pick a ready-made 3D toy from our booth catalog!
                            </p>
                        </div>
                        <Link
                            to={catalogUrl}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                        >
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cartItems.map((item, idx) => {
                            const custom = item.customization;
                            const isClicker = item.type === "made_to_order" && custom;
                            const itemTotal = (item.finalUnitPrice || item.price || 0) * (item.quantity || 1);

                            return (
                                <div
                                    key={item.cartItemId || idx}
                                    className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-black text-gray-900">
                                                    {item.productName}
                                                </h3>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/60">
                                                    ₱{Number(item.finalUnitPrice).toFixed(0)} ea
                                                </span>
                                            </div>

                                            {/* Made-to-Order Clicker Customization Summary */}
                                            {isClicker && (
                                                <div className="space-y-2 pt-1 text-xs text-gray-600">
                                                    {/* Text sequence */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-400">Word:</span>
                                                        <span className="font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md tracking-wider">
                                                            {custom.text} ({custom.slots}-Key)
                                                        </span>
                                                    </div>

                                                    {/* Keycaps individual colors pill breakdown */}
                                                    {custom.slotsData && (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-gray-400">Keys:</span>
                                                            {custom.slotsData.map((s, sIdx) => (
                                                                <span
                                                                    key={sIdx}
                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-800"
                                                                >
                                                                    <span
                                                                        className="w-2.5 h-2.5 rounded-full inline-block"
                                                                        style={{ backgroundColor: s.isIcon ? "transparent" : s.colorHex }}
                                                                    />
                                                                    <span>
                                                                        {s.isIcon ? <IconArtwork icon={{...s,id:s.iconId,name:s.iconName}} /> : `${s.char}: ${s.colorName}`}
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Casing & Switch details */}
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                                                        {custom.casingColor && (
                                                            <span>
                                                                Casing: <strong>{custom.casingColor.name}</strong> ({custom.casingStyle})
                                                            </span>
                                                        )}
                                                        {custom.switchType && (
                                                            <span>
                                                                • Switch: <strong>{custom.switchType.name}</strong>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Add-ons */}
                                                    {custom.addons && custom.addons.length > 0 && (
                                                        <div className="text-[11px] text-purple-700 font-semibold">
                                                            Add-ons: {custom.addons.map((a) => a.name).join(", ")}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Ready-made variant summary */}
                                            {item.selectedVariant && (
                                                <p className="text-xs text-gray-500 font-medium">
                                                    Variant: {item.selectedVariant.color || item.selectedVariant.name}
                                                </p>
                                            )}
                                        </div>

                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(item.cartItemId)}
                                            className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                            title="Remove item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Quantity Stepper & Item Subtotal */}
                                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400">Qty:</span>
                                            <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQty(item.cartItemId, (item.quantity || 1) - 1)}
                                                    className="w-7 h-7 rounded-lg bg-white hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                                >
                                                    <Minus size={13} />
                                                </button>
                                                <span className="w-8 text-center text-xs font-black text-gray-900">
                                                    {item.quantity || 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQty(item.cartItemId, (item.quantity || 1) + 1)}
                                                    className="w-7 h-7 rounded-lg bg-white hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-sm font-black text-gray-900">
                                                ₱{Number(itemTotal).toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Order Summary Card */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-3">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                                Summary Breakdown
                            </h3>
                            <div className="space-y-1.5 text-xs text-gray-600">
                                <div className="flex justify-between">
                                    <span>Items Subtotal:</span>
                                    <span className="font-bold text-gray-900">₱{Number(subtotal).toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Booth Pickup Fee:</span>
                                    <span className="font-bold text-emerald-600">FREE</span>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-sm font-black text-gray-900">Estimated Total</span>
                                <span className="text-xl font-black text-teal-700">₱{Number(subtotal).toFixed(0)}</span>
                            </div>
                        </div>

                        {/* Checkout CTA */}
                        <div className="pt-2">
                            <Link
                                to={checkoutUrl}
                                className="w-full py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Proceed to Checkout</span>
                                <ArrowRight size={17} />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </StorefrontLayout>
    );
}
