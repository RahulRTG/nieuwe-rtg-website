/* De routetekenaar van een OV-zaak op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom E, de werklaag uit par. 1b).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat;
     2. de kernhandeling slaagt tegen de echte OV-kern: de manager tekent een
        nieuwe lijn (een tik op het tekenvlak en een halte in het midden),
        geeft haar een naam en bewaart; de server heeft de lijn met twee
        haltes, en verwijderen haalt haar er ook weer af;
     3. zonder personeelsinlog toont de deur de weg naar de personeels-app;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, ook met de
        editor open, en in het Arabisch staat dir="rtl" zonder overloop.
   De demo-zaak Ibiza Transit bestaat alleen met RTG_DEMO (de toetsstand). */
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
async function open(breedte, hoogte, { taal = 'nl', token = baas } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_pda_token', t); else localStorage.removeItem('rtg_pda_token'); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/ovroutes.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !document.querySelector('#vBeheer').hidden || !document.querySelector('#vPoort').hidden);
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'TRANSIT' });
  const m = roster.staff.find(x => x.role === 'manager');
  baas = (await post('/api/supplier/login', { code: 'TRANSIT', staffId: m.id, pin: '1234' })).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Nieuwe lijn/);
  assert.match(await page.textContent('#kopBadge'), /\d+ lijn/, 'de kop telt de lijnen van de zaak');
  assert.ok(await page.locator('#lijnLijst .ds-keuze').count() >= 1, 'de lijnen van de zaak staan er');
  await beeld(page, 'ovroutes-390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een lijn tekenen, bewaren en verwijderen loopt over de echte OV-kern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.locator('#nieuwBtn').click();
  await page.waitForFunction(() => !document.querySelector('#editor').hidden);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'taak');
  const vlak = await page.locator('#tekenvlak').boundingBox();
  await page.mouse.click(vlak.x + vlak.width * 0.25, vlak.y + vlak.height * 0.4);
  await page.locator('#midBtn').click();
  await page.waitForFunction(() => document.querySelectorAll('#halteLijst .ds-lijst__rij').length === 2);
  assert.equal(await page.locator('#tekenvlak .ds-canvas__speld circle').count(), 2, 'de haltes staan op het tekenvlak');
  await page.fill('#halteLijst .ds-lijst__rij:nth-child(1) input', 'Strand');
  await page.fill('#halteLijst .ds-lijst__rij:nth-child(2) input', 'Markt');
  const naam = 'Proeflijn ' + String(Date.now()).slice(-4);
  await page.fill('#fNaam', naam);
  assert.match(await edgeActies(page), /Bewaar de lijn/);
  await beeld(page, 'ovroutes-390-editor');
  await page.locator('#bewaarBtn').click();
  await page.waitForFunction(n => document.querySelector('#editor').hidden && document.querySelector('#lijnLijst').textContent.includes(n), naam);
  const lijnen = await post('/api/staff/ov/lijnen', {}, baas);
  const lijn = lijnen.lijnen.find(l => l.naam === naam);
  assert.ok(lijn, 'de server heeft de lijn');
  assert.deepEqual(lijn.haltes.map(h => h.naam), ['Strand', 'Markt']);

  await page.locator('#lijnLijst .ds-keuze', { hasText: naam }).click();
  await page.waitForFunction(() => !document.querySelector('#wegBtn').hidden);
  await page.locator('#wegBtn').click();
  await page.waitForFunction(n => !document.querySelector('#lijnLijst').textContent.includes(n), naam);
  assert.ok(!(await post('/api/staff/ov/lijnen', {}, baas)).lijnen.some(l => l.naam === naam), 'de lijn is van de server');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder personeelsinlog toont de deur de weg naar de personeels-app', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  assert.equal(await page.locator('#vPoort').isVisible(), true);
  assert.equal(await page.locator('#vBeheer').isHidden(), true);
  assert.match(await page.textContent('#vPoort'), /personeels-app|log eerst in/i);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, b, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(b, h, { taal });
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await page.locator('#lijnLijst .ds-keuze').first().click();
    await page.waitForFunction(() => !document.querySelector('#editor').hidden);
    await geenOverloop(page);
    await beeld(page, 'ovroutes-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
