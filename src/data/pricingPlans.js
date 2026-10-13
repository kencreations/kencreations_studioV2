/**
 * pricingPlans.js — Centralized Definitive Pricing and Tier Configurations.
 *
 * Tiers: Basic, Pro, Pro+, VIP.
 * Generator Categories: basic, premium, exclusive.
 * Currency: Philippine Peso (PHP - ₱).
 */

export const PRICING_PLANS = {
    basic: {
        id: "basic",
        name: "Basic",
        tier: "basic",
        billingCategory: "Subscription",
        badge: "STARTER",
        description: "Essential 3D generators with commercial printing rights for makers and hobbyists.",
        prices: {
            monthly: {
                amount: 199,
                currency: "PHP",
                formatted: "₱199",
                period: "/ mo",
                billingCycle: "1",
                rawMonthlyEquivalent: 199,
            },
            yearly: {
                amount: 1990,
                currency: "PHP",
                formatted: "₱1,990",
                period: "/ yr",
                billingCycle: "12",
                rawMonthlyEquivalent: 165.83,
                savings: "Save ₱398 / 17%",
            },
        },
        highlights: [
            "All Basic 3D Generators",
            "Unlimited STL & 3MF Exports",
            "Commercial Rights to sell physical prints",
            "Full editing & 3D real-time preview",
            "Community & email support",
        ],
        limits: [
            "No Premium generators included",
            "No Studio Hub access",
            "No Bazaar Hub access",
            "Exclusive generators require separate purchase",
        ],
        hubAccess: "None",
        generatorAccess: "Basic Catalog Only",
        exclusivePolicy: "Requires separate individual purchase",
        commercialPrinting: "Included for authorized generators",
    },
    pro: {
        id: "pro",
        name: "Pro",
        tier: "pro",
        billingCategory: "Subscription",
        badge: "RECOMMENDED",
        popular: true,
        description: "The complete commercial studio suite: all Premium generators plus full Studio and Bazaar Hubs.",
        prices: {
            monthly: {
                amount: 399,
                currency: "PHP",
                formatted: "₱399",
                period: "/ mo",
                billingCycle: "1",
                rawMonthlyEquivalent: 399,
            },
            yearly: {
                amount: 3990,
                currency: "PHP",
                formatted: "₱3,990",
                period: "/ yr",
                billingCycle: "12",
                rawMonthlyEquivalent: 332.50,
                savings: "Save ₱798 / 17%",
            },
        },
        highlights: [
            "Everything in Basic",
            "Access to ALL Premium Generators",
            "Full Studio Hub (Filament ledger, job cost math, quotes)",
            "Full Bazaar Hub (In-person event POS, QR customer kiosks)",
            "Priority support & early feature updates",
        ],
        limits: [
            "Recurring monthly or yearly subscription",
            "Exclusive generators require separate purchase",
        ],
        hubAccess: "Full Studio Hub & Bazaar Hub",
        generatorAccess: "All Basic & Premium Generators",
        exclusivePolicy: "Requires separate individual purchase",
        commercialPrinting: "Full commercial printing rights",
    },
    pro_plus: {
        id: "pro_plus",
        name: "Pro+",
        tier: "pro_plus",
        billingCategory: "Lifetime",
        badge: "BEST LIFETIME VALUE",
        description: "Pay once, create forever. Lifetime commercial access to all Pro features with zero subscription fees.",
        prices: {
            lifetime: {
                amount: 5999,
                currency: "PHP",
                formatted: "₱5,999",
                period: "one-time",
                billingCycle: "lifetime",
                rawMonthlyEquivalent: 0,
                savings: "Lifetime access • Never pay again",
            },
        },
        highlights: [
            "Everything in Pro with lifetime duration",
            "Zero recurring fees — Pay once, use forever",
            "Permanent Studio Hub & Bazaar Hub access",
            "All future Basic & Premium generator additions",
            "Full lifetime commercial print sales rights",
        ],
        limits: [
            "Exclusive generators require separate purchase",
        ],
        hubAccess: "Lifetime Studio Hub & Bazaar Hub",
        generatorAccess: "All Basic & Premium Generators (Lifetime)",
        exclusivePolicy: "Requires separate individual purchase",
        commercialPrinting: "Lifetime commercial printing rights",
    },
    vip: {
        id: "vip",
        name: "VIP",
        tier: "vip",
        billingCategory: "Lifetime VIP",
        badge: "ALL-ACCESS LIFETIME",
        vip: true,
        description: "The ultimate creative tier. Everything in Pro+ plus all current and future VIP-eligible Exclusive Generators.",
        prices: {
            lifetime: {
                amount: 8999,
                currency: "PHP",
                formatted: "₱8,999",
                period: "one-time",
                billingCycle: "lifetime",
                rawMonthlyEquivalent: 0,
                savings: "All-Inclusive Lifetime Pass",
            },
        },
        highlights: [
            "Everything in Pro+ with lifetime duration",
            "All current & future VIP-eligible Exclusive Generators",
            "Official VIP Badge on profile & seller storefront",
            "Early access to eligible beta & experimental generators",
            "Exclusive VIP design presets & template packs",
            "Priority support & feature-request consideration",
            "Full commercial rights to sell all printed designs",
        ],
        limits: [],
        hubAccess: "Lifetime Studio Hub & Bazaar Hub",
        generatorAccess: "All Basic, Premium & VIP-Eligible Exclusive Generators",
        exclusivePolicy: "All VIP-eligible exclusives included automatically",
        commercialPrinting: "Full lifetime commercial rights",
    },
};

export const SINGLE_EXCLUSIVE_PRICE = {
    amount: null,
    currency: "PHP",
    formatted: "Individually Priced",
    period: "one-time per generator",
    description: "Purchase individual lifetime access to any specific Exclusive Generator without upgrading to VIP. Prices are individually configured per tool.",
};

export function getExclusivePriceInfo(generator) {
    if (!generator) {
        return {
            configured: false,
            amount: null,
            formatted: "Price Pending Setup",
            label: "Contact Admin for Pricing",
        };
    }
    const price = generator.purchasePricePHP;
    if (typeof price === "number" && !Number.isNaN(price) && price > 0) {
        return {
            configured: true,
            amount: price,
            formatted: formatPhp(price),
            label: `${formatPhp(price)} one-time`,
        };
    }
    return {
        configured: false,
        amount: null,
        formatted: "Price Pending Admin Setup",
        label: "Contact Admin for Pricing",
    };
}

export const COMPARISON_FEATURES = [
    {
        category: "Generators & Design Tools",
        items: [
            { name: "Basic 3D Generators", basic: true, pro: true, pro_plus: true, vip: true, note: "Keychains, pencil sleeves, straw toppers, whistles, etc." },
            { name: "Premium Generators", basic: false, pro: true, pro_plus: true, vip: true, note: "Keycap Maker, MX Clicker Pro, Macropad Builder, Letter Beads" },
            { name: "VIP-Eligible Exclusive Generators", basic: false, pro: false, pro_plus: false, vip: true, note: "Chunky Charms, Icon Tag Generator, future VIP tools" },
            { name: "Individual Exclusive Purchases", basic: "Available (Per Tool)", pro: "Available (Per Tool)", pro_plus: "Available (Per Tool)", vip: "All Included", note: "Individually priced per generator; separately purchased tools remain owned permanently" },
            { name: "Early Access Beta Tools", basic: false, pro: false, pro_plus: false, vip: true, note: "Test new experimental generators before public release" },
        ],
    },
    {
        category: "Exporting & Commercial Rights",
        items: [
            { name: "Unlimited STL & 3MF Exports", basic: true, pro: true, pro_plus: true, vip: true, note: "Watertight, production-ready Bambu/Prusa slicer meshes" },
            { name: "Commercial Print Sales Rights", basic: true, pro: true, pro_plus: true, vip: true, note: "Sell physical 3D prints made using authorized generators" },
            { name: "Digital File Redistribution", basic: false, pro: false, pro_plus: false, vip: false, note: "Reselling digital STL/3MF files is prohibited under all plans" },
        ],
    },
    {
        category: "Business Hubs",
        items: [
            { name: "Studio Hub", basic: false, pro: true, pro_plus: "Lifetime", vip: "Lifetime", note: "Filament inventory, print job costing math, quotations, sales" },
            { name: "Bazaar Hub (Event POS)", basic: false, pro: true, pro_plus: "Lifetime", vip: "Lifetime", note: "In-person event POS, inventory tracking, booth order manager" },
            { name: "Automated Guest Checkout", basic: false, pro: "Backend Preview", pro_plus: "Backend Preview", vip: "Backend Preview", note: "In-person workflows active; public self-checkout requires trusted backend deployment" },
        ],
    },
    {
        category: "Account, Billing & Support",
        items: [
            { name: "Billing Model", basic: "Monthly / Yearly", pro: "Monthly / Yearly", pro_plus: "One-time Lifetime", vip: "One-time Lifetime", note: "Lifetime plans never expire and have zero recurring fees" },
            { name: "Official Account Badge", basic: "Basic", pro: "Pro", pro_plus: "Pro+ Lifetime", vip: "VIP All-Access", note: "Displayed on profile and seller storefront" },
            { name: "Support Level", basic: "Standard", pro: "Priority", pro_plus: "Priority", vip: "VIP Priority Support", note: "Feature request consideration for VIP members" },
        ],
    },
];

export const PRICING_FAQS = [
    {
        q: "What are the core differences between Basic, Pro, Pro+, and VIP?",
        a: "Basic (₱199/mo or ₱1,990/yr) is designed for makers who need essential 3D generators and commercial print rights. Pro (₱399/mo or ₱3,990/yr) unlocks all Premium generators plus both business hubs: Studio Hub (costing/materials) and Bazaar Hub (event POS/orders). Pro+ (₱5,999 one-time) gives you permanent lifetime access to everything in Pro with zero recurring fees. VIP (₱8,999 one-time) is the all-access lifetime plan including all current and future VIP-eligible Exclusive Generators, VIP badge, and early beta access.",
    },
    {
        q: "What does 'Lifetime' mean?",
        a: "'Lifetime' access means you pay a single one-time price with no recurring subscription fees ever. Your license never expires and you will receive all eligible updates, improvements, and standard additions for that tier indefinitely.",
    },
    {
        q: "What are Exclusive Generators and how are they priced?",
        a: "Exclusive Generators are specialized, advanced 3D creation tools (such as Chunky Charms and custom client icon tags). They are completely included for VIP members. Members on Basic, Pro, and Pro+ can also purchase individual Exclusive Generators separately with individual per-tool pricing. Each exclusive tool has its own price configured in the catalog.",
    },
    {
        q: "Can I sell the physical products I 3D print?",
        a: "Yes! All four plans (Basic, Pro, Pro+, and VIP) include commercial rights to sell physical 3D prints made using authorized generators. However, sharing, reselling, or redistributing the digital STL/3MF files or software code is strictly forbidden.",
    },
    {
        q: "Can I upgrade my subscription plan later?",
        a: "Yes, you can upgrade from Basic to Pro, or from any active subscription to a Pro+ or VIP Lifetime pass at any time. When you upgrade, your account immediately unlocks the higher tier capabilities.",
    },
    {
        q: "What happens when a monthly or yearly subscription expires?",
        a: "If a subscription lapses without renewal, access to subscription-only tools (Premium generators, Studio Hub, and Bazaar Hub) will be paused until you renew. However, your account data, shop settings, and any individually purchased Exclusive Generators or lifetime licenses remain intact and permanently owned.",
    },
    {
        q: "Do separately purchased Exclusive Generators remain owned if my subscription expires?",
        a: "Yes! Separately purchased Exclusive Generators are permanent lifetime entitlements tied to your account. You will never lose access to individually purchased tools, even if an accompanying monthly or annual subscription is not renewed.",
    },
];

export function formatPhp(amount) {
    if (typeof amount !== "number" || Number.isNaN(amount)) return "₱0";
    return `₱${amount.toLocaleString("en-PH")}`;
}
