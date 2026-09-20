'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop, letOpFouten } = require('./helper');
const pw = laadPlaywright();
const root = path.resolve(__dirname, '..');
const menu = page => page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
async function go(page,id){await menu(page);await page.locator('[data-public-target="'+id+'"]:visible').click();}
async function ready(page){await page.waitForSelector('body[data-public-platform="app"][data-rtg-adaptive-ready="true"]');}
async function actions(page,name){await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();await page.getByRole('button',{name,exact:true}).click();}

test('Public app projection: native layout, effects, language failover and explicit onboarding handoff',
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
   assert.equal(await page.locator('.wd-catalog>.pp-widget').count(),9);
   assert.equal(await page.evaluate(()=>{const r=document.querySelector('.rtg-adaptive-bar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator('#platform-search').fill('Foundation');
   assert.equal(await page.locator('.wd-catalog>.pp-widget:visible').count(),1);
   await page.locator('#platform-search').fill('no-matching-topic');
   assert.equal(await page.locator('.pp-empty').isVisible(),true);
   await page.locator('#platform-search').fill('');
   await page.locator('.wd-favorites [data-public-calendar]').check();
   await page.locator('.pp-feature .pp-button').click();
   assert.equal(await page.locator('#moment').isVisible(),true);
   assert.match(await page.locator('#demoResult').innerText(),/conflict/);
   await page.locator('#demoOption').selectOption('late');
   assert.match(await page.locator('#demoSteps').innerText(),/Avondvertrek past/);
   await actions(page,'Bekijk het voorstel');
   await page.locator('#confirmExample').click();
   assert.match(await page.locator('#exampleReceipt').innerText(),/niets geboekt, betaald, verstuurd of gedeeld/);
   await page.keyboard.press('Escape');
   await go(page,'regie');await page.locator('#allowCalendar').uncheck();await page.locator('#allowLocation').uncheck();
   await go(page,'moment');assert.match(await page.locator('#demoSteps').innerText(),/Agenda niet gedeeld/);
   const before=await page.evaluate(()=>RTGExperience.snapshot());
   await page.evaluate(()=>RTGi18n.set('en',false));
   assert.equal(await page.locator('.pp-header .pp-context').innerText(),'Explore RTG');
   assert.equal(await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small').innerText(),'Worlds');
   assert.deepEqual(await page.evaluate(()=>RTGExperience.snapshot()),before);
   assert.equal(await page.locator('#demoOption').inputValue(),'late');
   await page.evaluate(()=>RTGi18n.set('ar',false));await page.waitForFunction(()=>document.documentElement.dir==='rtl');
   assert.equal(await page.locator('.pp-language-notice').isVisible(),true);
   assert.deepEqual(await page.evaluate(()=>RTGExperience.snapshot()),before);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.evaluate(()=>RTGi18n.set('nl',false));
   await go(page,'vragen');assert.equal(await page.locator('[data-faq]:visible').count(),23);
   await page.locator('#faqSearch').fill('FoundationOS echt');assert.equal(await page.locator('[data-faq]:visible').count(),1);
   await page.locator('[data-faq]:visible summary').click();assert.match(await page.locator('[data-faq]:visible').innerText(),/altijd 100% gratis/);
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="ai"]').click();
   await page.locator('#intent').fill('Ik heb een strandtent met 40 medewerkers');await page.getByRole('button',{name:'Verken mijn voorbeeld',exact:true}).click();
   assert.match(await page.locator('#intentFeedback').innerText(),/Een zaak, één overzicht/);
   await go(page,'world:work');assert.equal(await page.locator('[data-room]:visible').getAttribute('data-room'),'work');
   await go(page,'begin');assert.equal(new URL(await page.locator('#createAccount').getAttribute('href')).hash,'');
   await page.locator('#carryInterests').check();const handoff=new URL(await page.locator('#createAccount').getAttribute('href'));
   assert.equal(handoff.origin,srv.base);assert.match(handoff.hash,/work/);assert.equal(handoff.hash.includes('strandtent'),false);
   assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   await page.locator('#createAccount').click();await page.waitForSelector('#gate .ag-experience',{timeout:60000});
   assert.match(await page.locator('#gate .ag-experience').innerText(),/WorkOS/);assert.equal(new URL(page.url()).hash,'');
   await page.goto(srv.base+'/');await ready(page);
   await actions(page,'Wis mijn demokeuzes');
   assert.equal(await page.evaluate(()=>RTGExperience.snapshot().permissions.calendar),false);
   assert.equal(await page.locator('#carryInterests').isDisabled(),true);
   await menu(page);await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-rtg-adaptive-action')),'menu');
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
        assert.equal(await page.locator('#createAccount').getAttribute('href'), 'https://app.rahultravelgroup.com/apps/app.html');
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
