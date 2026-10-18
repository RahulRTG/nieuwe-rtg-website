/* SCIM UIT DIENST -- de intrekking blijft staan tot Werk OS haar heeft bevestigd.

   server/scim/user-sync.js zet het RTG-account en een herstelopdracht in EEN
   SQLite-transactie dicht en probeert daarna de Werk OS-cascade. Lukt die niet,
   dan blijft de opdracht staan en houdt de liddeur (geblokkeerd) het gekoppelde
   token dicht tot een herstelronde de cascade heeft bevestigd. Deze toets draait
   op een echte accounts-database en een injecteerbare klok.

   Wat hier niet mag sneuvelen:
   1. Faalt de cascade, dan staat het account uit, blijft de persoon geblokkeerd,
      en wacht de herstelronde netjes zijn terugval af (geen hamerende lus).
   2. Faalt ook het foutspoor, dan komt toch de oorspronkelijke fout terug en
      blijft de blokkade staan; de beheerder ziet het in het logboek.
   3. Weer aanzetten haalt de opdracht weg; een herstelronde voor iemand die
      inmiddels weer aan staat sluit de opdracht zonder cascade.
   4. Een vreemde organisatie zet via de sync niets uit en start geen cascade.
   5. Zonder intrekkingswaarheid weigert productie (fail-closed); een
      accountwerkkopie die open staat laat de ronde wachten.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - user-sync.js fout(): `next_at = ?` krijgt `nu` i.p.v. `nu + wacht` -> toets 1 zakt.
   - user-sync.js geblokkeerd(): de catch geeft `false` ook in productie -> toets 5 zakt.
   - user-sync.js zetActief(): `scim.lees(...)` vervangen door
     `accounts.getUserById(Number(id))` -> toets 4 zakt.

   Draai los: node --test test/scim-uitdienst-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scimuit-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const scim = require('../server/scim');
const koppelingen = require('../server/sso/koppelingen');
const maakSync = require('../server/scim/user-sync');
const transactie = require('../server/accounts/transactie');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let nu = 1000000;
let cascadeGedrag = () => ({ ok: true, geraakt: [] });
const cascades = [];
const logs = [];
const log = { error: (m, d) => logs.push([m, d]) };
const sync = maakSync({ accounts, scim, log, klok: () => nu,
  cascade: (org, u) => { cascades.push([org, u.id]); return cascadeGedrag(org, u); } });
const rij = (id) => S.db.prepare('SELECT * FROM scim_user_deprovision WHERE user_id = ?').get(String(id));
const nieuw = async (naam) => (await scim.maak(accounts, 'org-u', { userName: naam + '@uit.test' })).user;

test.before(() => {
  koppelingen.zet({ org: 'org-u', issuer: 'https://idp.uit.test', clientId: 'c', domeinen: 'uit.test' });
});

test('1. faalt de cascade, dan blijft de blokkade en wacht de ronde zijn terugval af', async () => {
  const u = await nieuw('anna');
  cascadeGedrag = () => { throw new Error('Werk OS weg'); };
  assert.throws(() => sync.zetActief('org-u', u.id, false), /Werk OS weg/);
  assert.equal(accounts.getUserById(u.id).actief, 0, 'het account staat al uit');
  assert.equal(maakSync.geblokkeerd('user-' + u.id), true);
  assert.equal(rij(u.id).next_at, nu + 5000);

  nu += 5001;
  assert.deepEqual(sync.ronde(), { bekeken: 1, hersteld: 0 });
  const r = rij(u.id);
  assert.equal(r.attempts, 2);
  assert.equal(r.next_at, nu + 5000 * 4, 'exponentiele terugval');
  assert.equal(r.claim_token, null, 'de claim is vrijgegeven');
  assert.match(r.last_error, /Werk OS weg/);
  assert.ok(logs.some(([m]) => /herstel mislukt/.test(m)));
  assert.deepEqual(sync.ronde(), { bekeken: 0, hersteld: 0 }, 'binnen de terugval geen nieuwe poging');

  cascadeGedrag = () => ({ ok: true, geraakt: ['W1'] });
  nu += 20001;
  assert.deepEqual(sync.ronde(), { bekeken: 1, hersteld: 1 });
  assert.equal(maakSync.geblokkeerd('user-' + u.id), false);
  assert.equal(accounts.getUserById(u.id).actief, 0, 'herstel zet niemand weer aan');
});

test('2. faalt ook het foutspoor, dan komt de oorspronkelijke fout terug en blijft de blokkade', async () => {
  const u = await nieuw('bram');
  cascadeGedrag = () => { throw 'kale string'; };   // eslint-disable-line no-throw-literal
  S.db.exec(`CREATE TRIGGER scim_spoor_kapot BEFORE UPDATE ON scim_user_deprovision
    BEGIN SELECT RAISE(ABORT, 'spoor kapot'); END`);
  try {
    assert.throws(() => sync.zetActief('org-u', u.id, false), (e) => e === 'kale string');
  } finally { S.db.exec('DROP TRIGGER scim_spoor_kapot'); }
  assert.ok(logs.some(([m, d]) => /foutspoor mislukt/.test(m) && /spoor kapot/.test(d.fout)));
  assert.equal(maakSync.geblokkeerd('user-' + u.id), true);
  assert.equal(accounts.getUserById(u.id).actief, 0);
  nu += 6000;
  sync.ronde();
  assert.equal(rij(u.id).last_error, 'kale string', 'ook een fout zonder message komt in het spoor');
  assert.ok(logs.some(([m, d]) => /herstel mislukt/.test(m) && d.fout === 'kale string'));
});

test('3. weer aanzetten haalt de opdracht weg; een herstel voor wie weer aan staat sluit zonder cascade', async () => {
  const u = await nieuw('cor');
  cascadeGedrag = () => { throw new Error('storing'); };
  assert.throws(() => sync.zetActief('org-u', u.id, false));
  cascadeGedrag = () => ({ ok: true, geraakt: [] });
  const terug = sync.zetActief('org-u', u.id, true);
  assert.equal(terug.actief, 1);
  assert.equal(rij(u.id), undefined);
  assert.equal(maakSync.geblokkeerd('user-' + u.id), false);

  const d = await nieuw('dirk');
  cascadeGedrag = () => { throw new Error('storing'); };
  assert.throws(() => sync.zetActief('org-u', d.id, false));
  /* Buiten SCIM om weer aangezet (bijv. door het kantoor). */
  accounts.zetActief(d.id, true);
  const vanD = () => cascades.filter(([, id]) => id === d.id).length;
  const voor = vanD();
  nu += 10 * 60000;
  assert.equal(sync.ronde().hersteld, 0);
  assert.equal(vanD(), voor, 'geen cascade voor iemand die aan staat');
  assert.equal(rij(d.id), undefined);
});

test('4. een vreemde organisatie raakt het account niet, ook niet via de sync', async () => {
  const u = await nieuw('eva');
  const voor = cascades.length;
  assert.throws(() => sync.zetActief('org-vreemd', u.id, false), (e) => e.status === 404);
  assert.equal(accounts.getUserById(u.id).actief, 1);
  assert.equal(rij(u.id), undefined, 'geen opdracht voor een ander zijn medewerker');
  assert.equal(cascades.length, voor, 'en geen cascade');
});

test('5. zonder intrekkingswaarheid weigert productie; een open werkkopie laat de ronde wachten', () => {
  assert.equal(maakSync.geblokkeerd('lid-7'), false, 'alleen user-<n> is een RTG-sleutel');
  assert.equal(maakSync.geblokkeerd(null), false);
  const oudEnv = process.env.NODE_ENV;
  const db = S.db;
  S.db = null;
  try {
    assert.throws(() => maakSync.zorgTabel(), /accounts-database niet beschikbaar/);
    assert.equal(maakSync.geblokkeerd('user-1', { NODE_ENV: 'production' }), true, 'fail-closed in productie');
    assert.equal(maakSync.geblokkeerd('user-1', { NODE_ENV: 'test' }), false);
    delete process.env.NODE_ENV;
    assert.equal(maakSync.geblokkeerd('user-1'), false, 'zonder NODE_ENV is het geen productie');
  } finally {
    S.db = db;
    if (oudEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oudEnv;
  }

  const echt = transactie.bezet;
  transactie.bezet = () => true;
  try { assert.deepEqual(sync.ronde(), { bekeken: 0, hersteld: 0, uitgesteld: true }); }
  finally { transactie.bezet = echt; }
});

test('6. een claim die halverwege faalt, laat geen half-geclaimde rijen achter', async () => {
  const u = await nieuw('fien');
  cascadeGedrag = () => { throw new Error('storing'); };
  assert.throws(() => sync.zetActief('org-u', u.id, false));
  nu += 60 * 60000;
  S.db.exec(`CREATE TRIGGER scim_claim_kapot BEFORE UPDATE OF claim_token ON scim_user_deprovision
    BEGIN SELECT RAISE(ABORT, 'claim kapot'); END`);
  try { assert.throws(() => sync.ronde(), /claim kapot/); }
  finally { S.db.exec('DROP TRIGGER scim_claim_kapot'); }
  assert.equal(S.db.isTransaction, false);
  assert.equal(rij(u.id).claim_token, null);
  assert.equal(maakSync.geblokkeerd('user-' + u.id), true, 'de blokkade blijft');
});
