/* RTG Dispatch op het RTG Design System: het bewijs uit TRAVELOS-MIGRATIE.md
   par. 3, in een echte browser tegen een echte server (stroom E, de
   zaakschermen op de werklaag).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat en toont de handelingen;
     2. de zaakdeur blijft: zonder zaak-inlog zegt het scherm welke inlog hij
        mist, en er staat geen bord;
     3. de kernhandeling slaagt tegen de echte mobiliteitskern: de open rit
        staat op het bord met de rekensom van de matcher als meters met hun
        factornaam, de afgewezen wagen staat er MET reden, en "Wijs toe" wijst
        de rit echt toe (de server is het ermee eens);
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };
let srv, browser, zaak, lid;

async function post(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function open(breedte, hoogte, taal = 'nl', token = zaak) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_pda_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/dispatch.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  if (token) await page.waitForSelector('#vBord:not([hidden]) #lijstVloot .ds-lijst__rij', { timeout: 30000 });
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await post('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  assert.ok(zaak, 'de centrale van de taxizaak logt in');
  const u = Date.now().toString().slice(-8);
  lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'dsd' + u + '@x.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'het lid is aangemeld');
  const a = await post('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen A', loc: { lat: 38.909, lng: 1.433 },
    energieNiveau: 80, bestuurder: 'chauffeur-a', papieren: PAPIEREN_OK }, zaak);
  assert.equal(a.body.asset && a.body.asset.inzetbaar, true, 'Wagen A mag rijden');
  const b = await post('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen B', loc: { lat: 38.9091, lng: 1.4331 },
    energieNiveau: 90, bestuurder: 'chauffeur-b', papieren: Object.assign({}, PAPIEREN_OK, { taxivergunning: '2020-01-01' }) }, zaak);
  assert.equal(b.body.asset && b.body.asset.inzetbaar, false, 'Wagen B heeft een verlopen vergunning');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.ok((await edgeLabels(page)).includes('Acties'), 'de Edge heeft Acties');
  assert.match(await edgeActies(page), /Telefonische boeking invoeren/, 'Acties toont de handelingen van dit scherm');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder zaak-inlog zegt het scherm welke inlog hij mist', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', null);
  await page.waitForSelector('#vPoort:not([hidden])');
  assert.match(await page.textContent('#vPoort'), /zaak-inlog/);
  assert.equal(await page.locator('#vBord').isHidden(), true, 'zonder sleutel staat er geen bord');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de open rit staat met de rekensom op het bord en wordt echt toegewezen', { skip }, async () => {
  const rit = await post('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lid);
  const ref = rit.body.opdracht && rit.body.opdracht.ref;
  assert.ok(ref, 'de rit staat klaar: ' + JSON.stringify(rit.body).slice(0, 160));
  const { ctx, page, fouten } = await open(390, 844);
  const rij = page.locator('#lijstOpen [data-ref="' + ref + '"]');
  await rij.waitFor();
  await page.waitForSelector('#lijstOpen [data-factor]');
  const factoren = await page.locator('#lijstOpen [data-factor]').evaluateAll(x => x.map(e => e.textContent));
  for (const f of ['nabijheid', 'aankomsttijd', 'eerlijk']) assert.ok(factoren.some(t => t.includes(f)), 'de factor ' + f + ' staat met uitleg');
  assert.ok(await page.locator('#lijstOpen [data-factor] progress.ds-voortgang').count() > 0, 'de meter is een progress');
  assert.match((await page.locator('#lijstOpen [data-afgewezen]').allTextContents()).join(' '), /Wagen B.*vergunning/, 'de afgewezen wagen staat er met reden');
  assert.match(await page.textContent('#lijstVloot'), /Wagen A[\s\S]*inzetbaar/);
  assert.match(await page.textContent('#zaakNaam'), /inzetbaar/);
  await beeld(page, 'dispatch-390');

  const [antwoord] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/supplier/mob/toewijzen')),
    page.locator('#lijstOpen [data-kandidaat] .ds-knop--primair').first().click()
  ]);
  assert.equal(antwoord.status(), 200, 'toewijzen via het scherm lukt');
  await page.waitForFunction(() => /Toegewezen aan/.test(document.querySelector('#melding').textContent));
  await page.waitForFunction(r => /onderweg|geaccepteerd/i.test(document.querySelector('#lijstLopend').textContent) &&
    document.querySelector('#lijstLopend').textContent.includes(r), ref);
  const bord = await post('/api/supplier/mob/dispatch', {}, zaak);
  assert.ok((bord.body.lopend || []).some(o => o.ref === ref), 'de server kent de rit als lopend');
  await geenOverloop(page);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de telefonische boeking is een Taak met bestemmingen uit RTG zelf', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.locator('#knopTelefoon').click();
  await page.waitForFunction(() => document.querySelector('#telNaar').options.length > 1);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'taak');
  await page.fill('#telNaam', 'Mevrouw Bel');
  await page.selectOption('#telNaar', { index: 1 });
  const [antwoord] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/supplier/mob/telefoon')),
    page.locator('#telBoek').click()
  ]);
  assert.equal(antwoord.status(), 200, 'de opdracht is aangemaakt: ' + (await antwoord.text()).slice(0, 160));
  await page.waitForFunction(() => /staat klaar/.test(document.querySelector('#melding').textContent));
  await beeld(page, 'dispatch-390-telefoon');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'dispatch-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
