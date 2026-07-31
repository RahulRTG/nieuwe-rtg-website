/* De identiteitskluis met CONTEXT-BINDING (server/accounts/gebonden.js).

   De kluis versleutelde de inhoud van naam/e-mail/telefoon al, maar zei niets over
   waar die inhoud thuishoorde. Wie de database kon bewerken kon een blob dus
   VERPLAATSEN: de versleutelde naam van lid A naar de naamkolom van lid B. De
   AEAD merkte daar niets van -- het blob was immers ongeschonden -- en het huis
   las daarna een echte naam bij de verkeerde codenaam. Precies wat de scheiding
   tussen codenaam en kluis moet voorkomen.

   Deze tests vallen die verplaatsing echt aan, met rauwe SQL, en toetsen daarnaast
   dat een BESTAANDE installatie leesbaar blijft en netjes migreert.

   Draai los: node --experimental-sqlite --test test/kluis-binding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Verse, geisoleerde datamap VOOR de modules worden geladen.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kluisbinding-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const kluis = require('../server/accounts/kluis');
const gebonden = require('../server/accounts/gebonden');
const onderhoud = require('../server/accounts/onderhoud');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const rij = id => S.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const zetRuw = (kolom, id, waarde) =>
  S.db.prepare('UPDATE users SET ' + kolom + ' = ? WHERE id = ?').run(waarde, id);

let n = 0;
const maakLid = (naam) => accounts.createUser({
  email: 'bind' + (++n) + '@voorbeeld.test', password: 'geheim12', tier: 'rtg',
  realName: naam, phone: '+3161111' + String(1000 + n)
});

test('een vers account staat gebonden op schijf en leest gewoon terug', async () => {
  const u = await maakLid('Anna Aalders');
  const r = rij(u.id);
  // de kolommen dragen de gebonden markering
  for (const k of ['enc_name', 'enc_email', 'enc_phone']) {
    assert.ok(String(r[k]).startsWith(gebonden.MERK2), k + ' moet gebonden zijn (' + gebonden.MERK2 + ')');
    assert.ok(!String(r[k]).includes('Anna'), k + ' mag geen leesbare gegevens bevatten');
  }
  // en gewoon leesbaar via de kluis
  assert.equal(accounts.realNameOf(r), 'Anna Aalders');
  assert.equal(accounts.emailOf(r), 'bind1@voorbeeld.test');
  assert.ok(String(accounts.phoneOf(r)).includes('1001'));
});

/* DE KERN: een blob van lid A naar de naamkolom van lid B verplaatsen. Voor de
   binding lukte dit en las het huis de naam van A bij de codenaam van B. */
test('een blob naar een ANDERE RIJ verplaatsen levert niets op', async () => {
  const a = await maakLid('Bram Bakker');
  const b = await maakLid('Carla Cohen');
  const naamBlobVanA = rij(a.id).enc_name;

  // aanvaller met databasetoegang kopieert het blob letterlijk naar de rij van B
  zetRuw('enc_name', b.id, naamBlobVanA);

  const rb = rij(b.id);
  assert.equal(rb.enc_name, naamBlobVanA, 'het blob staat er echt (de test doet wat hij zegt)');
  const gelezen = accounts.realNameOf(rb);
  assert.notEqual(gelezen, 'Bram Bakker', 'de naam van A mag NIET bij B tevoorschijn komen');
  assert.equal(gelezen, rb.username || 'Lid', 'onleesbaar valt terug op de inlognaam');
  assert.equal(gebonden.lees('enc_name', rb), null, 'de kluis geeft niets terug');

  // en bij A zelf is niets stuk
  assert.equal(accounts.realNameOf(rij(a.id)), 'Bram Bakker');
});

test('een blob naar een ANDERE KOLOM verplaatsen levert niets op', async () => {
  const u = await maakLid('Dirk Dekker');
  const r0 = rij(u.id);
  const eigenEmail = accounts.emailOf(r0);   // niet op een teller vertrouwen
  assert.ok(eigenEmail && eigenEmail.includes('@'));
  // de e-mail naar de naamkolom: zelfde rij, andere kolom
  zetRuw('enc_name', u.id, r0.enc_email);
  const r1 = rij(u.id);
  assert.equal(gebonden.lees('enc_name', r1), null, 'een e-mailblob mag geen naam worden');
  assert.notEqual(accounts.realNameOf(r1), eigenEmail, 'de e-mail mag niet als naam opduiken');
  // de e-mail zelf leest nog gewoon op zijn eigen plek
  assert.equal(accounts.emailOf(r1), eigenEmail);
});

/* Een bestaande installatie heeft ONGEBONDEN blobs (en member_state kan zelfs nog
   platte tekst zijn). Die moeten leesbaar blijven, anders breekt een upgrade de
   hele ledenadministratie. */
test('bestaande ongebonden blobs blijven leesbaar', async () => {
  const u = await maakLid('Eva Elzinga');
  // draai de kolom terug naar de OUDE vorm: kaal versleuteld, zonder binding
  zetRuw('enc_name', u.id, kluis.enc('Eva Elzinga'));
  const r = rij(u.id);
  assert.ok(!String(r.enc_name).startsWith(gebonden.MERK2), 'nu in de oude vorm');
  assert.equal(accounts.realNameOf(r), 'Eva Elzinga', 'oude vorm moet leesbaar blijven');

  // ook de oudere RTGV1-vorm van member_state, en zelfs nooit-versleutelde tekst
  zetRuw('member_state', u.id, kluis.encVeld('{"a":1}'));
  assert.deepEqual(accounts.getMemberState(u.id), { a: 1 }, 'RTGV1 blijft leesbaar');
  zetRuw('member_state', u.id, '{"b":2}');
  assert.deepEqual(accounts.getMemberState(u.id), { b: 2 }, 'platte tekst blijft leesbaar');
});

test('migreren bindt de oude rijen, en daarna is verplaatsen ook daar dicht', async () => {
  const u = await maakLid('Ferdi Fransen');
  const ander = await maakLid('Gita Groen');
  // zet u terug naar de oude, ongebonden vorm
  zetRuw('enc_name', u.id, kluis.enc('Ferdi Fransen'));
  zetRuw('member_state', u.id, '{"plat":true}');

  const voor = onderhoud.stand(S.db);
  assert.ok(voor.ongebonden >= 1, 'er staat minstens een ongebonden rij');

  const uitslag = onderhoud.migreer(S.db);
  assert.ok(uitslag.rijen >= 1 && uitslag.kolommen >= 2, 'de migratie heeft werk gedaan: ' + JSON.stringify(uitslag));

  const r = rij(u.id);
  assert.ok(String(r.enc_name).startsWith(gebonden.MERK2), 'nu gebonden');
  assert.ok(String(r.member_state).startsWith(gebonden.MERK2), 'member_state ook gebonden en versleuteld');
  assert.ok(!String(r.member_state).includes('plat'), 'member_state staat niet meer leesbaar op schijf');
  assert.equal(accounts.realNameOf(r), 'Ferdi Fransen', 'en leest nog gewoon');
  assert.deepEqual(accounts.getMemberState(u.id), { plat: true });

  // na de migratie is het verplaatsen ook voor deze rij dicht
  zetRuw('enc_name', ander.id, r.enc_name);
  assert.notEqual(accounts.realNameOf(rij(ander.id)), 'Ferdi Fransen', 'na migratie niet meer te verplaatsen');

  // migreren is veilig om nog eens te draaien
  assert.equal(onderhoud.migreer(S.db).rijen, 0, 'een tweede migratie heeft niets te doen');
});

test('een naamswijziging schrijft meteen gebonden weg', async () => {
  const u = await maakLid('Hans Hoek');
  accounts.renameUser(u.id, { username: 'hans2', realName: 'Hans Hoekstra' });
  const r = rij(u.id);
  assert.ok(String(r.enc_name).startsWith(gebonden.MERK2), 'rename bindt direct');
  assert.equal(accounts.realNameOf(r), 'Hans Hoekstra');
});

test('member_state gaat gebonden de kolom in en is niet te verplaatsen', async () => {
  const a = await maakLid('Ida Idema');
  const b = await maakLid('Jan Jansen');
  accounts.saveMemberState(a.id, { dossier: 'van A', bsn: '123456789' });
  const ra = rij(a.id);
  assert.ok(String(ra.member_state).startsWith(gebonden.MERK2));
  assert.ok(!String(ra.member_state).includes('123456789'), 'het dossier staat versleuteld op schijf');
  assert.deepEqual(accounts.getMemberState(a.id), { dossier: 'van A', bsn: '123456789' });

  // het dossier van A naar de rij van B kopieren levert niets op
  zetRuw('member_state', b.id, ra.member_state);
  assert.equal(accounts.getMemberState(b.id), null, 'het dossier van A mag niet bij B opengaan');
});

test('de stand laat zien of de binding rond is', async () => {
  onderhoud.migreer(S.db);
  const s = onderhoud.stand(S.db);
  assert.equal(s.ongebonden, 0, 'na migreren staat alles gebonden: ' + JSON.stringify(s));
  assert.ok(s.gebonden >= 1);
  assert.ok(s.rijen >= s.gebonden);
});
