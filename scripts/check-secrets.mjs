// Deliberately prints only paths/rule names, never matched credentials.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024 });
const rules = [
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]{40}/],
    ['service account credential', /"type"\s*:\s*"service_account"/],
    ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ['Stripe secret', /\bsk_live_[A-Za-z0-9]{16,}\b/],
    ['literal signing secret', /\b(?:SECRET_KEY|SIGNING_SECRET|CLIENT_SECRET)\s*[:=]\s*["'][^"'\r\n]{12,}["']/],
];
const sensitivePath = /(?:^|\/)(?:\.env(?:\..+)?|\.npmrc|\.netrc|serviceAccount[^/]*\.json|service-account[^/]*\.json|[^/]*firebase-adminsdk[^/]*\.json|application_default_credentials\.json|credentials\.json)$|\.(?:pem|key|p12|pfx|p8|jks|keystore|lic|sqlite3?|db)(?:-wal|-shm)?$/i;
const findings = [];
function scan(label, bytes, paths = true) {
    if (paths && sensitivePath.test(label) && !/\.env(?:\.[^/]+)?\.example$/.test(label)) findings.push(`${label}: sensitive file path`);
    if (bytes.includes(0)) return;
    const source = bytes.toString('utf8');
    for (const [name, pattern] of rules) if (pattern.test(source)) findings.push(`${label}: ${name}`);
}
const staged = process.argv.includes('--staged');
const history = process.argv.includes('--history');
const dist = process.argv.includes('--dist');
if (dist) {
    if (!fs.existsSync('dist/index.html')) throw new Error('Build dist first.');
    function walk(directory) {
        for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = `${directory}/${item.name}`;
            if (item.isDirectory()) walk(file);
            else {
                if (/\.(?:map|jsx|tsx|ts|cjs)$/.test(file)) findings.push(`${file}: development source/artifact in public build`);
                const bytes = fs.readFileSync(file);
                scan(file, bytes);
                if (/\.(?:js|css)$/.test(file) && /[#@]\s*sourceMappingURL\s*=/.test(bytes.toString())) findings.push(`${file}: source map reference`);
            }
        }
    }
    walk('dist');
} else if (history) {
    const objects = git('rev-list', '--objects', '--all').toString().trim().split('\n');
    for (const entry of objects) {
        const split = entry.indexOf(' '); if (split < 0) continue;
        const hash = entry.slice(0, split), name = entry.slice(split + 1);
        if (git('cat-file', '-t', hash).toString().trim() !== 'blob') continue;
        scan(`${hash.slice(0, 12)} ${name}`, git('cat-file', 'blob', hash), false);
    }
} else {
    const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'] : ['ls-files', '-co', '--exclude-standard', '-z'];
    for (const file of new Set(git(...args).toString().split('\0').filter(Boolean))) {
        if (staged) scan(file, git('show', `:${file}`));
        else if (fs.existsSync(file) && fs.lstatSync(file).isFile()) scan(file, fs.readFileSync(file));
    }
}
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log(`No matches in ${dist ? 'dist' : history ? 'local Git history' : staged ? 'staged files' : 'tracked and non-ignored files'} for configured secret patterns. This is not a complete security audit.`);
