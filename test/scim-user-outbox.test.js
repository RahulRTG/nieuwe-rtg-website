'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

const S = require('../server/accounts/state');
const maakSync = require('../server/scim/user-sync');
const maakDeuren = require('../server/bedrijf/deuren');
const { MIGRATIES } = require('../server/migraties/lijst');

function antwoord() {
  return { code: 200, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test('SCIM-uitdienst zet account en outbox samen dicht en herstelt na herstart', () => {
  const oud = S.db;
  const db = new DatabaseSync(':memory:');
  S.db = db;
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, actief INTEGER NOT NULL)');
  db.prepare('INSERT INTO users (id, actief) VALUES (?, ?)').run(7, 1);
  maakSync.zorgTabel(db);

  const lid = { id: 'L1', token: 'lid-token', status: 'actief', rtgKey: 'user-7' };
  const accounts = {
    getUserById(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) || null; },
    zetActief(id, aan) {
      db.prepare('UPDATE users SET actief = ? WHERE id = ?').run(aan ? 1 : 0, Number(id));
      return this.getUserById(id);
    }
  };
  const scim = { lees: (_accounts, org, id) => {
    assert.equal(org, 'ORG');
    const u = accounts.getUserById(id);
    if (!u) throw new Error('onbekend');
    return u;
  } };
  let pogingen = 0;
  const cascade = () => {
    pogingen++;
    if (pogingen === 1) throw Object.assign(new Error('Werk OS opslag uit'), { status: 503 });
    lid.status = 'uit dienst'; lid.token = null;
    return { ok: true, geraakt: ['W1'] };
  };

  try {
    const eersteProces = maakSync({ accounts, scim, cascade, log: { error() {} }, klok: () => 1000 });
    assert.throws(() => eersteProces.zetActief('ORG', 7, false), /opslag uit/);
    assert.equal(accounts.getUserById(7).actief, 0);
    assert.equal(maakSync.geblokkeerd('user-7'), true, 'de liddeur is direct fail-closed');

    const W = () => ({ W1: { code: 'W1', leden: { L1: lid } } });
    const deur = maakDeuren({ kern: { accounts }, W, eigenVeld: (o, k) => o[k] }).lidVan;
    const res = antwoord();
    assert.equal(deur({ body: { werkruimte: 'W1', lidToken: 'lid-token' } }, res), null);
    assert.equal(res.code, 403);

    const naHerstart = maakSync({ accounts, scim, cascade, log: { error() {} }, klok: () => 7000 });
    assert.deepEqual(naHerstart.ronde(), { bekeken: 1, hersteld: 1 });
    assert.equal(maakSync.geblokkeerd('user-7'), false);
    assert.equal(lid.status, 'uit dienst');
    assert.equal(lid.token, null);
    assert.equal(pogingen, 2);

    /* Zelfs als een verouderde werkruimteprojectie het oude token nog zou
       tonen, blijft de centrale deur dicht op de accountwaarheid. */
    lid.status = 'actief'; lid.token = 'oud-token';
    const oudRes = antwoord();
    assert.equal(deur({ body: { werkruimte: 'W1', lidToken: 'oud-token' } }, oudRes), null);
    assert.equal(oudRes.code, 403);
  } finally {
    db.close();
    S.db = oud;
  }
});

test('SCIM-herstelmarkering heeft een nieuwe, herhaalbare migratie', () => {
  const stap = MIGRATIES.find(m => m.n === 8);
  assert.equal(stap && stap.naam, 'scim-intrekking-outbox');
});
