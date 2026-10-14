/* HET HERSTELTOKEN EN HET ACTIETOKEN, DE TIJDSGRENZEN EN DE RACE
   (server/accounts/herstel.js, actietokens.js, users.js setPasswordSync).

   Een hersteltoken is een wachtwoord in een URL: wie hem heeft, zet een nieuw
   wachtwoord. Een actietoken bevestigt een e-mailadres of draagt een SSO-
   overdracht. Beide moeten verlopen, en een hersteltoken mag precies EEN keer
   werken -- ook als twee verzoeken tegelijk binnenkomen. De verloopkant en de
   race stonden nergens getoetst.

   Wat hier niet mag sneuvelen:
   1. een onbekend of verlopen hersteltoken vindt niemand en zet niets;
   2. twee gelijktijdige consumeReset-aanroepen met hetzelfde token: precies
      één wint, de ander krijgt null en het wachtwoord van de winnaar blijft;
   3. een verlopen actietoken, of een actietoken zonder doel, geeft niemand;
   4. setPasswordSync (het opstart-seed) zet de sessiegrens: sessies van vóór
      het nieuwe wachtwoord gelden niet meer.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in consumeReset `if (!info.changes) return null;` weggehaald -> "2."
     ZAKT (RAAK: allebei kregen een account terug);
   - in findByReset `u.reset_expires < klokNu()` vervangen door `false` ->
     "1." ZAKT (RAAK);
   - in verifyActionToken `Number(exp) < Date.now()` vervangen door `false`
     -> "3." ZAKT (RAAK).

   Draai: node --test test/accounts-herstel-weerbaar.test.js */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstel-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function klok() { const echt = Date.now; let nu = echt(); Date.now = () => nu; return { verder: (ms) => { nu += ms; }, terug: () => { Date.now = echt; } }; }
const maak = (email) => accounts.createUser({ email, password: 'oud-wachtwoord-1', tier: 'rtg', realName: 'Herstel Lid' });

test('1. onbekend of verlopen hersteltoken: niemand, niets gezet', async () => {
  const u = await maak('h1@herstel.test');
  assert.equal(accounts.findByReset('onbekend'), null);
  assert.equal(accounts.findByReset(undefined), null);
  assert.equal(await accounts.consumeReset(undefined, 'nieuw-wachtwoord-1'), null);
  const k = klok();
  try {
    const t = accounts.createReset(u.id, 1000);
    assert.equal(accounts.findByReset(t).id, u.id);
    k.verder(1001);
    assert.equal(accounts.findByReset(t), null, 'verlopen');
    assert.equal(await accounts.consumeReset(t, 'nieuw-wachtwoord-1'), null);
  } finally { k.terug(); }
  assert.ok(await accounts.verifyPassword('oud-wachtwoord-1', accounts.getUserById(u.id).password_hash), 'het oude wachtwoord staat er nog');
  const t2 = accounts.createReset(u.id);
  assert.equal((await accounts.consumeReset(t2, 'nieuw-wachtwoord-2')).id, u.id);
  assert.equal(accounts.findByReset(t2), null, 'gebruikt is op');
});

test('2. twee gelijktijdige inwisselingen: precies één wint', async () => {
  const u = await maak('h2@herstel.test');
  const t = accounts.createReset(u.id);
  const [a, b] = await Promise.all([accounts.consumeReset(t, 'winnaar-wachtwoord-a'), accounts.consumeReset(t, 'verliezer-wachtwoord-b')]);
  assert.equal([a, b].filter(Boolean).length, 1, 'niet twee winnaars');
  const winnaar = a ? 'winnaar-wachtwoord-a' : 'verliezer-wachtwoord-b';
  const verliezer = a ? 'verliezer-wachtwoord-b' : 'winnaar-wachtwoord-a';
  const hash = accounts.getUserById(u.id).password_hash;
  assert.equal(await accounts.verifyPassword(winnaar, hash), true);
  assert.equal(await accounts.verifyPassword(verliezer, hash), false);
});

test('3. een verlopen actietoken of een zonder doel geeft niemand', async () => {
  const u = await maak('h3@herstel.test');
  const k = klok();
  try {
    const t = accounts.issueActionToken(u.id, 'verify-email', 1000);
    assert.equal(accounts.verifyActionToken(t, 'verify-email').id, u.id);
    assert.equal(accounts.verifyActionToken(t, undefined), null, 'zonder doel geen sleutel en dus geen lid');
    assert.equal(accounts.verifyActionToken(t, 'mailwissel'), null);
    k.verder(1001);
    assert.equal(accounts.verifyActionToken(t, 'verify-email'), null, 'verlopen');
  } finally { k.terug(); }
  assert.equal(accounts.verifyActionToken(accounts.issueActionToken(u.id, 'verify-email', -1), 'verify-email'), null);
});

test('4. setPasswordSync zet de sessiegrens', async () => {
  const u = await maak('h4@herstel.test');
  const k = klok();
  try {
    const sessie = accounts.issueToken(u.id);
    assert.equal(accounts.verifyToken(sessie).id, u.id);
    k.verder(5000);
    accounts.setPasswordSync(u.id, 'seed-wachtwoord-1');
    assert.equal(accounts.verifyToken(sessie), null, 'een sessie van vóór het nieuwe wachtwoord telt niet meer');
    k.verder(5000);
    assert.equal(accounts.verifyToken(accounts.issueToken(u.id)).id, u.id);
  } finally { k.terug(); }
  assert.ok(await accounts.verifyPassword('seed-wachtwoord-1', accounts.getUserById(u.id).password_hash));
});
