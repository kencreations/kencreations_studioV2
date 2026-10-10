import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from "firebase/firestore";

// TODO: Replace with your actual Firebase config object
const firebaseConfig = {
    apiKey: "AIzaSyDLHUB-DGP_pnkOZJijAih3CU7BJB2lwaw",
    authDomain: "kencreations-studio.firebaseapp.com",
    projectId: "kencreations-studio",
    storageBucket: "kencreations-studio.firebasestorage.app",
    messagingSenderId: "1040603204099",
    appId: "1:1040603204099:web:52a9a4d6c56f86f72c9c36",
    measurementId: "G-Y3KE81Y7T1",
};

// Initialize Firebase
// Emulator mode is development-only and always uses a demo project. Never
// point fixtures or emulator-clearing tests at the production project.
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const app = initializeApp(useEmulators ? { ...firebaseConfig, projectId: 'demo-kencreations-audit', apiKey: 'demo-key' } : firebaseConfig);

import { getAuth, connectAuthEmulator } from "firebase/auth";

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const auth = getAuth(app);
if (useEmulators) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

// Enable offline persistence
if (!useEmulators) enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
    } else if (err.code === "unimplemented") {
        console.warn("The current browser does not support all of the features required to enable persistence");
    }
});
