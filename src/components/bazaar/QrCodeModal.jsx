import { useState, useMemo } from "react";
import qrcode from "qrcode-generator";
import {
    QrCode,
    X,
    Copy,
    Check,
    Download,
    Printer,
    Sparkles,
} from "lucide-react";

export default function QrCodeModal({
    isOpen,
    onClose,
    title = "Storefront QR Code",
    subtitle = "Customers can scan this code from their mobile devices to place orders.",
    url = "",
    badgeText = "",
    pickupInstructions = "",
    shopName = "KenCreations Studio",
}) {
    const [copied, setCopied] = useState(false);

    // Generate real QR code representation
    const qrSvg = useMemo(() => {
        if (!url) return "";
        try {
            const qr = qrcode(0, "M");
            qr.addData(url);
            qr.make();
            return qr.createSvgTag({
                cellSize: 8,
                margin: 4,
                scalable: true,
            });
        } catch (err) {
            console.error("QR Code generation error:", err);
            return "";
        }
    }, [url]);

    // Handle Copy to Clipboard
    const handleCopy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Handle Download PNG
    const handleDownloadPng = () => {
        if (!url) return;
        try {
            const qr = qrcode(0, "M");
            qr.addData(url);
            qr.make();
            const count = qr.getModuleCount();
            const cellSize = 16;
            const margin = 32;
            const size = count * cellSize + margin * 2;

            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size + 60; // Extra room for label
            const ctx = canvas.getContext("2d");

            // Background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw QR modules
            ctx.fillStyle = "#0f172a";
            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (qr.isDark(r, c)) {
                        ctx.fillRect(
                            margin + c * cellSize,
                            margin + r * cellSize,
                            cellSize,
                            cellSize
                        );
                    }
                }
            }

            // Draw Bottom Label
            ctx.fillStyle = "#64748b";
            ctx.font = "bold 16px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(shopName, size / 2, size + 24);
            ctx.fillStyle = "#0d9488";
            ctx.font = "12px Inter, sans-serif";
            ctx.fillText("Scan to Order", size / 2, size + 44);

            const dataUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `qr-${(title || "bazaar").toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
            a.click();
        } catch (err) {
            console.error("Failed to download PNG:", err);
        }
    };

    // Handle Download SVG
    const handleDownloadSvg = () => {
        if (!qrSvg) return;
        const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `qr-${(title || "bazaar").toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
        a.click();
        URL.revokeObjectURL(blobUrl);
    };

    // Handle Print Poster
    const handlePrintPoster = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print QR Poster - ${title}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                    @page { size: auto; margin: 15mm; }
                    body {
                        font-family: 'Inter', sans-serif;
                        margin: 0;
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        background: #ffffff;
                        color: #0f172a;
                    }
                    .poster-card {
                        border: 3px solid #0f172a;
                        border-radius: 28px;
                        padding: 40px 30px;
                        max-width: 480px;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .brand {
                        font-size: 14px;
                        font-weight: 800;
                        letter-spacing: 0.1em;
                        text-transform: uppercase;
                        color: #0d9488;
                        margin-bottom: 8px;
                    }
                    .headline {
                        font-size: 28px;
                        font-weight: 900;
                        letter-spacing: -0.02em;
                        margin: 0 0 8px 0;
                        line-height: 1.15;
                    }
                    .badge {
                        display: inline-block;
                        background: #f1f5f9;
                        border: 1px solid #cbd5e1;
                        padding: 6px 16px;
                        border-radius: 9999px;
                        font-size: 13px;
                        font-weight: 700;
                        color: #334155;
                        margin-bottom: 24px;
                    }
                    .qr-wrapper {
                        background: #ffffff;
                        border: 2px solid #e2e8f0;
                        border-radius: 20px;
                        padding: 20px;
                        display: inline-block;
                        margin-bottom: 24px;
                    }
                    .qr-wrapper svg {
                        width: 240px;
                        height: 240px;
                        display: block;
                    }
                    .instructions {
                        font-size: 14px;
                        color: #475569;
                        line-height: 1.5;
                        margin-bottom: 20px;
                    }
                    .url-box {
                        font-family: monospace;
                        font-size: 11px;
                        color: #64748b;
                        word-break: break-all;
                        background: #f8fafc;
                        padding: 8px 12px;
                        border-radius: 8px;
                    }
                    .footer {
                        margin-top: 24px;
                        font-size: 11px;
                        color: #94a3b8;
                    }
                </style>
            </head>
            <body>
                <div class="poster-card">
                    <div class="brand">${shopName}</div>
                    <h1 class="headline">SCAN TO CUSTOMIZE & ORDER</h1>
                    ${badgeText ? `<div class="badge">${badgeText}</div>` : ""}
                    <div class="qr-wrapper">
                        ${qrSvg}
                    </div>
                    <div class="instructions">
                        Point your smartphone camera at this QR code to view available 3D prints, customize text, and order directly.
                        ${pickupInstructions ? `<br><br><strong>Pickup:</strong> ${pickupInstructions}` : ""}
                    </div>
                    <div class="url-box">${url}</div>
                    <div class="footer">Powered by KenCreations Studio</div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <QrCode size={20} className="text-teal-600" />
                            {title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center">
                    {badgeText && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/60 mb-4">
                            <Sparkles size={12} className="text-teal-600" />
                            {badgeText}
                        </span>
                    )}

                    {/* QR Code Canvas / SVG Wrapper */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-gray-200 shadow-xs mb-4">
                        <div
                            className="w-56 h-56 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                            dangerouslySetInnerHTML={{ __html: qrSvg }}
                        />
                    </div>

                    {/* Target URL */}
                    <div className="w-full bg-gray-50 rounded-2xl p-3 border border-gray-100 flex items-center justify-between gap-2 mb-6">
                        <span className="text-xs font-mono text-gray-600 truncate select-all">
                            {url}
                        </span>
                        <button
                            onClick={handleCopy}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                                copied
                                    ? "bg-teal-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-2xs"
                            }`}
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 w-full">
                        <button
                            onClick={handleDownloadPng}
                            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100 text-xs font-bold transition-all gap-1.5"
                        >
                            <Download size={16} className="text-teal-600" />
                            <span>PNG</span>
                        </button>

                        <button
                            onClick={handleDownloadSvg}
                            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100 text-xs font-bold transition-all gap-1.5"
                        >
                            <Download size={16} className="text-teal-600" />
                            <span>SVG</span>
                        </button>

                        <button
                            onClick={handlePrintPoster}
                            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/60 text-xs font-bold transition-all gap-1.5"
                        >
                            <Printer size={16} className="text-teal-600" />
                            <span>Print Poster</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">
                        Standard scannable QR format (M-level error correction)
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
