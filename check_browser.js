import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    let logs = [];
    page.on('console', msg => {
        logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', error => {
        logs.push(`[PAGE_ERROR] ${error.message}`);
    });
    page.on('requestfailed', request => {
        logs.push(`[REQUEST_FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });

    try {
        await page.goto('http://localhost:5174/editor/clicker', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000)); // wait for 3d model to render
        await page.screenshot({ path: 'screenshot.png' });
        logs.push('Screenshot saved to screenshot.png');
    } catch (e) {
        logs.push(`[NAV_ERROR] ${e.message}`);
    }
    
    fs.writeFileSync('browser_logs.txt', logs.join('\n'));
    await browser.close();
})();
