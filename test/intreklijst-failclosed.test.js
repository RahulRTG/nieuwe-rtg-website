/* De generieke tokenintreklijst: opslagonzekerheid is nooit hetzelfde als
   "niet ingetrokken", en een geslaagde intrekking seint levende verbindingen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const migraties = require('../server/migraties');
const S = require('../server/accounts/state');
const signaal = require('../server/kern/intreksignaal');

const oudeZin = S.zin;
const oudeSecret = S.SECRET;
const oudeDb = S.db;
const token = () => Buffer.from('7.' + (Date.now() + 60000) + '.1.abcdefghijkl').toString('base64url') +
  '.' + 'a'.repeat(32);

test.beforeEach(() => {
  signaal._wis();
  S.SECRET = Buffer.alloc(32, 7);
});
test.afterEach(() => {
  S.zin = oudeZin;
  S.SECRET = oudeSecret;
  S.db = oudeDb;
  signaal._wis();
});

test('intrekking en pending-outbox zijn één lokale transactie', async () => {
  const db = new DatabaseSync(':memory:');
  migraties.draai(db); S.db = db;
  const lijst = require('../server/accounts/intreklijst')(x => x);
  const t = token();
  await lijst.trekIn(t);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ingetrokken_tokens').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM intrekking_outbox').get().n, 1);

  db.exec("CREATE TRIGGER breek_outbox BEFORE INSERT ON intrekking_outbox BEGIN SELECT RAISE(ABORT, 'uitgelokte outboxfout'); END");
  const ander = Buffer.from('8.' + (Date.now() + 60000) + '.1.bcdefghijklm').toString('base64url') + '.' + 'b'.repeat(32);
  await assert.rejects(lijst.trekIn(ander), /uitgelokte outboxfout/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ingetrokken_tokens').get().n, 1,
    'zonder outbox is ook de tweede lokale intrekking teruggedraaid');
  db.close(); S.db = oudeDb;
});

test('een leesfout wordt niet vertaald naar "niet ingetrokken"', () => {
  S.zin = () => { throw new Error('intreklijst niet leesbaar'); };
  const lijst = require('../server/accounts/intreklijst')(x => x);
  assert.throws(() => lijst.isIngetrokken(token()), e =>
    e && e.code === 'INTREKOPSLAG_ONZEKER');
  assert.throws(() => lijst.sessieIngetrokken('abcdefghijkl'), e =>
    e && e.code === 'INTREKOPSLAG_ONZEKER');

  /* De gevel vangt de fout en geeft nooit een gebruiker terug. Dit is de deur
     waar gewone HTTP-verzoeken werkelijk doorheen gaan. */
  const tokens = require('../server/accounts/tokens').maakTokens(() => ({ id: 7, actief: 1 }));
  const echt = tokens.issueToken(7);
  assert.equal(tokens.verifyToken(echt), null,
    'onzekere intrekopslag moet als ongeldige credential eindigen');
});

test('een schrijffout geeft geen vals intrekkingssucces en zendt geen signaal', async () => {
  S.zin = () => { throw new Error('intreklijst niet schrijfbaar'); };
  const gezien = [];
  signaal.abonneer(e => gezien.push(e));
  const lijst = require('../server/accounts/intreklijst')(x => x);
  await assert.rejects(lijst.trekIn(token()), e =>
    e && e.code === 'INTREKOPSLAG_ONZEKER');
  assert.deepEqual(gezien, [], 'zonder duurzame intrekking mag geen succes-signaal vertrekken');
});

test('een duurzame token- en sid-intrekking worden lokaal synchroon gemeld', async () => {
  S.zin = () => ({ run() { return {}; }, get() { return null; } });
  const gezien = [];
  signaal.abonneer(e => gezien.push(e));
  const lijst = require('../server/accounts/intreklijst')(x => x);
  const t = token();
  assert.equal(await lijst.trekIn(t), true);
  assert.equal(await lijst.trekInSessie('abcdefghijkl', Date.now() + 60000), true);
  assert.deepEqual(gezien, [
    { soort: 'token', waarde: signaal.vingerVanToken(t) },
    { soort: 'sessie', waarde: 'abcdefghijkl' }
  ]);
});

test('een geconfigureerde maar onzekere Redis-leiding laat geen token door', () => {
  const oud = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://niet-gereed';
  S.zin = () => ({ get() { return null; } });
  try {
    const lijst = require('../server/accounts/intreklijst')(x => x);
    assert.throws(() => lijst.isIngetrokken(token()), e =>
      e && e.code === 'INTREKOPSLAG_ONZEKER');
  } finally {
    if (oud === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oud;
  }
});
