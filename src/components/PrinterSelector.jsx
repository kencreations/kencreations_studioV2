import React, { useState, useRef, useEffect } from 'react';
import { usePrinter } from '../contexts/PrinterContext';
import { PRINTER_PRESETS } from '../config/printers';

const PrinterSelector = () => {
    const { activePrinter, setActivePrinterId } = usePrinter();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const printerList = PRINTER_PRESETS;

    return (
        <div className="relative mb-4 bg-white rounded-xl border border-teal-500/20 p-2" ref={dropdownRef}>
            <p className="text-[10px] font-bold text-teal-600 mb-2 uppercase tracking-wider text-center">Active Printer</p>
            
            {/* Custom Trigger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex flex-col items-center justify-center p-2 hover:bg-slate-50 rounded-lg transition-colors"
            >
                {activePrinter.uiThumbnail ? (
                    <img 
                        src={activePrinter.uiThumbnail} 
                        alt={activePrinter.name} 
                        className="h-16 object-contain mb-2"
                        onError={(e) => e.target.style.display = 'none'}
                    />
                ) : (
                    <div className="h-16 w-16 mb-2 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                        No Img
                    </div>
                )}
                
                <div className="flex items-center gap-1 text-sm font-medium text-slate-700">
                    {activePrinter.name}
                    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </button>

            {/* Custom Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                    {printerList.map((printer) => (
                        <button
                            key={printer.id}
                            onClick={() => {
                                setActivePrinterId(printer.id);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-teal-50 transition-colors border-b border-slate-100 last:border-0 ${activePrinter.id === printer.id ? 'bg-teal-50/50' : ''}`}
                        >
                            {printer.uiThumbnail ? (
                                <img src={printer.uiThumbnail} alt={printer.name} className="h-10 w-10 object-contain" onError={(e) => e.target.style.display = 'none'} />
                            ) : (
                                <div className="h-10 w-10 rounded bg-gray-100 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-slate-700">{printer.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PrinterSelector;
