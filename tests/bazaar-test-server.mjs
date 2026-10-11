// Local test backend ONLY. Never expose this process publicly or use production IDs.
import http from 'node:http';
import fs from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, runTransaction } from 'firebase/firestore';
import { submitOrder, transitionOrder, allocateStock, adjustStock } from '../src/engine/bazaar/orderWorkflow.js';

if (process.env.GCLOUD_PROJECT !== 'demo-kencreations-audit' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('This backend requires the local demo Auth and Firestore emulators.');
const environment = await initializeTestEnvironment({ projectId: 'demo-kencreations-audit', firestore: { host: '127.0.0.1', port: 8080, rules: await fs.readFile('docs/firestore.bazaar-candidate.rules', 'utf8') } });
const store = {
    transaction: callback => environment.withSecurityRulesDisabled(context => {
        const db = context.firestore();
        return runTransaction(db, tx => callback({
            get: async path => { const snap = await tx.get(doc(db, path)); return snap.exists() ? snap.data() : null; },
            set: (path, value) => tx.set(doc(db, path), value),
        }));
    }),
};
const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) { response.writeHead(403).end(); return; }
    response.setHeader('Access-Control-Allow-Origin', origin || 'http://127.0.0.1:5173');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    try {
        if (request.method !== 'POST') throw new Error('POST required.');
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 65536) throw new Error('Request too large.'); }
        const payload = JSON.parse(body);
        let result;
        if (request.url === '/submit') result = await submitOrder(store, payload);
        else {
            const token = request.headers.authorization?.replace(/^Bearer /, '');
            const account = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ idToken: token }) });
            const identity = await account.json();
            const uid = identity.users?.[0]?.localId;
            if (!account.ok || !uid) throw new Error('Seller authentication required.');
            const action = { '/transition': transitionOrder, '/allocate': allocateStock, '/adjust': adjustStock }[request.url];
            if (!action) throw new Error('Unknown operation.');
            result = await action(store, uid, payload);
        }
        response.end(JSON.stringify(result));
    } catch (error) {
        console.warn('[Bazaar test backend]', { operation: request.url, code: error.code || 'validation-failed' });
        response.writeHead(400).end(JSON.stringify({ message: error.message, code: error.code || 'validation-failed' }));
    }
});
server.listen(5191, '127.0.0.1', () => console.log('Emulator-only Bazaar backend: http://127.0.0.1:5191'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await environment.cleanup(); process.exit(0); }));
