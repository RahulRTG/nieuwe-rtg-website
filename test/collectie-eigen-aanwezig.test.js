'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
test('eigencollectie: aanwezigheid maakt niets aan en omzeilt vorm of eigenaar niet', () => {
  const db = { data: {} };
  const eigen = require('../server/kern/eigencollectie')({ db, domein: 'proef', bezit: { ontvangsten: 'kaart' } });
  assert.equal(eigen.bestaat('ontvangsten'), false);
  assert.deepEqual(eigen.kijk('ontvangsten'), {});
  assert.deepEqual(db.data, {});
  db.data.ontvangsten = {};
  assert.equal(eigen.bestaat('ontvangsten'), true);
  db.data.ontvangsten = [];
  assert.equal(eigen.bestaat('ontvangsten'), true);
  assert.throws(() => eigen.kijk('ontvangsten'), /vorm/);
  assert.throws(() => eigen.bestaat('vreemd'), /niet/);
  for (const naam of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    const voor = structuredClone(db.data);
    for (const toegang of ['bestaat', 'kijk', 'bak', 'zetBak']) {
      assert.throws(() => eigen[toegang](naam, {}), /niet/, toegang + ': alleen expliciet bezit');
      assert.deepEqual(db.data, voor);
    }
  }
});
test('werkplektaak leest bezetting zonder aanmaken, corrupte kaart faalt gesloten', async () => {
  const db = { data: {}, writable: true }, crypto = require('node:crypto');
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'memory', db, save() {} });
  const w = require('../server/kern/werkplek')({ db, save() {}, bewerkCollectie, crypto }).werkplek;
  assert.equal((await w.taakMaakBedoeling('rtg', 'a', { tekst: 'Taak', idem: '1' })).ok, true);
  assert.equal(Object.hasOwn(db.data, 'werkplekMensen'), false);
  db.data.werkplekMensen = [];
  await assert.rejects(w.taakMaakBedoeling('rtg', 'a', { tekst: 'Taak', idem: '2' }), /vorm/);
  assert.equal(db.data.werkplekTaken.rtg.length, 1);
});
