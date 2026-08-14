import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import {
    X,
    SlidersHorizontal,
    Image as ImageIcon,
    Crop,
    AlertTriangle,
} from "lucide-react";
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { adjustImage } from "../engine/image/adjust";
import { removeBackground } from "../engine/image/matte";
import { DEFAULT_PREPROCESS } from "../engine/types";

const SLIDERS = [
    { key: "exposure", label: "Exposure", min: 0, max: 2, step: 0.05 },
    { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.05 },
    { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.05 },
    { key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.05 },
    { key: "whiteBalance", label: "White Balance", min: 0, max: 2, step: 0.05 },
    { key: "highlights", label: "Highlights", min: 0, max: 2, step: 0.05 },
    { key: "shadows", label: "Shadows", min: 0, max: 2, step: 0.05 },
];

const RATIOS = [
    { key: "free", label: "Free" },
    { key: "1:1", label: "1:1" },
    { key: "4:3", label: "4:3" },
    { key: "3:2", label: "3:2" },
    { key: "16:9", label: "16:9" },
];

const ALPHA_THRESHOLD = 128;

function hasOutline(img, keepBackground) {
    if (keepBackground) return true;
    const clone = {
        data: new Uint8ClampedArray(img.data),
        width: img.width,
        height: img.height,
    };
    removeBackground(clone);
    let fg = 0;
    for (let p = 3; p < clone.data.length; p += 4) {
        if (clone.data[p] >= ALPHA_THRESHOLD) fg++;
    }
    return fg > 8;
}

export default function ImageWizardModal({ baseImage, onComplete, onCancel }) {
    const [params, setParams] = useState({ ...DEFAULT_PREPROCESS });
    const [isValid, setIsValid] = useState(true);

    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);

    const canvasRef = useRef(null);

    // Debounced or raw calculation of the adjusted image (full image)
    const adjustedImg = useMemo(() => {
        if (!baseImage) return null;
        return adjustImage(baseImage, params);
    }, [baseImage, params]);

    useEffect(() => {
        if (!adjustedImg || !canvasRef.current) return;

        const c = canvasRef.current;
        c.width = adjustedImg.width;
        c.height = adjustedImg.height;
        const ctx = c.getContext("2d");
        ctx.putImageData(
            new ImageData(
                new Uint8ClampedArray(adjustedImg.data),
                adjustedImg.width,
                adjustedImg.height,
            ),
            0,
            0,
        );

        // Validate outline asynchronously to prevent blocking UI
        // We use the full image for validation; if the cropped region is empty it will be handled.
        setTimeout(() => {
            setIsValid(hasOutline(adjustedImg, params.keepBackground));
        }, 0);
    }, [adjustedImg, params.keepBackground]);

    if (!baseImage) return null;

    const handleConfirm = () => {
        if (!isValid) return;

        let finalImage = adjustedImg;
        if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && canvasRef.current) {
            const scaleX = adjustedImg.width / canvasRef.current.offsetWidth;
            const scaleY = adjustedImg.height / canvasRef.current.offsetHeight;

            const cx = Math.max(0, Math.floor(completedCrop.x * scaleX));
            const cy = Math.max(0, Math.floor(completedCrop.y * scaleY));
            let cw = Math.round(completedCrop.width * scaleX);
            let ch = Math.round(completedCrop.height * scaleY);

            cw = Math.min(cw, adjustedImg.width - cx);
            ch = Math.min(ch, adjustedImg.height - cy);

            const out = new Uint8ClampedArray(cw * ch * 4);
            for (let y = 0; y < ch; y++) {
                const srcRow = (cy + y) * adjustedImg.width + cx;
                const dstRow = y * cw;
                for (let x = 0; x < cw; x++) {
                    const si = (srcRow + x) * 4;
                    const di = (dstRow + x) * 4;
                    out[di] = adjustedImg.data[si];
                    out[di + 1] = adjustedImg.data[si + 1];
                    out[di + 2] = adjustedImg.data[si + 2];
                    out[di + 3] = adjustedImg.data[si + 3];
                }
            }
            finalImage = { data: out, width: cw, height: ch };
        }

        onComplete({
            adjusted: finalImage,
            preprocess: params,
        });
    };

    const ASPECT_MAP = {
        'free': undefined,
        '1:1': 1,
        '4:3': 4/3,
        '3:2': 3/2,
        '16:9': 16/9
    };
    const aspect = ASPECT_MAP[params.cropRatio];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-secondary w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] border border-white/10 overflow-hidden">
                {/* HEADER */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-5 h-5 text-white" />
                        <h2 className="text-xl font-bold text-white">
                            Image Preprocessing
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-white/50 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex flex-1 overflow-hidden min-h-0 flex-col md:flex-row">
                    {/* LEFT: Preview & Tips */}
                    <div className="flex-1 p-6 border-r border-white/10 flex flex-col gap-6 overflow-y-auto bg-black/20">
                        {/* Canvas Viewport */}
                        <div
                            className="w-full aspect-square md:aspect-auto md:flex-1 rounded-lg border border-white/10 bg-[#1a1a1a] relative overflow-hidden flex items-center justify-center"
                            style={{
                                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="10" height="10" fill="%23222"/><rect x="10" width="10" height="10" fill="%23333"/><rect y="10" width="10" height="10" fill="%23333"/><rect x="10" y="10" width="10" height="10" fill="%23222"/></svg>')`,
                            }}>
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={aspect}
                                style={{ maxHeight: '100%', maxWidth: '100%' }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        display: 'block',
                                        maxHeight: '100%',
                                        maxWidth: '100%',
                                        objectFit: 'contain'
                                    }}
                                />
                            </ReactCrop>
                        </div>

                        {/* Tips Box */}
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-sm text-white/80 space-y-3">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-400" />
                                What kind of image works best
                            </h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>
                                    <strong>Simple, flat colors</strong> with
                                    bold, clearly separated shapes.
                                </li>
                                <li>
                                    <strong>2D illustrations</strong>, logos,
                                    icons or clipart convert best.
                                </li>
                            </ul>
                            <p className="text-orange-300">
                                <strong>Don't work well:</strong> photos of real
                                objects with shadows, gradients or texture
                                usually won't convert.
                            </p>
                            <p>
                                Missing details after processing? Turn up{" "}
                                <strong>Contrast</strong> and{" "}
                                <strong>Exposure</strong> to make the image
                                bolder and bring them back.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: Controls */}
                    <div className="w-full md:w-80 lg:w-96 p-6 overflow-y-auto space-y-8">
                        {/* Crop Ratio */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-white/90 flex items-center gap-2">
                                <Crop className="w-4 h-4 text-white" />
                                Crop Ratio
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {RATIOS.map((r) => (
                                    <button
                                        key={r.key}
                                        onClick={() =>
                                            setParams((p) => ({
                                                ...p,
                                                cropRatio: r.key,
                                            }))
                                        }
                                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                            params.cropRatio === r.key
                                                ? "bg-primary text-white"
                                                : "bg-white/10 text-white/70 hover:bg-white/20"
                                        }`}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-5">
                            <label className="text-sm font-semibold text-white/90 flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-white" />
                                Image Adjustment
                            </label>

                            <div className="space-y-4">
                                {SLIDERS.map((slider) => (
                                    <div
                                        key={slider.key}
                                        className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-white/70">
                                            <span>{slider.label}</span>
                                            <span className="font-mono">
                                                {params[slider.key].toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={slider.min}
                                            max={slider.max}
                                            step={slider.step}
                                            value={params[slider.key]}
                                            onChange={(e) =>
                                                setParams((p) => ({
                                                    ...p,
                                                    [slider.key]: parseFloat(
                                                        e.target.value,
                                                    ),
                                                }))
                                            }
                                            className="w-full accent-primary"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex-1">
                        {!isValid && (
                            <span className="text-red-400 text-sm font-medium flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                No outline found. Adjust the image to make
                                subjects bolder.
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg font-semibold text-white/80 hover:bg-white/10 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isValid}
                            className="px-6 py-2 rounded-lg font-semibold bg-primary text-white hover:bg-secondary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg">
                            Confirm Edit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
