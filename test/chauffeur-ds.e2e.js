/* De chauffeurs-PDA op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom E, de zaakschermen op de werklaag). De hele keten van aanvraag tot
   afgeronde dienst legt test/chauffeur-scherm.e2e.js af; deze toets bewijst
   de vorm en de grenzen eromheen.

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat met de handelingen; het oude
        blad (chauffeur.css) en de klok die een eigen <style> zet laden niet;
     2. de kernhandeling slaagt tegen de echte mobiliteitskern: de aanvraag
        van een lid staat als kaart, het dialoogvenster toont zijn referentie
        en "Neem rit aan" wijst hem echt toe, waarna er precies een volgende
        stap op de kaart staat;
     3. de Magnaat-proef blijft zichtbaar een proef (par. 1d): het keurmerk
        staat, de modus heet MAGNAAT TEST, en er gaat geen verzoek naar /api/;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };
let srv, browser, pda, lid;

async function post(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function open(breedte, hoogte, taal = 'nl', token = pda, zoek = '') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_pda_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/chauffeur.html' + zoek, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#werkstapel [data-rit]', { timeout: 30000 });
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  const zaak = (await post('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  const w = await post('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen van de dienst',
    loc: { lat: 38.909, lng: 1.433 }, energieNiveau: 80, bestuurder: ch.name, papieren: PAPIEREN_OK }, zaak);
  assert.equal(w.body.asset && w.body.asset.inzetbaar, true, 'de wagen van de chauffeur mag rijden');
  pda = (await post('/api/supplier/login', { code: 'MKKX', staffId: ch.id, pin: '5678' })).body.token;
  assert.ok(pda, 'de chauffeur logt in op de PDA');
  const u = Date.now().toString().slice(-8);
  lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'dsc' + u + '@x.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'het lid is aangemeld');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await alleenDs(page);
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src));
  assert.ok(!scripts.some(s => /\/shared\/(klok|uurwerk)\.js/.test(s)), 'de klok met eigen <style> laadt niet');
  assert.match(await page.textContent('#klok'), /\d{1,2}[:.]\d{2}/, 'de officiele tijd staat er in de taal van de pagina');
  await page.locator('[data-naar="hulp"]').click();
  assert.match(await edgeActies(page), /Hulp bij een incident/, 'Acties toont de handelingen van dit scherm');
  assert.equal(await page.locator('[data-naar="hulp"]').getAttribute('aria-selected'), 'true', 'de bladen zijn tabs');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de aanvraag van een lid wordt via het dialoogvenster echt aangenomen', { skip }, async () => {
  const rit = await post('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432, label: 'Marina Botafoch' }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lid);
  const ref = rit.body.opdracht && rit.body.opdracht.ref;
  assert.ok(ref, 'het lid heeft een rit aangevraagd');
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForSelector('#werkstapel [data-rit="nieuw"]');
  assert.match(await page.textContent('#werkstapel [data-rit="nieuw"]'), /Marina Botafoch[\s\S]*€/);
  await beeld(page, 'chauffeur-390');
  await page.locator('#werkstapel [data-bekijk]').click();
  await page.waitForSelector('#ritDialoog[open]');
  assert.match(await page.textContent('#dialoogFeiten'), new RegExp(ref));
  await beeld(page, 'chauffeur-390-dialoog');
  const [antwoord] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/supplier/mob/toewijzen')),
    page.locator('#accepteerRit').click()
  ]);
  assert.equal(antwoord.status(), 200, 'aannemen via het scherm lukt');
  await page.waitForSelector('#werkstapel [data-rit="actief"]');
  assert.equal(await page.locator('#werkstapel [data-volgende]').count(), 1, 'precies een volgende stap');
  assert.equal(await page.locator('#werkstapel [data-volgende]').getAttribute('data-volgende'), 'onderweg');
  assert.equal(await page.locator('#werkstapel progress.ds-voortgang').evaluate(m => m.value), 1, 'de fase is een meter');
  await beeld(page, 'chauffeur-390-actief');
  await geenOverloop(page);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de Magnaat-proef blijft zichtbaar een proef en raakt de API niet', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const api = [];
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/staff/') || /\/api\/supplier\/mob\//.test(r.url())) api.push(r.url()); });
  await page.goto(srv.base + '/apps/chauffeur.html?magnaat=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#werkstapel [data-rit="nieuw"]');
  assert.equal(await page.locator('#rtgMagnaatTestMark').isVisible(), true, 'het keurmerk Magnaat Test staat in beeld');
  assert.equal((await page.textContent('#modusLabel')).trim(), 'MAGNAAT TEST');
  assert.match(await page.textContent('#werkstapel'), /Ibiza Airport/, 'de synthetische rit');
  await page.locator('[data-naar="hulp"]').click();
  assert.equal(await page.locator('#demoKnop').isVisible(), true, 'de testknop draagt zijn naam');
  assert.match(await page.textContent('#sessieStand'), /trainingskopie/);
  await beeld(page, 'chauffeur-390-magnaat');
  assert.deepEqual(api, [], 'de proef raakt de mobiliteits-API niet');
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'chauffeur-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
