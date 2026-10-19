/* De Mobility Control Tower op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom E, de werklaag uit par. 1b).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat; de operatienavigatie staat
        met Regie als huidige plek;
     2. de kern slaagt tegen de echte OV-kern: een voertuig dat een dienst
        rijdt staat in de live vloot, de kerncijfers komen van de server en
        de private operaties tonen alleen capaciteit (geen hoofdgast, geen
        route);
     3. zonder personeelsinlog zegt het scherm waar je wel binnenkomt;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   De demo-zaak Ibiza Transit bestaat alleen met RTG_DEMO (de toetsstand). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, baas;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, { taal = 'nl', token = baas } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_pda_token', t); else localStorage.removeItem('rtg_pda_token'); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/ovcontrol.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !document.querySelector('#inhoud').hidden || !document.querySelector('#poort').hidden);
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'TRANSIT' });
  baas = (await post('/api/supplier/login', { code: 'TRANSIT', staffId: roster.staff.find(x => x.role === 'manager').id, pin: '1234' })).token;
  // een chauffeur rijdt een dienst, zodat de vloot iets live te tonen heeft
  const ch = roster.staff.find(x => x.role !== 'manager');
  const pda = (await post('/api/supplier/login', { code: 'TRANSIT', staffId: ch.id, pin: '5678' })).token;
  await post('/api/staff/ov/dienst', { lijnId: 'L1', voertuigNaam: 'Bus 7' }, pda);
  await post('/api/staff/ov/pos', { lat: 38.908, lng: 1.432 }, pda);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  const huidig = await page.locator('[data-ds-opsnav] .ds-chip[aria-current="page"]').textContent();
  assert.equal(huidig, 'Regie');
  assert.match(await page.title(), /Mobility Control Tower/);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de live vloot, de kerncijfers en de afgeschermde operaties komen van de echte OV-kern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForFunction(() => /Bus 7/.test(document.querySelector('#vloot').textContent));
  const o = await post('/api/supplier/ov/overzicht', {}, baas);
  assert.equal(await page.textContent('#mV'), String(o.voertuigen.length), 'het aantal voertuigen komt van de server');
  assert.match(await page.textContent('#lijnen'), /Kustlijn 1/);
  assert.match(await page.textContent('#operaties'), /need-to-know/);
  assert.match(await page.textContent('#inhoud'), /Automatisering adviseert; personeel houdt de beslissing/);
  await beeld(page, 'ovcontrol-390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder personeelsinlog zegt het scherm waar je wel binnenkomt', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  assert.equal(await page.locator('#poort').isVisible(), true);
  assert.equal(await page.locator('#inhoud').isHidden(), true);
  assert.match(await page.textContent('#fout'), /personeels-app/);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, b, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(b, h, { taal });
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await page.waitForFunction(() => document.querySelectorAll('#lijnen .ds-lijst__rij').length > 0);
    await geenOverloop(page);
    await beeld(page, 'ovcontrol-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
