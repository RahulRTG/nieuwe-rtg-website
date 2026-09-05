/* Unit-tests voor de accountlaag: pseudonimisering (identiteitskluis),
   wachtwoord-hashing en sessietokens. Geen externe libraries: Node's eigen
   testrunner (node --test) en een tijdelijke datamap via RTG_DATA_DIR, zodat de
   echte data nooit wordt aangeraakt.

   Draai los: node --test test/accounts.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Verse, geisoleerde datamap VOOR de module wordt geladen.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-accounts-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';

const accounts = require('../server/accounts');
accounts.init();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('identiteitskluis: echte naam versleuteld, codenaam operationeel', async () => {
  const u = await accounts.createUser({ email: 'kluis@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Echte Naam', phone: '+31611112222' });
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

test('wachtwoord: scrypt-verificatie klopt en weigert fout wachtwoord', async () => {
  const u = await accounts.createUser({ email: 'pw@voorbeeld.test', password: 'JuistWachtwoord9', tier: 'rtg', realName: 'Piet' });
  const rij = accounts.getUserById(u.id);
  assert.equal(await accounts.verifyPassword('JuistWachtwoord9', rij.password_hash), true);
  assert.equal(await accounts.verifyPassword('foutwachtwoord', rij.password_hash), false);
  // De hash mag nooit het wachtwoord in leesbare vorm bevatten.
  assert.ok(!String(rij.password_hash).includes('JuistWachtwoord9'));
});

test('e-mail-login vindt het account via de hash, niet via leesbare tekst', async () => {
  const u = await accounts.createUser({ email: 'Zoek.Mij@Voorbeeld.test', password: 'geheim12', tier: 'business', realName: 'Zoeker' });
  // Hoofdletterongevoelig, want de hash normaliseert naar lowercase.
  const gevonden = accounts.findByLogin('zoek.mij@voorbeeld.test');
  assert.ok(gevonden && gevonden.id === u.id);
});

test('sessietoken: geldig token geeft de gebruiker terug, geknoeid token niet', async () => {
  const u = await accounts.createUser({ email: 'tok@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Tokenlid' });
  const token = accounts.issueToken(u.id);
  const terug = accounts.verifyToken(token);
  assert.ok(terug && terug.id === u.id, 'geldig token geeft de juiste gebruiker');
  assert.equal(accounts.verifyToken(token + 'x'), null, 'geknoeid token wordt geweigerd');
  assert.equal(accounts.verifyToken('onzin'), null);
});

test('actietoken is gebonden aan zijn doel', async () => {
  const u = await accounts.createUser({ email: 'act@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Actielid' });
  const tok = accounts.issueActionToken(u.id, 'verify-email', 60000);
  const ok = accounts.verifyActionToken(tok, 'verify-email');
  assert.ok(ok && ok.id === u.id);
  // Hetzelfde token voor een ander doel mag niet werken.
  assert.equal(accounts.verifyActionToken(tok, 'reset-password'), null);
});

test('twee gelijktijdig uitgegeven actietokens zijn afzonderlijk intrekbaar', async () => {
  const u = await accounts.createUser({ email: 'actie-uniek@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Unieke Actie' });
  const echtNu = Date.now;
  let een, twee;
  try {
    Date.now = () => 1900000000000;
    een = accounts.issueActionToken(u.id, 'verify-email', 60000);
    twee = accounts.issueActionToken(u.id, 'verify-email', 60000);
  } finally { Date.now = echtNu; }
  assert.notEqual(een, twee, 'uitgiftes in dezelfde milliseconde mogen geen gedeelde geloofsbrief opleveren');
  assert.equal(Buffer.from(een.split('.')[0], 'base64url').toString().split('.').length, 4);
  assert.ok(accounts.verifyActionToken(een, 'verify-email'));
  assert.ok(accounts.verifyActionToken(twee, 'verify-email'));
  await accounts.trekInActie(een, 'verify-email');
  assert.equal(accounts.verifyActionToken(een, 'verify-email'), null);
  assert.ok(accounts.verifyActionToken(twee, 'verify-email'), 'intrekken van één bewijs mag het andere niet raken');
});

test('pending personeel is onzichtbaar voor iedere login tot expliciete activatie', async () => {
  const pending = await accounts.createStaff({ supplierCode: 'PENDING', name: 'Nog niet actief',
    role: 'manager', func: 'Test', pin: '8642', memberId: 991, memberTier: 'rtg', active: false });
  assert.equal(Number(pending.active), 0);
  assert.equal(accounts.getStaffById(pending.id), null);
  assert.equal(accounts.staffByMember('PENDING', 991), null);
  assert.equal(await accounts.verifyStaffPin(pending.id, '8642'), null);
  assert.equal(accounts.staffPositions(991).length, 0);

  const actief = accounts.activateStaff(pending.id);
  assert.equal(Number(actief.active), 1);
  assert.equal((await accounts.verifyStaffPin(pending.id, '8642')).id, pending.id);
  accounts.deactivateStaff(pending.id);
});

test('productie kan personeelspin niet uitgeven, resetten, verifiëren of koppelen', async () => {
  const lid = await accounts.createUser({ email: 'werk@voorbeeld.test', password: 'werkgeheim',
    tier: 'rtg', realName: 'Werkmens' });
  const oudeStaff = await accounts.createStaff({ supplierCode: 'OUD', name: 'Oude PIN',
    role: 'staff', pin: '8642' });
  const oud = { node: process.env.NODE_ENV, magnaat: process.env.RTG_MAGNAAT_TEST };
  process.env.NODE_ENV = 'production';
  delete process.env.RTG_MAGNAAT_TEST;
  try {
    assert.throws(() => accounts.makePin(), e => e && e.code === 'RTG_STAFF_PIN_GESLOTEN');
    assert.throws(() => accounts.createStaffSync({ supplierCode: 'ECHT', name: 'Fout',
      role: 'staff', pin: '1234' }), e => e && e.code === 'RTG_STAFF_PIN_GESLOTEN');
    await assert.rejects(accounts.createStaff({ supplierCode: 'ECHT', name: 'Fout',
      role: 'staff', pin: '1234' }), e => e && e.code === 'RTG_STAFF_PIN_GESLOTEN');
    assert.equal(await accounts.verifyStaffPin(oudeStaff.id, '8642'), null,
      'zelfs een vroeger geldige rij is in productie geen bearer');
    await assert.rejects(accounts.setStaffPin(oudeStaff.id, '9999'),
      e => e && e.code === 'RTG_STAFF_PIN_GESLOTEN');

    const gebonden = accounts.createAccountStaff({ supplierCode: 'ECHT', name: 'Werkmens',
      role: 'manager', func: 'Eigenaar', memberId: lid.id, memberTier: lid.tier });
    assert.equal(gebonden.member_id, lid.id);
    assert.equal(gebonden.pin_hash, accounts.ACCOUNT_ONLY_HASH);
    assert.equal(await accounts.verifyStaffPin(gebonden.id, '1234'), null);
    assert.throws(() => accounts.createAccountStaff({ supplierCode: 'ECHT', name: 'Niemand',
      role: 'staff' }), e => e && e.code === 'RTG_STAFF_ACCOUNT_REQUIRED');
    assert.throws(() => accounts.createAccountStaff({ supplierCode: 'ECHT', name: 'Spookaccount',
      role: 'staff', memberId: 99999999 }), e => e && e.code === 'RTG_STAFF_ACCOUNT_REQUIRED');
  } finally {
    process.env.NODE_ENV = oud.node;
    process.env.RTG_MAGNAAT_TEST = oud.magnaat;
  }
});
