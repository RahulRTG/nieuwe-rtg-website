'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop, letOpFouten } = require('./helper');
const pw = laadPlaywright();
const root = path.resolve(__dirname, '..');
const sourceFaqCount = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
 .matchAll(/<details\b[^>]*\bdata-faq=["'][^"']+["']/g)].length;
async function ready(page){
 await page.waitForSelector('body[data-platform-role="organisatie"]');
 await page.waitForSelector('.rtg-experience-edge .rtg-adaptive-bar');
}
async function artwork(page, basePath='/'){
 for(const [selector,file] of [['.pp-feature-photo','worlds/heritage/travel-heritage-v2.jpg'],['.ds-beleving-signatuur img','brand/owner-20261114/brush-orbit.jpg'],['.ds-beleving-penseel','brand/owner-20261114/brush-ribbon.jpg']]){
  const img=page.locator(selector);
  assert.equal(await img.count(),1);
  assert.equal(new URL(await img.getAttribute('src'),page.url()).pathname,basePath+'images/'+file);
  await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(selector=>{const img=document.querySelector(selector);return img.complete&&img.naturalWidth>0;},selector);
 }
}
async function paintedEdge(page){
 const bar=page.locator('.rtg-adaptive-bar');
 await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-bar .ds-beleving-edgeverf')?.complete);
 const state=await bar.evaluate(el=>({children:[...el.children].map(n=>({tag:n.tagName,action:n.dataset.rtgAdaptiveAction,texture:n.classList.contains('ds-beleving-edgeverf')})),icons:[...el.querySelectorAll('svg')].map(n=>getComputedStyle(n).color),texture:el.querySelector('.ds-beleving-edgeverf').naturalWidth}));
 assert.equal(state.children.length,6,'de textuur komt na de vijf bestaande knoppen');
 assert.ok(state.children.slice(0,5).every(n=>n.tag==='BUTTON'));
 assert.equal(state.children[2].action,'ai','Rahul blijft de middelste knop');
 assert.equal(state.children[5].texture,true);
 assert.ok(state.texture>0,'de geschilderde textuur is geladen');
 assert.ok(state.icons.length>0);
 assert.ok(state.icons.every(color=>color==='rgb(255, 255, 255)'),'de iconen op de geschilderde balk zijn wit');
 assert.equal(await bar.locator('.ds-beleving-edgeverf').isVisible(),true);
 assert.equal(await bar.locator('.rtg-adaptive-item-copy').count(),0,'visuele labels ontbreken bewust; aria-labels blijven');
 assert.equal(await bar.locator('button[aria-label]').count(),5);
 await page.evaluate(()=>window.RTGAdaptiveEdge.setState('peek'));
 assert.equal(await bar.locator('[data-rtg-adaptive-action="ai"] .ds-beleving-edge-merk').isVisible(),true,'de lippen blijven in de ruststand zichtbaar');
 await page.evaluate(()=>window.RTGAdaptiveEdge.setState('dock'));
}
async function appEntry(page,width){
 const entry=page.locator('.pp-feature-copy').getByRole('link',{name:'Open de RTG-app',exact:true});
 assert.equal(await entry.count(),1,'decoratieve pijlen veranderen de toegankelijke naam niet');
 assert.equal(new URL(await entry.getAttribute('href'),page.url()).pathname,'/apps/app.html');
 const style=await entry.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
 assert.deepEqual(style,{color:'rgb(12, 12, 11)',background:'rgb(223, 189, 136)'},'de directe appactie behoudt leesbaar contrast');
 assert.equal(new URL(await page.locator('.pp-header .ds-beleving-appkort').getAttribute('href'),page.url()).pathname,'/apps/app.html');
}
async function moreSections(page){
 const details=page.locator('[data-public-sections-more]');
 if(await details.getAttribute('open')===null)await details.locator('summary').click();
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
   assert.equal(await page.locator('#platform-story-title').innerText(),'De wereld. Op uw manier.');
   assert.equal(await page.locator('.pp-story[data-public-story]').count(),1);
   assert.equal(await page.locator('.pp-stories').isHidden(),true);
   assert.equal(await page.locator('.pp-library-tools').isHidden(),true);
   assert.equal(new URL(await page.locator('.pp-secure-link').getAttribute('href')).pathname,'/apps/app.html');
   await appEntry(page,width);
   await paintedEdge(page);
   assert.equal(await page.locator('.wd-catalog [data-public-widget]').first().getAttribute('data-public-widget'),'travel','reizen opent de publieke catalogus');
   await artwork(page);
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rtg-website-truth',{detail:window.RTGWebsiteTruth})));
   await artwork(page);
   await page.getByRole('button',{name:'Ontdek onze reizen',exact:true}).click();
   assert.equal(await page.locator('[data-room="travel"]').isVisible(),true,'de hoofdactie opent TravelOS');
   assert.equal(await page.locator('body').getAttribute('data-rtg-world'),'travel');
   await page.locator('.wd-focus-head .wd-text-button').click();
   assert.equal(await page.locator('.pp-feature').isVisible(),true,'terug brengt de bezoeker naar de reisentree');
   await page.locator('[data-public-widget="work"] .ds-beleving-hoofdstuk__details summary').click();
   assert.match(await page.locator('[data-public-world-facts="work"]').innerText(),/17 apps.*MAPPEN/i);
   await moreSections(page);
   await page.locator('.pp-section-index').getByRole('button',{name:'Rahul',exact:true}).click();
   await page.locator('#intent').fill('Ik wil met mijn gezin op reis');
   await page.locator('#intentForm button').click();
   assert.match(await page.locator('#intentFeedback').innerText(),/Amsterdam naar Ibiza/);
   await page.locator('.wd-focus-head .wd-text-button').click();
   assert.equal(await page.locator('.pp-itinerary').isHidden(),true,'demoreisgegevens verschijnen niet als een echte reis in de entree');
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
   await page.getByRole('button',{name:'Wis mijn demokeuzes',exact:true}).click();
   await artwork(page);
   assert.equal(await page.locator('#platform-story-title').innerText(),'De wereld. Op uw manier.','reset bewaart de reisentree');
   await page.locator('[data-public-widget="work"] .ds-beleving-link').click();
   await page.locator('[data-room="work"] .app-truth-detail').click();
   assert.equal(await page.locator('[data-room="work"] .app-truth-groups a').count(),17);
   const eersteApp=page.locator('[data-room="work"] .app-truth-app-detail').first();
   await eersteApp.locator('summary').click();
   assert.notEqual((await eersteApp.locator('.app-truth-app-summary').innerText()).trim(),'');
   assert.ok(await eersteApp.locator('.app-truth-actions li').count()>0);
   assert.notEqual((await eersteApp.locator('.app-truth-note').innerText()).trim(),'');
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
   assert.equal(await page.locator('.arrival-interface img').count(),3);
   assert.equal(await page.locator('[data-stage-screen] img').count(),3);
   assert.equal(await page.locator('.wd-catalog [data-public-widget]').count(),4);
   await moreSections(page);
   assert.equal(await page.evaluate(()=>{const r=document.querySelector('.rtg-adaptive-bar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator('.pp-section-index button', {hasText:'Organisatie, partner en gebruiker'}).click();
   await page.locator('.role-switch [data-role-select="partner"]').click();
   assert.equal(await page.locator('body').getAttribute('data-platform-role'),'partner');
   assert.match(await page.locator('#roleTitle').innerText(),/Verbind uw bedrijf/);
   assert.equal(await page.locator('[data-stage-screen="partner"]').evaluate(node=>node.classList.contains('is-active')),true);
   await page.locator('.role-switch [data-role-select="gebruiker"]').click();
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('rtg-www-role')),'gebruiker');
   assert.match(await page.locator('#roleCapabilities').innerText(),/Foundation/);
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
   await page.locator('.pp-section-index button', {hasText:'De RTG Graph'}).click();
   await page.locator('[data-graph-topic="werknemer"]').click();
   assert.match(await page.locator('#graphCaption').innerText(),/uren/i);
   await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
   await page.locator('.pp-section-index button', {hasText:'Verken het RTG-platform'}).click();
   await page.keyboard.press('Control+k');
   await page.locator('#commandSearch').fill('personeel');
   await page.waitForSelector('.command-result');
   assert.match(await page.locator('.command-result').first().innerText(),/Personeel/i);
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   await page.goto(srv.base+'/',{waitUntil:'domcontentloaded'});await ready(page);
   const appHref=new URL(await page.locator('.pp-secure-link').getAttribute('href'),page.url()).href;
   await context.route(appHref,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Afgeschermde appbestemming</title>'}));
   await Promise.all([page.waitForURL(appHref),page.locator('.pp-feature-copy').getByRole('link',{name:'Open de RTG-app',exact:true}).click()]);
   assert.equal(page.url(),appHref,'de echte klik navigeert naar de bedoelde app; de app zelf is in deze proef gestubd');
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
      await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
      const page = await context.newPage(), failed = [];
      page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
      await page.goto('http://127.0.0.1:' + server.address().port + prefix, { waitUntil: 'networkidle' });
      if (javaScriptEnabled) {
        await ready(page);
        const brandImage = page.locator('.pp-header .ds-beleving-merk img');
        assert.match(await brandImage.getAttribute('src'), /brand\/owner-20261114\/lips\.jpg$/);
        assert.equal(await brandImage.getAttribute('alt'), 'RTG');
        assert.equal(await brandImage.evaluate(img => img.complete && img.naturalWidth > 0), true);
        await artwork(page, prefix + 'public/');
        assert.equal(await page.locator('.pp-feature-copy').evaluate(el => getComputedStyle(el).textAlign), 'start');
        assert.equal(await page.locator('#roleCta').getAttribute('href'), 'https://app.rahultravelgroup.com/apps/werk.html');
        await appEntry(page,390);
        await paintedEdge(page);
        const publicLayout = await page.evaluate(() => {
          const hero = document.querySelector('.pp-feature'), shell = document.querySelector('.pp-shell');
          return [hero, shell].map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, viewport: innerWidth }; });
        });
        for (const frame of publicLayout) {
          assert.ok(Math.abs(frame.left) < 1 && Math.abs(frame.right - frame.viewport) < 1, 'de publieke compositie loopt tot beide schermranden');
        }
        assert.match(await page.locator('.pp-footer a[href$="/apps/juridisch/voorwaarden.html"]').innerText(), /bestaand/i,
          'ook de door JavaScript opgebouwde footer wijst herkenbaar naar bestaande voorwaarden');
        await page.locator('.pp-section-index button', { hasText: 'Wat wilt u weten?' }).click();
        const faqPolicy = page.locator('[data-faq]').filter({ has: page.locator('a[href="#prijsbeleid"]') }).first();
        await faqPolicy.locator('summary').click();
        await faqPolicy.locator('a[href="#prijsbeleid"]').click();
        await page.waitForFunction(() => document.querySelector('.pp-detail-content #prijsbeleid'));
        assert.equal(await page.locator('#passen').isVisible(), true, 'een gewone nested ankerlink opent de canonieke passenscene');
        assert.equal(await page.locator('#prijsbeleid').isVisible(), true);
        await page.evaluate(() => { location.hash = 'commissie'; });
        await page.waitForFunction(() => document.querySelector('.pp-detail-content #commissie')?.open === true);
        assert.equal(await page.locator('#commissie table').isVisible(), true, 'hashchange opent ook de doel-details');
        await page.goto('http://127.0.0.1:' + server.address().port + prefix + '#commissie', { waitUntil: 'networkidle' });
        await ready(page);
        await page.waitForFunction(() => document.querySelector('.pp-detail-content #commissie')?.open === true);
        assert.equal(await page.locator('#commissie table').isVisible(), true, 'een rechtstreeks geopend nested fragment blijft bereikbaar');
      } else {
        const hero = page.locator('#heroPhotoA');
        assert.equal(new URL(await hero.getAttribute('src'), page.url()).pathname, prefix + 'public/images/worlds/heritage/travel-heritage-v2.jpg');
        assert.equal(await hero.evaluate(img => img.complete && img.naturalWidth > 0), true, 'ook zonder JavaScript laadt het geregistreerde reisbeeld');
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
        await page.getByRole('link', { name: 'Passen', exact: true }).click();
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
  await veeg(page);
  await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState==='expanded');
  const landing=await blad(page);
  assert.equal(landing.leeg,0,'geen lege melding op de landing');
  assert.deepEqual(landing.kern,
    landing.kern.length ? ['Nu','Rahul','Connect','Media','Account'] : [],
    'als de kernlijst al zichtbaar is, bevat hij exact de vijf functionele Edge-schermen');
  assert.deepEqual(landing.rijen.filter(r=>!['Nu','Rahul','Connect','Media','Account'].includes(r)),
    ['Volgend hoofdstuk','Vorig hoofdstuk','Bekijk het voorstel','Waarom zie ik dit?','Wis mijn demokeuzes'],
    'de acties van het publieke platform');
  assert.equal(await page.locator('.rtg-adaptive-sheet .pp-menu-item').first().isVisible(),true);
  await page.goto(srv.base+'/site/werelden/livingos.html');
  await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
  await veeg(page);
  await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState==='expanded');
  const site=await blad(page);
  assert.equal(site.leeg,0,'geen lege melding op de sitepagina');
  assert.deepEqual(site.kern,
    site.kern.length ? ['Nu','Rahul','Connect','Media','Account'] : [],
    'ook een sitepagina toont uitsluitend de vijf functionele Edge-schermen');
  assert.ok(site.rijen.includes('Stel uw vraag over RTG'),'de rijen van de pagina: '+site.rijen.join(', '));
  for(const world of ['travel','living','work','foundation']){
   await page.goto(srv.base+'/site/werelden/'+world+'os.html');
   await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
   assert.equal(await page.locator('.ds-reiscover').count(),1,world+' heeft één eigen cover');
   assert.notEqual((await page.locator('.ds-reiscover h1').innerText()).trim(),'');
   const worldPhoto=page.locator('.ds-reiscover__beeld img');
   assert.equal(await worldPhoto.count(),1,world+' krijgt geen tweede geïnjecteerde foto');
   assert.equal(new URL(await worldPhoto.getAttribute('src'),page.url()).pathname,'/images/worlds/owner-20261114/'+world+'.jpg');
   await worldPhoto.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const img=document.querySelector('.ds-reiscover__beeld img');return img.complete&&img.naturalWidth>0;});
   assert.equal(await page.locator('body').getAttribute('data-public-world'),world);
   for(const selector of ['.ds-reiscover','main#verhaal']){
    const theme=await page.locator(selector).getAttribute('data-public-world');
    assert.ok(theme===null||theme===world,world+' erft geen geforceerd ander wereldpalet');
   }
   if(world==='travel'){
    assert.equal(await page.locator('.ds-reiscover h1').innerText(),'TravelOS');
    assert.equal(new URL(await page.locator('.pp-header .ds-beleving-appkort').getAttribute('href'),page.url()).pathname,'/apps/reizen.html');
   }
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{if(browser)await browser.close();await stop(srv);}
});
