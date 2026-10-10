import React, { useState, useEffect, useRef } from 'react';
import { X, Check, RotateCcw, Crop, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ControlSlider } from './EditorControls';

export default function ImagePreprocessingModal({
    isOpen,
    onClose,
    onConfirm,
    initialImage,
}) {
    const canvasRef = useRef(null);
    const [imageObj, setImageObj] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [settings, setSettings] = useState({
        exposure: 0,     // -100 to 100
        brightness: 0,   // -100 to 100
        contrast: 0,     // -100 to 100
        saturation: 100, // 0 to 200
        highlights: 0,   // -100 to 100
        shadows: 0,      // -100 to 100
        blur: 0,         // 0 to 20
        redWeight: 100,  // 0 to 200 (percentage)
        greenWeight: 100,// 0 to 200
        blueWeight: 100, // 0 to 200
    });

    const [cropRatio, setCropRatio] = useState('free'); // free, 1:1, 4:3, 3:2, 16:9
    const [crop, setCrop] = useState(null);

    useEffect(() => {
        if (isOpen && initialImage) {
            const img = new Image();
            img.onload = () => {
                setImageObj(img);
                // Reset settings on new load
                setSettings({
                    exposure: 0,
                    brightness: 0,
                    contrast: 0,
                    saturation: 100,
                    highlights: 0,
                    shadows: 0,
                    blur: 0,
                    redWeight: 100,
                    greenWeight: 100,
                    blueWeight: 100,
                });
                setCropRatio('free');
            };
            img.src = initialImage;
        }
    }, [isOpen, initialImage]);

    useEffect(() => {
        if (!imageObj || !canvasRef.current) return;
        
        // Use a debounce to prevent locking up the UI
        const timer = setTimeout(() => {
            processImage();
        }, 50);
        return () => clearTimeout(timer);
    }, [settings, cropRatio, imageObj]);

    const processImage = () => {
        if (!imageObj || !canvasRef.current) return;
        setIsProcessing(true);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let sourceWidth = imageObj.width;
        let sourceHeight = imageObj.height;
        let startX = 0;
        let startY = 0;

        // Note: Interactive cropping is handled by ReactCrop overlay now.
        // We render the FULL image to the canvas for preview, and crop only on confirm.

        // Set canvas size
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        // Apply native canvas filters for blur
        if (settings.blur > 0) {
            ctx.filter = `blur(${settings.blur}px)`;
        } else {
            ctx.filter = 'none';
        }

        ctx.drawImage(
            imageObj,
            startX, startY, sourceWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
        );

        // Get image data for pixel manipulation
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Pre-calculate factors
        const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
        const exposureFactor = Math.pow(2, settings.exposure / 50); // e.g. -2 to +2 stops
        const satFactor = settings.saturation / 100;
        
        const rw = settings.redWeight / 100;
        const gw = settings.greenWeight / 100;
        const bw = settings.blueWeight / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // 1. RGB Weights (channel multipliers)
            r = r * rw;
            g = g * gw;
            b = b * bw;

            // 2. Exposure
            r *= exposureFactor;
            g *= exposureFactor;
            b *= exposureFactor;

            // 3. Brightness
            r += settings.brightness;
            g += settings.brightness;
            b += settings.brightness;

            // 4. Contrast
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;

            // 5. Highlights and Shadows (Simplified S-curve mapping based on luminance)
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (settings.shadows !== 0 && lum < 128) {
                // Boost or cut shadows
                const shadowMask = (128 - lum) / 128; // 1 at pitch black, 0 at mid-gray
                const shadowAdj = (settings.shadows / 100) * 128 * shadowMask;
                r += shadowAdj; g += shadowAdj; b += shadowAdj;
            }
            if (settings.highlights !== 0 && lum > 128) {
                // Boost or cut highlights
                const highlightMask = (lum - 128) / 128; // 1 at pure white, 0 at mid-gray
                const highlightAdj = (settings.highlights / 100) * 128 * highlightMask;
                r += highlightAdj; g += highlightAdj; b += highlightAdj;
            }

            // 6. Saturation
            if (satFactor !== 1) {
                const l = 0.299 * r + 0.587 * g + 0.114 * b;
                r = l + (r - l) * satFactor;
                g = l + (g - l) * satFactor;
                b = l + (b - l) * satFactor;
            }

            // Clamp and assign back
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);
        setIsProcessing(false);
    };

    const handleConfirm = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        if (crop && crop.width && crop.height) {
            const cropCanvas = document.createElement('canvas');
            const scaleX = canvas.width / 100;
            const scaleY = canvas.height / 100;
            
            const pixelCrop = {
                x: Math.max(0, crop.x * scaleX),
                y: Math.max(0, crop.y * scaleY),
                width: Math.min(canvas.width, crop.width * scaleX),
                height: Math.min(canvas.height, crop.height * scaleY)
            };

            cropCanvas.width = pixelCrop.width;
            cropCanvas.height = pixelCrop.height;
            const ctx = cropCanvas.getContext('2d');
            ctx.drawImage(
                canvas,
                pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
                0, 0, pixelCrop.width, pixelCrop.height
            );
            onConfirm(cropCanvas.toDataURL('image/jpeg', 0.95));
        } else {
            onConfirm(canvas.toDataURL('image/jpeg', 0.95));
        }
    };

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    const ratioOptions = [
        { label: "Free", value: "free" },
        { label: "1:1", value: "1:1" },
        { label: "4:3", value: "4:3" },
        { label: "3:2", value: "3:2" },
        { label: "16:9", value: "16:9" },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
            <div className="flex h-[90vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-lg font-bold text-slate-800">Image Preprocessing</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Canvas Preview */}
                    <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-center relative">
                        <div className="relative flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-200 overflow-hidden shadow-inner">
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                aspect={cropRatio === 'free' ? undefined : (
                                    cropRatio.split(':').map(Number).reduce((a, b) => a / b)
                                )}
                            >
                                <canvas
                                    ref={canvasRef}
                                    className="max-h-full max-w-full object-contain shadow-lg"
                                />
                            </ReactCrop>
                            {isProcessing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex w-full items-center justify-center gap-2">
                            {ratioOptions.map(ratio => (
                                <button
                                    key={ratio.value}
                                    onClick={() => setCropRatio(ratio.value)}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                        cropRatio === ratio.value
                                            ? "bg-indigo-600 text-white shadow-md"
                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                    }`}
                                >
                                    {ratio.value === 'free' ? <Crop className="h-4 w-4" /> : null}
                                    {ratio.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Controls Sidebar */}
                    <div className="w-96 border-l border-slate-200 bg-white flex flex-col">
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            
                            {/* Basic Adjustments */}
                            <div className="space-y-4">
                                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                                    <SlidersHorizontal className="h-4 w-4" /> Basic Adjustments
                                </h3>
                                <ControlSlider label="Exposure" value={settings.exposure} min={-100} max={100} step={1} onChange={(v) => updateSetting('exposure', v)} />
                                <ControlSlider label="Brightness" value={settings.brightness} min={-100} max={100} step={1} onChange={(v) => updateSetting('brightness', v)} />
                                <ControlSlider label="Contrast" value={settings.contrast} min={-100} max={100} step={1} onChange={(v) => updateSetting('contrast', v)} />
                                <ControlSlider label="Saturation" value={settings.saturation} min={0} max={200} step={1} onChange={(v) => updateSetting('saturation', v)} />
                                <ControlSlider label="Blur" value={settings.blur} min={0} max={20} step={0.5} onChange={(v) => updateSetting('blur', v)} />
                            </div>

                            <hr className="border-slate-100" />

                            {/* Tonal Range */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Tonal Range</h3>
                                <ControlSlider label="Highlights" value={settings.highlights} min={-100} max={100} step={1} onChange={(v) => updateSetting('highlights', v)} />
                                <ControlSlider label="Shadows" value={settings.shadows} min={-100} max={100} step={1} onChange={(v) => updateSetting('shadows', v)} />
                            </div>

                            <hr className="border-slate-100" />

                            {/* Color Channel Weights */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">RGB Mix (Litho Focus)</h3>
                                <p className="text-xs text-slate-500 mb-2">Adjusting these weights helps extract details from specific color channels before turning the image into depth data.</p>
                                <ControlSlider label="Red Weight %" value={settings.redWeight} min={0} max={200} step={1} onChange={(v) => updateSetting('redWeight', v)} />
                                <ControlSlider label="Green Weight %" value={settings.greenWeight} min={0} max={200} step={1} onChange={(v) => updateSetting('greenWeight', v)} />
                                <ControlSlider label="Blue Weight %" value={settings.blueWeight} min={0} max={200} step={1} onChange={(v) => updateSetting('blueWeight', v)} />
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="border-t border-slate-200 bg-slate-50 p-4 flex gap-3">
                            <button
                                onClick={() => {
                                    setSettings({
                                        exposure: 0, brightness: 0, contrast: 0, saturation: 100, 
                                        highlights: 0, shadows: 0, blur: 0, 
                                        redWeight: 100, greenWeight: 100, blueWeight: 100
                                    });
                                    setCropRatio('free');
                                }}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                            >
                                <RotateCcw className="h-4 w-4" /> Reset
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-indigo-700"
                            >
                                <Check className="h-4 w-4" /> Confirm Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
