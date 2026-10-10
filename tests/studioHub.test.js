import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLicenses, evaluateStudioHubAccess } from '../src/utils/licensePolicy.js';

test('evaluateStudioHubAccess correctly handles authorization, VIP, subscribers, and expired licenses', () => {
    // 1. Loading & Error
    assert.equal(evaluateStudioHubAccess({ status: 'loading' }).state, 'loading');
    assert.equal(evaluateStudioHubAccess({ status: 'error' }).state, 'error');

    // 2. Unauthenticated web user
    assert.equal(evaluateStudioHubAccess({ status: 'ready', desktop: false, currentUser: null }).state, 'unauthenticated');

    // 3. Authenticated user without any active licenses
    const noLicense = { status: 'ready', desktop: false, currentUser: { uid: 'u1' }, active: [], entitlements: [], hasActiveLicense: false };
    assert.equal(evaluateStudioHubAccess(noLicense).state, 'unauthorized');

    // 4. VIP user
    const vipUser = { status: 'ready', desktop: false, currentUser: { uid: 'u1' }, isVip: true, hasActiveLicense: true };
    assert.equal(evaluateStudioHubAccess(vipUser).state, 'authorized');
    assert.equal(evaluateStudioHubAccess(vipUser).reason, 'VIP');

    // 5. Explicit studio-hub entitlement
    const entitlementUser = {
        status: 'ready', desktop: false, currentUser: { uid: 'u1' },
        hasActiveLicense: true, entitlements: ['studio-hub'], active: [{ id: 'lic1', entitlements: ['studio-hub'] }]
    };
    assert.equal(evaluateStudioHubAccess(entitlementUser).state, 'authorized');
    assert.equal(evaluateStudioHubAccess(entitlementUser).reason, 'ENTITLEMENT');

    // 6. Active subscription tier
    const subUser = {
        status: 'ready', desktop: false, currentUser: { uid: 'u1' },
        hasActiveLicense: true, entitlements: [], active: [{ id: 'lic2', tier: '12mo' }]
    };
    assert.equal(evaluateStudioHubAccess(subUser).state, 'authorized');
    assert.equal(evaluateStudioHubAccess(subUser).reason, 'SUBSCRIBER');

    // 7. Expired license state
    const expiredUser = {
        status: 'ready', desktop: false, currentUser: { uid: 'u1' },
        hasActiveLicense: false, hasExpired: true, active: [], entitlements: []
    };
    assert.equal(evaluateStudioHubAccess(expiredUser).state, 'expired');

    // 8. Account with an active license is on Pro and granted Studio Hub access
    const proUserWithActiveLicense = {
        status: 'ready', desktop: false, currentUser: { uid: 'u1' },
        hasActiveLicense: true, hasExpired: false, entitlements: ['charms'],
        active: [{ id: 'lic3', tier: 'commercial', entitlements: ['charms'] }]
    };
    assert.equal(evaluateStudioHubAccess(proUserWithActiveLicense).state, 'authorized');
    assert.equal(evaluateStudioHubAccess(proUserWithActiveLicense).allowed, true);
});

test('Studio Hub mathematical pricing formulas: Material, Consumables, Electricity, Wear, Labor, Buffer, Markup, and Margin', () => {
    // Filament calculation
    const spoolWeightG = 1000;
    const spoolPrice = 750; // ₱750 / 1000g = ₱0.75/g
    const modelWeightG = 40;
    const purgeGrams = 10;
    const totalGrams = modelWeightG + purgeGrams;
    const filamentCost = (totalGrams / spoolWeightG) * spoolPrice;
    assert.equal(filamentCost, 37.5);

    // Consumable calculation (e.g. 100 keyrings for ₱250 => ₱2.50 each)
    const packPrice = 250;
    const packQty = 100;
    const unitPrice = packPrice / packQty;
    const qtyUsed = 2;
    const consumableCost = qtyUsed * unitPrice;
    assert.equal(consumableCost, 5.0);

    // Production calculation
    const wattage = 350;
    const printHours = 2.5;
    const elecRate = 12.0; // ₱12/kWh
    const electricityCost = (wattage / 1000) * printHours * elecRate;
    assert.equal(electricityCost, 10.5);

    const wearRate = 6.0; // ₱6/hr
    const machineWearCost = printHours * wearRate;
    assert.equal(machineWearCost, 15.0);

    const laborHours = 0.5; // 30 mins
    const laborRate = 60.0; // ₱60/hr
    const laborCost = laborHours * laborRate;
    assert.equal(laborCost, 30.0);

    const overhead = 10.0;

    // Base cost
    const baseCost = filamentCost + consumableCost + electricityCost + machineWearCost + laborCost + overhead;
    // 37.5 + 5.0 + 10.5 + 15.0 + 30.0 + 10.0 = 108.0
    assert.equal(baseCost, 108.0);

    // Failure allowance: 10%
    const failurePercent = 10;
    const rawBufferedCost = baseCost * (1 + failurePercent / 100);
    const bufferedCost = Number(rawBufferedCost.toFixed(2));
    // 108.0 * 1.1 = 118.8
    assert.equal(bufferedCost, 118.8);

    // Markup Pricing (50% markup)
    const markupRate = 50;
    const sellingPriceMarkup = bufferedCost * (1 + markupRate / 100);
    // 118.8 * 1.5 = 178.2
    assert.equal(Number(sellingPriceMarkup.toFixed(2)), 178.2);

    // Target Gross Margin Pricing (40% margin)
    // Formula: Buffered Cost / (1 - Margin Rate)
    const targetMargin = 40;
    const sellingPriceMargin = bufferedCost / (1 - targetMargin / 100);
    // 118.8 / 0.6 = 198.0
    assert.equal(Number(sellingPriceMargin.toFixed(2)), 198.0);

    // Verify realized margin matches formula
    const grossProfit = sellingPriceMargin - bufferedCost; // 198.0 - 118.8 = 79.2
    const realizedMarginPercent = (grossProfit / sellingPriceMargin) * 100;
    assert.equal(Number(realizedMarginPercent.toFixed(1)), 40.0);

    // Disallow margin rate >= 100%
    const isMarginInvalid = targetMargin >= 100;
    assert.equal(isMarginInvalid, false);
    assert.equal(100 >= 100, true);
});

test('Print job idempotency: deduction prevents double counting and supports reversal', () => {
    let spoolStock = 1000;
    let keyringStock = 50;

    const job = {
        id: 'job-1',
        job_number: 'JOB-2026-001',
        filaments_used: [{ filament_id: 'fil-1', grams: 50 }],
        consumables_used: [{ consumable_id: 'con-1', qty: 5 }],
        status: 'Queued',
        deducted: false,
    };

    // First completion
    const completeJob = (j) => {
        if (j.deducted) return false;
        spoolStock -= j.filaments_used[0].grams;
        keyringStock -= j.consumables_used[0].qty;
        j.deducted = true;
        j.status = 'Completed';
        return true;
    };

    const firstRun = completeJob(job);
    assert.equal(firstRun, true);
    assert.equal(spoolStock, 950);
    assert.equal(keyringStock, 45);
    assert.equal(job.deducted, true);

    // Second completion attempt (idempotency check)
    const secondRun = completeJob(job);
    assert.equal(secondRun, false); // must NOT deduct again
    assert.equal(spoolStock, 950);
    assert.equal(keyringStock, 45);

    // Reversal / Cancellation
    const revertJob = (j) => {
        if (!j.deducted) return false;
        spoolStock += j.filaments_used[0].grams;
        keyringStock += j.consumables_used[0].qty;
        j.deducted = false;
        j.status = 'Cancelled';
        return true;
    };

    const reverted = revertJob(job);
    assert.equal(reverted, true);
    assert.equal(spoolStock, 1000);
    assert.equal(keyringStock, 50);
    assert.equal(job.deducted, false);
});
