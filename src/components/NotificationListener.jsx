import React, { useEffect, useState } from 'react';

const TYPE_PREVIEW_STYLE = {
    info:     { bg: "bg-white",   title: "text-neutral",  body: "text-neutral/80",  icon: "💬" },
    success:  { bg: "bg-white",   title: "text-neutral",  body: "text-neutral/80",  icon: "✅" },
    warning:  { bg: "bg-white",   title: "text-neutral",  body: "text-neutral/80",  icon: "⚠️" },
    critical: { bg: "bg-white",   title: "text-primary",  body: "text-primary",     icon: "🚨" },
};

export function NotificationListener() {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        if (!window.electronAPI?.onNewNotification) return;

        const unsubscribe = window.electronAPI.onNewNotification((notif) => {
            const newNotification = {
                id: notif.id,
                title: notif.title || "New Notification",
                body: notif.body || "",
                type: notif.type || "info",
            };

            // Add to state so it renders as a toast
            setNotifications(prev => [...prev, newNotification]);

            // Auto-dismiss after 6 seconds
            setTimeout(() => {
                removeNotification(notif.id);
            }, 6000);
        });

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, []);

    const removeNotification = (id) => {
        setNotifications((prev) => prev.filter(n => n.id !== id));
    };

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
            {notifications.map((notif) => {
                const s = TYPE_PREVIEW_STYLE[notif.type] || TYPE_PREVIEW_STYLE.info;
                
                return (
                    <div 
                        key={notif.id}
                        className={`pointer-events-auto rounded-2xl border p-4 w-80 shadow-xl relative overflow-hidden ${s.bg} border-neutral/10 transition-all duration-300 animate-in slide-in-from-top-5`}
                    >
                        <div className={`absolute bottom-0 left-0 h-0.5 w-3/4 bg-secondary opacity-20`} />
                        <div className="flex items-start gap-3">
                            <span className="text-xl leading-none mt-0.5 flex-shrink-0">{s.icon}</span>
                            <div className="flex-1 pr-5">
                                <p className={`font-bold text-sm leading-tight mb-1 ${s.title}`}>
                                    {notif.title}
                                </p>
                                <p className={`text-xs leading-relaxed ${s.body}`}>
                                    {notif.body}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => removeNotification(notif.id)}
                            className="absolute top-3 right-3 text-neutral/40 hover:text-neutral/70 text-lg leading-none transition-colors"
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * -------------------------------------------------------------
 * 3. THE ADMIN SENDER (Reference code for your Admin Panel)
 * -------------------------------------------------------------
 * Ensure your Admin Panel is using `serverTimestamp()` so the 
 * documents are properly ordered and formatted.
 * 
 * import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
 * import { db } from './firebase'; // Admin's firebase config
 * 
 * export async function sendGlobalNotification(title, body, type = 'info') {
 *     try {
 *         await addDoc(collection(db, "notifications"), {
 *             title: title,
 *             body: body,
 *             type: type, // 'critical' or 'info'
 *             target: "global",
 *             isActive: true,
 *             createdAt: serverTimestamp()
 *         });
 *         console.log("Notification sent successfully!");
 *     } catch (error) {
 *         console.error("Error sending notification: ", error);
 *     }
 * }
 */
