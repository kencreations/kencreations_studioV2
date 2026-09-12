/**
 * db.cjs — Encrypted local SQLite database module.
 *
 * Uses better-sqlite3 for synchronous SQLite access.
 * Sensitive payload columns (license cert, cached generator modules) are
 * encrypted/decrypted using Node's native crypto module (AES-256-GCM) before
 * being stored. The encryption key is derived from the machine's HWID so
 * the database is device-bound even if the file is extracted.
 *
 * Schema:
 *   license_state    — stores activated license cert + entitlements
 *   telemetry_queue  — offline export/usage events pending sync
 *   sync_meta        — last-sync timestamps and cached versions
 */

"use strict";

const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;
const SALT = "kencreations_db_salt_v1"; // Fixed salt; real secret comes from HWID

let _db = null;
let _encryptionKey = null;

// ─── Encryption Helpers ────────────────────────────────────────────────────

/**
 * Derives a 256-bit encryption key from the HWID using PBKDF2.
 * @param {string} hwid — raw machine ID string
 * @returns {Buffer}
 */
function deriveKey(hwid) {
    return crypto.pbkdf2Sync(hwid, SALT, 100_000, 32, "sha256");
}

/**
 * Encrypts a plaintext string. Returns a base64-encoded blob:
 * [IV (12 bytes)][AuthTag (16 bytes)][Ciphertext]
 * @param {string} plaintext
 * @returns {string} base64 encoded encrypted blob
 */
function encrypt(plaintext) {
    if (!_encryptionKey) throw new Error("DB encryption key not initialized");
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, _encryptionKey, iv, {
        authTagLength: TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts a base64-encoded blob produced by `encrypt()`.
 * @param {string} blob — base64 string
 * @returns {string} plaintext
 */
function decrypt(blob) {
    if (!_encryptionKey) throw new Error("DB encryption key not initialized");
    const data = Buffer.from(blob, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, _encryptionKey, iv, {
        authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
}

// ─── DB Initialization ─────────────────────────────────────────────────────

/**
 * Opens (or creates) the local SQLite database and runs migrations.
 * Must be called once from main.cjs before any other db calls.
 *
 * @param {string} userDataPath — app.getPath('userData')
 * @param {string} hwid         — raw machine ID for key derivation
 */
function initDb(userDataPath, hwid) {
    if (_db) return _db;

    _encryptionKey = deriveKey(hwid);

    const dbPath = path.join(userDataPath, "antigravity.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");

    // ── Schema ──────────────────────────────────────────────────────────────
    _db.exec(`
    CREATE TABLE IF NOT EXISTS license_state (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      license_key      TEXT NOT NULL,
      encrypted_cert   TEXT NOT NULL,           -- RSA-verified .lic payload (JSON, AES-256-GCM encrypted)
      entitlements     TEXT NOT NULL DEFAULT '[]', -- JSON array of entitlement IDs (plaintext for fast reads)
      entitlements_hash TEXT NOT NULL DEFAULT '', -- SHA-256 of entitlements for change detection
      status           TEXT NOT NULL DEFAULT 'active',
      expires_at       TEXT,                     -- ISO-8601 or NULL
      activated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS telemetry_queue (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      encrypted_event TEXT NOT NULL,             -- JSON event object (AES-256-GCM encrypted)
      created_at     TEXT NOT NULL,
      synced         INTEGER NOT NULL DEFAULT 0  -- 0=pending, 1=synced
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL DEFAULT 'User',
      total_exports INTEGER NOT NULL DEFAULT 0,
      total_custom_fonts INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO user_profile (id, username, total_exports) VALUES (1, 'User', 0);

    CREATE TABLE IF NOT EXISTS custom_fonts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      font_name TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      color_name TEXT NOT NULL,
      hex_code TEXT NOT NULL,
      brand TEXT DEFAULT 'Custom',
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS filaments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      brand           TEXT NOT NULL DEFAULT '',
      material        TEXT NOT NULL DEFAULT 'PLA',
      color_hex       TEXT NOT NULL DEFAULT '#000000',
      spool_weight_g  REAL NOT NULL DEFAULT 1000,
      purchase_price  REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'New',
      product_url     TEXT DEFAULT '',
      added_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consumables (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      category        TEXT NOT NULL DEFAULT 'General',
      pack_quantity   REAL NOT NULL DEFAULT 1,
      pack_price      REAL NOT NULL DEFAULT 0,
      unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
      status          TEXT NOT NULL DEFAULT 'In Stock',
      product_url     TEXT DEFAULT '',
      added_at        TEXT NOT NULL
    );
  `);

    try {
        _db.exec(
            `ALTER TABLE custom_colors ADD COLUMN brand TEXT DEFAULT 'Custom'`,
        );
    } catch (err) {
        // Column might already exist
    }

    try {
        _db.exec(
            `ALTER TABLE user_profile ADD COLUMN total_custom_fonts INTEGER NOT NULL DEFAULT 0`,
        );
    } catch (err) {
        // Column might already exist
    }

    return _db;
}

function getDb() {
    if (!_db) throw new Error("Database not initialized. Call initDb() first.");
    return _db;
}

// ─── License State ──────────────────────────────────────────────────────────

/**
 * Persists the verified license certificate and entitlements.
 * @param {object} params
 * @param {string} params.licenseKey
 * @param {object} params.certPayload  — full parsed .lic JSON
 * @param {string[]} params.entitlements
 * @param {string|null} params.expiresAt
 */
function saveLicenseState({
    licenseKey,
    certPayload,
    entitlements,
    expiresAt,
}) {
    const db = getDb();
    const encryptedCert = encrypt(JSON.stringify(certPayload));
    const entJson = JSON.stringify(entitlements);
    const entHash = crypto.createHash("sha256").update(entJson).digest("hex");

    db.prepare(
        `
    INSERT OR REPLACE INTO license_state
      (id, license_key, encrypted_cert, entitlements, entitlements_hash, status, expires_at, activated_at)
    VALUES (1, ?, ?, ?, ?, 'active', ?, ?)
  `,
    ).run(
        licenseKey,
        encryptedCert,
        entJson,
        entHash,
        expiresAt ?? null,
        new Date().toISOString(),
    );
}

/**
 * Returns the stored license state or null if not activated.
 * @returns {{ licenseKey, certPayload, entitlements, entitlementsHash, status, expiresAt, activatedAt } | null}
 */
function getLicenseState() {
    const db = getDb();
    const row = db.prepare("SELECT * FROM license_state WHERE id = 1").get();
    if (!row) return null;

    let certPayload = null;
    try {
        certPayload = JSON.parse(decrypt(row.encrypted_cert));
    } catch {
        certPayload = null;
    }

    return {
        licenseKey: row.license_key,
        certPayload,
        entitlements: JSON.parse(row.entitlements),
        entitlementsHash: row.entitlements_hash,
        status: row.status,
        expiresAt: row.expires_at,
        activatedAt: row.activated_at,
    };
}

/**
 * Updates only the entitlements (called by SyncWorker when Firestore returns changes).
 * @param {string[]} entitlements
 */
function updateEntitlements(entitlements) {
    const db = getDb();
    const entJson = JSON.stringify(entitlements);
    const entHash = crypto.createHash("sha256").update(entJson).digest("hex");
    db.prepare(
        `
    UPDATE license_state SET entitlements = ?, entitlements_hash = ? WHERE id = 1
  `,
    ).run(entJson, entHash);
}

/**
 * Clears the license state (used for deactivation / reset).
 */
function clearLicenseState() {
    const db = getDb();
    db.prepare("DELETE FROM license_state WHERE id = 1").run();
}

// ─── Telemetry Queue ────────────────────────────────────────────────────────

/**
 * Enqueues a telemetry event for later sync.
 * @param {object} eventObj — { generatorId, eventType, exportFormat?, appVersion }
 */
function enqueueTelemetry(eventObj) {
    const db = getDb();
    const payload = { ...eventObj, timestamp: new Date().toISOString() };
    const encrypted = encrypt(JSON.stringify(payload));
    db.prepare(
        `
    INSERT INTO telemetry_queue (encrypted_event, created_at, synced)
    VALUES (?, ?, 0)
  `,
    ).run(encrypted, payload.timestamp);
}

/**
 * Returns all pending (unsynced) telemetry events, decrypted.
 * @returns {Array<{ id, event }>}
 */
function getPendingTelemetry() {
    const db = getDb();
    const rows = db
        .prepare(
            "SELECT id, encrypted_event FROM telemetry_queue WHERE synced = 0",
        )
        .all();
    return rows
        .map((row) => {
            try {
                return {
                    id: row.id,
                    event: JSON.parse(decrypt(row.encrypted_event)),
                };
            } catch {
                return { id: row.id, event: null };
            }
        })
        .filter((r) => r.event !== null);
}

/**
 * Marks the given telemetry row IDs as synced.
 * @param {number[]} ids
 */
function markTelemetrySynced(ids) {
    if (!ids.length) return;
    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(
        `UPDATE telemetry_queue SET synced = 1 WHERE id IN (${placeholders})`,
    ).run(...ids);
}

// ─── Sync Meta ──────────────────────────────────────────────────────────────

function getSyncMeta(key) {
    const db = getDb();
    const row = db
        .prepare("SELECT value FROM sync_meta WHERE key = ?")
        .get(key);
    return row ? row.value : null;
}

function setSyncMeta(key, value) {
    const db = getDb();
    db.prepare(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)",
    ).run(key, String(value));
}

// ─── App Config ─────────────────────────────────────────────────────────────

function getAppConfig(key) {
    const db = getDb();
    const row = db
        .prepare("SELECT value FROM app_config WHERE key = ?")
        .get(key);
    return row ? row.value : null;
}

function setAppConfig(key, value) {
    const db = getDb();
    db.prepare(
        `
    INSERT OR REPLACE INTO app_config (key, value, updated_at)
    VALUES (?, ?, ?)
  `,
    ).run(key, value, new Date().toISOString());
}

// ─── User Profile ───────────────────────────────────────────────────────────

function getProfile() {
    const db = getDb();
    return db.prepare("SELECT * FROM user_profile WHERE id = 1").get();
}

function updateProfile(username) {
    const db = getDb();
    db.prepare("UPDATE user_profile SET username = ? WHERE id = 1").run(
        username,
    );
}

function incrementExports() {
    const db = getDb();
    db.prepare(
        "UPDATE user_profile SET total_exports = total_exports + 1 WHERE id = 1",
    ).run();
}

function incrementCustomFonts() {
    const db = getDb();
    db.prepare(
        "UPDATE user_profile SET total_custom_fonts = total_custom_fonts + 1 WHERE id = 1",
    ).run();
}

// ─── Custom Fonts ───────────────────────────────────────────────────────────

function addCustomFont(fontName, filePath) {
    const db = getDb();
    const info = db
        .prepare(
            "INSERT INTO custom_fonts (font_name, file_path, added_at) VALUES (?, ?, ?)",
        )
        .run(fontName, filePath, new Date().toISOString());
    return {
        id: info.lastInsertRowid,
        font_name: fontName,
        file_path: filePath,
    };
}

function getCustomFonts() {
    const db = getDb();
    return db
        .prepare("SELECT * FROM custom_fonts ORDER BY added_at DESC")
        .all();
}

function removeCustomFont(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM custom_fonts WHERE id = ?").get(id);
    if (row?.file_path) {
        try {
            if (require("fs").existsSync(row.file_path)) {
                require("fs").unlinkSync(row.file_path);
            }
        } catch (err) {
            console.warn(
                "[db] Failed to remove custom font file from disk:",
                err.message,
            );
        }
    }
    db.prepare("DELETE FROM custom_fonts WHERE id = ?").run(id);
}

// ─── Filaments ──────────────────────────────────────────────────────────────

function addFilament({ name, brand, material, color_hex, spool_weight_g, purchase_price, status, product_url }) {
    const db = getDb();
    const res = db.prepare(
        `INSERT INTO filaments (name, brand, material, color_hex, spool_weight_g, purchase_price, status, product_url, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, brand || '', material || 'PLA', color_hex || '#000000', spool_weight_g || 1000, purchase_price || 0, status || 'New', product_url || '', new Date().toISOString());
    return { id: res.lastInsertRowid, name, brand, material, color_hex, spool_weight_g, purchase_price, status, product_url };
}

function getFilaments() {
    return getDb().prepare('SELECT * FROM filaments ORDER BY added_at DESC').all();
}

function updateFilament(id, { name, brand, material, color_hex, spool_weight_g, purchase_price, status, product_url }) {
    getDb().prepare(
        `UPDATE filaments SET name=?, brand=?, material=?, color_hex=?, spool_weight_g=?, purchase_price=?, status=?, product_url=? WHERE id=?`
    ).run(name, brand || '', material || 'PLA', color_hex || '#000000', spool_weight_g || 1000, purchase_price || 0, status || 'New', product_url || '', id);
    return { success: true };
}

function deleteFilament(id) {
    getDb().prepare('DELETE FROM filaments WHERE id = ?').run(id);
    return { success: true };
}

// ─── Consumables ─────────────────────────────────────────────────────────────

function addConsumable({ name, category, pack_quantity, pack_price, unit_of_measure, status, product_url }) {
    const db = getDb();
    const res = db.prepare(
        `INSERT INTO consumables (name, category, pack_quantity, pack_price, unit_of_measure, status, product_url, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, category || 'General', pack_quantity || 1, pack_price || 0, unit_of_measure || 'pcs', status || 'In Stock', product_url || '', new Date().toISOString());
    return { id: res.lastInsertRowid, name, category, pack_quantity, pack_price, unit_of_measure, status, product_url };
}

function getConsumables() {
    return getDb().prepare('SELECT * FROM consumables ORDER BY added_at DESC').all();
}

function updateConsumable(id, { name, category, pack_quantity, pack_price, unit_of_measure, status, product_url }) {
    getDb().prepare(
        `UPDATE consumables SET name=?, category=?, pack_quantity=?, pack_price=?, unit_of_measure=?, status=?, product_url=? WHERE id=?`
    ).run(name, category || 'General', pack_quantity || 1, pack_price || 0, unit_of_measure || 'pcs', status || 'In Stock', product_url || '', id);
    return { success: true };
}

function deleteConsumable(id) {
    getDb().prepare('DELETE FROM consumables WHERE id = ?').run(id);
    return { success: true };
}

// ─── Custom Colors ──────────────────────────────────────────────────────────

function addCustomColor(colorName, hexCode, brand = "Custom") {
    const db = getDb();
    const stmt = db.prepare(
        "INSERT INTO custom_colors (color_name, hex_code, brand, added_at) VALUES (?, ?, ?, ?)",
    );
    const res = stmt.run(colorName, hexCode, brand, new Date().toISOString());
    return { id: res.lastInsertRowid, colorName, hexCode, brand };
}

function getCustomColors() {
    const db = getDb();
    return db
        .prepare("SELECT * FROM custom_colors ORDER BY added_at DESC")
        .all();
}

function removeCustomColor(id) {
    const db = getDb();
    db.prepare("DELETE FROM custom_colors WHERE id = ?").run(id);
}

module.exports = {
    initDb,
    getDb,
    encrypt,
    decrypt,
    // License
    saveLicenseState,
    getLicenseState,
    updateEntitlements,
    clearLicenseState,
    // Telemetry
    enqueueTelemetry,
    getPendingTelemetry,
    markTelemetrySynced,
    // Meta
    getSyncMeta,
    setSyncMeta,
    // Config
    getAppConfig,
    setAppConfig,
    // Profile
    getProfile,
    updateProfile,
    incrementExports,
    incrementCustomFonts,
    // Fonts
    addCustomFont,
    getCustomFonts,
    removeCustomFont,
    // Colors
    addCustomColor,
    getCustomColors,
    removeCustomColor,
    // Filaments
    addFilament,
    getFilaments,
    updateFilament,
    deleteFilament,
    // Consumables
    addConsumable,
    getConsumables,
    updateConsumable,
    deleteConsumable,
};
