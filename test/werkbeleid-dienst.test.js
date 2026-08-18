/* ============================================================================
   HET WERKBELEID GELDT TIJDENS JE DIENST, EN NIET IN JE PAUZE.

   Het werkgeversbeleid kan functies op de pas van een medewerker dichtzetten:
   geen Salon, geen AI, geen paspoort delen. Dat is een echte eis voor een
   bedrijf met geheimhouding of compliance.

   Maar het gold VIERENTWINTIG UUR PER DAG. dichtVoor() keek alleen of je een
   werkkoppeling met die zaak had, niet of je aan het werk was -- dus je baas
   hield je pas ook op zondag dicht. Sinds deze ronde:

       - het beleid geldt alleen zolang je INGEKLOKT staat;
       - en daarbinnen heb je 45 minuten pauze waarin het niet geldt.

   De rookpauze en de grote pauze komen uit dezelfde pot. Wat er NIET gemeten
   wordt is wat je in die minuten doet: de teller loopt op pauzeminuten. Zou
   hij op je gebruik van De Salon lopen, dan hield dit systeem precies bij
   hoeveel minuten je op sociale media zat -- de meting waar dit beleid tegen
   beschermt.

   Draai los: node --test test/werkbeleid-dienst.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, lidToken, lidKey;
let dichtId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wbdienst-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
/* Wat het BORD van het lid zegt over die ene functie: staat hij dicht, en zo
   ja door wie? Dat is de plek waar de medewerker het zelf ziet. */
async function bordStand(id) {
  const b = await api('/api/member/boardroom', {}, lidToken);
  const alle = [].concat(...((b.body.bord && b.body.bord.categorieen) || []).map(c => c.functies || []));
  return alle.find(o => o.id === id) || null;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = roster.body.staff.find(x => x.role === 'manager');
  baas = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  // Een seedmedewerker kan al aan een demo-identiteit hangen en mag dan niet
  // door een tweede account worden overgenomen. Maak daarom bewust een verse,
  // nog ongekoppelde werkplek voor deze eenmalige migratieproef.
  const nieuw = await api('/api/supplier/staff/add', { name: 'Nora Werkplek', role: 'staff', func: 'Balie' }, baas);
  assert.equal(nieuw.status, 200, 'de manager maakt een vrije werkplek');
  const st = nieuw.body.staff;
  const staffPin = nieuw.body.pin;

  /* Een lid dat OOK medewerker is: het ene RTG-account met een werkrol. Zo
     ontstaat de koppeling die het werkbeleid volgt (kern/eenaccount). */
  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Nora Werker', email: 'wb' + u + '@voorbeeld.test',
    password: 'werkgeheim123', geboortedatum: '1993-03-03', tier: 'rtg', pasApp: 'rtg' });
  lidToken = reg.body.token;
  lidKey = (await api('/api/state', {}, lidToken)).body.state.user.codename;
  const koppel = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId: st.id, pin: staffPin }, lidToken);
  assert.equal(koppel.status, 200, 'het lid is als medewerker gekoppeld aan de zaak');
  werker = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: st.id, pin: staffPin })).body.token;
  assert.ok(baas && werker && lidToken, 'baas, werker en lid staan klaar');
  void koppel;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de werkgever zet een functie dicht', async () => {
  const b = await api('/api/supplier/werkbeleid', {}, baas);
  const lijst = b.body.beleid.functies || [];
  dichtId = (lijst.find(f => f.id === 'salon') || lijst[0]).id;
  const zet = await api('/api/supplier/werkbeleid/zet', { uit: [dichtId], door: 'Sal de Mar' }, baas);
  assert.equal(zet.status, 200);
  assert.ok((zet.body.beleid.functies || []).find(f => f.id === dichtId).dicht, 'het beleid staat');
});

test('2. buiten je dienst gaat je werkgever niet over je pas', async () => {
  /* Er is nog niet ingeklokt. Het beleid staat, maar de medewerker is niet aan
     het werk -- en dan hoort er niets van zijn pas dicht te staan. */
  const stand = await bordStand(dichtId);
  assert.ok(stand, 'de functie staat op het bord');
  assert.equal(stand.beheerdDoor, null, 'uitgeklokt houdt de werkgever niets dicht');
  const pz = await api('/api/staff/pauze', {}, werker);
  assert.equal(pz.status, 409, 'en een pauze zonder dienst bestaat niet');
});

test('3. ingeklokt geldt het beleid wel', async () => {
  const klok = await api('/api/staff/clock', {}, werker);
  assert.equal(klok.body.actie, 'in', 'de medewerker klokt in');

  const stand = await bordStand(dichtId);
  assert.ok(stand, 'de functie staat op het bord');
  assert.equal(stand.beheerdDoor, 'werkgever', 'nu houdt de werkgever hem dicht');
  assert.equal(stand.beheerd, true);
  assert.ok(stand.beheerder, 'met de naam van de zaak erbij: stille voogdij bestaat hier niet');
});

test('4. in de pauze is je pas weer van jou', async () => {
  const aan = await api('/api/staff/pauze', {}, werker);
  assert.equal(aan.status, 200);
  assert.equal(aan.body.actie, 'in');
  assert.equal(aan.body.pauze.ingeklokt, true);
  assert.equal(aan.body.pauze.pauze, true);
  assert.equal(aan.body.budgetMinuten, 45, 'de armslag is drie kwartier per dienst');
  assert.ok(aan.body.pauze.restMinuten <= 45 && aan.body.pauze.restMinuten >= 44, 'er is nog bijna alles over');

  const stand = await bordStand(dichtId);
  assert.notEqual(stand.beheerdDoor, 'werkgever', 'in de pauze houdt de werkgever niets dicht');

  const uit = await api('/api/staff/pauze', {}, werker);
  assert.equal(uit.body.actie, 'uit', 'en de pauze eindigt weer');
  assert.equal(uit.body.pauze.pauze, false);

  const na = await bordStand(dichtId);
  assert.equal(na.beheerdDoor, 'werkgever', 'daarna geldt het beleid weer');
});

test('5. de teller loopt op pauzeMINUTEN, niet op wat je doet', async () => {
  const mijn = await api('/api/staff/mine', {}, werker);
  assert.ok(mijn.body.pauze, 'de eigen stand staat in het overzicht');
  assert.equal(mijn.body.pauze.budget, 45);
  assert.ok('gebruikteMinuten' in mijn.body.pauze, 'er staat hoeveel pauze er op is');
  /* Er is geen enkel veld dat zegt WAT er in die minuten gebeurde. Dat is de
     hele reden dat de teller op pauzetijd loopt en niet op gebruik. */
  const sleutels = Object.keys(mijn.body.pauze).join(' ');
  assert.ok(!/salon|bekeken|geopend|schermtijd|activiteit/i.test(sleutels),
    'geen veld zegt WAT er in die minuten gebeurde: ' + sleutels);
  assert.ok(/minuten/i.test(sleutels), 'wat er wel staat gaat over tijd: ' + sleutels);
});

test('6. na uitklokken is het beleid weer van tafel', async () => {
  const uit = await api('/api/staff/clock', {}, werker);
  assert.equal(uit.body.actie, 'uit');
  const stand = await bordStand(dichtId);
  assert.equal(stand.beheerdDoor, null, 'thuis op de bank beslist de werkgever niets');
  assert.equal((await api('/api/staff/pauze', {}, werker)).status, 409, 'en pauze kan pas weer bij de volgende dienst');
});
