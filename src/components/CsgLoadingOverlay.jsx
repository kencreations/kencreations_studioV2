import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function CsgLoadingOverlay() {
    const [tasks, setTasks] = useState(0);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const handleStart = () => setTasks((prev) => prev + 1);
        const handleEnd = () => setTasks((prev) => Math.max(0, prev - 1));

        window.addEventListener('csg-compute-start', handleStart);
        window.addEventListener('csg-compute-end', handleEnd);

        return () => {
            window.removeEventListener('csg-compute-start', handleStart);
            window.removeEventListener('csg-compute-end', handleEnd);
        };
    }, []);

    useEffect(() => {
        setShow(tasks > 0);
    }, [tasks]);

    if (!show) return null;

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-neutral/90 text-white px-5 py-2.5 rounded-full shadow-xl shadow-secondary/10 flex items-center gap-3 backdrop-blur-md border border-neutral/50">
                <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                <span className="text-sm font-semibold tracking-wide">
                    Calculating geometry... {tasks > 1 ? `(${tasks})` : ''}
                </span>
            </div>
        </div>
    );
}
