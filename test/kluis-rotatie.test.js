/* Sleutelrotatie van de identiteitskluis (server/accounts/onderhoud.js).

   Een gecompromitteerde kluissleutel moet te vervangen zijn zonder de gegevens te
   verliezen en zonder downtime. De Rust-kluis (motor/src/kluis.rs) kon dat al met
   een keyring; de Node-kant had een enkele sleutel en geen weg om hem te wisselen.

   Het gevaarlijke punt zit niet in de versleuteling maar in de ZOEK-HASHES: de
   e-mail- en telefoonhash zijn een HMAC met de kluissleutel en staan als
   opzoeksleutel in de database. Roteerde die mee, dan kon niemand meer op zijn
   e-mailadres inloggen -- en halverwege een rotatie zou de helft van de leden
   buitenstaan. Die sleutel blijft daarom gepind. Dat is wat deze tests vooral
   bewaken.

   Draai los: node --experimental-sqlite --test test/kluis-rotatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kluisrotatie-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const gebonden = require('../server/accounts/gebonden');
const onderhoud = require('../server/accounts/onderhoud');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const rij = id => S.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const roteer = () => onderhoud.roteer(S.db, { schrijfRing: accounts.schrijfKluisRing });

let n = 0;
const maakLid = (naam) => accounts.createUser({
  email: 'rot' + (++n) + '@voorbeeld.test', password: 'geheim12', tier: 'rtg',
  realName: naam, phone: '+3162222' + String(1000 + n)
});

test('voor de rotatie: een sleutel, alles gebonden en op de actieve sleutel', async () => {
  await maakLid('Anna Aalders');
  await maakLid('Bram Bakker');
  const s = onderhoud.stand(S.db);
  assert.equal(s.sleutels, 1, 'zonder rotatie is de ring [VAULT]');
  assert.equal(s.ongebonden, 0);
  assert.equal(s.onleesbaar, 0);
  assert.equal(s.oudeSleutel, 0);
  assert.ok(s.gebonden >= 2);
});

test('roteren: verse sleutel, alles hersleuteld, alles nog leesbaar', async () => {
  const u = await maakLid('Carla Cohen');
  accounts.saveMemberState(u.id, { dossier: 'van Carla', bsn: '123456789' });
  const blobVoor = rij(u.id).enc_name;

  const uit = roteer();
  assert.equal(uit.sleutels, 2, 'de ring is gegroeid');
  assert.ok(uit.rijen >= 3, 'alle rijen zijn hersleuteld: ' + JSON.stringify(uit));

  // het blob is echt veranderd (nieuwe sleutel, nieuwe nonce) maar leest hetzelfde
  const na = rij(u.id);
  assert.notEqual(na.enc_name, blobVoor, 'de kolom is opnieuw gezegeld');
  assert.equal(accounts.realNameOf(na), 'Carla Cohen');
  assert.deepEqual(accounts.getMemberState(u.id), { dossier: 'van Carla', bsn: '123456789' });

  const s = onderhoud.stand(S.db);
  assert.equal(s.oudeSleutel, 0, 'niets staat meer op een oude sleutel');
  assert.equal(s.onleesbaar, 0);
  assert.equal(s.ongebonden, 0);
});

/* DE KERN: de zoek-hashes mogen NIET meebewegen, anders kan niemand meer inloggen.
   Dit is precies waarom de rotatie alleen de versleuteling raakt. */
test('na de rotatie werkt inloggen op e-mail en telefoon nog', async () => {
  const u = await maakLid('Dirk Dekker');
  const email = 'rot' + n + '@voorbeeld.test';
  assert.ok(accounts.findByLogin(email), 'voor de rotatie te vinden op e-mail');

  roteer();

  const gevonden = accounts.findByLogin(email);
  assert.ok(gevonden, 'NA de rotatie nog steeds te vinden op e-mail');
  assert.equal(gevonden.id, u.id);
  assert.equal(accounts.realNameOf(gevonden), 'Dirk Dekker');
  // en het wachtwoord doet het ook nog (die hash hangt niet aan de kluissleutel)
  assert.equal(await accounts.verifyPassword('geheim12', gevonden.password_hash), true);
});

/* Crasht een rotatie halverwege, dan staat een deel op de nieuwe en een deel op de
   oude sleutel. Dat mag niets breken: lezen probeert de hele ring. */
test('een half afgemaakte rotatie blijft leesbaar en is af te maken', async () => {
  const u = await maakLid('Eva Elzinga');
  // simuleer "ring op schijf, nog niets hersleuteld": zet een verse sleutel vooraan
  const verse = require('crypto').randomBytes(32);
  const nieuweRing = [verse].concat(gebonden.ring());
  accounts.schrijfKluisRing(nieuweRing);
  S.RING = nieuweRing;

  // de rij staat nog op de oude sleutel, maar leest gewoon
  assert.equal(accounts.realNameOf(rij(u.id)), 'Eva Elzinga', 'oude sleutel blijft werken');
  const halfweg = onderhoud.stand(S.db);
  assert.ok(halfweg.oudeSleutel >= 1, 'de stand meldt dat er nog werk is: ' + JSON.stringify(halfweg));
  assert.equal(halfweg.onleesbaar, 0, 'niets is onleesbaar geworden');

  // afmaken
  const uit = onderhoud.migreer(S.db);
  assert.ok(uit.rijen >= 1);
  assert.equal(onderhoud.stand(S.db).oudeSleutel, 0, 'nu is de rotatie rond');
  assert.equal(accounts.realNameOf(rij(u.id)), 'Eva Elzinga');
});

test('de binding blijft over rotaties heen gelden', async () => {
  const a = await maakLid('Ferdi Fransen');
  const b = await maakLid('Gita Groen');
  roteer();
  // een blob van A naar de rij van B: nog steeds dicht, ook al is de sleutel nieuw
  S.db.prepare('UPDATE users SET enc_name = ? WHERE id = ?').run(rij(a.id).enc_name, b.id);
  assert.notEqual(accounts.realNameOf(rij(b.id)), 'Ferdi Fransen', 'verplaatsen blijft dicht na rotatie');
  assert.equal(accounts.realNameOf(rij(a.id)), 'Ferdi Fransen');
});

test('de ring staat duurzaam op schijf, nieuwste eerst, met rechten 600', () => {
  const voor = gebonden.ring().length;
  roteer();
  const tekst = fs.readFileSync(accounts.RING_FILE, 'utf8').trim().split('\n');
  assert.equal(tekst.length, voor + 1, 'elke sleutel op een eigen regel');
  assert.ok(tekst.every(r => /^[0-9a-f]{64}$/.test(r)), 'hex per regel');
  assert.equal(tekst[0], Buffer.from(gebonden.ring()[0]).toString('hex'), 'de actieve sleutel staat vooraan');
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(accounts.RING_FILE).mode & 0o777, 0o600, 'alleen de eigenaar mag hem lezen');
  }
});

test('roteren zonder schrijfRing weigert: de ring moet eerst duurzaam zijn', () => {
  assert.throws(() => onderhoud.roteer(S.db), /schrijfRing/);
  assert.throws(() => onderhoud.roteer(S.db, {}), /schrijfRing/);
});
