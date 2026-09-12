import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import FilamentForm from "../components/studio/FilamentForm";
import FilamentCard from "../components/studio/FilamentCard";
import ConsumableForm from "../components/studio/ConsumableForm";
import ConsumableCard from "../components/studio/ConsumableCard";
import CostCalculator from "../components/studio/CostCalculator";

// ─── Tab Config ────────────────────────────────────────────────────────────

const TABS = [
    { id: "filaments", label: "🧵 Filaments" },
    { id: "consumables", label: "📦 Consumables" },
    { id: "calculator", label: "🧮 Cost Calculator" },
];

// ─── Slide-in Form Panel ───────────────────────────────────────────────────

function FormPanel({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-auto max-h-[90vh] overflow-y-auto animate-[fadeInUp_0.2s_ease] relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
                <h2 className="text-xl font-black text-gray-900 mb-6">
                    {title}
                </h2>
                {children}
            </div>
        </div>
    );
}

// ─── Filaments Tab ─────────────────────────────────────────────────────────

function FilamentsTab({ filaments, onRefresh }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);

    const handleSave = async (data) => {
        if (!window.electronAPI) return;
        if (editing) {
            await window.electronAPI.updateFilament(editing.id, data);
        } else {
            await window.electronAPI.addFilament(data);
        }
        setShowForm(false);
        setEditing(null);
        onRefresh();
    };

    const handleEdit = (filament) => {
        setEditing(filament);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.electronAPI) return;
        if (!confirm("Delete this filament?")) return;
        await window.electronAPI.deleteFilament(id);
        onRefresh();
    };

    return (
        <>
            {showForm && (
                <FormPanel
                    title={editing ? "Edit Filament" : "Add Filament"}
                    onClose={() => {
                        setShowForm(false);
                        setEditing(null);
                    }}>
                    <FilamentForm
                        initial={editing}
                        onSave={handleSave}
                        onCancel={() => {
                            setShowForm(false);
                            setEditing(null);
                        }}
                    />
                </FormPanel>
            )}

            {/* Filament Status Dashboard */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900">
                        {filaments.filter((f) => f.status === "New").length}
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase mt-1">
                        🟢 New
                    </span>
                </div>
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900">
                        {filaments.filter((f) => f.status === "In Use").length}
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase mt-1">
                        🟡 In Use
                    </span>
                </div>
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900">
                        {filaments.filter((f) => f.status === "Low").length}
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase mt-1">
                        🟠 Low
                    </span>
                </div>
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900">
                        {filaments.filter((f) => f.status === "Empty").length}
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase mt-1">
                        🔴 Empty
                    </span>
                </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">
                            Filament Inventory
                        </h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                            {filaments.length} spool
                            {filaments.length !== 1 ? "s" : ""} tracked
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditing(null);
                            setShowForm(true);
                        }}
                        className="bg-primary hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm flex items-center gap-2">
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Add Filament
                    </button>
                </div>

                {filaments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <div className="text-5xl mb-4">🧵</div>
                        <p className="text-sm font-semibold">
                            No filaments yet
                        </p>
                        <p className="text-xs mt-1">
                            Click "Add Filament" to start tracking your spools.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filaments.map((f) => (
                            <FilamentCard
                                key={f.id}
                                filament={f}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Consumables Tab ───────────────────────────────────────────────────────

function ConsumablesTab({ consumables, onRefresh }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);

    const handleSave = async (data) => {
        if (!window.electronAPI) return;
        if (editing) {
            await window.electronAPI.updateConsumable(editing.id, data);
        } else {
            await window.electronAPI.addConsumable(data);
        }
        setShowForm(false);
        setEditing(null);
        onRefresh();
    };

    const handleEdit = (consumable) => {
        setEditing(consumable);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.electronAPI) return;
        if (!confirm("Delete this consumable?")) return;
        await window.electronAPI.deleteConsumable(id);
        onRefresh();
    };

    return (
        <>
            {showForm && (
                <FormPanel
                    title={editing ? "Edit Consumable" : "Add Consumable"}
                    onClose={() => {
                        setShowForm(false);
                        setEditing(null);
                    }}>
                    <ConsumableForm
                        initial={editing}
                        onSave={handleSave}
                        onCancel={() => {
                            setShowForm(false);
                            setEditing(null);
                        }}
                    />
                </FormPanel>
            )}

            <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">
                            Consumables Inventory
                        </h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                            {consumables.length} item
                            {consumables.length !== 1 ? "s" : ""} tracked
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditing(null);
                            setShowForm(true);
                        }}
                        className="bg-primary hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm flex items-center gap-2">
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Add Item
                    </button>
                </div>

                {consumables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <div className="text-5xl mb-4">📦</div>
                        <p className="text-sm font-semibold">
                            No consumables yet
                        </p>
                        <p className="text-xs mt-1">
                            Click "Add Item" to track packaging, labels, and
                            more.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {consumables.map((c) => (
                            <ConsumableCard
                                key={c.id}
                                consumable={c}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function StudioHub({ isLicensed }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("filaments");
    const [filaments, setFilaments] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isLicensed === false) {
            navigate('/', { replace: true });
        }
    }, [isLicensed, navigate]);

    const handleExportCSV = (data) => {
        if (!data || data.length === 0) return;
        const keys = Object.keys(data[0]);
        const csvRows = [];
        csvRows.push(keys.join(","));
        for (const row of data) {
            const values = keys.map((k) => {
                const val =
                    row[k] !== undefined && row[k] !== null
                        ? row[k].toString()
                        : "";
                return val.includes(",") ? `"${val}"` : val;
            });
            csvRows.push(values.join(","));
        }
        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kencreations_tracker_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportCSV = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split("\n").filter((l) => l.trim() !== "");
            if (lines.length < 2) return;
            const headers = lines[0].split(",").map((h) => h.trim());
            const newItems = [];
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].split(",");
                const obj = {};
                headers.forEach((h, idx) => {
                    let v = vals[idx] || "";
                    obj[h] = v.replace(/^"|"$/g, "").trim();
                });
                newItems.push(obj);
            }

            if (activeTab === "filaments") {
                setFilaments((prev) => [...prev, ...newItems]);
                if (window.electronAPI) {
                    for (const item of newItems) {
                        let itemToSave = { ...item };
                        delete itemToSave.id; // Allow DB to auto-generate ID
                        await window.electronAPI.addFilament(itemToSave);
                    }
                }
            } else if (activeTab === "consumables") {
                setConsumables((prev) => [...prev, ...newItems]);
                if (window.electronAPI) {
                    for (const item of newItems) {
                        let itemToSave = { ...item };
                        delete itemToSave.id;
                        await window.electronAPI.addConsumable(itemToSave);
                    }
                }
            }
            loadData(); // Resync from DB to get fresh IDs
        };
        reader.readAsText(file);
        event.target.value = null; // reset input
    };

    const loadData = useCallback(async () => {
        if (!window.electronAPI) {
            setLoading(false);
            return;
        }
        try {
            const [fils, cons] = await Promise.all([
                window.electronAPI.getFilaments(),
                window.electronAPI.getConsumables(),
            ]);
            setFilaments(fils ?? []);
            setConsumables(cons ?? []);
        } catch (err) {
            console.error("[StudioHub] Failed to load data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#fff0e5] via-teal-100 to-[#00A3A3] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-gradient-to-br from-[#fff0e5] via-teal-100 to-[#00A3A3] text-gray-900 overflow-y-auto pb-32 px-8 pt-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="w-10 h-10 bg-white/50 hover:bg-white/80 rounded-2xl flex items-center justify-center shadow-sm transition-colors text-gray-600 hover:text-primary">
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                                Studio Hub
                            </h1>
                            <p className="text-sm text-gray-600 font-medium">
                                Manage your materials, consumables, and print
                                costs
                            </p>
                        </div>
                    </div>

                    {activeTab !== "calculator" && (
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRef}
                                hidden
                                onChange={handleImportCSV}
                            />

                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="bg-secondary text-white hover:bg-primary font-bold py-2 px-4 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                    />
                                </svg>
                                Import CSV
                            </button>

                            <button
                                onClick={() =>
                                    handleExportCSV(
                                        activeTab === "filaments"
                                            ? filaments
                                            : consumables,
                                    )
                                }
                                className="bg-primary text-white hover:bg-gray-800 font-bold py-2 px-4 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                                Export CSV
                            </button>
                        </div>
                    )}
                </div>

                {/* Tab Bar */}
                <div className="bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl p-1.5 flex gap-1 shadow-sm">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === tab.id
                                    ? "bg-white shadow-md text-gray-900"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                            }`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === "filaments" && (
                    <FilamentsTab filaments={filaments} onRefresh={loadData} />
                )}
                {activeTab === "consumables" && (
                    <ConsumablesTab
                        consumables={consumables}
                        onRefresh={loadData}
                    />
                )}
                {activeTab === "calculator" && (
                    <CostCalculator
                        filaments={filaments}
                        consumables={consumables}
                    />
                )}
            </div>
        </div>
    );
}
