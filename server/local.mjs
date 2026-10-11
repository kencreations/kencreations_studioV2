// Local trusted Admin SDK adapter. Intentionally refuses production credentials/projects.
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {createBazaarServer} from './http.mjs';
const projectId='demo-kencreations-audit';
if(process.env.GCLOUD_PROJECT!==projectId || process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Use the local demo Auth/Firestore emulators. Production startup is disabled.');
initializeApp({projectId});
const db=getFirestore();
export const store={transaction:callback=>db.runTransaction(tx=>callback({
    get:async path=>{const snap=await tx.get(db.doc(path));return snap.exists?snap.data():null;},
    list:async(path,filters={})=>{
        let query=db.collection(path);
        for(const [key,value]of Object.entries(filters))query=query.where(key,'==',value);
        return (await tx.get(query)).docs.map(doc=>({id:doc.id,...doc.data()}));
    },
    set:(path,data)=>tx.set(db.doc(path),data),
}))};
export const server=createBazaarServer({store,verifyIdentity:token=>getAuth().verifyIdToken(token),allowedOrigins:['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:5192']});
server.listen(5191,'127.0.0.1',()=>console.log('Local Bazaar trusted backend: http://127.0.0.1:5191 (demo emulators only)'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
