/* DE CADEAUBON VAN RTG -- server/kern/cadeaubon.js en het vermogen RTG_CADEAUBON
   in server/kern/bevoegdheid/lijst-afhankelijk.js (besluit C14).

   Een bon die RTG verkoopt en die ook bij de zaken te besteden is, is
   elektronisch geld. Vijf beweringen, en alle vijf kunnen ze zakken:
   1. zonder vastgelegde stand is hij DICHT, en dicht betekent: deze handeling
      bestaat niet, met de reden -- niet "er ontbreekt een vergunning";
   2. open zonder e-geldvergunning weigert NOG STEEDS, en zegt welke vergunning;
   3. de verplichting komt uit het register van de bon, en de bankpositie leest
      haar daar in plaats van een eigen nul;
   4. omzetten is boardroomwerk op naam, en de gedeelde kantoorcode krijgt hem niet;
   5. de uitgifte zelf is met opzet niet gebouwd, en dat staat in het antwoord.

   Draai: node --test test/cadeaubon.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { maakBevoegdheid } = require('../server/kern/bevoegdheid');

const bevoegd = (stand, clearing = { eigen: true }) => maakBevoegdheid({ vergunning: () => null, partnerRails: () => ({ sepa: true, rekeningen: true }),
  clearing: () => clearing, standen: stand ? { cadeaubon: () => stand } : {} });

test('1. zonder stand dicht, en dicht is een keuze met een reden', () => {
  const k = require('../server/kern/cadeaubon')({ db: { data: {} }, save: () => {} });
  assert.equal(k.cadeaubonStand(), 'gesloten');
  const m = bevoegd(null).mag('RTG_CADEAUBON');
  assert.equal(m.mag, false);
  assert.equal(m.reden, 'stand', 'geen vergunningsvraag maar een keuze');
  assert.match(m.uitleg, /elektronisch geld/);
});

test('2. open zonder e-geldvergunning weigert nog steeds, en zegt welke', () => {
  const m = bevoegd('open').mag('RTG_CADEAUBON');
  assert.equal(m.mag, false);
  assert.equal(m.nodig, 'elektronischgeldinstelling');
  /* ook als alleen een partner clearet en al zijn rails draaien: een partner geeft geen e-geld voor ons uit */
  const pr = bevoegd('open', { kaart: true }).mag('RTG_CADEAUBON');
  assert.equal(pr.mag, false, 'een partnerrail geeft geen e-geld voor ons uit (TOKEN.md par. 7)');
});

test('3. de verplichting komt uit het register en de bankpositie leest haar daar', () => {
  const db = { data: {} };
  const k = require('../server/kern/cadeaubon')({ db, save: () => {} });
  assert.equal(k.cadeaubonVerplichting().centen, 0);
  assert.match(k.cadeaubonVerplichting().reden, /elektronisch geld/);
  const bank = require('../server/kern/bankpositie')({ db, save: () => {}, nu: () => '2026-09-28T10:00:00Z', bonnen: k.cadeaubonVerplichting });
  bank.bankpositieZet({ maand: '2026-09', centen: 100000, peildatum: '2026-09-27', bron: 'afschrift', wie: 'x' });
  /* een bon in het register (zoals een toekomstige uitgifte hem zou schrijven) haalt het vrije geld omlaag */
  db.data.rtgCadeaubon = { bonnen: [{ centen: 2500, open: true }, { centen: 900, open: false }] };
  const s = bank.bankpositie('2026-09');
  assert.equal(s.bonnenVerplichting.centen, 2500);
  assert.equal(s.vrij.centen, 97500);
});

test('4 en 5 in de kern: op naam, en dezelfde stand nog eens verandert niets', () => {
  const k = require('../server/kern/cadeaubon')({ db: { data: {} }, save: () => {}, nu: () => '2026-09-28T10:00:00Z' });
  assert.equal(k.cadeaubonStandZet({ stand: 'open', wie: null }).status, 403);
  assert.equal(k.cadeaubonStandZet({ stand: 'half', wie: 'e' }).status, 400);
  assert.equal(k.cadeaubonStandZet({ stand: 'open', wie: 'eigenaar' }).ok, true);
  assert.equal(k.cadeaubonStandZet({ stand: 'open', wie: 'eigenaar' }).ongewijzigd, true);
  assert.deepEqual(k.cadeaubonBeeld().nietGebouwd, ['verkopen', 'inwisselen bij een zaak', 'afrekenen met die zaak']);
});

/* ---------------- de routes ---------------- */
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cadeaubon-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('6. de routes: de boardroom leest, en omzetten laat de vergunningsvraag staan', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  assert.equal((await api('/api/office/cadeaubon', {})).status, 401);
  const d = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body;
  const eig = d.token;
  const l = await api('/api/office/cadeaubon', {}, eig);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.equal(l.body.stand, 'gesloten');
  assert.equal(l.body.uitgifte.mag, false);
  assert.equal(l.body.uitgifte.reden, 'stand');
  const z = await api('/api/office/cadeaubon/stand', { stand: 'open' }, eig);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  assert.equal(z.body.stand, 'open');
  assert.equal(z.body.uitgifte.mag, false, 'open zonder vergunning geeft nog steeds geen e-geld uit');
  assert.equal(z.body.uitgifte.nodig, 'elektronischgeldinstelling');
  const gedeeld = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const kantoor = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.notEqual((await api('/api/office/cadeaubon/stand', { stand: 'gesloten' }, kantoor)).status, 200,
    'de gedeelde kantoorcode zet de juridische positie niet om');
  assert.ok(gedeeld);
  const b = await api('/api/office/bankpositie', {}, eig);
  assert.match(b.body.bonnenVerplichting.reden, /elektronisch geld/, 'de bankpositie leest de bon');
});
