import { useState, useEffect } from 'react';

/**
 * Recursively strips specified keys from an object or array.
 */
function stripKeys(obj, keysToRemove) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => stripKeys(item, keysToRemove));
    }

    const newObj = {};
    for (const key in obj) {
        if (!keysToRemove.includes(key)) {
            newObj[key] = stripKeys(obj[key], keysToRemove);
        }
    }
    return newObj;
}

export function useTemplates(editorId) {
    const storageKey = `kencreations-templates-${editorId}`;

    const [templates, setTemplates] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to load templates:", e);
        }
        return [];
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(templates));
        } catch (e) {
            console.error("Failed to save templates:", e);
        }
    }, [templates, storageKey]);

    const saveTemplate = (name, currentSettings, excludeKeys = []) => {
        // Deep clone settings and recursively strip excluded keys
        const settingsToSave = stripKeys(JSON.parse(JSON.stringify(currentSettings)), excludeKeys);

        const newTemplate = {
            id: Date.now().toString(),
            name: name.trim() || "Untitled Template",
            timestamp: Date.now(),
            settings: settingsToSave
        };

        setTemplates(prev => [...prev, newTemplate]);
    };

    const deleteTemplate = (id) => {
        setTemplates(prev => prev.filter(t => t.id !== id));
    };

    return { templates, saveTemplate, deleteTemplate };
}
