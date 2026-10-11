import { checkoutAvailability, checkCheckoutService } from '../../../services/orderSubmissionService';
import { bazaarOperation } from '../../../services/bazaarDiagnostics';
import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
    getPublicShopBySlug,
    getPublicEventBySlugOrId,
} from "../../../services/bazaarService";
import {
    loadCart,
    clearCart,
    calculateCartSummary,
} from "../../../utils/bazaarCart";
import StorefrontLayout from "../../../components/bazaar/storefront/StorefrontLayout";
import {
    CreditCard,
    Banknote,
    QrCode,
    CheckCircle2,
    ShieldCheck,
    AlertCircle,
    ArrowRight,
    Copy,
    Check,
} from "lucide-react";

export default function CustomerCheckout({ onOrderSubmit = null }) {
    const { shopSlug } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const eventParam = searchParams.get("event") || "";

    const [loading, setLoading] = useState(true);
    const [shop, setShop] = useState(null);
    const [event, setEvent] = useState(null);
    const [cartItems, setCartItems] = useState([]);

    // Customer Form Inputs
    const [customerName, setCustomerName] = useState("");
    const [customerContact, setCustomerContact] = useState("");
    const [orderNotes, setOrderNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash' | 'gcash'
    const [gcashReference, setGcashReference] = useState("");
    const [copiedGcash, setCopiedGcash] = useState(false);

    // Form submission state
    const [serviceStatus,setServiceStatus]=useState(()=>({available:false,message:checkoutAvailability().available?'Checking online ordering…':checkoutAvailability().message}));
    const checkout = typeof onOrderSubmit === 'function' ? { available: true } : serviceStatus;
    useEffect(()=>{
        let active=true,timer;
        async function check(){const result=await checkCheckoutService();if(active){setServiceStatus(result);timer=setTimeout(check,30000);}}
        if(typeof onOrderSubmit!=='function')check();
        return()=>{active=false;clearTimeout(timer);};
    },[onOrderSubmit]);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [submittedOrder, setSubmittedOrder] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            setLoading(true);
            try {
                const resolvedShop = await bazaarOperation('checkout-shop', 'public_shops/{shop}', () => getPublicShopBySlug(shopSlug));

                let resolvedEvent = null;
                if (eventParam) {
                    try {
                        resolvedEvent = await bazaarOperation('checkout-event', 'public_events/{event}', () => getPublicEventBySlugOrId(eventParam));
                        if (!resolvedEvent) {
                            setErrorMessage(`Notice: Event "${eventParam}" could not be verified or is unpublished.`);
                        }
                    } catch (evErr) {
                        setErrorMessage(`Event "${eventParam}" could not be verified. Please check your link or network.`);
                    }
                }

                if (!isMounted) return;
                setShop(resolvedShop);
                setEvent(resolvedEvent);

                // Set default payment method based on shop configuration
                if (resolvedShop) {
                    if (resolvedShop.cashEnabled !== false) {
                        setPaymentMethod("cash");
                    } else if (resolvedShop.gcashEnabled === true) {
                        setPaymentMethod("gcash");
                    }
                }

                // Load cart
                const evKey = resolvedEvent?.slug || resolvedEvent?.eventId || resolvedEvent?.id || eventParam || "general";
                const items = loadCart(shopSlug, evKey);
                setCartItems(items);
            } catch (err) {
                if (isMounted) setErrorMessage(err.message || "Checkout details could not be verified.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();
        return () => { isMounted = false; };
    }, [shopSlug, eventParam]);

    const { itemCount, subtotal } = useMemo(() => {
        return calculateCartSummary(cartItems);
    }, [cartItems]);

    const handleCopyGcashNumber = () => {
        if (!shop?.gcashNumber) return;
        navigator.clipboard.writeText(shop.gcashNumber);
        setCopiedGcash(true);
        setTimeout(() => setCopiedGcash(false), 2000);
    };

    const handleSubmitOrder = async (e) => {
        e.preventDefault();
        if (!checkout.available || submitting) return;
        setErrorMessage("");

        if (!customerName.trim()) {
            setErrorMessage("Please enter a pickup name or nickname so we can call your order.");
            return;
        }

        if (cartItems.length === 0) {
            setErrorMessage("Your cart is empty. Please add items before checking out.");
            return;
        }

        // Validate event status
        if (event && (event.isAcceptingOrders === false || event.queueStatus === "paused" || event.queueStatus === "closed")) {
            setErrorMessage("Ordering is currently paused for this booth. Please speak with booth staff.");
            return;
        }

        if (!shop || (eventParam && !event) || (event && event.shopId !== shop.shopId)) { setErrorMessage('The shop or event could not be verified. Reload before ordering.'); return; }
        setSubmitting(true);

        try {
            const evKey = event?.slug || event?.eventId || event?.id || eventParam || "general";

            const attemptKey = 'bazaar-checkout:' + shopSlug + ':' + evKey;
            const fingerprint = JSON.stringify(cartItems.map(i => [i.productId, i.quantity, i.customization, i.selectedVariant?.id]));
            const saved = JSON.parse(localStorage.getItem(attemptKey) || 'null');
            const attempt = saved?.fingerprint === fingerprint ? saved : { fingerprint, key: crypto.randomUUID() };
            localStorage.setItem(attemptKey, JSON.stringify(attempt));
            // Client prices are estimates; the trusted endpoint recomputes totals.
            const orderPayload = {
                shopId: shop.shopId || shop.id,
                sellerUid: shop.ownerUid || ((shop.shopId || shop.id || '').startsWith('shop_') ? (shop.shopId || shop.id).replace('shop_', '') : null),
                shopSlug: shop.slug || shopSlug,
                eventId: event?.eventId || event?.id || null,
                eventName: event?.name || null,
                boothNumber: event?.boothNumber || null,
                customerName: customerName.trim(),
                customerContact: customerContact.trim() || null,
                orderNotes: orderNotes.trim() || null,
                paymentMethod,
                gcashReference: paymentMethod === "gcash" ? gcashReference.trim() : null,
                pickupInstructions: event?.pickupInstructions || shop.pickupInstructions || '',
                items: cartItems,
                estimatedTotal: subtotal,
                submittedAt: new Date().toISOString(),
                idempotencyKey: attempt.key,
            };

            // Call trusted order submit handler if provided, or service contract
            let result = null;
            if (typeof onOrderSubmit === "function") {
                result = await onOrderSubmit(orderPayload);
            } else {
                // Import dynamic trusted order adapter
                const { submitGuestOrder } = await import("../../../services/orderSubmissionService.js");
                result = await submitGuestOrder(orderPayload);
            }

            if (result && result.success) {
                // Clear cart upon verified submission
                clearCart(shopSlug, evKey);
                localStorage.removeItem(attemptKey);
                setSubmittedOrder(result.order || result);

                // If tracking token available, navigate to tracking
                if (result.trackingToken) {
                    navigate(`/order/track/${result.trackingToken}`);
                }
            } else {
                throw new Error(result?.message || "Order submission could not be verified.");
            }
        } catch (err) {
            console.error("[CustomerCheckout] Submission failed:", err);
            setErrorMessage((err.message || 'Confirmation could not be retrieved.') + ' If the connection was interrupted, retry this same cart to retrieve the original confirmation; do not submit a separate order.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-gray-500">Preparing Checkout...</p>
            </div>
        );
    }

    if (cartItems.length === 0 && !submittedOrder) {
        return (
            <StorefrontLayout shop={shop} event={event}>
                <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                        <AlertCircle size={24} />
                    </div>
                    <h2 className="text-base font-black text-gray-900">Your cart is empty</h2>
                    <p className="text-xs text-gray-400">
                        You have no items in your cart to checkout.
                    </p>
                    <Link
                        to={`/shop/${shopSlug}${eventParam ? `?event=${eventParam}` : ""}`}
                        className="inline-flex px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs"
                    >
                        Browse Catalog
                    </Link>
                </div>
            </StorefrontLayout>
        );
    }

    // Order Confirmation Screen
    if (submittedOrder) {
        return (
            <StorefrontLayout shop={shop} event={event}>
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-lg text-center space-y-6 animate-in fade-in duration-200">
                    <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircle2 size={36} />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60">
                            Order Received
                        </span>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            Thank You, {submittedOrder.customerName || customerName}!
                        </h2>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                            Your order has been sent to our booth production queue. Our staff will review and prepare your custom 3D prints shortly!
                        </p>
                    </div>

                    {/* Order Details Badge */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left text-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Order Number:</span>
                            <span className="font-mono font-black text-gray-900">{submittedOrder.orderNumber || "ORD-PENDING"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Pickup Location:</span>
                            <span className="font-bold text-gray-900">
                                {event ? `${event.name} (Booth #${event.boothNumber || "General"})` : "Main Booth Counter"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Payment:</span>
                            <span className="font-bold capitalize text-gray-900">
                                {paymentMethod} (₱{Number(subtotal).toFixed(0)})
                            </span>
                        </div>
                    </div>

                    {submittedOrder.trackingToken && (
                        <Link
                            to={`/order/track/${submittedOrder.trackingToken}`}
                            className="w-full py-3 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            <span>Live Order Tracking</span>
                            <ArrowRight size={14} />
                        </Link>
                    )}
                </div>
            </StorefrontLayout>
        );
    }

    return (
        <StorefrontLayout
            shop={shop}
            event={event}
            cartItemCount={itemCount}
            cartSubtotal={subtotal}
            showBackButton={true}
            backTo={`/shop/${shopSlug}/cart${eventParam ? `?event=${eventParam}` : ""}`}
            backLabel="Cart"
        >
            <form onSubmit={handleSubmitOrder} className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                        Booth Checkout
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Confirm your order details and choose how you want to pay.
                    </p>
                </div>

                {errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Step 1: Customer Identification */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-4">
                    <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-teal-600" />
                        1. Pickup Information
                    </h2>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Pickup Name or Nickname <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="E.g. Ken, Sarah, Coach Mike"
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                                We'll call this name when your order is ready at the booth!
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Mobile / SMS Contact (Optional)
                            </label>
                            <input
                                type="tel"
                                value={customerContact}
                                onChange={(e) => setCustomerContact(e.target.value)}
                                placeholder="E.g. 0917-123-4567"
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Special Instructions / Notes (Optional)
                            </label>
                            <textarea
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                rows={2}
                                placeholder="E.g. Need extra keyring ring, will pick up in 30 mins"
                                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Step 2: Payment Method */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-4">
                    <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Banknote size={14} className="text-teal-600" />
                        2. Payment Method
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Cash Option */}
                        {shop?.cashEnabled !== false && (
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("cash")}
                                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                    paymentMethod === "cash"
                                        ? "border-teal-500 bg-teal-50 text-teal-950 ring-2 ring-teal-400/20"
                                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Banknote size={18} className="text-teal-600" />
                                        <span className="font-extrabold text-xs">Cash at Booth</span>
                                    </div>
                                    {paymentMethod === "cash" && <Check size={16} className="text-teal-600" />}
                                </div>
                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                    Pay directly at the booth counter upon pickup.
                                </p>
                            </button>
                        )}

                        {/* GCash Option */}
                        {shop?.gcashEnabled === true && (
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("gcash")}
                                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                    paymentMethod === "gcash"
                                        ? "border-teal-500 bg-teal-50 text-teal-950 ring-2 ring-teal-400/20"
                                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={18} className="text-blue-600" />
                                        <span className="font-extrabold text-xs">GCash Mobile</span>
                                    </div>
                                    {paymentMethod === "gcash" && <Check size={16} className="text-teal-600" />}
                                </div>
                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                    Send via GCash QR / account number and enter reference.
                                </p>
                            </button>
                        )}
                    </div>

                    {/* GCash Payment Instructions Box */}
                    {paymentMethod === "gcash" && (
                        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs">
                                <QrCode size={16} className="text-blue-600" />
                                <span>Seller GCash Information</span>
                            </div>

                            <div className="space-y-2 text-xs">
                                {shop?.gcashName && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Account Name:</span>
                                        <span className="font-bold text-gray-800">{shop.gcashName}</span>
                                    </div>
                                )}
                                {shop?.gcashNumber && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Account Number:</span>
                                        <div className="flex items-center gap-1.5 font-mono font-bold text-blue-800">
                                            <span>{shop.gcashNumber}</span>
                                            <button
                                                type="button"
                                                onClick={handleCopyGcashNumber}
                                                className="p-1 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
                                                title="Copy GCash number"
                                            >
                                                {copiedGcash ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {shop?.gcashQrUrl && (
                                <div className="pt-2 text-center">
                                    <img
                                        src={shop.gcashQrUrl}
                                        alt="Seller GCash QR"
                                        className="w-40 h-40 object-contain mx-auto rounded-xl border border-blue-200 bg-white p-2 shadow-xs"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-1 block">
                                        Scan with your GCash app to send ₱{Number(subtotal).toFixed(0)}
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-bold text-blue-950 mb-1">
                                    GCash Reference Number (Optional / Recommended)
                                </label>
                                <input
                                    type="text"
                                    value={gcashReference}
                                    onChange={(e) => setGcashReference(e.target.value)}
                                    placeholder="E.g. 1002 9384 1928"
                                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="p-2.5 rounded-xl bg-white/80 border border-blue-200/60 text-[11px] text-blue-800 leading-relaxed">
                                <strong>Notice:</strong> The booth seller will manually verify your GCash receipt at the counter before releasing your order.
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 3: Order Review & Submit */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400">Total Due ({itemCount} items):</span>
                        <span className="text-xl font-black text-gray-900">₱{Number(subtotal).toFixed(0)}</span>
                    </div>

                    {!checkout.available && <p role="status" className="mb-3 text-sm text-amber-800 bg-amber-50 p-3 rounded-xl">{checkout.message} Your cart is saved on this device.</p>}
                    <button
                        type="submit"
                        disabled={submitting || !checkout.available}
                        className="w-full py-4 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {submitting ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Submitting Order...</span>
                            </div>
                        ) : (
                            <>
                                <span>Place Order (₱{Number(subtotal).toFixed(0)})</span>
                                <ArrowRight size={17} />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </StorefrontLayout>
    );
}
