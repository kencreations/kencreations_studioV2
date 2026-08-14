import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER_ERROR:', msg.text());
        }
    });

    page.on('pageerror', error => {
        console.log('PAGE_ERROR:', error.message);
    });

    page.on('requestfailed', request => {
        console.log('REQUEST_FAILED:', request.url(), request.failure().errorText);
    });

    await page.goto('http://localhost:5174/editor/clicker', { waitUntil: 'networkidle0', timeout: 10000 }).catch(e => console.log('Timeout/Nav error:', e));
    
    await browser.close();
})();
