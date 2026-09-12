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

"use strict";

const {
    app,
    BrowserWindow,
    screen,
    ipcMain,
    dialog,
    net,
    protocol,
    shell,
} = require("electron");
const path = require("path");
const fs = require("fs");

const { machineIdSync } = require("node-machine-id");

const getMod = (n) => {
    try {
        return require(`./${n}.cjs`);
    } catch (e) {
        return require(`./${n}.jsc`);
    }
};
const db = getMod("db");
const { deriveHwid, verifyLicFile, activateWithKey, checkLocalLicense } =
    getMod("licenseManager");
const { startSyncWorker, stopSyncWorker } = getMod("syncWorker");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// 1. Configure Logger
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

const isDev = process.env.NODE_ENV === "development";
const APP_VERSION = require("../package.json").version;

let mainWindow;
let _hwid = null; // Cached derived HWID for this session
let store; // electron-store instance

// ─── HWID ────────────────────────────────────────────────────────────────────

function getHwid() {
    if (_hwid) return _hwid;
    try {
        const rawId = machineIdSync();
        _hwid = deriveHwid(rawId);
    } catch (err) {
        console.error("[main] Failed to get machine ID:", err);
        _hwid = "UNKNOWN-HWID-" + require("os").hostname();
    }
    return _hwid;
}

// ─── Window Creation ─────────────────────────────────────────────────────────

function createWindow() {
    mainWindow = new BrowserWindow({
        title: 'Kencreations Studio',
        icon: path.join(__dirname, '../public/icon.png'),
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
            // webSecurity is false only in dev for local font loading
            webSecurity: !isDev,
            devTools: isDev, // Disabled in production builds
        },
        autoHideMenuBar: true,
        frame: true,
        show: true, // Show immediately to avoid silent failures
    });

    // ── Production DevTools lockout ──────────────────────────────────────────
    if (!isDev) {
        // TEMPORARILY DISABLED FOR UPDATER DEBUGGING
        /*
        mainWindow.webContents.on("devtools-opened", () => {
            mainWindow.webContents.closeDevTools();
        });
        */
        // Disable right-click context menu in production
        mainWindow.webContents.on("context-menu", (e) => {
            e.preventDefault();
        });
    }

    // Ensure the window is rendering on a valid, connected screen
    const windowBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(windowBounds);
    
    const isOffScreen = 
        windowBounds.x < display.bounds.x ||
        windowBounds.y < display.bounds.y ||
        windowBounds.x > (display.bounds.x + display.bounds.width - 50) || 
        windowBounds.y > (display.bounds.y + display.bounds.height - 50);

    if (isOffScreen) {
        console.log("Window detected off-screen. Centering on primary display...");
        mainWindow.center();
    }

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
    } else {
        const prodPath = path.join(__dirname, '../dist/index.html');
        console.log("Attempting to load production file at:", prodPath);
        
        mainWindow.loadFile(prodPath).catch((err) => {
            console.error("FAILED TO LOAD PRODUCTION HTML:", err);
        });
    }

    // FORCE DEVTOOLS OPEN IN PRODUCTION
    mainWindow.webContents.openDevTools({ mode: 'detach' });

    mainWindow.on("closed", () => {
        mainWindow = null;
        stopSyncWorker();
    });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([
    {
        scheme: "local-font",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
        },
    },
]);

// 1. Check if the app is getting stuck requesting a single instance lock
log.info("Checking single instance lock...");
const gotTheLock = app.requestSingleInstanceLock();
log.info(`Single instance lock result: ${gotTheLock}`);

if (!gotTheLock) {
    log.warn("Another instance is already running. Quitting this instance.");
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        log.info("Second instance launched. Attempting to focus main window...");
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // 2. Trace the actual ready event
    log.info("Waiting for app.whenReady()...");
    app.whenReady().then(async () => {
        log.info("app.whenReady() fired! Executing createWindow()...");

        // 1. Initialize Electron Store
        const Store = require('electron-store');
        store = new Store();

        // 2. Setup offline media cache protocol
        protocol.handle("app-media", (request) => {
            const url = request.url.replace("app-media://", "");
            const decodedUrl = decodeURIComponent(url);
            const userDataPath = app.getPath("userData");
            const resolvedPath = path.normalize(path.join(userDataPath, "thumbnails", decodedUrl));
            return net.fetch(`file://${resolvedPath}`);
        });
        protocol.handle("local-font", (request) => {
            const url = request.url.replace("local-font://", "");
            const decodedUrl = decodeURIComponent(url);
            const resolvedPath = path.normalize(decodedUrl);
            return net.fetch(`file://${resolvedPath}`);
        });
        // Init DB with HWID-derived encryption key
        const userDataPath = app.getPath("userData");
        const hwid = getHwid();
        db.initDb(userDataPath, hwid);

        try {
            createWindow();
            log.info("createWindow() executed successfully without fatal crashes.");
        } catch (err) {
            log.error("FATAL CRASH INSIDE createWindow():", err);
        }

        // Setup Auto-Updater
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        // 3. Updater Event Listeners
        autoUpdater.on("checking-for-update", () => {
            log.info("UPDATER: Checking for update...");
            console.log("UPDATER: Checking for update...");
        });

        autoUpdater.on("update-available", (info) => {
            log.info(`UPDATER: Update available: ${info.version}`);
            console.log(`UPDATER: Update available: ${info.version}`);
            if (mainWindow) mainWindow.webContents.send("update-available", info);
        });

        autoUpdater.on("update-not-available", (info) => {
            log.info("UPDATER: No update available. Current version is latest.");
            console.log("UPDATER: No update available. Current version is latest.");
        });

        autoUpdater.on("error", (err) => {
            log.error(`UPDATER: Error fetching update: ${err.message}`);
            console.error(`UPDATER: Error fetching update: ${err.message}`);
        });

        autoUpdater.on("download-progress", (progressObj) => {
            if (mainWindow)
                mainWindow.webContents.send("download-progress", progressObj);
        });

        autoUpdater.on("update-downloaded", (info) => {
            if (mainWindow) mainWindow.webContents.send("update-downloaded", info);
        });

        // Check for updates in production
        if (!isDev) {
            try {
                autoUpdater.checkForUpdatesAndNotify().catch((e) => {
                    console.error("Offline or failed to check for updates", e);
                    log.error("Offline or failed to check for updates", e);
                });
            } catch (e) {
                console.error("Failed to trigger update check", e);
                log.error("Failed to trigger update check", e);
            }
        }

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                log.info("App activated with no windows. Recreating window...");
                createWindow();
            }
        });

    }).catch((err) => {
        log.error("FATAL ERROR: app.whenReady() rejected!", err);
    });
}

app.on("window-all-closed", () => {
    stopSyncWorker();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// ─── IPC: Auto Updater ───────────────────────────────────────────────────────

ipcMain.on("install-update", () => {
    autoUpdater.quitAndInstall();
});

// ─── IPC: HWID & License ─────────────────────────────────────────────────────

/**
 * Returns the derived HWID for this device.
 * Used by the activation screen "Copy HWID" button.
 */
ipcMain.handle("get-hwid", () => {
    return getHwid();
});

/**
 * Legacy: kept for compatibility with any existing calls.
 */
ipcMain.handle("get-machine-id", () => {
    return getHwid();
});

/**
 * Checks local license state. Called on app startup.
 * Returns { activated, entitlements, licenseKey, expiresAt }
 */
ipcMain.handle("check-license", () => {
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
ipcMain.handle("activate-with-key", async (event, licenseKey) => {
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
ipcMain.handle("load-offline-license", async () => {
    const hwid = getHwid();

    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Load License File",
        filters: [{ name: "License Files", extensions: ["lic"] }],
        properties: ["openFile"],
    });

    if (result.canceled || !result.filePaths.length) {
        return { success: false, message: "No file selected." };
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
            message: "License loaded and verified successfully!",
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
ipcMain.handle("get-entitlements", () => {
    const state = db.getLicenseState();
    return state ? state.entitlements : [];
});

/**
 * Returns the app version string.
 */
ipcMain.handle("get-app-version", () => APP_VERSION);

// ─── IPC: Telemetry ──────────────────────────────────────────────────────────

/**
 * Queues a telemetry event for later sync.
 * Called from the renderer after an export action.
 */
ipcMain.handle("queue-telemetry", (event, telemetryEvent) => {
    try {
        db.enqueueTelemetry(telemetryEvent);
        return { success: true };
    } catch (err) {
        console.error("[main] queue-telemetry error:", err);
        return { success: false };
    }
});

// ─── IPC: Notifications ────────────────────────────────────────────────────────

ipcMain.handle("mark-notification-seen", (event, id) => {
    db.setSyncMeta("dismissed_notif_" + id, "1");
    return { success: true };
});

// ─── IPC: Custom Fonts ───────────────────────────────────────────────────────

ipcMain.handle("upload-custom-font", async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: "Select a Font File",
            filters: [{ name: "Fonts", extensions: ["ttf", "otf"] }],
            properties: ["openFile"],
        });

        if (result.canceled || !result.filePaths.length) {
            return { success: false, message: "No file selected." };
        }

        const filePath = result.filePaths[0];
        const stat = fs.statSync(filePath);

        // 5MB Limit
        if (stat.size > 5 * 1024 * 1024) {
            return { success: false, message: "Font file exceeds 5MB limit." };
        }

        const fileName = path.basename(filePath);
        const userDataPath = app.getPath("userData");
        const fontsDir = path.join(userDataPath, "custom_fonts");

        if (!fs.existsSync(fontsDir)) {
            fs.mkdirSync(fontsDir, { recursive: true });
        }

        const destPath = path.join(fontsDir, fileName);
        fs.copyFileSync(filePath, destPath);

        const fontObj = db.addCustomFont(fileName, destPath);
        return { success: true, font: fontObj };
    } catch (error) {
        console.error("[main] Failed to upload font:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle("get-custom-fonts", () => {
    return db.getCustomFonts();
});

/**
 * Deletes a custom font from the SQLite metadata table and removes the file from disk.
 * Kept as a compatibility alias so all renderers can call either name without breaking older code.
 */
ipcMain.handle("remove-custom-font", (event, id) => {
    try {
        db.removeCustomFont(id);
        return { success: true };
    } catch (err) {
        console.error("[main] Failed to remove custom font:", err);
        return { success: false, message: err.message };
    }
});

ipcMain.handle("delete-custom-font", (event, id) => {
    try {
        db.removeCustomFont(id);
        return { success: true };
    } catch (err) {
        console.error("[main] Failed to delete custom font:", err);
        return { success: false, message: err.message };
    }
});

/**
 * Reads a font file from disk and returns its raw bytes as a Buffer.
 * The renderer uses this to parse the TTF directly with TTFLoader.parse(), bypassing all
 * browser security restrictions around local file access. Electron serializes the Buffer over IPC
 * as a Uint8Array on the frontend, which must be converted to a clean ArrayBuffer before parsing.
 */
ipcMain.handle("read-font-buffer", async (event, filePath) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return buffer;
    } catch (err) {
        console.error("[main] Failed to read font file:", err);
        return null;
    }
});

// ─── IPC: User Profile ───────────────────────────────────────────────────────

ipcMain.handle("get-profile", () => {
    return db.getProfile();
});

ipcMain.handle("update-profile", async (event, username) => {
    db.updateProfile(username);

    // Attempt to sync to Firestore if license exists
    const state = db.getLicenseState();
    if (state && state.licenseKey && net.isOnline()) {
        try {
            const projectId = "kencreations-v2"; // Note: hardcoded for now, could be dynamic
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${state.licenseKey}?updateMask.fieldPaths=username`;

            const payload = {
                fields: {
                    username: { stringValue: username },
                },
            };

            await net.fetch(url, {
                method: "PATCH",
                body: JSON.stringify(payload),
                headers: { "Content-Type": "application/json" },
            });
        } catch (err) {
            console.error("[main] Failed to sync username to Firestore:", err);
        }
    }

    return { success: true };
});

ipcMain.handle("increment-exports", () => {
    if (!store) return { success: false, error: 'Store not initialized' };
    const currentCount = store.get('total_exports_count', 0);
    store.set('total_exports_count', currentCount + 1);
    return { success: true };
});

ipcMain.handle("get-total-exports", () => {
    if (!store) return 0;
    return store.get('total_exports_count', 0);
});

// ─── IPC: Custom Colors ──────────────────────────────────────────────────────

ipcMain.handle(
    "add-custom-color",
    (event, colorName, hexCode, brand = "Custom") => {
        const color = db.addCustomColor(colorName, hexCode, brand);
        return { success: true, color };
    },
);

/**
 * Increments the totalCustomFonts field on the user's Firestore license document.
 * Fonts are stored locally — this is just a lightweight count for the admin dashboard.
 * Uses Firebase REST PATCH with FieldTransform (increment) — no Storage cost.
 */
ipcMain.handle("increment-custom-fonts", async () => {
    try {
        db.incrementCustomFonts();
        const state = db.getLicenseState();
        if (!state?.licenseKey || !net.isOnline()) return { success: false };

        const projectId = "kencreations-v2";
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;

        const body = {
            writes: [
                {
                    transform: {
                        document: `projects/${projectId}/databases/(default)/documents/licenses/${state.licenseKey}`,
                        fieldTransforms: [
                            {
                                fieldPath: "totalCustomFonts",
                                increment: { integerValue: 1 },
                            },
                        ],
                    },
                },
            ],
        };

        await net.fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
        return { success: true };
    } catch (err) {
        console.error("[main] Failed to increment custom fonts count:", err);
        return { success: false };
    }
});

ipcMain.handle("get-custom-colors", () => {
    return db.getCustomColors();
});

ipcMain.handle("remove-custom-color", (event, id) => {
    db.removeCustomColor(id);
    return { success: true };
});

// ─── IPC: Start SyncWorker on demand ────────────────────────────────────────

/**
 * Called by the renderer once the activation is confirmed, to kick off sync.
 */
ipcMain.handle("start-sync", () => {
    const hwid = getHwid();
    const state = db.getLicenseState();
    if (state && mainWindow) {
        startSyncWorker(mainWindow, state.licenseKey, hwid);
        return { success: true };
    }
    return { success: false };
});

// ─── IPC: App Config ────────────────────────────────────────────────────────
ipcMain.handle("get-app-config", (event, key) => {
    return db.getAppConfig(key);
});

// ─── FILAMENT IPC HANDLERS ──────────────────────────────────────────
ipcMain.handle('get-filaments', async () => {
  return db.getFilaments();
});
ipcMain.handle('add-filament', async (event, data) => {
  return db.addFilament(data);
});
ipcMain.handle('update-filament', async (event, id, data) => {
  return db.updateFilament(id, data);
});
ipcMain.handle('delete-filament', async (event, id) => {
  return db.deleteFilament(id);
});

// ─── CONSUMABLES IPC HANDLERS ───────────────────────────────────────
ipcMain.handle('get-consumables', async () => {
  return db.getConsumables();
});
ipcMain.handle('add-consumable', async (event, data) => {
  return db.addConsumable(data);
});
ipcMain.handle('update-consumable', async (event, id, data) => {
  return db.updateConsumable(id, data);
});
ipcMain.handle('delete-consumable', async (event, id) => {
  return db.deleteConsumable(id);
});

// ─── IPC: Open External URL ──────────────────────────────────────────────

/**
 * Securely opens a URL in the user's default browser.
 * Only allows http:// and https:// protocols to prevent file:// or custom
 * protocol abuse from the renderer.
 */
ipcMain.handle("open-external-url", async (event, url) => {
    if (!url || typeof url !== 'string') return { success: false };
    // Security: strict protocol validation
    if (url.startsWith('https://') || url.startsWith('mailto:')) {
        await shell.openExternal(url);
        return { success: true };
    }
    return { success: false, error: 'Invalid URL scheme' };
});

//  IPC: Storefront Caching 
ipcMain.handle("sync-thumbnails", async (event, editors) => {
    if (!store) return { success: false, error: 'Store not initialized' };
    
    const userDataPath = app.getPath("userData");
    const thumbDir = path.join(userDataPath, "thumbnails");
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

    const cachedHashes = store.get('thumbnailHashes', {});
    const updatedHashes = { ...cachedHashes };
    let downloadedCount = 0;

    for (const editor of editors) {
        if (!editor.image_url) continue;
        
        const fileName = `${editor.id}.png`;
        const destPath = path.join(thumbDir, fileName);
        const currentHash = cachedHashes[editor.id];

        // Skip if hash matches and file exists
        if (currentHash === editor.image_hash && fs.existsSync(destPath)) {
            continue;
        }

        try {
            const response = await net.fetch(editor.image_url);
            if (!response.ok) continue;
            
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(destPath, Buffer.from(buffer));
            
            updatedHashes[editor.id] = editor.image_hash;
            downloadedCount++;
        } catch (err) {
            log.error(`Failed to cache thumbnail for ${editor.id}:`, err);
        }
    }

    store.set('thumbnailHashes', updatedHashes);
    return { success: true, downloadedCount };
});

// ─── IPC: Open in Slicer (Mass Produce) ──────────────────────────────────────
/**
 * Writes a 3D file buffer to a temp path and opens it with the OS-registered
 * slicer application (e.g. Bambu Studio, PrusaSlicer, OrcaSlicer).
 *
 * Uses CommonJS require() for fs and path — no dynamic import() to avoid
 * ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING in V8 bytecode builds.
 */
ipcMain.handle('open-in-slicer', async (event, { fileBuffer, fileName }) => {
    try {
        const tempPath = path.join(app.getPath('temp'), fileName || 'Mass_Produce_Batch.3mf');
        fs.writeFileSync(tempPath, Buffer.from(fileBuffer));
        const result = await shell.openPath(tempPath);
        // shell.openPath returns "" on success, or an error string
        if (result) {
            return { success: false, error: result };
        }
        return { success: true, path: tempPath };
    } catch (err) {
        log.error('[open-in-slicer] Failed:', err);
        return { success: false, error: err.message };
    }
});
