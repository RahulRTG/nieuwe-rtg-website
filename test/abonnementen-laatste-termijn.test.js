'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { termijn, tussen } = require('../server/kern/commercie/contract/abonnement');
function contract(extra = {}) {
  return { id: 'contract-1', automatischAbonnement: true, startAt: '2025-01-01T10:00:00.000Z',
    verrekening: { creditCenten: 0 }, aanbod: { frequentie: 'maand', voorwaarden: { jaarVervolg: 'maand', laatsteMaandNaarRato: true },
      prijs: { maand: { brutoCenten: 31000 }, jaar: { brutoCenten: 356500 }, btwProfiel: 'nl-21' } }, ...extra };
}
test('opzegging op de maandgrens verandert geen eerder of laatste volledig bedrag', () => {
  const c = contract({ eindigtOp: '2026-01-01T10:00:00.000Z' });
  const r = tussen(c, c.startAt, '2027-01-01T10:00:00.000Z');
  assert.equal(r.length, 12); assert.ok(r.every(t => t.brutoCenten === 31000));
  assert.equal(r.at(-1).tot, c.eindigtOp);
});
test('laatste maand na de minimumtermijn rekent alleen de werkelijke resterende periode', () => {
  const c = contract({ eindigtOp: '2026-01-16T10:00:00.000Z' });
  const r = termijn(c, 13);
  assert.equal(r.van, '2026-01-01T10:00:00.000Z'); assert.equal(r.tot, c.eindigtOp);
  assert.equal(r.brutoCenten, 15000); assert.equal(r.origineelBrutoCenten, 15000);
  assert.equal(r.opbouw.nettoCenten + r.opbouw.btwCenten, 15000);
  assert.equal(tussen(c, c.startAt, '2027-01-01T10:00:00.000Z').length, 13);
});
test('restcredit vermindert de verkorte laatste verplichting; geen nieuw credit of negatieve factuur', () => {
  const c = contract({ eindigtOp: '2026-01-16T10:00:00.000Z', verrekening: { creditCenten: 385000 } });
  const r = termijn(c, 13);
  assert.equal(r.creditCenten, 13000); assert.equal(r.brutoCenten, 2000);
  c.verrekening.creditCenten = 400000;
  assert.equal(termijn(c, 13).creditCenten, 15000); assert.equal(termijn(c, 13).brutoCenten, 0);
});
test('jaarvooruitbetaling blijft volledig; de verkorte vervolgmaand gebruikt de afgesproken maandprijs', () => {
  const c = contract({ eindigtOp: '2026-01-16T10:00:00.000Z' }); c.aanbod.frequentie = 'jaar';
  assert.equal(termijn(c, 1).brutoCenten, 356500);
  assert.equal(termijn(c, 2).brutoCenten, 15000); assert.equal(termijn(c, 2).tot, c.eindigtOp);
});
test('een oudere getekende afspraak zonder pro-rata beleid wordt niet stil herprijsd', () => {
  const c = contract({ eindigtOp: '2026-01-16T10:00:00.000Z' });
  delete c.aanbod.voorwaarden.laatsteMaandNaarRato;
  assert.equal(termijn(c, 13).brutoCenten, 31000);
});
