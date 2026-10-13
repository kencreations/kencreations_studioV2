// Compilation only: no ruleset creation, release, Firestore writes, or test fixtures.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GoogleAuth } = require('google-auth-library'); // Existing Firebase CLI dependency.
try {
    const content = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    const auth = new GoogleAuth({projectId:'kencreations-studio', scopes:['https://www.googleapis.com/auth/firebase']});
    const client = await auth.getClient();
    const response = await client.request({
        url:'https://firebaserules.googleapis.com/v1/projects/kencreations-studio:test',
        method:'POST', data:{source:{files:[{name:'firestore.rules',content}]}}, timeout:30000,
    });
    const issues = response.data.issues || [];
    for (const issue of issues) console.log(issue.severity + ' line ' + issue.sourcePosition?.line + ': ' + issue.description);
    const errors = issues.filter(issue => issue.severity === 'ERROR');
    console.log('Compilation: ' + errors.length + ' errors, ' + (issues.length - errors.length) + ' warnings. No deployment performed.');
    process.exitCode = errors.length ? 1 : 0;
} catch (error) {
    // Never print credentials, request headers, or the authenticated client object.
    console.error('Rules compilation failed: ' + (error.response?.data?.error?.message || error.message));
    process.exitCode = 1;
}
