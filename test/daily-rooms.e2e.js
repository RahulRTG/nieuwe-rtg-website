/* Approved daily rooms, proven with a real empty account and real mutations.
   Failed reads and empty searches are distinct. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const {nativeModalTab}=require('./lib/ds-toets');
const pw = laadPlaywright();
const routes = Object.freeze({ pulse: '/apps/pulse.html', agenda: '/apps/agenda.html',
  bestanden: '/apps/bestanden.html', notities: '/apps/notities.html' });
async function post(base, route, body, token) {
  const r = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  const data = await r.json(); assert.ok(r.ok, route + ': ' + JSON.stringify(data)); return data;
}
async function language(page, code, name) {
  const huidige=(await page.locator('html').getAttribute('lang')).toUpperCase();
  if (await page.locator('html[data-ds]').count()) {
    await page.locator('[data-ds-edge="menu"]').click();
    await page.locator('#dsEdgeBlad:not([hidden])').getByRole('button',{name:/^(Instellingen|Settings)$/}).click();
  } else {
    await page.locator('#osMenuBtn').click();
    await page.locator('.amn-blad').getByRole('button',{name:/^(Instellingen|Settings)$/}).click();
  }
  try { await page.locator('.bdn-blad').getByRole('button',{name:huidige,exact:true}).click(); }
  catch(error) { error.message+='\nTaalcontext: '+JSON.stringify(await page.evaluate(()=>({route:location.pathname,html:document.documentElement.lang,owner:window.RTGi18n?.lang,knoppen:[...document.querySelectorAll('.bdn-blad button')].map(b=>({text:b.textContent,label:b.getAttribute('aria-label'),visible:!!b.getClientRects().length}))})));throw error; }
  await page.locator('#rtg-lang-zoek').fill(name);
  await page.locator('#rtg-lang-hint[data-lang="' + code + '"]').click();
  await page.waitForFunction(c => document.documentElement.lang === c, code);
}
test('Daily rooms: first visit to real content, Edge, language, layout and recovery',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const srv = await startServer({ env: { RTG_DEMO: '0', RTG_MAGNAAT_TEST: '0', RTG_AI_UIT: '1', SMTP_URL: '' } });
  let browser;
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Schermcontrole', email: 'daily' + Date.now() + '@v.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
    assert.ok(reg.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', timezoneId: 'Europe/Amsterdam' });
    await context.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    const page = await context.newPage(), errors = [];
    letOpFouten(page, errors);
    await page.clock.setFixedTime(new Date('2026-09-18T22:30:00Z'));
    async function open(app, state = 'empty') {
      assert.ok(Object.hasOwn(routes, app), 'alleen een expliciet gemeten Daily-route');
      await page.goto(srv.base + routes[app], { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body[data-daily-state="' + state + '"]');
      await page.waitForSelector('.ds-edge__balk');
      await page.waitForSelector('[data-ds-edge="menu"]');
      await page.evaluate(() => document.fonts.ready);
    }
    async function screenshot(name) {
      if (!process.env.RTG_DAILY_SCREENSHOTS) return;
      fs.mkdirSync(process.env.RTG_DAILY_SCREENSHOTS, { recursive: true });
      await page.mouse.move(0, 0);
      await page.evaluate(() => scrollTo({top:0,left:0,behavior:'instant'}));
      await page.screenshot({ path: path.join(process.env.RTG_DAILY_SCREENSHOTS, name + '.png'), fullPage: true });
    }
    for (const app of ['pulse', 'agenda', 'bestanden', 'notities']) {
      await open(app);
      await page.waitForFunction(() => [...document.querySelectorAll('.daily-photo')].every(i => i.complete && i.naturalWidth));
      assert.equal(await page.locator('#dailyIntro h1').count(), 1);
      assert.equal(await page.locator('.ds-edge__balk:visible').count(), 1);
      assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 0);
      const fonts=await page.evaluate(async()=>{const s=getComputedStyle(document.documentElement),out=[];for(const token of ['--ds-letter-display','--ds-letter-tekst']){const faces=await document.fonts.load('400 16px '+s.getPropertyValue(token).trim().split(',')[0],'RTG dagelijkse kamer');out.push(faces.map(f=>f.status));}return out;});assert.ok(fonts.every(f=>f.length&&f.every(s=>s==='loaded')),app+': echte fontfaces');
      assert.equal(await page.locator('.rtg-reality-graph,.rtg-deep-nav,.kantoor-intro').count(), 0);
      // Op mobiel heeft de gedeelde wrapper display:contents: de echte main
      // bezit de contentgeometrie, zonder een tweede schil om de pagina.
      const intro = await page.locator('#dailyIntro').boundingBox(), surface = await page.locator('main:has(> #dailyIntro)').boundingBox();
      assert.ok(intro.y >= surface.y && intro.y < surface.y + 100, app + ': introduction begins inside the common content surface');
      for (const width of [390, 820, 1440]) for(const zoom of [100,200]) {
        await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
          elements:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&getComputedStyle(e).visibility!=='hidden'&&(r.right>innerWidth+1||r.left< -1);}).slice(0,15).map(e=>({tag:e.tagName,id:e.id,class:e.className,width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
        assert.ok(overflow.scroll <= width + 1, app + ': no overflow at ' + width+'/'+zoom+' '+JSON.stringify(overflow));
        const small=await page.locator('.ds-dag-main,header[data-rtg-menu-host]').evaluateAll(roots=>roots.flatMap(root=>[...root.querySelectorAll('button,a[href],input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')]).filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({id:e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(e=>e.w<43.9||e.h<43.9));assert.deepEqual(small,[],app+':44px '+width+'/'+zoom);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(()=>document.documentElement.style.fontSize='100%');
      await screenshot(app + '-empty');
      await language(page, 'en', 'English');
      await page.waitForFunction(() => /small moment|Make room|A place|Give your thoughts/.test(document.querySelector('#dailyIntro h1').textContent));
      await language(page, 'nl', 'Nederlands');
      await page.evaluate(() => document.documentElement.dir = 'rtl');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), app + ': RTL');
      await page.evaluate(() => document.documentElement.dir = 'ltr');
    }
    await page.locator('#dailyIntro [data-daily-target="nieuwNotitie"]').click();
    assert.equal(await page.locator('#ntScrim').evaluate(e=>e.matches(':modal')),true);
    await nativeModalTab(page,page.locator('#ntScrim'));
    await page.locator('#ntTitel').fill('Voor het weekend');
    await page.locator('#ntTekst').fill('Maak ruimte voor een lange wandeling.');
    await page.evaluate(() => window.RTGi18n.set('en')); // shared language event, also used by the embedding shell
    assert.equal(await page.locator('#ntTitel').inputValue(), 'Voor het weekend');
    assert.equal(await page.locator('#ntTitel').getAttribute('placeholder'), 'Title');
    assert.equal(await page.locator('#ntBewaar').textContent(), 'Save');
    await page.evaluate(() => window.RTGi18n.set('nl'));
    await page.route('**/api/notities/bewaar', r=>r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Controleer de notitie.'})}));
    const geweigerd=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notities/bewaar'&&r.status()===400);await page.locator('#ntBewaar').click();await geweigerd;
    await page.waitForFunction(()=>document.querySelector('#ntMelding').textContent==='Controleer de notitie.');assert.equal(await page.locator('#ntMelding').isVisible(),true);assert.equal(await page.locator('#ntTitel').inputValue(),'Voor het weekend');assert.equal(await page.locator('#ntScrim').evaluate(e=>e.matches(':modal')),true);await page.unroute('**/api/notities/bewaar');
    await page.route('**/api/notities/bewaar', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Tijdelijk niet beschikbaar."}' }));
    await page.locator('#ntBewaar').click();
    await page.waitForFunction(() => document.querySelector('#ntMelding').textContent.includes('Tijdelijk'));
    assert.ok(await page.locator('#ntScrim').isVisible());
    assert.equal(await page.locator('#ntMelding').isVisible(),true);
    assert.equal(await page.locator('#ntTitel').inputValue(),'Voor het weekend');
    assert.equal((await post(srv.base, '/api/notities/mijn', {}, reg.token)).eigen.length, 0);
    await page.unroute('**/api/notities/bewaar');
    await page.locator('#ntVast').click();
    await page.waitForSelector('#bord .nkaart.vast');
    assert.equal((await post(srv.base, '/api/notities/mijn', {}, reg.token)).eigen.length, 1);
    await language(page, 'en', 'English');
    assert.equal(await page.locator('#zoek').getAttribute('placeholder'), 'Search your notes');
    assert.match(await page.locator('.daily-foot').textContent(), /New note/);
    await language(page, 'nl', 'Nederlands');
    await page.locator('#bord .nkaart.vast').click();
    await page.waitForSelector('#ntScrim.open');
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.equal(await page.locator('#ntVast').textContent(), 'Unpin', 'a language switch keeps the pin state');
    await page.evaluate(() => window.RTGi18n.set('nl'));
    assert.equal(await page.locator('#ntVast').textContent(), 'Losmaken');
    await page.locator('#ntDicht').click();
    await screenshot('notities-filled');
    await page.locator('#zoek').fill('niets-met-deze-naam');
    assert.match(await page.locator('#bord').textContent(), /geen resultaten/);
    assert.equal(await page.locator('body').getAttribute('data-daily-state'), 'ready');

    await page.locator('#zoek').fill('');
    await page.locator('#nieuwLijst').click();
    await page.locator('#ntTitel').fill('Gevulde DS-checklist');
    await page.locator('#ntNieuwTaak').fill('Controleer de werkelijke bediening');await page.locator('#ntNieuwTaak').press('Enter');
    const editor=await page.locator('#ntTaken input').evaluateAll(ns=>ns.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
    assert.ok(editor.length===2&&editor.every(r=>r.w>=44&&r.h>=44),JSON.stringify(editor));
    await page.locator('#ntBewaar').click();await page.waitForSelector('#ntScrim:not([open])',{state:'attached'});
    await page.waitForFunction(()=>document.querySelector('#bord').textContent.includes('Gevulde DS-checklist'));
    const checks=await page.locator('#bord .ds-dag-taak input').evaluateAll(ns=>ns.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
    assert.ok(checks.length>0&&checks.every(r=>r.w>=44&&r.h>=44),JSON.stringify(checks));
    await page.locator('#nieuwLijst').click();await page.locator('#ntTitel').fill('Niet opgeslagen concept');await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ntScrim').isVisible(),false);assert.equal(await page.locator('#nieuwLijst').evaluate(e=>document.activeElement===e),true);
    await open('bestanden');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#dailyIntro [data-daily-target="kies"]').click();
    await (await chooser).setFiles({ name: 'Reisplanning.txt', mimeType: 'text/plain', buffer: Buffer.from('Onze reisplanning.') });
    await page.waitForSelector('#lijst .item');
    page.once('dialog', d => d.accept('Reizen'));
    await page.locator('[data-ds-edge="acties"]').click();
    await page.locator('#dsEdgeBlad').getByRole('button',{name:'+ Map',exact:true}).click();
    await page.waitForSelector('#mappen .mapkaart');
    const files = await post(srv.base, '/api/bestanden/mijn', {}, reg.token);
    assert.equal(files.items.length, 1); assert.equal(files.mappen.length, 1);
    await page.locator('#lijst .item').click();
    await page.waitForSelector('#bkScrim.open');
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.equal(await page.locator('#bkNaam').getAttribute('aria-label'), 'File name');
    assert.equal(await page.locator('#bkDeel').textContent(), 'Share');
    assert.equal(await page.locator('#bkNaam').inputValue(), 'Reisplanning.txt');
    await page.evaluate(() => window.RTGi18n.set('nl'));
    await page.locator('#bkDicht').click();
    const padknoppen=await page.locator('#pad button').evaluateAll(ns=>ns.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
    assert.ok(padknoppen.length>0&&padknoppen.every(r=>r.w>=44&&r.h>=44), 'gevulde mappennavigatie: '+JSON.stringify(padknoppen));
    await screenshot('bestanden-filled');
    await page.locator('#mappen .mapkaart').click();
    assert.match(await page.locator('#lijst').textContent(), /geen bestanden in deze map/);
    assert.equal(await page.locator('body').getAttribute('data-daily-state'), 'ready');
    await page.locator('#zoek').fill('niets-met-deze-naam');
    assert.match(await page.locator('#lijst').textContent(), /geen resultaten/);

    await open('agenda');
    await page.locator('#dailyIntro [data-daily-target="nieuwBtn"]').click();
    await page.locator('#afTitel').fill('Samen aan tafel');
    const today = '2026-09-19'; // Amsterdam is already on the next civil day.
    assert.equal(await page.locator('#afDatum').inputValue(), today);
    await page.locator('#afDatum').fill(today);
    await page.locator('#afTijd').fill('19:30');
    await page.locator('#afPlek').fill('Aan het water');
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.equal(await page.locator('#afKop').textContent(), 'New appointment');
    assert.equal(await page.locator('#afHerhaal option[value="week"]').textContent(), 'Every week');
    assert.equal(await page.locator('#afTitel').inputValue(), 'Samen aan tafel');
    assert.equal(await page.locator('#afDatum').inputValue(), today);
    await page.evaluate(() => window.RTGi18n.set('nl'));
    await page.locator('#afBewaar').click();
    await page.waitForSelector('#kal .litem');
    assert.match(await page.locator('#kal').textContent(), /Samen aan tafel/);
    await page.locator('#wWeek').click();await page.waitForSelector('#kal .ds-dag-chip');
    for(const width of [390,820,1440])for(const zoom of [100,200]){
      await page.setViewportSize({width,height:1000});await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',zoom);
      const week=await page.locator('#kal .ds-dag-week-toevoegen').evaluateAll(ns=>ns.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.equal(week.length,7);assert.ok(week.every(r=>r.w>=44&&r.h>=44),JSON.stringify({width,zoom,week}));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'week blijft binnen document '+width+'/'+zoom);
      for(let i=0;i<7;i++){const b=page.locator('#kal .ds-dag-week-toevoegen').nth(i);await b.scrollIntoViewIfNeeded();assert.equal(await b.evaluate(e=>{const r=e.getBoundingClientRect(),k=document.querySelector('#kal').getBoundingClientRect();return r.left>=k.left&&r.right<=k.right&&r.width>=44;}),true,'dag '+i+' is bereikbaar zonder clipping');}
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await page.locator('#wLijst').click();
    await screenshot('agenda-filled');
    const before = await page.locator('[data-daily-date][aria-pressed="true"]').getAttribute('data-daily-date');
    await page.locator('[data-daily-date][aria-pressed="false"]').first().click();
    await page.waitForFunction(() => document.querySelector('#kal').textContent.includes('op deze dag geen afspraken'));
    assert.equal(await page.locator('body').getAttribute('data-daily-state'), 'ready', 'an empty day is not an empty week');
    await language(page, 'en', 'English');
    assert.notEqual(await page.locator('[data-daily-date][aria-pressed="true"]').getAttribute('data-daily-date'), before);
    await language(page, 'nl', 'Nederlands');

    await open('pulse');
    await page.locator('[data-daily-target="dailyCompose"]').click();
    await page.locator('#nw').fill('Een kleine wandeling maakt ruimte voor een goed gesprek.');
    await language(page, 'en', 'English');
    assert.equal(await page.locator('#nw').inputValue(), 'Een kleine wandeling maakt ruimte voor een goed gesprek.');
    assert.equal(await page.locator('#plaats').textContent(), 'Post');
    await page.locator('#plaats').click();
    await page.waitForSelector('article.post');
    page.once('dialog', d => d.accept('Bewaard'));
    await page.locator('[data-bewaar]').click();
    await page.waitForSelector('[data-saved="true"]');
    await page.waitForFunction(() => document.querySelector('[data-saved="true"]').textContent === 'Saved');
    await language(page, 'nl', 'Nederlands');
    assert.equal((await post(srv.base, '/api/member/pulse/feed', {}, reg.token)).feed.length, 1);
    // De bestaande Uitvoer-owner verhuist dezelfde knop naar het zichtbare
    // werkvlak. Geen afhankelijkheid van de voormalige lege knophost.
    try { await page.locator('.ds-uitvoer-knop').waitFor({state:'visible'}); }
    catch(error) { error.message+='\nUitvoercontext: '+JSON.stringify(await page.evaluate(()=>({owner:!!window.RTGUitvoer,beschikbaar:window.RTGUitvoer?.beschikbaar(),ds:document.documentElement.hasAttribute('data-ds'),knoppen:[...document.querySelectorAll('.rtguitvoer-knop')].map(e=>({class:e.className,host:e.parentElement?.className,visible:!!e.getClientRects().length})),feedPosts:document.querySelectorAll('article.post').length})));throw error; }
    assert.equal(await page.locator('.ds-uitvoer-knop').count(), 1);
    try { await page.locator('.ds-uitvoer-knop').click(); }
    catch (error) {
      const geometrie = await page.evaluate(() => {
        const meet = element => element ? { rechthoek: element.getBoundingClientRect().toJSON(), stijl: {
          position: getComputedStyle(element).position, bottom: getComputedStyle(element).bottom,
          zIndex: getComputedStyle(element).zIndex, display: getComputedStyle(element).display
        } } : null;
        return { knop: meet(document.querySelector('.ds-uitvoer-knop')),
          host: meet(document.querySelector('.ds-uitvoer-host')), edge: meet(document.querySelector('.ds-edge')) };
      });
      console.error('Uitvoergeometrie:', JSON.stringify(geometrie));
      throw error;
    }
    await page.locator('.rtguitvoer-laag:not([hidden])').waitFor();
    await page.locator('.rtguitvoer-sluit').click();
    await screenshot('pulse-filled');

    for (const [app, route] of [['pulse','member/pulse/feed'], ['agenda','agenda/bereik'], ['bestanden','bestanden/mijn'], ['notities','notities/mijn']]) {
      await page.route('**/api/' + route, r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Tijdelijk niet beschikbaar."}' }));
      await open(app, 'error');
      assert.equal(await page.locator('.daily-photo').count(), 0, 'outage is not a first visit');
      await page.unroute('**/api/' + route);
      await page.locator('[data-daily-target="retry"]').click();
      await page.waitForSelector('body[data-daily-state="ready"]');
    }
    assert.deepEqual(errors, [], 'no browser errors');
    await context.close();
  } finally { if (browser) await browser.close(); await stop(srv); }
});
