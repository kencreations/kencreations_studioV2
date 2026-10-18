import test from "node:test";
import assert from "node:assert/strict";
import {
    summarizeLicenses,
    resolveAccountEntitlements,
    evaluateGeneratorAccess,
    evaluateExportAccess,
    evaluateStudioHubAccess,
    evaluateBazaarAccess,
} from "../src/utils/licensePolicy.js";
import { mergeTargetClaims } from "file:///C:/Users/Ken/Desktop/kencreations-admin/scripts/sync-claims.mjs";

const now = Date.parse("2026-10-18T00:00:00Z");
const options = { uid: "ken_dev_tester", now };

const makeLicense = (extra = {}) => ({
    status: "active",
    claimedByUid: "ken_dev_tester",
    tier: "basic",
    isPerpetual: true,
    entitlements: [],
    ...extra,
});

// Generator fixtures
const stableBasicGen = {
    id: "namekeychain",
    category: "basic",
    status: "Stable",
    isFree: true,
    link: "/editor/namekeychain",
};

const comingSoonBasicGen = {
    id: "upcoming-basic-toy",
    category: "basic",
    status: "Coming Soon",
    isFree: true,
    link: "/editor/upcoming-basic-toy",
};

const maintenanceBasicGen = {
    id: "upgrading-basic-tool",
    category: "basic",
    status: "Under Maintenance",
    isFree: true,
    link: "/editor/upgrading-basic-tool",
};

const comingSoonPremiumGen = {
    id: "upcoming-pro-widget",
    category: "premium",
    status: "Coming Soon",
    isExclusive: false,
    link: "/editor/upcoming-pro-widget",
};

const comingSoonExclusiveGen = {
    id: "upcoming-exclusive-sculpture",
    category: "exclusive",
    status: "Coming Soon",
    isExclusive: true,
    isVipEligible: true,
    requiredEntitlement: "sculpture",
    link: "/editor/upcoming-exclusive-sculpture",
};

const comingSoonNonVipExclusiveGen = {
    id: "upcoming-custom-client-deal",
    category: "exclusive",
    status: "Coming Soon",
    isExclusive: true,
    isVipEligible: false,
    requiredEntitlement: "deal-entitlement",
    link: "/editor/upcoming-custom-client-deal",
};

test("Scenario 1: Regular Basic account — Coming Soon blocked", () => {
    const basicSummary = summarizeLicenses([makeLicense({ tier: "basic" })], options);
    assert.equal(basicSummary.developerPreview, false);

    const access = evaluateGeneratorAccess(comingSoonBasicGen, basicSummary);
    assert.equal(access.allowed, false);
    assert.equal(access.state, "unauthorized");
    assert.equal(access.reason, "UNAVAILABLE");
});

test("Scenario 2: Regular Pro account — Coming Soon blocked", () => {
    const proSummary = summarizeLicenses([makeLicense({ tier: "pro" })], options);
    assert.equal(proSummary.developerPreview, false);

    const accessBasic = evaluateGeneratorAccess(comingSoonBasicGen, proSummary);
    assert.equal(accessBasic.allowed, false);
    assert.equal(accessBasic.reason, "UNAVAILABLE");

    const accessPremium = evaluateGeneratorAccess(comingSoonPremiumGen, proSummary);
    assert.equal(accessPremium.allowed, false);
    assert.equal(accessPremium.reason, "UNAVAILABLE");
});

test("Scenario 3: Regular VIP account — Coming Soon blocked (VIP alone must NOT grant developer access)", () => {
    const vipSummary = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], options);
    assert.equal(vipSummary.isVip, true);
    assert.equal(vipSummary.developerPreview, false);

    // Blocked on Coming Soon
    const csAccess = evaluateGeneratorAccess(comingSoonBasicGen, vipSummary);
    assert.equal(csAccess.allowed, false);
    assert.equal(csAccess.reason, "UNAVAILABLE");

    // Blocked on Maintenance
    const maintAccess = evaluateGeneratorAccess(maintenanceBasicGen, vipSummary);
    assert.equal(maintAccess.allowed, false);
    assert.equal(maintAccess.reason, "UNAVAILABLE");
});

test("Scenario 4: Developer Preview account with required generator entitlement — Coming Soon accessible", () => {
    // 4A: Basic dev account on Coming Soon Basic generator
    const basicDevSummary = summarizeLicenses([makeLicense({ tier: "basic" })], {
        ...options,
        developerPreview: true,
    });
    assert.equal(basicDevSummary.developerPreview, true);

    const basicCsAccess = evaluateGeneratorAccess(comingSoonBasicGen, basicDevSummary);
    assert.equal(basicCsAccess.allowed, true);
    assert.equal(basicCsAccess.state, "authorized");
    assert.equal(basicCsAccess.developerPreview, true);
    assert.equal(basicCsAccess.originalStatus, "Coming Soon");
    assert.equal(basicCsAccess.isComingSoon, true);
    assert.equal(basicCsAccess.isUnderMaintenance, false);
    assert.equal(typeof basicCsAccess.warningMessage, "string");

    // 4B: Pro dev account on Coming Soon Premium generator
    const proDevSummary = summarizeLicenses([makeLicense({ tier: "pro" })], {
        ...options,
        developerPreview: true,
    });
    const proCsAccess = evaluateGeneratorAccess(comingSoonPremiumGen, proDevSummary);
    assert.equal(proCsAccess.allowed, true);
    assert.equal(proCsAccess.state, "authorized");
    assert.equal(proCsAccess.developerPreview, true);

    // 4C: VIP dev account on Coming Soon VIP-eligible Exclusive generator
    const vipDevSummary = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], {
        ...options,
        developerPreview: true,
    });
    const vipCsAccess = evaluateGeneratorAccess(comingSoonExclusiveGen, vipDevSummary);
    assert.equal(vipCsAccess.allowed, true);
    assert.equal(vipCsAccess.state, "authorized");
    assert.equal(vipCsAccess.developerPreview, true);

    // 4D: Individual purchased exclusive entitlement + developer preview
    const exclusivePurchasedDevSummary = summarizeLicenses([
        makeLicense({ tier: "basic" }),
        makeLicense({ entitlements: ["sculpture"] })
    ], {
        ...options,
        developerPreview: true,
    });
    const individualCsAccess = evaluateGeneratorAccess(comingSoonExclusiveGen, exclusivePurchasedDevSummary);
    assert.equal(individualCsAccess.allowed, true);
    assert.equal(individualCsAccess.state, "authorized");
});

test("Scenario 5: Developer Preview account with required entitlement — Under Maintenance accessible with warning", () => {
    const devSummary = summarizeLicenses([makeLicense({ tier: "basic" })], {
        ...options,
        developerPreview: true,
    });

    const maintAccess = evaluateGeneratorAccess(maintenanceBasicGen, devSummary);
    assert.equal(maintAccess.allowed, true);
    assert.equal(maintAccess.state, "authorized");
    assert.equal(maintAccess.developerPreview, true);
    assert.equal(maintAccess.isUnderMaintenance, true);
    assert.equal(maintAccess.originalStatus, "Under Maintenance");
    assert.equal(typeof maintAccess.warningMessage, "string");
});

test("Scenario 6: Developer Preview revoked — access blocked after token refresh", () => {
    // Before refresh / with dev claim:
    const withClaim = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], {
        ...options,
        claims: { developerPreview: true },
    });
    assert.equal(evaluateGeneratorAccess(comingSoonBasicGen, withClaim).allowed, true);

    // After refresh when revoked:
    const revokedClaim = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], {
        ...options,
        claims: { developerPreview: false },
    });
    assert.equal(revokedClaim.developerPreview, false);
    const afterRevokeAccess = evaluateGeneratorAccess(comingSoonBasicGen, revokedClaim);
    assert.equal(afterRevokeAccess.allowed, false);
    assert.equal(afterRevokeAccess.reason, "UNAVAILABLE");
});

test("Scenario 7: Direct editor URLs respect permission checks without bypass", () => {
    // Normal user attempting direct URL navigation to coming soon generator
    const normalUser = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], options);
    const normalDecision = evaluateGeneratorAccess(comingSoonBasicGen, normalUser);
    assert.equal(normalDecision.allowed, false);
    assert.equal(normalDecision.reason, "UNAVAILABLE");

    // Dev user with proper tier
    const devUser = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], {
        ...options,
        developerPreview: true,
    });
    const devDecision = evaluateGeneratorAccess(comingSoonBasicGen, devUser);
    assert.equal(devDecision.allowed, true);
});

test("Scenario 8: STL and 3MF export restrictions remain strictly enforced", () => {
    // 8A: Developer account with active license gets authorized development exports
    const licensedDev = summarizeLicenses([makeLicense({ tier: "pro" })], {
        ...options,
        developerPreview: true,
    });
    const stlExport = evaluateExportAccess(comingSoonBasicGen, "stl", licensedDev);
    assert.equal(stlExport.allowed, true);
    assert.equal(stlExport.developerPreview, true);

    const threeMfExport = evaluateExportAccess(comingSoonBasicGen, "3mf", licensedDev);
    assert.equal(threeMfExport.allowed, true);
    assert.equal(threeMfExport.developerPreview, true);

    // 8B: Unsupported export format is rejected
    assert.equal(evaluateExportAccess(comingSoonBasicGen, "obj", licensedDev).allowed, false);
    assert.equal(evaluateExportAccess(comingSoonBasicGen, "obj", licensedDev).reason, "UNSUPPORTED_EXPORT_FORMAT");

    // 8C: Developer Preview account WITHOUT an active license CANNOT export
    const unlicensedDev = {
        ...summarizeLicenses([], { ...options, developerPreview: true }),
        developerPreview: true,
        hasActiveLicense: false,
    };
    const unlicensedExport = evaluateExportAccess(comingSoonBasicGen, "stl", unlicensedDev);
    assert.equal(unlicensedExport.allowed, false);
    assert.equal(unlicensedExport.reason, "LICENSE_REQUIRED");
});

test("Scenario 9: Existing paid and Exclusive Generator access policies remain untouched", () => {
    const basicUser = summarizeLicenses([makeLicense({ tier: "basic" })], options);
    const proUser = summarizeLicenses([makeLicense({ tier: "pro" })], options);
    const vipUser = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], options);

    // Stable basic: All can access
    assert.equal(evaluateGeneratorAccess(stableBasicGen, basicUser).allowed, true);
    assert.equal(evaluateGeneratorAccess(stableBasicGen, proUser).allowed, true);
    assert.equal(evaluateGeneratorAccess(stableBasicGen, vipUser).allowed, true);

    // Premium tool: Basic blocked, Pro/VIP allowed
    const stablePremium = { id: "keycap-maker", category: "premium", status: "Stable" };
    assert.equal(evaluateGeneratorAccess(stablePremium, basicUser).allowed, false);
    assert.equal(evaluateGeneratorAccess(stablePremium, proUser).allowed, true);
    assert.equal(evaluateGeneratorAccess(stablePremium, vipUser).allowed, true);

    // Exclusive tool: VIP allowed, Pro without entitlement blocked
    const stableExclusive = { id: "charms", category: "exclusive", status: "Stable", isVipEligible: true, requiredEntitlement: "charms" };
    assert.equal(evaluateGeneratorAccess(stableExclusive, proUser).allowed, false);
    assert.equal(evaluateGeneratorAccess(stableExclusive, vipUser).allowed, true);
});

test("Scenario 10: Generator status remains unchanged for all public users", () => {
    // Coming soon generator metadata retains its status string
    assert.equal(comingSoonBasicGen.status, "Coming Soon");
    assert.equal(maintenanceBasicGen.status, "Under Maintenance");

    // Public user gets UNAVAILABLE
    const publicUser = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], options);
    assert.equal(evaluateGeneratorAccess(comingSoonBasicGen, publicUser).reason, "UNAVAILABLE");
    assert.equal(evaluateGeneratorAccess(maintenanceBasicGen, publicUser).reason, "UNAVAILABLE");
});

test("Developer Preview is an availability override, not a subscription tier", () => {
    // Dev preview does NOT grant Pro to a Basic user
    const basicDev = summarizeLicenses([makeLicense({ tier: "basic" })], {
        ...options,
        developerPreview: true,
    });
    assert.equal(basicDev.tier, "basic");
    assert.equal(basicDev.isVip, false);
    assert.equal(basicDev.capabilities.vip, false);
    assert.equal(basicDev.capabilities.bazaarHub, false);

    // Basic dev user cannot open Premium unreleased generator
    const premAccess = evaluateGeneratorAccess(comingSoonPremiumGen, basicDev);
    assert.equal(premAccess.allowed, false);
    assert.equal(premAccess.reason, "PRO_REQUIRED");

    // Dev preview does NOT grant unentitled exclusive generators
    const proDev = summarizeLicenses([makeLicense({ tier: "pro" })], {
        ...options,
        developerPreview: true,
    });
    const exclAccess = evaluateGeneratorAccess(comingSoonExclusiveGen, proDev);
    assert.equal(exclAccess.allowed, false);
    assert.equal(exclAccess.reason, "EXCLUSIVE_PURCHASE_REQUIRED");

    // Dev preview does NOT grant non-VIP-eligible unreleased exclusive to VIP
    const vipDev = summarizeLicenses([makeLicense({ tier: "vip", entitlements: ["vip"] })], {
        ...options,
        developerPreview: true,
    });
    const nonVipExclAccess = evaluateGeneratorAccess(comingSoonNonVipExclusiveGen, vipDev);
    assert.equal(nonVipExclAccess.allowed, false);
    assert.equal(nonVipExclAccess.reason, "EXCLUSIVE_PURCHASE_REQUIRED");

    // Dev preview does NOT grant Hubs
    assert.equal(evaluateStudioHubAccess(basicDev).allowed, false);
    assert.equal(evaluateBazaarAccess(basicDev).allowed, false);
});

test("Expired and revoked licenses fail closed even with Developer Preview", () => {
    const expiredDev = summarizeLicenses([makeLicense({
        tier: "pro",
        expiresAt: "2020-01-01T00:00:00Z",
    })], {
        ...options,
        developerPreview: true,
    });
    assert.equal(expiredDev.hasActiveLicense, false);

    const access = evaluateGeneratorAccess(comingSoonPremiumGen, expiredDev);
    assert.equal(access.allowed, false);
    assert.equal(access.reason, "LICENSE_REQUIRED");

    const revokedDev = summarizeLicenses([makeLicense({
        tier: "vip",
        revoked: true,
    })], {
        ...options,
        developerPreview: true,
    });
    assert.equal(revokedDev.hasActiveLicense, false);
    assert.equal(revokedDev.isVip, false);
    // Protected unreleased tool fails because license is revoked
    assert.equal(evaluateGeneratorAccess(comingSoonPremiumGen, revokedDev).allowed, false);
    assert.equal(evaluateGeneratorAccess(comingSoonPremiumGen, revokedDev).reason, "LICENSE_REQUIRED");

    const protectedBasic = { ...comingSoonBasicGen, isFree: false };
    assert.equal(evaluateGeneratorAccess(protectedBasic, revokedDev).allowed, false);
    assert.equal(evaluateGeneratorAccess(protectedBasic, revokedDev).reason, "LICENSE_REQUIRED");
});

test("mergeTargetClaims: Trusted ADC script preserves claims and safely toggles developerPreview", () => {
    // 1. Granting developerPreview preserves existing admin, vip, bazaarHub
    const existing = { admin: true, vip: true, bazaarHub: true, otherClaim: "preserved" };
    const required = { vip: true, bazaarHub: true };
    const granted = mergeTargetClaims(existing, required, true);
    assert.equal(granted.targetDeveloperPreview, true);
    assert.equal(granted.newClaims.admin, true);
    assert.equal(granted.newClaims.vip, true);
    assert.equal(granted.newClaims.bazaarHub, true);
    assert.equal(granted.newClaims.developerPreview, true);
    assert.equal(granted.newClaims.otherClaim, "preserved");

    // 2. Revoking developerPreview preserves other claims
    const revoked = mergeTargetClaims(granted.newClaims, required, false);
    assert.equal(revoked.targetDeveloperPreview, false);
    assert.equal(revoked.newClaims.developerPreview, undefined);
    assert.equal(revoked.newClaims.admin, true);
    assert.equal(revoked.newClaims.vip, true);

    // 3. Omitting flag preserves existing developerPreview state
    const preservedOn = mergeTargetClaims({ developerPreview: true }, required, null);
    assert.equal(preservedOn.targetDeveloperPreview, true);
    assert.equal(preservedOn.newClaims.developerPreview, true);

    const preservedOff = mergeTargetClaims({ developerPreview: false }, required, null);
    assert.equal(preservedOff.targetDeveloperPreview, false);
    assert.equal(preservedOff.newClaims.developerPreview, undefined);
});
