/* Living World op het RTG Design System: het bewijs uit TRAVELOS-MIGRATIE.md
   par. 3, in een echte browser tegen een echte server (stroom D).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat, en toont onder Acties de
        ene hoofdactie van wat er open staat;
     2. de kernhandeling slaagt tegen de echte ervaringslaag: een plek
        toevoegen (Taak) gaat eerst langs een voorvertoning die niets
        opslaat, en pas na de bevestiging staat de plek er (Detail);
     3. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   De hele keten (blueprint, plan, besluit, bijdrage) staat in
   test/living-world.e2e.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', adres = '/apps/living-world.html') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce', timezoneId: 'UTC' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + adres, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => /Bijgewerkt/.test(document.querySelector('#lwStatus').textContent));
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_BETALEN_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const n = String(Date.now());
  token = (await post('/api/auth/register', { name: 'Wereld Maker', email: 'lw-ds-' + n + '@e.test', phone: '06' + n.slice(-8),
    password: 'VeiligWachtwoord123!', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.equal(await page.locator('#lwHero').isVisible(), true, 'Wereld opent met het beeld');
  await beeld(page, 'living-world-390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een plek toevoegen gaat langs een voorvertoning en staat pas na de bevestiging', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', '/apps/living-world.html?tab=studio');
  await page.waitForSelector('#lwContent [data-lw-primary]');
  assert.equal(await page.locator('#lwHero').isHidden(), true, 'de Werkplaats draagt geen beeldkop');
  assert.match(await edgeActies(page), /Plek toevoegen/, 'de Edge toont de hoofdactie van de Werkplaats');
  await page.locator('#lwContent [data-lw-primary]').click();
  assert.equal(await page.locator('#lwDialog').evaluate(d => d.open), true);
  await page.fill('#lwField-title', 'Duinpad');
  await page.fill('#lwField-area', 'Schoorl');
  await page.fill('#lwField-description', 'Een rustige plek om samen de duinen te ontdekken.');
  await page.locator('#lwSubmit').click();
  await page.waitForSelector('#lwPreview:not([hidden])');
  assert.equal(await page.locator('#lwSubmit').textContent(), 'Bevestigen');
  await beeld(page, 'living-world-390-taak');
  assert.equal((await post('/api/living-world/view', {}, token)).places.filter(p => p.title === 'Duinpad').length, 0,
    'een voorvertoning slaat niets op');
  await page.locator('#lwSubmit').click();
  await page.waitForSelector('#lwDialog', { state: 'hidden' });
  await page.waitForSelector('[data-lw-detail]');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.match(await page.locator('[data-lw-detail]').textContent(), /Duinpad/);
  assert.equal(await page.locator('#lwMain [data-ds-actie]').count(), 1, 'precies een hoofdactie in de Edge');
  await beeld(page, 'living-world-390-detail');
  assert.equal((await post('/api/living-world/view', {}, token)).places.filter(p => p.title === 'Duinpad').length, 1);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'living-world-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
