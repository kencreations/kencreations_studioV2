export function normalizeExportFormat(format) {
    if (format === 'stl') return 'stl';
    if (format === '3mf' || format === 'threeMf') return 'threeMf';
    throw new Error('Unsupported export format.');
}
export function nextExportStats(data, format) {
    const normalized = normalizeExportFormat(format);
    for (const field of ['stlExports', 'threeMfExports', 'totalExports']) {
        if (data[field] != null && (!Number.isSafeInteger(data[field]) || data[field] < 0)) throw new Error(`Invalid counter: ${field}`);
    }
    const stl = data.stlExports ?? 0;
    const threeMf = data.threeMfExports ?? 0;
    return {
        stlExports: stl + (normalized === 'stl' ? 1 : 0),
        threeMfExports: threeMf + (normalized === 'threeMf' ? 1 : 0),
        totalExports: (data.totalExports ?? stl + threeMf) + 1,
    };
}
