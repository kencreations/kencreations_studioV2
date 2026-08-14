/**
 * preload.cjs — Electron Context Bridge
 *
 * Exposes a typed `window.electronAPI` surface to the renderer process.
 * Nothing from Node.js internals leaks through — only these explicit methods.
 *
 * Security: contextIsolation: true ensures the renderer cannot access
 * Node.js APIs directly. All IPC is proxied through this bridge.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── HWID / Device Identity ─────────────────────────────────────────────
  /** Returns the derived (hashed) HWID for this machine. */
  getHwid: () => ipcRenderer.invoke('get-hwid'),

  /** Legacy compatibility alias. */
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),

  // ── Licensing ─────────────────────────────────────────────────────────
  /**
   * Checks the locally stored license state without a network call.
   * @returns {Promise<{ activated: boolean, entitlements: string[], reason?: string }>}
   */
  checkLicense: () => ipcRenderer.invoke('check-license'),

  /**
   * Activates the app online by verifying the key against Firebase.
   * @param {string} licenseKey — e.g. "KC-7F3A2B"
   * @returns {Promise<{ success: boolean, message: string, entitlements?: string[] }>}
   */
  activateWithKey: (licenseKey) => ipcRenderer.invoke('activate-with-key', licenseKey),

  /**
   * Opens a native file dialog to load an offline .lic file.
   * @returns {Promise<{ success: boolean, message: string, entitlements?: string[] }>}
   */
  loadOfflineLicense: () => ipcRenderer.invoke('load-offline-license'),

  /**
   * Returns the current list of entitlement IDs from the local DB.
   * @returns {Promise<string[]>}
   */
  getEntitlements: () => ipcRenderer.invoke('get-entitlements'),

  // ── Sync ──────────────────────────────────────────────────────────────
  /**
   * Manually triggers the background sync worker (e.g. after activation).
   */
  startSync: () => ipcRenderer.invoke('start-sync'),

  // ── Telemetry & Notifications ─────────────────────────────────────────
  /**
   * Queues a usage event for background sync.
   * @param {{ generatorId: string, eventType: string, exportFormat?: string }} event
   */
  queueTelemetry: (event) => ipcRenderer.invoke('queue-telemetry', event),
  
  /** Marks a push notification as permanently dismissed by the user. */
  markNotificationSeen: (id) => ipcRenderer.invoke('mark-notification-seen', id),

  // ── Fonts ──────────────────────────────────────────────────────────────
  saveCustomFont: (fontData) => ipcRenderer.invoke('save-custom-font', fontData),
  loadCustomFonts: () => ipcRenderer.invoke('load-custom-fonts'),

  // ── App Info ──────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // ── Push Events from Main → Renderer ──────────────────────────────────
  /**
   * Registers a listener for incoming notification banners pushed by the SyncWorker.
   * @param {(notif: { id, title, body, type }) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onNotification: (callback) => {
    const handler = (event, notif) => callback(notif);
    ipcRenderer.on('new-notification', handler);
    return () => ipcRenderer.removeListener('new-notification', handler);
  },

  /**
   * Registers a listener for "What's New" update prompts.
   * @param {(update: { version, title, changelog, forcePrompt }) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onUpdateAvailable: (callback) => {
    const handler = (event, update) => callback(update);
    ipcRenderer.on('new-update', handler);
    return () => ipcRenderer.removeListener('new-update', handler);
  },

  /**
   * Registers a listener for entitlement changes detected by the SyncWorker.
   * @param {(data: { entitlements: string[] }) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onEntitlementsUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('entitlements-updated', handler);
    return () => ipcRenderer.removeListener('entitlements-updated', handler);
  },

  /**
   * Registers a listener for license revocation events.
   * @param {(data: { reason: string }) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onLicenseRevoked: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('license-revoked', handler);
    return () => ipcRenderer.removeListener('license-revoked', handler);
  },

  // ── Auto Updater ───────────────────────────────────────────────────────
  
  installUpdate: () => ipcRenderer.send('install-update'),
  
  onAutoUpdateAvailable: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  
  onAutoUpdateProgress: (callback) => {
    const handler = (event, progress) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  
  onAutoUpdateDownloaded: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
});
