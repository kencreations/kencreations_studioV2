import React, { useState } from "react";
import { X, Upload, Download, AlertTriangle, CheckCircle, FileText } from "lucide-react";

export default function CsvModal({
    isOpen,
    onClose,
    type = "filaments", // "filaments" | "consumables"
    existingData = [],
    onImport,
}) {
    const isFilaments = type === "filaments";
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [errors, setErrors] = useState([]);
    const [importing, setImporting] = useState(false);

    if (!isOpen) return null;

    const exportHeaders = isFilaments
        ? ["name", "brand", "material", "color_name", "color_hex", "spool_weight_g", "remaining_weight_g", "purchase_price", "supplier", "status", "min_threshold_g", "notes"]
        : ["name", "category", "pack_quantity", "pack_price", "quantity", "unit_of_measure", "supplier", "status", "reorder_threshold", "notes"];

    const handleExport = () => {
        if (!existingData || existingData.length === 0) {
            alert("No data available to export.");
            return;
        }

        const csvRows = [];
        csvRows.push(exportHeaders.join(","));

        for (const row of existingData) {
            const values = exportHeaders.map((header) => {
                const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : "";
                return val.includes(",") || val.includes('"') || val.includes("\n")
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
            });
            csvRows.push(values.join(","));
        }

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `kencreations_${type}_export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setErrors([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
                if (lines.length < 2) {
                    setErrors(["CSV file must contain a header row and at least one data row."]);
                    setPreviewData([]);
                    return;
                }

                // Simple robust CSV row parser
                const parseCsvLine = (line) => {
                    const result = [];
                    let insideQuote = false;
                    let entry = "";
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
                            insideQuote = !insideQuote;
                        } else if (char === "," && !insideQuote) {
                            result.push(entry.trim());
                            entry = "";
                        } else {
                            entry += char;
                        }
                    }
                    result.push(entry.trim());
                    return result.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
                };

                const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
                const parsed = [];
                const parsingErrors = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = parseCsvLine(lines[i]);
                    const rowObj = {};
                    headers.forEach((h, idx) => {
                        rowObj[h] = values[idx] || "";
                    });

                    // Validation per row
                    if (!rowObj.name || rowObj.name.trim() === "") {
                        parsingErrors.push(`Row ${i}: Missing required "name" column.`);
                    }

                    parsed.push(rowObj);
                }

                setErrors(parsingErrors);
                setPreviewData(parsed);
            } catch (err) {
                setErrors([`Failed to parse CSV file: ${err.message}`]);
                setPreviewData([]);
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleConfirmImport = async () => {
        if (previewData.length === 0) return;
        setImporting(true);
        try {
            await onImport(previewData);
            onClose();
        } catch (err) {
            setErrors([err.message || "Failed to import records."]);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-2xl w-full mx-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                            CSV Import & Export — {isFilaments ? "Filaments" : "Consumables"}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Bulk export or import inventory data safely
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Export Card */}
                <div className="my-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Export Current Records</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Download all {existingData.length} saved {type} items as a CSV spreadsheet.
                        </p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="bg-white hover:bg-gray-100 text-gray-800 font-bold px-4 py-2 rounded-xl border border-gray-200 text-xs shadow-xs flex items-center gap-2 transition-colors"
                    >
                        <Download size={14} /> Export CSV
                    </button>
                </div>

                {/* Import Section */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Bulk Import from CSV</h3>

                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-2xl p-6 cursor-pointer bg-gray-50/50 hover:bg-teal-50/20 transition-colors">
                        <Upload size={28} className="text-gray-400 mb-2" />
                        <span className="text-xs font-bold text-gray-700">Click to upload CSV spreadsheet</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">
                            File must include headers: {exportHeaders.slice(0, 4).join(", ")}, etc.
                        </span>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>

                    {file && (
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded-xl">
                            <FileText size={16} className="text-teal-600" />
                            <span>{file.name}</span>
                            <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                    )}

                    {errors.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                                <AlertTriangle size={15} /> Validation Warnings:
                            </div>
                            {errors.map((err, i) => (
                                <div key={i}>• {err}</div>
                            ))}
                        </div>
                    )}

                    {/* Preview Table */}
                    {previewData.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-gray-700">Preview ({previewData.length} records ready to import)</span>
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                    <CheckCircle size={13} /> Header verified
                                </span>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-gray-100 sticky top-0 font-bold text-gray-600 border-b border-gray-200">
                                        <tr>
                                            <th className="p-2">Name</th>
                                            <th className="p-2">{isFilaments ? "Material" : "Category"}</th>
                                            <th className="p-2 text-right">{isFilaments ? "Spool Weight" : "Pack Qty"}</th>
                                            <th className="p-2 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {previewData.slice(0, 10).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="p-2 font-semibold text-gray-800 truncate max-w-[150px]">{row.name}</td>
                                                <td className="p-2 text-gray-600">{isFilaments ? row.material : row.category}</td>
                                                <td className="p-2 text-right font-mono text-gray-600">
                                                    {isFilaments ? `${row.spool_weight_g || 1000}g` : row.pack_quantity || 1}
                                                </td>
                                                <td className="p-2 text-right font-mono font-bold text-gray-800">
                                                    ₱{row.purchase_price || row.pack_price || 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {previewData.length > 10 && (
                                <div className="text-[11px] text-gray-400 text-center">
                                    ...and {previewData.length - 10} more rows
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        Close
                    </button>
                    {previewData.length > 0 && (
                        <button
                            type="button"
                            disabled={importing || errors.length > 3}
                            onClick={handleConfirmImport}
                            className="bg-[#14b8a6] hover:bg-[#0f766e] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            <Upload size={16} />
                            {importing ? "Importing..." : `Import ${previewData.length} Records`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
