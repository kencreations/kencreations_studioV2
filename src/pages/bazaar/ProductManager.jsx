import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
    getSellerShop,
    getAllSellerProducts,
    createProduct,
    updateProduct,
    archiveProduct,
    duplicateProduct,
} from "../../services/bazaarService";
import { getFilaments, getConsumables } from "../../services/studioService";
import { calculateBOMCost, decomposeProductBOM } from "../../engine/bazaar/bom";
import { calculateMargin } from "../../engine/bazaar/pricing";
import BazaarLayout from "../../components/bazaar/BazaarLayout";
import {
    Package,
    Plus,
    Search,
    Edit2,
    Copy,
    Archive,
    RotateCcw,
    Eye,
    Tag,
    Layers,
    DollarSign,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    X,
    Image,
    HelpCircle,
    Percent,
    Sliders,
    Link as LinkIcon,
    ChevronDown,
    Palette,
    Zap,
    Heart,
    Star,
    Smile,
    Crown,
    Check,
} from "lucide-react";

// Available preset categories
const CATEGORIES = [
    "Clickers",
    "Keychains",
    "PopSockets",
    "Charms",
    "Accessories",
    "Desk Toys",
    "Other",
];

// Default Colors
const DEFAULT_CLICKER_COLORS = [
    { id: "teal", name: "Teal Green", hex: "#14b8a6" },
    { id: "pink", name: "Pastel Pink", hex: "#f472b6" },
    { id: "purple", name: "Lavender Purple", hex: "#a855f7" },
    { id: "white", name: "Clean White", hex: "#f8fafc" },
    { id: "black", name: "Matte Black", hex: "#1e293b" },
    { id: "mint", name: "Mint Fresh", hex: "#6ee7b7" },
];

const DEFAULT_BASE_COLORS = [
    { id: "black", name: "Matte Black", hex: "#1e293b" },
    { id: "white", name: "Clean White", hex: "#f8fafc" },
    { id: "teal", name: "Teal Green", hex: "#14b8a6" },
    { id: "grey", name: "Silver Grey", hex: "#94a3b8" },
];

// Available Icon Keycaps
const AVAILABLE_ICONS = [
    { id: "heart", label: "Heart", emoji: "❤️" },
    { id: "star", label: "Star", emoji: "⭐" },
    { id: "crown", label: "Crown", emoji: "👑" },
    { id: "gamepad", label: "Gaming", emoji: "🎮" },
    { id: "paw", label: "Paw", emoji: "🐾" },
    { id: "zap", label: "Lightning", emoji: "⚡" },
    { id: "music", label: "Music", emoji: "🎵" },
    { id: "flame", label: "Fire", emoji: "🔥" },
    { id: "smile", label: "Smile", emoji: "😊" },
    { id: "cat", label: "Cat", emoji: "🐱" },
    { id: "coffee", label: "Coffee", emoji: "☕" },
    { id: "rocket", label: "Rocket", emoji: "🚀" },
];

const DEFAULT_CASING_STYLES = [
    { id: "standard", name: "Standard Block", extraPrice: 0 },
    { id: "rounded", name: "Compact Rounded", extraPrice: 10 },
    { id: "ergonomic", name: "Ergonomic Curve", extraPrice: 20 },
];

export default function ProductManager() {
    const { currentUser } = useAuth();
    const [shop, setShop] = useState(null);
    const [products, setProducts] = useState([]);
    const [filaments, setFilaments] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'ready_made' | 'made_to_order'
    const [statusTab, setStatusTab] = useState("all"); // 'all' | 'active' | 'draft' | 'archived'

    // Notification banners
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal states
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState("general"); // 'general' | 'variants' | 'customization' | 'costing'
    const [editingProduct, setEditingProduct] = useState(null);
    const [previewProduct, setPreviewProduct] = useState(null);

    // Form fields
    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [category, setCategory] = useState("Clickers");
    const [type, setType] = useState("made_to_order"); // 'ready_made' | 'made_to_order'
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [retailPrice, setRetailPrice] = useState(150);
    const [eventPriceOverride, setEventPriceOverride] = useState("");
    const [maxOrderQty, setMaxOrderQty] = useState(5);
    const [status, setStatus] = useState("active"); // 'active' | 'draft' | 'archived'
    const [isPublished, setIsPublished] = useState(true);
    const [internalNotes, setInternalNotes] = useState("");

    // Ready-Made Variants state
    const [readyVariants, setReadyVariants] = useState([
        { id: "v1", color: "Matte Black", style: "Standard", sku: "", on_hand: 10, unit_cost: 45, price: 150, low_threshold: 3 },
    ]);

    // Made-to-Order Customization Schema (Letter Clicker)
    const [maxLetters, setMaxLetters] = useState(6);
    const [baseIncludedLetters, setBaseIncludedLetters] = useState(3);
    const [extraPerLetterPrice, setExtraPerLetterPrice] = useState(20);
    const [allowedCharacters, setAllowedCharacters] = useState("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    
    // Dynamic Colors
    const [selectedColors, setSelectedColors] = useState(DEFAULT_CLICKER_COLORS);
    const [newColorName, setNewColorName] = useState("");
    const [newColorHex, setNewColorHex] = useState("#3b82f6");

    // Base / Casing Colors & Slots
    const [casingBaseColors, setCasingBaseColors] = useState(DEFAULT_BASE_COLORS);
    const [newBaseColorName, setNewBaseColorName] = useState("");
    const [newBaseColorHex, setNewBaseColorHex] = useState("#1e293b");
    const [availableSlots, setAvailableSlots] = useState([1, 2, 3, 4, 5, 6]);
    const [slotPricing, setSlotPricing] = useState({
        1: 0,
        2: 25,
        3: 50,
        4: 75,
        5: 100,
        6: 125,
        7: 150,
        8: 175,
    });
    const [casingStyles, setCasingStyles] = useState(DEFAULT_CASING_STYLES);

    // Switches selected directly from Studio Hub consumables inventory
    const [selectedConsumableSwitches, setSelectedConsumableSwitches] = useState([]);

    // Add-ons selected directly from Studio Hub consumables inventory
    const [selectedConsumableAddons, setSelectedConsumableAddons] = useState([]);

    // Icon Keycaps Configuration
    const [enableIconKeycaps, setEnableIconKeycaps] = useState(true);
    const [selectedIcons, setSelectedIcons] = useState(AVAILABLE_ICONS.map((i) => i.id));
    const [iconCapSurcharge, setIconCapSurcharge] = useState(0);

    // Linked Studio Hub inventory for Costing
    const [linkedFilamentId, setLinkedFilamentId] = useState("");

    const loadData = useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [shopData, prodsData, filsData, consData] = await Promise.all([
                getSellerShop(currentUser.uid).catch(() => null),
                getAllSellerProducts(currentUser.uid).catch(() => []),
                getFilaments(currentUser.uid).catch(() => []),
                getConsumables(currentUser.uid).catch(() => []),
            ]);
            setShop(shopData);
            setProducts(prodsData);
            setFilaments(filsData);
            setConsumables(consData);
        } catch (err) {
            console.error("[ProductManager] Failed to load data:", err);
            setErrorMessage("Failed to load catalog records.");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Helper: Add custom letter color
    const handleAddColor = () => {
        if (!newColorName.trim()) return;
        const colId = `col_${Date.now().toString(36)}`;
        setSelectedColors((prev) => [
            ...prev,
            { id: colId, name: newColorName.trim(), hex: newColorHex },
        ]);
        setNewColorName("");
    };

    // Helper: Remove letter color
    const handleRemoveColor = (colId) => {
        setSelectedColors((prev) => prev.filter((c) => c.id !== colId));
    };

    // Helper: Import all filament colors from Studio Hub
    const handleImportColorsFromFilaments = () => {
        if (!filaments || filaments.length === 0) {
            setErrorMessage("No filaments found in Studio Hub to import.");
            return;
        }
        let addedCount = 0;
        const existingNames = new Set(selectedColors.map((c) => c.name.toLowerCase()));
        const newColors = [...selectedColors];

        for (const fil of filaments) {
            const colorName = fil.color_name || fil.name;
            if (colorName && !existingNames.has(colorName.toLowerCase())) {
                newColors.push({
                    id: fil.id,
                    name: colorName,
                    hex: fil.color_hex || "#14b8a6",
                });
                existingNames.add(colorName.toLowerCase());
                addedCount++;
            }
        }

        setSelectedColors(newColors);
        setSuccessMessage(`Imported ${addedCount} colors from your Studio Hub filaments!`);
    };

    // Helper: Add base/casing color
    const handleAddBaseColor = () => {
        if (!newBaseColorName.trim()) return;
        const colId = `base_col_${Date.now().toString(36)}`;
        setCasingBaseColors((prev) => [
            ...prev,
            { id: colId, name: newBaseColorName.trim(), hex: newBaseColorHex },
        ]);
        setNewBaseColorName("");
    };

    // Helper: Remove base color
    const handleRemoveBaseColor = (colId) => {
        setCasingBaseColors((prev) => prev.filter((c) => c.id !== colId));
    };

    // Helper: Import base colors from filaments
    const handleImportBaseColorsFromFilaments = () => {
        if (!filaments || filaments.length === 0) return;
        const existingNames = new Set(casingBaseColors.map((c) => c.name.toLowerCase()));
        const newColors = [...casingBaseColors];
        let added = 0;

        for (const fil of filaments) {
            const colorName = fil.color_name || fil.name;
            if (colorName && !existingNames.has(colorName.toLowerCase())) {
                newColors.push({
                    id: `base_${fil.id}`,
                    name: colorName,
                    hex: fil.color_hex || "#1e293b",
                });
                existingNames.add(colorName.toLowerCase());
                added++;
            }
        }
        setCasingBaseColors(newColors);
        setSuccessMessage(`Imported ${added} base colors from Studio Hub filaments!`);
    };

    // Helper: Toggle slot count
    const handleToggleSlot = (slot) => {
        if (availableSlots.includes(slot)) {
            if (availableSlots.length === 1) return; // Keep at least one
            setAvailableSlots(availableSlots.filter((s) => s !== slot));
        } else {
            setAvailableSlots([...availableSlots, slot].sort((a, b) => a - b));
            if (slotPricing[slot] === undefined) {
                setSlotPricing((prev) => ({
                    ...prev,
                    [slot]: slot === 1 ? 0 : (slot - 1) * 25,
                }));
            }
        }
    };

    // Helper: Update additional price for a base slot count
    const handleUpdateSlotPrice = (slot, price) => {
        const numPrice = Math.max(0, Number(price) || 0);
        setSlotPricing((prev) => ({
            ...prev,
            [slot]: numPrice,
        }));
    };

    // Helper: Toggle consumable switch selection
    const handleToggleConsumableSwitch = (cons) => {
        const existingIndex = selectedConsumableSwitches.findIndex((s) => s.consumableId === cons.id);
        if (existingIndex >= 0) {
            setSelectedConsumableSwitches(selectedConsumableSwitches.filter((s) => s.consumableId !== cons.id));
        } else {
            setSelectedConsumableSwitches([
                ...selectedConsumableSwitches,
                {
                    consumableId: cons.id,
                    name: cons.name,
                    stockQty: cons.quantity || 0,
                    unitCost: cons.unit_cost || 0,
                    extraPrice: 0,
                },
            ]);
        }
    };

    // Helper: Update switch surcharge
    const handleUpdateSwitchPrice = (consumableId, extraPrice) => {
        setSelectedConsumableSwitches((prev) =>
            prev.map((s) =>
                s.consumableId === consumableId ? { ...s, extraPrice: Number(extraPrice) || 0 } : s
            )
        );
    };

    // Helper: Toggle consumable addon selection
    const handleToggleConsumableAddon = (cons) => {
        const existingIndex = selectedConsumableAddons.findIndex((a) => a.consumableId === cons.id);
        if (existingIndex >= 0) {
            setSelectedConsumableAddons(selectedConsumableAddons.filter((a) => a.consumableId !== cons.id));
        } else {
            setSelectedConsumableAddons([
                ...selectedConsumableAddons,
                {
                    consumableId: cons.id,
                    name: cons.name,
                    stockQty: cons.quantity || 0,
                    unitCost: cons.unit_cost || 0,
                    price: 15,
                },
            ]);
        }
    };

    // Helper: Update addon price
    const handleUpdateAddonPrice = (consumableId, price) => {
        setSelectedConsumableAddons((prev) =>
            prev.map((a) =>
                a.consumableId === consumableId ? { ...a, price: Number(price) || 0 } : a
            )
        );
    };

    // Helper: Toggle icon selection
    const handleToggleIcon = (iconId) => {
        if (selectedIcons.includes(iconId)) {
            setSelectedIcons(selectedIcons.filter((i) => i !== iconId));
        } else {
            setSelectedIcons([...selectedIcons, iconId]);
        }
    };

    // Live calculated unit cost from linked Studio Hub items
    const liveCostCalculation = useMemo(() => {
        const firstSwitch = selectedConsumableSwitches[0];
        const firstAddon = selectedConsumableAddons[0];

        const dummyCustomization = {
            text: "KEN",
            default_letter_color: selectedColors[0]?.name || "Teal Green",
            casing_style_id: casingStyles[0]?.id || "standard",
            switch_type_id: firstSwitch?.name || "Standard Switch",
            switch_consumable_id: firstSwitch?.consumableId || null,
            selected_add_on_ids: firstAddon ? [firstAddon.consumableId] : [],
        };

        const dummyProduct = {
            id: editingProduct?.id || "preview_calc",
            title: name || "Sample Clicker",
            category: category.toLowerCase(),
            type,
            customization_schema: {
                add_ons: selectedConsumableAddons.map((a) => ({
                    id: a.consumableId || a.consumable_id || a.id || "",
                    consumable_id: a.consumableId || a.consumable_id || a.id || "",
                    name: a.name || "",
                    price: Number(a.price || 0),
                })),
            },
        };

        const bom = decomposeProductBOM({
            product: dummyProduct,
            customization: dummyCustomization,
            quantity: 1,
        });

        const activeFilament = filaments.find((f) => f.id === linkedFilamentId);

        const bomCost = calculateBOMCost(bom, {
            filaments: activeFilament ? [activeFilament] : filaments,
            consumables,
        });

        const margin = calculateMargin(retailPrice, bomCost.totalCost);

        return {
            bom,
            bomCost,
            margin,
        };
    }, [
        name,
        category,
        type,
        retailPrice,
        selectedColors,
        casingStyles,
        selectedConsumableSwitches,
        selectedConsumableAddons,
        linkedFilamentId,
        filaments,
        consumables,
        editingProduct,
    ]);

    // Open Modal for Create or Edit
    const handleOpenModal = (productToEdit = null) => {
        setErrorMessage("");
        setSuccessMessage("");
        setModalTab("general");

        if (productToEdit) {
            setEditingProduct(productToEdit);
            setName(productToEdit.name || "");
            setSku(productToEdit.sku || "");
            setCategory(productToEdit.category || "Clickers");
            setType(productToEdit.type || "made_to_order");
            setDescription(productToEdit.description || "");
            setImageUrl(productToEdit.images?.[0] || "");
            setRetailPrice(productToEdit.retailPrice || 150);
            setEventPriceOverride(productToEdit.eventPriceOverride || "");
            setMaxOrderQty(productToEdit.maxOrderQty || 5);
            setStatus(productToEdit.status || "active");
            setIsPublished(productToEdit.isPublished !== false);
            setInternalNotes(productToEdit.internalNotes || "");

            if (productToEdit.variants?.length > 0) {
                setReadyVariants(productToEdit.variants);
            }

            const schema = productToEdit.customizationOptions || productToEdit.customization_schema;
            if (schema) {
                setMaxLetters(schema.max_letters || 6);
                setBaseIncludedLetters(schema.base_included_letters || 3);
                setExtraPerLetterPrice(schema.extra_per_letter_price ?? 20);
                setAllowedCharacters(schema.allowed_characters || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
                if (schema.colors) setSelectedColors(schema.colors);
                if (schema.base_colors) setCasingBaseColors(schema.base_colors);
                if (schema.available_slots) setAvailableSlots(schema.available_slots);
                if (schema.slot_pricing) {
                    setSlotPricing(schema.slot_pricing);
                } else if (schema.base_slots && Array.isArray(schema.base_slots)) {
                    const pricingMap = {};
                    for (const b of schema.base_slots) {
                        pricingMap[b.slots] = Number(b.additional_price || 0);
                    }
                    setSlotPricing(pricingMap);
                }
                if (schema.casing_styles) setCasingStyles(schema.casing_styles);
                if (schema.switches) {
                    setSelectedConsumableSwitches(
                        schema.switches.map((s) => ({
                            consumableId: s.consumableId || s.consumable_id || s.id || "",
                            name: s.name || "",
                            stockQty: Number(s.stockQty ?? s.stock ?? s.quantity ?? 0),
                            unitCost: Number(s.unitCost ?? s.unit_cost ?? 0),
                            extraPrice: Number(s.extraPrice ?? s.extra_price ?? 0),
                        }))
                    );
                }
                if (schema.add_ons) {
                    setSelectedConsumableAddons(
                        schema.add_ons.map((a) => ({
                            consumableId: a.consumableId || a.consumable_id || a.id || "",
                            name: a.name || "",
                            stockQty: Number(a.stockQty ?? a.stock ?? a.quantity ?? 0),
                            unitCost: Number(a.unitCost ?? a.unit_cost ?? 0),
                            price: Number(a.price || 0),
                        }))
                    );
                }
                if (schema.icon_caps_enabled !== undefined) setEnableIconKeycaps(schema.icon_caps_enabled);
                if (schema.available_icons) setSelectedIcons(schema.available_icons);
                if (schema.icon_cap_surcharge !== undefined) setIconCapSurcharge(schema.icon_cap_surcharge);
            }

            setLinkedFilamentId(productToEdit.linkedFilamentId || "");
        } else {
            setEditingProduct(null);
            setName("");
            setSku(`SKU-${Date.now().toString(36).substring(3, 7).toUpperCase()}`);
            setCategory("Clickers");
            setType("made_to_order");
            setDescription("Personalized mechanical keycap clicker fidget toy. Custom letters, colors, icons, and switches.");
            setImageUrl("");
            setRetailPrice(150);
            setEventPriceOverride("");
            setMaxOrderQty(5);
            setStatus("active");
            setIsPublished(true);
            setInternalNotes("");
            setReadyVariants([
                { id: "v1", color: "Matte Black", style: "Standard", sku: `SKU-BLK-${Date.now().toString(36).slice(-3)}`, on_hand: 10, unit_cost: 45, price: 150, low_threshold: 3 },
            ]);
            setMaxLetters(6);
            setBaseIncludedLetters(3);
            setExtraPerLetterPrice(20);
            setAllowedCharacters("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
            setSelectedColors(DEFAULT_CLICKER_COLORS);
            setCasingBaseColors(DEFAULT_BASE_COLORS);
            setAvailableSlots([1, 2, 3, 4, 5, 6]);
            setSlotPricing({
                1: 0,
                2: 25,
                3: 50,
                4: 75,
                5: 100,
                6: 125,
                7: 150,
                8: 175,
            });
            setCasingStyles(DEFAULT_CASING_STYLES);
            setEnableIconKeycaps(true);
            setSelectedIcons(AVAILABLE_ICONS.map((i) => i.id));
            setIconCapSurcharge(0);

            // Auto-populate switches from Studio Hub consumables matching "switch"
            const switchMatches = consumables.filter((c) =>
                c.name.toLowerCase().includes("switch") || (c.category && c.category.toLowerCase().includes("switch"))
            );
            if (switchMatches.length > 0) {
                setSelectedConsumableSwitches(
                    switchMatches.map((c, i) => ({
                        consumableId: c.id,
                        name: c.name,
                        stockQty: c.quantity || 0,
                        unitCost: c.unit_cost || 0,
                        extraPrice: i === 0 ? 0 : 10,
                    }))
                );
            } else {
                setSelectedConsumableSwitches([]);
            }

            // Auto-populate add-ons from consumables matching "keyring" or "packaging"
            const addonMatches = consumables.filter((c) =>
                c.name.toLowerCase().includes("keyring") ||
                c.name.toLowerCase().includes("clasp") ||
                c.name.toLowerCase().includes("chain") ||
                c.name.toLowerCase().includes("box") ||
                (c.category && (c.category.toLowerCase().includes("attachment") || c.category.toLowerCase().includes("packaging")))
            );
            if (addonMatches.length > 0) {
                setSelectedConsumableAddons(
                    addonMatches.map((c) => ({
                        consumableId: c.id,
                        name: c.name,
                        stockQty: c.quantity || 0,
                        unitCost: c.unit_cost || 0,
                        price: 15,
                    }))
                );
            } else {
                setSelectedConsumableAddons([]);
            }

            setLinkedFilamentId(filaments[0]?.id || "");
        }

        setIsProductModalOpen(true);
    };

    // Save Product (Create or Update)
    const handleSaveProduct = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage("Product name is required.");
            return;
        }

        setSaving(true);
        setErrorMessage("");

        try {
            const productPayload = {
                name: name.trim(),
                sku: sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
                category,
                type,
                description: description.trim(),
                images: imageUrl.trim() ? [imageUrl.trim()] : [],
                retailPrice: Number(retailPrice) || 0,
                eventPriceOverride: eventPriceOverride !== "" ? Number(eventPriceOverride) : null,
                maxOrderQty: Number(maxOrderQty) || 5,
                status,
                isPublished,
                internalNotes: internalNotes.trim(),

                // Ready-Made Variants
                variants: type === "ready_made" ? readyVariants : [],

                // Customization schema for made-to-order letter clickers
                customizationOptions:
                    type === "made_to_order"
                        ? {
                              type: "letter_clicker",
                              max_letters: Number(maxLetters) || 6,
                              base_included_letters: Number(baseIncludedLetters) || 3,
                              extra_per_letter_price: Number(extraPerLetterPrice) || 0,
                              allowed_characters: allowedCharacters,
                              colors: selectedColors,
                              base_colors: casingBaseColors,
                              available_slots: availableSlots,
                              slot_pricing: slotPricing,
                              base_slots: availableSlots.map((slot) => ({
                                  slots: slot,
                                  label: `${slot}-Key Base`,
                                  additional_price: Number(slotPricing[slot] || 0),
                              })),
                              casing_styles: casingStyles,
                              switches: selectedConsumableSwitches.map((s) => ({
                                  consumableId: s.consumableId || s.consumable_id || s.id || "",
                                  name: s.name || "",
                                  stockQty: Number(s.stockQty ?? s.stock ?? s.quantity ?? 0),
                                  unitCost: Number(s.unitCost ?? s.unit_cost ?? 0),
                                  extraPrice: Number(s.extraPrice ?? s.extra_price ?? 0),
                              })),
                              add_ons: selectedConsumableAddons.map((a) => ({
                                  id: a.consumableId || a.consumable_id || a.id || "",
                                  consumable_id: a.consumableId || a.consumable_id || a.id || "",
                                  name: a.name || "",
                                  price: Number(a.price || 0),
                              })),
                              icon_caps_enabled: Boolean(enableIconKeycaps),
                              available_icons: selectedIcons,
                              icon_cap_surcharge: Number(iconCapSurcharge) || 0,
                          }
                        : null,

                // Studio Hub Costing Snapshot
                linkedFilamentId: linkedFilamentId || null,
                unitProductionCost: Number(liveCostCalculation?.bomCost?.totalCost ?? 0),
                targetMarginPercent: Number(liveCostCalculation?.margin?.marginPercent ?? 0),
            };

            if (editingProduct) {
                await updateProduct(currentUser.uid, editingProduct.id, productPayload);
                setSuccessMessage(`Product "${name}" updated successfully.`);
            } else {
                await createProduct(currentUser.uid, productPayload);
                setSuccessMessage(`Product "${name}" created successfully.`);
            }

            setIsProductModalOpen(false);
            await loadData();
        } catch (err) {
            console.error("[ProductManager] Failed to save product:", err);
            setErrorMessage(err.message || "Failed to save product.");
        } finally {
            setSaving(false);
        }
    };

    // Duplicate Product
    const handleDuplicate = async (prod) => {
        try {
            setLoading(true);
            await duplicateProduct(currentUser.uid, prod.id);
            setSuccessMessage(`Duplicated "${prod.name}" as draft copy.`);
            await loadData();
        } catch (err) {
            console.error("[ProductManager] Failed to duplicate:", err);
            setErrorMessage("Failed to duplicate product.");
            setLoading(false);
        }
    };

    // Soft-Archive Product
    const handleArchive = async (prod) => {
        if (!window.confirm(`Are you sure you want to archive "${prod.name}"? Historical orders will be preserved, but the item will be unlisted.`)) {
            return;
        }
        try {
            setLoading(true);
            await archiveProduct(currentUser.uid, prod.id);
            setSuccessMessage(`Archived "${prod.name}".`);
            await loadData();
        } catch (err) {
            console.error("[ProductManager] Failed to archive:", err);
            setErrorMessage("Failed to archive product.");
            setLoading(false);
        }
    };

    // Restore from Archive
    const handleRestore = async (prod) => {
        try {
            setLoading(true);
            await updateProduct(currentUser.uid, prod.id, {
                status: "active",
                isPublished: true,
            });
            setSuccessMessage(`Restored "${prod.name}" to active status.`);
            await loadData();
        } catch (err) {
            console.error("[ProductManager] Failed to restore:", err);
            setErrorMessage("Failed to restore product.");
            setLoading(false);
        }
    };

    // Filtered Products
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(query);
                const matchSku = p.sku?.toLowerCase().includes(query);
                const matchCat = p.category?.toLowerCase().includes(query);
                if (!matchName && !matchSku && !matchCat) return false;
            }

            if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
            if (typeFilter !== "all" && p.type !== typeFilter) return false;

            if (statusTab === "active" && (p.status !== "active" || !p.isPublished)) return false;
            if (statusTab === "draft" && p.status !== "draft") return false;
            if (statusTab === "archived" && p.status !== "archived") return false;
            if (statusTab === "all" && p.status === "archived") return false;

            return true;
        });
    }, [products, searchQuery, categoryFilter, typeFilter, statusTab]);

    const stats = useMemo(() => {
        const total = products.filter((p) => p.status !== "archived").length;
        const active = products.filter((p) => p.status === "active" && p.isPublished).length;
        const madeToOrder = products.filter((p) => p.type === "made_to_order" && p.status !== "archived").length;
        const readyMade = products.filter((p) => p.type === "ready_made" && p.status !== "archived").length;
        const archived = products.filter((p) => p.status === "archived").length;
        return { total, active, madeToOrder, readyMade, archived };
    }, [products]);

    return (
        <BazaarLayout activeTab="products">
            <div className="space-y-6">
                {/* Header Title & Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
                                Milestone 3
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                Master Shop Catalog
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-1 flex items-center gap-2">
                            Product Management
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Configure ready-made items, custom letter/icon clickers, base slots, and switches direct from consumables inventory.
                        </p>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer self-start md:self-auto"
                    >
                        <Plus size={16} /> Add Product
                    </button>
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

                {/* Catalog Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Active Products</span>
                            <Package size={18} className="text-teal-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">{stats.active}</div>
                        <span className="text-[11px] text-gray-400">Available on public kiosk</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Made-to-Order</span>
                            <Sparkles size={18} className="text-purple-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">{stats.madeToOrder}</div>
                        <span className="text-[11px] text-gray-400">Custom clickers & icon caps</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Ready-Made</span>
                            <Layers size={18} className="text-amber-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">{stats.readyMade}</div>
                        <span className="text-[11px] text-gray-400">Batch stock items</span>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between text-gray-400 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">Studio Hub Link</span>
                            <LinkIcon size={18} className="text-teal-600" />
                        </div>
                        <div className="text-2xl font-black text-gray-900 font-mono">
                            {filaments.length + consumables.length}
                        </div>
                        <span className="text-[11px] text-gray-400">
                            {filaments.length} spools · {consumables.length} consumables
                        </span>
                    </div>
                </div>

                {/* Filter and Tab Bar */}
                <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                            {[
                                { id: "all", label: "All Catalog", count: stats.total },
                                { id: "active", label: "Active", count: stats.active },
                                { id: "draft", label: "Drafts", count: stats.total - stats.active },
                                { id: "archived", label: "Archived", count: stats.archived },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setStatusTab(tab.id)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        statusTab === tab.id
                                            ? "bg-teal-50 text-teal-800 border border-teal-200/60"
                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-600">
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100 text-xs">
                            <button
                                onClick={() => setTypeFilter("all")}
                                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                    typeFilter === "all" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500"
                                }`}
                            >
                                All Types
                            </button>
                            <button
                                onClick={() => setTypeFilter("made_to_order")}
                                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                    typeFilter === "made_to_order" ? "bg-white text-purple-700 shadow-2xs" : "text-gray-500"
                                }`}
                            >
                                Made-to-Order
                            </button>
                            <button
                                onClick={() => setTypeFilter("ready_made")}
                                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                    typeFilter === "ready_made" ? "bg-white text-amber-700 shadow-2xs" : "text-gray-500"
                                }`}
                            >
                                Ready-Made
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products by title, SKU, or tag..."
                                className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all"
                            />
                        </div>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full sm:w-44 px-3 py-2 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-700 focus:bg-white focus:border-teal-500 outline-none cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Product Grid / Table */}
                {loading ? (
                    <div className="p-16 text-center">
                        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <span className="text-xs text-gray-400 font-bold">Loading product catalog...</span>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                            <Package size={28} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">No products found</h3>
                            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                {searchQuery || categoryFilter !== "all" || typeFilter !== "all"
                                    ? "No products match your search or filter criteria."
                                    : "You haven't created any products in your catalog yet. Click below to add your first product."}
                            </p>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                        >
                            <Plus size={15} /> Create First Product
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredProducts.map((prod) => {
                            const isReady = prod.type === "ready_made";
                            const isArchived = prod.status === "archived";
                            const cost = prod.unitProductionCost || 0;
                            const margin = calculateMargin(prod.retailPrice, cost);

                            return (
                                <div
                                    key={prod.id}
                                    className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md ${
                                        isArchived
                                            ? "border-gray-200 opacity-60 bg-gray-50/50"
                                            : "border-gray-100 hover:border-teal-200"
                                    }`}
                                >
                                    <div className="p-5 space-y-3.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                                {prod.images?.[0] ? (
                                                    <img
                                                        src={prod.images[0]}
                                                        alt={prod.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <Package size={22} className="text-gray-400" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                                        isReady
                                                            ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                                            : "bg-purple-50 text-purple-700 border border-purple-200/60"
                                                    }`}>
                                                        {isReady ? "Ready-Made" : "Made-to-Order"}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                                        {prod.category}
                                                    </span>
                                                    {isArchived ? (
                                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                                                            Archived
                                                        </span>
                                                    ) : prod.status === "draft" ? (
                                                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                                            Draft
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <h3 className="text-sm font-black text-gray-900 mt-1 truncate" title={prod.name}>
                                                    {prod.name}
                                                </h3>
                                                <span className="text-[11px] font-mono text-gray-400 block truncate">
                                                    SKU: {prod.sku || "N/A"}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                            {prod.description || "No description provided."}
                                        </p>

                                        <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-left">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 block uppercase">Retail</span>
                                                <span className="text-sm font-black text-gray-900 font-mono">
                                                    ₱{prod.retailPrice?.toFixed(2) || "0.00"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 block uppercase">BOM Cost</span>
                                                <span className="text-xs font-bold text-gray-600 font-mono">
                                                    ₱{cost > 0 ? cost.toFixed(2) : "0.00"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 block uppercase">Margin</span>
                                                <span className="text-xs font-bold text-emerald-600 font-mono">
                                                    {margin.marginPercent > 0 ? `${margin.marginPercent}%` : "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => setPreviewProduct(prod)}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-teal-700 transition-colors cursor-pointer"
                                            title="Preview Public Storefront View"
                                        >
                                            <Eye size={13} /> Preview
                                        </button>

                                        <div className="flex items-center gap-1.5">
                                            {!isArchived ? (
                                                <>
                                                    <button
                                                        onClick={() => handleDuplicate(prod)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-all cursor-pointer"
                                                        title="Duplicate as Draft"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal(prod)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-gray-200/60 transition-all cursor-pointer"
                                                        title="Edit Product"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleArchive(prod)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                                        title="Archive Product"
                                                    >
                                                        <Archive size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleRestore(prod)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-200 hover:bg-teal-50 text-gray-700 hover:text-teal-700 text-xs font-bold transition-all cursor-pointer"
                                                    title="Restore Product"
                                                >
                                                    <RotateCcw size={12} /> Restore
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CREATE / EDIT PRODUCT MODAL */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl border border-gray-100 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">
                                    {editingProduct ? "Edit Product" : "New Catalog Item"}
                                </span>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                                    {name || "Untitled Product"}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsProductModalOpen(false)}
                                className="p-2 rounded-2xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 overflow-x-auto shrink-0">
                            <button
                                onClick={() => setModalTab("general")}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    modalTab === "general"
                                        ? "bg-white text-teal-800 shadow-2xs border border-gray-200/60"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                General Details
                            </button>

                            {type === "made_to_order" ? (
                                <button
                                    onClick={() => setModalTab("customization")}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        modalTab === "customization"
                                            ? "bg-white text-purple-800 shadow-2xs border border-gray-200/60"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    <Sparkles size={13} className="text-purple-600" />
                                    Clicker & Icon Options
                                </button>
                            ) : (
                                <button
                                    onClick={() => setModalTab("variants")}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        modalTab === "variants"
                                            ? "bg-white text-amber-800 shadow-2xs border border-gray-200/60"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    <Layers size={13} className="text-amber-600" />
                                    Variants & Stock
                                </button>
                            )}

                            <button
                                onClick={() => setModalTab("costing")}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    modalTab === "costing"
                                        ? "bg-white text-teal-800 shadow-2xs border border-gray-200/60"
                                        : "text-gray-500 hover:text-gray-900"
                                }`}
                            >
                                <DollarSign size={13} className="text-emerald-600" />
                                Studio Hub Costing
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* TAB 1: GENERAL INFO */}
                            {modalTab === "general" && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Product Title <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="e.g. Custom Fidget Clicker"
                                                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                SKU (Stock Keeping Unit)
                                            </label>
                                            <input
                                                type="text"
                                                value={sku}
                                                onChange={(e) => setSku(e.target.value)}
                                                placeholder="e.g. CLK-3KEY-CUSTOM"
                                                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-mono text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-700 focus:bg-white focus:border-teal-500 outline-none"
                                            >
                                                {CATEGORIES.map((c) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Classification Type
                                            </label>
                                            <select
                                                value={type}
                                                onChange={(e) => setType(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-700 focus:bg-white focus:border-teal-500 outline-none"
                                            >
                                                <option value="made_to_order">Made-to-Order (Configurable)</option>
                                                <option value="ready_made">Ready-Made (Batch Inventory)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Base Retail Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                required
                                                value={retailPrice}
                                                onChange={(e) => setRetailPrice(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-mono font-bold text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                                        <textarea
                                            rows="3"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Detailed description shown to customers on the self-service ordering kiosk..."
                                            className="w-full px-3.5 py-2 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Product Image URL
                                        </label>
                                        <input
                                            type="url"
                                            value={imageUrl}
                                            onChange={(e) => setImageUrl(e.target.value)}
                                            placeholder="https://example.com/clicker-photo.jpg"
                                            className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Max Order Qty Per Customer
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={maxOrderQty}
                                                onChange={(e) => setMaxOrderQty(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                                            <select
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-700 focus:bg-white focus:border-teal-500 outline-none"
                                            >
                                                <option value="active">Active (Available)</option>
                                                <option value="draft">Draft (Private)</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Storefront Visibility
                                            </label>
                                            <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isPublished}
                                                    onChange={(e) => setIsPublished(e.target.checked)}
                                                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
                                                />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    Publish to Public Kiosk
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Internal Seller Notes (Private)
                                        </label>
                                        <input
                                            type="text"
                                            value={internalNotes}
                                            onChange={(e) => setInternalNotes(e.target.value)}
                                            placeholder="Batch printing notes, printer nozzle settings, supplier contacts..."
                                            className="w-full px-3.5 py-2 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs text-gray-800 focus:bg-white focus:border-teal-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: CLICKER, BASE COLORS, CONSUMABLE SWITCHES & ICONS */}
                            {modalTab === "customization" && (
                                <div className="space-y-6">
                                    <div className="bg-purple-50/60 border border-purple-200/60 rounded-2xl p-4 text-xs text-purple-900 space-y-1">
                                        <span className="font-extrabold flex items-center gap-1.5">
                                            <Sparkles size={14} className="text-purple-600" />
                                            Advanced Clicker Customization Schema
                                        </span>
                                        <p className="text-purple-700 leading-relaxed text-[11px]">
                                            Configure letter/icon caps, base colors per slot, and mechanical switches & add-ons linked directly to your real Studio Hub inventory.
                                        </p>
                                    </div>

                                    {/* SECTION 1: CUSTOM COLORS PALETTE */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                                                    <Palette size={14} className="text-teal-600" />
                                                    Available Letter / Cap Colors ({selectedColors.length})
                                                </h4>
                                                <span className="text-[11px] text-gray-400">
                                                    Add any custom colors or import directly from your Studio Hub filament spools.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleImportColorsFromFilaments}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                                            >
                                                <Zap size={13} className="text-teal-600" />
                                                Import from Studio Hub Filaments
                                            </button>
                                        </div>

                                        {/* Color Chips List */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                            {selectedColors.map((col) => (
                                                <div
                                                    key={col.id}
                                                    className="flex items-center justify-between gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/60 text-xs"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div
                                                            className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs shrink-0"
                                                            style={{ backgroundColor: col.hex }}
                                                        />
                                                        <span className="font-semibold text-gray-800 truncate" title={col.name}>
                                                            {col.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveColor(col.id)}
                                                        className="text-gray-400 hover:text-red-600 p-0.5 rounded cursor-pointer shrink-0"
                                                        title="Remove color"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add New Color Form */}
                                        <div className="pt-2 flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={newColorHex}
                                                onChange={(e) => setNewColorHex(e.target.value)}
                                                className="w-8 h-8 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
                                                title="Choose color hex"
                                            />
                                            <input
                                                type="text"
                                                value={newColorName}
                                                onChange={(e) => setNewColorName(e.target.value)}
                                                placeholder="New color name (e.g. Silk Champagne Gold)..."
                                                className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-gray-50/50 focus:bg-white outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddColor}
                                                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                                            >
                                                + Add Color
                                            </button>
                                        </div>
                                    </div>

                                    {/* SECTION 2: CASING BASES, SLOTS & BASE COLORS */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                                                <Layers size={14} className="text-teal-600" />
                                                Casing Bases — Slots & Available Base Colors
                                            </h4>
                                            <span className="text-[11px] text-gray-400">
                                                Configure which slot counts (1 to 8 keys) and base colors are offered to customers.
                                            </span>
                                        </div>

                                        {/* Available Slots Selector */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-[11px] font-bold text-gray-700 uppercase">
                                                    Supported Slot Counts (Keys per Clicker)
                                                </label>
                                                <span className="text-[10px] text-gray-400">
                                                    Toggle supported sizes and configure base upgrade prices
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map((slot) => {
                                                    const isSelected = availableSlots.includes(slot);
                                                    return (
                                                        <button
                                                            key={slot}
                                                            type="button"
                                                            onClick={() => handleToggleSlot(slot)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                                                                isSelected
                                                                    ? "bg-teal-50 text-teal-800 border-teal-300 shadow-2xs"
                                                                    : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                                                            }`}
                                                        >
                                                            {slot}-Key Slot
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Additional Price for each Base Slot */}
                                        <div className="space-y-2 pt-2 border-t border-gray-100">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-gray-700 uppercase">
                                                    Additional Price for Each Base Slot (+₱)
                                                </label>
                                                <span className="text-[10px] text-gray-400">
                                                    Extra charge for larger clicker bases (e.g. +₱0 for 1-key, +₱25 for 2-key, etc.)
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                {availableSlots.map((slot) => {
                                                    const extra = slotPricing[slot] ?? (slot === 1 ? 0 : (slot - 1) * 25);
                                                    const totalForSlot = Number(retailPrice || 0) + Number(extra || 0);

                                                    return (
                                                        <div
                                                            key={slot}
                                                            className="p-3 rounded-2xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-teal-300 transition-all flex flex-col gap-2"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-black text-gray-900 font-mono">
                                                                    {slot}-Key Base
                                                                </span>
                                                                {Number(extra) === 0 ? (
                                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                                                        Included
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                                                        +₱{extra}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-gray-200 focus-within:border-teal-500">
                                                                <span className="text-xs font-bold text-gray-400 font-mono">+₱</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="5"
                                                                    value={slotPricing[slot] ?? ""}
                                                                    onChange={(e) => handleUpdateSlotPrice(slot, e.target.value)}
                                                                    placeholder={slot === 1 ? "0" : "25"}
                                                                    className="w-full font-mono font-bold text-xs text-gray-900 outline-none"
                                                                />
                                                            </div>

                                                            <div className="text-[10px] text-gray-400 font-medium flex items-center justify-between">
                                                                <span>Total Retail:</span>
                                                                <strong className="font-mono text-gray-800 font-bold">
                                                                    ₱{totalForSlot.toFixed(2)}
                                                                </strong>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Available Casing / Base Colors */}
                                        <div className="space-y-2 pt-1 border-t border-gray-100">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-gray-700 uppercase">
                                                    Available Base Colors ({casingBaseColors.length})
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleImportBaseColorsFromFilaments}
                                                    className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                                                >
                                                    Import from Filaments
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {casingBaseColors.map((col) => (
                                                    <div
                                                        key={col.id}
                                                        className="flex items-center justify-between gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/60 text-xs"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div
                                                                className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs shrink-0"
                                                                style={{ backgroundColor: col.hex }}
                                                            />
                                                            <span className="font-semibold text-gray-800 truncate" title={col.name}>
                                                                {col.name}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveBaseColor(col.id)}
                                                            className="text-gray-400 hover:text-red-600 p-0.5 rounded cursor-pointer shrink-0"
                                                            title="Remove color"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex items-center gap-2 pt-1">
                                                <input
                                                    type="color"
                                                    value={newBaseColorHex}
                                                    onChange={(e) => setNewBaseColorHex(e.target.value)}
                                                    className="w-8 h-8 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
                                                />
                                                <input
                                                    type="text"
                                                    value={newBaseColorName}
                                                    onChange={(e) => setNewBaseColorName(e.target.value)}
                                                    placeholder="New base color (e.g. Matte Army Green)..."
                                                    className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-gray-50/50 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddBaseColor}
                                                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                                                >
                                                    + Add Base Color
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 3: SWITCHES DIRECT FROM CONSUMABLES INVENTORY */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                                                    <Sliders size={14} className="text-teal-600" />
                                                    Mechanical Switches — Direct from Consumables Inventory
                                                </h4>
                                                <span className="text-[11px] text-gray-400">
                                                    Select which switches from your Studio Hub stock are offered, with live unit cost reference.
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                                                {selectedConsumableSwitches.length} Selected
                                            </span>
                                        </div>

                                        {consumables.length === 0 ? (
                                            <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs">
                                                No consumables found in Studio Hub. Add mechanical switches in Studio Hub Consumables to link them directly here.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
                                                {consumables.map((cons) => {
                                                    const selected = selectedConsumableSwitches.find(
                                                        (s) => s.consumableId === cons.id
                                                    );
                                                    return (
                                                        <div
                                                            key={cons.id}
                                                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                                                                selected
                                                                    ? "bg-teal-50/40 border-teal-300"
                                                                    : "bg-gray-50/50 border-gray-200 hover:bg-gray-50"
                                                            }`}
                                                        >
                                                            <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!selected}
                                                                    onChange={() => handleToggleConsumableSwitch(cons)}
                                                                    className="w-4 h-4 rounded text-teal-600 border-gray-300"
                                                                />
                                                                <div className="truncate">
                                                                    <span className="font-bold text-gray-900 block truncate">
                                                                        {cons.name}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-500 font-mono">
                                                                        Stock: {cons.quantity || 0} {cons.unit_of_measure || "pcs"} · Cost: ₱{(cons.unit_cost || 0).toFixed(2)}/pc
                                                                    </span>
                                                                </div>
                                                            </label>

                                                            {selected && (
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="text-[11px] font-bold text-gray-600">Upgrade Price:</span>
                                                                    <div className="flex items-center">
                                                                        <span className="text-xs text-gray-500 mr-0.5">₱</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="5"
                                                                            value={selected.extraPrice}
                                                                            onChange={(e) =>
                                                                                handleUpdateSwitchPrice(cons.id, e.target.value)
                                                                            }
                                                                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 bg-white font-mono font-bold text-xs text-gray-900"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 4: ADD-ONS DIRECT FROM CONSUMABLES INVENTORY */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                                                    <Tag size={14} className="text-teal-600" />
                                                    Add-ons & Hardware Attachments — Direct from Consumables
                                                </h4>
                                                <span className="text-[11px] text-gray-400">
                                                    Keyrings, lobster clasps, beaded ball chains, gift boxes from your inventory.
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                                                {selectedConsumableAddons.length} Selected
                                            </span>
                                        </div>

                                        <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
                                            {consumables.map((cons) => {
                                                const selected = selectedConsumableAddons.find(
                                                    (a) => a.consumableId === cons.id
                                                );
                                                return (
                                                    <div
                                                        key={cons.id}
                                                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                                                            selected
                                                                ? "bg-teal-50/40 border-teal-300"
                                                                : "bg-gray-50/50 border-gray-200 hover:bg-gray-50"
                                                        }`}
                                                    >
                                                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!selected}
                                                                onChange={() => handleToggleConsumableAddon(cons)}
                                                                className="w-4 h-4 rounded text-teal-600 border-gray-300"
                                                            />
                                                            <div className="truncate">
                                                                <span className="font-bold text-gray-900 block truncate">
                                                                    {cons.name}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 font-mono">
                                                                    Stock: {cons.quantity || 0} {cons.unit_of_measure || "pcs"} · Cost: ₱{(cons.unit_cost || 0).toFixed(2)}/pc
                                                                </span>
                                                            </div>
                                                        </label>

                                                        {selected && (
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className="text-[11px] font-bold text-gray-600">Retail Price:</span>
                                                                <div className="flex items-center">
                                                                    <span className="text-xs text-gray-500 mr-0.5">₱</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="5"
                                                                        value={selected.price}
                                                                        onChange={(e) =>
                                                                            handleUpdateAddonPrice(cons.id, e.target.value)
                                                                        }
                                                                        className="w-16 px-2 py-1 rounded-lg border border-gray-200 bg-white font-mono font-bold text-xs text-gray-900"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* SECTION 5: ICON KEYCAPS */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                                                    <Heart size={14} className="text-purple-600" />
                                                    Icon Keycaps (Embossed & Graphic Caps)
                                                </h4>
                                                <span className="text-[11px] text-gray-400">
                                                    Allow customers to choose special icon caps (hearts, gaming, paws, stars) with available colors.
                                                </span>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={enableIconKeycaps}
                                                    onChange={(e) => setEnableIconKeycaps(e.target.checked)}
                                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300"
                                                />
                                                <span className="text-xs font-bold text-gray-800">
                                                    Enable Icons
                                                </span>
                                            </label>
                                        </div>

                                        {enableIconKeycaps && (
                                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[11px] font-bold text-gray-700 uppercase">
                                                        Select Enabled Icons ({selectedIcons.length})
                                                    </label>
                                                    <div className="flex items-center gap-1 text-[11px]">
                                                        <span className="text-gray-500">Surcharge per icon: ₱</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="5"
                                                            value={iconCapSurcharge}
                                                            onChange={(e) => setIconCapSurcharge(e.target.value)}
                                                            className="w-14 px-1.5 py-0.5 rounded border border-gray-200 font-mono text-xs text-center"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                    {AVAILABLE_ICONS.map((ic) => {
                                                        const isSelected = selectedIcons.includes(ic.id);
                                                        return (
                                                            <button
                                                                key={ic.id}
                                                                type="button"
                                                                onClick={() => handleToggleIcon(ic.id)}
                                                                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                                                    isSelected
                                                                        ? "bg-purple-50/60 border-purple-300 text-purple-900 shadow-2xs"
                                                                        : "bg-gray-50/50 border-gray-200 text-gray-400 hover:border-gray-300"
                                                                }`}
                                                            >
                                                                <span className="text-lg">{ic.emoji}</span>
                                                                <span className="text-[10px] font-bold truncate">{ic.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: VARIANTS & STOCK (Ready-Made) */}
                            {modalTab === "variants" && (
                                <div className="space-y-4">
                                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                                        <span className="font-extrabold flex items-center gap-1.5">
                                            <Layers size={14} className="text-amber-600" />
                                            Ready-Made Finished Goods
                                        </span>
                                        <p className="text-amber-700 leading-relaxed text-[11px]">
                                            Pre-manufactured products do not require print jobs when purchased. Manage on-hand stock and individual variant SKUs.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {readyVariants.map((v, idx) => (
                                            <div
                                                key={v.id || idx}
                                                className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-gray-800">
                                                        Variant #{idx + 1}
                                                    </span>
                                                    {readyVariants.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setReadyVariants(readyVariants.filter((_, i) => i !== idx))
                                                            }
                                                            className="text-xs text-red-600 hover:text-red-800 font-bold cursor-pointer"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Color</label>
                                                        <input
                                                            type="text"
                                                            value={v.color}
                                                            onChange={(e) => {
                                                                const updated = [...readyVariants];
                                                                updated[idx].color = e.target.value;
                                                                setReadyVariants(updated);
                                                            }}
                                                            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Style</label>
                                                        <input
                                                            type="text"
                                                            value={v.style}
                                                            onChange={(e) => {
                                                                const updated = [...readyVariants];
                                                                updated[idx].style = e.target.value;
                                                                setReadyVariants(updated);
                                                            }}
                                                            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">On-Hand Stock</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={v.on_hand}
                                                            onChange={(e) => {
                                                                const updated = [...readyVariants];
                                                                updated[idx].on_hand = Number(e.target.value);
                                                                setReadyVariants(updated);
                                                            }}
                                                            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Low Alert Threshold</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={v.low_threshold}
                                                            onChange={(e) => {
                                                                const updated = [...readyVariants];
                                                                updated[idx].low_threshold = Number(e.target.value);
                                                                setReadyVariants(updated);
                                                            }}
                                                            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white font-mono"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setReadyVariants([
                                                    ...readyVariants,
                                                    {
                                                        id: `v_${Date.now()}`,
                                                        color: "Pastel Pink",
                                                        style: "Standard",
                                                        sku: "",
                                                        on_hand: 5,
                                                        unit_cost: 45,
                                                        price: retailPrice,
                                                        low_threshold: 3,
                                                    },
                                                ])
                                            }
                                            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                                        >
                                            + Add Variant
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: STUDIO HUB COSTING INTEGRATION */}
                            {modalTab === "costing" && (
                                <div className="space-y-5">
                                    <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
                                        <span className="font-extrabold flex items-center gap-1.5">
                                            <LinkIcon size={14} className="text-emerald-600" />
                                            Studio Hub Consumables & Filaments Integration
                                        </span>
                                        <p className="text-emerald-700 leading-relaxed text-[11px]">
                                            Link your product to existing Studio Hub filaments (<code className="font-mono">users/{currentUser?.uid}/filaments</code>) and consumables (<code className="font-mono">users/{currentUser?.uid}/consumables</code>) for accurate production cost calculation.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Linked Filament (PLA/PETG Spool for Material Cost Reference)
                                        </label>
                                        <select
                                            value={linkedFilamentId}
                                            onChange={(e) => setLinkedFilamentId(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-700 focus:bg-white outline-none"
                                        >
                                            <option value="">-- Auto-match from Filament Library --</option>
                                            {filaments.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name} ({f.brand} {f.material}) — ₱{(f.cost_per_gram || 1).toFixed(2)}/g
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Live BOM & Margin Cost Breakdown Card */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                        <span className="text-xs font-black text-gray-900 block">
                                            Live Unit Cost & Profit Margin Estimate (Sample 3-Key Clicker)
                                        </span>

                                        <div className="space-y-1.5 text-xs">
                                            {liveCostCalculation.bomCost.items.map((it, idx) => (
                                                <div
                                                    key={it.component_key || idx}
                                                    className="flex items-center justify-between text-gray-600 py-1 border-b border-gray-50 text-[11px]"
                                                >
                                                    <div>
                                                        <span className="font-semibold text-gray-800">{it.name}</span>
                                                        <span className="text-[10px] text-gray-400 ml-1.5 font-mono">
                                                            ({it.matchedSource})
                                                        </span>
                                                    </div>
                                                    <span className="font-mono font-bold text-gray-800">
                                                        ₱{it.lineTotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-2 border-t border-gray-100 grid grid-cols-3 gap-3 text-center bg-gray-50 p-3 rounded-xl">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total BOM Cost</span>
                                                <span className="text-sm font-black text-gray-900 font-mono">
                                                    ₱{liveCostCalculation.bomCost.totalCost.toFixed(2)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Gross Profit</span>
                                                <span className="text-sm font-black text-emerald-600 font-mono">
                                                    ₱{liveCostCalculation.margin.grossProfit.toFixed(2)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Profit Margin</span>
                                                <span className="text-sm font-black text-emerald-600 font-mono">
                                                    {liveCostCalculation.margin.marginPercent}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="px-5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        editingProduct ? "Update Product" : "Save Product"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STOREFRONT PREVIEW MODAL */}
            {previewProduct && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">
                                    Customer View Preview
                                </span>
                                <h3 className="text-sm font-black text-gray-900">
                                    Sanitized Public Storefront Card
                                </h3>
                            </div>
                            <button
                                onClick={() => setPreviewProduct(null)}
                                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Customer Portal Card Simulation */}
                        <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs space-y-4 p-4">
                            <div className="w-full h-40 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                                {previewProduct.images?.[0] ? (
                                    <img
                                        src={previewProduct.images[0]}
                                        alt={previewProduct.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package size={36} className="text-gray-300" />
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-teal-700 uppercase bg-teal-50 px-2 py-0.5 rounded-md">
                                        {previewProduct.category}
                                    </span>
                                    <span className="text-base font-black text-gray-900 font-mono">
                                        ₱{previewProduct.retailPrice?.toFixed(2)}
                                    </span>
                                </div>
                                <h4 className="text-base font-black text-gray-900 mt-1">
                                    {previewProduct.name}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    {previewProduct.description || "Custom 3D printed item."}
                                </p>
                            </div>

                            {/* Customer Options Simulator */}
                            {previewProduct.type === "made_to_order" && (
                                <div className="space-y-3 pt-3 border-t border-gray-100 text-xs">
                                    <div className="space-y-1">
                                        <span className="font-bold text-gray-700 text-[11px]">Personalized Text / Letters:</span>
                                        <input
                                            type="text"
                                            readOnly
                                            value="KEN"
                                            className="w-full px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-mono font-bold text-gray-800"
                                        />
                                    </div>

                                    {/* Base Colors Preview */}
                                    <div className="space-y-1">
                                        <span className="font-bold text-gray-700 text-[11px]">Available Base Colors:</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {(previewProduct.customizationOptions?.base_colors || DEFAULT_BASE_COLORS).slice(0, 4).map((c) => (
                                                <div
                                                    key={c.id || c.name}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-[10px] text-gray-700"
                                                >
                                                    <div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: c.hex }} />
                                                    <span>{c.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cap Colors Preview */}
                                    <div className="space-y-1">
                                        <span className="font-bold text-gray-700 text-[11px]">Letter / Icon Colors:</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {(previewProduct.customizationOptions?.colors || DEFAULT_CLICKER_COLORS).slice(0, 6).map((c) => (
                                                <div
                                                    key={c.id || c.name}
                                                    className="w-5 h-5 rounded-full border-2 border-white shadow-2xs"
                                                    style={{ backgroundColor: c.hex }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                                <span>Max order: {previewProduct.maxOrderQty || 5} units</span>
                                <span className="text-emerald-600 font-bold">✓ Available for Order</span>
                            </div>
                        </div>

                        {/* Security check note */}
                        <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200/50 text-[11px] text-teal-900 flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-teal-600 shrink-0" />
                            <span>
                                Verified: No internal BOM costs, profit margins, or supplier records are exposed on the public storefront.
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </BazaarLayout>
    );
}
