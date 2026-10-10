import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { unzipSync, strFromU8 } from 'fflate';
import { editors } from '../../src/data/editors.js';

if(process.env.GCLOUD_PROJECT!=='demo-kencreations-audit'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Local demo emulators required.');
process.env.VITE_USE_FIREBASE_EMULATORS='true';
const server=await createServer({server:{host:'127.0.0.1',port:5183,strictPort:true}});
const env=await initializeTestEnvironment({projectId:'demo-kencreations-audit',firestore:{host:'127.0.0.1',port:8080,rules:await fs.readFile('docs/firestore.proposed.rules','utf8')}});
const output=path.resolve('audit-artifacts/typography');
const downloads=await fs.mkdtemp(path.join(output,'downloads-'));
let browser,page;const errors=[];
try {
    await env.withSecurityRulesDisabled(async ctx=>{
        const db=ctx.firestore();
        await setDoc(doc(db,'app_settings','global'),{promo_all_access:false});
        const generator=editors.find(e=>e.id==='popsocket');
        await setDoc(doc(db,'generators','popsocket'),{...generator,totalExports:0,stlExports:0,threeMfExports:0});
    });
    await server.listen();
    browser=await puppeteer.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
    page=await browser.newPage();await page.setViewport({width:1440,height:1050});
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',request=>{
        const url=new URL(request.url());
        void (['127.0.0.1','localhost'].includes(url.hostname)||['blob:','data:'].includes(url.protocol)?request.continue():request.abort());
    });
    const client=await page.createCDPSession();
    await client.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    await page.goto('http://127.0.0.1:5183/?typographyDebug=1#/editor/popsocket',{waitUntil:'domcontentloaded'});
    await page.evaluate(async()=>{await (await import('/tests/browser/session.js')).login();});
    const ready=()=>page.waitForFunction(()=>document.querySelector('[data-testid="typography-diagnostics"]')&&!document.body.innerText.includes('Preparing readable lettering'),{timeout:30000});
    await ready();
    const setText=async value=>{
        const input=await page.$('[placeholder="Your name or phrase"]');
        await input.focus();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await input.type(value);
    };
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Organic Circular')).click());await ready();
    await setText('ALDRIN');await ready();
    await page.screenshot({path:path.join(output,'editor-desktop.png')});
    const download=async format=>{
        const previous=new Map(await Promise.all((await fs.readdir(downloads)).map(async f=>[f,(await fs.stat(path.join(downloads,f))).mtimeMs])));
        await page.evaluate(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label).click(),`Export ${format.toUpperCase()}`);
        let saved;
        for(let i=0;i<200&&!saved;i++) {
            for(const f of await fs.readdir(downloads))if(f.endsWith(`.${format}`)&&(!previous.has(f)||(await fs.stat(path.join(downloads,f))).mtimeMs>previous.get(f)))saved=f;
            if(!saved)await new Promise(r=>setTimeout(r,100));
        }
        assert.ok(saved,`No ${format} download: ${await page.$eval('body',e=>e.innerText)}`);
        const bytes=await fs.readFile(path.join(downloads,saved));
        if(format==='stl')assert.equal(bytes.length,84+50*bytes.readUInt32LE(80));
        else {
            const files=unzipSync(bytes);const model=strFromU8(files['3D/3dmodel.model']);
            assert.equal((model.match(/<mesh>/g)||[]).length,2,'cap and text parts preserved');
            assert.equal((model.match(/<base /g)||[]).length,2,'two material colors preserved');
            for(const required of ['[Content_Types].xml','_rels/.rels'])assert.ok(files[required]);
        }
    };
    await download('stl');await download('3mf');await download('stl');
    console.log('PASS: actual editor STL, 3MF, and repeated STL download; cap/text parts and colors.');
    // Layout controls change the actual geometry, including explicit line breaks.
    await setText('NATE');
    for(const [label,expected] of [['1 Line','NATE'],['2 Lines','NA / TE'],['3 Lines','N / AT / E']]) {
        await page.evaluate(label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label).click(),label);
        await ready();
        await page.waitForFunction(expected=>document.querySelector('[data-testid="typography-diagnostics"]').textContent.includes(expected),{},expected);
    }
    await setText('NA\nTE');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='2 Lines').click());await ready();
    await page.waitForFunction(()=>document.querySelector('[data-testid="typography-diagnostics"]').textContent.includes('NA / TE'));
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='1 Line').click());
    await setText('KEN');await setText('CAMI');await ready();
    await page.waitForFunction(()=>document.querySelector('[data-testid="typography-diagnostics"]').textContent.includes('CAMI'));
    await setText('🙂');
    await page.waitForFunction(()=>document.body.innerText.includes('does not contain'));
    const previous=(await fs.readdir(downloads)).length;
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export STL').click());
    await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('does not contain'));
    assert.equal((await fs.readdir(downloads)).length,previous);
    await setText('KEN');await ready();
    console.log('PASS: actual layout controls, explicit newlines, rapid edits, invalid export block and recovery.');
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    // Changing mobile emulation reloads Chromium; measure the mounted editor.
    await ready();
    await page.screenshot({path:path.join(output,'editor-mobile.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS: mobile width and no browser runtime errors.');
} catch(error) {
    if(page) {await page.screenshot({path:path.join(output,'editor-failure.png')});await fs.writeFile(path.join(output,'editor-failure.txt'),await page.$eval('body',e=>e.innerText));}
    throw error;
} finally {await fs.writeFile(path.join(output,'editor-errors.json'),JSON.stringify(errors));await browser?.close();await server.close();await env.cleanup();}
