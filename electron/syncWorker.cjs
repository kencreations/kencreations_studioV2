/**
 * syncWorker.cjs — Background online sync loop.
 *
 * Responsibilities:
 *  1. Flush offline telemetry queue → Firebase (HTTPS POST batch)
 *  2. Poll license entitlements for changes → update local DB
 *  3. Poll active notifications → push to renderer via IPC
 *  4. Poll latest update entry → push to renderer via IPC
 *
 * Design:
 *  - Runs as a setInterval in the Electron main process (not a Web Worker).
 *  - Uses net.isOnline() before each sync attempt.
 *  - All Firebase calls are raw HTTPS (no Firebase SDK).
 *  - Each sync cycle is debounced: if one is in progress, the next is skipped.
 *
 * Called from main.cjs: startSyncWorker(mainWindow, licenseKey, hwid)
 */

'use strict';

const { net } = require('electron');
const https = require('https');
const getMod = (n) => { try { return require(`./${n}.cjs`); } catch(e) { return require(`./${n}.jsc`); } };
const db = getMod('db');
const { firestoreGet, parseFirestoreDoc } = getMod('licenseManager');

const FIREBASE_PROJECT_ID = 'kencreations-studio';
const FIREBASE_API_KEY = 'AIzaSyDLHUB-DGP_pnkOZJijAih3CU7BJB2lwaw';
const SYNC_INTERVAL_MS = 60_000; // 60 seconds
const APP_VERSION = require('../package.json').version;

let _syncInterval = null;
let _syncInProgress = false;

// ─── HTTPS Helpers ───────────────────────────────────────────────────────────

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}`));
          else resolve({});
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('POST timed out')); });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Firestore REST query — returns array of matching documents.
 * Used to query notifications and updates collections.
 */
async function firestoreQuery(collection, filters) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 20,
    },
  };

  if (filters && filters.length > 0) {
    body.structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(f => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op,
            value: f.value,
          },
        })),
      },
    };
  }
  try {
    const results = await httpsPost(url, body);
    if (!Array.isArray(results)) return [];
    return results
      .filter(r => r.document)
      .map(r => ({
        id: r.document.name.split('/').pop(),
        ...parseFirestoreDoc(r.document),
      }));
  } catch (err) {
    console.error('[syncWorker] firestoreQuery error:', err.message);
    return [];
  }
}

// ─── Telemetry Flush ─────────────────────────────────────────────────────────

/**
 * Flushes all pending telemetry events to Firestore.
 * Uses the Firestore batch write (commitbatch) REST endpoint.
 * @param {string} licenseKey
 * @param {string} hwid
 */
async function flushTelemetry(licenseKey, hwid) {
  const pending = db.getPendingTelemetry();
  if (!pending.length) return;

  console.log(`[syncWorker] Flushing ${pending.length} telemetry event(s)...`);

  const writes = pending.map(({ event }) => ({
    update: {
      name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/telemetry/${Date.now()}_${Math.random().toString(36).slice(2)}`,
      fields: {
        licenseKey: { stringValue: licenseKey },
        hwid: { stringValue: hwid },
        generatorId: { stringValue: event.generatorId || 'unknown' },
        eventType: { stringValue: event.eventType || 'export' },
        exportFormat: event.exportFormat ? { stringValue: event.exportFormat } : { nullValue: null },
        timestamp: { timestampValue: event.timestamp },
        appVersion: { stringValue: APP_VERSION },
        syncedAt: { timestampValue: new Date().toISOString() },
      },
    },
  }));

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit?key=${FIREBASE_API_KEY}`;
    await httpsPost(url, { writes });

    const syncedIds = pending.map(p => p.id);
    db.markTelemetrySynced(syncedIds);
    console.log(`[syncWorker] Telemetry flush OK. Marked ${syncedIds.length} as synced.`);
  } catch (err) {
    console.error('[syncWorker] Telemetry flush failed:', err.message);
  }
}

// ─── Entitlement Sync ────────────────────────────────────────────────────────

/**
 * Checks if entitlements on Firestore have changed since last sync.
 * If changed, updates local DB and pushes change event to renderer.
 * @param {string} licenseKey
 * @param {string} hwid
 * @param {Electron.BrowserWindow} mainWindow
 */
async function syncEntitlements(licenseKey, hwid, mainWindow) {
  try {
    const doc = await firestoreGet('licenses', licenseKey);
    if (!doc) return;

    const data = parseFirestoreDoc(doc);
    if (!data) return;

    // Check if revoked
    if (data.status === 'revoked' || data.status === 'expired') {
      console.warn('[syncWorker] License revoked/expired on server. Locking app.');
      db.clearLicenseState();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('license-revoked', { reason: data.status });
      }
      return;
    }

    const localState = db.getLicenseState();
    if (!localState) return;

    const remoteEntitlements = data.entitlements || [];
    const remoteEntJson = JSON.stringify(remoteEntitlements.sort());
    const remoteHash = require('crypto').createHash('sha256').update(remoteEntJson).digest('hex');

    if (remoteHash !== localState.entitlementsHash) {
      console.log('[syncWorker] Entitlement change detected. Updating local DB...');
      db.updateEntitlements(remoteEntitlements);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('entitlements-updated', {
          entitlements: remoteEntitlements,
        });
      }
    }

    // Write lastSync timestamp back to Firestore
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/licenses/${encodeURIComponent(licenseKey)}?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=lastSyncAt`;
    const patchBody = {
      fields: { lastSyncAt: { timestampValue: new Date().toISOString() } },
    };
    try {
      const urlObj = new URL(patchUrl);
      await new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(patchBody);
        const req = https.request(
          { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
          },
          res => { res.on('data', () => {}); res.on('end', resolve); }
        );
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
      });
    } catch { /* non-critical */ }

  } catch (err) {
    console.error('[syncWorker] syncEntitlements error:', err.message);
  }
}

// ─── Notification Sync ───────────────────────────────────────────────────────

/**
 * Fetches active notifications relevant to this license key.
 * Sends any unseen ones to the renderer.
 * @param {string} licenseKey
 * @param {Electron.BrowserWindow} mainWindow
 */
async function syncNotifications(licenseKey, mainWindow) {
  try {
    const notifications = await firestoreQuery('notifications', []);

    const newNotifs = notifications.filter(n => {
      // Must be active
      if (n.isActive !== true) return false;
      // Skip expired
      if (n.expiresAt && new Date(n.expiresAt) < new Date()) return false;
      // Skip targeted notifications that don't include this key
      if (n.target === 'targeted' && Array.isArray(n.targetKeys) && !n.targetKeys.includes(licenseKey)) return false;
      // Skip if dismissed by user
      return db.getSyncMeta('dismissed_notif_' + n.id) !== '1';
    });

    if (newNotifs.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
      for (const notif of newNotifs) {
        mainWindow.webContents.send('new-notification', {
          id: notif.id,
          title: notif.title,
          body: notif.body,
          type: notif.type || 'info',
        });
      }
    }
  } catch (err) {
    console.error('[syncWorker] syncNotifications error:', err.message);
  }
}

// ─── Update Sync ─────────────────────────────────────────────────────────────

/**
 * Fetches the latest active update entry and notifies the renderer if it's new.
 * @param {Electron.BrowserWindow} mainWindow
 */
async function syncUpdates(mainWindow) {
  try {
    const lastSeenVersion = db.getSyncMeta('last_seen_update_version') || '';

    const updates = await firestoreQuery('updates', []);

    // Filter to only active updates locally
    const activeUpdates = updates.filter(u => u.isActive === true);
    if (!activeUpdates.length) return;

    const latest = activeUpdates[0]; // Already sorted by createdAt DESC
    if (!latest || !latest.version) return;

    const isNew = latest.version !== lastSeenVersion;
    const forcePrompt = latest.forcePrompt === true;

    if (isNew || forcePrompt) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-update', {
          version: latest.version,
          title: latest.title,
          changelog: latest.changelog,
          forcePrompt: latest.forcePrompt || false,
        });
      }
      if (isNew) {
        db.setSyncMeta('last_seen_update_version', latest.version);
      }
    }
  } catch (err) {
    console.error('[syncWorker] syncUpdates error:', err.message);
  }
}

// ─── App Config Sync ─────────────────────────────────────────────────────────

/**
 * Fetches the global filament brands and colors configuration.
 */
async function syncFilamentBrands(mainWindow) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/app_config/filament_brands?key=${FIREBASE_API_KEY}`;
    
    // We use standard GET for a single document
    const res = await new Promise((resolve, reject) => {
      const req = https.get(url, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          if (r.statusCode >= 400 && r.statusCode !== 404) reject(new Error(`HTTP ${r.statusCode}`));
          else resolve(data ? JSON.parse(data) : null);
        });
      });
      req.on('error', reject);
    });

    if (res && res.fields) {
      // The document is stored as a JSON string under a "data" field to avoid deep mapValue nesting limits
      const brandsData = res.fields.data ? res.fields.data.stringValue : null;
      if (brandsData) {
        db.setAppConfig('filament_brands', brandsData);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('filament-brands-updated');
        }
      }
    }
  } catch (err) {
    console.error('[syncWorker] syncFilamentBrands error:', err.message);
  }
}

// ─── Main Sync Cycle ─────────────────────────────────────────────────────────

/**
 * Runs a full sync cycle if online and not already in progress.
 * @param {Electron.BrowserWindow} mainWindow
 * @param {string} licenseKey
 * @param {string} hwid
 */
async function runSyncCycle(mainWindow, licenseKey, hwid) {
  if (_syncInProgress) {
    console.log('[syncWorker] Sync already in progress, skipping cycle.');
    return;
  }

  if (!net.isOnline()) {
    console.log('[syncWorker] Offline — skipping sync cycle.');
    return;
  }

  _syncInProgress = true;
  console.log('[syncWorker] Starting sync cycle...');

  try {
    await Promise.allSettled([
      flushTelemetry(licenseKey, hwid),
      syncEntitlements(licenseKey, hwid, mainWindow),
      syncNotifications(licenseKey, mainWindow),
      syncUpdates(mainWindow),
      syncFilamentBrands(mainWindow),
    ]);

    db.setSyncMeta('last_full_sync', new Date().toISOString());
    console.log('[syncWorker] Sync cycle complete.');
  } catch (err) {
    console.error('[syncWorker] Unexpected sync error:', err.message);
  } finally {
    _syncInProgress = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Starts the background sync worker. Called once from main.cjs after activation.
 * @param {Electron.BrowserWindow} mainWindow
 * @param {string} licenseKey
 * @param {string} hwid
 */
function startSyncWorker(mainWindow, licenseKey, hwid) {
  // Always run immediately when called to handle UI refreshes
  runSyncCycle(mainWindow, licenseKey, hwid);

  if (_syncInterval) return; // Already running interval

  console.log('[syncWorker] Starting background sync worker...');

  _syncInterval = setInterval(() => {
    runSyncCycle(mainWindow, licenseKey, hwid);
  }, SYNC_INTERVAL_MS);
}

/**
 * Stops the background sync worker.
 */
function stopSyncWorker() {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    console.log('[syncWorker] Stopped.');
  }
}

module.exports = { startSyncWorker, stopSyncWorker };
