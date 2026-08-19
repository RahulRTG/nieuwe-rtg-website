/* ============================================================================
   DE BRUG TUSSEN TWEE SESSIES, EN DE MENS ERTUSSEN (PLAATS.md fase 2c).

   De hek-motor draait in de LEDEN-app; een dienst leeft in de PERSONEELS-app.
   Die twee sessies raken elkaar bewust nooit -- dat is de kracht van het
   ontwerp, en tegelijk de reden dat een venster tot nu toe alleen met de hand
   open kon.

   DE DEUR DIE DICHT MOET BLIJVEN, en die deze toets bewaakt: de zaak mag het
   venster NIET openen. Het zou zo makkelijk zijn -- bij het inklokken meteen een
   venster op het account van de medewerker -- en het is precies fout: dan opent
   een WERKGEVER een toestemming op de telefoon van zijn personeel, en
   toestemming die een ander voor je geeft is geen toestemming. Toets 2.

   WAT ER WEL MAG IS KLAARZETTEN: het LID krijgt te horen dat zijn eigen dienst
   loopt, en zijn eigen app biedt het hem aan (toets 1 en 3).

   EN HET VENSTER SLUIT ALS DE DIENST VOORBIJ IS (toets 4). Dat is "toestemming
   heeft altijd een einde" op zijn concreetst: niet alleen een einddatum die
   vanzelf verloopt, maar een venster dat weggaat op het moment dat de reden
   ervoor weg is. Uitgeklokt is uitgekeken.

   Draai los: node --experimental-sqlite --test test/plaatsdienstbrug.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, lidToken;
const ZAAK = 'KIKUNOI';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plaatsbrug-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const dienstStand = () => api('/api/plaats/dienst', {}, lidToken).then(r => r.body);
/* De klok is een wissel; deze twee zetten hem waar de toets hem wil hebben. */
async function zorgIngeklokt() {
  const r = await api('/api/staff/clock', {}, werker);
  return r.body.actie === 'in' ? r : api('/api/staff/clock', {}, werker);
}
async function zorgUitgeklokt() {
  const r = await api('/api/staff/clock', {}, werker);
  return r.body.actie === 'uit' ? r : api('/api/staff/clock', {}, werker);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: ZAAK });
  const man = roster.body.staff.find(x => x.role === 'manager');
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' })).body.token;
  const nieuw = await api('/api/supplier/staff/add', { name: 'Brug Lid', role: 'staff', func: 'Balie' }, baas);
  assert.equal(nieuw.status, 200);
  const st = nieuw.body.staff, staffPin = nieuw.body.pin;

  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Brug Lid', email: 'bl' + u + '@voorbeeld.test',
    password: 'bruggeheim123', geboortedatum: '1992-02-02', tier: 'rtg', pasApp: 'rtg' });
  lidToken = reg.body.token;
  assert.equal((await api('/api/account/koppel',
    { soort: 'personeel', code: ZAAK, staffId: st.id, pin: staffPin }, lidToken)).status, 200);
  werker = (await api('/api/supplier/login', { code: ZAAK, staffId: st.id, pin: staffPin })).body.token;
  assert.ok(baas && werker && lidToken);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. uitgeklokt is er niets te melden; ingeklokt weet het lid dat zelf', async () => {
  await zorgUitgeklokt();
  const stil = await dienstStand();
  assert.equal(stil.status, 200);
  assert.equal(stil.diensten.length, 0, 'zonder dienst valt er niets aan te bieden');

  await zorgIngeklokt();
  const loopt = await dienstStand();
  assert.equal(loopt.diensten.length, 1, 'de lopende dienst staat er');
  assert.equal(loopt.diensten[0].zaak, ZAAK);
  assert.equal(loopt.diensten[0].hek, 'leverancier:' + ZAAK, 'met het hek waar het om gaat');
  /* Dit is EIGEN data: bij welke zaak werk ik, en sta ik daar nu ingeklokt.
     Geen enkele andere mens komt erin voor, en er staat geen plek in. */
  const tekst = JSON.stringify(loopt);
  for (const veld of ['lat', 'lng', 'coord', 'codenaam', 'key']) {
    assert.ok(!tekst.includes('"' + veld + '"'), 'het antwoord draagt geen ' + veld);
  }
});

test('2. de ZAAK opent geen venster -- ook niet bij het inklokken', async () => {
  /* De deur die dicht moet blijven. Er is nu een lopende dienst en er is nooit
     een venster geopend: dan hoort er ook geen te zijn. Zou het inklokken er
     zelf een openen, dan had een werkgever toestemming gegeven op de telefoon
     van zijn personeel -- en dat is geen toestemming maar een aanname. */
  const na = await dienstStand();
  assert.equal(na.diensten.length, 1, 'de dienst loopt');
  assert.equal(na.venster, null, 'en er staat geen venster open dat niemand heeft gegeven');
  const stand = await api('/api/plaats/stand', {}, lidToken);
  assert.equal(stand.body.vensters.length, 0, 'ook niet in de eigen stand van het lid');
});

test('3. zegt het lid ja, dan ligt de toestemming er en hoeft er niets meer gevraagd', async () => {
  // wat de app doet nadat de mens op "Aanzetten" tikt
  const v = await api('/api/plaats/venster',
    { doel: 'dienst', bron: 'dienst bij ' + ZAAK, minuten: 12 * 60 }, lidToken);
  assert.equal(v.body.status, 200);

  const na = await dienstStand();
  assert.ok(na.venster, 'de toestemming ligt er');
  assert.equal(na.venster.bron, 'dienst bij ' + ZAAK, 'met de reden erbij, na te vertellen');
  assert.ok(new Date(na.venster.sluit).getTime() > Date.now(), 'en met een einde');
  /* Vanaf hier hoort de app gewoon te beginnen zonder iets te vragen: een vraag
     die je al beantwoord hebt, nog eens stellen is zeuren. */
});

test('4. uitklokken maakt de reden weg -- en dan hoort het venster te sluiten', async () => {
  await zorgUitgeklokt();
  const na = await dienstStand();
  assert.equal(na.diensten.length, 0, 'de dienst is voorbij');
  /* Het venster staat er nog: sluiten is het werk van de APP, want alleen die
     weet dat hij het zelf voor deze dienst heeft geopend. Wat de server hier
     doet is het signaal geven -- geen dienst meer, en de bron van het venster
     erbij zodat de app kan zien of het van hem is. */
  assert.ok(na.venster, 'de server sluit hem niet ongevraagd');
  assert.equal(na.venster.bron, 'dienst bij ' + ZAAK, 'maar zegt wel waarvoor hij ooit openging');

  // en dat is precies wat shared/plaatsdienst.js dan doet
  const dicht = await api('/api/plaats/venster/sluit', { doel: 'dienst' }, lidToken);
  assert.equal(dicht.body.status, 200);
  const leeg = await dienstStand();
  assert.equal(leeg.venster, null, 'uitgeklokt is uitgekeken');
  const stand = await api('/api/plaats/stand', {}, lidToken);
  assert.equal(stand.body.waarnemingen.length, 0, 'en er ligt geen waarneming meer');
});

test('5. een gast heeft hier niets te zoeken', async () => {
  const gast = (await api('/api/login', { tier: 'guest' })).body.token;
  assert.ok(gast, 'een gastsessie bestaat');
  const r = await api('/api/plaats/dienst', {}, gast);
  assert.equal(r.status, 403, 'een gast heeft geen codenaam waar een venster bij hoort');
});
