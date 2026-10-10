import fs from 'node:fs/promises';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
const mode = process.argv[2] || 'before';
const server = await createServer({ server: { host: '127.0.0.1', port: 5182, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1350, height: 1200, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error(e.message));
  await page.goto(`http://127.0.0.1:5182/tests/typography/index.html?mode=${mode}`, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.done || window.failure, {timeout:120000});
  const failure = await page.evaluate(() => window.failure);
  if (failure) throw new Error(failure);
  await fs.mkdir('audit-artifacts/typography', {recursive:true});
  await page.screenshot({path:`audit-artifacts/typography/${mode}.png`, fullPage:true});
  await (await page.$('#gallery')).screenshot({path:`audit-artifacts/typography/${mode}-gallery.png`});
  const cards = await page.$$('.card');
  for (let i=0;i<12;i++) await cards[i*4+3].screenshot({path:`audit-artifacts/typography/${mode}-3d-${i}.png`});
  await fs.writeFile(`audit-artifacts/typography/${mode}.json`, JSON.stringify(await page.evaluate(() => window.metrics), null, 2));
  console.log(`${mode} screenshots and metrics captured`);
} finally { await browser?.close(); await server.close(); }
