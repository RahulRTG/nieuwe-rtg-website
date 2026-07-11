/* Unit-tests voor de accountlaag: pseudonimisering (identiteitskluis),
   wachtwoord-hashing en sessietokens. Geen externe libraries: Node's eigen
   testrunner (node --test) en een tijdelijke datamap via RTG_DATA_DIR, zodat de
   echte data nooit wordt aangeraakt.

   Draai los: node --experimental-sqlite --test test/accounts.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Verse, geisoleerde datamap VOOR de module wordt geladen.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-accounts-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('identiteitskluis: echte naam versleuteld, codenaam operationeel', () => {
  const u = accounts.createUser({ email: 'kluis@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Echte Naam', phone: '+31611112222' });
  // De ruwe databaserij bevat GEEN leesbare naam of e-mail.
  const rij = accounts.getUserById(u.id);
  assert.ok(rij.enc_name && rij.enc_name !== 'Echte Naam', 'naam moet versleuteld staan');
  assert.ok(rij.enc_email && !String(rij.enc_email).includes('kluis@voorbeeld.test'), 'e-mail moet versleuteld staan');
  assert.equal(rij.email_hash && rij.email_hash.length, 64, 'e-mail alleen als sha256-HMAC-hash');
  assert.ok(rij.codename, 'operationele rij draait op codenaam');
  // Maar met de kluissleutel is de echte naam terug te halen.
  assert.equal(accounts.realNameOf(rij), 'Echte Naam');
  assert.equal(accounts.emailOf(rij), 'kluis@voorbeeld.test');
  // Het openbare profiel lekt de echte naam of wachtwoordhash niet.
  const pub = accounts.publicUser(rij);
  assert.equal(pub.password_hash, undefined);
  assert.equal(pub.enc_name, undefined);
});

test('wachtwoord: scrypt-verificatie klopt en weigert fout wachtwoord', () => {
  const u = accounts.createUser({ email: 'pw@voorbeeld.test', password: 'JuistWachtwoord9', tier: 'rtg', realName: 'Piet' });
  const rij = accounts.getUserById(u.id);
  assert.equal(accounts.verifyPassword('JuistWachtwoord9', rij.password_hash), true);
  assert.equal(accounts.verifyPassword('foutwachtwoord', rij.password_hash), false);
  // De hash mag nooit het wachtwoord in leesbare vorm bevatten.
  assert.ok(!String(rij.password_hash).includes('JuistWachtwoord9'));
});

test('e-mail-login vindt het account via de hash, niet via leesbare tekst', () => {
  const u = accounts.createUser({ email: 'Zoek.Mij@Voorbeeld.test', password: 'geheim12', tier: 'business', realName: 'Zoeker' });
  // Hoofdletterongevoelig, want de hash normaliseert naar lowercase.
  const gevonden = accounts.findByLogin('zoek.mij@voorbeeld.test');
  assert.ok(gevonden && gevonden.id === u.id);
});

test('sessietoken: geldig token geeft de gebruiker terug, geknoeid token niet', () => {
  const u = accounts.createUser({ email: 'tok@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Tokenlid' });
  const token = accounts.issueToken(u.id);
  const terug = accounts.verifyToken(token);
  assert.ok(terug && terug.id === u.id, 'geldig token geeft de juiste gebruiker');
  assert.equal(accounts.verifyToken(token + 'x'), null, 'geknoeid token wordt geweigerd');
  assert.equal(accounts.verifyToken('onzin'), null);
});

test('actietoken is gebonden aan zijn doel', () => {
  const u = accounts.createUser({ email: 'act@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Actielid' });
  const tok = accounts.issueActionToken(u.id, 'verify-email', 60000);
  const ok = accounts.verifyActionToken(tok, 'verify-email');
  assert.ok(ok && ok.id === u.id);
  // Hetzelfde token voor een ander doel mag niet werken.
  assert.equal(accounts.verifyActionToken(tok, 'reset-password'), null);
});
