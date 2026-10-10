export function missingStats(data) {
    const patch = {};
    for (const field of ['stlExports', 'threeMfExports', 'totalExports']) {
        if (data[field] !== undefined && (!Number.isSafeInteger(data[field]) || data[field] < 0)) throw new Error(`Invalid ${field}; requires manual review.`);
    }
    if (data.stlExports === undefined) patch.stlExports = 0;
    if (data.threeMfExports === undefined) patch.threeMfExports = 0;
    if (data.totalExports === undefined) patch.totalExports = (data.stlExports ?? 0) + (data.threeMfExports ?? 0);
    return patch;
}
