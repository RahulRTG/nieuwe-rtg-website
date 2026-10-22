'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
test('de interne festivalcollectiepoort wordt niet als kern-API uitgevoerd', () => {
  const festival = require('../server/kern/festival')({ db: { data: {} }, save() {}, crypto, schoon: x => x });
  assert.equal(Object.hasOwn(festival, 'festivalCollectieLezen'), false);
  assert.equal(typeof festival.festivalNieuw, 'function');
});
test('festival-eigenaar leest zonder initialisatie en weigert een corrupte wortel', () => {
  const db = { data: {} };
  const model = require('../server/kern/festival/model')({ db, save() {}, crypto, schoon: x => x });
  assert.deepEqual(model.festivalCollectieLezen(), {});
  assert.deepEqual(db.data, {});
  db.data.festivals = { feest: { id: 'feest' } };
  assert.equal(model.festivalCollectieLezen().feest.id, 'feest');
  db.data.festivals = [];
  assert.throws(() => model.festivalCollectieLezen(), /vorm/);
  assert.deepEqual(db.data.festivals, []);
});
test('Clips-lezers gebruiken eigenaar voor makers, muziek en volgers', () => {
  const db = { data: { clips: [
    { id: 'a', key: 'maker', at: '2026-01-01', muziek: { id: 'track' } },
    { id: 'b', key: 'maker', at: '2026-01-02' },
    { id: 'c', key: 'ander', at: '2026-01-03' }
  ], clipsVolg: { kijker: ['maker'], ander: [] } } };
  const eigen = require('../server/kern/eigencollectie')({ db, domein: 'kern/clips', bezit: { clips: 'lijst', clipsVolg: 'kaart' } });
  const lezers = require('../server/kern/clips-lezers')({ eigen, lijsten() {}, beeld: (c, kijker) => ({ id: c.id, kijker }) });
  assert.deepEqual(lezers.clipsVan('maker', 'kijker').map(c => c.id), ['b', 'a']);
  assert.deepEqual(lezers.clipsMetTrack('track', 'kijker'), [{ id: 'a', kijker: 'kijker' }]);
  assert.deepEqual(lezers.clipsVolgersVan('maker'), ['kijker']);
  // Alleen het leescontract: de volledige Clips-fabriek heeft eigen initialisatie.
  db.data.clipsVolg = [];
  assert.throws(() => lezers.clipsVolgersVan('maker'), /vorm/);
});
