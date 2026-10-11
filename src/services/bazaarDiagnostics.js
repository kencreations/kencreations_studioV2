export function bazaarOperation(operation, path, action, timeoutMs = 15000) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('The request timed out. Retry when your connection is available.'), { code: 'deadline-exceeded' })), timeoutMs); });
    return Promise.race([Promise.resolve().then(action), timeout]).catch(error => {
        // Callers supply document path templates, never capability tokens or PII.
        if (import.meta.env?.DEV) console.warn('[Bazaar]', { operation, path, code: error.code || 'unknown' });
        throw error;
    }).finally(() => clearTimeout(timer));
}
