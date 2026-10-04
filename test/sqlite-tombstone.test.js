'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('SQLite-poll laat een vuile lokale kopie nooit over een nieuwere tombstone winnen', () => {
  const db = { data: { toestemming: { actief: true, lokaal: 'onbevestigd' } } };
  const toegepast = new Map([['toestemming', 4]]);
  const laatsteJson = new Map([['toestemming', JSON.stringify({ actief: true })]]);
  const vergeten = [];
  const poll = require('../server/db/sqlite-poll')({
    // Eén snapshot uit SQLite: de externe rijen plus (hier geen) auditjournalen.
    lees: () => ({ rows: [{ key: 'toestemming', val: null, ver: 5, deleted: 1 }], audit: [] }),
    publiceerAudit: () => {},
    toegepast,
    laatsteJson,
    db,
    uitStore: String,
    merge3: () => { throw new Error('een tombstone mag niet worden gemerged'); },
    voorcheck: { vergeet: () => {} },
    mutaties: {
      snapshot: () => [{ collectie: 'toestemming', generatie: 9 }],
      vergeet: k => vergeten.push(k)
    },
    externCb: () => null
  });

  poll();

  assert.equal(Object.prototype.hasOwnProperty.call(db.data, 'toestemming'), false);
  assert.equal(laatsteJson.has('toestemming'), false);
  assert.equal(toegepast.get('toestemming'), 5);
  assert.deepEqual(vergeten, ['toestemming']);
});

test('de snapshotlezer draagt een tombstone mee en slaat al toegepaste versies over', () => {
  const { externeCollecties } = require('../server/db/sqlite-poll');
  const log = [];
  const kvdb = { exec: q => log.push(q) };
  const rijen = { weg: { val: null, ver: 7, deleted: 1 }, oud: { val: 'x', ver: 3, deleted: 0 } };
  const statements = {
    versies: { all: () => [{ key: 'weg', ver: 7 }, { key: 'oud', ver: 3 }] },
    lees: { get: k => rijen[k] }
  };
  const uit = externeCollecties(kvdb, statements, new Map([['oud', 3]]), () => ['audit']);
  assert.deepEqual(uit, { rows: [{ key: 'weg', val: null, ver: 7, deleted: 1 }], audit: ['audit'] });
  assert.deepEqual(log, ['BEGIN', 'COMMIT'], 'versies, payloads en audit komen uit één leestransactie');
});

test('een leesfout in de snapshot rolt terug en publiceert niets', () => {
  const { snapshot } = require('../server/db/sqlite-poll');
  const log = [];
  assert.throws(() => snapshot({ exec: q => log.push(q) }, () => { throw new Error('stuk'); }), /stuk/);
  assert.deepEqual(log, ['BEGIN', 'ROLLBACK']);
});
