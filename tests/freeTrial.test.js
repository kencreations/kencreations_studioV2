import test from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_FREE_TRIAL_EXPORT_LIMIT,
    isFreeTrialEligible,
    formatFreeTrialBadgeText,
    evaluateFreeTrialExport,
} from "../src/utils/freeTrialPolicy.js";
import { consumeFreeTrialInStore } from "../src/engine/licensing/freeTrialAccounting.js";
import {
    evaluateGeneratorAccess,
    evaluateExportAccess,
    summarizeLicenses,
} from "../src/utils/licensePolicy.js";
import { createExportRunner } from "../src/services/exportWorkflow.js";

// Mock Transactional In-Memory Store
function createMockStore(initialData = {}) {
    const memory = new Map(Object.entries(initialData));
    let txQueue = Promise.resolve();

    return {
        memory,
        serverTimestamp: () => new Date().toISOString(),
        transaction: async (callback) => {
            const previous = txQueue;
            let release;
            txQueue = new Promise((resolve) => { release = resolve; });
            await previous;

            try {
                const txStore = {
                    get: async (path) => {
                        const val = memory.get(path);
                        return val ? JSON.parse(JSON.stringify(val)) : null;
                    },
                    set: async (path, data) => {
                        memory.set(path, JSON.parse(JSON.stringify(data)));
                    },
                    update: async (path, data) => {
                        const existing = memory.get(path) || {};
                        memory.set(path, { ...existing, ...JSON.parse(JSON.stringify(data)) });
                    },
                };
                return await callback(txStore);
            } finally {
                release();
            }
        },
    };
}

// Fixtures
const basicStableGen = {
    id: "namekeychain",
    title: "Name Keychain",
    category: "basic",
    status: "Stable",
    isFree: true,
    link: "/editor/namekeychain",
};

const basicAnotherGen = {
    id: "screw-top-container",
    title: "Screw Top Container",
    category: "basic",
    status: "Beta",
    isFree: true,
    link: "/editor/screw-top-container",
};

const premiumGen = {
    id: "keycap-maker",
    title: "Keycap Maker",
    category: "premium",
    status: "Beta",
    link: "/editor/keycap-maker",
};

const exclusiveGen = {
    id: "charms",
    title: "Chunky Charms",
    category: "exclusive",
    status: "Stable",
    isExclusive: true,
    isVipEligible: true,
    requiredEntitlement: "charms",
    link: "/editor/charms",
};

const comingSoonGen = {
    id: "upcoming-toy",
    title: "Upcoming Toy",
    category: "basic",
    status: "Coming Soon",
    link: "/editor/upcoming-toy",
};

const maintenanceGen = {
    id: "maint-tool",
    title: "Maintenance Tool",
    category: "basic",
    status: "Under Maintenance",
    link: "/editor/maint-tool",
};

test("1. Configurable constant DEFAULT_FREE_TRIAL_EXPORT_LIMIT is present and configurable", () => {
    assert.equal(typeof DEFAULT_FREE_TRIAL_EXPORT_LIMIT, "number");
    assert.equal(DEFAULT_FREE_TRIAL_EXPORT_LIMIT, 5);

    // Dynamic limit override supported in policy
    const customEvaluator = evaluateFreeTrialExport(basicStableGen, { limit: 3, used: 0 });
    assert.equal(customEvaluator.limit, 3);
    assert.equal(customEvaluator.remaining, 3);
});

test("2. Format badge text conforms to specified UX strings", () => {
    // 5 credits at start: "Free Trial — 5 Exports"
    assert.equal(formatFreeTrialBadgeText(5, 5), "Free Trial — 5 Exports");

    // After 2 used (3 remaining): "3 Free Exports Remaining"
    assert.equal(formatFreeTrialBadgeText(3, 5), "3 Free Exports Remaining");
    assert.equal(formatFreeTrialBadgeText(1, 5), "1 Free Export Remaining");

    // At 0: "Your Free Exports Have Been Used"
    assert.equal(formatFreeTrialBadgeText(0, 5), "Your Free Exports Have Been Used");
    assert.equal(formatFreeTrialBadgeText(-1, 5), "Your Free Exports Have Been Used");
});

test("3. New free account starts with 5 credits and consumes 1 credit atomically per export", async () => {
    const store = createMockStore();
    const uid = "user_free_tester_1";

    const res1 = await consumeFreeTrialInStore(store, uid, {
        generatorId: "namekeychain",
        format: "stl",
        operationId: "op-1",
    });

    assert.equal(res1.success, true);
    assert.equal(res1.used, 1);
    assert.equal(res1.remaining, 4);
    assert.equal(res1.limit, 5);
    assert.equal(res1.idempotentRetry, false);

    const storedDoc = store.memory.get(`users/${uid}/quota/export_trial`);
    assert.equal(storedDoc.ownerUid, uid);
    assert.equal(storedDoc.used, 1);
    assert.equal(storedDoc.remaining, 4);
    assert.ok(storedDoc.operations["op-1"]);
});

test("4. 5 exports distributed across multiple Basic generators, and 6th export is blocked", async () => {
    const store = createMockStore();
    const uid = "user_free_multi_gen";

    // Export 1 (namekeychain, stl)
    const e1 = await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-1" });
    assert.equal(e1.remaining, 4);

    // Export 2 (namekeychain, 3mf)
    const e2 = await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "3mf", operationId: "op-2" });
    assert.equal(e2.remaining, 3);

    // Export 3 (screw-top-container, stl)
    const e3 = await consumeFreeTrialInStore(store, uid, { generatorId: "screw-top-container", format: "stl", operationId: "op-3" });
    assert.equal(e3.remaining, 2);

    // Export 4 (screw-top-container, 3mf)
    const e4 = await consumeFreeTrialInStore(store, uid, { generatorId: "screw-top-container", format: "3mf", operationId: "op-4" });
    assert.equal(e4.remaining, 1);

    // Export 5 (pencil-sleeve, stl)
    const e5 = await consumeFreeTrialInStore(store, uid, { generatorId: "pencil-sleeve", format: "stl", operationId: "op-5" });
    assert.equal(e5.remaining, 0);
    assert.equal(e5.used, 5);

    // Export 6 — BLOCKED by quota limit
    await assert.rejects(
        consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-6" }),
        (err) => err.code === "FREE_TRIAL_EXHAUSTED" && err.used === 5 && err.remaining === 0
    );

    // Verify stored quota state never went negative
    const finalQuota = store.memory.get(`users/${uid}/quota/export_trial`);
    assert.equal(finalQuota.used, 5);
    assert.equal(finalQuota.remaining, 0);
});

test("5. Free user cannot access Premium or VIP Exclusive generators", () => {
    const freeUserAccess = {
        currentUser: { uid: "free_user" },
        tier: "maker",
        hasActiveLicense: false,
        isVip: false,
        freeTrial: { limit: 5, used: 2, remaining: 3, isEligible: true },
    };

    // Basic tool: Allowed
    const basicCheck = evaluateGeneratorAccess(basicStableGen, freeUserAccess);
    assert.equal(basicCheck.allowed, true);

    // Premium tool: Blocked
    const premiumGenCheck = evaluateGeneratorAccess(premiumGen, freeUserAccess);
    assert.equal(premiumGenCheck.allowed, false);
    assert.equal(premiumGenCheck.reason, "PRO_REQUIRED");

    const premiumExportCheck = evaluateExportAccess(premiumGen, "stl", freeUserAccess);
    assert.equal(premiumExportCheck.allowed, false);
    assert.equal(premiumExportCheck.reason, "PRO_REQUIRED");

    // Exclusive tool: Blocked
    const exclusiveGenCheck = evaluateGeneratorAccess(exclusiveGen, freeUserAccess);
    assert.equal(exclusiveGenCheck.allowed, false);
    assert.equal(exclusiveGenCheck.reason, "EXCLUSIVE_PURCHASE_REQUIRED");

    const exclusiveExportCheck = evaluateExportAccess(exclusiveGen, "3mf", freeUserAccess);
    assert.equal(exclusiveExportCheck.allowed, false);
    assert.equal(exclusiveExportCheck.reason, "EXCLUSIVE_PURCHASE_REQUIRED");
});

test("6. Free user cannot access Coming Soon or Under Maintenance generators", () => {
    const freeUserAccess = {
        currentUser: { uid: "free_user" },
        tier: "maker",
        hasActiveLicense: false,
        isVip: false,
        freeTrial: { limit: 5, used: 0, remaining: 5, isEligible: true },
    };

    // Coming Soon blocked
    const csCheck = evaluateGeneratorAccess(comingSoonGen, freeUserAccess);
    assert.equal(csCheck.allowed, false);
    assert.equal(csCheck.reason, "UNAVAILABLE");

    // Under Maintenance blocked
    const maintCheck = evaluateGeneratorAccess(maintenanceGen, freeUserAccess);
    assert.equal(maintCheck.allowed, false);
    assert.equal(maintCheck.reason, "UNAVAILABLE");
});

test("7. Idempotent safe retries: Repeated attempts with same operationId do NOT consume extra credit", async () => {
    const store = createMockStore();
    const uid = "user_retry_test";

    // Initial export consumes credit
    const firstAttempt = await consumeFreeTrialInStore(store, uid, {
        generatorId: "namekeychain",
        format: "stl",
        operationId: "unique-op-key-12345",
    });
    assert.equal(firstAttempt.used, 1);
    assert.equal(firstAttempt.remaining, 4);
    assert.equal(firstAttempt.idempotentRetry, false);

    // Network interruption retry with identical operationId
    const retryAttempt = await consumeFreeTrialInStore(store, uid, {
        generatorId: "namekeychain",
        format: "stl",
        operationId: "unique-op-key-12345",
    });
    assert.equal(retryAttempt.success, true);
    assert.equal(retryAttempt.idempotentRetry, true);
    assert.equal(retryAttempt.used, 1); // NOT incremented
    assert.equal(retryAttempt.remaining, 4); // NOT decremented

    // Different operationId consumes next credit
    const secondOperation = await consumeFreeTrialInStore(store, uid, {
        generatorId: "namekeychain",
        format: "stl",
        operationId: "unique-op-key-67890",
    });
    assert.equal(secondOperation.used, 2);
    assert.equal(secondOperation.remaining, 3);
});

test("8. Concurrency safety: simultaneous export attempts cannot double spend or exceed quota", async () => {
    const store = createMockStore();
    const uid = "user_concurrency_test";

    // Simulate 4 credits already used (1 remaining)
    await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-1" });
    await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-2" });
    await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-3" });
    await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-4" });

    const quotaBefore = store.memory.get(`users/${uid}/quota/export_trial`);
    assert.equal(quotaBefore.remaining, 1);

    // Two simultaneous attempts competing for the last 1 credit
    const results = await Promise.allSettled([
        consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "tab-A" }),
        consumeFreeTrialInStore(store, uid, { generatorId: "screw-top-container", format: "3mf", operationId: "tab-B" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, "FREE_TRIAL_EXHAUSTED");

    const quotaAfter = store.memory.get(`users/${uid}/quota/export_trial`);
    assert.equal(quotaAfter.used, 5);
    assert.equal(quotaAfter.remaining, 0);
});

test("9. Historical trial usage is preserved when account upgrades to paid license", async () => {
    const store = createMockStore();
    const uid = "user_upgrade_history";

    // Use 2 trial credits
    await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-1" });
    await consumeFreeTrialInStore(store, uid, { generatorId: "namekeychain", format: "stl", operationId: "op-2" });

    const trialDoc = store.memory.get(`users/${uid}/quota/export_trial`);
    assert.equal(trialDoc.used, 2);
    assert.equal(trialDoc.remaining, 3);

    // Account upgrades to Pro
    const proAccess = {
        tier: "pro",
        hasActiveLicense: true,
        isVip: false,
        freeTrial: { limit: 5, used: 2, remaining: 3, isEligible: false },
    };

    // Paid user evaluates under LICENSE, not FREE_TRIAL
    const exportDecision = evaluateExportAccess(basicStableGen, "stl", proAccess);
    assert.equal(exportDecision.allowed, true);
    assert.equal(exportDecision.reason, "LICENSE");
    assert.equal(exportDecision.freeTrial, undefined); // No trial countdown shown

    // Stored trial document remains completely intact for auditing
    const auditDoc = store.memory.get(`users/${uid}/quota/export_trial`);
    assert.equal(auditDoc.used, 2);
    assert.equal(auditDoc.remaining, 3);
});

test("10. VIP and Pro subscribers never consume or see free trial credits", () => {
    const vipAccess = summarizeLicenses([{ tier: "vip", status: "active", claimedByUid: "vip_user", entitlements: ["vip"] }], {
        uid: "vip_user",
        now: Date.now(),
    });

    assert.equal(isFreeTrialEligible(vipAccess), false);

    const exportCheck = evaluateExportAccess(basicStableGen, "stl", vipAccess);
    assert.equal(exportCheck.allowed, true);
    assert.equal(exportCheck.reason, "LICENSE");
    assert.equal(exportCheck.freeTrial, undefined);
});

test("11. Developer Preview accounts can preview unreleased tools without modifying catalog or resetting trial", () => {
    const devAccess = {
        ...summarizeLicenses([{ tier: "vip", status: "active", entitlements: ["vip"] }], {
            uid: "vip_dev",
            now: Date.now(),
            developerPreview: true,
        }),
        developerPreview: true,
    };

    // Unreleased tools accessible with Developer Preview
    const csDecision = evaluateGeneratorAccess(comingSoonGen, devAccess);
    assert.equal(csDecision.allowed, true);
    assert.equal(csDecision.developerPreview, true);
    assert.equal(csDecision.originalStatus, "Coming Soon");

    const maintDecision = evaluateGeneratorAccess(maintenanceGen, devAccess);
    assert.equal(maintDecision.allowed, true);
    assert.equal(maintDecision.developerPreview, true);
    assert.equal(maintDecision.originalStatus, "Under Maintenance");

    // Catalog metadata remains unchanged
    assert.equal(comingSoonGen.status, "Coming Soon");
    assert.equal(maintenanceGen.status, "Under Maintenance");
});

test("12. Atomically consumes quota BEFORE allowing the protected download (save)", async () => {
    let quotaConsumed = false;
    let savedAfterQuota = false;

    const runner = createExportRunner({
        authorize: () => ({ allowed: true, state: "authorized", reason: "FREE_TRIAL" }),
        serialize: () => new Blob(["test-stl-bytes"]),
        consumeQuota: async () => {
            quotaConsumed = true;
            return { allowed: true };
        },
        save: async () => {
            if (quotaConsumed) savedAfterQuota = true;
            return { success: true };
        },
    });

    const result = await runner({
        getScene: () => ({}),
        format: "stl",
        filename: "test.stl",
    });

    assert.equal(result.success, true);
    assert.equal(quotaConsumed, true, "Quota must be consumed before save");
    assert.equal(savedAfterQuota, true, "Save must only occur after quota was consumed");
});

test("13. Failed quota reservation (exhausted or permission-denied) strictly aborts export and NEVER saves", async () => {
    let savedCalled = false;

    const runner = createExportRunner({
        authorize: () => ({ allowed: true, state: "authorized", reason: "FREE_TRIAL" }),
        serialize: () => new Blob(["test-stl-bytes"]),
        consumeQuota: async () => {
            return { allowed: false, reason: "FREE_TRIAL_EXHAUSTED" };
        },
        save: async () => {
            savedCalled = true;
            return { success: true };
        },
    });

    const result = await runner({
        getScene: () => ({}),
        format: "stl",
        filename: "test.stl",
    });

    assert.equal(result.success, false);
    assert.equal(result.reason, "FREE_TRIAL_EXHAUSTED");
    assert.equal(savedCalled, false, "Download must NEVER be initiated when quota fails");
});

test("14. Quota verification error fails closed and never falls back to 5 free exports", () => {
    const errorTrialAccess = {
        currentUser: { uid: "free_user" },
        tier: "maker",
        hasActiveLicense: false,
        isVip: false,
        trialStatus: "error", // Quota read/subscription failed
        exportsLeft: null,
        freeTrial: { status: "error", remaining: null, isEligible: true },
    };

    const exportCheck = evaluateExportAccess(basicStableGen, "stl", errorTrialAccess);
    assert.equal(exportCheck.allowed, false);
    assert.equal(exportCheck.reason, "QUOTA_VERIFICATION_ERROR");
});

