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
