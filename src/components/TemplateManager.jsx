import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTemplates } from '../hooks/useTemplates';

export default function TemplateManager({ editorId, currentSettings, onLoadTemplate, excludeKeys = [] }) {
    const { templates, saveTemplate, deleteTemplate } = useTemplates(editorId);
    const [isSaving, setIsSaving] = useState(false);
    const [templateName, setTemplateName] = useState("");

    const handleSave = () => {
        saveTemplate(templateName, currentSettings, excludeKeys);
        setIsSaving(false);
        setTemplateName("");
    };

    return (
        <div className="rounded-xl border border-[#00A3A3]/20 bg-[#00A3A3]/5 p-4 mb-6">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00A3A3]">
                    Design templates
                </h3>
                {!isSaving && (
                    <button
                        onClick={() => setIsSaving(true)}
                        className="rounded-md border border-[#00A3A3]/40 px-2 py-1 text-[10px] font-bold text-[#00A3A3] hover:bg-[#00A3A3]/10"
                    >
                        + New
                    </button>
                )}
            </div>
            
            <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                Save and reuse the complete design (font, sizes, hole, colors). Templates sync to your local app.
            </p>

            {isSaving && (
                <div className="mb-3 rounded-lg border border-[#00A3A3]/30 bg-white p-2">
                    <input
                        type="text"
                        autoFocus
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Template name..."
                        className="w-full rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-[#00A3A3]"
                    />
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={handleSave}
                            className="flex-1 rounded bg-[#00A3A3] py-1.5 text-[10px] font-bold text-white hover:bg-[#008f8f]"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => {
                                setIsSaving(false);
                                setTemplateName("");
                            }}
                            className="flex-1 rounded bg-slate-100 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {!isSaving && templates.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-[10px] text-slate-400">
                    Finish your design, then use + New to save it.
                </div>
            )}

            {!isSaving && templates.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {templates.map(template => (
                        <div key={template.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:border-[#00A3A3]/40">
                            <span className="truncate text-xs font-semibold text-slate-700 max-w-[120px]" title={template.name}>
                                {template.name}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onLoadTemplate(template.settings)}
                                    className="rounded bg-[#00A3A3]/10 px-3 py-1 text-[10px] font-bold text-[#00A3A3] hover:bg-[#00A3A3]/20"
                                >
                                    Load
                                </button>
                                <button
                                    onClick={() => deleteTemplate(template.id)}
                                    className="p-1 text-slate-300 hover:text-red-500"
                                    title="Delete template"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
