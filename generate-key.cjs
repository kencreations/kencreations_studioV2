const crypto = require('crypto');

// Legacy administration utility only. Never bundle a signing secret in a client.
const SECRET_KEY = process.env.KENCREATIONS_LEGACY_SIGNING_SECRET;
if (!SECRET_KEY) {
    console.error('Set KENCREATIONS_LEGACY_SIGNING_SECRET in your local environment.');
    process.exit(1);
}

const hwid = process.argv[2];

if (!hwid) {
    console.error("Usage: node generate-key.js <hardware-id>");
    process.exit(1);
}

// Generate the license key by hashing the Hardware ID with the secret key
const hmac = crypto.createHmac('sha256', SECRET_KEY);
hmac.update(hwid);
const licenseKey = hmac.digest('hex');

console.log(`\nHardware ID: ${hwid}`);
console.log(`License Key: ${licenseKey}\n`);
