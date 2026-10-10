import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { editors } from '../../src/data/editors.js';
import { unzipSync, strFromU8 } from 'fflate';

export async function runBrowserTests(env) {
    process.env.VITE_USE_FIREBASE_EMULATORS = 'true';
    const server = await createServer({ server: { host: '127.0.0.1', port: 5179, strictPort: true } });
    let browser;
    let page;
    const consoleMessages = [];
    const output = path.resolve('audit-artifacts');
    const downloads = path.join(output, 'downloads');
    await fs.mkdir(downloads, { recursive: true });
    const errors = [];
    try {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            for (const generator of editors) await setDoc(doc(db, 'generators', generator.id), { ...generator, totalExports: 10, stlExports: 7, threeMfExports: 3 });
            await setDoc(doc(db, 'app_settings', 'global'), { promo_all_access: false });
        });
        await server.listen();
        browser = await puppeteer.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
        page = await browser.newPage();
        page.on('console', message => { if (message.type() === 'error' || message.type() === 'warn') consoleMessages.push(message.text()); });
        page.on('requestfailed', request => consoleMessages.push(`REQUEST FAILED ${request.url()} ${request.failure()?.errorText}`));
        await page.setViewport({ width: 1440, height: 1000 });
        await page.setRequestInterception(true);
        page.on('request', request => {
            const url = new URL(request.url());
            if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) void request.continue();
            else void request.abort(); // Tests cannot touch production Firebase or external services.
        });
        page.on('pageerror', error => errors.push(error.message));
        const client = await page.createCDPSession();
        await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
        await page.goto('http://127.0.0.1:5179', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.innerText.includes('Chunky Charms'), { timeout: 30000 });
        assert.ok((await page.evaluate(() => document.body.innerText)).includes(String(editors.length * 10)));
        await page.screenshot({ path: path.join(output, 'homepage-desktop.png'), fullPage: true });
        const uid = await page.evaluate(async () => (await import('/tests/browser/session.js')).login());
        await env.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            await setDoc(doc(db, 'users', uid), { displayName: 'Audit Fixture', tier: 'maker', points: 0, totalExports: 0 });
            await setDoc(doc(db, 'licenses', 'fixture-charms'), { status: 'active', claimedByUid: uid, entitlements: ['charms'] });
            await setDoc(doc(db, 'licenses', 'fixture-keycap'), { status: 'active', claimedByUid: uid, entitlements: ['keycap-maker'] });
        });
        const navigate = route => page.goto(`http://127.0.0.1:5179/#${route}`, { waitUntil: 'domcontentloaded' });
        await navigate('/editor/keycap-maker');
        await page.waitForSelector('canvas', { timeout: 30000 });
        const exportFile = async format => {
            const previous = new Set(await fs.readdir(downloads));
            await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === text && !b.disabled), { timeout: 30000 }, `Export ${format.toUpperCase()}`);
            // Wait for model assets/CSG to settle, then use the actual visible control.
            await new Promise(resolve => setTimeout(resolve, 1800));
            await page.evaluate(text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text).click(), `Export ${format.toUpperCase()}`);
            let saved;
            const deadline = Date.now() + 30000;
            while (Date.now() < deadline) {
                const candidates = (await fs.readdir(downloads)).filter(f => !previous.has(f) && f.endsWith(`.${format}`));
                if (candidates.length) { saved = path.join(downloads, candidates[0]); break; }
                const alert = await page.$eval('[role="alert"]', e => e.textContent).catch(() => null);
                if (alert) throw new Error(alert);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            assert.ok(saved, `${format} browser download missing`);
            const bytes = await fs.readFile(saved);
            if (format === '3mf') assert.ok(strFromU8(unzipSync(bytes)['3D/3dmodel.model']).includes('<mesh>'));
            else { assert.ok(bytes.length > 84); assert.equal(bytes.length, 84 + bytes.readUInt32LE(80) * 50); }
        };
        await exportFile('stl'); await exportFile('3mf');
        console.log('PASS: real Keycap Maker browser STL and 3MF downloads with named entitlement.');
        await navigate('/editor/namekeychain'); await page.waitForSelector('canvas', { timeout: 30000 });
        await exportFile('stl'); await exportFile('3mf');
        console.log('PASS: real Name Keychain browser STL and 3MF downloads.');
        // VIP grant opens all routes; no account/key is hardcoded in application logic.
        await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'licenses', 'fixture-keycap'), { entitlements: ['vip'] }));
        const smoke = [];
        for (const generator of editors) {
            const before = errors.length;
            await navigate(generator.link);
            await page.waitForSelector('canvas', { timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const sceneFailure = await page.evaluate(() => document.body.innerText.includes('3D Scene Error'));
            smoke.push({ id: generator.id, sceneFailure, errors: errors.slice(before) });
        }
        await fs.writeFile(path.join(output, 'route-smoke.json'), JSON.stringify(smoke, null, 2));
        assert.deepEqual(smoke.filter(result => result.sceneFailure || result.errors.length), []);
        await navigate('/editor/keycap-maker');
        await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'licenses', 'fixture-keycap'), { status: 'revoked' }));
        await page.waitForFunction(() => !document.querySelector('canvas') && document.body.innerText.includes('entitlement'), { timeout: 15000 });
        console.log('PASS: VIP route smoke and live revocation removes editor access.');
        await page.evaluate(async () => (await import('/tests/browser/session.js')).logout());
        await navigate('/');
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.screenshot({ path: path.join(output, 'homepage-mobile.png'), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await navigate('/editor/namekeychain');
        await page.waitForSelector('canvas');
        await page.screenshot({ path: path.join(output, 'editor-mobile.png'), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        assert.deepEqual(errors, []);
        console.log('PASS: logout, mobile homepage/editor widths and no browser runtime exceptions.');
    } catch (error) {
        if (page) {
            await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
            await fs.writeFile(path.join(output, 'failure.txt'), await page.evaluate(() => document.body.innerText));
        }
        throw error;
    } finally {
        await fs.writeFile(path.join(output, 'browser-console.json'), JSON.stringify(consoleMessages, null, 2));
        await fs.writeFile(path.join(output, 'browser-errors.json'), JSON.stringify(errors, null, 2));
        await browser?.close(); await server.close();
    }
}
