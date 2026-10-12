/* Het lidscherm van een rit (apps/rit.html) in een echte browser: onder de
   chauffeurskaart staat wat de chauffeur meldde en wat de reiziger zelf
   bevestigde, apart. De reiziger drukt "De chauffeur is er" en de server legt
   dat vast als ZIJN bevestiging; daarna meldt hij een probleem en de rit blijft
   staan waar hij stond. Overgeslagen zonder browser.
   Draai: node --test test/mob-ontvangst.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mobontvangst-e2e-'));
const ZAAK = 'MKKX';
let srv, base, baas, chauffeur, lid, ander, RIT;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function moet(pad, body, token, wat) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}
async function nieuwLid(naam) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 10);
  return (await api('/api/auth/register', { name: naam, email: naam.toLowerCase() + u + '@x.nl',
    phone: '06' + u.slice(-8), password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const beeld = async () => (await moet('/api/mob/volg', { ref: RIT }, lid, 'volgen')).opdracht;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await nieuwLid('Ontvangst'); ander = await nieuwLid('Ander');
  const roster = await api('/api/supplier/roster', { code: ZAAK });
  const mg = (roster.body.staff || []).find(x => x.role === 'manager');
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: mg.id, pin: '1234' })).body.token;
  chauffeur = (await api('/api/supplier/login', { code: ZAAK, staffId: ch.id, pin: '5678' })).body.token;
  assert.ok(lid && ander && baas && chauffeur);
  // een inzetbare wagen; zonder strandt de toewijzing al bij de matcher
  const wagen = await moet('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Ontvangstwagen',
    loc: { lat: 38.909, lng: 1.433 },
    papieren: { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
      taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' } }, baas, 'wagen');
  assert.equal(wagen.asset.inzetbaar, true);
  const vraag = await moet('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432, label: 'Vara de Rey' }, naar: { zaak: 'KIKUNOI' }, reizigers: 1, stad: 'Ibiza' }, lid, 'rit aanvragen');
  RIT = vraag.opdracht.ref;
  await moet('/api/supplier/mob/toewijzen', { ref: RIT }, baas, 'toewijzen');
  await moet('/api/staff/mob/status', { ref: RIT, status: 'onderweg' }, chauffeur, 'onderweg');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });


test('de reiziger bevestigt zelf, onder de melding van de chauffeur', { skip: geenBrowser(pw) }, async () => {
  await moet('/api/staff/mob/status', { ref: RIT, status: 'aangekomen' }, chauffeur, 'aangekomen');
  const browser = await pw.chromium.launch(browserOpties(pw));
  const fouten = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); letOpFouten(page, fouten);
    await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, lid);
    await page.goto(base + '/apps/rit.html?rit=' + encodeURIComponent(RIT) + '&view=chauffeur', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.rit-ontvangst', { timeout: 30000 });
    assert.match(await page.textContent('.rit-ontvangst'), /Chauffeur meldde aankomst om .* nog niet door u bevestigd/);
    await page.click('[data-ontvangst="aankomst"]');
    await page.waitForFunction(() => /u bevestigde om/.test((document.querySelector('.rit-ontvangst') || {}).textContent || ''), null, { timeout: 15000 });
    let o = (await moet('/api/mob/volg', { ref: RIT }, lid, 'volgen')).opdracht;
    assert.ok(o.ontvangst.aankomst.bevestigdDoorReiziger, 'de bevestiging van de reiziger staat op de server');
    await page.selectOption('[data-probleem]', 'ander-voertuig');
    await page.waitForFunction(() => /U meldde: Er staat een ander voertuig/.test((document.querySelector('.rit-ontvangst') || {}).textContent || ''), null, { timeout: 15000 });
    o = (await moet('/api/mob/volg', { ref: RIT }, lid, 'volgen')).opdracht;
    assert.equal(o.status, 'aangekomen', 'een melding verandert niets aan de rit');
  } finally { await browser.close().catch(() => {}); }
  const echt = fouten.filter(f => !/Failed to load resource|net::ERR_FAILED/.test(String(f)));
  assert.deepEqual(echt, [], 'fouten in de browser: ' + echt.join(' | '));
});
