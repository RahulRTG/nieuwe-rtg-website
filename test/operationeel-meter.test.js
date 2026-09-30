'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { beoordeel } = require('../scripts/lib/operationeel/beoordeel');
const { DIMENSIES } = require('../scripts/lib/operationeel/register');
function goed() {
  return { run: 'nu', bron: 'deze-bron', catalogus: [{ id: 'functie' }],
    ketens: [{ id: 'keten', vereist: Object.fromEntries(DIMENSIES.map(d => [d, ['proef']])) }],
    contracten: [{ functie: 'functie', volledig: true, ketens: ['keten'] }],
    proeven: { proef: 'test.js', 'installatie-inventaris': 'breed.js' }, uitgevoerd: { 'test.js': true, 'breed.js': true },
    journal: [{ proef: 'proef', run: 'nu', bron: 'deze-bron', dimensies: [...DIMENSIES] },
      { proef: 'installatie-inventaris', run: 'nu', bron: 'deze-bron', dimensies: ['PROOF', 'DEGRADED'], bereik: ['functie'],
        modi: ['PAYMENTS OFF', 'AI OFF', 'PUSH OFF'], controles: { 'Orphan actions': 0, 'Dead-end CTAs': 0,
          'Ownerless requests': 0, 'False confirmations': 0, 'Hidden payment dependencies': 0 } }] };
}
test('alle schakels en de complete V1-inventaris zijn nodig, nooit een gemiddelde', () => {
  assert.equal(beoordeel(goed()).status, 'PROVEN');
  for (const d of DIMENSIES) {
    const input = goed(); input.journal[0].dimensies = DIMENSIES.filter(x => x !== d);
    const r = beoordeel(input); assert.equal(r.status, 'NOT_PROVEN', d);
    assert.deepEqual(r.journeys[0].ontbreekt, [d]);
  }
});
test('ontbrekend, overgeslagen, oud, dubbel of mislukt bewijs kan nooit groen zijn', () => {
  for (const verander of [x => { x.journal = []; }, x => { x.uitgevoerd['test.js'] = false; },
    x => { delete x.uitgevoerd['test.js']; }, x => { x.journal[0].run = 'oud'; },
    x => { x.journal[0].bron = 'oude-code'; }, x => { x.journal.push(x.journal[0]); },
    x => { x.ketens[0].vereist.HANDOFF = []; }, x => { x.catalogus.push({ id: 'onbekend' }); },
    x => { x.contracten[0].volledig = false; }, x => { x.journal[1].bereik = []; },
    x => { x.journal[1].modi = ['PAYMENTS OFF']; }, x => { x.journal[1].controles['Ownerless requests'] = 1; }]) {
    const input = goed(); verander(input); assert.equal(beoordeel(input).status, 'NOT_PROVEN');
  }
});
test('lege inventaris bewijst niets; onbekende koppeling is een fout; niet gemeten is geen nul', () => {
  const input = goed(); input.catalogus = []; input.ketens = []; input.contracten = [];
  assert.equal(beoordeel(input).status, 'NOT_PROVEN');
  const onbekend = goed(); onbekend.contracten[0].functie = 'verdwenen';
  assert.throws(() => beoordeel(onbekend), /Ongeldige/);
  const zonder = goed(); zonder.journal.pop();
  assert.equal(beoordeel(zonder).controles['Orphan actions'], null);
});
