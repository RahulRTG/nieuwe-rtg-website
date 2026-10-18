/* EEN MISLUKTE SCIM-UITDIENST LAAT GEEN HALVE TRANSACTIE ACHTER
   (server/scim/user-sync.js, zetActief).

   De uitdienst schrijft accountstand en herstelopdracht in een BEGIN IMMEDIATE
   op S.db. Gaat het binnen die transactie mis -- het account komt niet terug,
   of de herstelopdracht valt niet te schrijven -- dan moet ALLES terug. De
   oude code vroeg `db.inTransaction`, een eigenschap van better-sqlite3 die
   node:sqlite niet kent (daar heet hij isTransaction): de voorwaarde was
   altijd onwaar en de ROLLBACK draaide nooit. Gevolg: de halve schrijving
   bleef open staan, elke volgende BEGIN faalde ("cannot start a transaction
   within a transaction"), en SCIM-uitdienst en herstelronde lagen stil tot een
   herstart -- of een latere COMMIT legde de halve staat vast.

   Wat hier niet mag sneuvelen:
   1. faalt het binnen de transactie, dan is de transactie daarna dicht en staat
      de accountstand weer zoals hij was;
   2. er blijft geen herstelopdracht half staan;
   3. de volgende uitdienst gewoon werkt (geen vastgelopen verbinding).

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `db.isTransaction` terug naar `db.inTransaction` (de oude fout)
     -> "1." en "2." ZAKKEN (RAAK): de transactie staat nog open
   - de regel `try { db.exec('ROLLBACK'); } catch (_) {}` weggehaald
     -> "1." en "2." ZAKKEN (RAAK)

   Draai: node --test test/scim-terugdraai.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

const S = require('../server/accounts/state');
const maakSync = require('../server/scim/user-sync');

function opzet() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, actief INTEGER NOT NULL)');
  db.prepare('INSERT INTO users (id, actief) VALUES (?, ?)').run(7, 1);
  maakSync.zorgTabel(db);
  const lees = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) || null;
  const stand = { kapot: 'geen' };
  const accounts = {
    getUserById: lees,
    zetActief(id, aan) {
      db.prepare('UPDATE users SET actief = ? WHERE id = ?').run(aan ? 1 : 0, Number(id));
      return stand.kapot === 'account' ? null : lees(id);
    }
  };
  const scim = { lees: (_a, org, id) => lees(id) };
  const opdrachten = () => db.prepare('SELECT COUNT(*) AS n FROM scim_user_deprovision').get().n;
  return { db, lees, stand, accounts, scim, opdrachten };
}

function metDb(db, fn) {
  const oud = S.db;
  S.db = db;
  try { return fn(); } finally { S.db = oud; db.close(); }
}

test('1. komt het account niet terug, dan gaat de hele transactie terug', () => {
  const o = opzet();
  metDb(o.db, () => {
    o.stand.kapot = 'account';
    const sync = maakSync({ accounts: o.accounts, scim: o.scim, cascade: () => ({ ok: true }), log: { error() {} }, klok: () => 1000 });
    assert.throws(() => sync.zetActief('ORG', 7, false), /kon niet worden bijgewerkt/);
    assert.equal(o.db.isTransaction, false, 'de transactie is dicht');
    assert.equal(o.lees(7).actief, 1, 'de halve schrijving (actief=0) is teruggedraaid');
    assert.equal(o.opdrachten(), 0);

    /* 3. de verbinding is niet vastgelopen: de volgende uitdienst werkt. */
    o.stand.kapot = 'geen';
    sync.zetActief('ORG', 7, false);
    assert.equal(o.lees(7).actief, 0);
    assert.equal(o.opdrachten(), 0, 'de cascade slaagde, dus de opdracht is afgehandeld');
  });
});

test('2. valt de herstelopdracht niet te schrijven, dan gaat de accountstand ook terug', () => {
  const o = opzet();
  metDb(o.db, () => {
    const sync = maakSync({ accounts: o.accounts, scim: o.scim, cascade: () => ({ ok: true }), log: { error() {} }, klok: () => 1000 });
    /* Na de tabelcontrole van maakSync: een herstelopdracht schrijven kan nu
       niet meer, terwijl de accountstand al binnen de transactie gezet is. */
    o.db.exec('DROP TABLE scim_user_deprovision');
    assert.throws(() => sync.zetActief('ORG', 7, false), /no such table/);
    assert.equal(o.db.isTransaction, false, 'de transactie is dicht');
    assert.equal(o.lees(7).actief, 1, 'geen account dicht zonder herstelopdracht');
  });
});
