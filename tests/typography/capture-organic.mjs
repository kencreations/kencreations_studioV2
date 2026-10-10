import fs from 'node:fs/promises';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
const mode=process.argv[2]||'after';
const server=await createServer({server:{host:'127.0.0.1',port:5184,strictPort:true}});let browser;
try {
 await server.listen();browser=await puppeteer.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:1210,height:1300});page.on('pageerror',e=>console.error(e.message));
 await page.goto(`http://127.0.0.1:5184/tests/typography/organic.html?mode=${mode}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.done,{timeout:180000});
 await fs.mkdir('audit-artifacts/typography',{recursive:true});
 await page.screenshot({path:`audit-artifacts/typography/organic-${mode}.png`,fullPage:true});
 for(let i=0;i<7;i++) {
   const cards=await page.$$('.card');const first=await cards[i*4].boundingBox(),last=await cards[i*4+3].boundingBox();
   await page.screenshot({path:`audit-artifacts/typography/organic-${mode}-${i}.png`,clip:{x:first.x,y:first.y,width:last.x+last.width-first.x,height:first.height}});
 }
 await fs.writeFile(`audit-artifacts/typography/organic-${mode}.json`,JSON.stringify(await page.evaluate(()=>window.metrics),null,2));
 console.log(`${mode}: 28 organic vector/top-view compositions captured`);
}finally{await browser?.close();await server.close();}
