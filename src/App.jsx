import { Routes, Route, Navigate } from "react-router-dom";
import React, { useState, useEffect, useCallback } from "react";
import Home from "./pages/Home";
import DesktopHome from "./pages/DesktopHome";

import BannerNotification from "./components/BannerNotification";
import WhatsNewModal from "./components/WhatsNewModal";
import KeychainEditor from "./pages/KeychainEditor";
import CharmsEditor from "./pages/CharmsEditor";
import PencilSleeveEditor from "./pages/PencilSleeveEditor";
import StrawTopperEditor from "./pages/StrawTopperEditor";
import LeatherSliderEditor from "./pages/LeatherSliderEditor";
import LetterBeadsEditor from "./pages/LetterBeadsEditor";
import KeycapEditor from "./pages/KeycapEditor";
import ClickerEditor from "./pages/ClickerEditor";
import MacropadEditor from "./pages/MacropadEditor";
import ClientIconTag from "./pages/ClientIconTag";
import WhistleBagtagEditor from "./pages/WhistleBagtagEditor";
import MonogramInsertEditor from "./pages/MonogramInsertEditor";
import MonogramStandEditor from "./pages/MonogramStandEditor";
import QRCodeStandeeEditor from "./pages/QRCodeStandeeEditor";
import UpdateToast from "./components/UpdateToast";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProfileProvider } from "./contexts/ProfileContext";
import { TrialProvider } from "./contexts/TrialContext";
import { NotificationListener } from "./components/NotificationListener";
import { PrinterProvider } from "./contexts/PrinterContext";
/**
 * App.jsx — Root component.
 *
 * License Flow (Desktop):
 *  1. On mount, call electronAPI.checkLicense() (local DB fast-path, no network)
 *  2. If activated: render app, start sync via electronAPI.startSync()
 *  3. If not activated: render ActivationScreen
 *  4. After activation: listen for entitlement updates from SyncWorker
 *  5. If license is revoked server-side: SyncWorker pushes 'license-revoked' →
 *     clear state and return to ActivationScreen
 *
 * Entitlements:
 *  - Passed down as a prop to DesktopHome so the generator grid can filter itself.
 *  - SyncWorker can update them live without requiring an app restart.
 */
function App() {
    const [isActivated, setIsActivated] = useState(false);
    const [checking, setChecking] = useState(true);
    const [entitlements, setEntitlements] = useState([]);

    const isDesktop = !!window.electronAPI;

    // ── Startup license check ─────────────────────────────────────────────
    useEffect(() => {
        const verify = async () => {
            if (!isDesktop) {
                // Web build: always allow, no license needed
                setIsActivated(true);
                setEntitlements([]);
                setChecking(false);
                return;
            }

            try {
                const result = await window.electronAPI.checkLicense();
                if (result.activated) {
                    setIsActivated(true);
                    setEntitlements(result.entitlements || []);
                    // Kick off background sync (non-blocking)
                    window.electronAPI.startSync().catch(() => {});
                } else {
                    setIsActivated(false);
                }
            } catch (err) {
                console.error("License check failed:", err);
                setIsActivated(false);
            } finally {
                setChecking(false);
            }
        };

        verify();
    }, [isDesktop]);

    // ── Live entitlement updates from SyncWorker ─────────────────────────
    useEffect(() => {
        if (!isDesktop || !window.electronAPI?.onEntitlementsUpdated) return;

        const unsub = window.electronAPI.onEntitlementsUpdated(
            ({ entitlements: newEnt }) => {
                console.log("[App] Entitlements updated:", newEnt);
                setEntitlements(newEnt);
            },
        );

        return unsub;
    }, [isDesktop]);

    // ── License revocation handler ────────────────────────────────────────
    useEffect(() => {
        if (!isDesktop || !window.electronAPI?.onLicenseRevoked) return;

        const unsub = window.electronAPI.onLicenseRevoked(({ reason }) => {
            console.warn("[App] License revoked by server:", reason);
            setIsActivated(false);
            setEntitlements([]);
        });

        return unsub;
    }, [isDesktop]);

    // ── After activation callback (from ActivationScreen) ────────────────
    const handleActivate = useCallback((newEntitlements = []) => {
        setEntitlements(newEntitlements);
        setIsActivated(true);
        // SyncWorker is already started by main.cjs after key validation.
        // This call is a safety net for the offline path.
        if (window.electronAPI?.startSync) {
            window.electronAPI.startSync().catch(() => {});
        }
    }, []);

    // ── Loading splash ────────────────────────────────────────────────────
    if (checking) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#fff0e5] via-teal-100 to-[#00A3A3] flex items-center justify-center text-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-gray-700">
                        Verifying license...
                    </p>
                </div>
            </div>
        );
    }

    // ── Activation gate (Desktop only) - REMOVED FOR FREEMIUM MODEL ───
    // The user can access DesktopHome, but export is gated via PricingModal.

    // ── Main App ──────────────────────────────────────────────────────────
    return (
        <TrialProvider>
            <ProfileProvider>
                <PrinterProvider>
                    <ErrorBoundary>
                        {/* Global overlay components — rendered above all routes */}
                        {isDesktop && <BannerNotification />}
                        {isDesktop && <WhatsNewModal />}
                        {isDesktop && <UpdateToast />}
                        {isDesktop && <NotificationListener />}

                        <Routes>
                            <Route
                                path="/"
                                element={
                                    isDesktop ? (
                                        <DesktopHome
                                            entitlements={entitlements}
                                        />
                                    ) : (
                                        <Home />
                                    )
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    isDesktop ? (
                                        <React.Suspense
                                            fallback={
                                                <div className="p-8 text-center">
                                                    Loading Profile...
                                                </div>
                                            }>
                                            {React.createElement(
                                                React.lazy(
                                                    () =>
                                                        import("./pages/Profile"),
                                                ),
                                            )}
                                        </React.Suspense>
                                    ) : (
                                        <Navigate to="/" replace />
                                    )
                                }
                            />
                            <Route
                                path="/studio"
                                element={
                                    isDesktop ? (
                                        <React.Suspense
                                            fallback={
                                                <div className="min-h-screen bg-gradient-to-br from-[#fff0e5] via-teal-100 to-[#00A3A3] flex items-center justify-center">
                                                    <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            }>
                                            {React.createElement(
                                                React.lazy(
                                                    () =>
                                                        import("./pages/StudioHub"),
                                                ),
                                                {
                                                    isLicensed:
                                                        entitlements &&
                                                        entitlements.length > 0,
                                                },
                                            )}
                                        </React.Suspense>
                                    ) : (
                                        <Navigate to="/" replace />
                                    )
                                }
                            />
                            <Route
                                path="/editor"
                                element={<Navigate to="/" replace />}
                            />
                            <Route
                                path="/editor/namekeychain"
                                element={<KeychainEditor />}
                            />
                            <Route
                                path="/editor/charms"
                                element={<CharmsEditor />}
                            />
                            <Route
                                path="/editor/letter-beads"
                                element={<LetterBeadsEditor />}
                            />
                            <Route
                                path="/editor/keycap-maker"
                                element={<KeycapEditor />}
                            />
                            <Route
                                path="/editor/clicker-v2"
                                element={<ClickerEditor />}
                            />
                            <Route
                                path="/editor/macropad"
                                element={<MacropadEditor />}
                            />
                            <Route
                                path="/editor/pencil-sleeve"
                                element={<PencilSleeveEditor />}
                            />
                            <Route
                                path="/editor/straw-toppers"
                                element={<StrawTopperEditor />}
                            />
                            <Route
                                path="/editor/leather-sliders"
                                element={<LeatherSliderEditor />}
                            />
                            <Route
                                path="/editor/client-icon-tag"
                                element={<ClientIconTag />}
                            />
                            <Route
                                path="/editor/whistlebagtag"
                                element={<WhistleBagtagEditor />}
                            />
                            <Route
                                path="/editor/monograminsert"
                                element={<MonogramInsertEditor />}
                            />
                            <Route
                                path="/editor/monogram-stand"
                                element={<MonogramStandEditor />}
                            />
                            <Route
                                path="/editor/qr-standee"
                                element={<QRCodeStandeeEditor />}
                            />
                        </Routes>
                    </ErrorBoundary>
                </PrinterProvider>
            </ProfileProvider>
        </TrialProvider>
    );
}

export default App;
