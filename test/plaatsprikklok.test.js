/* ============================================================================
   AANWEZIGHEID BIJ DE PRIKKLOK -- ZONDER VOLGEN (PLAATS.md fase 2).

   De architectuur die hier bewezen wordt, is de hele truc: JE TELEFOON NEEMT
   WAAR, DE KASSA VRAAGT. Het toestel draait de hek-motor onder het eigen
   LEDENACCOUNT van de medewerker (codenaam, /api/plaats/*), en de prikklok --
   die op een ZAAK-inlog draait (/api/staff/clock) -- stelt alleen een vraag aan
   de plaatslaag. De twee sessies raken elkaar nooit, en er gaat geen coördinaat
   over de lijn.

   DRIE UITKOMSTEN, NOOIT TWEE, en die drie zijn hier het eigenlijke onderwerp:

     niet gemeten     er keek niemand -- geen venster, geen gekoppeld account
     niet bevestigd   het toestel keek en je stond er niet
     bevestigd        het toestel keek en je stond er wel

   Die eerste twee op één hoop gooien maakt van elke ongemeten inklok een
   verdachte inklok, en dan is dit geen aanwezigheidslaag meer maar een
   beschuldigingslaag. Toets 2, 4 en 5 hieronder houden ze uit elkaar.

   EN HET BLOKKEERT NIETS. Inklokken buiten het hek werkt gewoon (toets 4). Het
   werkwoord van deze laag is klaarzetten, nooit doen.

   Draai los: node --experimental-sqlite --test test/plaatsprikklok.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, lidToken;
const ZAAK = 'KIKUNOI';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plaatsklok-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Klok in, en geef terug wat er op de verse klokregel staat over plaats. De
   klok is een wissel, dus we klokken eerst uit als er nog iets openstaat. */
async function klokIn() {
  const eerste = await api('/api/staff/clock', {}, werker);
  if (eerste.body.actie === 'in') return eerste;
  return api('/api/staff/clock', {}, werker);
}
/* De uitspraak komt terug in het antwoord van het klokken zelf: wie klokt, hoort
   meteen te zien wat er over hem is vastgelegd. Hetzelfde beginsel als het
   inzagejournaal -- geen vastlegging over een mens waar die mens niet bij kan. */
const plekVanLaatste = (r) => (r.body && r.body.plek) || null;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: ZAAK });
  const man = roster.body.staff.find(x => x.role === 'manager');
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' })).body.token;
  const nieuw = await api('/api/supplier/staff/add', { name: 'Pim Plaats', role: 'staff', func: 'Balie' }, baas);
  assert.equal(nieuw.status, 200, 'de manager maakt een vrije werkplek');
  const st = nieuw.body.staff, staffPin = nieuw.body.pin;

  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Pim Plaats', email: 'pp' + u + '@voorbeeld.test',
    password: 'plaatsgeheim123', geboortedatum: '1993-03-03', tier: 'rtg', pasApp: 'rtg' });
  lidToken = reg.body.token;
  const koppel = await api('/api/account/koppel', { soort: 'personeel', code: ZAAK, staffId: st.id, pin: staffPin }, lidToken);
  assert.equal(koppel.status, 200, 'het lid is als medewerker gekoppeld aan de zaak');
  werker = (await api('/api/supplier/login', { code: ZAAK, staffId: st.id, pin: staffPin })).body.token;
  assert.ok(baas && werker && lidToken, 'baas, werker en lid staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het hek van een zaak draagt haar CODE, niet haar naam', async () => {
  const h = await api('/api/plaats/hekken', { doel: 'dienst' }, lidToken);
  assert.equal(h.status, 200);
  const hek = (h.body.hekken || []).find(x => x.id === 'leverancier:' + ZAAK);
  assert.ok(hek, 'de zaak staat als hek in de lijst, op haar code');
  /* Een naam is wat een zaak zichzelf vandaag noemt; de code is waar de rest van
     het huis haar aan kent. Een hek dat van id verandert bij een hernoeming laat
     elke lopende waarneming in het niets wijzen. */
  assert.notEqual(hek.id, 'leverancier:' + hek.naam);
  assert.equal(hek.doel, 'dienst');
  assert.equal(hek.straalM, 120, 'aanwezigheid op het werk is strak');
});

test('2. zonder venster is het NIET GEMETEN -- en dat is iets anders dan afwezig', async () => {
  const r = await klokIn();
  assert.equal(r.body.actie, 'in', 'de medewerker klokt gewoon in');
  const plek = plekVanLaatste(r);
  assert.ok(plek, 'de klokregel draagt een plaats-uitspraak');
  assert.equal(plek.gemeten, false, 'er keek niemand, dus er is niets gemeten');
  assert.equal(plek.bevestigd, false);
  assert.equal(plek.reden, 'geen venster', 'en de reden staat erbij, in plaats van stilte');
});

test('3. met een venster en een waarneming binnen het hek: BEVESTIGD', async () => {
  // het lid opent zelf een venster op zijn eigen account -- de andere sessie
  const v = await api('/api/plaats/venster', { doel: 'dienst', bron: 'dienst bij ' + ZAAK, minuten: 60 }, lidToken);
  assert.equal(v.body.status, 200, 'het venster gaat open');
  const w = await api('/api/plaats/waarneem', { doel: 'dienst', hek: 'leverancier:' + ZAAK, wat: 'binnen' }, lidToken);
  assert.equal(w.body.status, 200, 'het toestel meldt dat het binnen het hek is');

  await api('/api/staff/clock', {}, werker);          // eerst uit
  const r = await klokIn();
  const plek = plekVanLaatste(r);
  assert.equal(plek.gemeten, true, 'nu is er wel gekeken');
  assert.equal(plek.bevestigd, true, 'en het toestel stond binnen het hek');
  assert.ok(plek.sinds, 'met een tijd erbij');
  /* GRENS 4 VAN PLAATS.md: de werkgever krijgt aanwezigheid, geen locatie. Ook
     geen "hoe ver erbuiten" -- dat is een coördinaat met een omweg. */
  assert.deepEqual(Object.keys(plek).sort(), ['bevestigd', 'gemeten', 'reden', 'sinds']);
  const tekst = JSON.stringify(plek);
  for (const veld of ['lat', 'lng', 'coord', 'afstand', 'meter']) {
    assert.ok(!tekst.includes(veld), 'de klokregel draagt geen ' + veld);
  }
});

test('4. buiten het hek inklokken WERKT, en heet niet bevestigd', async () => {
  const w = await api('/api/plaats/waarneem', { doel: 'dienst', hek: 'leverancier:' + ZAAK, wat: 'buiten' }, lidToken);
  assert.equal(w.body.status, 200);
  await api('/api/staff/clock', {}, werker);          // eerst uit
  const r = await klokIn();
  assert.equal(r.body.actie, 'in', 'de inklok gaat gewoon door -- er wordt niets geblokkeerd');
  const plek = plekVanLaatste(r);
  assert.equal(plek.gemeten, true, 'er is wel degelijk gekeken');
  assert.equal(plek.bevestigd, false, 'maar het toestel stond er niet');
  /* En dit is het verschil met toets 2: daar was er geen meting, hier wel.
     Dezelfde uitkomst voor beide zou van elke ongemeten inklok een verdachte
     inklok maken. */
  assert.notEqual(plek.gemeten, false);
});

test('5. een gesloten venster maakt het weer NIET GEMETEN', async () => {
  const s = await api('/api/plaats/venster/sluit', { doel: 'dienst' }, lidToken);
  assert.equal(s.body.status, 200, 'het lid sluit zijn venster');
  await api('/api/staff/clock', {}, werker);          // eerst uit
  const r = await klokIn();
  const plek = plekVanLaatste(r);
  assert.equal(plek.gemeten, false, 'toestemming is voorbij, dus er wordt niet meer gekeken');
  assert.equal(plek.reden, 'geen venster');
  /* En zelf-inzage laat zien dat er ook niets meer ligt: sluiten wist. */
  const stand = await api('/api/plaats/stand', {}, lidToken);
  assert.equal(stand.body.waarnemingen.length, 0, 'er is geen waarneming meer over');
});
