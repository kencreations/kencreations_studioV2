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
        isExclusive: data.isExclusive === true || data.is_exclusive === true || (data.isExclusive == null && data.is_exclusive == null && fallback?.isExclusive === true),
        link: canonicalRoute(fallback?.link || `/editor/${id}`),
    };
}
export function exportTotal(generator) {
    const valid = value => Number.isSafeInteger(value) && value >= 0;
    if (valid(generator.totalExports)) return generator.totalExports;
    if (valid(generator.stlExports) && valid(generator.threeMfExports)) return generator.stlExports + generator.threeMfExports;
    return null;
}
export function catalogStats(generators) {
    const visible = generators.filter(g => !['hidden', 'archived', 'placeholder'].includes(String(g.status).toLowerCase()));
    const available = visible.filter(g => !['disabled', 'coming_soon', 'coming soon', 'maintenance', 'under upgrade'].includes(String(g.status).toLowerCase()));
    return {
        visible, availableCount: available.length,
        totalExports: visible.length && visible.every(g => exportTotal(g) !== null) ? visible.reduce((n, g) => n + exportTotal(g), 0) : null,
    };
}
