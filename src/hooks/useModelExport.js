import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccess } from '../contexts/AccessContext';
import { useAuth } from '../contexts/AuthContext';
import { useGenerators } from './useGenerators';
import { serializeModel } from '../engine/export/modelExport';
import { createExportRunner, saveModel } from '../services/exportWorkflow';
import { ExportService } from '../services/ExportService';
import { PointsService } from '../services/PointsService';

export function useModelExport() {
    const { pathname } = useLocation();
    const access = useAccess();
    const auth = useAuth();
    const catalog = useGenerators();
    const lock = useRef({ busy: false });
    const latest = useRef({ access, auth, catalog, pathname });
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    useEffect(() => { latest.current = { access, auth, catalog, pathname }; }, [access, auth, catalog, pathname]);
    const exportModel = options => createExportRunner({
        lock: lock.current,
        authorize: () => {
            const state = latest.current;
            const generator = state.catalog.generators.find(g => g.link === state.pathname);
            let decision = state.access.evaluate(generator);
            if (!window.electronAPI && state.catalog.status !== 'ready') decision = { allowed: false, reason: 'VERIFICATION_ERROR' };
            if (!window.electronAPI && !state.auth.currentUser) decision = { allowed: false, reason: 'SIGN_IN_REQUIRED' };
            if (!decision.allowed) setExportError(decision.state === 'loading' ? 'Verifying your license. Please wait.'
                : decision.reason === 'SIGN_IN_REQUIRED' ? 'Sign in before exporting.'
                : decision.state === 'error' || decision.reason === 'VERIFICATION_ERROR' ? 'Access could not be verified. Check your connection and retry.'
                : 'Your license does not currently authorize this generator.');
            return decision;
        },
        serialize: serializeModel, save: saveModel,
        onBusy: busy => { setIsExporting(busy); if (busy) setExportError(''); },
        onError: error => setExportError(error.message || 'Export failed. Please try again.'),
        record: event => {
            const state = latest.current;
            const generator = state.catalog.generators.find(g => g.link === state.pathname);
            void ExportService.trackExport(generator?.id, event.format, event.eventId);
            if (window.electronAPI) {
                void window.electronAPI.queueTelemetry?.({ ...event, generatorId: generator?.id, eventType: 'export', exportFormat: event.format }).catch(() => {});
                void window.electronAPI.incrementExports?.().catch(() => {});
            } else if (state.auth.currentUser) {
                void PointsService.awardPoints(state.auth.currentUser.uid, 'export', generator?.id);
            }
        },
    })(options);
    return { exportModel, isExporting, exportError };
}
