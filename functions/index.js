const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function to securely increment generator export statistics.
 * This runs securely on the backend, bypassing client-side write protections.
 * Uses a unique eventId and Firestore transaction to ensure idempotency (no duplicate counting).
 */
exports.trackExport = onCall({ cors: true }, async (request) => {
    // 1. Validate Input
    const { generatorId, format, eventId } = request.data;
    
    if (!generatorId || !format || !eventId) {
        throw new HttpsError('invalid-argument', 'Missing required fields: generatorId, format, eventId');
    }
    
    if (format !== 'stl' && format !== 'threeMf') {
        throw new HttpsError('invalid-argument', 'Format must be either stl or threeMf');
    }

    const db = admin.firestore();
    const generatorRef = db.collection('generators').doc(generatorId);
    
    // We use a subcollection inside the generator doc to store processed events
    const eventRef = generatorRef.collection('export_events').doc(eventId);

    try {
        await db.runTransaction(async (t) => {
            // 2. Check Idempotency
            const eventDoc = await t.get(eventRef);
            if (eventDoc.exists) {
                // We've already processed this exact export event. Exit silently.
                return;
            }

            // 3. Fetch current generator stats
            const genDoc = await t.get(generatorRef);
            if (!genDoc.exists) {
                throw new HttpsError('not-found', 'Generator document not found.');
            }

            const data = genDoc.data();
            
            // 4. Calculate new values (initialize to 0 if missing)
            const currentTotal = typeof data.totalExports === 'number' ? data.totalExports : 0;
            const currentStl = typeof data.stlExports === 'number' ? data.stlExports : 0;
            const currentThreeMf = typeof data.threeMfExports === 'number' ? data.threeMfExports : 0;

            const updateData = {
                totalExports: currentTotal + 1
            };

            if (format === 'stl') {
                updateData.stlExports = currentStl + 1;
                // Preserve the other format if it's missing from the document
                if (data.threeMfExports === undefined) {
                    updateData.threeMfExports = currentThreeMf;
                }
            } else if (format === 'threeMf') {
                updateData.threeMfExports = currentThreeMf + 1;
                // Preserve the other format if it's missing from the document
                if (data.stlExports === undefined) {
                    updateData.stlExports = currentStl;
                }
            }

            // 5. Commit Updates
            // Update the generator document with new counters
            t.update(generatorRef, updateData);
            
            // Record the event to prevent duplicate counting in the future
            t.set(eventRef, {
                format,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                uid: request.auth ? request.auth.uid : 'anonymous'
            });
        });
        
        return { success: true };
    } catch (error) {
        console.error("Transaction failed during trackExport:", error);
        throw new HttpsError('internal', 'An error occurred while tracking the export.', error.message);
    }
});

/**
 * Cloud Function to securely activate an unclaimed license key.
 * Authoritatively claims the key for the authenticated user and preserves immutable server fields.
 */
exports.activateLicense = onCall({ cors: true }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'Sign in to activate a license.');
    }
    const uid = request.auth.uid;
    const { licenseKey, hwid } = request.data || {};
    const key = String(licenseKey || '').trim();
    if (!key || key.includes('/')) {
        throw new HttpsError('invalid-argument', 'Enter a valid license code.');
    }

    const db = admin.firestore();
    const licenseRef = db.collection('licenses').doc(key);

    try {
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(licenseRef);
            if (!snap.exists) {
                throw new HttpsError('not-found', 'Invalid License Code.');
            }
            const license = snap.data();
            const now = Date.now();

            if (license.disabled === true || license.revoked === true || !['active', 'unclaimed', 'pending'].includes(license.status)) {
                throw new HttpsError('failed-precondition', 'This license is not available for activation.');
            }

            const rawExp = license.expiresAt ?? license.expires_at;
            let expiry = Infinity;
            if (rawExp != null && rawExp !== '') {
                if (typeof rawExp.toMillis === 'function') expiry = rawExp.toMillis();
                else if (typeof rawExp.seconds === 'number') expiry = rawExp.seconds * 1000;
                else expiry = typeof rawExp === 'number' ? rawExp : Date.parse(rawExp);
            }
            if (Number.isNaN(expiry) || expiry <= now) {
                throw new HttpsError('failed-precondition', 'This license has expired or has an invalid expiration date.');
            }

            if (license.claimedByUid && license.claimedByUid !== uid) {
                throw new HttpsError('permission-denied', 'This license is already bound to another Google account.');
            }

            if (hwid && license.hwid && license.hwid !== hwid) {
                throw new HttpsError('permission-denied', 'This license is bound to a different desktop device.');
            }

            // Idempotent retry for current owner
            if (license.claimedByUid === uid) {
                if (hwid && !license.hwid) {
                    tx.update(licenseRef, {
                        hwid,
                        hwidBoundAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                return {
                    success: true,
                    message: 'License already active on your account.',
                    license: {
                        id: key,
                        licenseKey: key,
                        status: license.status || 'active',
                        tier: license.tier || license.plan_type || 'standard',
                        entitlements: Array.isArray(license.entitlements) ? license.entitlements : [],
                        expiresAt: license.expiresAt ?? license.expires_at ?? null,
                    },
                    idempotent: true,
                };
            }

            // Atomic claim preserving immutable server properties
            const updatePayload = {
                claimedByUid: uid,
                status: 'active',
                claimedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (hwid) {
                updatePayload.hwid = hwid;
                updatePayload.hwidBoundAt = admin.firestore.FieldValue.serverTimestamp();
            }

            tx.update(licenseRef, updatePayload);

            return {
                success: true,
                message: 'License activated successfully!',
                license: {
                    id: key,
                    licenseKey: key,
                    status: 'active',
                    tier: license.tier || license.plan_type || 'standard',
                    entitlements: Array.isArray(license.entitlements) ? license.entitlements : [],
                    expiresAt: license.expiresAt ?? license.expires_at ?? null,
                },
                idempotent: false,
            };
        });

        return result;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'License activation failed.');
    }
});

