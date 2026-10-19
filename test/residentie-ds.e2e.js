/* De Résidence op het RTG Design System: het bewijs van stroom G uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js, met de stappen uit
   test/lib/ds-toets.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, de ds-poort klopt, de
        Edge staat, en de diensten van het huis staan onder Acties;
     2. de kernhandeling slaagt tegen de echte residentiekern: binnenlopen in
        de lobby, iets tegen de zaal zeggen (de server heeft het in zijn
        gesprek), via de gids naar een andere zaal, en de eigen suite een naam
        geven in het atelier;
     3. de lagen zijn dialogen: de gids opent, en Escape drukt zijn sluitknop;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/residentie.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !document.querySelector('#balk').hidden && document.querySelector('#kamerNaam').textContent !== '…');
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Residence Lid', email: 'res-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System, de Edge staat en de diensten staan onder Acties', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'canvas');
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  const acties = await edgeActies(page);
  for (const naam of ['De gids', 'Mijn suite', 'Samen spelen']) assert.ok(acties.includes(naam), naam + ' staat onder Acties');
  /* het canvas vult het scherm en de tegels liggen waar de tik valt */
  const maat = await page.evaluate(() => { const c = document.querySelector('#wereld'); return [c.clientWidth, c.clientHeight, innerWidth, innerHeight]; });
  assert.equal(maat[0], maat[2]); assert.equal(maat[1], maat[3]);
  await beeld(page, 'residentie-390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('binnenlopen, iets zeggen, via de gids naar de bar en de suite een naam geven', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.match(await page.locator('#kamerNaam').textContent(), /\S/);
  await page.fill('#zegIn', 'Goedenavond, zaal');
  await page.locator('#zegGo').click();
  await page.waitForFunction(() => document.querySelector('#zegIn').value === '');
  const pols = await post('/api/residentie/pols', {});
  assert.ok(pols.chat.some(r => r.tekst === 'Goedenavond, zaal'), 'de server heeft het gesprek');

  await page.locator('#knopGids').click();
  await page.waitForFunction(() => document.querySelector('#gidsLaag').open);
  assert.ok(await page.locator('#gidsZalen .ds-veld').count() > 3, 'de gids toont de zalen als rustige rijen');
  await beeld(page, 'residentie-390-gids');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#gidsLaag').evaluate(d => d.open), false, 'Escape sluit de gids');

  await page.locator('#knopGids').click();
  await page.waitForFunction(() => document.querySelector('#gidsLaag').open);
  await page.locator('#gidsZalen [data-kamer="bar"]').click();
  await page.waitForFunction(() => /aanwezig/.test(document.querySelector('#kamerSub').textContent) && document.querySelector('#gidsLaag').open === false);
  assert.equal((await post('/api/residentie/pols', {})).kamer.id, 'bar', 'de server zet het lid in de bar');

  await page.locator('#knopSuite').click();
  await page.waitForSelector('#knopAtelier:not([hidden])');
  await page.locator('#knopAtelier').click();
  await page.waitForFunction(() => document.querySelector('#atelierLaag').open);
  assert.ok(await page.locator('#catalogus .ds-keuze').count() > 0, 'het atelier toont de meubels van RTG Maison');
  await page.fill('#suiteNaam', 'Salon Bleu');
  await page.locator('#suiteNaamZet').click();
  await page.waitForFunction(() => document.querySelector('#melding').textContent === 'Naam bewaard.');
  await beeld(page, 'residentie-390-atelier');
  assert.equal((await post('/api/residentie/suite', {})).suite.naam, 'Salon Bleu');
  await page.locator('#atelierDicht').click();
  assert.match(await page.locator('#kamerNaam').textContent(), /Salon Bleu/);
  await beeld(page, 'residentie-390-suite');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'residentie-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
