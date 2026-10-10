import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function CsgLoadingOverlay() {
    const [tasks, setTasks] = useState(0);
    // `mounted` keeps the DOM node alive long enough for the exit animation to play.
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const handleStart = () => setTasks((prev) => prev + 1);
        const handleEnd   = () => setTasks((prev) => Math.max(0, prev - 1));

        window.addEventListener('csg-compute-start', handleStart);
        window.addEventListener('csg-compute-end',   handleEnd);

        return () => {
            window.removeEventListener('csg-compute-start', handleStart);
            window.removeEventListener('csg-compute-end',   handleEnd);
        };
    }, []);

    useEffect(() => {
        if (tasks > 0) {
            // Mount immediately when work begins.
            setMounted(true);
        } else {
            // Delay unmount so the CSS fade-out (300ms) can finish before the
            // element is removed from the DOM.
            const timer = setTimeout(() => setMounted(false), 350);
            return () => clearTimeout(timer);
        }
    }, [tasks]);

    if (!mounted) return null;

    const isVisible = tasks > 0;

    return (
        <div
            className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            style={{
                transition: 'opacity 300ms ease, transform 300ms ease',
                opacity: isVisible ? 1 : 0,
                transform: `translateX(-50%) translateY(${isVisible ? '0px' : '-12px'})`,
            }}
        >
            <div className="bg-neutral/90 text-white px-5 py-2.5 rounded-full shadow-xl shadow-secondary/10 flex items-center gap-3 backdrop-blur-md border border-neutral/50">
                <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                <span className="text-sm font-semibold tracking-wide">
                    Calculating geometry{tasks > 1 ? ` (${tasks})` : ''}…
                </span>
            </div>
        </div>
    );
}

