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
