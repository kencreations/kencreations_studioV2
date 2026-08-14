const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const envPath = path.join(__dirname, '..', 'kencreations-admin', '.env');
const pubKeyPath = path.join(__dirname, 'electron', 'PUBLIC_KEY.pem');

if (!fs.existsSync(envPath)) {
  console.error('Could not find .env at:', envPath);
  process.exit(1);
}

const envStr = fs.readFileSync(envPath, 'utf8');
const match = envStr.match(/VITE_RSA_PRIVATE_KEY_B64="([\s\S]*?)"/);

if (match && match[1]) {
  const pem = match[1];
  try {
    const priv = forge.pki.privateKeyFromPem(pem);
    const pub = forge.pki.rsa.setPublicKey(priv.n, priv.e);
    const pubPem = forge.pki.publicKeyToPem(pub);
    
    fs.writeFileSync(pubKeyPath, pubPem, 'utf8');
    console.log('✅ Successfully extracted and wrote PUBLIC_KEY.pem');
  } catch (e) {
    console.error('Error parsing private key:', e);
  }
} else {
  console.log('No valid private key found in .env. Format should be: VITE_RSA_PRIVATE_KEY_B64="-----BEGIN..."');
}
