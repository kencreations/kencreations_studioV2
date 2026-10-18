import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeExportFormat, nextExportStats } from '../utils/exportStats';
import { canonicalGeneratorId } from '../utils/generatorCatalog';

// Client-reported analytics, NOT server-verified downloads. Rules must protect
// generator metadata. If writes are denied, downloads still complete normally.
export const ExportService = {
    async trackExport(generatorId, format, eventId = crypto.randomUUID()) {
        try {
            const canonicalId = canonicalGeneratorId(generatorId);
            if (!canonicalId || canonicalId.includes('/') || !eventId || eventId.includes('/')) return;
            const normalized = normalizeExportFormat(format);
            const generatorRef = doc(db, 'generators', canonicalId);
            const eventRef = doc(generatorRef, 'export_events', eventId);
            await runTransaction(db, async transaction => {
                const event = await transaction.get(eventRef);
                if (event.exists()) return;
                const generator = await transaction.get(generatorRef);
                if (!generator.exists()) return;
                transaction.update(generatorRef, nextExportStats(generator.data(), normalized));
                transaction.set(eventRef, { format: normalized, createdAt: serverTimestamp() });
            });
        } catch (error) {
            console.warn('Export saved; analytics could not be recorded:', error);
        }
    },
};
