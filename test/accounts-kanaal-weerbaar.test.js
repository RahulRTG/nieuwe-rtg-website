/* DE HERSTELKANALEN EN DE PUBLIEKE ALIAS IN DE IDENTITEITSKLUIS
   (server/accounts/users.js, server/accounts/publiekmail.js).

   Het e-mailadres is inlogsleutel en herstelkanaal tegelijk; het
   telefoonnummer is een herstelkanaal. Wie een van beide vervangt, neemt de
   voor- of achterdeur over. setEmail was nergens aangeroepen, en de publieke
   alias (een naar buiten zichtbaar adres dat op een CODENAAM wijst, niet op
   een echte naam) evenmin. Alles hier op een echte, tijdelijke kluis.

   Wat hier niet mag sneuvelen:
   1. een bestaand e-mailadres vervangen kan alleen met vervangenMag; het
      nieuwe adres mag niet van een ander account zijn en komt ONBEVESTIGD
      binnen; daarna vindt de inlog het nieuwe adres en niet het oude;
   2. hetzelfde voor het telefoonnummer; een leeg nummer zet niets;
   3. een ongeldige pas of een onbekend account verandert niets;
   4. een publieke alias is uniek (botsing wordt -2), stabiel per lid, wordt
      alleen als HMAC bewaard en wijst terug naar het account; rommel als
      lokaal deel of domein geeft geen adres;
   5. publicUser geeft nooit null-velden als waarheid uit: onbevestigd heet
      'unverified'.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in setEmail `if (bestaand && !(opties && opties.vervangenMag === true))`
     vervangen door `if (false)` -> "1." ZAKT (RAAK);
   - in setEmail `email_verified = 0` vervangen door `email_verified = 1` ->
     "1." ZAKT (RAAK);
   - in reservePublicMail `Number(ander.id) === Number(userId)` vervangen door
     `false` -> "4." ZAKT (RAAK: het lid kreeg bij elke aanroep een nieuw
     nummer).

   Draai: node --test test/accounts-kanaal-weerbaar.test.js */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kanaal-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const rij = (id) => S.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const maak = (email, x) => accounts.createUser(Object.assign({ email, password: 'wachtwoord-123', tier: 'rtg', realName: 'Anna de Vries' }, x));

test('1. e-mail vervangen: alleen met vervangenMag, niet naar een bezet adres, en onbevestigd', async () => {
  const a = await maak('anna@kanaal.test'), b = await maak('bert@kanaal.test');
  accounts.setEmailVerified(a.id);
  assert.deepEqual(accounts.setEmail(a.id, 'geen-adres'), { error: 'adres' });
  assert.deepEqual(accounts.setEmail(a.id, undefined), { error: 'adres' });
  assert.deepEqual(accounts.setEmail(999999, 'x@kanaal.test'), { error: 'onbekend' });
  assert.equal(accounts.setEmail(a.id, ' ANNA@kanaal.test ').id, a.id, 'hetzelfde adres: niets te doen');
  assert.equal(rij(a.id).email_verified, 1, 'en de bevestiging blijft staan');
  assert.equal(accounts.setEmail(a.id, 'kaper@boef.test').error, 'herstelkanaal');
  assert.equal(accounts.findByLogin('kaper@boef.test'), null);
  assert.deepEqual(accounts.setEmail(a.id, 'bert@kanaal.test', { vervangenMag: true }), { error: 'inGebruik' });
  const na = accounts.setEmail(a.id, 'anna.nieuw@kanaal.test', { vervangenMag: true });
  assert.equal(na.id, a.id);
  assert.equal(rij(a.id).email_verified, 0, 'het nieuwe adres is nog niet bevestigd');
  assert.equal(accounts.findByLogin('anna.nieuw@kanaal.test').id, a.id);
  assert.equal(accounts.findByLogin('anna@kanaal.test'), null, 'het oude adres opent niets meer');
  assert.ok(!JSON.stringify(rij(a.id)).includes('anna.nieuw'), 'het adres staat alleen versleuteld en als hash');
  assert.equal(accounts.emailOf(accounts.getUserById(a.id)), 'anna.nieuw@kanaal.test');
  const zonder = await maak(null, { username: 'zonderadres' });
  assert.equal(accounts.setEmail(zonder.id, 'eerste@kanaal.test').id, zonder.id, 'een eerste adres mag zonder vlag');
  assert.equal(b.id > 0, true);
});

test('2. telefoon vervangen: alleen met vervangenMag; leeg zet niets', async () => {
  const a = await maak('tel@kanaal.test', { phone: '+31 6 1111 1111' });
  assert.equal(accounts.setPhone(a.id, '   '), null);
  assert.equal(accounts.setPhone(a.id, undefined), null);
  assert.equal(accounts.setPhone(a.id, '+31 6 2222 2222').error, 'herstelkanaal');
  assert.equal(accounts.phoneOf(accounts.getUserById(a.id)), '+31 6 1111 1111');
  assert.equal(accounts.setPhone(a.id, ' +31 6 1111 1111 ').id, a.id, 'hetzelfde nummer mag');
  accounts.setPhone(a.id, '+31 6 2222 2222', { vervangenMag: true });
  assert.equal(accounts.phoneOf(accounts.getUserById(a.id)), '+31 6 2222 2222');
  assert.ok(!JSON.stringify(rij(a.id)).includes('2222'), 'het nummer staat niet leesbaar in de rij');
});

test('3. een ongeldige pas of onbekend account verandert niets', async () => {
  const a = await maak('pas@kanaal.test', { tier: 'koning' });
  assert.equal(a.tier, 'rtg', 'een verzonnen pas wordt rtg, nooit iets hogers');
  assert.equal(accounts.setTier(a.id, 'platinum'), null);
  assert.equal(accounts.setTier(999999, 'business'), null);
  assert.equal(accounts.zetActief(999999, false), null);
  assert.equal(accounts.getUserById(a.id).tier, 'rtg');
});

test('4. publieke alias: uniek, stabiel, alleen als HMAC, wijst terug naar het account', async () => {
  const a = await maak('alias1@kanaal.test'), b = await maak('alias2@kanaal.test');
  const D = 'leden.rtg.test';
  assert.equal(accounts.reservePublicMail(a.id, 'Zilveren.Valk', D), 'zilveren.valk@' + D);
  assert.equal(accounts.reservePublicMail(b.id, 'zilveren.valk', D), 'zilveren.valk-2@' + D, 'botsing: volgnummer');
  assert.equal(accounts.reservePublicMail(a.id, 'iets-anders', D), 'zilveren.valk@' + D, 'stabiel per lid');
  assert.equal(accounts.reservePublicMail(b.id, 'zilveren.valk', D), 'zilveren.valk-2@' + D);
  assert.equal(accounts.findByPublicMail(' Zilveren.Valk@' + D.toUpperCase()).id, a.id);
  assert.equal(accounts.findByPublicMail('zilveren.valk-2@' + D).id, b.id);
  assert.equal(accounts.findByPublicMail(''), null);
  assert.equal(accounts.findByPublicMail('niemand@' + D), null);
  assert.ok(!JSON.stringify(rij(a.id)).includes('zilveren.valk'), 'alleen de HMAC staat in de rij');
  for (const [l, d] of [['', D], ['-begin', D], ['a b', D], ['ok', 'geen_domein'], ['ok', undefined]])
    assert.equal(accounts.reservePublicMail(a.id, l, d), null, JSON.stringify([l, d]));
  assert.equal(accounts.reservePublicMail(999999, 'x', D), null);
});

test('5. publicUser: onbevestigd heet zo, en null blijft null', async () => {
  assert.equal(accounts.publicUser(null), null);
  const a = await maak('pub@kanaal.test');
  const p = accounts.publicUser(accounts.getUserById(a.id));
  assert.deepEqual([p.verified, p.emailVerified, p.account], ['unverified', false, true]);
  assert.equal(p.name, 'A. de Vries');
  assert.ok(p.codename && !p.codename.includes('Anna'));
});
