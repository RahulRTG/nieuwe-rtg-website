/* HET KANTOOR AAN HET STUUR, UITSLUITEND OP TONEN (besluit C2 van de eigenaar,
   25 september 2026).

   Het besluit: `office` wordt een AI-rol, alleen op de bestaande trede `lezen`.
   Geen nieuwe gezagsladder, geen muterende kantoormacht. Vijf dingen die niet
   mogen sneuvelen:
   1. `office` staat in de lezen-lijst en in GEEN van de andere twee -- en daar
      staat hij als lege lijst, zodat een toevoeging een zichtbare bewerking is;
   2. elk pad in die lijst is een aggregaat dat niets schrijft; de paden die per
      mens tonen of als bijwerking iets zetten, blijven verboden;
   3. de gedeelde kantoorcode komt niet aan het stuur (de weigering zegt de weg:
      inloggen op naam) -- een spoor dat bij een gedeelde code eindigt is een alibi;
   4. een mens op naam leest via het stuur, en een schrijvende kantoorroute wordt
      door het stuur geweigerd, ook als die mens hem zelf wel mag;
   5. de AI kan nooit meer dan de mens: een medewerker zonder boardroomtoegang
      krijgt via het stuur de weigering van de route zelf, en er is geen
      /api/office/doe/bevestig;
   6. twee keer vragen is twee keer lezen: dezelfde kaart, hetzelfde antwoord
      (de meting onder het mutatiecontract in server/lib/mutatiecontracten-kantoorstuur.js).

   Draai los: node --test test/stuur-kantoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LEZEN, KLEIN, VOORSTEL } = require('../server/kern/stuur/beleid-lijsten');
const { beleidVoor, NIVEAUS } = require('../server/kern/stuur/beleid');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');

const TONEN = ['/api/command/puls', '/api/office/economie/werelden', '/api/office/kosten/periode'];
/* Elk van deze bestaat en is voor een kantoormens bereikbaar -- en elk toont
   mensen of verandert iets. Staat er een ooit op `lezen`, dan is C2 gebroken. */
const NOOIT = ['/api/office/state', '/api/office/payroll/overzicht', '/api/office/kosten/overzicht',
  '/api/office/kosten/vooruitblik', '/api/command/gezondheid', '/api/office/service/stand',
  '/api/office/kosten/periode/sluit', '/api/office/economie/relatie/zet', '/api/aanmelding/beslis'];

test('1. office staat alleen op lezen, en de andere twee lijsten zijn leeg', () => {
  assert.ok(Array.isArray(LEZEN.office) && LEZEN.office.length > 0, 'office is een AI-rol');
  assert.deepEqual(KLEIN.office, [], 'C2: geen kleine handeling voor het kantoor');
  assert.deepEqual(VOORSTEL.office, [], 'C2: geen voorstelrecht voor het kantoor');
});

test('2. de drie tonen-paden zijn lezen; wat mensen toont of iets zet blijft verboden', () => {
  for (const p of TONEN) assert.equal(beleidVoor(p, 'office').niveau, NIVEAUS.lezen, p);
  for (const p of NOOIT) assert.equal(beleidVoor(p, 'office').niveau, NIVEAUS.verboden, p + ' hoort niet aan het kantoorstuur');
  /* Andersom: de lijst is precies deze drie. Wie er een vierde bijzet, zet hem
     ook hier bij -- en moet dan de vraag van toets 2 beantwoorden. */
  const alle = LEZEN.office.map(re => re.source).sort();
  assert.equal(alle.length, TONEN.length, 'de tonen-lijst van het kantoor groeide zonder deze toets: ' + alle.join(' '));
});

const CODE = 'STUUR-KANTOOR';
const mappen = [];
let srv, gedeeld, eig, medewerker;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stuurkantoor-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  eig = await kantoorAlsPersoon(srv.base, CODE);
  /* Een gewone medewerker op naam, zonder boardroomtoegang: dezelfde weg als in
     productie (uitnodiging van de eigenaar, verzilverd op het eigen account). */
  const reg = (await api('/api/auth/register', { name: 'Stuur Kantoor', email: 'stuurkantoor' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  await api('/api/auth/me', {}, reg.token);
  await api('/api/account/koppel', await kantoorKoppelBody(srv.base, reg.token), reg.token);
  medewerker = (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  assert.ok(gedeeld && eig && medewerker, 'drie kantoorsessies');
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('3. de gedeelde code komt niet aan het stuur, en hoort de weg erheen', async () => {
  const r = await api('/api/office/doe', { pad: '/api/command/puls' }, gedeeld);
  assert.equal(r.status, 403, 'geen AI namens een gedeelde code');
  assert.equal(r.body.watNu, 'inloggen-op-naam');
  assert.equal((await api('/api/office/doe/kaart', {}, gedeeld)).status, 403, 'ook de kaart niet');
});

test('4. een mens op naam leest via het stuur; een schrijvende route wordt geweigerd', async () => {
  const kaart = await api('/api/office/doe/kaart', {}, eig);
  assert.equal(kaart.status, 200);
  assert.deepEqual([...kaart.body.paden].sort(), [...TONEN].sort(), 'de kaart is precies de tonen-lijst');
  const puls = await api('/api/office/doe', { pad: '/api/command/puls' }, eig);
  assert.equal(puls.status, 200);
  assert.equal(puls.body.status, 200, 'de puls komt door het stuur');
  const werelden = await api('/api/office/doe', { pad: '/api/office/economie/werelden' }, eig);
  assert.equal(werelden.body.status, 200, 'de eigenaar ziet de vier werelden');
  for (const p of ['/api/office/state', '/api/office/kosten/periode/sluit']) {
    const r = await api('/api/office/doe', { pad: p }, eig);
    assert.equal(r.status, 403, p + ': het stuur weigert, ook al mag de mens hem zelf');
  }
  const lus = await api('/api/office/doe', { pad: '/api/office/doe', body: { pad: '/api/command/puls' } }, eig);
  assert.equal(lus.status, 403, 'het stuur roept zichzelf niet aan');
});

test('5. de AI kan nooit meer dan de mens, en er is niets te bevestigen', async () => {
  const puls = await api('/api/office/doe', { pad: '/api/command/puls' }, medewerker);
  assert.equal(puls.body.status, 200, 'een medewerker op naam leest de puls');
  const werelden = await api('/api/office/doe', { pad: '/api/office/economie/werelden' }, medewerker);
  assert.equal(werelden.status, 200, 'het stuur zelf laat hem door');
  assert.equal(werelden.body.status, 403, 'maar de boardroomroute weigert: de AI leent geen gezag');
  const bevestig = await api('/api/office/doe/bevestig', { goedkeuringId: 'x', akkoord: true }, eig);
  assert.equal(bevestig.status, 404, 'er bestaat geen bevestigroute voor het kantoor');
});

test('6. twee keer vragen is twee keer lezen', async () => {
  const k1 = await api('/api/office/doe/kaart', {}, eig);
  const k2 = await api('/api/office/doe/kaart', {}, eig);
  assert.deepEqual(k2.body, k1.body, 'de kaart verandert niet door hem op te vragen');
  const a = await api('/api/office/doe', { pad: '/api/office/economie/werelden' }, eig);
  const b = await api('/api/office/doe', { pad: '/api/office/economie/werelden' }, eig);
  assert.equal(a.body.status, 200);
  assert.equal(b.body.status, 200);
  assert.deepEqual(b.body.antwoord, a.body.antwoord, 'een tweede lezing geeft hetzelfde antwoord');
});
