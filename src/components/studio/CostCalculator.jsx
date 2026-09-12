import React, { useState, useEffect, useMemo, useCallback } from "react";

// ─── Currency Token ─────────────────────────────────────────────────────────
// Change this one constant to localise the app for any market.
const CURRENCY = "₱";

// ─── localStorage Keys ──────────────────────────────────────────────────────
const LS_WEAR_RATE = "kc_calc_wear_rate";
const LS_ELEC_RATE = "kc_calc_electricity_rate";
const LS_WATTAGE = "kc_calc_wattage";
const LS_LABOR_RATE = "kc_calc_labor_rate";
const LS_MARGIN = "kc_calc_margin";
const LS_FAILURE_MARGIN = "kc_calc_failure_margin";

function loadLS(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v !== null ? JSON.parse(v) : fallback;
    } catch {
        return fallback;
    }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ children }) {
    return (
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">
            {children}
        </h3>
    );
}

function InputField({
    label,
    id,
    value,
    onChange,
    unit,
    min = 0,
    step = "0.01",
    type = "number",
}) {
    const isPrefix = unit === CURRENCY;
    return (
        <div className="flex flex-col gap-1">
            <label
                htmlFor={id}
                className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                {label}
            </label>
            <div className="flex items-center bg-white/50 border border-white/60 rounded-xl overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-teal-500/30">
                {unit && isPrefix && (
                    <span className="px-3 py-2 bg-white/40 text-gray-600 text-xs font-bold border-r border-white/60">
                        {unit}
                    </span>
                )}
                <input
                    id={id}
                    type={type}
                    min={min}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-3 py-2 text-sm text-gray-800 font-semibold outline-none text-right"
                />
                {unit && !isPrefix && (
                    <span className="px-3 py-2 bg-white/40 text-gray-600 text-xs font-bold border-l border-white/60">
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
}

function BreakdownRow({ label, value, isTotal = false, highlight = false }) {
    return (
        <div
            className={`flex justify-between items-center py-1 ${isTotal ? "border-t border-gray-200 mt-2 pt-3" : ""}`}>
            <span
                className={`text-sm font-${isTotal ? "black" : "semibold"} ${highlight ? "text-secondary" : "text-gray-600"}`}>
                {label}
            </span>
            <span
                className={`font-mono text-sm font-${isTotal ? "black" : "bold"} ${highlight ? "text-secondary" : "text-gray-800"}`}>
                {CURRENCY}
                {value.toFixed(2)}
            </span>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CostCalculator({ filaments = [], consumables = [] }) {
    // ── Material Rows (multi-color) ───────────────────────────────────────
    const [materialRows, setMaterialRows] = useState([
        { id: Date.now(), filamentId: "", modelWeight: 0, flushWaste: 0 },
    ]);

    // ── Consumable Rows ───────────────────────────────────────────────────
    const [consumableRows, setConsumableRows] = useState([
        { id: Date.now() + 1, consumableId: "", qtyUsed: 0 },
    ]);

    // ── Fixed Cost Inputs (persisted to localStorage) ─────────────────────
    const [printHours, setPrintHours] = useState(0);
    const [printMins, setPrintMins] = useState(0);
    const [wattage, setWattage] = useState(() => loadLS(LS_WATTAGE, 350));
    const [elecRate, setElecRate] = useState(() => loadLS(LS_ELEC_RATE, 11));
    const [wearRate, setWearRate] = useState(() => loadLS(LS_WEAR_RATE, 5));
    const [laborHours, setLaborHours] = useState(0);
    const [laborMins, setLaborMins] = useState(0);
    const [laborRate, setLaborRate] = useState(() => loadLS(LS_LABOR_RATE, 50));
    const [margin, setMargin] = useState(() => loadLS(LS_MARGIN, 30));
    const [failureMargin, setFailureMargin] = useState(() =>
        loadLS(LS_FAILURE_MARGIN, 10),
    );

    // Persist user-configured rates to localStorage
    useEffect(() => {
        localStorage.setItem(LS_WATTAGE, JSON.stringify(wattage));
    }, [wattage]);
    useEffect(() => {
        localStorage.setItem(LS_ELEC_RATE, JSON.stringify(elecRate));
    }, [elecRate]);
    useEffect(() => {
        localStorage.setItem(LS_WEAR_RATE, JSON.stringify(wearRate));
    }, [wearRate]);
    useEffect(() => {
        localStorage.setItem(LS_LABOR_RATE, JSON.stringify(laborRate));
    }, [laborRate]);
    useEffect(() => {
        localStorage.setItem(LS_MARGIN, JSON.stringify(margin));
    }, [margin]);
    useEffect(() => {
        localStorage.setItem(LS_FAILURE_MARGIN, JSON.stringify(failureMargin));
    }, [failureMargin]);

    // ── Dynamic Row Handlers ──────────────────────────────────────────────
    const addMaterialRow = () =>
        setMaterialRows((r) => [
            ...r,
            { id: Date.now(), filamentId: "", modelWeight: 0, flushWaste: 0 },
        ]);

    const removeMaterialRow = (id) =>
        setMaterialRows((r) => r.filter((row) => row.id !== id));

    const updateMaterialRow = (id, key, value) =>
        setMaterialRows((r) =>
            r.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
        );

    const addConsumableRow = () =>
        setConsumableRows((r) => [
            ...r,
            { id: Date.now(), consumableId: "", qtyUsed: 0 },
        ]);

    const removeConsumableRow = (id) =>
        setConsumableRows((r) => r.filter((row) => row.id !== id));

    const updateConsumableRow = (id, key, value) =>
        setConsumableRows((r) =>
            r.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
        );

    // ── Cost Calculations ─────────────────────────────────────────────────
    const costs = useMemo(() => {
        // Material cost: (model_weight + flush_waste) / spool_weight * purchase_price
        const material = materialRows.reduce((sum, row) => {
            const fil = filaments.find(
                (f) => String(f.id) === String(row.filamentId),
            );
            if (!fil || fil.spool_weight_g <= 0) return sum;
            return (
                sum +
                ((row.modelWeight + row.flushWaste) / fil.spool_weight_g) *
                    fil.purchase_price
            );
        }, 0);

        // Consumable cost: qty_used * (pack_price / pack_qty)
        const consumable = consumableRows.reduce((sum, row) => {
            const item = consumables.find(
                (c) => String(c.id) === String(row.consumableId),
            );
            if (!item || item.pack_quantity <= 0) return sum;
            return sum + row.qtyUsed * (item.pack_price / item.pack_quantity);
        }, 0);

        // Time conversions
        const printTimeHrs = printHours + printMins / 60;
        const laborTimeHrs = laborHours + laborMins / 60;

        // Electricity: (W/1000) * h * rate_per_kWh
        const electricity = (wattage / 1000) * printTimeHrs * elecRate;

        // Machine wear: h * rate_per_hour
        const wear = printTimeHrs * wearRate;

        // Labor: h * rate_per_hour
        const labor = laborTimeHrs * laborRate;

        const subtotal = material + consumable + electricity + wear + labor;
        const failureBufferCost = subtotal * (failureMargin / 100);
        const adjustedBaseCost = subtotal + failureBufferCost;
        const finalPrice = adjustedBaseCost * (1 + margin / 100);

        return {
            material,
            consumable,
            electricity,
            wear,
            labor,
            subtotal,
            failureBufferCost,
            adjustedBaseCost,
            finalPrice,
        };
    }, [
        materialRows,
        consumableRows,
        filaments,
        consumables,
        printHours,
        printMins,
        wattage,
        elecRate,
        wearRate,
        laborHours,
        laborMins,
        laborRate,
        margin,
        failureMargin,
    ]);

    const selectCls =
        "bg-white/60 border border-gray-200/60 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-[#00A3A3] focus:ring-2 focus:ring-[#00A3A3]/20 transition-all duration-200 flex-1";
    const smallInputCls =
        "w-20 bg-white/60 border border-gray-200/60 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-[#00A3A3] focus:ring-2 focus:ring-[#00A3A3]/20 transition-all duration-200";

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 items-start">
            {/* LEFT COLUMN: The Inputs */}
            <div className="flex flex-col gap-6">
                {/* Top Row of Inputs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Material Rows */}
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <SectionHeader>🧵 Material Cost</SectionHeader>
                            <button
                                onClick={addMaterialRow}
                                className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                                <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                Add Color
                            </button>
                        </div>
                        <div className="space-y-3">
                            {filaments.length === 0 ? (
                                <p className="text-xs text-gray-400 font-medium text-center py-4">
                                    No filaments added yet. Add some in the
                                    Filaments tab.
                                </p>
                            ) : (
                                materialRows.map((row, idx) => (
                                    <div
                                        key={row.id}
                                        className="bg-gray-50 rounded-2xl p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400 w-5">
                                                #{idx + 1}
                                            </span>
                                            <select
                                                value={row.filamentId}
                                                onChange={(e) =>
                                                    updateMaterialRow(
                                                        row.id,
                                                        "filamentId",
                                                        e.target.value,
                                                    )
                                                }
                                                className={selectCls}>
                                                <option value="">
                                                    — Select Filament —
                                                </option>
                                                {filaments.map((f) => (
                                                    <option
                                                        key={f.id}
                                                        value={f.id}>
                                                        {f.name} ({f.material},{" "}
                                                        {CURRENCY}
                                                        {(
                                                            f.purchase_price /
                                                            f.spool_weight_g
                                                        ).toFixed(3)}
                                                        /g)
                                                    </option>
                                                ))}
                                            </select>
                                            {materialRows.length > 1 && (
                                                <button
                                                    onClick={() =>
                                                        removeMaterialRow(
                                                            row.id,
                                                        )
                                                    }
                                                    className="text-gray-300 hover:text-red-500 transition-colors">
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M6 18L18 6M6 6l12 12"
                                                        />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pl-7">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">
                                                    Model (g)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={row.modelWeight}
                                                    onChange={(e) =>
                                                        updateMaterialRow(
                                                            row.id,
                                                            "modelWeight",
                                                            parseFloat(
                                                                e.target.value,
                                                            ) || 0,
                                                        )
                                                    }
                                                    className="w-full bg-white/60 border border-gray-200/60 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-[#00A3A3] focus:ring-2 focus:ring-[#00A3A3]/20 transition-all duration-200 mt-1"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">
                                                    Flush Waste (g)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={row.flushWaste}
                                                    onChange={(e) =>
                                                        updateMaterialRow(
                                                            row.id,
                                                            "flushWaste",
                                                            parseFloat(
                                                                e.target.value,
                                                            ) || 0,
                                                        )
                                                    }
                                                    className="w-full bg-white/60 border border-gray-200/60 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-[#00A3A3] focus:ring-2 focus:ring-[#00A3A3]/20 transition-all duration-200 mt-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Consumable Rows */}
                    <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <SectionHeader>📦 Consumables Cost</SectionHeader>
                            <button
                                onClick={addConsumableRow}
                                className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                                <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                Add Item
                            </button>
                        </div>
                        <div className="space-y-3">
                            {consumables.length === 0 ? (
                                <p className="text-xs text-gray-400 font-medium text-center py-4">
                                    No consumables added yet. Add some in the
                                    Consumables tab.
                                </p>
                            ) : (
                                consumableRows.map((row, idx) => (
                                    <div
                                        key={row.id}
                                        className="bg-gray-50 rounded-2xl p-3 flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400 w-5">
                                            #{idx + 1}
                                        </span>
                                        <select
                                            value={row.consumableId}
                                            onChange={(e) =>
                                                updateConsumableRow(
                                                    row.id,
                                                    "consumableId",
                                                    e.target.value,
                                                )
                                            }
                                            className={selectCls}>
                                            <option value="">
                                                — Select Item —
                                            </option>
                                            {consumables.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} ({CURRENCY}
                                                    {(
                                                        c.pack_price /
                                                        c.pack_quantity
                                                    ).toFixed(3)}
                                                    /{c.unit_of_measure})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={row.qtyUsed}
                                            title="Quantity used"
                                            placeholder="Qty"
                                            onChange={(e) =>
                                                updateConsumableRow(
                                                    row.id,
                                                    "qtyUsed",
                                                    parseFloat(
                                                        e.target.value,
                                                    ) || 0,
                                                )
                                            }
                                            className={smallInputCls}
                                        />
                                        {consumableRows.length > 1 && (
                                            <button
                                                onClick={() =>
                                                    removeConsumableRow(row.id)
                                                }
                                                className="text-gray-300 hover:text-red-500 transition-colors">
                                                <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Row of Inputs */}
                {/* Fixed Costs */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                    <SectionHeader>⚡ Fixed Costs</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {/* Column 1: Print & Machine */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                                    Print Time
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center bg-white/50 border border-white/60 rounded-xl overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-teal-500/30">
                                        <input
                                            type="number"
                                            min="0"
                                            value={printHours}
                                            onChange={(e) =>
                                                setPrintHours(
                                                    parseInt(e.target.value) ||
                                                        0,
                                                )
                                            }
                                            className="w-full bg-transparent px-3 py-2 text-sm text-gray-800 font-semibold outline-none text-right"
                                        />
                                        <span className="px-3 py-2 bg-white/40 text-gray-600 text-xs font-bold border-l border-white/60">
                                            hrs
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center bg-white/50 border border-white/60 rounded-xl overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-teal-500/30">
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={printMins}
                                            onChange={(e) =>
                                                setPrintMins(
                                                    parseInt(e.target.value) ||
                                                        0,
                                                )
                                            }
                                            className="w-full bg-transparent px-3 py-2 text-sm text-gray-800 font-semibold outline-none text-right"
                                        />
                                        <span className="px-3 py-2 bg-white/40 text-gray-600 text-xs font-bold border-l border-white/60">
                                            min
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <InputField
                                label={`Machine Wattage`}
                                id="wattage"
                                value={wattage}
                                onChange={setWattage}
                                unit="W"
                                min={0}
                                step="1"
                            />
                            <InputField
                                label={`Machine Wear /hr`}
                                id="wear-rate"
                                value={wearRate}
                                onChange={setWearRate}
                                unit={CURRENCY}
                            />
                        </div>

                        {/* Column 2: Labor & Electricity */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                                    Labor Time
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center bg-white/50 border border-white/60 rounded-xl overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-teal-500/30">
                                        <input
                                            type="number"
                                            min="0"
                                            value={laborHours}
                                            onChange={(e) =>
                                                setLaborHours(
                                                    parseInt(e.target.value) ||
                                                        0,
                                                )
                                            }
                                            className="w-full bg-transparent px-3 py-2 text-sm text-gray-800 font-semibold outline-none text-right"
                                        />
                                        <span className="px-3 py-2 bg-white/40 text-gray-600 text-xs font-bold border-l border-white/60">
                                            hrs
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center bg-white/50 border border-white/60 rounded-xl overflow-hidden shadow-inner focus-within:ring-2 focus-within:ring-teal-500/30">
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={laborMins}
                                            onChange={(e) =>
                                                setLaborMins(
                                                    parseInt(e.target.value) ||
                                                        0,
                                                )
                                            }
                                            className="w-full bg-transparent px-3 py-2 text-sm text-gray-800 font-semibold outline-none text-right"
                                        />
                                        <span className="px-3 py-2 bg-white/40 text-gray-600 text-xs font-bold border-l border-white/60">
                                            min
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <InputField
                                label={`Electricity Rate`}
                                id="elec-rate"
                                value={elecRate}
                                onChange={setElecRate}
                                unit={CURRENCY}
                            />
                            <InputField
                                label={`Labor Rate /hr`}
                                id="labor-rate"
                                value={laborRate}
                                onChange={setLaborRate}
                                unit={CURRENCY}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Margins & Summary (Sticky) */}
            <div className="flex flex-col gap-6 sticky top-6">
                {/* Failure Margin Slider */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                    <SectionHeader>⚠️ Failure Buffer</SectionHeader>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-black text-amber-500">
                            {failureMargin}%
                        </span>
                        <span className="text-sm text-gray-500 font-semibold text-right">
                            Risk buffer
                        </span>
                    </div>
                    <input
                        id="failure-margin-slider"
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        value={failureMargin}
                        onChange={(e) =>
                            setFailureMargin(parseInt(e.target.value))
                        }
                        className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 font-medium mt-1">
                        <span>0%</span>
                        <span>50%</span>
                    </div>
                    <p className="text-[12px] text-gray-400 mt-3 font-medium">
                        Adds buffer for failed prints, calibration, and nozzle
                        purges.
                    </p>
                </div>

                {/* Profit Margin Slider */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6">
                    <SectionHeader>📈 Profit Margin</SectionHeader>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-black text-primary">
                            {margin}%
                        </span>
                        <span className="text-sm text-gray-500 font-semibold">
                            Markup on cost
                        </span>
                    </div>
                    <input
                        id="profit-margin-slider"
                        type="range"
                        min="0"
                        max="5000"
                        step="5"
                        value={margin}
                        onChange={(e) => setMargin(parseInt(e.target.value))}
                        className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-gray-400 font-medium mt-1">
                        <span>0%</span>
                        <span>1000%</span>
                        <span>2500%</span>
                        <span>5000%</span>
                    </div>
                </div>

                {/* Cost Breakdown Card */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-6 sticky top-4">
                    <SectionHeader>🧾 Cost Breakdown</SectionHeader>

                    <div className="space-y-0.5">
                        <BreakdownRow
                            label="🧵 Material Cost"
                            value={costs.material}
                        />
                        <BreakdownRow
                            label="📦 Consumables Cost"
                            value={costs.consumable}
                        />
                        <BreakdownRow
                            label="⚡ Electricity Cost"
                            value={costs.electricity}
                        />
                        <BreakdownRow
                            label="🔩 Machine Wear"
                            value={costs.wear}
                        />
                        <BreakdownRow
                            label="👷 Labor Cost"
                            value={costs.labor}
                        />
                        <BreakdownRow
                            label={`⚠️ Failure Buffer (${failureMargin}%)`}
                            value={costs.failureBufferCost}
                        />
                        <BreakdownRow
                            label="Subtotal (Cost Price)"
                            value={costs.adjustedBaseCost}
                            isTotal
                        />
                    </div>

                    <div className="mt-6 bg-gradient-to-br from-[#00A3A3]/20 to-[#00A3A3]/10 border border-[#00A3A3]/30 rounded-2xl p-6 mt-4">
                        <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">
                            Suggested Selling Price
                        </p>
                        <p className="text-4xl font-black text-secondary tracking-tight">
                            {CURRENCY}
                            {costs.finalPrice.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 font-medium mt-1.5">
                            {CURRENCY}
                            {costs.adjustedBaseCost.toFixed(2)} cost + {margin}%
                            margin = {CURRENCY}
                            {(
                                costs.finalPrice - costs.adjustedBaseCost
                            ).toFixed(2)}{" "}
                            profit
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            const text = [
                                `KenCreations Cost Breakdown`,
                                `---`,
                                `Material:    ${CURRENCY}${costs.material.toFixed(2)}`,
                                `Consumables: ${CURRENCY}${costs.consumable.toFixed(2)}`,
                                `Electricity: ${CURRENCY}${costs.electricity.toFixed(2)}`,
                                `Wear:        ${CURRENCY}${costs.wear.toFixed(2)}`,
                                `Labor:       ${CURRENCY}${costs.labor.toFixed(2)}`,
                                `Failure Buf: ${CURRENCY}${costs.failureBufferCost.toFixed(2)}`,
                                `Adj. Base:   ${CURRENCY}${costs.adjustedBaseCost.toFixed(2)}`,
                                `Margin:      ${margin}%`,
                                `Sell Price:  ${CURRENCY}${costs.finalPrice.toFixed(2)}`,
                            ].join("\n");
                            navigator.clipboard.writeText(text);
                        }}
                        className="w-full mt-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                        Copy Summary
                    </button>
                </div>
            </div>
        </div>
    );
}
