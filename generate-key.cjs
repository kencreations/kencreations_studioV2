const crypto = require('crypto');

const SECRET_KEY = "kencreations_secret_license_key_2026"; // Must match the secret in the app

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
