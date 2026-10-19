/* RTG Vervoer op het RTG Design System: het bewijs van batch 4 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat. De locatievraag (shared/plek.js)
        is er wel: zonder haar vraagt dit scherm nooit om je plek;
     2. de kernhandeling slaagt tegen de echte vervoerskern: twee echte
        plekken kiezen, de opties naast elkaar zien (tijd, prijs, uitstoot als
        schatting) en er een boeken. Daarna staat de reis in beeld en is het
        formulier weg, en de server kent de reis;
     3. het OV-tabblad zegt eerlijk waarom er niets te koop is;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const BEELDEN = process.env.RTG_DS_BEELDEN || '';
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  /* rtg_os_gps uit en al gevraagd: de locatievraag zelf bewijst
     test/gpsschakelaar.e2e.js; hier gaat het om de vorm en de reis. */
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/ov.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => document.querySelector('#velNaar').options.length > 1);
  /* De locatievraag van plek.js komt na het laden; "Nu niet" is een echte keuze. */
  await page.locator('.rtgplek .nee').click({ timeout: 4000 }).catch(() => {});
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'ov-' + naam + '.png') });
}
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) { const u = new URL(h); if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f'))); else uit.push(u.pathname); }
  return uit;
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Vervoer Lid', email: 'ov-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt toch');
  assert.ok(scripts.includes('/shared/plek.js') || scripts.includes('/scriptbundel.js'), 'de locatievraag blijft');
  assert.equal(await page.evaluate(() => typeof window.RTGPlek), 'object');
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Plan mijn reis/);
  await page.keyboard.press('Escape');
  await beeld(page, '390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een reis plannen en boeken loopt over de echte vervoerskern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const paar = await page.$$eval('#velVan option', els => els.filter(e => e.value && e.value !== 'hier').map(e => e.value).slice(0, 2));
  assert.equal(paar.length, 2, 'er staan twee echte plekken om uit te kiezen');
  await page.selectOption('#velVan', paar[0]);
  await page.selectOption('#velNaar', paar[1]);
  await page.locator('#velPlan').click();
  await page.waitForFunction(() => !document.querySelector('#optieBlok').hidden && document.querySelectorAll('#opties .ds-kaart [data-boek]').length > 0);
  const kaarten = await page.$$eval('#opties .ds-kaart', els => els.map(e => e.textContent));
  assert.ok(kaarten.some(k => /min/.test(k) && /€/.test(k) && /CO₂/.test(k) && /schatting/.test(k)), 'tijd, prijs en uitstoot als schatting: ' + kaarten[0]);
  await page.locator('#opties').evaluate(e => e.scrollIntoView());
  await beeld(page, '390-opties');
  await page.locator('#opties [data-boek]').first().click();
  await page.waitForFunction(() => !document.querySelector('#lopendKaart').hidden);
  assert.equal(await page.locator('#boekBlok').evaluate(e => e.hidden), true, 'het formulier is weg zodra er een reis loopt');
  assert.ok(await page.locator('#lopendEtappes .ds-veld').count() >= 1, 'de etappes staan in beeld');
  assert.doesNotMatch(await page.locator('#lopendKaart').innerText(), /bevestigd door de chauffeur/i);
  await page.locator('#lopendKaart').evaluate(e => e.scrollIntoView());
  await beeld(page, '390-detail');
  const reizen = await post('/api/mob/reis/mijn', {});
  assert.ok((reizen.reizen || []).length, 'de server kent de reis');
  /* Het OV-tabblad: zonder overeenkomst is er niets te koop, met de reden. */
  await page.locator('#tabOv').click();
  await page.waitForFunction(() => !/Even kijken/.test(document.querySelector('#kaartReden').textContent));
  assert.equal(await page.locator('#kaartVorm').evaluate(e => e.hidden), true, 'geen koopknop bij iets dat niet te koop is');
  assert.ok((await page.locator('#kaartReden').innerText()).trim().length > 5, 'de reden staat er');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    for (const tab of ['#tabRit', '#tabOv', '#tabPendel']) {
      await page.locator(tab).click();
      const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
      assert.ok(maat.breed <= maat.venster, tab + ': scrollWidth ' + maat.breed + ' > ' + maat.venster);
    }
    await page.locator('#tabRit').click();
    await beeld(page, naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
