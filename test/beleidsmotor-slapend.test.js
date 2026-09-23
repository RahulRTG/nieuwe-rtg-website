/* SLAPENDE RECHTEN (AUTHORITY.md fase 8, besluit van 23 september 2026).

   Vier dingen die niet mogen sneuvelen:
   1. er wordt per zetel EEN datum bewaard -- geen tijdstip, geen route, geen
      aantal -- en twee keer op een dag is een schrijfactie, niet twee;
   2. een datum ouder dan 90 dagen wordt gewist;
   3. een zetel zonder datum heet pas `slapend: ja` als de meting zelf 90 dagen
      loopt; daarvoor `onbekend`;
   4. lezen projecteert de buffer en schrijft niets.

   Draai los: node --test test/beleidsmotor-slapend.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSlapend } = require('../server/kern/beleidsmotor/slapend');

const DAG = 86400000;
function opstelling(start) {
  let t = start;
  let opslag = {};
  let schrijf = 0;
  const s = maakSlapend({ bak: () => opslag, kijk: () => opslag, save: () => {},
    bewerkCollectie: (naam, fn) => { assert.equal(naam, 'zetelGebruik'); schrijf += 1; fn(opslag); },
    nu: () => t });
  return { s, zet: (x) => { t = x; }, opslag: () => opslag, schrijf: () => schrijf };
}

test('1. een datum per zetel, en een dag is een schrijfactie', () => {
  const o = opstelling(Date.parse('2026-09-23T09:00:00Z'));
  o.s.noteer('user-7', 'boardroom');
  o.s.noteer('user-7', 'boardroom');
  o.s.spoel();
  o.s.noteer('user-7', 'boardroom');
  assert.equal(o.s.spoel(), false, 'dezelfde dag nog eens is niets nieuws');
  assert.equal(o.schrijf(), 1);
  assert.deepEqual(o.opslag(), { _meetSinds: '2026-09-23', 'user-7|boardroom': '2026-09-23' },
    'alleen een datum per zetel, en het begin van de meting');
  o.s.noteer('user-7', 'verzonnen');
  o.s.noteer('', 'boardroom');
  assert.equal(o.s.spoel(), false, 'een onbekende zetel of een lege sleutel wordt niet genoteerd');
});

test('2-3. na 90 dagen wist de datum, en pas dan heet een zetel slapend', () => {
  const start = Date.parse('2026-01-01T09:00:00Z');
  const o = opstelling(start);
  o.s.noteer('user-7', 'balie');
  o.s.spoel();
  assert.deepEqual(o.s.laatst('user-7', 'balie'), { laatstGebruikt: '2026-01-01', slapend: 'nee' });
  assert.equal(o.s.laatst('user-8', 'balie').slapend, 'onbekend', 'de meting loopt nog geen 90 dagen');

  o.zet(start + 91 * DAG);
  o.s.noteer('user-9', 'kantoorrol');
  o.s.spoel();
  assert.equal(o.opslag()['user-7|balie'], undefined, 'een datum ouder dan 90 dagen is gewist');
  assert.deepEqual(o.s.laatst('user-7', 'balie'), { laatstGebruikt: null, slapend: 'ja' });
  assert.equal(o.s.laatst('user-9', 'kantoorrol').slapend, 'nee');
});

test('4. lezen projecteert de buffer en schrijft niets', () => {
  const o = opstelling(Date.parse('2026-09-23T09:00:00Z'));
  o.s.noteer('user-3', 'kantoorrol');
  assert.equal(o.s.laatst('user-3', 'kantoorrol').laatstGebruikt, '2026-09-23', 'wat nog in de buffer zit telt mee');
  assert.equal(o.schrijf(), 0, 'en lezen heeft niets weggeschreven');
});
