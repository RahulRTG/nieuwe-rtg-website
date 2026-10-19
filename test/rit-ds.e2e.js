/* RTG Aankomst & Chauffeur op het RTG Design System: het bewijs van batch 4
   uit TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat met Rahul in het midden;
     2. de kernhandeling slaagt tegen de echte mobiliteitskern: een rit
        aanvragen met twee plekken uit de plekkenlaag. Daarna staat de rit op
        "Aangevraagd" en zegt het scherm dat de chauffeur nog gezocht wordt;
        er wordt geen chauffeur en geen voertuig verzonnen;
     3. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
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
async function open(breedte, hoogte, taal = 'nl', adres = '/apps/rit.html') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + adres, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#transferForm, #inhoud .ds-status__titel, [data-chauffeurkaart]');
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'rit-' + naam + '.png'), });
}
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) { const u = new URL(h); if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f'))); else uit.push(u.pathname); }
  return uit;
}
/* Een plek kiezen zoals een lid het doet: typen, en een voorstel aantikken. */
async function kiesPlek(page, veld, lijst, naam) {
  await page.fill(veld, naam.slice(0, 6));
  const keuze = page.locator(lijst + ' [data-plek]', { hasText: naam }).first();
  await keuze.waitFor();
  await keuze.click();
  assert.equal(await page.inputValue(veld), naam);
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Rit Lid', email: 'rit-' + now + '@e.test',
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
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Vraag uw rit aan/, 'Acties toont de hoofdhandeling');
  await page.keyboard.press('Escape');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een rit aanvragen loopt over de echte mobiliteitskern en blijft "Aangevraagd"', { skip }, async () => {
  const plekken = (await post('/api/mob/plekken', { limiet: 40 })).plekken || [];
  const namen = [...new Set(plekken.map(p => p.naam).filter(n => n && n.length >= 6))];
  assert.ok(namen.length >= 2, 'de plekkenlaag heeft minstens twee plekken');
  const { ctx, page, fouten } = await open(390, 844);
  await beeld(page, '390');
  await kiesPlek(page, '#vanVeld', '#vanLijst', namen[0]);
  await kiesPlek(page, '#naarVeld', '#naarLijst', namen[1]);
  await page.locator('#transferForm [type=submit]').click();
  await page.waitForSelector('[data-chauffeurkaart]');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.equal(await page.locator('[data-chauffeurnaam]').innerText(), 'Nog niet toegewezen', 'geen verzonnen chauffeur');
  assert.match(await page.locator('#inhoud').innerText(), /Uw chauffeur wordt gezocht\./);
  assert.match(await page.locator('#inhoud .ds-detail__status').first().innerText(), /Aangevraagd/);
  assert.doesNotMatch(await page.locator('#inhoud').innerText(), /geboekt/i, 'een aanvraag is geen boeking');
  await page.locator('[data-chauffeurkaart]').evaluate(e => e.scrollIntoView());
  await beeld(page, '390-detail');
  const mijn = await post('/api/mob/mijn', {});
  const ritten = (mijn.ritten || []).concat(mijn.lopend ? [mijn.lopend] : []);
  assert.ok(ritten.some(r => r.status === 'aangevraagd'), 'de server heeft de aanvraag');
  await page.locator('.ds-tab[data-t="aankomst"]').click();
  await page.waitForSelector('[data-aankomstkaart]');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'status');
  assert.match(await page.locator('#inhoud').innerText(), /Na check-in|Via uw verblijf/, 'de sleutel wordt niet beloofd');
  await beeld(page, '390-status');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    for (const tab of ['aanvragen', 'chauffeur', 'aankomst']) {
      await page.locator('.ds-tab[data-t="' + tab + '"]').click();
      const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
      assert.ok(maat.breed <= maat.venster, tab + ': scrollWidth ' + maat.breed + ' > ' + maat.venster);
    }
    await beeld(page, naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
