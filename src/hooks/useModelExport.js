import { useRef, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAccess } from "../contexts/AccessContext";
import { useAuth } from "../contexts/AuthContext";
import { useSecureTrial } from "../contexts/TrialContext";
import { useGenerators } from "./useGenerators";
import { serializeModel } from "../engine/export/modelExport";
import { createExportRunner, saveModel } from "../services/exportWorkflow";
import { ExportService } from "../services/ExportService";
import { PointsService } from "../services/PointsService";
import { evaluateExportAccess } from "../utils/licensePolicy";
import { canonicalRoute, canonicalGeneratorId } from "../utils/generatorCatalog";

function matchGenerator(generators = [], pathname = "") {
    return (
        generators.find((g) => canonicalRoute(g.link) === canonicalRoute(pathname)) ||
        generators.find((g) => g.link === pathname)
    );
}

export function useModelExport() {
    const { pathname } = useLocation();
    const access = useAccess();
    const auth = useAuth();
    const trial = useSecureTrial();
    const catalog = useGenerators();
    const lock = useRef({ busy: false });
    const latest = useRef({ access, auth, catalog, pathname, trial });
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState("");
    useEffect(() => {
        latest.current = { access, auth, catalog, pathname, trial };
    }, [access, auth, catalog, pathname, trial]);
    const exportModel = (options) =>
        createExportRunner({
            lock: lock.current,
            authorize: () => {
                const state = latest.current;
                const generator = matchGenerator(
                    state.catalog.generators,
                    state.pathname,
                );
                let decision = evaluateExportAccess(generator, options.format, {
                    ...state.access,
                    exportsLeft: state.trial?.exportsLeft,
                    trialStatus: state.trial?.trialStatus,
                    freeTrial: state.trial?.freeTrial,
                });
                if (!window.electronAPI && state.catalog.status !== "ready")
                    decision = { allowed: false, reason: "VERIFICATION_ERROR" };
                if (!window.electronAPI && !state.auth.currentUser)
                    decision = { allowed: false, reason: "SIGN_IN_REQUIRED" };
                if (!decision.allowed)
                    setExportError(
                        decision.state === "loading"
                            ? "Verifying your license. Please wait."
                            : decision.reason === "SIGN_IN_REQUIRED"
                              ? "Sign in before exporting."
                              : decision.reason === "FREE_TRIAL_EXHAUSTED"
                                ? "Your free exports have been used. Upgrade to continue exporting."
                              : decision.reason === "PRO_REQUIRED"
                                ? "This generator requires a Pro license."
                              : decision.reason === "EXCLUSIVE_PURCHASE_REQUIRED"
                                ? "This exclusive generator requires an individual purchase."
                              : decision.state === "error" ||
                                  decision.reason === "VERIFICATION_ERROR" ||
                                  decision.reason === "QUOTA_VERIFICATION_ERROR"
                                ? "Free trial quota could not be verified. Check your connection or permissions."
                                : "Your license does not currently authorize this generator.",
                    );
                return decision;
            },
            serialize: serializeModel,
            consumeQuota: async ({ format, eventId, access }) => {
                const state = latest.current;
                const generator = matchGenerator(
                    state.catalog.generators,
                    state.pathname,
                );
                const targetId = canonicalGeneratorId(generator?.id);
                const rawStatus = String(generator?.status || '').toLowerCase().trim();
                const isUnreleased = ['coming soon', 'coming_soon', 'under maintenance', 'maintenance', 'under upgrade'].includes(rawStatus);
                const isDevPreview = !!state.access?.developerPreview || isUnreleased;

                // Development preview test export: bypass public quota consumption
                if (isUnreleased && isDevPreview) {
                    return { allowed: true };
                }

                // Paid licensees (VIP, Pro, Basic) bypass free trial quota
                if (state.access?.isVip || state.access?.hasActiveLicense || ['basic', 'pro', 'pro_plus', 'vip'].includes(state.access?.tier)) {
                    return { allowed: true };
                }

                // If trial status is loading or error, fail closed
                if (state.trial?.trialStatus === 'loading') {
                    setExportError("Verifying your free trial credits. Please wait.");
                    return { allowed: false, reason: "VERIFYING_TRIAL" };
                }
                if (state.trial?.trialStatus === 'error') {
                    setExportError("Free trial quota could not be verified. Check your permissions and retry.");
                    return { allowed: false, reason: "QUOTA_VERIFICATION_ERROR" };
                }

                // Sign in required for web free basic trial
                if (!state.auth?.currentUser) {
                    setExportError("Sign in before exporting.");
                    return { allowed: false, reason: "SIGN_IN_REQUIRED" };
                }

                try {
                    const result = await state.trial?.consumeCredit?.({
                        generatorId: targetId,
                        format,
                        operationId: eventId,
                    });

                    if (!result?.success) {
                        const reason = result?.reason || "FREE_TRIAL_EXHAUSTED";
                        setExportError("Your free exports have been used. Upgrade to continue exporting.");
                        return { allowed: false, reason };
                    }

                    return { allowed: true, quota: result };
                } catch (err) {
                    console.error("[useModelExport] Quota consumption failed before save:", err);
                    if (err.code === "FREE_TRIAL_EXHAUSTED" || err.message === "FREE_TRIAL_EXHAUSTED") {
                        setExportError("Your free exports have been used. Upgrade to continue exporting.");
                        return { allowed: false, reason: "FREE_TRIAL_EXHAUSTED", error: err };
                    }
                    if (err.code === "permission-denied") {
                        setExportError("Free trial quota permissions could not be verified on the server.");
                        return { allowed: false, reason: "PERMISSION_DENIED", error: err };
                    }
                    setExportError(err.message || "Failed to reserve export credit. Please retry.");
                    return { allowed: false, reason: "QUOTA_ERROR", error: err };
                }
            },
            save: saveModel,
            onBusy: (busy) => {
                setIsExporting(busy);
                if (busy) setExportError("");
            },
            onError: (error) =>
                setExportError(
                    error.message || "Export failed. Please try again.",
                ),
            record: async (event) => {
                const state = latest.current;
                const generator = matchGenerator(
                    state.catalog.generators,
                    state.pathname,
                );
                const targetId = canonicalGeneratorId(generator?.id);
                const rawStatus = String(generator?.status || '').toLowerCase().trim();
                const isUnreleased = ['coming soon', 'coming_soon', 'under maintenance', 'maintenance', 'under upgrade'].includes(rawStatus);
                const isDevPreview = !!state.access?.developerPreview || isUnreleased;

                if (isUnreleased && isDevPreview) {
                    // Development preview test export: mark as test activity and avoid inflating public stats
                    if (window.electronAPI) {
                        void window.electronAPI
                            .queueTelemetry?.({
                                ...event,
                                generatorId: targetId,
                                eventType: "developer_preview_export",
                                exportFormat: event.format,
                                isDeveloperPreview: true,
                                developmentTest: true,
                            })
                            .catch(() => {});
                    }
                    return;
                }

                // Desktop offline trial decrement
                if (event.authorization === "TRIAL") {
                    void state.trial?.decrementTrial?.();
                }

                // Record independent public analytics and awards
                void ExportService.trackExport(
                    targetId,
                    event.format,
                    event.eventId,
                );
                if (window.electronAPI) {
                    void window.electronAPI
                        .queueTelemetry?.({
                            ...event,
                            generatorId: targetId,
                            eventType: "export",
                            exportFormat: event.format,
                        })
                        .catch(() => {});
                    void window.electronAPI
                        .incrementExports?.()
                        .catch(() => {});
                } else if (state.auth.currentUser) {
                    void PointsService.awardPoints(
                        state.auth.currentUser.uid,
                        "export",
                        targetId,
                    );
                }
            },
        })(options);
    const generator = matchGenerator(catalog.generators, pathname);
    const exportAccess = (format) =>
        evaluateExportAccess(generator, format, {
            ...access,
            exportsLeft: trial?.exportsLeft,
            trialStatus: trial?.trialStatus,
            freeTrial: trial?.freeTrial,
        });
    return { exportModel, exportAccess, isExporting, exportError };
}
