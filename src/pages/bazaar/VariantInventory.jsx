import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getShopInventory,
    adjustInventoryStock,
    getShopInventoryMovements,
    updateShopCustomColors,
} from "../../services/bazaarService";
import { getFilaments, getConsumables, addConsumable, updateConsumable } from "../../services/studioService";
import { buildLetterColorMatrix } from "../../engine/bazaar/inventoryMath";
import {
    CANONICAL_COLORS,
    canonicalColorId,
    buildLetterCapSku,
    buildCasingBaseSku,
} from "../../engine/bazaar/configuration";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import {
    Layers,
    Plus,
    Minus,
    Search,
    AlertTriangle,
    History,
    CheckCircle2,
    AlertCircle,
    X,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Sliders,
    Tag,
    Palette,
    Sparkles,
    Box,
    ExternalLink,
    Grid,
    Smile,
    Archive,
    Trash2,
    Edit2,
    RotateCcw,
    Check,
    Eye,
    EyeOff,
} from "lucide-react";

// Standard English alphabet letters
const MATRIX_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// 12 Popular Icon Keycaps
const ICON_KEYCAPS = [
    { id: "heart", label: "Heart", emoji: "❤️" },
    { id: "star", label: "Star", emoji: "⭐" },
    { id: "crown", label: "Crown", emoji: "👑" },
    { id: "gamepad", label: "Gamepad", emoji: "🎮" },
    { id: "paw", label: "Paw Print", emoji: "🐾" },
    { id: "zap", label: "Lightning", emoji: "⚡" },
    { id: "flower", label: "Blossom", emoji: "🌸" },
    { id: "rocket", label: "Rocket", emoji: "🚀" },
    { id: "clover", label: "Clover", emoji: "🍀" },
    { id: "fire", label: "Flame", emoji: "🔥" },
    { id: "gem", label: "Diamond", emoji: "💎" },
    { id: "moon", label: "Crescent", emoji: "🌙" },
];

// Base casing slots 1 through 8
const CASING_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

// Initial default color palette (derived canonically)
const DEFAULT_COLORS = CANONICAL_COLORS.map((c) => ({
    id: c.id,
    name: c.name,
    hex: c.hex,
    active: c.active !== false,
    archived: false,
    isDefault: true,
}));

const ADJUSTMENT_REASONS = [
    "Batch 3D Print Restock",
    "Supplier Purchase",
    "Scrap / Defective Print",
    "Manual Inventory Audit",
    "Event Booth Restock",
    "Customer Replacement",
];

export default function VariantInventory() {
    const { currentUser } = useAuth();
    const [shop, setShop] = useState(null);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [movements, setMovements] = useState([]);
    const [filaments, setFilaments] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [customColors, setCustomColors] = useState([]);
    const [loading, setLoading] = useState(true);

    // Active Main Tab: 'matrix' | 'casings' | 'consumables' | 'history'
    const [activeTab, setActiveTab] = useState("matrix");

    // Matrix Sub-mode: 'letters' | 'icons'
    const [matrixMode, setMatrixMode] = useState("letters");

    // Notifications
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Matrix search / filter
    const [matrixSearch, setMatrixSearch] = useState("");

    // Color management modal / popover
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [newColorName, setNewColorName] = useState("");
    const [newColorHex, setNewColorHex] = useState("#3b82f6");

    // Comprehensive Color Management State
    const [isManageColorsOpen, setIsManageColorsOpen] = useState(false);
    const [showArchivedColors, setShowArchivedColors] = useState(false);
    const [editingColorId, setEditingColorId] = useState(null);
    const [editColorForm, setEditColorForm] = useState({ name: "", hex: "#14b8a6" });
    const [deleteConfirmColor, setDeleteConfirmColor] = useState(null);
    const [deleteBlockedReason, setDeleteBlockedReason] = useState(null);

    // Adjustment Modal State
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [adjustmentDelta, setAdjustmentDelta] = useState(10);
    const [adjustmentReason, setAdjustmentReason] = useState("Batch 3D Print Restock");
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Initial data loader
    const loadData = useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [shopData, invData, movData, filsData, consData] = await Promise.all([
                getSellerShop(currentUser.uid).catch(() => null),
                getShopInventory(currentUser.uid).catch(() => []),
                getShopInventoryMovements(currentUser.uid, 50).catch(() => []),
                getFilaments(currentUser.uid).catch(() => []),
                getConsumables(currentUser.uid).catch(() => []),
            ]);
            setShop(shopData);
            setInventoryItems(invData || []);
            setMovements(movData || []);
            setFilaments(filsData || []);
            setConsumables(consData || []);

            // Load seller's custom/managed colors if stored in shop or localStorage
            let savedColors = null;
            if (shopData?.customColors && Array.isArray(shopData.customColors)) {
                savedColors = shopData.customColors;
            } else {
                const saved = localStorage.getItem(`bazaar_custom_colors_${currentUser.uid}`);
                if (saved) {
                    try {
                        savedColors = JSON.parse(saved);
                    } catch (_) {}
                }
            }
            if (savedColors) {
                setCustomColors(savedColors);
            }
        } catch (err) {
            console.error("[VariantInventory] Failed to load data:", err);
            setErrorMessage("Failed to load inventory records.");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Combined active colors list (Canonical Defaults + Studio Filaments + User Custom Colors)
    const allAvailableColors = useMemo(() => {
        const colorMap = new Map();

        // 1. Initialize base canonical colors
        for (const c of DEFAULT_COLORS) {
            colorMap.set(c.id, { ...c });
        }

        // 2. Add or overlay custom / saved colors (seller modifications)
        for (const c of customColors) {
            if (!c) continue;
            const cid = canonicalColorId(c.id || c.name);
            const existing = colorMap.get(cid);
            if (existing) {
                colorMap.set(cid, {
                    ...existing,
                    ...c,
                    id: cid, // preserve stable canonical ID
                });
            } else {
                colorMap.set(cid, {
                    id: cid,
                    name: c.name || cid,
                    hex: c.hex || "#6366f1",
                    active: c.active !== false && !c.disabled,
                    archived: !!c.archived,
                    isCustom: true,
                });
            }
        }

        // 3. Add Studio Hub Filaments if not already present
        for (const f of filaments) {
            const name = f.color_name || f.color || f.name;
            if (name) {
                const fid = canonicalColorId(f.id || name);
                if (!colorMap.has(fid)) {
                    colorMap.set(fid, {
                        id: fid,
                        name: name,
                        hex: f.color_hex || "#6366f1",
                        active: true,
                        archived: false,
                        isFilament: true,
                        filamentId: f.id,
                    });
                }
            }
        }

        return Array.from(colorMap.values());
    }, [customColors, filaments]);

    // Visible colors filtered by archived status
    const visibleColors = useMemo(() => {
        return allAvailableColors.filter((c) => showArchivedColors || !c.archived);
    }, [allAvailableColors, showArchivedColors]);

    const archivedCount = useMemo(() => {
        return allAvailableColors.filter((c) => c.archived).length;
    }, [allAvailableColors]);

    // Persist colors to state, localStorage, and shop document
    const saveColors = async (newColorsList) => {
        setCustomColors(newColorsList);
        if (currentUser?.uid) {
            localStorage.setItem(`bazaar_custom_colors_${currentUser.uid}`, JSON.stringify(newColorsList));
            try {
                await updateShopCustomColors(currentUser.uid, newColorsList);
            } catch (err) {
                console.warn("[VariantInventory] Could not save custom colors remotely, preserved locally:", err);
            }
        }
    };

    // Safety check: is a color safe to permanently delete (zero stock, zero reservations, zero ledger history)?
    const isColorSafeToDelete = useCallback((color) => {
        if (!color) return { safe: false, reason: "Invalid color." };

        const cId = canonicalColorId(color.id || color.name);
        const cName = String(color.name || "").toLowerCase().trim();

        // 1. Check inventory balances (on_hand, reserved, allocated)
        for (const item of inventoryItems) {
            const itemKey = String(item.item_key || "").toLowerCase();
            const itemColor = String(item.color || "").toLowerCase();
            const matchesColor =
                itemColor === cName ||
                itemColor === cId ||
                itemKey.endsWith(`_${cId}`) ||
                itemKey.includes(`_${cId}_`) ||
                itemKey.endsWith(`_${cName.replace(/\s+/g, "_")}`) ||
                itemKey.includes(`_${cName.replace(/\s+/g, "_")}_`);

            if (matchesColor) {
                const onHand = Number(item.on_hand ?? 0);
                const reserved = Number(item.reserved ?? 0);
                const allocated = Number(item.allocated ?? 0);
                if (onHand > 0 || reserved > 0 || allocated > 0) {
                    return {
                        safe: false,
                        reason: `Color "${color.name}" has active stock records (On-hand: ${onHand}, Reserved: ${reserved}, Allocated: ${allocated}) in inventory (${item.name || item.item_key}).`,
                    };
                }
            }
        }

        // 2. Check historical movements audit trail
        for (const m of movements) {
            const mKey = String(m.itemKey || m.item_key || "").toLowerCase();
            const mName = String(m.name || "").toLowerCase();
            if (
                mKey.endsWith(`_${cId}`) ||
                mKey.includes(`_${cId}_`) ||
                mKey.endsWith(`_${cName.replace(/\s+/g, "_")}`) ||
                mKey.includes(`_${cName.replace(/\s+/g, "_")}_`) ||
                mName.includes(cName)
            ) {
                return {
                    safe: false,
                    reason: `Color "${color.name}" has recorded inventory movements in the audit ledger and cannot be erased to preserve accounting history.`,
                };
            }
        }

        return { safe: true };
    }, [inventoryItems, movements]);

    // Handle adding a new color
    const handleAddCustomColor = async (e) => {
        e.preventDefault();
        const trimmed = newColorName.trim();
        if (!trimmed) {
            setErrorMessage("Please enter a color name.");
            return;
        }

        const cid = canonicalColorId(trimmed);
        if (allAvailableColors.some((c) => c.id === cid)) {
            setErrorMessage(`A color with identifier "${cid}" or name "${trimmed}" already exists.`);
            return;
        }

        const newCol = {
            id: cid,
            name: trimmed,
            hex: newColorHex,
            active: true,
            archived: false,
            isCustom: true,
        };

        const updated = [...allAvailableColors.filter((c) => c.id !== cid), newCol];
        await saveColors(updated);

        setNewColorName("");
        setIsColorModalOpen(false);
        setSuccessMessage(`Color "${trimmed}" (ID: ${cid}) added to inventory.`);
    };

    // Inline Color Editing
    const handleStartEditColor = (col) => {
        setEditingColorId(col.id);
        setEditColorForm({ name: col.name, hex: col.hex });
    };

    const handleSaveEditColor = async (colId) => {
        const trimmed = editColorForm.name.trim();
        if (!trimmed) {
            setErrorMessage("Color name cannot be empty.");
            return;
        }
        const updated = allAvailableColors.map((c) => {
            if (c.id === colId) {
                return { ...c, name: trimmed, hex: editColorForm.hex };
            }
            return c;
        });
        await saveColors(updated);
        setEditingColorId(null);
        setSuccessMessage(`Color "${trimmed}" updated successfully.`);
    };

    // Toggle color enabled/disabled
    const handleToggleColorActive = async (col) => {
        const nextActive = !col.active;
        const updated = allAvailableColors.map((c) => {
            if (c.id === col.id) {
                return { ...c, active: nextActive, disabled: !nextActive };
            }
            return c;
        });
        await saveColors(updated);
        setSuccessMessage(`Color "${col.name}" is now ${nextActive ? "enabled" : "disabled"}.`);
    };

    // Toggle color archived status
    const handleToggleColorArchive = async (col) => {
        const nextArchived = !col.archived;
        const updated = allAvailableColors.map((c) => {
            if (c.id === col.id) {
                return { ...c, archived: nextArchived };
            }
            return c;
        });
        await saveColors(updated);
        setSuccessMessage(
            nextArchived
                ? `Color "${col.name}" archived. It is hidden from customer customizers while preserving inventory history.`
                : `Color "${col.name}" restored from archive.`
        );
    };

    // Request delete with safety check
    const handleRequestDeleteColor = (col) => {
        const check = isColorSafeToDelete(col);
        if (!check.safe) {
            setDeleteBlockedReason(check.reason);
            setDeleteConfirmColor(col);
            return;
        }
        setDeleteBlockedReason(null);
        setDeleteConfirmColor(col);
    };

    const handleConfirmDeleteColor = async () => {
        if (!deleteConfirmColor) return;
        const colId = deleteConfirmColor.id;
        const updated = allAvailableColors.filter((c) => c.id !== colId);
        await saveColors(updated);
        setSuccessMessage(`Color "${deleteConfirmColor.name}" removed permanently.`);
        setDeleteConfirmColor(null);
        setDeleteBlockedReason(null);
    };

    // 2D Matrix for Letter Caps
    const letterMatrix = useMemo(() => {
        return buildLetterColorMatrix({
            inventoryItems,
            letters: MATRIX_LETTERS,
            colors: visibleColors,
            itemType: "letter_cap",
        });
    }, [inventoryItems, visibleColors]);

    // 2D Matrix for Icon Keycaps
    const iconMatrix = useMemo(() => {
        return buildLetterColorMatrix({
            inventoryItems,
            letters: ICON_KEYCAPS.map((i) => i.id),
            colors: visibleColors,
            itemType: "icon_cap",
        });
    }, [inventoryItems, visibleColors]);

    // Active matrix based on sub-mode
    const activeMatrix = matrixMode === "letters" ? letterMatrix : iconMatrix;

    // Filtered Matrix rows
    const filteredRows = useMemo(() => {
        if (!matrixSearch.trim()) return activeMatrix.rows;
        const q = matrixSearch.trim().toLowerCase();
        if (matrixMode === "letters") {
            return activeMatrix.rows.filter((r) => r.char.toLowerCase().includes(q));
        } else {
            return activeMatrix.rows.filter((r) => {
                const iconObj = ICON_KEYCAPS.find((i) => i.id === r.char);
                return (
                    r.char.toLowerCase().includes(q) ||
                    (iconObj && iconObj.label.toLowerCase().includes(q))
                );
            });
        }
    }, [activeMatrix, matrixSearch, matrixMode]);

    // Filter consumables by categories
    const switchConsumables = useMemo(() => {
        return consumables.filter((c) => {
            const cat = String(c.category || "").toLowerCase();
            const name = String(c.name || "").toLowerCase();
            return (
                cat.includes("switch") ||
                name.includes("switch") ||
                name.includes("outemu") ||
                name.includes("cherry") ||
                name.includes("gateron")
            );
        });
    }, [consumables]);

    const hardwareAddonConsumables = useMemo(() => {
        return consumables.filter((c) => {
            const cat = String(c.category || "").toLowerCase();
            const name = String(c.name || "").toLowerCase();
            return (
                cat.includes("addon") ||
                cat.includes("attachment") ||
                cat.includes("hardware") ||
                cat.includes("packaging") ||
                name.includes("keyring") ||
                name.includes("clasp") ||
                name.includes("chain") ||
                name.includes("box") ||
                name.includes("magnet")
            );
        });
    }, [consumables]);

    // Casing stock lookup map
    const inventoryMap = useMemo(() => {
        const map = new Map();
        for (const item of inventoryItems) {
            if (item.item_key) map.set(item.item_key.toLowerCase(), item);
        }
        return map;
    }, [inventoryItems]);

    // Stats
    const stats = useMemo(() => {
        let totalCaps = 0;
        let lowCaps = 0;

        for (const r of letterMatrix.rows) {
            for (const cell of Object.values(r.cells)) {
                totalCaps += cell.onHand;
                if (cell.isLow) lowCaps++;
            }
        }
        for (const r of iconMatrix.rows) {
            for (const cell of Object.values(r.cells)) {
                totalCaps += cell.onHand;
                if (cell.isLow) lowCaps++;
            }
        }

        return {
            totalCaps,
            lowCaps,
            switchCount: switchConsumables.length,
            hardwareCount: hardwareAddonConsumables.length,
            colorCount: allAvailableColors.length,
        };
    }, [letterMatrix, iconMatrix, switchConsumables, hardwareAddonConsumables, allAvailableColors]);

    // Quick Matrix Cell Click
    const handleOpenMatrixAdjustment = (charOrIcon, color, cell) => {
        const isIcon = matrixMode === "icons";
        const iconObj = isIcon ? ICON_KEYCAPS.find((i) => i.id === charOrIcon) : null;
        const displayName = isIcon
            ? `Icon Cap [${iconObj?.emoji || "✨"} ${iconObj?.label || charOrIcon}] (${color})`
            : `Letter Cap [${charOrIcon}] (${color})`;

        setSelectedItem({
            itemKey: cell.itemKey || cell.key,
            itemType: isIcon ? "icon_cap" : "letter_cap",
            name: displayName,
            char: charOrIcon,
            color,
            onHand: cell.onHand,
            reserved: cell.reserved,
            available: cell.available,
            lowThreshold: cell.lowThreshold,
        });
        setAdjustmentDelta(10);
        setAdjustmentReason("Batch 3D Print Restock");
        setErrorMessage("");
        setSuccessMessage("");
        setIsAdjustmentModalOpen(true);
    };

    // Quick Casing Adjustment
    const handleOpenCasingAdjustment = (colorOrName, slots) => {
        const colId = canonicalColorId(colorOrName);
        const itemKey = buildCasingBaseSku(colId, slots);
        const legacyKey = `base_casing_${String(colorOrName).toLowerCase().replace(/\s+/g, "_")}_${slots}key`;
        const existing = inventoryMap.get(itemKey) || inventoryMap.get(legacyKey) || {};
        const onHand = Number(existing.on_hand ?? 0);
        const reserved = Number(existing.reserved ?? 0);

        setSelectedItem({
            itemKey,
            itemType: "casing_base",
            name: `Base Casing [${colorOrName}] (${slots}-Slot Key)`,
            color: colorOrName,
            colorId: colId,
            slots,
            onHand,
            reserved,
            available: Math.max(0, onHand - reserved),
            lowThreshold: Number(existing.low_threshold ?? 5),
            unitCost: Number(existing.unit_cost ?? 0),
        });
        setAdjustmentDelta(5);
        setAdjustmentReason("Batch 3D Print Restock");
        setErrorMessage("");
        setSuccessMessage("");
        setIsAdjustmentModalOpen(true);
    };

    // Quick Consumable Adjustment
    const handleOpenConsumableAdjustment = (con) => {
        const itemKey = `consumable_${con.id || con.name.toLowerCase().replace(/\s+/g, "_")}`;
        const existing = inventoryMap.get(itemKey) || {};
        const onHand = Number(con.quantity ?? con.stock ?? con.on_hand ?? existing.on_hand ?? 0);
        const reserved = Number(existing.reserved ?? 0);
        const lowThreshold = Number(con.reorder_threshold ?? con.low_stock_threshold ?? 10);

        setSelectedItem({
            itemKey,
            itemType: "consumable",
            consumableId: con.id,
            name: con.name,
            unitOfMeasure: con.unit_of_measure || "pcs",
            onHand,
            reserved,
            available: Math.max(0, onHand - reserved),
            lowThreshold,
            unitCost: Number(con.unit_cost ?? 0),
        });
        setAdjustmentDelta(20);
        setAdjustmentReason("Supplier Purchase");
        setErrorMessage("");
        setSuccessMessage("");
        setIsAdjustmentModalOpen(true);
    };

    // Execute Transactional Adjustment
    const handleExecuteAdjustment = async (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        const delta = Number(adjustmentDelta);
        if (!Number.isFinite(delta) || delta === 0) {
            setErrorMessage("Please enter a valid non-zero adjustment quantity.");
            return;
        }

        if (selectedItem.onHand + delta < 0) {
            setErrorMessage(
                `Adjustment of ${delta} would result in negative balance (${selectedItem.onHand + delta}). Action aborted.`
            );
            return;
        }

        if (selectedItem.onHand + delta < selectedItem.reserved) {
            setErrorMessage(
                `Cannot reduce balance below reserved quantity (${selectedItem.reserved}) allocated to active orders.`
            );
            return;
        }

        setIsAdjusting(true);
        setErrorMessage("");

        try {
            await adjustInventoryStock(currentUser.uid, {
                itemKey: selectedItem.itemKey,
                itemType: selectedItem.itemType,
                name: selectedItem.name,
                char: selectedItem.char || "",
                color: selectedItem.color || "",
                delta,
                reason: adjustmentReason,
                unitCost: selectedItem.unitCost || 0,
                lowThreshold: selectedItem.lowThreshold || 5,
            });

            // If linked to Studio Hub consumable, also sync quantity in Studio Hub
            if (selectedItem.consumableId) {
                const newQty = Math.max(0, selectedItem.onHand + delta);
                await updateConsumable(currentUser.uid, selectedItem.consumableId, {
                    quantity: newQty,
                    status: newQty <= 0 ? "Out of Stock" : newQty <= (selectedItem.lowThreshold || 10) ? "Low" : "In Stock",
                }).catch(console.error);
            }

            setSuccessMessage(
                `Stock updated for "${selectedItem.name}": ${delta > 0 ? `+${delta}` : delta} units.`
            );
            setIsAdjustmentModalOpen(false);
            await loadData();
        } catch (err) {
            console.error("[VariantInventory] Adjustment error:", err);
            setErrorMessage(err.message || "Failed to adjust inventory balance.");
        } finally {
            setIsAdjusting(false);
        }
    };

    // Helper: Seed starter switches into Studio Hub consumables
    const handleSeedStarterConsumables = async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const starterItems = [
                { name: "Outemu Blue Clicky Switch", category: "Switch", stock: 50, unit_cost: 6.5, low_stock_threshold: 20 },
                { name: "Outemu Red Linear Switch", category: "Switch", stock: 50, unit_cost: 6.5, low_stock_threshold: 20 },
                { name: "Outemu Brown Tactile Switch", category: "Switch", stock: 50, unit_cost: 6.5, low_stock_threshold: 15 },
                { name: "Standard Metal Keyring Loop", category: "Hardware", stock: 100, unit_cost: 2.0, low_stock_threshold: 30 },
                { name: "Swivel Lobster Clasp", category: "Hardware", stock: 100, unit_cost: 3.5, low_stock_threshold: 20 },
                { name: "Beaded Ball Chain", category: "Hardware", stock: 100, unit_cost: 2.5, low_stock_threshold: 25 },
            ];

            for (const item of starterItems) {
                await addConsumable(currentUser.uid, item);
            }

            setSuccessMessage("Starter switches and hardware consumables imported into Studio Hub!");
            await loadData();
        } catch (err) {
            console.error("[VariantInventory] Failed to seed consumables:", err);
            setErrorMessage("Failed to add starter consumables to Studio Hub.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <BazaarLayout activeTab="inventory">
            <div className="space-y-6">
                {/* Header Title & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
                                Milestone 3
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                Multi-Variant Stock Ledger
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-1 flex items-center gap-2">
                            Variant & Component Inventory
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Manage letter & icon keycaps across custom colors, casing slots, and consumables directly from your Studio Hub inventory.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setIsColorModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 transition-all cursor-pointer shadow-2xs"
                        >
                            <Palette size={14} /> + Add Color
                        </button>

                        <button
                            onClick={() => setIsManageColorsOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-bold text-teal-800 transition-all cursor-pointer shadow-2xs"
                        >
                            <Sliders size={14} /> Manage Colors
                        </button>

                        <button
                            onClick={loadData}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 transition-all cursor-pointer shadow-2xs"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
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

                {/* Quick Stats Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Keycap Stock</span>
                            <Layers size={18} className="text-teal-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">
                            {stats.totalCaps}
                        </div>
                        <span className="text-[11px] text-gray-400">Letters + Icon Caps</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Active Colors</span>
                            <Palette size={18} className="text-indigo-600" />
                        </div>
                        <div className="text-2xl font-black text-indigo-700 font-mono">
                            {stats.colorCount}
                        </div>
                        <span className="text-[11px] text-gray-400">Filaments & custom</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Switches & Add-ons</span>
                            <Tag size={18} className="text-purple-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">
                            {stats.switchCount + stats.hardwareCount}
                        </div>
                        <span className="text-[11px] text-gray-400">Studio Hub inventory</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Movement Audit</span>
                            <History size={18} className="text-teal-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">
                            {movements.length}
                        </div>
                        <span className="text-[11px] text-gray-400">Ledger transactions</span>
                    </div>
                </div>

                {/* Main View Tabs */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3 bg-gray-50/50">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setActiveTab("matrix")}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === "matrix"
                                        ? "bg-teal-600 text-white shadow-xs"
                                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80"
                                }`}
                            >
                                <Grid size={14} /> Keycaps Matrix (Letters & Icons)
                            </button>

                            <button
                                onClick={() => setActiveTab("casings")}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === "casings"
                                        ? "bg-teal-600 text-white shadow-xs"
                                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80"
                                }`}
                            >
                                <Box size={14} /> Base Casings & Slots
                            </button>

                            <button
                                onClick={() => setActiveTab("consumables")}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === "consumables"
                                        ? "bg-teal-600 text-white shadow-xs"
                                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80"
                                }`}
                            >
                                <Sliders size={14} /> Switches & Add-ons (Consumables)
                            </button>

                            <button
                                onClick={() => setActiveTab("history")}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === "history"
                                        ? "bg-teal-600 text-white shadow-xs"
                                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80"
                                }`}
                            >
                                <History size={14} /> Audit Log
                            </button>
                        </div>

                        {activeTab === "matrix" && (
                            <div className="relative w-full sm:w-56">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={matrixSearch}
                                    onChange={(e) => setMatrixSearch(e.target.value)}
                                    placeholder={matrixMode === "letters" ? "Filter letter (e.g. A, K)..." : "Filter icon (e.g. Heart)..."}
                                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder:text-gray-400 outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* TAB 1: 2D KEYCAP MATRIX (Letters vs. Icons) */}
                    {activeTab === "matrix" && (
                        <div className="p-6 space-y-4">
                            {/* Mode Toggle: Letters vs. Icons */}
                            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-100">
                                <div className="inline-flex p-1 rounded-2xl bg-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMatrixMode("letters");
                                            setMatrixSearch("");
                                        }}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            matrixMode === "letters"
                                                ? "bg-white text-teal-800 shadow-xs"
                                                : "text-gray-600 hover:text-gray-900"
                                        }`}
                                    >
                                        <Layers size={13} /> Letter Caps (A–Z)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMatrixMode("icons");
                                            setMatrixSearch("");
                                        }}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            matrixMode === "icons"
                                                ? "bg-white text-purple-800 shadow-xs"
                                                : "text-gray-600 hover:text-gray-900"
                                        }`}
                                    >
                                        <Smile size={13} /> Icon Keycaps (❤️, ⭐, 👑, etc.)
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                                        <span>Low Stock (≤5)</span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-teal-50 border border-teal-200" />
                                        <span>In Stock</span>
                                    </span>
                                </div>
                            </div>

                            {/* Color Legend Bar */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-gray-500">
                                <span className="font-bold text-gray-400 shrink-0">Colors ({visibleColors.length}):</span>
                                {visibleColors.map((col) => (
                                    <span
                                        key={col.id || col.name}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border shrink-0 font-medium ${
                                            col.archived
                                                ? "bg-gray-100/90 border-gray-300 text-gray-400"
                                                : "bg-gray-50 border-gray-200 text-gray-700"
                                        }`}
                                    >
                                        <div
                                            className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0"
                                            style={{ backgroundColor: col.hex }}
                                        />
                                        <span>{col.name}</span>
                                        {col.archived && (
                                            <span className="text-[9px] px-1 rounded bg-gray-200 text-gray-600 font-bold">Archived</span>
                                        )}
                                        {col.isFilament && (
                                            <span className="text-[9px] px-1 rounded bg-teal-100 text-teal-700 font-bold">Filament</span>
                                        )}
                                        {col.isCustom && (
                                            <span className="text-[9px] px-1 rounded bg-indigo-100 text-indigo-700 font-bold">Custom</span>
                                        )}
                                    </span>
                                ))}
                                <button
                                    onClick={() => setIsColorModalOpen(true)}
                                    className="text-xs text-teal-600 hover:text-teal-800 font-bold shrink-0 cursor-pointer ml-1"
                                >
                                    + Add More
                                </button>
                                <button
                                    onClick={() => setIsManageColorsOpen(true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-all cursor-pointer shrink-0 ml-1"
                                >
                                    <Sliders size={12} /> Manage Colors
                                </button>
                                <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer shrink-0 ml-2">
                                    <input
                                        type="checkbox"
                                        checked={showArchivedColors}
                                        onChange={(e) => setShowArchivedColors(e.target.checked)}
                                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                    />
                                    <span>Show Archived ({archivedCount})</span>
                                </label>
                            </div>

                            {/* Matrix Grid Table */}
                            <div className="overflow-x-auto border border-gray-100 rounded-2xl max-h-[560px]">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 bg-gray-50 z-20 shadow-2xs">
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 font-black text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-30 w-24">
                                                {matrixMode === "letters" ? "Letter" : "Icon Cap"}
                                            </th>
                                            {visibleColors.map((col) => (
                                                <th key={col.id || col.name} className="py-3 px-4 font-bold text-gray-700 text-center min-w-[100px]">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <div
                                                            className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                                            style={{ backgroundColor: col.hex }}
                                                        />
                                                        <span className="truncate max-w-[90px]">{col.name}</span>
                                                        {col.archived && (
                                                            <span className="text-[9px] px-1 rounded bg-gray-200 text-gray-500 font-extrabold uppercase">
                                                                Archived
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredRows.map((row) => {
                                            const iconObj = matrixMode === "icons" ? ICON_KEYCAPS.find((i) => i.id === row.char) : null;
                                            return (
                                                <tr key={row.char} className="hover:bg-gray-50/60 transition-colors">
                                                    <td className="py-2.5 px-4 font-black text-sm text-gray-900 sticky left-0 bg-white z-10 font-mono">
                                                        {matrixMode === "letters" ? (
                                                            row.char
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 font-sans font-bold text-xs text-gray-800">
                                                                <span className="text-base">{iconObj?.emoji || "✨"}</span>
                                                                <span>{iconObj?.label || row.char}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {visibleColors.map((col) => {
                                                        const cell = row.cells[col.name] || row.cells[col.id] || { onHand: 0, available: 0, isLow: true };
                                                        return (
                                                            <td key={col.id || col.name} className="py-2 px-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenMatrixAdjustment(row.char, col.name, cell)}
                                                                    className={`w-full py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                                                                        cell.onHand === 0
                                                                            ? "bg-gray-50 text-gray-400 border-dashed border-gray-200 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700"
                                                                            : cell.isLow
                                                                            ? "bg-amber-50/80 text-amber-800 border-amber-300 hover:bg-amber-100"
                                                                            : "bg-teal-50/60 text-teal-800 border-teal-200 hover:bg-teal-100"
                                                                    }`}
                                                                    title={`Cap [${row.char}] (${col.name}) - Click to adjust stock`}
                                                                >
                                                                    {cell.onHand}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: BASE CASINGS & SLOTS */}
                    {activeTab === "casings" && (
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500">
                                <p>
                                    Track 3D-printed casing bases across available colors and slot sizes (1 to 8 keys).
                                </p>
                                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                                    Click any slot balance to log printed casings
                                </span>
                            </div>

                            <div className="space-y-6">
                                {visibleColors.map((col) => (
                                    <div key={col.id || col.name} className="bg-gray-50/60 rounded-2xl p-4 border border-gray-200/80">
                                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-3">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                                                    style={{ backgroundColor: col.hex }}
                                                />
                                                <h4 className="text-sm font-black text-gray-900">
                                                    Base Casing — Color: {col.name}
                                                </h4>
                                                {col.archived && (
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full ml-1">
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                1–8 Slots Available
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
                                            {CASING_SLOTS.map((slots) => {
                                                const colId = canonicalColorId(col.id || col.name);
                                                const itemKey = buildCasingBaseSku(colId, slots);
                                                const existing = inventoryMap.get(itemKey) || inventoryMap.get(`base_casing_${col.name.toLowerCase().replace(/\s+/g, "_")}_${slots}key`);
                                                const onHand = Number(existing?.on_hand ?? 0);
                                                const reserved = Number(existing?.reserved ?? 0);
                                                const available = Math.max(0, onHand - reserved);
                                                const isLow = onHand <= Number(existing?.low_threshold ?? 5);

                                                return (
                                                    <button
                                                        key={slots}
                                                        type="button"
                                                        onClick={() => handleOpenCasingAdjustment(col.name, slots)}
                                                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                                                            onHand === 0
                                                                ? "bg-white border-dashed border-gray-200 hover:border-teal-400 hover:bg-teal-50/30"
                                                                : isLow
                                                                ? "bg-amber-50/60 border-amber-300 hover:bg-amber-100"
                                                                : "bg-white border-teal-200 hover:border-teal-400 shadow-2xs"
                                                        }`}
                                                    >
                                                        <span className="block text-[11px] font-bold text-gray-500 mb-1">
                                                            {slots}-Key Base
                                                        </span>
                                                        <span className="block text-base font-black font-mono text-gray-900">
                                                            {onHand}
                                                        </span>
                                                        <span className="block text-[9px] text-gray-400 font-semibold mt-0.5">
                                                            {available} avail
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: SWITCHES & ADD-ONS (Direct from Studio Hub Consumables) */}
                    {activeTab === "consumables" && (
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        <Tag size={16} className="text-teal-600" /> Studio Hub Consumables Inventory
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Mechanical switches, keyrings, lobster clasps, and hardware are pulled live from your Studio Hub consumables.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Link
                                        to="/studio/consumables"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-all cursor-pointer"
                                    >
                                        <ExternalLink size={13} /> Manage in Studio Hub
                                    </Link>
                                    {switchConsumables.length === 0 && (
                                        <button
                                            onClick={handleSeedStarterConsumables}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all cursor-pointer"
                                        >
                                            <Sparkles size={13} /> + Import Starter Switches
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Section 1: Mechanical Switches */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                                    <Sliders size={14} /> Mechanical Switches ({switchConsumables.length})
                                </h4>

                                {switchConsumables.length === 0 ? (
                                    <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200 space-y-2">
                                        <p className="text-xs text-gray-500">
                                            No switches registered in your Studio Hub Consumables yet.
                                        </p>
                                        <button
                                            onClick={handleSeedStarterConsumables}
                                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                                        >
                                            Add Outemu Blue/Red/Brown Switches Now
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/80 border-b border-gray-200">
                                                    <th className="py-3 px-4 font-bold text-gray-600">Switch Name</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600">Stock On Hand</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600">Unit Cost (Studio Hub)</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600">Status</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {switchConsumables.map((con) => {
                                                    const stock = Number(con.quantity ?? con.stock ?? con.on_hand ?? 0);
                                                    const threshold = Number(con.reorder_threshold ?? con.low_stock_threshold ?? 15);
                                                    const isLow = stock <= threshold;
                                                    const unit = con.unit_of_measure || "pcs";
                                                    return (
                                                        <tr key={con.id} className="hover:bg-gray-50/60">
                                                            <td className="py-3 px-4 font-bold text-gray-900">
                                                                <div>{con.name}</div>
                                                                <span className="text-[10px] font-mono text-gray-400">ID: {con.id}</span>
                                                            </td>
                                                            <td className="py-3 px-4 font-mono font-bold text-gray-900">
                                                                <span className={stock <= 0 ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-700"}>
                                                                    {stock} {unit} {isLow && stock > 0 && "(Low)"}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 font-mono text-gray-700">
                                                                ₱{Number(con.unit_cost || 0).toFixed(2)}
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                                                        stock <= 0
                                                                            ? "bg-red-100 text-red-800"
                                                                            : isLow
                                                                            ? "bg-amber-100 text-amber-800"
                                                                            : "bg-emerald-100 text-emerald-800"
                                                                    }`}
                                                                >
                                                                    {stock <= 0 ? "Out of Stock" : isLow ? "Needs Restock" : "In Stock"}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleOpenConsumableAdjustment(con)}
                                                                    className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-all cursor-pointer"
                                                                >
                                                                    Adjust Stock
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Hardware Add-ons */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                                    <Tag size={14} /> Add-ons & Packaging ({hardwareAddonConsumables.length})
                                </h4>

                                {hardwareAddonConsumables.length === 0 ? (
                                    <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200">
                                        <p className="text-xs text-gray-500">
                                            No add-on hardware (keyrings, clasps, boxes) found in Studio Hub Consumables.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/80 border-b border-gray-200">
                                                    <th className="py-3 px-4 font-bold text-gray-600">Hardware / Add-on</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600">Stock On Hand</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600">Unit Cost</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600">Status</th>
                                                    <th className="py-3 px-4 font-bold text-gray-600 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {hardwareAddonConsumables.map((con) => {
                                                    const stock = Number(con.quantity ?? con.stock ?? con.on_hand ?? 0);
                                                    const threshold = Number(con.reorder_threshold ?? con.low_stock_threshold ?? 20);
                                                    const isLow = stock <= threshold;
                                                    const unit = con.unit_of_measure || "pcs";
                                                    return (
                                                        <tr key={con.id} className="hover:bg-gray-50/60">
                                                            <td className="py-3 px-4 font-bold text-gray-900">
                                                                <div>{con.name}</div>
                                                                <span className="text-[10px] font-mono text-gray-400">ID: {con.id}</span>
                                                            </td>
                                                            <td className="py-3 px-4 font-mono font-bold text-gray-900">
                                                                <span className={stock <= 0 ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-700"}>
                                                                    {stock} {unit} {isLow && stock > 0 && "(Low)"}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 font-mono text-gray-700">
                                                                ₱{Number(con.unit_cost || 0).toFixed(2)}
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                                                        stock <= 0
                                                                            ? "bg-red-100 text-red-800"
                                                                            : isLow
                                                                            ? "bg-amber-100 text-amber-800"
                                                                            : "bg-emerald-100 text-emerald-800"
                                                                    }`}
                                                                >
                                                                    {stock <= 0 ? "Out of Stock" : isLow ? "Needs Restock" : "In Stock"}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleOpenConsumableAdjustment(con)}
                                                                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs transition-all cursor-pointer"
                                                                >
                                                                    Adjust Stock
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: AUDIT MOVEMENT HISTORY */}
                    {activeTab === "history" && (
                        <div className="p-6">
                            {movements.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 space-y-2">
                                    <History size={32} className="mx-auto text-gray-300" />
                                    <p className="text-xs font-semibold">No inventory movements recorded yet.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-200">
                                                <th className="py-3 px-4 font-bold text-gray-600">Timestamp</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Item</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Change</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Prev → New</th>
                                                <th className="py-3 px-4 font-bold text-gray-600">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {movements.map((m) => {
                                                const isAdd = Number(m.delta) > 0;
                                                const dateStr = m.createdAt?.seconds
                                                    ? new Date(m.createdAt.seconds * 1000).toLocaleString()
                                                    : "Just now";

                                                return (
                                                    <tr key={m.id || m.movementId} className="hover:bg-gray-50/60">
                                                        <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">{dateStr}</td>
                                                        <td className="py-3 px-4 font-bold text-gray-900">{m.name || m.itemKey}</td>
                                                        <td className="py-3 px-4 font-mono font-bold">
                                                            <span className={`inline-flex items-center gap-1 ${isAdd ? "text-emerald-600" : "text-red-600"}`}>
                                                                {isAdd ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                                {isAdd ? `+${m.delta}` : m.delta}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-mono text-gray-600">
                                                            {m.previousOnHand ?? 0} → {m.newOnHand ?? 0}
                                                        </td>
                                                        <td className="py-3 px-4 text-gray-600">
                                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[11px]">
                                                                {m.reason || "Manual adjustment"}
                                                            </span>
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

            {/* ADD CUSTOM COLOR MODAL */}
            {isColorModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm border border-gray-100 shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                                    Variant Color Palette
                                </span>
                                <h3 className="text-base font-black text-gray-900">
                                    Add Custom Color
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsColorModalOpen(false)}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddCustomColor} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Color Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Neon Pink, Forest Green, Pastel Lilac"
                                    value={newColorName}
                                    onChange={(e) => setNewColorName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-900 focus:bg-white focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Color Preview & Hex Code
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={newColorHex}
                                        onChange={(e) => setNewColorHex(e.target.value)}
                                        className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={newColorHex}
                                        onChange={(e) => setNewColorHex(e.target.value)}
                                        className="flex-1 px-3.5 py-2 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-mono font-bold text-gray-900 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsColorModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                                >
                                    Add Color
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STOCK ADJUSTMENT MODAL */}
            {isAdjustmentModalOpen && selectedItem && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">
                                    Transactional Adjustment
                                </span>
                                <h3 className="text-base font-black text-gray-900">
                                    {selectedItem.name}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Current Stock Snapshot */}
                        <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl text-center text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 block uppercase">On-Hand</span>
                                <span className="text-base font-black text-gray-900 font-mono">{selectedItem.onHand}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 block uppercase">Reserved</span>
                                <span className="text-base font-bold text-gray-600 font-mono">{selectedItem.reserved}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 block uppercase">Available</span>
                                <span className="text-base font-black text-emerald-600 font-mono">{selectedItem.available}</span>
                            </div>
                        </div>

                        <form onSubmit={handleExecuteAdjustment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Adjustment Quantity (use positive to add, negative to deduct)
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentDelta((prev) => prev - 5)}
                                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold cursor-pointer"
                                    >
                                        <Minus size={15} />
                                    </button>
                                    <input
                                        type="number"
                                        required
                                        value={adjustmentDelta}
                                        onChange={(e) => setAdjustmentDelta(Number(e.target.value))}
                                        className="flex-1 px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-center font-mono font-bold text-sm text-gray-900 focus:bg-white focus:border-teal-500 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentDelta((prev) => prev + 5)}
                                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold cursor-pointer"
                                    >
                                        <Plus size={15} />
                                    </button>
                                </div>
                                <span className="text-[11px] text-gray-500 mt-1 block">
                                    New projected on-hand:{" "}
                                    <strong className="font-mono text-gray-900">
                                        {selectedItem.onHand + Number(adjustmentDelta)}
                                    </strong>
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Adjustment Reason / Audit Trail
                                </label>
                                <select
                                    value={adjustmentReason}
                                    onChange={(e) => setAdjustmentReason(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-700 focus:bg-white outline-none cursor-pointer"
                                >
                                    {ADJUSTMENT_REASONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAdjustmentModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdjusting}
                                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm cursor-pointer flex items-center gap-1.5"
                                >
                                    {isAdjusting ? "Updating..." : "Commit Transaction"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANAGE COLORS MODAL */}
            {isManageColorsOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 shrink-0">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 flex items-center gap-1">
                                    <Sliders size={12} /> Color Management
                                </span>
                                <h3 className="text-base font-black text-gray-900 mt-0.5">
                                    Manage Variant & Matrix Colors
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Control color availability, rename, adjust hex swatches, archive, or safely remove unused colors.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsManageColorsOpen(false);
                                    setEditingColorId(null);
                                }}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Quick Add Bar */}
                        <div className="p-6 py-4 bg-gray-50/70 border-b border-gray-100 shrink-0">
                            <form onSubmit={handleAddCustomColor} className="flex flex-col sm:flex-row items-center gap-3">
                                <div className="flex-1 w-full">
                                    <input
                                        type="text"
                                        placeholder="Add new color (e.g. Lavender, Cyber Yellow)..."
                                        value={newColorName}
                                        onChange={(e) => setNewColorName(e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:border-teal-500 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-gray-200">
                                        <input
                                            type="color"
                                            value={newColorHex}
                                            onChange={(e) => setNewColorHex(e.target.value)}
                                            className="w-6 h-6 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                                        />
                                        <span className="text-xs font-mono font-bold text-gray-600">{newColorHex}</span>
                                    </div>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                                    >
                                        <Plus size={13} /> Add Color
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Colors List */}
                        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
                            {allAvailableColors.map((col) => {
                                const isEditing = editingColorId === col.id;

                                if (isEditing) {
                                    return (
                                        <div
                                            key={col.id}
                                            className="p-3.5 rounded-2xl border-2 border-teal-500 bg-teal-50/20 flex flex-col sm:flex-row items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
                                                <input
                                                    type="color"
                                                    value={editColorForm.hex}
                                                    onChange={(e) =>
                                                        setEditColorForm((prev) => ({ ...prev, hex: e.target.value }))
                                                    }
                                                    className="w-9 h-9 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white shrink-0"
                                                />
                                                <input
                                                    type="text"
                                                    value={editColorForm.name}
                                                    onChange={(e) =>
                                                        setEditColorForm((prev) => ({ ...prev, name: e.target.value }))
                                                    }
                                                    placeholder="Color name"
                                                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-900 focus:border-teal-500 outline-none flex-1"
                                                />
                                                <input
                                                    type="text"
                                                    value={editColorForm.hex}
                                                    onChange={(e) =>
                                                        setEditColorForm((prev) => ({ ...prev, hex: e.target.value }))
                                                    }
                                                    className="w-24 px-2 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-mono font-bold text-gray-800 outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingColorId(null)}
                                                    className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveEditColor(col.id)}
                                                    className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                                                >
                                                    <Check size={13} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={col.id}
                                        className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                            col.archived
                                                ? "bg-gray-50/70 border-gray-200 opacity-75"
                                                : "bg-white border-gray-100 hover:border-gray-200 shadow-2xs"
                                        }`}
                                    >
                                        {/* Color Details */}
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-7 h-7 rounded-full border border-gray-300 shrink-0 shadow-2xs"
                                                style={{ backgroundColor: col.hex }}
                                            />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-gray-900">
                                                        {col.name}
                                                    </span>
                                                    <code className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                        id: {col.id}
                                                    </code>
                                                    {col.isDefault && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">
                                                            Standard
                                                        </span>
                                                    )}
                                                    {col.isFilament && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                                                            Filament
                                                        </span>
                                                    )}
                                                    {col.isCustom && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                                                            Custom
                                                        </span>
                                                    )}
                                                    {col.archived && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-extrabold uppercase">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                                                    Hex: {col.hex}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 flex-wrap shrink-0 self-end sm:self-center">
                                            {/* Enable / Disable toggle */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleColorActive(col)}
                                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                    col.active !== false
                                                        ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                                                        : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200"
                                                }`}
                                                title={col.active !== false ? "Disable color" : "Enable color"}
                                            >
                                                {col.active !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                                                <span>{col.active !== false ? "Active" : "Disabled"}</span>
                                            </button>

                                            {/* Edit */}
                                            <button
                                                type="button"
                                                onClick={() => handleStartEditColor(col)}
                                                className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                                title="Rename or change hex"
                                            >
                                                <Edit2 size={12} />
                                                <span>Edit</span>
                                            </button>

                                            {/* Archive / Restore */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleColorArchive(col)}
                                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                    col.archived
                                                        ? "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                                                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                }`}
                                                title={col.archived ? "Restore from archive" : "Archive color (preserves history, hides from customer)"}
                                            >
                                                {col.archived ? <RotateCcw size={12} /> : <Archive size={12} />}
                                                <span>{col.archived ? "Restore" : "Archive"}</span>
                                            </button>

                                            {/* Delete */}
                                            <button
                                                type="button"
                                                onClick={() => handleRequestDeleteColor(col)}
                                                className="p-1.5 rounded-xl hover:bg-red-50 text-red-600 hover:text-red-700 transition-all cursor-pointer"
                                                title="Delete unused color permanently"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                            <span className="text-[11px] text-gray-400">
                                Canonical IDs remain immutable across renames to safeguard past orders and ledger accounting.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsManageColorsOpen(false);
                                    setEditingColorId(null);
                                }}
                                className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE / REMOVE CONFIRMATION & SAFETY CHECK DIALOG */}
            {deleteConfirmColor && (
                <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl p-6 space-y-4">
                        {deleteBlockedReason ? (
                            <>
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shrink-0">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-gray-900">
                                            Cannot Delete "{deleteConfirmColor.name}"
                                        </h3>
                                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                                            {deleteBlockedReason}
                                        </p>
                                        <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 text-xs text-teal-800 mt-3 font-medium leading-relaxed">
                                            <strong>Recommended Action:</strong> Archive this color instead. Archived colors are hidden from new customer customizers while preserving past order records and movement history.
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeleteConfirmColor(null);
                                            setDeleteBlockedReason(null);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleToggleColorArchive(deleteConfirmColor);
                                            setDeleteConfirmColor(null);
                                            setDeleteBlockedReason(null);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Archive size={13} /> Archive Color Instead
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-2xl bg-red-100 text-red-700 shrink-0">
                                        <Trash2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-gray-900">
                                            Delete Color "{deleteConfirmColor.name}"?
                                        </h3>
                                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                                            This color has zero on-hand stock, zero active reservations or allocations, and no recorded movement history. Are you sure you want to permanently remove it? This action cannot be undone.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeleteConfirmColor(null);
                                            setDeleteBlockedReason(null);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmDeleteColor}
                                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                                    >
                                        Delete Permanently
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </BazaarLayout>
    );
}
