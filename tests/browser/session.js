// Test-only module loaded by the local Vite/emulator harness, never App.jsx.
import { auth } from '../../src/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
import { activateLicense } from '../../src/services/LicenseService';
export async function login() { return (await signInAnonymously(auth)).user.uid; }
export const logout = () => signOut(auth);
export const activate = key => activateLicense(key, auth.currentUser);
