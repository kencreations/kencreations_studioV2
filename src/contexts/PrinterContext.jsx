import React, { createContext, useContext, useState, useEffect } from "react";
import { PRINTER_PRESETS, DEFAULT_PRINTER } from "../config/printers";

const PrinterContext = createContext();

export function PrinterProvider({ children }) {
    // Try to load the saved printer from localStorage or default to DEFAULT_PRINTER
    const [activePrinterId, setActivePrinterId] = useState(() => {
        const saved = localStorage.getItem("activePrinterId");
        return saved || DEFAULT_PRINTER.id;
    });

    const activePrinter = PRINTER_PRESETS.find((p) => p.id === activePrinterId) || DEFAULT_PRINTER;

    // Save to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem("activePrinterId", activePrinter.id);
    }, [activePrinter.id]);

    return (
        <PrinterContext.Provider value={{ activePrinter, setActivePrinterId, PRINTER_PRESETS }}>
            {children}
        </PrinterContext.Provider>
    );
}

export function usePrinter() {
    return useContext(PrinterContext);
}
