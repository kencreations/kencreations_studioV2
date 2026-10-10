import React from 'react';
import { Box, Clock, Scale, CircleDollarSign } from 'lucide-react';

export function DimensionsBadge({ dimensions }) {
    if (!dimensions) return null;

    return (
        <div className="pointer-events-auto flex items-center gap-3.5 rounded-full border border-secondary/30 bg-white/90 px-5 py-2 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="font-bold text-secondary">X:</span>
                <strong className="font-semibold text-neutral tabular-nums">
                    {dimensions.x?.toFixed(1) || "0.0"}mm
                </strong>
            </div>
            <span className="text-secondary/30 font-light">|</span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="font-bold text-primary">Y:</span>
                <strong className="font-semibold text-neutral tabular-nums">
                    {dimensions.y?.toFixed(1) || "0.0"}mm
                </strong>
            </div>
            <span className="text-secondary/30 font-light">|</span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="font-bold text-slate-400">Z:</span>
                <strong className="font-semibold text-neutral tabular-nums">
                    {dimensions.z?.toFixed(1) || "0.0"}mm
                </strong>
            </div>
        </div>
    );
}

export function EstimatorBadge({ estimates }) {
    if (!estimates) return null;

    return (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm">
            {estimates.time && (
                <div className="flex items-center gap-1.5" title="Estimated Print Time">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>{estimates.time}</span>
                </div>
            )}
            {estimates.weight && (
                <div className="flex items-center gap-1.5" title="Estimated Filament Weight">
                    <Scale className="h-3.5 w-3.5 text-blue-500" />
                    <span>{estimates.weight}g</span>
                </div>
            )}
            {estimates.cost && (
                <div className="flex items-center gap-1.5" title="Estimated Material Cost">
                    <CircleDollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    <span>${estimates.cost.toFixed(2)}</span>
                </div>
            )}
        </div>
    );
}
