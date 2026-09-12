import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * BannerNotification — Floating banner that listens for push notifications
 * from the SyncWorker via window.electronAPI.onNotification().
 *
 * Features:
 *  - Queues multiple notifications in a stack
 *  - Type-aware styling (info / warning / critical / success)
 *  - Auto-dismisses after 8 seconds
 *  - Manual dismiss with animated exit
 *  - Renders as a fixed overlay above all other content
 */

const TYPE_CONFIG = {
    info: {
        bg: 'bg-blue-50/95',
        border: 'border-blue-200',
        icon: '💬',
        title: 'text-blue-900',
        body: 'text-blue-700',
        bar: 'bg-blue-400',
    },
    warning: {
        bg: 'bg-amber-50/95',
        border: 'border-amber-300',
        icon: '⚠️',
        title: 'text-amber-900',
        body: 'text-amber-700',
        bar: 'bg-amber-400',
    },
    critical: {
        bg: 'bg-red-50/95',
        border: 'border-red-300',
        icon: '🚨',
        title: 'text-red-900',
        body: 'text-red-700',
        bar: 'bg-red-500',
    },
    success: {
        bg: 'bg-green-50/95',
        border: 'border-green-200',
        icon: '✅',
        title: 'text-green-900',
        body: 'text-green-700',
        bar: 'bg-green-500',
    },
};

const AUTO_DISMISS_MS = 8000;

function NotificationCard({ notification, onDismiss }) {
    const [exiting, setExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const timerRef = useRef(null);
    const animRef = useRef(null);
    const startRef = useRef(Date.now());

    const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;

    const dismiss = useCallback(() => {
        setExiting(true);
        clearTimeout(timerRef.current);
        cancelAnimationFrame(animRef.current);
        setTimeout(() => onDismiss(notification.id), 300);
    }, [notification.id, onDismiss]);

    useEffect(() => {
        timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);

        const animate = () => {
            const elapsed = Date.now() - startRef.current;
            const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
            setProgress(remaining);
            if (remaining > 0) {
                animRef.current = requestAnimationFrame(animate);
            }
        };
        animRef.current = requestAnimationFrame(animate);

        return () => {
            clearTimeout(timerRef.current);
            cancelAnimationFrame(animRef.current);
        };
    }, [dismiss]);

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl max-w-sm w-full pointer-events-auto transition-all duration-300 ${config.bg} ${config.border} ${
                exiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'
            }`}
        >
            {/* Progress bar */}
            <div
                className={`absolute bottom-0 left-0 h-0.5 transition-all ${config.bar}`}
                style={{ width: `${progress}%`, transitionDuration: '100ms' }}
            />

            <div className="p-4 pr-10">
                <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5 flex-shrink-0">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm leading-tight mb-1 ${config.title}`}>
                            {notification.title}
                        </p>
                        <p className={`text-xs leading-relaxed ${config.body}`}>
                            {notification.body}
                        </p>
                    </div>
                </div>
            </div>

            {/* Dismiss button */}
            <button
                onClick={dismiss}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-lg leading-none transition-colors"
                aria-label="Dismiss notification"
            >
                ×
            </button>
        </div>
    );
}

export default function BannerNotification() {
    const [queue, setQueue] = useState([]);

    const dismiss = useCallback((id) => {
        setQueue(prev => prev.filter(n => n.id !== id));
        if (window.electronAPI?.markNotificationSeen) {
            window.electronAPI.markNotificationSeen(id).catch(console.error);
        }
    }, []);

    useEffect(() => {
        const handleNotif = (notif) => {
            setQueue(prev => {
                // Deduplicate by id
                if (prev.find(n => n.id === notif.id)) return prev;
                return [...prev, { ...notif, receivedAt: Date.now() }];
            });
        };

        let unsub;
        if (window.electronAPI?.onNotification) {
            unsub = window.electronAPI.onNotification(handleNotif);
        }

        const handleLocal = (e) => handleNotif(e.detail);
        window.addEventListener('local-notification', handleLocal);

        return () => {
            if (unsub) unsub();
            window.removeEventListener('local-notification', handleLocal);
        };
    }, []);

    if (!queue.length) return null;

    return (
        <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
            {queue.map(notif => (
                <NotificationCard key={notif.id} notification={notif} onDismiss={dismiss} />
            ))}
        </div>
    );
}
