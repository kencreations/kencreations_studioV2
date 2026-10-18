import { editors } from '../data/editors.js';

export const routeAliases = {
    '/editor/clicker': '/editor/clicker-v2',
    '/editor/lithophanekeychain': '/editor/lithophane',
    '/editor/whistle-bagtag': '/editor/whistlebagtag',
};
export const canonicalRoute = path => routeAliases[path] || path;
export function normalizeGenerator(id, data = {}) {
    const fallback = editors.find(e => e.id === id || canonicalRoute(e.link) === canonicalRoute(`/editor/${id}`));
    return {
        ...fallback, ...data, id,
        title: typeof data.title === 'string' ? data.title : fallback?.title || id,
        description: typeof data.description === 'string' ? data.description : fallback?.description || '',
        status: typeof data.status === 'string' ? data.status : fallback?.status || 'Stable',
        isExclusive: data.isExclusive === true || data.is_exclusive === true || (data.isExclusive == null && data.is_exclusive == null && fallback?.isExclusive === true),
        isRecentlyUpdated: data.isRecentlyUpdated === true,
        recentlyUpdatedAt: data.recentlyUpdatedAt || '',
        link: canonicalRoute(fallback?.link || `/editor/${id}`),
    };
}
export const generatorIdAliases = {
    'whistle-bagtag': 'whistlebagtag',
    'clicker': 'clicker-v2',
    'lithophanekeychain': 'lithophane',
};
export const canonicalGeneratorId = id => (id && generatorIdAliases[id]) ? generatorIdAliases[id] : id;

export function exportTotal(generator) {
    if (!generator || typeof generator !== 'object') return null;
    const valid = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    if (valid(generator.totalExports)) return generator.totalExports;
    const hasStl = valid(generator.stlExports);
    const hasThreeMf = valid(generator.threeMfExports);
    if (hasStl || hasThreeMf) {
        return (hasStl ? generator.stlExports : 0) + (hasThreeMf ? generator.threeMfExports : 0);
    }
    return null;
}
export function catalogStats(generators = [], options = {}) {
    const isReady = typeof options === 'boolean' ? options : options.isReady === true || options.treatMissingAsZero === true;
    const visible = generators.filter(g => !['hidden', 'archived', 'placeholder'].includes(String(g.status).toLowerCase()));
    const available = visible.filter(g => !['disabled', 'coming_soon', 'coming soon', 'maintenance', 'under maintenance', 'under upgrade'].includes(String(g.status).toLowerCase()));
    let totalExports = null;
    if (visible.length > 0) {
        if (visible.every(g => exportTotal(g) !== null)) {
            totalExports = visible.reduce((n, g) => n + exportTotal(g), 0);
        } else if (isReady) {
            totalExports = visible.reduce((n, g) => n + (exportTotal(g) ?? 0), 0);
        }
    }
    return {
        visible, availableCount: available.length,
        totalExports,
    };
}
