/**
 * preload.cjs — Electron Context Bridge
 *
 * Exposes a typed `window.electronAPI` surface to the renderer process.
 * Nothing from Node.js internals leaks through — only these explicit methods.
 *
 * Security: contextIsolation: true ensures the renderer cannot access
 * Node.js APIs directly. All IPC is proxied through this bridge.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // ── HWID / Device Identity ─────────────────────────────────────────────
    /** Returns the derived (hashed) HWID for this machine. */
    getHwid: () => ipcRenderer.invoke("get-hwid"),

    /** Legacy compatibility alias. */
    getMachineId: () => ipcRenderer.invoke("get-machine-id"),

    // ── Licensing ─────────────────────────────────────────────────────────
    /**
     * Checks the locally stored license state without a network call.
     * @returns {Promise<{ activated: boolean, entitlements: string[], reason?: string }>}
     */
    checkLicense: () => ipcRenderer.invoke("check-license"),

    /**
     * Activates the app online by verifying the key against Firebase.
     * @param {string} licenseKey — e.g. "KC-7F3A2B"
     * @returns {Promise<{ success: boolean, message: string, entitlements?: string[] }>}
     */
    activateWithKey: (licenseKey) =>
        ipcRenderer.invoke("activate-with-key", licenseKey),

    /**
     * Opens a native file dialog to load an offline .lic file.
     * @returns {Promise<{ success: boolean, message: string, entitlements?: string[] }>}
     */
    loadOfflineLicense: () => ipcRenderer.invoke("load-offline-license"),

    /**
     * Returns the current list of entitlement IDs from the local DB.
     * @returns {Promise<string[]>}
     */
    getEntitlements: () => ipcRenderer.invoke("get-entitlements"),

    // ── Sync ──────────────────────────────────────────────────────────────
    /**
     * Manually triggers the background sync worker (e.g. after activation).
     */
    startSync: () => ipcRenderer.invoke("start-sync"),

    // ── Telemetry & Notifications ─────────────────────────────────────────
    /**
     * Queues a usage event for background sync.
     * @param {{ generatorId: string, eventType: string, exportFormat?: string }} event
     */
    queueTelemetry: (event) => ipcRenderer.invoke("queue-telemetry", event),

    /** Marks a push notification as permanently dismissed by the user. */
    markNotificationSeen: (id) =>
        ipcRenderer.invoke("mark-notification-seen", id),

    // ── Fonts ──────────────────────────────────────────────────────────────
    uploadCustomFont: () => ipcRenderer.invoke("upload-custom-font"),
    getCustomFonts: () => ipcRenderer.invoke("get-custom-fonts"),
    removeCustomFont: (id) => ipcRenderer.invoke("remove-custom-font", id),
    deleteCustomFont: (id) => ipcRenderer.invoke("delete-custom-font", id),
    /**
     * Reads a TTF/OTF file from disk and returns its raw bytes over IPC.
     *
     * Electron does not send a Node Buffer directly to the renderer; it serializes the underlying
     * binary data as a Uint8Array. This is a crucial detail for Three.js font parsing: the frontend
     * must convert the Uint8Array back into a clean ArrayBuffer before calling TTFLoader.parse().
     */
    readFontBuffer: (filePath) =>
        ipcRenderer.invoke("read-font-buffer", filePath),
    /** Increments the user's totalCustomFonts counter in Firestore (admin dashboard metric). */
    incrementCustomFonts: () => ipcRenderer.invoke("increment-custom-fonts"),

    // ── Profile ────────────────────────────────────────────────────────────
    getProfile: () => ipcRenderer.invoke("get-profile"),
    updateProfile: (username) => ipcRenderer.invoke("update-profile", username),
    incrementExports: () => ipcRenderer.invoke("increment-exports"),
    getTotalExports: () => ipcRenderer.invoke("get-total-exports"),

    // ── Colors ─────────────────────────────────────────────────────────────
    addCustomColor: (name, hex, brand) =>
        ipcRenderer.invoke("add-custom-color", name, hex, brand),
    getCustomColors: () => ipcRenderer.invoke("get-custom-colors"),
    removeCustomColor: (id) => ipcRenderer.invoke("remove-custom-color", id),

    // ── App Info & Network ────────────────────────────────────────────────
    getAppVersion: () => ipcRenderer.invoke("get-app-version"),
    syncThumbnails: (editors) => ipcRenderer.invoke("sync-thumbnails", editors),

    // ── Push Events from Main → Renderer ──────────────────────────────────
    /**
     * Registers a listener for incoming notification banners pushed by the SyncWorker.
     * @param {(notif: { id, title, body, type }) => void} callback
     * @returns {() => void} unsubscribe function
     */
    onNotification: (callback) => {
        const handler = (event, notif) => callback(notif);
        ipcRenderer.on("new-notification", handler);
        return () => ipcRenderer.removeListener("new-notification", handler);
    },

    /**
     * Registers a listener for "What's New" update prompts.
     * @param {(update: { version, title, changelog, forcePrompt }) => void} callback
     * @returns {() => void} unsubscribe function
     */
    onUpdateAvailable: (callback) => {
        const handler = (event, update) => callback(update);
        ipcRenderer.on("new-update", handler);
        return () => ipcRenderer.removeListener("new-update", handler);
    },

    /**
     * Registers a listener for entitlement changes detected by the SyncWorker.
     * @param {(data: { entitlements: string[] }) => void} callback
     * @returns {() => void} unsubscribe function
     */
    onEntitlementsUpdated: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on("entitlements-updated", handler);
        return () =>
            ipcRenderer.removeListener("entitlements-updated", handler);
    },

    /**
     * Registers a listener for license revocation events.
     * @param {(data: { reason: string }) => void} callback
     * @returns {() => void} unsubscribe function
     */
    onLicenseRevoked: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on("license-revoked", handler);
        return () => ipcRenderer.removeListener("license-revoked", handler);
    },

    // ── Auto Updater ───────────────────────────────────────────────────────

    installUpdate: () => ipcRenderer.send("install-update"),

    onAutoUpdateAvailable: (callback) => {
        const handler = (event, info) => callback(info);
        ipcRenderer.on("update-available", handler);
        return () => ipcRenderer.removeListener("update-available", handler);
    },

    onAutoUpdateProgress: (callback) => {
        const handler = (event, progress) => callback(progress);
        ipcRenderer.on("download-progress", handler);
        return () => ipcRenderer.removeListener("download-progress", handler);
    },

    onAutoUpdateDownloaded: (callback) => {
        const handler = (event, info) => callback(info);
        ipcRenderer.on("update-downloaded", handler);
        return () => ipcRenderer.removeListener("update-downloaded", handler);
    },

    // ── App Config ─────────────────────────────────────────────────────────
    getAppConfig: (key) => ipcRenderer.invoke("get-app-config", key),

    onFilamentBrandsUpdated: (callback) => {
        const handler = () => callback();
        ipcRenderer.on("filament-brands-updated", handler);
        return () =>
            ipcRenderer.removeListener("filament-brands-updated", handler);
    },

    // ── Filaments ───────────────────────────────────────────────────────
    /** Returns all filaments from the local DB. */
    getFilaments: () => ipcRenderer.invoke("get-filaments"),
    /** Adds a new filament record. @param {object} data */
    addFilament: (data) => ipcRenderer.invoke("add-filament", data),
    /** Updates a filament by ID. @param {number} id @param {object} data */
    updateFilament: (id, data) => ipcRenderer.invoke("update-filament", id, data),
    /** Deletes a filament by ID. @param {number} id */
    deleteFilament: (id) => ipcRenderer.invoke("delete-filament", id),

    // ── Consumables ─────────────────────────────────────────────────────
    /** Returns all consumables from the local DB. */
    getConsumables: () => ipcRenderer.invoke("get-consumables"),
    /** Adds a new consumable record. @param {object} data */
    addConsumable: (data) => ipcRenderer.invoke("add-consumable", data),
    /** Updates a consumable by ID. @param {number} id @param {object} data */
    updateConsumable: (id, data) => ipcRenderer.invoke("update-consumable", id, data),
    /** Deletes a consumable by ID. @param {number} id */
    deleteConsumable: (id) => ipcRenderer.invoke("delete-consumable", id),

    // ── External URLs ──────────────────────────────────────────────────
    /**
     * Securely opens a URL in the default desktop browser.
     * Only http/https URLs are permitted (validated in main process).
     * @param {string} url
     */
    openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),

    // ── Mass Produce: Slicer Bridge ──────────────────────────────────────
    /**
     * Writes a 3D file buffer to a temp path and opens it in the
     * OS-registered slicer application (Bambu Studio, PrusaSlicer, etc).
     * @param {{ fileBuffer: ArrayBuffer, fileName: string }} payload
     * @returns {Promise<{ success: boolean, path?: string, error?: string }>}
     */
    openInSlicer: ({ fileBuffer, fileName }) =>
        ipcRenderer.invoke("open-in-slicer", { fileBuffer, fileName }),

});
