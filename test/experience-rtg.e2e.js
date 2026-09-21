'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop, letOpFouten } = require('./helper');
const pw = laadPlaywright();
const root = path.resolve(__dirname, '..');
async function ready(page){
 await page.waitForSelector('body[data-platform-role="organisatie"]');
 await page.waitForSelector('.rtg-experience-edge .rtg-adaptive-bar');
}

test('De publieke B2B2C-ervaring wisselt van kant, zoekt in de echte app en past op ieder scherm',
 {skip:geenBrowser(pw),timeout:180000},async t=>{
 const srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});let browser;
 try{
  browser=await pw.chromium.launch(browserOpties(pw));
  for(const width of [320,390,1440])await t.test('viewport '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   await context.addInitScript(()=>localStorage.setItem('rtg_lang','nl'));
   await context.route('**/api/vertaal/ui',r=>r.fulfill({status:503,body:'Deliberate translation outage'}));
   const page=await context.newPage(),errors=[],failed=[],mutations=[];
   letOpFouten(page,errors);
   page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))failed.push(r.url());});
   page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())&&!['/api/talen','/api/vertaal/ui'].includes(new URL(r.url()).pathname))mutations.push(r.url());});
   await page.goto(srv.base+'/',{waitUntil:'domcontentloaded'});await ready(page);
   assert.equal(await page.locator('.rtg-adaptive-bar').count(),1);
   assert.equal(await page.locator('.arrival-interface img').count(),3);
   assert.equal(await page.locator('[data-stage-screen] img').count(),3);
   assert.equal(await page.evaluate(()=>{const r=document.querySelector('.rtg-adaptive-bar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator('.role-switch [data-role-select="partner"]').click();
   assert.equal(await page.locator('body').getAttribute('data-platform-role'),'partner');
   assert.match(await page.locator('#roleTitle').innerText(),/Verbind uw bedrijf/);
   assert.equal(await page.locator('[data-stage-screen="partner"]').evaluate(node=>node.classList.contains('is-active')),true);
   await page.locator('.role-switch [data-role-select="gebruiker"]').click();
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('rtg-www-role')),'gebruiker');
   assert.match(await page.locator('#roleCapabilities').innerText(),/Foundation/);
   await page.locator('[data-graph-topic="werknemer"]').click();
   assert.match(await page.locator('#graphCaption').innerText(),/uren/i);
   await page.locator('.command-open').click();
   await page.locator('#commandSearch').fill('personeel');
   await page.waitForSelector('.command-result');
   assert.match(await page.locator('.command-result').first().innerText(),/Personeel/i);
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   await context.close();
  });
 }finally{if(browser)await browser.close();await stop(srv);}
});

test('static project path and JavaScript-disabled visitors retain content and relative assets',
  { skip: geenBrowser(pw), timeout: 60000 }, async () => {
  const prefix = '/nieuwe-rtg-website/';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = path.resolve(root, relative);
    if ((relative !== 'index.html' && !relative.startsWith('public/')) || !file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
    try {
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), failed = [];
      page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
      await page.goto('http://127.0.0.1:' + server.address().port + prefix, { waitUntil: 'networkidle' });
      if (javaScriptEnabled) {
        await ready(page);
        assert.equal(await page.locator('#roleCta').getAttribute('href'), 'https://app.rahultravelgroup.com/apps/werk.html');
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rtg-adaptive-bar')).getPropertyValue('--edge-bar-bg').trim()), '#0a0805');
      } else {
        assert.equal(await page.locator('[data-room]:visible').count(), 4);
        assert.equal(await page.locator('[data-faq]:visible').count(), 23);
        await page.getByRole('link', { name: 'Passen', exact: true }).click();
        assert.equal(new URL(page.url()).hash, '#passen');
      }
      assert.deepEqual(failed, []);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
