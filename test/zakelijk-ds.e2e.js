/* Zakelijk vervoer op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom D).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat;
     2. de kernhandeling slaagt tegen de echte zaakkern: de manager zet een
        drempel in het reisbeleid (Taak), de spiegel zegt in dezelfde beweging
        dat een drempel geen verbod is, en de server heeft het beleid;
     3. een rit van een medewerker wacht in "Op akkoord" (Collectie) en gaat
        pas door na het akkoord van de manager: niets gaat vanzelf;
     4. zonder zaakinlog blijft het beeld dicht;
     5. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   De bredere mobiliteitsketen staat in test/mobiliteitscherm.e2e.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, baas;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', token = baas) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_pda_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/zakelijk.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !document.querySelector('#vBeeld').hidden || !document.querySelector('#vPoort').hidden);
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'HOSHI' });
  const m = (roster.staff || []).find(x => x.role === 'manager');
  baas = (await post('/api/supplier/login', { code: 'HOSHI', staffId: m.id, pin: '1234' })).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('#tabs [data-tab="beleid"]').click();
  assert.match(await edgeActies(page), /Beleid bewaren/, 'Acties toont de handelingen van de open tab');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('het reisbeleid bewaren en een rit akkoord geven lopen over de echte zaakkern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.match(await page.textContent('#zaakNaam'), /Aguamarina/, 'de werkgever ziet zijn eigen naam, geen code');
  await page.locator('#tabs [data-tab="beleid"]').click();
  await page.waitForFunction(() => !document.querySelector('#tBeleid').hidden);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'taak');
  await page.fill('#bDrempel', '5');
  await page.locator('#bBewaar').click();
  await page.waitForFunction(() => /wordt niet geweigerd/.test(document.querySelector('#beleidSpiegel').textContent));
  await page.waitForFunction(() => /Laatst gewijzigd/.test(document.querySelector('#bStand').textContent));
  const dag = page.locator('#bDagen .ds-chip').first();
  const voor = await dag.getAttribute('aria-pressed');
  await dag.click();
  assert.notEqual(await page.locator('#bDagen .ds-chip').first().getAttribute('aria-pressed'), voor, 'een gekozen dag is te zien');
  await beeld(page, 'zakelijk-390-beleid');
  const beleid = await post('/api/supplier/mob/beleid', {}, baas);
  assert.equal(beleid.beleid.goedkeuringVanaf, 500, 'de server heeft de drempel in centen');

  // een medewerker van de zaak vraagt een rit op rekening van het hotel
  const u = Date.now().toString().slice(-8);
  const mail = 'zds' + u + '@x.nl';
  const reg = await post('/api/auth/register', { name: 'Medewerker', email: mail, phone: '06' + u, password: 'geheim123',
    geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const inv = await post('/api/supplier/staff/invite', { name: 'Nora Vermeer', role: 'staff' }, baas);
  await post('/api/supplier/staff/join', { bedrijf: 'Aguamarina Ibiza', kassacode: inv.invite.kassacode, login: mail, password: 'geheim123' });
  const rit = await post('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432, label: 'Hotel' }, naar: { lat: 38.978, lng: 1.536, label: 'Luchthaven' },
    stad: 'Ibiza', namensOrganisatie: 'HOSHI', betaler: 'organisatie' }, reg.token);
  assert.equal(rit.opdracht.goedkeuring.status, 'wacht', 'de rit wacht op akkoord');

  await page.locator('#tabs [data-tab="akkoord"]').click();
  await page.waitForFunction(() => /Nora Vermeer/.test(document.querySelector('#lijstWacht').textContent));
  assert.match(await page.textContent('#lijstWacht'), /Luchthaven/);
  await beeld(page, 'zakelijk-390');
  await page.locator('#lijstWacht .ds-lijst__rij').first().getByRole('button', { name: 'Akkoord' }).click();
  await page.waitForFunction(() => /wacht niets/.test(document.querySelector('#lijstWacht').textContent));
  const mijn = await post('/api/mob/mijn', {}, reg.token);
  assert.equal(mijn.lopend.goedkeuring.status, 'akkoord', 'de rit is pas na het akkoord goedgekeurd');

  await page.locator('#tabs [data-tab="overzicht"]').click();
  await page.waitForFunction(() => /ritten/.test(document.querySelector('#oTotaal').textContent));
  await beeld(page, 'zakelijk-390-overzicht');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder zaakinlog blijft het beeld dicht', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', null);
  assert.equal(await page.locator('#vPoort').isVisible(), true);
  assert.equal(await page.locator('#vBeeld').isHidden(), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    for (const tab of ['akkoord', 'beleid', 'overzicht']) {
      await page.locator('#tabs [data-tab="' + tab + '"]').click();
      await geenOverloop(page);
    }
    await beeld(page, 'zakelijk-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
