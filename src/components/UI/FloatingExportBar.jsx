import React, { useState } from 'react';
import { Camera, Download, Focus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ExportGateModal from '../ExportGateModal';


export default function FloatingExportBar({
    disabled = false,
    onExportSTL,
    onExport3MF,
    onScreenshot,
    onResetView,
    leftToolbarActions,
    title = "Model"
}) {
    const { currentUser } = useAuth();
    const isDesktop = !!window.electronAPI;
    const [isGateOpen, setIsGateOpen] = useState(false);
    const [pendingExport, setPendingExport] = useState(null); // 'stl' or '3mf'

    const handleExportClick = (type) => {
        if (disabled) return;
        // If desktop, or if already logged in on web, just export
        if (isDesktop || currentUser) {
            if (type === 'stl' && onExportSTL) onExportSTL();
            if (type === '3mf' && onExport3MF) onExport3MF();
            
        } else {
            setPendingExport(type);
            setIsGateOpen(true);
        }
    };

    // Authentication resolves asynchronously. Keep the dialog result separate
    // from the export action so the next click uses freshly verified access.
    const handleAuthenticated = () => { setIsGateOpen(false); setPendingExport(null); };

    return (
        <>
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-1.5 p-2 rounded-2xl max-w-[calc(100%-16px)] flex-wrap justify-center bg-white/90 backdrop-blur-xl border border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                {/* Viewport Controls */}
                {onScreenshot && (
                    <button 
                        onClick={onScreenshot}
                        title="Take Screenshot"
                        className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                        <Camera size={18} strokeWidth={2.5} />
                    </button>
                )}
                
                {onResetView && (
                    <button 
                        onClick={onResetView}
                        title="Reset View"
                        className="p-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                        <Focus size={18} strokeWidth={2.5} />
                    </button>
                )}

                {(onScreenshot || onResetView) && (onExportSTL || onExport3MF) && (
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                )}

                {/* Export Controls */}
                {onExportSTL && (
                    <button
                        disabled={disabled}
                        onClick={() => handleExportClick('stl')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                    >
                        <Download size={16} strokeWidth={3} />
                        Export STL
                    </button>
                )}

                {onExport3MF && (
                    <button
                        disabled={disabled}
                        onClick={() => handleExportClick('3mf')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 shadow-md shadow-teal-500/20 transition-all active:scale-95"
                    >
                        <Download size={16} strokeWidth={3} />
                        Export 3MF
                    </button>
                )}
                {leftToolbarActions}
            </div>

            <ExportGateModal  
                isOpen={isGateOpen}
                onClose={() => setIsGateOpen(false)}
                onAuthenticated={handleAuthenticated}
                exportType={pendingExport === 'stl' ? 'STL' : '3MF'}
            />
        </>
    );
}
