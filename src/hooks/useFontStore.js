import React, { useState, useEffect, useMemo } from 'react';
import { BUNDLED_FONTS } from '../utils/fontManager';

// Global state for custom fonts across the app
let customFonts = [];
let listeners = new Set();

const notifyListeners = () => {
    listeners.forEach(listener => listener(customFonts));
};

export const addCustomFont = (fontFile, arrayBuffer) => {
    const newFont = {
        id: `custom_${Date.now()}_${fontFile.name.replace(/\.[^/.]+$/, "")}`,
        label: `* ${fontFile.name.replace(/\.[^/.]+$/, "")}`,
        isCustomWeb: true,
        arrayBuffer: arrayBuffer
    };
    
    customFonts = [...customFonts, newFont];
    notifyListeners();
    return newFont;
};

export function useFontStore() {
    const [fonts, setFonts] = useState(customFonts);

    useEffect(() => {
        const listener = (newFonts) => setFonts(newFonts);
        listeners.add(listener);
        return () => listeners.delete(listener);
    }, []);

    const allFonts = useMemo(() => {
        return [...fonts, ...BUNDLED_FONTS].map(f => ({
            id: f.id,
            label: f.label,
            value: f.id,
            url: f.url,
            isCustomWeb: f.isCustomWeb,
            arrayBuffer: f.arrayBuffer
        }));
    }, [fonts]);

    // Return bundled fonts + custom fonts
    return {
        allFonts,
        customFonts: fonts,
        bundledFonts: BUNDLED_FONTS
    };
}
