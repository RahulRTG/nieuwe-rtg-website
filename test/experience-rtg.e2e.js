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
   await page.waitForFunction(()=>document.documentElement.dataset.websiteTruth==='actueel');
   const worldThemes=await page.locator('[data-app-truth-world]').evaluateAll(cards=>cards.map(card=>({
    world:card.dataset.rtgWorld,accent:getComputedStyle(card).getPropertyValue('--ds-accent').trim(),
    overlay:getComputedStyle(card,'::after').backgroundImage,
    ink:getComputedStyle(card.querySelector('h3')).color,
    image:new URL(card.querySelector(':scope > img').src).pathname
   })));
   assert.deepEqual(worldThemes.map(item=>item.world),['living','travel','work','foundation']);
   assert.equal(new Set(worldThemes.map(item=>item.accent.toLowerCase())).size,4,
    'de vier kaarten erven vier verschillende app-accenten: '+JSON.stringify(worldThemes));
   assert.equal(new Set(worldThemes.map(item=>item.overlay)).size,4,
    'de fotografische gloed volgt het accent van iedere wereld: '+JSON.stringify(worldThemes));
   assert.deepEqual(worldThemes.map(item=>item.image),[
    '/images/world-homes/living-warm.jpg','/images/world-homes/travel-warm.jpg',
    '/images/world-homes/work-warm.jpg','/images/world-homes/foundation-warm.jpg'
   ],'de www-kaarten tonen dezelfde hoofdfoto’s als de appwerelden');
   assert.ok(worldThemes.every(item=>item.overlay!=='none'&&item.ink.match(/^rgb\(2[3-5]\d, 2[3-5]\d, 2[2-5]\d\)$/)),
    'iedere fotokaart heeft een leeslaag en witte koptekst: '+JSON.stringify(worldThemes));
   assert.equal(await page.locator('.rtg-adaptive-bar').count(),1);
   assert.match(await page.locator('#platform-story-title').innerText(),/Technologie rondom mensen/i);
   assert.equal(await page.locator('.pp-story[data-public-story]').count(),1);
   assert.equal(await page.locator('.pp-stories').isHidden(),true);
   assert.equal(await page.locator('.pp-library-tools').isHidden(),true);
   assert.equal(new URL(await page.locator('.pp-secure-link').getAttribute('href')).pathname,'/apps/app.html');
   assert.match(await page.locator('[data-public-world-facts="work"]').innerText(),/17 apps.*MAPPEN/i);
   const dagdeel=await page.locator('html').getAttribute('data-dagdeel'),beelden={ochtend:'morning',middag:'afternoon',avond:'evening',nacht:'night'};
   assert.match(await page.locator('.pp-feature-photo').getAttribute('src'),new RegExp('public-'+beelden[dagdeel]+'\\.webp$'));
   await page.getByRole('button',{name:'Vertel Rahul wat u wilt bereiken'}).click();
   await page.locator('#intent').fill('Ik wil met mijn gezin op reis');
   await page.locator('#intentForm button').click();
   assert.match(await page.locator('#intentFeedback').innerText(),/Amsterdam naar Ibiza/);
   await page.locator('.wd-focus-head .wd-text-button').click();
   await page.locator('[data-public-widget="work"] .pp-widget-head').click();
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
   await page.locator('[data-public-sections-more] summary').click();
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
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rtg-adaptive-bar')).getPropertyValue('--edge-bar-bg').trim()), '#1b1713');
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
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{if(browser)await browser.close();await stop(srv);}
});
