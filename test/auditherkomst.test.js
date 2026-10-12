'use strict';
/* Audit P2-7: een auditregel draagt het verzoek-id en de release waarmee hij
   geschreven is, BINNEN de hash -- in het handelingsspoor, het
   command-journaal (en dus het API-spoor) en het inzagejournaal. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const keten = require('../server/lib/keten');
const release = require('../server/lib/releaseidentiteit');

const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
test.before(() => { process.env.RTG_RELEASE_COMMIT = COMMIT; release.release({ vers: true }); });
test.after(() => { delete process.env.RTG_RELEASE_COMMIT; release.release({ vers: true }); });

test('handelingsspoor: verzoek en release staan in de regel en onder de hash', () => {
  const db = { data: {} };
  const spoor = require('../server/lib/handelingsspoor')({ db, save() {} });
  spoor.noteer({ wie: 'user-1', methode: 'POST', pad: '/api/x', status: 200, verzoek: 'abc123' });
  const r = db.data.handelingLog[0];
  assert.equal(r.verzoek, 'abc123'); assert.equal(r.release, COMMIT);
  assert.equal(keten.verifieer(db.data.handelingLog).ok, true);
  db.data.handelingLog[0] = { ...r, verzoek: 'ander' };
  assert.equal(keten.verifieer(db.data.handelingLog).ok, false, 'het verzoek-id is gedekt door de hash');
  /* De regel van een vroege commit (db/verzoekspoor.js) heeft dezelfde vorm. */
  const v = spoor.regelVoorVroegeCommit({ method: 'POST', path: '/api/pay/kascode', id: 'req9', body: {} }, ['payKasToegang']);
  assert.equal(v.stand, 'vastgelegd'); assert.equal(v.verzoek, 'req9'); assert.equal(v.collecties, 'payKasToegang');
  assert.equal(v.release, COMMIT);
});

test('command-journaal: verzoek en release onder de zegel', () => {
  const vak = {};
  const j = require('../server/kern/command/journaal').maakJournaal({ db: { data: {} }, save() {}, crypto, vak: () => vak });
  const r = j.noteer({ actor: 'a', actie: 'POST /api/x', verzoek: 'req1' });
  assert.equal(r.verzoek, 'req1'); assert.equal(r.release, COMMIT);
  assert.equal(j.controleer().heel, true);
  vak.commandJournaal[0].verzoek = 'vervalst';
  assert.equal(j.controleer().heel, false);
});

test('zonder bekende release staat er niets -- nooit een verzonnen versie', () => {
  assert.equal(release.release({ env: {}, root: '/bestaat/niet', vers: true }), null);
  release.release({ vers: true });
});
