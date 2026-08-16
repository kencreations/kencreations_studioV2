/**
 * main.cjs — Electron Main Process
 *
 * Responsibilities:
 *  - Create the BrowserWindow with hardened webPreferences
 *  - Initialize the local encrypted SQLite DB
 *  - Run license check on startup (local fast-path)
 *  - Expose IPC handlers for licensing, HWID, fonts, telemetry
 *  - Start the background SyncWorker after activation
 *  - Disable DevTools in production (security hardening)
 *
 * Note: This file is compiled to V8 bytecode by bytenode during `npm run electron:build`.
 * In development (`npm run electron:dev`) it runs as plain JS for hot-reloading.
 */

'use strict';

const { app, BrowserWindow, ipcMain, dialog, net, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { machineIdSync } = require('node-machine-id');

const getMod = (n) => { try { return require(`./${n}.cjs`); } catch(e) { return require(`./${n}.jsc`); } };
const db = getMod('db');
const { deriveHwid, verifyLicFile, activateWithKey, checkLocalLicense } = getMod('licenseManager');
const { startSyncWorker, stopSyncWorker } = getMod('syncWorker');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';
const APP_VERSION = require('../package.json').version;

let mainWindow;
let _hwid = null; // Cached derived HWID for this session

// ─── HWID ────────────────────────────────────────────────────────────────────

function getHwid() {
  if (_hwid) return _hwid;
  try {
    const rawId = machineIdSync();
    _hwid = deriveHwid(rawId);
  } catch (err) {
    console.error('[main] Failed to get machine ID:', err);
    _hwid = 'UNKNOWN-HWID-' + require('os').hostname();
  }
  return _hwid;
}

// ─── Window Creation ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // webSecurity is false only in dev for local font loading
      webSecurity: !isDev,
      devTools: isDev, // Disabled in production builds
    },
    autoHideMenuBar: true,
    frame: true,
    show: false, // Show after ready-to-show to avoid flash
  });

  // ── Production DevTools lockout ──────────────────────────────────────────
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
    // Disable right-click context menu in production
    mainWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopSyncWorker();
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-font',
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true }
  }
]);

app.whenReady().then(() => {
  protocol.handle('local-font', (request) => {
    const url = request.url.replace('local-font://', '');
    const decodedUrl = decodeURIComponent(url);
    const resolvedPath = path.normalize(decodedUrl);
    return net.fetch(`file://${resolvedPath}`);
  });
  // Init DB with HWID-derived encryption key
  const userDataPath = app.getPath('userData');
  const hwid = getHwid();
  db.initDb(userDataPath, hwid);

  createWindow();

  // Setup Auto-Updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
  });

  // Check for updates in production
  if (!isDev) {
    try {
      autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('Offline or failed to check for updates', e));
    } catch (e) {
      console.error('Failed to trigger update check', e);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopSyncWorker();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── IPC: Auto Updater ───────────────────────────────────────────────────────

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// ─── IPC: HWID & License ─────────────────────────────────────────────────────

/**
 * Returns the derived HWID for this device.
 * Used by the activation screen "Copy HWID" button.
 */
ipcMain.handle('get-hwid', () => {
  return getHwid();
});

/**
 * Legacy: kept for compatibility with any existing calls.
 */
ipcMain.handle('get-machine-id', () => {
  return getHwid();
});

/**
 * Checks local license state. Called on app startup.
 * Returns { activated, entitlements, licenseKey, expiresAt }
 */
ipcMain.handle('check-license', () => {
  const hwid = getHwid();
  const result = checkLocalLicense(hwid);
  return {
    activated: result.activated,
    entitlements: result.entitlements,
    reason: result.reason,
  };
});

/**
 * Attempts online activation with a license key.
 * On success, starts the SyncWorker.
 */
ipcMain.handle('activate-with-key', async (event, licenseKey) => {
  const hwid = getHwid();
  const result = await activateWithKey(licenseKey, hwid);

  if (result.success && mainWindow) {
    const localState = db.getLicenseState();
    startSyncWorker(mainWindow, localState.licenseKey, hwid);
  }

  return result;
});

/**
 * Loads and verifies an offline .lic file.
 * Opens a native file dialog, then verifies the file, then starts SyncWorker if online.
 */
ipcMain.handle('load-offline-license', async () => {
  const hwid = getHwid();

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load License File',
    filters: [{ name: 'License Files', extensions: ['lic'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, message: 'No file selected.' };
  }

  const filePath = result.filePaths[0];

  try {
    const payload = verifyLicFile(filePath, hwid);

    db.saveLicenseState({
      licenseKey: payload.licenseKey,
      certPayload: payload,
      entitlements: payload.entitlements || [],
      expiresAt: payload.expiresAt ?? null,
    });

    // Attempt background sync if online (non-blocking)
    if (net.isOnline() && mainWindow) {
      setImmediate(() => {
        startSyncWorker(mainWindow, payload.licenseKey, hwid);
      });
    }

    return {
      success: true,
      message: 'License loaded and verified successfully!',
      entitlements: payload.entitlements || [],
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

/**
 * Returns current entitlements from the local DB.
 * Used after SyncWorker pushes an update to refresh the UI.
 */
ipcMain.handle('get-entitlements', () => {
  const state = db.getLicenseState();
  return state ? state.entitlements : [];
});

/**
 * Returns the app version string.
 */
ipcMain.handle('get-app-version', () => APP_VERSION);

// ─── IPC: Telemetry ──────────────────────────────────────────────────────────

/**
 * Queues a telemetry event for later sync.
 * Called from the renderer after an export action.
 */
ipcMain.handle('queue-telemetry', (event, telemetryEvent) => {
  try {
    db.enqueueTelemetry(telemetryEvent);
    return { success: true };
  } catch (err) {
    console.error('[main] queue-telemetry error:', err);
    return { success: false };
  }
});

// ─── IPC: Notifications ────────────────────────────────────────────────────────

ipcMain.handle('mark-notification-seen', (event, id) => {
  db.setSyncMeta('dismissed_notif_' + id, '1');
  return { success: true };
});

// ─── IPC: Custom Fonts ───────────────────────────────────────────────────────

ipcMain.handle('upload-custom-font', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select a Font File',
      filters: [{ name: 'Fonts', extensions: ['ttf', 'otf'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, message: 'No file selected.' };
    }

    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    
    // 5MB Limit
    if (stat.size > 5 * 1024 * 1024) {
      return { success: false, message: 'Font file exceeds 5MB limit.' };
    }

    const fileName = path.basename(filePath);
    const userDataPath = app.getPath('userData');
    const fontsDir = path.join(userDataPath, 'custom_fonts');

    if (!fs.existsSync(fontsDir)) {
      fs.mkdirSync(fontsDir, { recursive: true });
    }

    const destPath = path.join(fontsDir, fileName);
    fs.copyFileSync(filePath, destPath);

    const fontObj = db.addCustomFont(fileName, destPath);
    return { success: true, font: fontObj };
  } catch (error) {
    console.error('[main] Failed to upload font:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-custom-fonts', () => {
  return db.getCustomFonts();
});

ipcMain.handle('remove-custom-font', (event, id) => {
  db.removeCustomFont(id);
  return { success: true };
});

/**
 * Reads a font file from disk and returns its raw bytes as a Buffer.
 * The renderer uses this to parse the TTF with opentype.js directly,
 * bypassing all web protocol security restrictions.
 */
ipcMain.handle('read-font-buffer', async (event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return buffer;
  } catch (err) {
    console.error('[main] Failed to read font file:', err);
    return null;
  }
});

// ─── IPC: User Profile ───────────────────────────────────────────────────────

ipcMain.handle('get-profile', () => {
  return db.getProfile();
});

ipcMain.handle('update-profile', async (event, username) => {
  db.updateProfile(username);
  
  // Attempt to sync to Firestore if license exists
  const state = db.getLicenseState();
  if (state && state.licenseKey && net.isOnline()) {
    try {
      const projectId = 'kencreations-v2'; // Note: hardcoded for now, could be dynamic
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${state.licenseKey}?updateMask.fieldPaths=username`;
      
      const payload = {
        fields: {
          username: { stringValue: username }
        }
      };

      await net.fetch(url, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('[main] Failed to sync username to Firestore:', err);
    }
  }

  return { success: true };
});

ipcMain.handle('increment-exports', () => {
  db.incrementExports();
  return { success: true };
});

// ─── IPC: Custom Colors ──────────────────────────────────────────────────────

ipcMain.handle('add-custom-color', (event, colorName, hexCode, brand = 'Custom') => {
  const color = db.addCustomColor(colorName, hexCode, brand);
  return { success: true, color };
});

/**
 * Increments the totalCustomFonts field on the user's Firestore license document.
 * Fonts are stored locally — this is just a lightweight count for the admin dashboard.
 * Uses Firebase REST PATCH with FieldTransform (increment) — no Storage cost.
 */
ipcMain.handle('increment-custom-fonts', async () => {
  try {
    const state = db.getLicenseState();
    if (!state?.licenseKey || !net.isOnline()) return { success: false };

    const projectId = 'kencreations-v2';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;

    const body = {
      writes: [{
        transform: {
          document: `projects/${projectId}/databases/(default)/documents/licenses/${state.licenseKey}`,
          fieldTransforms: [{
            fieldPath: 'totalCustomFonts',
            increment: { integerValue: 1 }
          }]
        }
      }]
    };

    await net.fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
    return { success: true };
  } catch (err) {
    console.error('[main] Failed to increment custom fonts count:', err);
    return { success: false };
  }
});

ipcMain.handle('get-custom-colors', () => {
  return db.getCustomColors();
});

ipcMain.handle('remove-custom-color', (event, id) => {
  db.removeCustomColor(id);
  return { success: true };
});

// ─── IPC: Start SyncWorker on demand ────────────────────────────────────────

/**
 * Called by the renderer once the activation is confirmed, to kick off sync.
 */
ipcMain.handle('start-sync', () => {
  const hwid = getHwid();
  const state = db.getLicenseState();
  if (state && mainWindow) {
    startSyncWorker(mainWindow, state.licenseKey, hwid);
    return { success: true };
  }
  return { success: false };
});

// ─── IPC: App Config ────────────────────────────────────────────────────────
ipcMain.handle('get-app-config', (event, key) => {
  return db.getAppConfig(key);
});
