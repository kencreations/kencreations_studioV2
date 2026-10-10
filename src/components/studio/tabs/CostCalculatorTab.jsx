import React, { useState, useEffect, useMemo } from "react";
import {
    Plus,
    Trash2,
    Calculator,
    Save,
    Printer,
    FileText,
    Sliders,
    AlertCircle,
    Info,
    Check,
} from "lucide-react";
import { saveCostEstimate } from "../../../services/studioService";

const CURRENCY = "₱";

export default function CostCalculatorTab({
    filaments = [],
    consumables = [],
    printers = [],
    userId,
    onOpenPrinterProfiles,
    onSaveEstimateSuccess,
    onCreateJobFromEstimate,
    onCreateQuoteFromEstimate,
}) {
    // ── Printer Selection / Defaults ─────────────────────────────────────────
    const defaultPrinter = printers.find((p) => p.is_default) || printers[0] || null;
    const [selectedPrinterId, setSelectedPrinterId] = useState(defaultPrinter?.id || "");
    const [wattage, setWattage] = useState(defaultPrinter?.wattage || 350);
    const [elecRate, setElecRate] = useState(defaultPrinter?.electricity_rate || 11.5);
    const [wearRate, setWearRate] = useState(defaultPrinter?.wear_rate || 5.0);

    useEffect(() => {
        if (selectedPrinterId) {
            const match = printers.find((p) => p.id === selectedPrinterId);
            if (match) {
                setWattage(match.wattage || 350);
                setElecRate(match.electricity_rate || 11.5);
                setWearRate(match.wear_rate || 5.0);
            }
        }
    }, [selectedPrinterId, printers]);

    // ── Material Rows (Multi-color from saved inventory) ─────────────────────
    const [materialRows, setMaterialRows] = useState([
        { id: "mat_1", filamentId: filaments[0]?.id || "", modelWeight: 35, flushWaste: 0 },
    ]);

    // Keep filamentId synced if filaments array loads later
    useEffect(() => {
        if (filaments.length > 0 && materialRows.length === 1 && !materialRows[0].filamentId) {
            setMaterialRows([{ id: "mat_1", filamentId: filaments[0].id, modelWeight: 35, flushWaste: 0 }]);
        }
    }, [filaments]);

    // ── Consumables Rows (from saved inventory) ──────────────────────────────
    const [consumableRows, setConsumableRows] = useState([]);

    // ── Operational Inputs ───────────────────────────────────────────────────
    const [estimateTitle, setEstimateTitle] = useState("Custom 3D Print Estimate");
    const [printHours, setPrintHours] = useState(2);
    const [printMins, setPrintMins] = useState(30);
    const [laborHours, setLaborHours] = useState(0);
    const [laborMins, setLaborMins] = useState(15);
    const [laborRate, setLaborRate] = useState(50); // ₱50/hr
    const [overheadCost, setOverheadCost] = useState(10); // fixed overhead
    const [failureMargin, setFailureMargin] = useState(10); // 10% failure allowance

    // Pricing Model: "markup" | "margin"
    const [pricingMode, setPricingMode] = useState("margin");
    const [ratePercent, setRatePercent] = useState(35); // 35% margin or markup
    const [savingEstimate, setSavingEstimate] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // ── Dynamic Row Handlers ─────────────────────────────────────────────────
    const addMaterialRow = () => {
        setMaterialRows((prev) => [
            ...prev,
            { id: `mat_${Date.now()}`, filamentId: filaments[0]?.id || "", modelWeight: 10, flushWaste: 0 },
        ]);
    };

    const removeMaterialRow = (id) => {
        setMaterialRows((prev) => prev.filter((r) => r.id !== id));
    };

    const updateMaterialRow = (id, field, value) => {
        setMaterialRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const addConsumableRow = () => {
        if (consumables.length === 0) return;
        setConsumableRows((prev) => [
            ...prev,
            { id: `con_${Date.now()}`, consumableId: consumables[0].id, qty: 1 },
        ]);
    };

    const removeConsumableRow = (id) => {
        setConsumableRows((prev) => prev.filter((r) => r.id !== id));
    };

    const updateConsumableRow = (id, field, value) => {
        setConsumableRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    // ── Unified Cost Calculations ────────────────────────────────────────────
    const calculations = useMemo(() => {
        // 1. Material Cost (strictly from saved filament purchase prices and weights)
        let materialTotal = 0;
        const materialDetails = materialRows.map((row) => {
            const fil = filaments.find((f) => String(f.id) === String(row.filamentId));
            const totalGrams = Number(row.modelWeight || 0) + Number(row.flushWaste || 0);
            let unitCostPerGram = 0;
            let rowCost = 0;
            let availableStock = 0;

            if (fil && fil.spool_weight_g > 0) {
                unitCostPerGram = fil.purchase_price / fil.spool_weight_g;
                rowCost = totalGrams * unitCostPerGram;
                availableStock = fil.remaining_weight_g ?? fil.spool_weight_g;
            }

            materialTotal += rowCost;
            return {
                ...row,
                filamentName: fil?.name || "Unselected Filament",
                colorHex: fil?.color_hex || "#14b8a6",
                unitCostPerGram,
                totalGrams,
                rowCost,
                availableStock,
                isStockWarning: fil && totalGrams > availableStock,
            };
        });

        // 2. Consumable Cost (strictly from saved consumable pack prices and pack quantities)
        let consumableTotal = 0;
        const consumableDetails = consumableRows.map((row) => {
            const con = consumables.find((c) => String(c.id) === String(row.consumableId));
            let unitCost = 0;
            let rowCost = 0;
            let availableStock = 0;

            if (con && con.pack_quantity > 0) {
                unitCost = con.pack_price / con.pack_quantity;
                rowCost = Number(row.qty || 0) * unitCost;
                availableStock = con.quantity ?? 0;
            }

            consumableTotal += rowCost;
            return {
                ...row,
                consumableName: con?.name || "Unselected Item",
                unitOfMeasure: con?.unit_of_measure || "pcs",
                unitCost,
                rowCost,
                availableStock,
                isStockWarning: con && Number(row.qty || 0) > availableStock,
            };
        });

        // 3. Machine & Production Costs
        const printHoursTotal = Number(printHours || 0) + Number(printMins || 0) / 60;
        const laborHoursTotal = Number(laborHours || 0) + Number(laborMins || 0) / 60;

        const electricityCost = (Number(wattage || 0) / 1000) * printHoursTotal * Number(elecRate || 0);
        const machineWearCost = printHoursTotal * Number(wearRate || 0);
        const laborCost = laborHoursTotal * Number(laborRate || 0);
        const overhead = Number(overheadCost || 0);

        // Base Cost
        const baseCost = materialTotal + consumableTotal + electricityCost + machineWearCost + laborCost + overhead;

        // Buffered Cost (with failure margin)
        const failureBufferAmount = baseCost * (Number(failureMargin || 0) / 100);
        const bufferedCost = baseCost + failureBufferAmount;

        // 4. Selling Price & Margin calculation
        const rate = Number(ratePercent || 0);
        let sellingPrice = 0;
        let isMarginInvalid = false;

        if (pricingMode === "markup") {
            sellingPrice = bufferedCost * (1 + rate / 100);
        } else {
            // Target Gross Margin: Buffered Cost / (1 - Margin Rate)
            if (rate >= 100) {
                isMarginInvalid = true;
                sellingPrice = bufferedCost;
            } else {
                sellingPrice = bufferedCost / (1 - rate / 100);
            }
        }

        const grossProfit = Math.max(0, sellingPrice - bufferedCost);
        const realizedMargin = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100) : 0;

        return {
            materialDetails,
            materialTotal: Number(materialTotal.toFixed(2)),
            consumableDetails,
            consumableTotal: Number(consumableTotal.toFixed(2)),
            printHoursTotal: Number(printHoursTotal.toFixed(2)),
            laborHoursTotal: Number(laborHoursTotal.toFixed(2)),
            electricityCost: Number(electricityCost.toFixed(2)),
            machineWearCost: Number(machineWearCost.toFixed(2)),
            laborCost: Number(laborCost.toFixed(2)),
            overhead: Number(overhead.toFixed(2)),
            baseCost: Number(baseCost.toFixed(2)),
            failureBufferAmount: Number(failureBufferAmount.toFixed(2)),
            bufferedCost: Number(bufferedCost.toFixed(2)),
            sellingPrice: Number(sellingPrice.toFixed(2)),
            grossProfit: Number(grossProfit.toFixed(2)),
            realizedMargin: Number(realizedMargin.toFixed(1)),
            isMarginInvalid,
        };
    }, [
        materialRows,
        consumableRows,
        filaments,
        consumables,
        wattage,
        elecRate,
        wearRate,
        printHours,
        printMins,
        laborHours,
        laborMins,
        laborRate,
        overheadCost,
        failureMargin,
        pricingMode,
        ratePercent,
    ]);

    // ── Save Estimate Handler ────────────────────────────────────────────────
    const handleSaveEstimate = async () => {
        if (!userId) return;
        setSavingEstimate(true);
        setSaveSuccess(false);
        try {
            await saveCostEstimate(userId, {
                title: estimateTitle.trim() || "Cost Estimate",
                materials: calculations.materialDetails.map((m) => ({
                    filament_id: m.filamentId,
                    name: m.filamentName,
                    color_hex: m.colorHex,
                    grams: m.totalGrams,
                    cost: m.rowCost,
                })),
                consumables: calculations.consumableDetails.map((c) => ({
                    consumable_id: c.consumableId,
                    name: c.consumableName,
                    qty: Number(c.qty) || 0,
                    cost: c.rowCost,
                })),
                print_hours: calculations.printHoursTotal,
                labor_hours: calculations.laborHoursTotal,
                pricing_mode: pricingMode,
                margin_percent: ratePercent,
                failure_buffer_percent: failureMargin,
                overhead_cost: calculations.overhead,
                material_cost: calculations.materialTotal,
                consumable_cost: calculations.consumableTotal,
                electricity_cost: calculations.electricityCost,
                machine_wear_cost: calculations.machineWearCost,
                labor_cost: calculations.laborCost,
                base_cost: calculations.baseCost,
                buffered_cost: calculations.bufferedCost,
                selling_price: calculations.sellingPrice,
                gross_profit: calculations.grossProfit,
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            onSaveEstimateSuccess?.();
        } catch (err) {
            alert(err.message || "Failed to save estimate");
        } finally {
            setSavingEstimate(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Unified 3D Cost Calculator</h2>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Prices are pulled directly from your saved Filament and Consumables inventory
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenPrinterProfiles}
                        className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                        <Sliders size={14} /> Printer Profiles
                    </button>
                    <button
                        onClick={handleSaveEstimate}
                        disabled={savingEstimate}
                        className="px-4 py-2 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                        {saveSuccess ? <Check size={16} /> : <Save size={16} />}
                        {saveSuccess ? "Saved!" : savingEstimate ? "Saving..." : "Save Estimate"}
                    </button>
                </div>
            </div>

            {/* Title Bar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Estimate Title:</span>
                <input
                    type="text"
                    value={estimateTitle}
                    onChange={(e) => setEstimateTitle(e.target.value)}
                    placeholder="e.g. 50x Multi-color PopSockets Batch"
                    className="flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none border-b border-dashed border-gray-300 focus:border-teal-500 pb-0.5"
                />
            </div>

            {/* Calculator Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.9fr_1.1fr] gap-6 items-start">
                {/* LEFT COLUMN: Inputs & Material/Consumable Selectors */}
                <div className="space-y-6">
                    {/* 1. Material Selection (Filaments from Inventory) */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <span>🧵</span> Material Usage (Filaments)
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Select spools from your saved inventory. Unit prices are retrieved automatically.
                                </p>
                            </div>
                            <button
                                onClick={addMaterialRow}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100/70 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Color
                            </button>
                        </div>

                        {filaments.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-amber-50 text-amber-800 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={16} />
                                No filaments in your inventory yet. Add spools in the "Filaments" tab to calculate accurate material costs.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {materialRows.map((row, idx) => {
                                    const selectedFil = filaments.find((f) => f.id === row.filamentId);
                                    const costPerGram = selectedFil && selectedFil.spool_weight_g > 0
                                        ? selectedFil.purchase_price / selectedFil.spool_weight_g
                                        : 0;
                                    const totalGrams = Number(row.modelWeight || 0) + Number(row.flushWaste || 0);
                                    const extendedCost = totalGrams * costPerGram;
                                    const isLow = selectedFil && totalGrams > (selectedFil.remaining_weight_g ?? selectedFil.spool_weight_g);

                                    return (
                                        <div
                                            key={row.id}
                                            className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60 space-y-2 hover:border-teal-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold font-mono text-gray-400 w-5">
                                                    #{idx + 1}
                                                </span>

                                                {/* Filament Selector */}
                                                <select
                                                    value={row.filamentId}
                                                    onChange={(e) => updateMaterialRow(row.id, "filamentId", e.target.value)}
                                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-teal-500"
                                                >
                                                    {filaments.map((f) => (
                                                        <option key={f.id} value={f.id}>
                                                            {f.name} ({f.material} · {CURRENCY}{(f.purchase_price / (f.spool_weight_g || 1000)).toFixed(3)}/g · Stock: {f.remaining_weight_g ?? f.spool_weight_g}g)
                                                        </option>
                                                    ))}
                                                </select>

                                                {materialRows.length > 1 && (
                                                    <button
                                                        onClick={() => removeMaterialRow(row.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Gram inputs & derived row cost */}
                                            <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-gray-400 font-bold uppercase text-[10px]">Model:</span>
                                                        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                value={row.modelWeight}
                                                                onChange={(e) => updateMaterialRow(row.id, "modelWeight", parseFloat(e.target.value) || 0)}
                                                                className="w-16 font-mono font-bold text-right outline-none"
                                                            />
                                                            <span className="text-gray-400 font-bold text-[10px] ml-1">g</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-gray-400 font-bold uppercase text-[10px]">Purge:</span>
                                                        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-1">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                value={row.flushWaste}
                                                                onChange={(e) => updateMaterialRow(row.id, "flushWaste", parseFloat(e.target.value) || 0)}
                                                                className="w-14 font-mono font-bold text-right outline-none"
                                                            />
                                                            <span className="text-gray-400 font-bold text-[10px] ml-1">g</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="font-mono text-right">
                                                    <span className="text-gray-400 text-[10px] mr-1.5">
                                                        ({totalGrams}g @ {CURRENCY}{costPerGram.toFixed(3)}/g) =
                                                    </span>
                                                    <span className="font-bold text-gray-900 text-sm">
                                                        {CURRENCY}{extendedCost.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            {isLow && (
                                                <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 pt-1">
                                                    <AlertCircle size={13} />
                                                    Warning: Requested {totalGrams}g exceeds available spool stock ({selectedFil?.remaining_weight_g ?? selectedFil?.spool_weight_g}g).
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 2. Consumables Selection (Linked Supplies) */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <span>📦</span> Consumables & Supplies
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Keyrings, magnets, adhesive, and packaging from your inventory.
                                </p>
                            </div>
                            <button
                                onClick={addConsumableRow}
                                disabled={consumables.length === 0}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100/70 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 disabled:opacity-40"
                            >
                                <Plus size={14} /> Add Supply Item
                            </button>
                        </div>

                        {consumables.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-2">
                                No consumables saved yet. Add keyrings, packaging, or magnets in the "Consumables" tab.
                            </p>
                        ) : consumableRows.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-2">
                                Click "Add Supply Item" to include hardware or packaging in this calculation.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {consumableRows.map((row) => {
                                    const selectedCon = consumables.find((c) => c.id === row.consumableId);
                                    const unitCost = selectedCon && selectedCon.pack_quantity > 0
                                        ? selectedCon.pack_price / selectedCon.pack_quantity
                                        : 0;
                                    const extendedCost = Number(row.qty || 0) * unitCost;

                                    return (
                                        <div
                                            key={row.id}
                                            className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60 space-y-2 hover:border-teal-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={row.consumableId}
                                                    onChange={(e) => updateConsumableRow(row.id, "consumableId", e.target.value)}
                                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-teal-500"
                                                >
                                                    {consumables.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name} ({CURRENCY}{(c.pack_price / (c.pack_quantity || 1)).toFixed(2)}/{c.unit_of_measure} · Stock: {c.quantity})
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 w-28">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={row.qty}
                                                        onChange={(e) => updateConsumableRow(row.id, "qty", parseFloat(e.target.value) || 0)}
                                                        className="w-full text-right text-xs font-mono font-bold outline-none"
                                                    />
                                                    <span className="text-[11px] text-gray-400 font-bold ml-1">
                                                        {selectedCon?.unit_of_measure || "pcs"}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => removeConsumableRow(row.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>

                                            <div className="flex justify-end text-xs font-mono">
                                                <span className="text-gray-400 text-[10px] mr-1.5">
                                                    ({row.qty} × {CURRENCY}{unitCost.toFixed(2)}) =
                                                </span>
                                                <span className="font-bold text-gray-900 text-sm">
                                                    {CURRENCY}{extendedCost.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. Machine & Production Parameters */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <span>⚡</span> Production & Machine Parameters
                            </h3>
                            {printers.length > 0 && (
                                <select
                                    value={selectedPrinterId}
                                    onChange={(e) => setSelectedPrinterId(e.target.value)}
                                    className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1 outline-none"
                                >
                                    {printers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            Profile: {p.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Print Duration</label>
                                <div className="flex gap-1.5">
                                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 flex-1">
                                        <input
                                            type="number"
                                            min="0"
                                            value={printHours}
                                            onChange={(e) => setPrintHours(parseInt(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                        />
                                        <span className="text-[10px] text-gray-400 font-bold ml-1">h</span>
                                    </div>
                                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 flex-1">
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={printMins}
                                            onChange={(e) => setPrintMins(parseInt(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                        />
                                        <span className="text-[10px] text-gray-400 font-bold ml-1">m</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Machine Wattage</label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                                    <input
                                        type="number"
                                        min="10"
                                        step="10"
                                        value={wattage}
                                        onChange={(e) => setWattage(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold ml-1">W</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Electricity Rate</label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                                    <span className="text-[10px] text-gray-400 font-bold mr-1">₱</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={elecRate}
                                        onChange={(e) => setElecRate(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold ml-1">/kWh</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Machine Wear</label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                                    <span className="text-[10px] text-gray-400 font-bold mr-1">₱</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={wearRate}
                                        onChange={(e) => setWearRate(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold ml-1">/hr</span>
                                </div>
                            </div>
                        </div>

                        {/* Labor, Overhead, and Failure Margin */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Labor Time</label>
                                <div className="flex gap-1.5">
                                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 flex-1">
                                        <input
                                            type="number"
                                            min="0"
                                            value={laborHours}
                                            onChange={(e) => setLaborHours(parseInt(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                        />
                                        <span className="text-[10px] text-gray-400 font-bold ml-1">h</span>
                                    </div>
                                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 flex-1">
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={laborMins}
                                            onChange={(e) => setLaborMins(parseInt(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                        />
                                        <span className="text-[10px] text-gray-400 font-bold ml-1">m</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Labor Hourly Rate</label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                                    <span className="text-[10px] text-gray-400 font-bold mr-1">₱</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="5"
                                        value={laborRate}
                                        onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold ml-1">/hr</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Overhead (Fixed)</label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                                    <span className="text-[10px] text-gray-400 font-bold mr-1">₱</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={overheadCost}
                                        onChange={(e) => setOverheadCost(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Failure Buffer (%)</label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={failureMargin}
                                        onChange={(e) => setFailureMargin(parseFloat(e.target.value) || 0)}
                                        className="w-full text-right text-xs font-mono font-bold outline-none bg-transparent"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold ml-1">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Cost Breakdown & Pricing Strategy */}
                <div className="space-y-6">
                    {/* Pricing Strategy Selector */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                            Pricing Strategy
                        </h3>

                        {/* Markup vs Gross Margin Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => setPricingMode("margin")}
                                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                                    pricingMode === "margin"
                                        ? "bg-white text-gray-900 shadow-xs"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                Target Gross Margin
                            </button>
                            <button
                                type="button"
                                onClick={() => setPricingMode("markup")}
                                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                                    pricingMode === "markup"
                                        ? "bg-white text-gray-900 shadow-xs"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                Cost Markup
                            </button>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-gray-600">
                                    {pricingMode === "margin" ? "Target Margin (%)" : "Markup Rate (%)"}
                                </label>
                                <span className="font-mono text-sm font-black text-teal-700">
                                    {ratePercent}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max={pricingMode === "margin" ? "95" : "200"}
                                step="1"
                                value={ratePercent}
                                onChange={(e) => setRatePercent(parseFloat(e.target.value) || 0)}
                                className="w-full accent-[#14b8a6] cursor-pointer"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                                {pricingMode === "margin"
                                    ? "Selling Price = Cost / (1 - Margin). Gross margins 100%+ are disallowed."
                                    : "Selling Price = Cost × (1 + Markup Rate)."}
                            </p>
                        </div>
                    </div>

                    {/* Itemized Cost Breakdown Card */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                            Itemized Cost Breakdown
                        </h3>

                        <div className="divide-y divide-gray-100 text-xs font-mono space-y-2">
                            <div className="flex justify-between py-1 text-gray-600">
                                <span>Filament Materials:</span>
                                <span className="font-bold text-gray-800">{CURRENCY}{calculations.materialTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-1 text-gray-600">
                                <span>Consumables & Hardware:</span>
                                <span className="font-bold text-gray-800">{CURRENCY}{calculations.consumableTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-1 text-gray-600">
                                <span>Electricity ({calculations.printHoursTotal}h):</span>
                                <span className="font-bold text-gray-800">{CURRENCY}{calculations.electricityCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-1 text-gray-600">
                                <span>Machine Wear ({calculations.printHoursTotal}h):</span>
                                <span className="font-bold text-gray-800">{CURRENCY}{calculations.machineWearCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-1 text-gray-600">
                                <span>Labor ({calculations.laborHoursTotal}h):</span>
                                <span className="font-bold text-gray-800">{CURRENCY}{calculations.laborCost.toFixed(2)}</span>
                            </div>
                            {calculations.overhead > 0 && (
                                <div className="flex justify-between py-1 text-gray-600">
                                    <span>Fixed Overhead:</span>
                                    <span className="font-bold text-gray-800">{CURRENCY}{calculations.overhead.toFixed(2)}</span>
                                </div>
                            )}

                            {/* Base Subtotal */}
                            <div className="flex justify-between py-1.5 font-bold text-gray-700 bg-gray-50/70 px-2 rounded-lg">
                                <span>Base Manufacturing Cost:</span>
                                <span>{CURRENCY}{calculations.baseCost.toFixed(2)}</span>
                            </div>

                            {/* Failure Allowance */}
                            <div className="flex justify-between py-1 text-amber-700">
                                <span>Failure Allowance ({failureMargin}%):</span>
                                <span>+{CURRENCY}{calculations.failureBufferAmount.toFixed(2)}</span>
                            </div>

                            {/* Total Production Cost */}
                            <div className="flex justify-between py-2 text-sm font-black text-gray-900 border-t border-gray-200">
                                <span>Total Production Cost:</span>
                                <span>{CURRENCY}{calculations.bufferedCost.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Grand Price Highlight Box */}
                        <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200/80 space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-teal-800 block">
                                Recommended Selling Price
                            </span>
                            <div className="text-3xl font-black font-mono text-teal-900">
                                {CURRENCY}{calculations.sellingPrice.toFixed(2)}
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-teal-800 pt-1 border-t border-teal-200/50">
                                <span>Estimated Gross Profit:</span>
                                <span className="font-mono font-bold">+{CURRENCY}{calculations.grossProfit.toFixed(2)} ({calculations.realizedMargin}%)</span>
                            </div>
                        </div>

                        {/* Action Buttons: Convert to Print Job or Quote */}
                        <div className="space-y-2 pt-2">
                            <button
                                type="button"
                                onClick={() => onCreateJobFromEstimate?.(calculations, estimateTitle)}
                                className="w-full py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                            >
                                <Printer size={15} /> Create Print Job from this Estimate
                            </button>
                            <button
                                type="button"
                                onClick={() => onCreateQuoteFromEstimate?.(calculations, estimateTitle)}
                                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                            >
                                <FileText size={15} /> Generate Customer Quotation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
