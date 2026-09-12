import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

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
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
    } else if (err.code === "unimplemented") {
        console.warn("The current browser does not support all of the features required to enable persistence");
    }
});
