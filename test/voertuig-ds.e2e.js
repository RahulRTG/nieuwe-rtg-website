/* Het voertuigscherm op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom E, de zaakschermen op de werklaag).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat met de handelingen;
     2. zonder sleutel is het een gesloten deur en geen leeg scherm, en een id
        dat niet in de vloot staat wordt niet geraden;
     3. de kernhandeling slaagt tegen de echte vlootkern: ?voertuig=<id> opent
        het voertuig als Detail met de stand, de papieren (de fail-closed zin
        staat er altijd) en de kenmerken, en een bestuurder uit het team
        bewaren komt echt op de server aan;
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
let srv, browser, zaak, wagen, chauffeur;

async function post(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function open(breedte, hoogte, taal = 'nl', token = zaak, zoek = '?voertuig=' + encodeURIComponent(wagen.id)) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_sup_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/voertuig.html' + zoek, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  if (token) await page.waitForSelector('#vloot [data-voertuig]', { timeout: 30000 });
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  chauffeur = (roster.body.staff || []).find(x => x.role !== 'manager');
  zaak = (await post('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  assert.ok(zaak && chauffeur, 'de zaak logt in en heeft een chauffeur');
  wagen = (await post('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen Detail', loc: { lat: 38.909, lng: 1.433 },
    energieNiveau: 80, papieren: PAPIEREN_OK }, zaak)).body.asset;
  assert.ok(wagen && wagen.id, 'de wagen staat in de vloot');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.match(await edgeActies(page), /Ververs/, 'Acties toont de handelingen van dit scherm');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder sleutel een gesloten deur, en een vreemd id wordt niet geraden', { skip }, async () => {
  let s = await open(390, 844, 'nl', null);
  await s.page.waitForSelector('#geen:not([hidden])');
  assert.match(await s.page.textContent('#geenTekst'), /gesloten deur/);
  assert.equal(await s.page.locator('#dit').isHidden(), true);
  await s.ctx.close();
  s = await open(390, 844, 'nl', zaak, '?voertuig=bestaat-niet');
  await s.page.waitForSelector('#geen:not([hidden])');
  assert.match(await s.page.textContent('#geenTekst'), /welke van de twee zegt dit scherm bewust niet/);
  assert.equal(await s.page.locator('#dit').isHidden(), true, 'er wordt geen voertuig geraden');
  assert.deepEqual(s.fouten, []);
  await s.ctx.close();
});

test('het voertuig opent als Detail en een bestuurder bewaren komt op de server aan', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForSelector('#dit:not([hidden])');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.equal((await page.textContent('#vNaam')).trim(), 'Wagen Detail');
  assert.match(await page.textContent('#vStand'), /^inzetbaar/);
  assert.match(await page.textContent('#vPapierenLet'), /telt als ONGELDIG/, 'de fail-closed zin staat er altijd');
  assert.ok(await page.locator('#vPapieren .ds-lijst__rij').count() >= 1, 'de verplichte papieren staan als rijen');
  /* Een geldig papier draagt zijn einddatum in de taal van de pagina, en niet
     "geen einddatum" naast een voertuig dat de server inzetbaar noemt. */
  assert.match(await page.textContent('#vPapieren'), /kenteken\s*tot .*2030/);
  assert.doesNotMatch(await page.textContent('#vPapieren'), /geen einddatum/);
  assert.match(await page.textContent('#vKenmerken'), /plaatsen/);
  assert.equal(await page.locator('#vloot [data-voertuig="' + wagen.id + '"]').getAttribute('aria-pressed'), 'true');
  await beeld(page, 'voertuig-390');

  await page.waitForSelector('#vBestuurderKies:not([hidden])');
  await page.selectOption('#vTeam', String(chauffeur.id));
  const [antwoord] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/supplier/mob/voertuig')),
    page.locator('#vTeamZet').click()
  ]);
  assert.equal(antwoord.status(), 200, 'bewaren via het scherm lukt');
  await page.waitForFunction(() => /Bestuurder bewaard/.test(document.querySelector('#melding').textContent));
  await page.waitForFunction(n => document.querySelector('#vBestuurder').textContent.includes(n), chauffeur.name);
  const vloot = await post('/api/supplier/mob/vloot', {}, zaak);
  const terug = (vloot.body.assets || []).find(a => a.id === wagen.id);
  assert.equal(terug && terug.bestuurderStaffId, chauffeur.id, 'de server kent de bestuurder');
  await geenOverloop(page);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await page.waitForSelector('#dit:not([hidden])');
    await geenOverloop(page);
    await beeld(page, 'voertuig-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
