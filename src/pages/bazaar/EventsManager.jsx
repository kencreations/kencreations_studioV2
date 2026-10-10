import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getSellerEvents,
    createEvent,
    updateEvent,
    toggleEventAcceptingOrders,
    updateEventStatus,
} from "../../services/bazaarService";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import QrCodeModal from "../../components/bazaar/QrCodeModal";
import {
    Calendar,
    Plus,
    QrCode,
    MapPin,
    Clock,
    AlertCircle,
    CheckCircle2,
    X,
    Edit2,
    Pause,
    StopCircle,
    Check,
    ChevronRight,
} from "lucide-react";

export default function EventsManager() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [shop, setShop] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filterTab, setFilterTab] = useState("all"); // 'all' | 'active' | 'ended'

    // QR Modal State
    const [qrEvent, setQrEvent] = useState(null);

    // Modal Control State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Form Fields
    const [name, setName] = useState("");
    const [venue, setVenue] = useState("");
    const [boothNumber, setBoothNumber] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [openingHours, setOpeningHours] = useState("");
    const [pickupInstructions, setPickupInstructions] = useState("");
    const [pendingQueueCapacity, setPendingQueueCapacity] = useState(10);
    const [activeProductionCapacity, setActiveProductionCapacity] = useState(5);
    const [isAcceptingOrders, setIsAcceptingOrders] = useState(true);
    const [status, setStatus] = useState("Scheduled");

    const loadData = useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [shopData, eventsData] = await Promise.all([
                getSellerShop(currentUser.uid).catch(() => null),
                getSellerEvents(currentUser.uid).catch(() => []),
            ]);
            setShop(shopData);
            setEvents(eventsData);
        } catch (err) {
            console.error("[EventsManager] Failed to load data:", err);
            setErrorMessage("Failed to load events.");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        let isMounted = true;
        if (!currentUser?.uid) return;

        async function fetchInitial() {
            setLoading(true);
            try {
                const [shopData, eventsData] = await Promise.all([
                    getSellerShop(currentUser.uid).catch(() => null),
                    getSellerEvents(currentUser.uid).catch(() => []),
                ]);
                if (isMounted) {
                    setShop(shopData);
                    setEvents(eventsData);
                }
            } catch (err) {
                console.error("[EventsManager] Failed to load data:", err);
                if (isMounted) setErrorMessage("Failed to load events.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchInitial();
        return () => { isMounted = false; };
    }, [currentUser?.uid]);

    // Open Create Modal
    const handleOpenCreate = () => {
        setEditingEvent(null);
        setName("");
        setVenue("");
        setBoothNumber("");
        setStartDate(new Date().toISOString().slice(0, 10));
        setEndDate(new Date().toISOString().slice(0, 10));
        setOpeningHours("10:00 AM - 8:00 PM");
        setPickupInstructions(shop?.pickupInstructions || "Pick up at counter");
        setPendingQueueCapacity(10);
        setActiveProductionCapacity(5);
        setIsAcceptingOrders(true);
        setStatus("Active");
        setErrorMessage("");
        setIsCreateModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (event) => {
        setEditingEvent(event);
        setName(event.name || "");
        setVenue(event.venue || "");
        setBoothNumber(event.boothNumber || "");
        setStartDate(event.startDate || "");
        setEndDate(event.endDate || "");
        setOpeningHours(event.openingHours || "");
        setPickupInstructions(event.pickupInstructions || "Pick up at counter");
        setPendingQueueCapacity(event.pendingQueueCapacity || 10);
        setActiveProductionCapacity(event.activeProductionCapacity || 5);
        setIsAcceptingOrders(event.isAcceptingOrders !== false);
        setStatus(event.status || "Scheduled");
        setErrorMessage("");
        setIsCreateModalOpen(true);
    };

    // Save Event (Create or Update)
    const handleSaveEvent = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMessage("");

        try {
            if (!name.trim()) throw new Error("Event name is required.");
            if (!venue.trim()) throw new Error("Venue is required.");

            const payload = {
                name: name.trim(),
                venue: venue.trim(),
                boothNumber: boothNumber.trim(),
                startDate,
                endDate,
                openingHours: openingHours.trim(),
                pickupInstructions: pickupInstructions.trim(),
                pendingQueueCapacity: Number(pendingQueueCapacity),
                activeProductionCapacity: Number(activeProductionCapacity),
                isAcceptingOrders,
                status,
            };

            if (editingEvent) {
                await updateEvent(currentUser.uid, editingEvent.eventId || editingEvent.id, payload);
                setSuccessMessage("Event updated successfully!");
            } else {
                await createEvent(currentUser.uid, payload);
                setSuccessMessage("New bazaar event created successfully!");
            }

            setIsCreateModalOpen(false);
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (err) {
            console.error("[EventsManager] Save error:", err);
            setErrorMessage(err.message || "Failed to save event.");
        } finally {
            setSaving(false);
        }
    };

    // Quick toggle accepting orders
    const handleToggleOrders = async (event, e) => {
        e.stopPropagation();
        try {
            const nextVal = !event.isAcceptingOrders;
            await toggleEventAcceptingOrders(currentUser.uid, event.eventId || event.id, nextVal);
            await loadData();
        } catch (err) {
            console.error("Failed to toggle accepting orders:", err);
        }
    };

    // End Event
    const handleEndEvent = async (event, e) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to end "${event.name}"? This closes the order queue.`)) return;
        try {
            await updateEventStatus(currentUser.uid, event.eventId || event.id, "Ended");
            await loadData();
        } catch (err) {
            console.error("Failed to end event:", err);
        }
    };

    // Filter events
    const filteredEvents = events.filter((e) => {
        if (filterTab === "active") return e.status === "Active" || e.status === "Scheduled";
        if (filterTab === "ended") return e.status === "Ended";
        return true;
    });

    return (
        <BazaarLayout activeTab="events">
            <div className="space-y-8 animate-in fade-in duration-150">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                            <Calendar className="text-teal-600" size={26} />
                            Events & Bazaars
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Schedule upcoming pop-up markets, generate booth QR codes, and manage live queue limits.
                        </p>
                    </div>

                    <button
                        onClick={handleOpenCreate}
                        className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md hover:shadow-lg flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                    >
                        <Plus size={16} /> Create Event
                    </button>
                </div>

                {/* Notifications */}
                {successMessage && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-teal-600 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Filters */}
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                    <button
                        onClick={() => setFilterTab("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            filterTab === "all"
                                ? "bg-teal-50 text-teal-800 border border-teal-200"
                                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        }`}
                    >
                        All Events ({events.length})
                    </button>
                    <button
                        onClick={() => setFilterTab("active")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            filterTab === "active"
                                ? "bg-teal-50 text-teal-800 border border-teal-200"
                                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        }`}
                    >
                        Active & Scheduled ({events.filter((e) => e.status !== "Ended").length})
                    </button>
                    <button
                        onClick={() => setFilterTab("ended")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            filterTab === "ended"
                                ? "bg-teal-50 text-teal-800 border border-teal-200"
                                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        }`}
                    >
                        Past / Ended ({events.filter((e) => e.status === "Ended").length})
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
                        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-gray-500">Loading events...</span>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                            <Calendar size={32} />
                        </div>
                        <div className="max-w-md mx-auto">
                            <h3 className="text-lg font-black text-gray-900">
                                No Events Found
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                {filterTab === "all"
                                    ? "You have not created any bazaar events yet. Click below to add your first event."
                                    : "No events match this filter tab."}
                            </p>
                        </div>
                        {filterTab === "all" && (
                            <button
                                onClick={handleOpenCreate}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                            >
                                <Plus size={16} /> Create Your First Event
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filteredEvents.map((ev) => {
                            const eventId = ev.eventId || ev.id;
                            const isLive = ev.status === "Active";
                            const isEnded = ev.status === "Ended";

                            return (
                                <div
                                    key={eventId}
                                    onClick={() => navigate(`/studio/bazaar/events/${eventId}`)}
                                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer space-y-5"
                                >
                                    <div>
                                        {/* Status & Actions Header */}
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                                        isLive
                                                            ? "bg-teal-500 text-white"
                                                            : isEnded
                                                            ? "bg-gray-100 text-gray-500"
                                                            : "bg-blue-50 text-blue-700 border border-blue-200"
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            isLive ? "bg-white animate-pulse" : isEnded ? "bg-gray-400" : "bg-blue-500"
                                                        }`}
                                                    />
                                                    {ev.status || "Scheduled"}
                                                </span>

                                                {ev.boothNumber && (
                                                    <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200/60">
                                                        Booth {ev.boothNumber}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setQrEvent(ev);
                                                    }}
                                                    className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
                                                    title="View Event QR"
                                                >
                                                    <QrCode size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenEdit(ev);
                                                    }}
                                                    className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
                                                    title="Edit Event Details"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Title & Venue */}
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight group-hover:text-teal-600 transition-colors">
                                            {ev.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                                            <MapPin size={14} className="text-teal-600 shrink-0" />
                                            <span className="truncate">{ev.venue}</span>
                                        </p>

                                        {/* Date and Hours */}
                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 font-medium mt-3">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={13} /> {ev.startDate || "Date TBD"}
                                            </span>
                                            {ev.openingHours && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={13} /> {ev.openingHours}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Footer Controls */}
                                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2">
                                            {!isEnded && (
                                                <>
                                                    <button
                                                        onClick={(e) => handleToggleOrders(ev, e)}
                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                                            ev.isAcceptingOrders
                                                                ? "bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/80"
                                                                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80"
                                                        }`}
                                                    >
                                                        {ev.isAcceptingOrders ? (
                                                            <>
                                                                <Check size={13} className="text-teal-600" />
                                                                <span>Accepting Orders</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Pause size={13} className="text-amber-600" />
                                                                <span>Intake Paused</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleEndEvent(ev, e)}
                                                        className="p-1.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="End Event"
                                                    >
                                                        <StopCircle size={15} />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        <span className="text-teal-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                            Dashboard <ChevronRight size={15} />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Event Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <Calendar size={18} className="text-teal-600" />
                                {editingEvent ? "Edit Bazaar Event" : "Create New Bazaar Event"}
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvent} className="p-6 overflow-y-auto space-y-4 flex-1">
                            {errorMessage && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Event / Market Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Megamall Maker Faire 2026"
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Venue / Mall / Location *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={venue}
                                        onChange={(e) => setVenue(e.target.value)}
                                        placeholder="e.g. SM Megamall Hall A"
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Booth / Table Number
                                    </label>
                                    <input
                                        type="text"
                                        value={boothNumber}
                                        onChange={(e) => setBoothNumber(e.target.value)}
                                        placeholder="e.g. Booth #14"
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Opening Hours
                                    </label>
                                    <input
                                        type="text"
                                        value={openingHours}
                                        onChange={(e) => setOpeningHours(e.target.value)}
                                        placeholder="10:00 AM - 8:00 PM"
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Pending Queue Capacity (Intake Limit)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={pendingQueueCapacity}
                                        onChange={(e) => setPendingQueueCapacity(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Prevents backlog overflow when booth queue is full.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Active Production Capacity (Printers)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={activeProductionCapacity}
                                        onChange={(e) => setActiveProductionCapacity(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Max simultaneous in-production jobs at booth.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Booth Pickup Instructions
                                </label>
                                <input
                                    type="text"
                                    value={pickupInstructions}
                                    onChange={(e) => setPickupInstructions(e.target.value)}
                                    placeholder="e.g. Claim at booth counter with your pickup code."
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-hidden focus:border-teal-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Initial Status
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 focus:outline-hidden focus:border-teal-500"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Active">Active (Live Now)</option>
                                        <option value="Ended">Ended</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 self-end">
                                    <span className="text-xs font-bold text-gray-800">
                                        Accepting Orders
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAcceptingOrders(!isAcceptingOrders)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                            isAcceptingOrders ? "bg-teal-600" : "bg-gray-200"
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                isAcceptingOrders ? "translate-x-6" : "translate-x-1"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                                >
                                    {saving ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Event QR Code Modal */}
            {qrEvent && (
                <QrCodeModal
                    isOpen={Boolean(qrEvent)}
                    onClose={() => setQrEvent(null)}
                    title={`${qrEvent.name} QR`}
                    subtitle={`Scannable customer QR code for ${qrEvent.venue}`}
                    url={`${window.location.origin}/#/bazaar/e/${qrEvent.eventId || qrEvent.id}`}
                    badgeText={`Booth: ${qrEvent.boothNumber || "General"}`}
                    pickupInstructions={qrEvent.pickupInstructions}
                    shopName={shop?.name || "KenCreations Studio"}
                />
            )}
        </BazaarLayout>
    );
}
