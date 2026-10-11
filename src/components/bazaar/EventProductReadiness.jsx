import { useState } from 'react';
import { clickerOptions } from '../../engine/bazaar/configuration.js';
import { decomposeProductBOM } from '../../engine/bazaar/bom.js';
import { stockReadiness } from '../../engine/bazaar/stockAvailability.js';
import { CheckCircle2, AlertTriangle, AlertCircle, Layers, ChevronDown } from 'lucide-react';

export default function EventProductReadiness({ product, inventory, allocation }) {
    const schema = clickerOptions(product);
    const [choices, setChoices] = useState({});
    const [quantity, setQuantity] = useState(1);

    const count = choices.slots ?? schema.available_slots[0] ?? 1;
    const configuration = {
        slots: count,
        casing_color: choices.casing_color ?? schema.casing_base_colors[0]?.id ?? '',
        casing_style_id: choices.casing_style_id ?? schema.casing_styles[0]?.id ?? '',
        selected_add_on_ids: choices.addons || [],
        selected_variant_id: choices.variant ?? product.variants?.[0]?.id ?? '',
        slotsData: Array.from({ length: count }, (_, i) => ({
            type: 'letter',
            char: schema.allowed_characters?.[0] || 'A',
            colorId: schema.colors[0]?.id || '',
            styleId: schema.keycap_styles[0]?.id || '',
            switchId: schema.allowed_switch_types[0]?.id || '',
            ...choices.keys?.[i],
        })),
    };

    let result, error;
    try {
        result = stockReadiness(
            decomposeProductBOM({ product, customization: configuration, quantity }),
            inventory,
            allocation
        );
    } catch (e) {
        error = e.message;
    }

    const status = error ? 'Missing Components' : (result?.status || 'Missing Components');

    const badgeConfig = {
        'Ready to Sell': {
            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            icon: CheckCircle2,
        },
        'Limited Stock': {
            bg: 'bg-amber-50 text-amber-700 border-amber-200',
            icon: AlertTriangle,
        },
        'Missing Components': {
            bg: 'bg-red-50 text-red-700 border-red-200',
            icon: AlertCircle,
        },
        'Not Allocated': {
            bg: 'bg-purple-50 text-purple-700 border-purple-200',
            icon: Layers,
        },
    }[status] || {
        bg: 'bg-gray-50 text-gray-700 border-gray-200',
        icon: AlertCircle,
    };

    const StatusIcon = badgeConfig.icon;

    const change = (key, value) => setChoices({ ...choices, [key]: value });
    const keyChange = (index, key, value) =>
        setChoices({
            ...choices,
            keys: {
                ...choices.keys,
                [index]: { ...configuration.slotsData[index], [key]: value },
            },
        });

    const select = (label, options, value, onChange) => (
        <label className="text-xs font-bold text-gray-700 block">
            <span className="text-[10px] text-gray-400 block uppercase">{label}</span>
            <select
                className="mt-0.5 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white block w-full outline-none focus:ring-1 focus:ring-teal-500"
                aria-label={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((o) => (
                    <option key={o.id} value={o.id}>
                        {o.name || o.label || o.id}
                    </option>
                ))}
            </select>
        </label>
    );

    return (
        <details className="mt-1.5 font-normal text-xs group">
            <summary className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold cursor-pointer list-none select-none transition-all hover:opacity-90 shadow-2xs">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border ${badgeConfig.bg}`}>
                    <StatusIcon size={11} />
                    <span>{status}</span>
                </span>
                <span className="text-gray-400 font-semibold group-open:hidden">
                    {result?.capacity != null && result.capacity > 0 ? `(${result.capacity} buildable)` : ''} · Details
                </span>
            </summary>

            <div className="mt-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2.5 text-xs text-gray-700">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                    <span className="text-[11px] font-bold text-gray-500">
                        Booth Stock Readiness Check
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold">
                        <span>Quantity:</span>
                        <input
                            aria-label="Readiness quantity"
                            className="border border-gray-200 bg-white rounded-lg px-2 py-0.5 w-14 text-center font-bold text-xs"
                            type="number"
                            min="1"
                            max="100"
                            value={quantity}
                            onChange={(e) =>
                                setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                            }
                        />
                    </label>
                </div>

                {product.type === 'ready_made' ? (
                    product.variants?.length > 0 &&
                    select(
                        'Variant',
                        product.variants,
                        configuration.selected_variant_id,
                        (value) => change('variant', value)
                    )
                ) : (
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {select(
                                'Slot count',
                                schema.available_slots.map((n) => ({ id: String(n), name: `${n} slots` })),
                                String(count),
                                (value) => change('slots', Number(value))
                            )}
                            {select(
                                'Base color',
                                schema.casing_base_colors,
                                configuration.casing_color,
                                (value) => change('casing_color', value)
                            )}
                            {schema.casing_styles.length > 0 &&
                                select(
                                    'Casing style',
                                    schema.casing_styles,
                                    configuration.casing_style_id,
                                    (value) => change('casing_style_id', value)
                                )}
                        </div>

                        {configuration.slotsData.map((slot, index) => (
                            <div key={index} className="p-2 rounded-xl bg-white border border-gray-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {select(
                                    `Key ${index + 1} type`,
                                    [
                                        { id: 'letter', name: 'Letter' },
                                        { id: 'icon', name: 'Icon' },
                                    ],
                                    slot.type,
                                    (value) => keyChange(index, 'type', value)
                                )}
                                {slot.type === 'icon' ? (
                                    select(
                                        `Key ${index + 1} icon`,
                                        [{ id: '', name: 'Choose icon' }, ...schema.available_icons],
                                        slot.iconId || '',
                                        (value) => keyChange(index, 'iconId', value)
                                    )
                                ) : (
                                    <>
                                        {select(
                                            `Key ${index + 1} letter`,
                                            Array.from(schema.allowed_characters || '').map((char) => ({
                                                id: char,
                                                name: char,
                                            })),
                                            slot.char,
                                            (value) => keyChange(index, 'char', value)
                                        )}
                                        {select(
                                            `Key ${index + 1} color`,
                                            schema.colors,
                                            slot.colorId,
                                            (value) => keyChange(index, 'colorId', value)
                                        )}
                                    </>
                                )}
                                {schema.allowed_switch_types.length > 0 &&
                                    select(
                                        `Key ${index + 1} switch`,
                                        schema.allowed_switch_types,
                                        slot.switchId,
                                        (value) => keyChange(index, 'switchId', value)
                                    )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Component Breakdown List */}
                <div className="pt-2 border-t border-gray-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Required BOM Components & Availability:
                    </span>
                    {error ? (
                        <p role="alert" className="text-red-600 font-bold text-xs">{error}</p>
                    ) : (
                        <div className="space-y-1">
                            {result.components.map((part) => (
                                <div
                                    key={part.component_key}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center justify-between ${
                                        part.sufficient
                                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-100'
                                            : 'bg-red-50 text-red-900 border border-red-100'
                                    }`}
                                >
                                    <div>
                                        <span className="font-bold">{part.name || part.component_key}</span>{' '}
                                        <span className="text-[10px] font-mono opacity-70">[{part.component_key}]</span>
                                    </div>
                                    <div className="text-right">
                                        <span>Need: <strong>{part.required_qty}</strong></span> ·{' '}
                                        <span>Booth Available: <strong>{Math.max(0, part.available)}</strong></span>
                                        {!part.exists && (
                                            <span className="text-red-600 font-bold ml-1">(Missing from inventory)</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </details>
    );
}
