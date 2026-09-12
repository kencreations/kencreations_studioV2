import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

export default function UpdateToast() {
  const [status, setStatus] = useState('idle'); // idle, available, downloading, downloaded
  const [progress, setProgress] = useState(0);
  const [info, setInfo] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubAvailable = window.electronAPI.onAutoUpdateAvailable((updateInfo) => {
      setInfo(updateInfo);
      setStatus('available');
      setVisible(true);
    });

    const unsubProgress = window.electronAPI.onAutoUpdateProgress((prog) => {
      setStatus('downloading');
      setProgress(prog.percent || 0);
    });

    const unsubDownloaded = window.electronAPI.onAutoUpdateDownloaded((updateInfo) => {
      setInfo(updateInfo);
      setStatus('downloaded');
    });

    return () => {
      unsubAvailable();
      unsubProgress();
      unsubDownloaded();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border p-4 w-80 shadow-xl relative overflow-hidden bg-white border-neutral/10 transition-all duration-300 animate-in slide-in-from-bottom-5">
        <div className="absolute bottom-0 left-0 h-0.5 w-3/4 bg-secondary opacity-20" />
        
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 text-secondary">
            {status === 'downloading' ? (
              <Download className="w-5 h-5 animate-pulse" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </div>
          
          <div className="flex-1 pr-5">
            <p className="font-bold text-sm leading-tight mb-1 text-neutral">
              {status === 'available' && 'Update Available'}
              {status === 'downloading' && 'Downloading Update...'}
              {status === 'downloaded' && 'Update Ready'}
            </p>
            <p className="text-xs leading-relaxed text-neutral/80">
              {info ? `Version ${info.version}` : 'New version available'}
            </p>

            {status === 'downloading' && (
              <div className="mt-4">
                <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'downloaded' && (
              <button
                onClick={() => window.electronAPI.installUpdate()}
                className="mt-4 w-full py-2 bg-secondary hover:brightness-110 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Restart to Install
              </button>
            )}
          </div>
        </div>

        {status !== 'downloading' && (
          <button 
            onClick={() => setVisible(false)}
            className="absolute top-3 right-3 text-neutral/40 hover:text-neutral/70 text-lg leading-none transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
