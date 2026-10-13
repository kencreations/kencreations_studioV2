import test from "node:test";
import assert from "node:assert/strict";
import {
    summarizeLicenses,
    resolveAccountEntitlements,
    evaluateGeneratorAccess,
    evaluateExportAccess,
    evaluateStudioHubAccess,
    evaluateBazaarAccess,
    validateClaim,
} from "../src/utils/licensePolicy.js";
import { getExclusivePriceInfo } from "../src/data/pricingPlans.js";
import { observeAccount } from "../src/services/accountObserver.js";
const license = (extra = {}) => ({
    status: "active",
    claimedByUid: "alice",
    entitlements: ["charms"],
    ...extra,
});
const options = { uid: "alice", now: Date.parse("2026-10-09T00:00:00Z") };
const charm = { id: "charms", isExclusive: true };
const standard = { id: "namekeychain", isExclusive: false, isFree: true };
test("combines all owned active records and excludes invalid licenses", () => {
    const summary = summarizeLicenses(
        [
            license(),
            license({ entitlements: ["keycap-maker"] }),
            license({ claimedByUid: "bob", entitlements: ["vip"] }),
            license({ status: "revoked", entitlements: ["vip"] }),
            license({ disabled: true, entitlements: ["vip"] }),
            license({ expiresAt: { seconds: 1 }, entitlements: ["vip"] }),
        ],
        options,
    );
    assert.deepEqual(summary.entitlements, ["charms", "keycap-maker"]);
    assert.equal(summary.isVip, false);
    assert.equal(evaluateGeneratorAccess(charm, summary).allowed, true);
});
test("VIP opens all exclusive generators; PRO and perpetual duration do not grant missing add-ons", () => {
    assert.equal(
        evaluateGeneratorAccess(
            charm,
            summarizeLicenses([license({ entitlements: ["vip"] })], options),
        ).allowed,
        true,
    );
    assert.equal(
        evaluateGeneratorAccess(
            charm,
            summarizeLicenses(
                [license({ plan_type: "vip", entitlements: [] })],
                options,
            ),
        ).allowed,
        true,
    );
    assert.equal(
        evaluateGeneratorAccess(
            charm,
            summarizeLicenses(
                [license({ tier: "pro", isPerpetual: true, entitlements: [] })],
                options,
            ),
        ).allowed,
        false,
    );
});
test("requiredEntitlement, availability and explicit verification states", () => {
    assert.equal(
        evaluateGeneratorAccess(
            {
                id: "client-icon-tag",
                isExclusive: true,
                requiredEntitlement: "client-tag",
            },
            { entitlements: ["client-tag"] },
        ).allowed,
        true,
    );
    for (const status of ["loading", "error"])
        assert.equal(evaluateGeneratorAccess(charm, { status }).state, status);
    assert.equal(
        evaluateGeneratorAccess(
            { ...charm, status: "disabled" },
            { isVip: true },
        ).allowed,
        false,
    );
    assert.equal(
        evaluateGeneratorAccess({ id: "free", isFree: true }, {}).allowed,
        true,
    );
    assert.equal(
        evaluateGeneratorAccess({ ...charm, isFree: true }, {}).allowed,
        false,
    );
    assert.equal(evaluateGeneratorAccess(null, { isVip: true }).allowed, false);
});
test("export policy separates free editing from STL and 3MF downloads", () => {
    const free = { status: "ready", currentUser: { uid: "alice" } };
    for (const format of ["stl", "3mf"]) {
        assert.equal(evaluateGeneratorAccess(standard, free).allowed, true);
        assert.equal(
            evaluateExportAccess(standard, format, free).reason,
            "LICENSE_REQUIRED",
        );
        assert.equal(
            evaluateExportAccess(standard, format, {
                ...free,
                hasActiveLicense: true,
            }).allowed,
            true,
        );
        assert.equal(
            evaluateExportAccess(standard, format, { ...free, isVip: true })
                .allowed,
            true,
        );
        assert.equal(
            evaluateExportAccess(standard, format, {
                ...free,
                desktop: true,
                trialStatus: "ready",
                exportsLeft: 1,
            }).reason,
            "TRIAL",
        );
        assert.equal(
            evaluateExportAccess(standard, format, {
                ...free,
                desktop: true,
                trialStatus: "ready",
                exportsLeft: 0,
            }).allowed,
            false,
        );
    }
});
test("export policy fails closed while license or trial verification is unresolved", () => {
    assert.equal(
        evaluateExportAccess(standard, "stl", { status: "loading" }).state,
        "loading",
    );
    assert.equal(
        evaluateExportAccess(standard, "3mf", { status: "error" }).state,
        "error",
    );
    assert.equal(
        evaluateExportAccess(standard, "stl", {
            status: "ready",
            desktop: true,
            trialStatus: "error",
            exportsLeft: 5,
        }).allowed,
        false,
    );
    assert.equal(
        evaluateExportAccess(standard, "3mf", {
            status: "ready",
            desktop: true,
            trialStatus: "loading",
            exportsLeft: 5,
        }).state,
        "loading",
    );
});
test("claims reject expired, disabled, revoked, invalid, wrong owner and wrong device", () => {
    for (const extra of [
        { status: "revoked" },
        { status: "disabled" },
        { expiresAt: "invalid" },
        { expiresAt: "2020-01-01" },
        { claimedByUid: "bob" },
        { hwid: "other" },
    ])
        assert.throws(() =>
            validateClaim(license(extra), "alice", "device", options.now),
        );
    assert.doesNotThrow(() =>
        validateClaim(
            license({ status: "unclaimed", claimedByUid: null }),
            "alice",
            "device",
            options.now,
        ),
    );
});
test("desktop licenses require activation, expiry and device verification", () => {
    const opts = { desktop: true, hwid: "device", now: options.now };
    assert.equal(
        summarizeLicenses([{ activated: false, entitlements: ["vip"] }], opts)
            .isVip,
        false,
    );
    assert.equal(
        summarizeLicenses(
            [{ activated: true, hwid: "other", entitlements: ["vip"] }],
            opts,
        ).isVip,
        false,
    );
    assert.equal(
        summarizeLicenses(
            [
                {
                    activated: true,
                    expiresAt: "2020-01-01",
                    entitlements: ["vip"],
                },
            ],
            opts,
        ).isVip,
        false,
    );
});
test("auth switches, logout, listener errors and late callbacks cannot retain grants", () => {
    let authNext;
    const subscriptions = [];
    const states = [];
    let stops = 0;
    const stop = observeAccount(
        {
            auth: (next) => {
                authNext = next;
                return () => stops++;
            },
            profile: () => () => stops++,
            licenses: (uid, next, error) => {
                subscriptions.push({ uid, next, error });
                return () => stops++;
            },
        },
        (state) => states.push(state),
    );
    authNext({ uid: "alice" });
    subscriptions[0].next([license()], true);
    assert.equal(states.at(-1).licenses.length, 1);
    authNext({ uid: "bob" });
    subscriptions[0].next([license()], true);
    assert.equal(states.at(-1).licenses.length, 0);
    subscriptions[1].next([license()], false);
    assert.equal(states.at(-1).status, "loading");
    subscriptions[1].error(new Error("permission-denied"));
    assert.equal(states.at(-1).status, "error");
    authNext(null);
    subscriptions[1].next([license()], true);
    assert.equal(states.at(-1).currentUser, null);
    stop();
    assert.equal(stops, 5);
});

test("Definitive tier resolution & capabilities (Basic, Pro, Pro+, VIP)", () => {
    const basicLic = license({ tier: "basic", entitlements: [] });
    const basicAccount = resolveAccountEntitlements([basicLic], options);
    assert.equal(basicAccount.tier, "basic");
    assert.equal(basicAccount.capabilities.basicGenerators, true);
    assert.equal(basicAccount.capabilities.premiumGenerators, false);
    assert.equal(basicAccount.capabilities.studioHub, false);
    assert.equal(basicAccount.capabilities.bazaarHub, false);
    assert.equal(basicAccount.capabilities.vip, false);

    const proLic = license({ tier: "pro", entitlements: [] });
    const proAccount = resolveAccountEntitlements([proLic], options);
    assert.equal(proAccount.tier, "pro");
    assert.equal(proAccount.capabilities.basicGenerators, true);
    assert.equal(proAccount.capabilities.premiumGenerators, true);
    assert.equal(proAccount.capabilities.studioHub, true);
    assert.equal(proAccount.capabilities.bazaarHub, true);
    assert.equal(proAccount.capabilities.vip, false);

    const proPlusLic = license({ tier: "pro_plus", isPerpetual: true, entitlements: [] });
    const proPlusAccount = resolveAccountEntitlements([proPlusLic], options);
    assert.equal(proPlusAccount.tier, "pro_plus");
    assert.equal(proPlusAccount.billingType, "lifetime");
    assert.equal(proPlusAccount.capabilities.studioHub, true);
    assert.equal(proPlusAccount.capabilities.bazaarHub, true);

    const vipLic = license({ tier: "vip", entitlements: ["vip"] });
    const vipAccount = resolveAccountEntitlements([vipLic], options);
    assert.equal(vipAccount.tier, "vip");
    assert.equal(vipAccount.capabilities.vip, true);
});

test("Access matrix: Basic tier access guards", () => {
    const basicSummary = { ...summarizeLicenses([license({ tier: "basic", entitlements: [] })], options), currentUser: { uid: "alice" } };
    const basicTool = { id: "monograminsert", category: "basic", isFree: true };
    const premiumTool = { id: "keycap-maker", category: "premium", isExclusive: false };
    const exclusiveTool = { id: "charms", category: "exclusive", isExclusive: true, requiredEntitlement: "charms" };

    // Basic can access and export Basic generators
    assert.equal(evaluateGeneratorAccess(basicTool, basicSummary).allowed, true);
    assert.equal(evaluateExportAccess(basicTool, "stl", basicSummary).allowed, true);

    // Basic CANNOT access Premium generators
    assert.equal(evaluateGeneratorAccess(premiumTool, basicSummary).allowed, false);
    assert.equal(evaluateGeneratorAccess(premiumTool, basicSummary).reason, "PRO_REQUIRED");

    // Basic CANNOT access Hubs
    assert.equal(evaluateStudioHubAccess(basicSummary).allowed, false);
    assert.equal(evaluateBazaarAccess(basicSummary).allowed, false);

    // Basic with commercial print rights STILL cannot access Bazaar Hub
    const basicCommercialSummary = {
        ...summarizeLicenses([license({ tier: "basic", entitlements: ["commercial"] })], options),
        currentUser: { uid: "alice" }
    };
    assert.equal(basicCommercialSummary.capabilities.commercialPrinting, true);
    assert.equal(basicCommercialSummary.capabilities.bazaarHub, false);
    assert.equal(evaluateBazaarAccess(basicCommercialSummary).allowed, false);

    // Basic CANNOT access Exclusive generators without separate purchase
    assert.equal(evaluateGeneratorAccess(exclusiveTool, basicSummary).allowed, false);
    assert.equal(evaluateGeneratorAccess(exclusiveTool, basicSummary).reason, "EXCLUSIVE_PURCHASE_REQUIRED");
});

test("Access matrix: Pro and Pro+ tiers access guards", () => {
    const proSummary = { ...summarizeLicenses([license({ tier: "pro", entitlements: [] })], options), currentUser: { uid: "alice" } };
    const basicTool = { id: "monograminsert", category: "basic", isFree: true };
    const premiumTool = { id: "keycap-maker", category: "premium", isExclusive: false };
    const exclusiveTool = { id: "charms", category: "exclusive", isExclusive: true, requiredEntitlement: "charms" };

    assert.equal(evaluateGeneratorAccess(basicTool, proSummary).allowed, true);
    assert.equal(evaluateGeneratorAccess(premiumTool, proSummary).allowed, true);
    assert.equal(evaluateStudioHubAccess(proSummary).allowed, true);
    assert.equal(evaluateBazaarAccess(proSummary).allowed, true);
    assert.equal(evaluateGeneratorAccess(exclusiveTool, proSummary).allowed, false);
});

test("Access matrix: VIP tier includes VIP-eligible exclusive tools", () => {
    const vipSummary = { ...summarizeLicenses([license({ tier: "vip", entitlements: ["vip"] })], options), currentUser: { uid: "alice" } };
    const vipEligibleTool = { id: "charms", category: "exclusive", isExclusive: true, isVipEligible: true, requiredEntitlement: "charms" };
    const nonVipExclusiveTool = { id: "custom-client-deal", category: "exclusive", isExclusive: true, isVipEligible: false, requiredEntitlement: "custom-client-deal" };

    assert.equal(evaluateGeneratorAccess(vipEligibleTool, vipSummary).allowed, true);
    // Non-VIP-eligible proprietary tools remain separate unless owned
    assert.equal(evaluateGeneratorAccess(nonVipExclusiveTool, vipSummary).allowed, false);
});

test("Access matrix: Individual Exclusive Generator purchases remain accessible across tiers & expiry", () => {
    // Basic user with separate exclusive purchase
    const basicWithExclusive = {
        ...summarizeLicenses([
            license({ tier: "basic", entitlements: [] }),
            license({ id: "addon-1", entitlements: ["charms"], isPerpetual: true })
        ], options),
        currentUser: { uid: "alice" }
    };
    const charmTool = { id: "charms", category: "exclusive", isExclusive: true, requiredEntitlement: "charms" };
    const tagTool = { id: "client-icon-tag", category: "exclusive", isExclusive: true, requiredEntitlement: "client-tag" };

    assert.equal(evaluateGeneratorAccess(charmTool, basicWithExclusive).allowed, true);
    // Did not buy client-tag:
    assert.equal(evaluateGeneratorAccess(tagTool, basicWithExclusive).allowed, false);

    // Expired subscription + permanently owned exclusive generator
    const expiredSubWithPerpetualExclusive = {
        ...summarizeLicenses([
            license({ tier: "pro", expiresAt: "2020-01-01", entitlements: [] }),
            license({ id: "addon-1", expiresAt: null, entitlements: ["charms"] })
        ], options),
        currentUser: { uid: "alice" }
    };
    assert.equal(evaluateGeneratorAccess(charmTool, expiredSubWithPerpetualExclusive).allowed, true);
    assert.equal(evaluateStudioHubAccess(expiredSubWithPerpetualExclusive).allowed, false);
});

test("Access matrix: Generator-only legacy licenses do not grant Bazaar Hub or Studio Hub", () => {
    const legacyGenPack = {
        ...summarizeLicenses([
            license({
                id: "KC-SAV4GT",
                entitlements: ["namekeychain", "keycap-maker", "pencil-sleeve", "straw-toppers"],
                isPerpetual: true
            })
        ], options),
        currentUser: { uid: "alice" }
    };

    // Explicit purchased tools are allowed
    assert.equal(evaluateGeneratorAccess({ id: "keycap-maker", category: "premium" }, legacyGenPack).allowed, true);
    assert.equal(evaluateGeneratorAccess({ id: "pencil-sleeve", category: "basic" }, legacyGenPack).allowed, true);
    // Unpurchased tools not allowed
    assert.equal(evaluateGeneratorAccess({ id: "macropad", category: "premium" }, legacyGenPack).allowed, false);
    // Hubs NOT allowed
    assert.equal(evaluateStudioHubAccess(legacyGenPack).allowed, false);
    assert.equal(evaluateBazaarAccess(legacyGenPack).allowed, false);
});

test("Configurable exclusive generator pricing policy", () => {
    const unconfiguredTool = { id: "charms", category: "exclusive", purchasePricePHP: null };
    const configuredTool = { id: "custom-exclusive", category: "exclusive", purchasePricePHP: 1499 };

    const unconfInfo = getExclusivePriceInfo(unconfiguredTool);
    assert.equal(unconfInfo.configured, false);
    assert.equal(unconfInfo.formatted, "Price Pending Admin Setup");
    assert.equal(unconfInfo.label, "Contact Admin for Pricing");

    const confInfo = getExclusivePriceInfo(configuredTool);
    assert.equal(confInfo.configured, true);
    assert.equal(confInfo.amount, 1499);
    assert.equal(confInfo.formatted, "₱1,499");
    assert.equal(confInfo.label, "₱1,499 one-time");

    // Null or undefined generator
    assert.equal(getExclusivePriceInfo(null).configured, false);
});
