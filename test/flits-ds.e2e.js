/* RTG Flits op het RTG Design System: het bewijs van batch 4 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js, met de stappen uit
   test/lib/ds-toets.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat, met de meldknoppen onder Acties;
     2. de kernhandeling slaagt tegen de echte flitskern: met een vrijgegeven
        plek meldt een lid een file, de melding staat daarna in de lijst "In
        de buurt" en de server heeft hem. De vooruitblik zegt zichtbaar dat
        hij voor Ibiza rekent;
     3. zonder lid geen rijscherm maar de poort, en geen verzonnen plek;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
/* Rond Ibiza mogen flitsers gemeld worden (ES); daar ligt ook het eigen
   demonstratienet. Een plek een eind van de seed vandaan houdt de lijst leeg
   tot deze toets er zelf iets in zet. */
const PLEK = { latitude: 38.95, longitude: 1.30 };
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', lid = token) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce',
    permissions: ['geolocation'], geolocation: PLEK });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_os_gps', '1'); if (t) localStorage.setItem('rtg_member_token', t); }, [lid, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/flits.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector(lid ? '#vRit:not([hidden]) #meldrij button' : '#vPoort:not([hidden])', { timeout: 20000 });
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Flits Lid', email: 'flits-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /File melden/, 'Acties toont de meldknoppen');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een file melden loopt over de echte flitskern en staat daarna in de buurt', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await beeld(page, 'flits-390');
  await page.locator('#meldrij [data-soort="file"]').click();
  await page.waitForFunction(() => /gemeld|bevestigd/.test(document.querySelector('#melding').textContent));
  await page.waitForSelector('#lijst [data-melding]');
  assert.match(await page.locator('#lijst').innerText(), /km/, 'met de afstand vanaf hier');
  const rond = await post('/api/flits/rond', { lat: PLEK.latitude, lng: PLEK.longitude, land: 'ES' });
  assert.ok((rond.meldingen || []).some(m => m.soort === 'file'), 'de server heeft de melding');
  /* De vooruitblik staat vast op Ibiza; het scherm zegt dat in woorden. */
  assert.match(await page.locator('#vRit').textContent(), /Vooruitblik · Ibiza/);
  assert.match(await page.locator('#vRit').textContent(), /vast voor Ibiza, niet voor waar u nu bent/);
  await page.waitForSelector('#uren:not([hidden]) rect');
  assert.match(await page.locator('#uren').getAttribute('aria-label'), /Ibiza/);
  assert.equal(await page.locator('#uren [style]').count(), 0, 'een staaf draagt geen stijlattribuut');
  await page.locator('#lijst').evaluate(e => e.scrollIntoView());
  await beeld(page, 'flits-390-lijst');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder lid de poort, en geen rijscherm op een verzonnen plek', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', null);
  assert.match(await page.locator('#poortReden').innerText(), /log eerst in/i);
  assert.equal(await page.locator('#vRit').evaluate(e => e.hidden), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'flits-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
