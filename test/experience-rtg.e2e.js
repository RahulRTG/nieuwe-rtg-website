'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop, letOpFouten } = require('./helper');
const pw = laadPlaywright();
const edgeUI = require('./public-edge-interactions');
const root = path.resolve(__dirname, '..');
const sourceFaqCount = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
 .matchAll(/<details\b[^>]*\bdata-faq=["'][^"']+["']/g)].length;
async function ready(page){
 await page.waitForSelector('body[data-platform-role="organisatie"]');
 await page.waitForFunction(()=>!!window.RTGPublicApp&&!!history.state?.rtgMagazine);
 await page.locator('.ds-public-edge-toggle').waitFor({state:'visible'});
 await page.evaluate(()=>document.fonts.ready);
}
async function publication(page){
 await edgeUI.action(page,'context');
 const button=page.locator(edgeUI.sheetSelector).getByRole('button',{name:'Service, informatie en colofon',exact:true});
 await edgeUI.seek(page,button);await button.click();
 await page.locator('#magazineDetailContent > .ds-magazine-footer').waitFor({state:'visible'});
 const service=page.locator('#magazineService');
 if(!await service.evaluate(el=>el.open))await service.locator(':scope > summary').click();
}
async function section(page,label){
 await publication(page);
 const directory=page.locator('.ds-magazine-directory > details');
 if(!await directory.evaluate(el=>el.open))await directory.locator(':scope > summary').click();
 const button=page.locator('#magazineDirectory').getByRole('button',{name:label,exact:true});
 if(!await button.isVisible())await page.locator('[data-public-sections-more] > summary').click();
 await button.click();
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
   await page.waitForFunction(()=>document.documentElement.dataset.websiteTruth==='actueel');
   assert.equal(await page.locator('.rtg-adaptive-bar').count(),1);
   assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),false,'standaard gesloten, geen vaste websitebalk');
   assert.equal(await page.locator('#issueTrack > [data-issue-page]').count(),18);
   assert.match(await page.locator('#issue-cover-title').innerText(),/JOURNAL/);
   assert.equal(await page.locator('.wd-shell').count(),0,'geen tweede desktop-eigenaar naast het magazine');
   assert.equal(new URL(await page.locator('[aria-label="Mijn RTG"]').getAttribute('href')).pathname,'/apps/app.html');
   await edgeUI.action(page,'ai');
   await page.locator('#intent').fill('Ik wil met mijn gezin op reis');
   await page.locator('#intentForm button').click();
   assert.match(await page.locator('#intentFeedback').innerText(),/Amsterdam naar Ibiza/);
   await section(page,'Werelden');
   await page.locator('.ds-public-world-choices [data-select-world="work"]').click();
   await page.locator('[data-room="work"] .app-truth-detail').click();
   assert.equal(await page.locator('[data-room="work"] .app-truth-groups a').count(),17);
   const eersteApp=page.locator('[data-room="work"] .app-truth-app-detail').first();
   await eersteApp.locator('summary').click();
   assert.notEqual((await eersteApp.locator('.app-truth-app-summary').innerText()).trim(),'');
   assert.ok(await eersteApp.locator('.app-truth-actions li').count()>0);
   assert.notEqual((await eersteApp.locator('.app-truth-note').innerText()).trim(),'');
   await edgeUI.action(page,'home');
   assert.equal(await page.locator('.arrival-interface img').count(),3);
   assert.equal(await page.locator('[data-stage-screen] img').count(),3);
   assert.equal(await page.locator('.ds-public-world-choices [data-select-world]').count(),4);
   assert.equal(await edgeUI.hit(page.locator('.ds-public-edge-toggle')),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await section(page,'Organisatie, partner en gebruiker');
   await page.locator('.role-switch [data-role-select="partner"]').click();
   assert.equal(await page.locator('body').getAttribute('data-platform-role'),'partner');
   assert.equal(await page.locator('#roleTitle').innerText(),'Uw zaak. Uw eigen karakter.');
   assert.match(await page.locator('#roleBoundary').innerText(),/alleen de eigen zaak/);
   assert.equal(await page.locator('[data-stage-screen="partner"]').evaluate(node=>node.classList.contains('is-active')),true);
   await page.locator('.role-switch [data-role-select="gebruiker"]').click();
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('rtg-www-role')),'gebruiker');
   assert.match(await page.locator('#roleCapabilities').innerText(),/Foundation/);
   await section(page,'De RTG Graph');
   await page.locator('[data-graph-topic="werknemer"]').click();
   assert.match(await page.locator('#graphCaption').innerText(),/uren/i);
   await section(page,'Verken het RTG-platform');
   await page.keyboard.press('Control+k');
   await page.locator('#commandSearch').fill('personeel');
   await page.waitForSelector('.command-result');
   assert.match(await page.locator('.command-result').first().innerText(),/Personeel/i);
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   await context.close();
  });
 }finally{if(browser)await browser.close();await stop(srv.child);}
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
      await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
      const page = await context.newPage(), failed = [];
      page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
      await page.goto('http://127.0.0.1:' + server.address().port + prefix, { waitUntil: 'networkidle' });
      if (javaScriptEnabled) {
        await ready(page);
        assert.equal(await page.locator('#roleCta').getAttribute('href'), 'https://app.rahultravelgroup.com/apps/werk.html');
        assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(),false);
        await publication(page);
        assert.match(await page.locator('.pp-footer a[href$="/apps/juridisch/voorwaarden.html"]').innerText(), /bestaand/i,
          'ook de door JavaScript opgebouwde footer wijst herkenbaar naar bestaande voorwaarden');
        await section(page,'Wat wilt u weten?');
        const faqPolicy = page.locator('[data-faq]').filter({ has: page.locator('a[href="#prijsbeleid"]') }).first();
        await faqPolicy.locator('summary').click();
        await faqPolicy.locator('a[href="#prijsbeleid"]').click();
        await page.waitForFunction(() => document.querySelector('#magazineDetailContent #prijsbeleid'));
        assert.equal(await page.locator('#passen').isVisible(), true, 'een gewone nested ankerlink opent de canonieke passenscene');
        assert.equal(await page.locator('#prijsbeleid').isVisible(), true);
        await page.evaluate(() => { location.hash = 'commissie'; });
        await page.waitForFunction(() => document.querySelector('#magazineDetailContent #commissie')?.open === true);
        assert.equal(await page.locator('#commissie table').isVisible(), true, 'hashchange opent ook de doel-details');
        await page.goto('http://127.0.0.1:' + server.address().port + prefix + '#commissie', { waitUntil: 'networkidle' });
        await ready(page);
        await page.waitForFunction(() => document.querySelector('#magazineDetailContent #commissie')?.open === true);
        assert.equal(await page.locator('#commissie table').isVisible(), true, 'een rechtstreeks geopend nested fragment blijft bereikbaar');
      } else {
        assert.equal(await page.locator('[data-room]:visible').count(), 4);
        assert.ok(sourceFaqCount > 0, 'de broninventaris bevat werkelijk veelgestelde vragen');
        assert.equal(await page.locator('[data-faq]:visible').count(), sourceFaqCount,
          'iedere actuele bronvraag blijft zichtbaar zonder JavaScript');
        for (const faq of await page.locator('[data-faq]').all()) {
          assert.equal(await faq.locator('summary').count(), 1);
          await faq.locator('summary').click();
          assert.equal(await faq.locator('p').first().isVisible(), true, 'het native details-element ontsluit het antwoord');
          assert.notEqual((await faq.locator('p').first().innerText()).trim(), '');
        }
        await page.locator('#service-gids a[href="#passen"]').click();
        assert.equal(new URL(page.url()).hash, '#passen');
      }
      assert.deepEqual(failed, []);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

/* Omhoog vegen op de balk vraagt eerst de host (EDGE.md, ronde 2 stap 15). De
   landing en de sitepagina's hebben een eigen paneel met de rijen van hun
   scene; zonder die vraag toonde het blad de kernlijst van de Edge, en zonder
   het tweede register is dat de lege melding. Bij 390x844, met een echte veeg. */
test('omhoog vegen op de landing en een sitepagina opent het paneel van de host',
 {skip:geenBrowser(pw),timeout:120000},async()=>{
 const srv=await startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});let browser;
 const veeg=page=>page.evaluate(()=>{
  const bar=document.querySelector('.rtg-adaptive-bar'),r=bar.getBoundingClientRect(),sx=r.left+r.width/2,sy=r.top+r.height/2;
  const maak=(type,cy)=>bar.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',button:0,clientX:sx,clientY:cy}));
  maak('pointerdown',sy);maak('pointermove',sy-90);maak('pointerup',sy-90);
 });
 const blad=page=>page.evaluate(()=>{
  const sheet=document.querySelector('.rtg-adaptive-sheet');
  return {staat:document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState,
   leeg:sheet.querySelectorAll('.rtg-adaptive-empty').length,
   kern:[...sheet.querySelectorAll('.rtg-adaptive-sheet-list:not([hidden]) .rtg-adaptive-sheet-action')].map(b=>b.textContent),
   rijen:[...sheet.querySelectorAll('nav button,.pp-menu-item')].map(b=>b.textContent)};
 });
 try{
  browser=await pw.chromium.launch(browserOpties(pw));
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('rtg_lang','nl'));
  await context.route('**/api/vertaal/ui',r=>r.fulfill({status:503,body:'Deliberate translation outage'}));
  const page=await context.newPage(),errors=[];letOpFouten(page,errors);
  await page.goto(srv.base+'/',{waitUntil:'domcontentloaded'});await ready(page);
  await page.locator('.ds-public-edge-toggle').click();
  await veeg(page);
  await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState==='expanded');
  const landing=await blad(page);
  assert.equal(landing.leeg,0,'geen lege melding op de landing');
  assert.deepEqual(landing.kern,
    landing.kern.length ? ['Nu','Rahul','Connect','Media','Account'] : [],
    'als de kernlijst al zichtbaar is, bevat hij exact de vijf functionele Edge-schermen');
  for(const label of ['Inhoud van deze editie','Zoek in RTG','Service, informatie en colofon','Bekijk het voorstel','Waarom zie ik dit?','Wis mijn demokeuzes'])assert.ok(landing.rijen.includes(label),'oorspronkelijke magazineactie blijft bereikbaar: '+label);
  assert.equal(await page.locator('.rtg-adaptive-sheet [data-carousel-prev]').count(),1);
  assert.equal(await page.locator('.rtg-adaptive-sheet [data-carousel-next]').count(),1);
  const original=page.locator('.rtg-adaptive-sheet').getByRole('button',{name:'Bekijk het voorstel',exact:true});
  await edgeUI.seek(page,original);
  assert.equal(await original.isVisible(),true);
  await page.goto(srv.base+'/site/werelden/livingos.html');
  await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
  await page.locator('.ds-public-edge-toggle').click();
  await veeg(page);
  await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState==='expanded');
  const site=await blad(page);
  assert.equal(site.leeg,0,'geen lege melding op de sitepagina');
  assert.deepEqual(site.kern,
    site.kern.length ? ['Nu','Rahul','Connect','Media','Account'] : [],
    'ook een sitepagina toont uitsluitend de vijf functionele Edge-schermen');
  assert.ok(site.rijen.includes('Stel uw vraag over RTG'),'de rijen van de pagina: '+site.rijen.join(', '));
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{if(browser)await browser.close();await stop(srv.child);}
});
