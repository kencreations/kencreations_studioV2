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
    <div className="fixed bottom-6 right-6 w-80 bg-zinc-900 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden z-50 animate-in slide-in-from-bottom-5">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-teal-500/10 p-2 rounded-lg text-teal-400">
              {status === 'downloading' ? (
                <Download className="w-5 h-5 animate-pulse" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">
                {status === 'available' && 'Update Available'}
                {status === 'downloading' && 'Downloading Update...'}
                {status === 'downloaded' && 'Update Ready'}
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                {info ? `Version ${info.version}` : 'New version available'}
              </p>
            </div>
          </div>
          {status !== 'downloading' && (
            <button
              onClick={() => setVisible(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {status === 'downloading' && (
          <div className="mt-4">
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'downloaded' && (
          <button
            onClick={() => window.electronAPI.installUpdate()}
            className="mt-4 w-full py-2 bg-teal-500 hover:bg-teal-400 text-teal-950 text-sm font-medium rounded-lg transition-colors"
          >
            Restart to Install
          </button>
        )}
      </div>
    </div>
  );
}
