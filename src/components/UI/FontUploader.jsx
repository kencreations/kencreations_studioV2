import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { addCustomFont } from '../../hooks/useFontStore';

export default function FontUploader({ onFontAdded }) {
    const fileInputRef = useRef(null);

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const newFont = addCustomFont(file, arrayBuffer);
            if (onFontAdded) {
                onFontAdded(newFont.id);
            }
        } catch (error) {
            console.error("Failed to load custom font", error);
            alert("Failed to load custom font. Ensure it is a valid TTF/OTF file.");
        }
        
        // Reset the input so the same file can be uploaded again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div>
            <input
                type="file"
                accept=".ttf,.otf"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-800 transition-colors uppercase tracking-widest bg-teal-50 px-2 py-1 rounded-md"
            >
                <Upload size={12} /> Add Font
            </button>
        </div>
    );
}
