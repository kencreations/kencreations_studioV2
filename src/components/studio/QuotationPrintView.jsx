import React from "react";
import { Printer, X } from "lucide-react";

export default function QuotationPrintView({ quote, onClose }) {
    if (!quote) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8 flex justify-center items-start">
            {/* Screen Controls (hidden when printing) */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-3 print:hidden">
                <button
                    onClick={handlePrint}
                    className="bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm transition-all"
                >
                    <Printer size={16} /> Print / Save as PDF
                </button>
                <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-white text-gray-700 hover:bg-gray-100 flex items-center justify-center shadow-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Printable Paper Canvas (A4 / Letter styling) */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-3xl w-full my-8 print:my-0 print:p-8 print:shadow-none print:rounded-none text-gray-900">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-8">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-gray-900 tracking-tight">KenCreations</span>
                            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                3D STUDIO
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Custom 3D Printing & Additive Manufacturing Services</p>
                        <p className="text-xs text-gray-400">Official Customer Quotation</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-mono font-black text-teal-700">{quote.quote_number}</span>
                        <div className="text-xs text-gray-500 mt-1">
                            Status: <span className="font-bold uppercase text-gray-800">{quote.status}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            Valid Until: <span className="font-semibold text-gray-700">{quote.valid_until}</span>
                        </div>
                    </div>
                </div>

                {/* Client & Date Details */}
                <div className="grid grid-cols-2 gap-8 my-8">
                    <div>
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Prepared For</h4>
                        <div className="text-base font-bold text-gray-900">{quote.customer_name}</div>
                        {quote.customer_email && <div className="text-xs text-gray-600 mt-0.5">{quote.customer_email}</div>}
                        {quote.customer_phone && <div className="text-xs text-gray-600 mt-0.5">{quote.customer_phone}</div>}
                    </div>
                    <div className="text-right">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Date Issued</h4>
                        <div className="text-sm font-semibold text-gray-800">
                            {quote.created_at?.toDate ? quote.created_at.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto my-6">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-200 text-[11px] font-black uppercase text-gray-500 tracking-wider">
                                <th className="py-3 px-2">#</th>
                                <th className="py-3 px-4">Item Description</th>
                                <th className="py-3 px-4 text-center">Qty</th>
                                <th className="py-3 px-4 text-right">Unit Price</th>
                                <th className="py-3 px-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {(quote.items || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="py-3 px-2 font-mono text-gray-400 text-xs">{idx + 1}</td>
                                    <td className="py-3 px-4 font-semibold text-gray-800">{item.description}</td>
                                    <td className="py-3 px-4 text-center font-mono font-medium">{item.quantity}</td>
                                    <td className="py-3 px-4 text-right font-mono">₱{(Number(item.unit_price) || 0).toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                                        ₱{(Number(item.total) || (Number(item.quantity) * Number(item.unit_price)) || 0).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals Summary */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                    <div className="w-64 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal:</span>
                            <span className="font-mono">₱{(Number(quote.subtotal) || 0).toFixed(2)}</span>
                        </div>
                        {quote.discount_amount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                                <span>Discount ({quote.discount_percent}%):</span>
                                <span className="font-mono">-₱{(Number(quote.discount_amount) || 0).toFixed(2)}</span>
                            </div>
                        )}
                        {quote.shipping_fee > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>Shipping / Delivery:</span>
                                <span className="font-mono">₱{(Number(quote.shipping_fee) || 0).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                            <span>Grand Total:</span>
                            <span className="font-mono text-teal-700">₱{(Number(quote.total_price) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Terms and Notes */}
                {quote.notes && (
                    <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notes & Terms</h5>
                        <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{quote.notes}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
                    Thank you for partnering with KenCreations Studio. For inquiries, contact us directly.
                </div>
            </div>
        </div>
    );
}
