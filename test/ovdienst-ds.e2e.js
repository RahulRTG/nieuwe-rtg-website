/* De OV-dienst (de PDA van chauffeur en conducteur) op het RTG Design
   System: het bewijs uit TRAVELOS-MIGRATIE.md par. 3, in een echte browser
   tegen een echte server (stroom E, de werklaag uit par. 1b).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat; de locatievraag
        (shared/plek.js) en de scanner blijven geladen;
     2. de kernhandeling slaagt tegen de echte OV-kern: een dienst starten
        (Taak) zet de PDA in de lopende dienst (Detail) en de server weet dat
        de dienst loopt; een onbekend kaartje krijgt een kort "Niet geldig"
        met de reden; stoppen zet de dienst op de server uit;
     3. het scanblad opent als ds-dialoog en laat altijd typen toe;
     4. zonder personeelsinlog toont de deur de weg naar de personeels-app;
     5. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Een GELDIG kaartje controleren staat in test/mobiliteitscherm.e2e.js. De
   demo-zaak Ibiza Transit bestaat alleen met RTG_DEMO (de toetsstand). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, pda;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, { taal = 'nl', token = pda } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_pda_token', t); else localStorage.removeItem('rtg_pda_token'); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/ovdienst.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !document.querySelector('#vDienst').hidden || !document.querySelector('#vPoort').hidden);
  /* De locatievraag van plek.js komt na het laden; "Nu niet" is een echte
     keuze. Dat hij er is, bewijst test/gpsschakelaar.e2e.js. */
  await page.locator('.rtgplek .nee').click({ timeout: 4000 }).catch(() => {});
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'TRANSIT' });
  const ch = roster.staff.find(x => x.role !== 'manager');
  pda = (await post('/api/supplier/login', { code: 'TRANSIT', staffId: ch.id, pin: '5678' })).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Start de dienst/);
  assert.equal(await page.evaluate(() => typeof window.RTGPlek), 'object', 'de locatievraag blijft');
  assert.equal(await page.evaluate(() => typeof window.RTGScanner), 'object', 'de scanner is geladen');
  const ops = await page.locator('[data-ds-opsnav] .ds-chip').allTextContents();
  assert.deepEqual(ops, ['Reiziger', 'Chauffeur', 'Luchthaven', 'Regie']);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een dienst starten, een kaartje controleren en stoppen lopen over de echte OV-kern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForFunction(() => [...document.querySelectorAll('#dLijn option')].some(o => o.value === 'L1'));
  await beeld(page, 'ovdienst-390-kies');
  await page.selectOption('#dLijn', 'L1');
  await page.fill('#dNaam', 'Bus 4');
  await page.locator('#dStart').click();
  await page.waitForFunction(() => !document.querySelector('#loopt').hidden && /live/.test(document.querySelector('#dienstBadge').textContent));
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.match(await page.textContent('#nuTitel'), /Kustlijn 1 is live/);
  const stand = await post('/api/staff/ov/stand', {}, pda);
  assert.equal(stand.aan, true, 'de server weet dat de dienst loopt');
  assert.match(await edgeActies(page), /Stop de dienst/, 'de lopende dienst toont zijn eigen handelingen');

  await page.fill('#bewijsVeld', 'OV.ONBEKEND');
  await page.evaluate(() => document.querySelector('#bewijsForm').requestSubmit());
  await page.waitForFunction(() => /Niet geldig/.test(document.querySelector('#bewijsUit').textContent));
  assert.equal(await page.locator('#bewijsUit').isVisible(), true);
  await beeld(page, 'ovdienst-390');

  await page.locator('#scanKnop').click();
  await page.waitForSelector('dialog.ds-dialoog[open]');
  assert.equal(await page.locator('dialog.ds-dialoog input').isVisible(), true, 'typen kan altijd');
  await beeld(page, 'ovdienst-390-scan');
  await page.locator('dialog.ds-dialoog').getByRole('button', { name: 'Sluiten' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog.ds-dialoog'));

  await page.locator('#dStop').click();
  await page.waitForFunction(() => !document.querySelector('#kies').hidden && /Geen dienst/.test(document.querySelector('#dienstBadge').textContent));
  assert.equal((await post('/api/staff/ov/stand', {}, pda)).aan, false, 'de dienst is op de server gestopt');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder personeelsinlog toont de deur de weg naar de personeels-app', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  assert.equal(await page.locator('#vPoort').isVisible(), true);
  assert.equal(await page.locator('#vDienst').isHidden(), true);
  assert.match(await page.textContent('#vPoort'), /personeels-app/);
  assert.equal(await page.locator('#vPoort a[href="/apps/personeel.html"]').count(), 1);
  await beeld(page, 'ovdienst-390-poort');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, b, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(b, h, { taal });
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await page.waitForFunction(() => [...document.querySelectorAll('#dLijn option')].some(o => o.value === 'L1'));
    await page.locator('#dStart').click();
    await page.waitForFunction(() => !document.querySelector('#loopt').hidden);
    await geenOverloop(page);
    await beeld(page, 'ovdienst-' + naam);
    await page.locator('#dStop').click();
    await page.waitForFunction(() => !document.querySelector('#kies').hidden);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
