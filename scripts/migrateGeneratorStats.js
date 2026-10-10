import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { missingStats } from '../src/utils/statsMigration.js';

// Dry-run by default. Uses Application Default Credentials, never a committed key.
const args = process.argv.slice(2);
const project = args.find(arg => arg.startsWith('--project='))?.slice(10);
const apply = args.includes('--apply');
const confirmation = args.find(arg => arg.startsWith('--confirm-project='))?.slice(18);
if (!project || (apply && confirmation !== project)) {
    console.error('Usage: node scripts/migrateGeneratorStats.js --project=PROJECT [--apply --confirm-project=PROJECT]');
    process.exit(1);
}
initializeApp({ projectId: project, credential: applicationDefault() });
const db = getFirestore();
const snapshot = await db.collection('generators').get();
for (const generator of snapshot.docs) {
    try {
        const data = generator.data();
        const patch = missingStats(data);
        const sum = (data.stlExports ?? 0) + (data.threeMfExports ?? 0);
        if (data.totalExports !== undefined && data.totalExports !== sum) console.warn(`${generator.id}: historical totals differ; preserving all existing values.`);
        console.log(`${apply ? 'APPLY' : 'DRY RUN'} ${generator.id}: initialize ${Object.keys(patch).join(', ') || 'nothing'}`);
        if (apply && Object.keys(patch).length) {
            await db.runTransaction(async transaction => {
                const current = await transaction.get(generator.ref);
                if (!current.exists) return;
                const currentPatch = missingStats(current.data());
                if (Object.keys(currentPatch).length) transaction.update(generator.ref, currentPatch);
            });
        }
    } catch (error) { console.error(`${generator.id}: ${error.message}`); process.exitCode = 1; }
}
