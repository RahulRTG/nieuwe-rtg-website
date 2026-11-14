/* Componentproef met echte controller/CSS/native browserdialoog. De bestaande
   instellingseigenaren zijn expliciete fixtures: geen bewijs van hun domeinen. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), pub = path.join(__dirname, '../public');
const fixture = `<button id="ingang" onclick="RTGBediening.open()">Instellingen openen</button>
  <input aria-label="Achtergrondconcept" value="Mijn concept"><button id="na">Andere actie</button>
  <script>
    window.calls=[]; var thema='licht', beweging=0;
    window.RTGi18n={lang:'nl',t:function(k,v){return v;},openModal:function(){calls.push('taal');}};
    window.RTGRosThema={themas:[{id:'licht',naam:'Licht',stip:'white'},{id:'donker',naam:'Donker',stip:'black'}],huidig:function(){return thema;},zet:function(t){thema=t;calls.push('thema:'+t);}};
    window.RTGBeweging={standen:[{n:'Stil',w:0},{n:'Rustig',w:25},{n:'Levendig',w:80}],waarde:function(){return beweging;},zet:function(w){beweging=w;calls.push('beweging:'+w);}};
    window.RTGscherm={draai:function(){calls.push('draaien');},volledig:function(){calls.push('volledig');},volledigAan:function(){return false;}};
    window.RTGVol={mogelijk:function(){return true;},aan:function(){return false;},wissel:function(){calls.push('randen');}};
    window.RTGGids={open:function(){calls.push('uitleg');}};
  </script><script src="/shared/bediening.js"></script>`;
let server, browser, base;
test.before(async () => {
  if (geenBrowser(pw)) return;
  server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (p === '/ds' || p === '/oud') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="nl"' + (p === '/ds' ? ' data-ds="1"' : '') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
        (p === '/ds' ? '<link rel="stylesheet" href="/ds/rtg-ds.css"><link rel="stylesheet" href="/fonts/fonts.css">' : '') + '</head><body>' + fixture + '</body></html>'); return;
    }
    if (!/^\/(ds|fonts)\/[\w/.-]+$/.test(p) && p !== '/shared/bediening.js') { res.writeHead(404).end(); return; }
    const file = path.join(pub, p);
    if (!file.startsWith(pub + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'text/javascript' : 'font/woff2');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); });
test('instellingen: native modaliteit, 44px, tekstvergroting en behoud van alle eigenaren', { skip: geenBrowser(pw) }, async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  try {
    const page = await ctx.newPage(), fouten = letOpFouten(page, []);
    await page.goto(base + '/ds'); await page.waitForFunction(() => !!window.RTGBediening);
    const ingang = page.locator('#ingang'), dialog = page.getByRole('dialog', { name: 'Instellingen', exact: true });
    for (const width of [390, 820, 1440]) for (const zoom of [100, 200]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(p => { document.documentElement.style.fontSize = p + '%'; }, zoom);
      await ingang.click(); await dialog.waitFor();
      assert.equal(await page.locator('#bdnCss').count(), 0, 'geen legacy-injectie op DS');
      assert.equal(await dialog.evaluate(el => el.matches(':modal')), true, 'browser sluit de achtergrond af');
      const maten = await dialog.locator('.bdn-blad').evaluate(el => ({ w: el.clientWidth, scroll: el.scrollWidth,
        stijl: { box: getComputedStyle(el).boxSizing, max: getComputedStyle(el).maxHeight, display: getComputedStyle(el).display, html: el.outerHTML.slice(0, 200), root: el.parentElement.getBoundingClientRect().toJSON() },
        r: el.getBoundingClientRect().toJSON(), knoppen: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()) }));
      assert.ok(maten.scroll <= maten.w + 1, 'inhoud past op ' + width + '/' + zoom);
      assert.ok(maten.r.top >= 0 && maten.r.bottom <= 845 && maten.r.left >= 0 && maten.r.right <= width + 1,
        width + '/' + zoom + ': ' + JSON.stringify(maten));
      assert.ok(maten.knoppen.every(b => b.width >= 44 && b.height >= 44), 'alle interactieve doelen minstens 44px');
      // Een programmatische focusaanvraag van de achtergrond mag de native modaliteit niet omzeilen.
      await page.evaluate(() => document.getElementById('na').focus());
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.equal(await ingang.evaluate(el => document.activeElement === el), true);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.evaluate(() => { RTGRosThema.zet('donker'); RTGBeweging.zet(80); });
    await ingang.click();
    assert.equal(await dialog.getByRole('button', { name: 'Weergave: Donker', exact: true }).getAttribute('aria-pressed'), 'true', 'heropening leest externe themakeuze opnieuw');
    assert.equal(await dialog.getByRole('button', { name: 'Levendig', exact: true }).getAttribute('aria-pressed'), 'true', 'heropening leest externe bewegingskeuze opnieuw');
    await dialog.getByRole('button', { name: 'Weergave: Donker', exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: 'Weergave: Donker', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await dialog.getByRole('button', { name: 'Weergave: Licht', exact: true }).getAttribute('aria-pressed'), 'false');
    await dialog.getByRole('button', { name: 'Rustig', exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: 'Rustig', exact: true }).evaluate(el => el === document.activeElement), true, 'vervangen bewegingskeuze behoudt focus');
    assert.equal(await dialog.getByRole('button', { name: 'Rustig', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await dialog.getByRole('button', { name: 'NL', exact: true }).getAttribute('translate'), 'no', 'taalcode blijft een identificatie');
    for (const name of ['Draaien', 'Volledig', 'Rand tot rand', 'NL']) await dialog.getByRole('button', { name, exact: true }).click();
    await dialog.waitFor({ state: 'hidden' }); await ingang.click();
    await dialog.getByRole('button', { name: 'Openen', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => calls), ['thema:donker', 'beweging:80', 'thema:donker', 'beweging:25', 'draaien', 'volledig', 'randen', 'taal', 'uitleg']);
    assert.equal(await page.getByLabel('Achtergrondconcept').inputValue(), 'Mijn concept');
    // Een vervangen documentbody mag geen losgeraakt oud paneel heropenen.
    await page.evaluate(() => document.querySelector('.ds-instellingen').remove());
    await ingang.click(); await dialog.waitFor(); assert.equal(await dialog.count(), 1);
    await page.mouse.click(2, 2); await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
test('instellingen: een legacy-host gebruikt dezelfde native DS-presentatie en open/sluit-API', { skip: geenBrowser(pw) }, async () => {
  const page = await browser.newPage();
  try {
    await page.goto(base + '/oud'); await page.waitForFunction(() => !!window.RTGBediening);
    await page.locator('#ingang').click(); const dialog = page.getByRole('dialog', { name: 'Instellingen', exact: true }); await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.tagName === 'DIALOG' && el.matches(':modal') && el.classList.contains('ds-instellingen')), true);
    assert.equal(await page.locator('#rtgDsRuntimeCss').getAttribute('href'), '/ds/rtg-ds.css');
    assert.equal(await page.locator('#bdnCss').count(), 0);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.bdn-scrim')).position === 'fixed');
    assert.equal(await page.locator('.bdn-scrim').evaluate(el => getComputedStyle(el).position), 'fixed');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await page.locator('#ingang').click(); await page.getByRole('button', { name: 'Sluiten', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  } finally { await page.close(); }
});

/* Bewuste hostwissel uitsluitend in de fixture. De werkelijk geleverde owner
   blijft dezelfde; geen evaluatie of wijziging van productscript om DS af te
   dwingen. Laden én effectieve tokens worden afgewacht, zonder vaste slaap. */
async function activeerDs(page) {
  await page.evaluate(async () => {
    document.documentElement.setAttribute('data-ds', '1');
    await Promise.all(['/ds/rtg-ds.css', '/fonts/fonts.css'].filter(href => !document.querySelector('link[href="' + href + '"]')).map(href => new Promise((resolve, reject) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
      link.onload = resolve; link.onerror = () => reject(new Error('Stijl niet geladen: ' + href));
      document.head.appendChild(link);
    })));
    await document.fonts.ready;
  });
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ds-doel').trim() !== '');
}

test('instellingen: late DS-activering vóór eerste opening gebruikt direct de native dialoog', { skip: geenBrowser(pw) }, async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage(), fouten = letOpFouten(page, []);
    await page.goto(base + '/oud'); await page.waitForFunction(() => !!window.RTGBediening);
    const concept = page.getByLabel('Achtergrondconcept'), ingang = page.locator('#ingang');
    await concept.fill('Concept vóór late DS-activering');
    assert.equal(await page.locator('.bdn-scrim,#rtgDsRuntimeCss').count(), 0, 'er is nog geen paneel of runtimeblad');
    await activeerDs(page);
    await ingang.click();
    const dialog = page.getByRole('dialog', { name: 'Instellingen', exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.tagName === 'DIALOG' && el.matches(':modal') && el.classList.contains('ds-instellingen')), true);
    assert.equal(await page.locator('.bdn-scrim').count(), 1);
    assert.equal(await page.locator('#bdnCss').count(), 0);
    await page.evaluate(() => document.getElementById('na').focus());
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'achtergrond is native inert');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await ingang.evaluate(el => document.activeElement === el), true);
    assert.equal(await concept.inputValue(), 'Concept vóór late DS-activering');
    assert.deepEqual(await page.evaluate(() => calls), [], 'presentatiewissel voert geen instellingenhandeling uit');
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});

test('instellingen: late DS-markering bewaart de canonieke dialoog, focus en concept', { skip: geenBrowser(pw) }, async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 820, height: 1000 } });
  try {
    const page = await ctx.newPage(), fouten = letOpFouten(page, []);
    await page.goto(base + '/oud'); await page.waitForFunction(() => !!window.RTGBediening);
    const concept = page.getByLabel('Achtergrondconcept'), ingang = page.locator('#ingang');
    await concept.fill('Onopgeslagen achtergrondconcept');
    await ingang.click(); await page.locator('.bdn-scrim.open').waitFor();
    const oud = await page.locator('.bdn-scrim').elementHandle();
    assert.equal(await oud.evaluate(el => el.tagName === 'DIALOG' && el.matches(':modal')), true);
    assert.equal(await page.locator('#rtgDsRuntimeCss').count(), 1);
    const keuze = page.getByRole('button', { name: 'Weergave: Donker', exact: true });
    await keuze.click(); const focus = await keuze.elementHandle();
    await activeerDs(page);
    await page.evaluate(() => RTGBediening.open());
    assert.equal(await oud.evaluate(el => el.isConnected && el.classList.contains('open') && document.querySelector('.bdn-scrim') === el), true,
      'DS en een herhaalde open-aanroep vervangen het actieve paneel niet');
    assert.equal(await focus.evaluate(el => el.isConnected && document.activeElement === el), true, 'exact dezelfde gefocuste bediening blijft staan');
    assert.equal(await page.locator('.bdn-scrim').count(), 1);
    assert.equal(await page.locator('dialog.ds-instellingen').count(), 1);
    assert.equal(await page.locator('#rtgDsRuntimeCss').count(), 1, 'dezelfde canonieke runtimepresentatie blijft actief');
    assert.equal(await concept.inputValue(), 'Onopgeslagen achtergrondconcept');
    await page.keyboard.press('Escape'); await page.locator('.bdn-scrim').waitFor({ state: 'hidden' });
    assert.equal(await ingang.evaluate(el => document.activeElement === el), true);

    await ingang.click();
    const dialog = page.getByRole('dialog', { name: 'Instellingen', exact: true });
    await dialog.waitFor();
    assert.equal(await oud.evaluate(el => el.isConnected), false, 'een gesloten weergave wordt met actuele keuzes opnieuw opgebouwd');
    assert.equal(await dialog.evaluate(el => el.tagName === 'DIALOG' && el.matches(':modal') && el.classList.contains('ds-instellingen')), true);
    assert.equal(await page.locator('.bdn-scrim').count(), 1);
    assert.equal(await page.locator('#bdnCss').count(), 0, 'er bestaat geen oude eigen stylesheet');
    assert.equal(await dialog.getByRole('button', { name: 'Weergave: Donker', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.evaluate(() => document.getElementById('na').focus());
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'nieuwe dialoog sluit de achtergrond native af');
    await dialog.getByRole('button', { name: 'Sluiten', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await ingang.evaluate(el => document.activeElement === el), true);
    assert.equal(await concept.inputValue(), 'Onopgeslagen achtergrondconcept');
    assert.deepEqual(await page.evaluate(() => calls), ['thema:donker'], 'de bestaande eigenaar houdt de bewuste keuze, geen dubbele uitvoering');
    assert.deepEqual(fouten, []);
    await oud.dispose(); await focus.dispose();
  } finally { await ctx.close(); }
});
