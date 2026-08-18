/* De scrypt-kosten en het migratiepad.

   Waar dit over gaat: de opgeslagen wachtwoordhash droeg vroeger geen enkele
   parameter (`salt:hash`), en daardoor was de scrypt-kostenfactor niet te
   verhogen zonder elk bestaand wachtwoord ongeldig te maken. Sinds
   server/accounts/kluis.js schrijft hij `s2$N$r$p$salt$hash`, leest hij het oude
   formaat nog steeds, en zegt moetVernieuwen() per hash of hij aan vervanging
   toe is. De inlogroute waardeert een oude hash stil op bij een GESLAAGDE inlog.

   Vier dingen moeten waar blijven, en ze kunnen alle vier zakken:
     1. een hash uit de oude wereld doet het nog gewoon (anders sluit een
        upgrade elk bestaand lid buiten -- de duurste fout die hier mogelijk is);
     2. een nieuwe hash draagt zijn kosten en wordt niet onnodig vervangen;
     3. de parameters uit de DATABASE worden begrensd: een rij met een absurde
        N mag de server niet laten malen (denial of service via een veld);
     4. opwaarderen verandert de hash WEL en het wachtwoord NIET, en het raakt
        `sessies_vanaf` niet -- anders wordt elk lid bij zijn volgende inlog
        overal uitgelogd en voelt een stille verbetering als een storing.

   Draai los: node --experimental-sqlite --test test/wachtwoordkosten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pwkosten-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
const kluis = require('../server/accounts/kluis');
accounts.init();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Het OUDE formaat exact zoals het op schijf stond: hex-salt, dubbele punt,
   hex-hash, en scrypt op de Node-standaard van toen (N=16384, r=8, p=1). */
function oudeHash(wachtwoord) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(String(wachtwoord), salt, 64).toString('hex');
}

test('1. een hash uit de oude wereld blijft gewoon werken', async () => {
  const oud = oudeHash('OudWachtwoord9');
  assert.ok(!oud.startsWith('s2$'), 'dit moet echt het oude formaat zijn, anders toetst dit niets');
  assert.equal(await kluis.verifyPassword('OudWachtwoord9', oud), true, 'het juiste wachtwoord hoort te openen');
  assert.equal(await kluis.verifyPassword('FoutWachtwoord9', oud), false, 'een fout wachtwoord niet');
  assert.equal(kluis.moetVernieuwen(oud), true, 'en hij staat op de lijst om vervangen te worden');
});

test('2. een nieuwe hash draagt zijn eigen kosten', async () => {
  const nieuw = await kluis.hashPassword('NieuwWachtwoord9');
  const delen = nieuw.split('$');
  assert.equal(delen[0], 's2', 'het merk staat vooraan');
  assert.equal(delen.length, 6, 'merk, N, r, p, salt, hash');
  assert.equal(Number(delen[1]), kluis.SCRYPT_N, 'N staat er letterlijk in');
  assert.equal(Number(delen[2]), kluis.SCRYPT_R);
  assert.equal(Number(delen[3]), kluis.SCRYPT_P);
  assert.equal(await kluis.verifyPassword('NieuwWachtwoord9', nieuw), true);
  assert.equal(await kluis.verifyPassword('nieuwwachtwoord9', nieuw), false, 'hoofdlettergevoelig');
  assert.equal(kluis.moetVernieuwen(nieuw), false, 'wat al op de lat zit hoeft niet opnieuw');
});

test('3. parameters uit de database worden begrensd en falen dicht', async () => {
  const zout = crypto.randomBytes(16).toString('hex');
  const nep = crypto.randomBytes(64).toString('hex');
  /* Een absurde N is geen theoretisch geval: het is een veld in een rij. Zou
     verifyPassword hem gewoon overnemen, dan is EEN inlogpoging genoeg om de
     server minuten te laten rekenen en zijn geheugen op te eten. */
  const teGroot = 's2$16777216$8$1$' + zout + '$' + nep;
  const t0 = Date.now();
  assert.equal(await kluis.verifyPassword('wat dan ook', teGroot), false, 'buiten de grens: dicht');
  assert.ok(Date.now() - t0 < 1000, 'en hij mag er niet eens aan beginnen te rekenen');

  for (const rommel of ['', 'geen-hash', 's2$8$8$1$aa$bb', 's2$32768$0$1$aa$bb', 's2$32768$8$99$aa$bb',
    's2$32768$8$1$nietheks$bb', 'aa:zz', 's2$32768$8$1$aa', null, undefined]) {
    assert.equal(await kluis.verifyPassword('geheim', rommel), false, 'rommel hoort dicht te vallen: ' + String(rommel));
    assert.equal(kluis.moetVernieuwen(rommel), false, 'en rommel vervangen we niet, we weigeren hem: ' + String(rommel));
  }
});

test('4. opwaarderen vervangt de hash, laat het wachtwoord staan en logt niemand uit', async () => {
  const u = await accounts.createUser({ email: 'kosten@voorbeeld.test', password: 'MijnWachtwoord9',
    tier: 'rtg', realName: 'Test Persoon' });
  // zet er met de hand een OUDE hash in, alsof dit account uit de vorige wereld komt
  const oud = oudeHash('MijnWachtwoord9');
  const S = require('../server/accounts/state');
  S.zin('UPDATE users SET password_hash = ? WHERE id = ?').run(oud, u.id);
  const voor = accounts.getUserById(u.id);
  assert.equal(voor.password_hash, oud, 'de oude hash staat er nu echt in');
  const sessiesVoor = Number(voor.sessies_vanaf || 0);

  // een token van VOOR de opwaardering: dat moet daarna nog werken
  const token = accounts.issueToken(u.id);
  assert.ok(accounts.verifyToken(token), 'het token deugt om te beginnen');

  const gedaan = await accounts.vernieuwWachtwoordHash(u.id, 'MijnWachtwoord9');
  assert.equal(gedaan, true, 'er viel iets op te waarderen');

  const na = accounts.getUserById(u.id);
  assert.notEqual(na.password_hash, oud, 'de hash is vervangen');
  assert.ok(String(na.password_hash).startsWith('s2$'), 'en wel door het nieuwe formaat');
  assert.equal(await kluis.verifyPassword('MijnWachtwoord9', na.password_hash), true,
    'HETZELFDE wachtwoord opent nog steeds -- dit is een verbetering, geen wijziging');
  assert.equal(await kluis.verifyPassword('MijnWachtwoord9', oud), true,
    'en de oude hash zelf klopte ook, dus punt 1 hierboven is geen toeval');

  assert.equal(Number(na.sessies_vanaf || 0), sessiesVoor,
    'sessies_vanaf mag NIET bewegen: anders vliegt elk lid er bij zijn volgende inlog uit');
  assert.ok(accounts.verifyToken(token), 'het bestaande token werkt nog gewoon');

  // en een tweede ronde doet niets meer
  assert.equal(await accounts.vernieuwWachtwoordHash(u.id, 'MijnWachtwoord9'), false,
    'wat al op de lat zit wordt niet elke inlog opnieuw gehasht');
});
