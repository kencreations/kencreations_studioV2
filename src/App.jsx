import { Routes, Route, Navigate } from "react-router-dom";
import React from "react";
import { AccessProvider } from "./contexts/AccessContext";
import { GeneratorProvider } from "./hooks/useGenerators";
import GeneratorRoute from "./components/GeneratorRoute";
import BetaTrialNotice from './components/BetaTrialNotice';
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
import LithophaneEditor from "./pages/LithophaneEditor";
import ModularOrganizerEditor from "./pages/ModularOrganizerEditor";
import PopSocketEditor from "./pages/PopSocketEditor";
import MakesGallery from "./pages/MakesGallery";
import Pricing from "./pages/Pricing";
import UpdateToast from "./components/UpdateToast";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProfileProvider } from "./contexts/ProfileContext";
import { TrialProvider } from "./contexts/TrialContext";
import { AuthProvider } from "./contexts/AuthContext";
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
    const isDesktop = !!window.electronAPI;
    return (
        <AuthProvider>
            <AccessProvider>
            <GeneratorProvider>
            <TrialProvider>
                <ProfileProvider>
                    <PrinterProvider>
                        <ErrorBoundary>
                            {/* Global overlay components — rendered above all routes */}
                        {isDesktop && <BannerNotification />}
                        {isDesktop && <WhatsNewModal />}
                        {isDesktop && <UpdateToast />}
                        {isDesktop && <NotificationListener />}

                        <BetaTrialNotice />
                        <Routes>
                            <Route path="/editor/clicker" element={<Navigate to="/editor/clicker-v2" replace />} />
                            <Route path="/editor/lithophanekeychain" element={<Navigate to="/editor/lithophane" replace />} />
                            <Route path="/editor/whistle-bagtag" element={<Navigate to="/editor/whistlebagtag" replace />} />
                            <Route
                                path="/"
                                element={
                                    <DesktopHome 
                                        isWeb={!isDesktop} 
                                    />
                                }
                            />
                            <Route
                                path="/pricing"
                                element={<Pricing />}
                            />
                            <Route
                                path="/app"
                                element={<Navigate to="/" replace />}
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
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/StudioHub"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/BazaarDashboard"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/shop"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/ShopSetup"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/events"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/EventsManager"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/events/:eventId"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/EventDashboard"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/products"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/ProductManager"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/inventory"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/VariantInventory"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/events/:eventId/catalog"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        }>
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import("./pages/bazaar/EventCatalogManager"),
                                            )
                                        )}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/orders"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/OrdersManager")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/reports"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/ReportsDashboard")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/studio/bazaar/events/:eventId/reports"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/ReportsDashboard")))}
                                    </React.Suspense>
                                }
                            />
                            {/* Milestone 4 Customer Storefront Routes */}
                            <Route
                                path="/shop/:shopSlug"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerStorefront")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/shop/:shopSlug/e/:eventSlug"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerStorefront")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/shop/:shopSlug/product/:productId"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/ProductCustomizer")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/shop/:shopSlug/cart"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerCart")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/shop/:shopSlug/checkout"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerCheckout")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/order/track/:privateToken"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerOrderTracking")))}
                                    </React.Suspense>
                                }
                            />

                            {/* Backward Compatibility Aliases for Milestone 2 QR codes */}
                            <Route
                                path="/bazaar/e/:eventId"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerStorefront")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/bazaar/:slug"
                                element={
                                    <React.Suspense fallback={<div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                                        {React.createElement(React.lazy(() => import("./pages/bazaar/storefront/CustomerStorefront")))}
                                    </React.Suspense>
                                }
                            />
                            <Route
                                path="/editor"
                                element={<Navigate to="/" replace />}
                            />
                            <Route
                                path="/gallery"
                                element={<MakesGallery />}
                            />
                            <Route
                                path="/editor/insta-tag"
                                element={<Navigate to="/" replace />}
                            />
                            <Route
                                path="/editor/namekeychain"
                                element={<GeneratorRoute><KeychainEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/charms"
                                element={<GeneratorRoute><CharmsEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/letter-beads"
                                element={<GeneratorRoute><LetterBeadsEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/keycap-maker"
                                element={<GeneratorRoute><KeycapEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/clicker-v2"
                                element={<GeneratorRoute><ClickerEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/macropad"
                                element={<GeneratorRoute><MacropadEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/pencil-sleeve"
                                element={<GeneratorRoute><PencilSleeveEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/straw-toppers"
                                element={<GeneratorRoute><StrawTopperEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/leather-sliders"
                                element={<GeneratorRoute><LeatherSliderEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/lithophane"
                                element={<GeneratorRoute><LithophaneEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/client-icon-tag"
                                element={<GeneratorRoute><ClientIconTag /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/whistlebagtag"
                                element={<GeneratorRoute><WhistleBagtagEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/monograminsert"
                                element={<GeneratorRoute><MonogramInsertEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/monogram-stand"
                                element={<GeneratorRoute><MonogramStandEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/qr-standee"
                                element={<GeneratorRoute><QRCodeStandeeEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/modular-organizer"
                                element={<GeneratorRoute><ModularOrganizerEditor /></GeneratorRoute>}
                            />
                            <Route
                                path="/editor/popsocket"
                                element={<GeneratorRoute><PopSocketEditor /></GeneratorRoute>}
                            />
                            <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </ErrorBoundary>
                    </PrinterProvider>
                </ProfileProvider>
            </TrialProvider>
        </GeneratorProvider>
            </AccessProvider>
        </AuthProvider>
    );
}

export default App;
