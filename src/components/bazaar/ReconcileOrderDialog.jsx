import { useEffect, useState, useMemo } from 'react';
import { getShopInventory, getEventStockState } from '../../services/bazaarService.js';
import { reconcileSellerOrder, checkoutAvailability } from '../../services/orderSubmissionService.js';
import { stockReadiness } from '../../engine/bazaar/stockAvailability.js';
import { decomposeProductBOM } from '../../engine/bazaar/bom.js';
import { AlertCircle, CheckCircle2, ShieldCheck, X, RefreshCw } from 'lucide-react';

export default function ReconcileOrderDialog({ uid, order, onClose, onSaved }) {
    const [inventory, setInventory] = useState([]);
    const [allocation, setAllocation] = useState(order.eventId ? {} : null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');
    const [reason, setReason] = useState('Audited legacy order inventory references to match verified active inventory items.');
    const [confirmed, setConfirmed] = useState(false);
    const [saving, setSaving] = useState(false);

    // Derive required parts from saved requiredBOM or fallback to decomposeProductBOM
    const parts = useMemo(() => {
        return (order.items || []).flatMap((item, itemIndex) => {
            let itemBOM = item.requiredBOM;
            if (!itemBOM || !itemBOM.length) {
                try {
                    itemBOM = decomposeProductBOM({
                        product: item,
                        customization: item.customization,
                        quantity: item.quantity,
                    });
                } catch {
                    itemBOM = [];
                }
            }
            return (itemBOM || []).map((part, partIndex) => ({
                ...part,
                itemIndex,
                partIndex,
            }));
        });
    }, [order.items]);

    const [mappings, setMappings] = useState(() =>
        parts.map((p) => ({
            itemIndex: p.itemIndex,
            partIndex: p.partIndex,
            component_key: p.component_key || '',
        }))
    );

    // Re-initialize mappings if parts change
    useEffect(() => {
        setMappings(
            parts.map((p) => ({
                itemIndex: p.itemIndex,
                partIndex: p.partIndex,
                component_key: p.component_key || '',
            }))
        );
    }, [parts]);

    useEffect(() => {
        let active = true;
        Promise.all([
            getShopInventory(uid),
            order.eventId ? getEventStockState(uid, order.eventId) : null,
        ])
            .then(([items, state]) => {
                if (active) {
                    setInventory(items || []);
                    setAllocation(state);
                    setLoaded(true);
                }
            })
            .catch((e) => {
                if (active) setError(e.message);
            });
        return () => {
            active = false;
        };
    }, [uid, order.eventId]);

    const mappedParts = useMemo(() => {
        return parts.map((p, i) => ({
            ...p,
            component_key: mappings[i]?.component_key || p.component_key || '',
        }));
    }, [parts, mappings]);

    const readiness = useMemo(() => {
        return stockReadiness(mappedParts, inventory, allocation);
    }, [mappedParts, inventory, allocation]);

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            await reconcileSellerOrder(uid, order.orderId || order.id, {
                expectedUpdatedAt: order.updatedAt?.toMillis?.() ?? order.updatedAt ?? null,
                mappings,
                reason: reason.trim(),
                confirmed,
            });
            onSaved();
        } catch (e) {
            setError(e.message || 'Failed to save reconciled inventory mapping.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Review legacy inventory"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-150"
        >
            <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 border border-gray-100 shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 block">
                            Seller Inventory Audit
                        </span>
                        <h3 className="text-base font-black text-gray-900">
                            Reconcile Order {order.orderNumber || order.orderId}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                    This order contains legacy or unmapped inventory component IDs. Map each required component to an active stock item in your inventory. Once saved, an audited mapping record will be created and this order can proceed through acceptance.
                </p>

                {/* Original Items Summary */}
                <div className="space-y-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        Original Order Items:
                    </span>
                    {(order.items || []).map((item, index) => (
                        <div
                            key={index}
                            className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1.5"
                        >
                            <div className="flex items-center justify-between font-bold text-gray-900">
                                <span>{item.productName || 'Custom Product'}</span>
                                <span className="font-mono">Qty: {item.quantity}</span>
                            </div>
                            {item.customization && (
                                <p className="text-[11px] text-gray-500">
                                    Text: <strong>{item.customization.text || 'N/A'}</strong> · Casing:{' '}
                                    <strong>{item.customization.casingColor?.name || item.customization.casing_color || 'Standard'}</strong>
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {!parts.length && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-600 shrink-0" />
                        <span>No component requirements derived for this order. Please inspect manually.</span>
                    </div>
                )}

                {/* Component Mappings */}
                {parts.length > 0 && (
                    <div className="space-y-2.5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                            Verify Component Inventory Mappings:
                        </span>
                        {parts.map((part, index) => {
                            const currentKey = mappings[index]?.component_key || '';
                            const matchedItem = inventory.find((it) => it.item_key === currentKey);

                            return (
                                <div
                                    key={index}
                                    className="p-3.5 rounded-2xl border border-gray-200 bg-white space-y-2"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-gray-800">
                                            Component #{index + 1}: {part.name || part.component_key || '(Missing SKU)'}
                                        </span>
                                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-bold">
                                            Required: {part.required_qty}
                                        </span>
                                    </div>

                                    <select
                                        aria-label={`Map component ${index + 1}`}
                                        value={currentKey}
                                        onChange={(e) =>
                                            setMappings(
                                                mappings.map((m, i) =>
                                                    i === index ? { ...m, component_key: e.target.value } : m
                                                )
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                                    >
                                        <option value="">-- Choose active matching inventory item --</option>
                                        {inventory.map((item) => (
                                            <option key={item.item_key} value={item.item_key}>
                                                {item.name || item.item_key} [{item.item_key}] (On-hand: {item.on_hand || item.physical_on_hand || 0})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Readiness summary */}
                <div className="space-y-1">
                    {readiness.components.map((p) => (
                        <div
                            key={p.component_key}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between ${
                                p.sufficient
                                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-100'
                                    : 'bg-red-50 text-red-900 border border-red-100'
                            }`}
                        >
                            <span>
                                <strong>{p.name || p.component_key}</strong>: Need {p.required_qty}
                            </span>
                            <span>
                                {allocation ? 'Booth' : 'Workshop'} Available: <strong>{Math.max(0, p.available)}</strong>
                            </span>
                        </div>
                    ))}
                </div>

                {/* Audit Reason */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                        Audit & Reconciliation Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        rows={2}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Explain the reason for mapping adjustment..."
                    />
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-teal-50/60 border border-teal-200/60 text-xs text-teal-950 font-semibold cursor-pointer">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-teal-600 rounded-md border-gray-300 focus:ring-teal-500 cursor-pointer shrink-0"
                    />
                    <span>
                        I verified that these mapped components match the customer's original configuration and that no stock was already duplicated or consumed.
                    </span>
                </label>

                {error && (
                    <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={
                            !loaded ||
                            saving ||
                            !confirmed ||
                            !reason.trim() ||
                            !readiness.ready ||
                            mappings.some((m) => !m.component_key)
                        }
                        onClick={handleSave}
                        className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Saving Mapping...</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={14} />
                                <span>Save Verified Mapping</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
