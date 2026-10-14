/* SESSIETOKENS EN DE INTREKLIJST, AANGEVALLEN (accounts/tokens.js en
   accounts/intreklijst.js).

   Een sessietoken is hier staatloos: `<base64url body>.<32 hex HMAC>`, met in de
   body id, vervaldatum, uitgiftemoment, sessie-id en eventueel een apparaat.
   Dat het staatloos is, maakt de intreklijst tot de enige plek waar "uitgelogd"
   werkelijk iets betekent. Deze toets zet de echte tokenfabriek op een echte
   (in-memory) SQLite-database met de echte migraties, en valt hem aan zoals een
   indringer dat zou doen: een veranderde body, een verplaatste handtekening, een
   token met een spatie ervoor, een verlopen token, een ingetrokken token of
   sessie, en een database die na een herstart alleen nog zijn eigen geheugen
   heeft.

   Wat hier niet mag sneuvelen:
   1. alleen de exacte vorm die wij uitgeven is een token: een spatie, een
      hoofdletter in de handtekening of een derde punt maakt hem ongeldig, ook
      als base64url de rest zou negeren;
   2. een herschreven body (ander id, latere vervaldatum, ander apparaat) of een
      andere sleutel laat de handtekening zakken -- ook voor apparaatVanToken,
      dat een BEVOEGDHEID leest en dus nooit een ongetekend veld mag teruggeven;
   3. een actietoken (`id.doel.exp.nonce`), ook als het met de sessiesleutel is
      getekend, gaat nooit door voor een sessie;
   4. intrekking wint: een ingetrokken token of sessie-id telt niet meer, ook
      niet na een herstart waarin het geheugen van het proces leeg is, en de
      intrekking van de ene sessie raakt de andere sessie van hetzelfde lid niet;
   5. de sessiegrens (wachtwoord gewijzigd) en een uitgezet account winnen van
      een geldige handtekening;
   6. een intrekking voor een al verlopen token schrijft niets en meldt toch
      succes; een actietoken met een ander doel wordt NIET aangeraakt;
   7. de lijst ruimt verlopen rijen op tijdens het intrekken, en een rij die
      verlopen is telt niet meer als ingetrokken;
   8. een intrekking die niet bij de gedeelde autoriteit (Redis) is beland, blijft
      in de outbox staan en wordt na herstel opnieuw afgeleverd; pas daarna
      verdwijnt hij uit de outbox;
   9. een opslag die niet aantoonbaar werkt (leesfout, schrijffout, ontbrekende
      Redis-leiding) is nooit hetzelfde als "niet ingetrokken".

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in intreklijst.js trekInActie de doelcontrole
     `if (doel !== undefined && delen[1] !== String(doel)) return false;`
     verwijderd -> "6. een actietoken met een ander doel" ZAKT (RAAK): de
     intrekking schrijft dan een rij voor een token dat hij niet mocht raken.
   - in tokens.js apparaatVanToken de regel
     `if (!veiligGelijk(kluis.sign(body), sig)) return null;` verwijderd
     -> "2. apparaatVanToken leest alleen een getekend apparaat" ZAKT (RAAK):
     een herschreven body levert dan het gekozen toestelkenmerk op.
   - in intreklijst.js sessieIngetrokken `>= klok.nu()` vervangen door `true`
     (verlopen rijen tellen mee) -> "7. een verlopen rij telt niet meer" ZAKT
     (RAAK).

   Draai: node --test test/tokens-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const migraties = require('../server/migraties');
const S = require('../server/accounts/state');
const kluis = require('../server/accounts/kluis');
const signaal = require('../server/kern/intreksignaal');

const oud = { db: S.db, SECRET: S.SECRET, VAULT: S.VAULT, zin: S.zin, nu: Date.now, redis: process.env.REDIS_URL };
const leden = new Map();
let db;

function vers() {
  signaal._wis();
  db = new DatabaseSync(':memory:');
  migraties.draai(db);
  S.db = db;
  S.SECRET = crypto.randomBytes(32);
  S.VAULT = crypto.randomBytes(32);
  leden.clear();
  leden.set(7, { id: 7, codename: 'Zilveren Valk 1A2B', actief: 1, sessies_vanaf: 0 });
  leden.set(8, { id: 8, codename: 'Gouden Ibis 3C4D', actief: 1, sessies_vanaf: 0 });
  return require('../server/accounts/tokens').maakTokens((id) => leden.get(id) || null);
}
test.beforeEach(() => { delete process.env.REDIS_URL; });
test.afterEach(() => {
  Date.now = oud.nu;
  S.zin = oud.zin;
  if (db) { try { db.close(); } catch (e) {} db = null; }
  S.db = oud.db; S.SECRET = oud.SECRET; S.VAULT = oud.VAULT;
  if (oud.redis === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oud.redis;
  signaal._wis();
});

const body = (t) => Buffer.from(t.split('.')[0], 'base64url').toString();
const teken = (b) => Buffer.from(b).toString('base64url') + '.' + kluis.sign(b);
const rijen = (tabel) => db.prepare('SELECT COUNT(*) AS n FROM ' + tabel).get().n;

test('1. alleen de exacte vorm die wij uitgeven is een token', () => {
  const T = vers();
  const t = T.issueToken(7);
  assert.match(t, /^[A-Za-z0-9_-]+\.[a-f0-9]{32}$/);
  assert.equal(T.verifyToken(t).id, 7, 'het echte token werkt');
  for (const variant of [' ' + t, t + ' ', t + '\n', t.toUpperCase(), t + '.x',
    t.replace('.', '..'), t.slice(0, -1), '', null, undefined, 42, { toString: () => t }]) {
    assert.equal(T.verifyToken(variant), null, 'geen token: ' + JSON.stringify(String(variant)).slice(0, 30));
    assert.equal(T.sessieVan(variant), null);
    assert.equal(T.apparaatVanToken(variant), null);
  }
  // isIngetrokken behandelt een vreemde vorm als ongeldig (fail-closed)
  assert.equal(T.isIngetrokken(' ' + t), true);
  assert.equal(T.isIngetrokken(t), false);
});

test('2. een herschreven body of een andere sleutel laat de handtekening zakken', () => {
  const T = vers();
  const t = T.issueToken(7, 1);
  const [id, exp, uit, sid] = body(t).split('.');
  const sig = t.split('.')[1];
  // ander lid, zelfde handtekening
  const ander = Buffer.from(['8', exp, uit, sid].join('.')).toString('base64url') + '.' + sig;
  assert.equal(T.verifyToken(ander), null, 'een ander id onder dezelfde handtekening is vals');
  // langere looptijd, zelfde handtekening
  const langer = Buffer.from([id, Number(exp) + 86400000 * 365, uit, sid].join('.')).toString('base64url') + '.' + sig;
  assert.equal(T.verifyToken(langer), null, 'een verlengde vervaldatum is vals');
  // een geldige handtekening onder een andere sleutel
  const echt = T.verifyToken(t);
  assert.equal(echt.id, 7);
  S.SECRET = crypto.randomBytes(32);
  assert.equal(T.verifyToken(t), null, 'na sleutelwissel geldt het oude token niet meer');
});

test('2. apparaatVanToken leest alleen een getekend apparaat', () => {
  const T = vers();
  const app = 'ab12cd34'.repeat(4);
  const t = T.issueToken(7, 30, app + 'ZZ-extra');
  assert.equal(T.apparaatVanToken(t), app, 'alleen hex, hooguit 32 tekens');
  assert.equal(body(t).split('.').length, 5);
  assert.equal(T.verifyToken(t).id, 7, 'een vijfdelig token is een geldige sessie');
  // een kenmerk zonder enig hexteken levert geen vijfde deel op
  const zonder = T.issueToken(7, 30, 'xyz!');
  assert.equal(body(zonder).split('.').length, 4);
  assert.equal(T.apparaatVanToken(zonder), null);
  assert.equal(T.apparaatVanToken(T.issueToken(7)), null, 'een wachtwoordinlog kent geen toestel');
  // een ander apparaat in de body schrijven, handtekening behouden
  const delen = body(t).split('.');
  delen[4] = 'f'.repeat(32);
  const vals = Buffer.from(delen.join('.')).toString('base64url') + '.' + t.split('.')[1];
  assert.equal(T.apparaatVanToken(vals), null, 'een gekozen toestelkenmerk is geen bevoegdheid');
  // correct getekend, maar het vijfde deel is geen hex: geen apparaat
  const raar = teken(delen.slice(0, 4).join('.') + '.GG');
  assert.equal(T.apparaatVanToken(raar), null);
});

test('3. de sessie-id is aanwijsbaar, maar alleen in een sessievorm', () => {
  const T = vers();
  const t = T.issueToken(7);
  const sid = T.sessieVan(t);
  assert.match(sid, /^[A-Za-z0-9_-]{12}$/);
  assert.equal(sid, body(t).split('.')[3]);
  // een oud driedelig token heeft geen sid maar is nog steeds geldig
  const oudT = teken('7.' + (Date.now() + 60000) + '.' + Date.now());
  assert.equal(T.sessieVan(oudT), null);
  assert.equal(T.verifyToken(oudT).id, 7, 'terugwaarts: een token zonder sid blijft gelden');
  // een sid met de verkeerde lengte is geen sid
  assert.equal(T.sessieVan(teken('7.' + (Date.now() + 60000) + '.1.kort')), null);
  // een actietokenvorm is geen sessie
  assert.equal(T.sessieVan(teken('7.verify-email.' + (Date.now() + 60000) + '.abcdefghijkl')), null);
});

test('3. een actietoken gaat nooit door voor een sessie, ook niet met de sessiesleutel', () => {
  const T = vers();
  const exp = Date.now() + 60000;
  assert.equal(T.verifyToken(teken('7.2fa.' + exp + '.abcdefghijkl')), null);
  assert.equal(T.verifyToken(teken('7.' + exp + '.nietcijfers.abcdefghijkl')), null);
  assert.equal(T.verifyToken(teken('x.' + exp)), null);
  assert.equal(T.verifyToken(teken('7.')), null, 'zonder vervaldatum geen sessie');
  // en de echte actietoken-uitgifte geeft niets dat verifyToken aanvaardt
  const actie = T.issueActionToken(7, 'verify-email', 60000);
  assert.ok(actie, 'actietoken uitgegeven');
  assert.equal(T.verifyToken(actie), null);
});

test('4. verlopen en onbekende leden vallen af', () => {
  const T = vers();
  const t = T.issueToken(7, 1);
  const t0 = Date.now();
  Date.now = () => t0 + 86400000 + 1;
  assert.equal(T.verifyToken(t), null, 'een dag na uitgifte is een eendagstoken verlopen');
  Date.now = oud.nu;
  assert.equal(T.verifyToken(T.issueToken(99)), null, 'een token voor een onbekend lid geeft niemand terug');
  const T2 = require('../server/accounts/tokens').maakTokens(() => { throw new Error('accountopslag kapot'); });
  assert.equal(T2.verifyToken(T2.issueToken(7)), null, 'een omvallende opzoeking geeft geen lid terug');
});

test('4. intrekking wint, ook na een herstart met leeg geheugen', async () => {
  const T = vers();
  const a = T.issueToken(7);
  const b = T.issueToken(7);
  assert.equal(await T.trekIn(a), true);
  assert.equal(T.verifyToken(a), null, 'uitgelogd token werkt niet meer');
  assert.equal(T.verifyToken(b).id, 7, 'de andere sessie van hetzelfde lid blijft');
  assert.equal(rijen('ingetrokken_tokens'), 1);
  assert.equal(rijen('intrekking_outbox'), 1);
  const outbox = db.prepare('SELECT soort, waarde FROM intrekking_outbox').get();
  assert.equal(outbox.soort, 'token');
  assert.equal(outbox.waarde, signaal.vingerVanToken(a), 'de outbox draagt een vinger, nooit het token');
  assert.ok(!JSON.stringify(outbox).includes(a));

  signaal._wis(); // herstart: het procesgeheugen is leeg, alleen de database weet het nog
  assert.equal(signaal.tokenIngetrokken(a), false);
  assert.equal(T.isIngetrokken(a), true, 'de database is het herstelbewijs');
  assert.equal(T.verifyToken(a), null);
});

test('4. een ingetrokken sessie-id sluit die sessie en geen andere', async () => {
  const T = vers();
  const a = T.issueToken(7);
  const b = T.issueToken(7);
  const sid = T.sessieVan(a);
  assert.equal(await T.trekInSessie(sid, Date.now() + 60000), true);
  assert.equal(T.verifyToken(a), null);
  assert.equal(T.verifyToken(b).id, 7);
  signaal._wis();
  assert.equal(T.sessieIngetrokken(sid), true, 'ook na herstart uit de database');
  assert.equal(T.verifyToken(a), null);
  // de sessienaamruimte is gescheiden van de tokennaamruimte
  assert.equal(T.isIngetrokken(a), false, 'het TOKEN zelf is niet ingetrokken, de sessie wel');
  // ongeldige sids worden geweigerd en nooit als ingetrokken gelezen
  for (const fout of ['kort', 'a'.repeat(13), 'abc def ghij', 12, null]) {
    assert.equal(await T.trekInSessie(fout, Date.now() + 60000), false);
    assert.equal(T.sessieIngetrokken(fout), false);
  }
});

test('5. de sessiegrens en een uitgezet account winnen van een geldige handtekening', () => {
  const T = vers();
  const t = T.issueToken(7);
  const uit = Number(body(t).split('.')[2]);
  leden.get(7).sessies_vanaf = uit + 1;
  assert.equal(T.verifyToken(t), null, 'uitgegeven voor de grens: weg');
  leden.get(7).sessies_vanaf = uit;
  assert.equal(T.verifyToken(t).id, 7, 'op de grens zelf blijft hij gelden');
  leden.get(7).actief = 0;
  assert.equal(T.verifyToken(t), null, 'uitgezet account');
  // een oud token zonder uitgiftemoment valt af zodra er ooit een grens is
  leden.get(7).actief = 1; leden.get(7).sessies_vanaf = 1;
  assert.equal(T.verifyToken(teken('7.' + (Date.now() + 60000))), null);
});

test('6. een al verlopen of vormloos token intrekken schrijft niets', async () => {
  const T = vers();
  assert.equal(await T.trekIn('geen token'), false);
  assert.equal(await T.trekIn(teken('7.' + (Date.now() - 1) + '.1.abcdefghijkl')), true, 'verlopen: niets te onthouden');
  assert.equal(await T.trekIn(teken('7.geen-getal.1')), true);
  assert.equal(await T.trekInSessie('abcdefghijkl', Date.now() - 1), true);
  assert.equal(await T.trekInSessie('abcdefghijkl'), true, 'zonder vervaldatum: niets');
  assert.equal(rijen('ingetrokken_tokens'), 0);
  assert.equal(rijen('intrekking_outbox'), 0);
});

test('6. een actietoken met een ander doel wordt niet aangeraakt', async () => {
  const T = vers();
  const actie = T.issueActionToken(7, 'sso-overdracht', 60000);
  assert.equal(await T.trekInActie(actie, 'verify-email'), false, 'ander doel: niet aan zitten');
  assert.equal(rijen('ingetrokken_tokens'), 0);
  assert.equal(T.verifyActionToken(actie, 'sso-overdracht').id, 7, 'het token werkt nog');
  assert.equal(await T.trekInActie(actie, 'sso-overdracht'), true);
  assert.equal(rijen('ingetrokken_tokens'), 1);
  assert.equal(T.verifyActionToken(actie, 'sso-overdracht'), null, 'eenmalig: na intrekken niet meer');
  assert.equal(T.isIngetrokken(actie), true);
  // zonder doel leest hij gewoon de vervaldatum op plek drie
  const tweede = T.issueActionToken(7, 'sso-overdracht', 60000);
  assert.equal(await T.trekInActie(tweede), true);
  assert.equal(rijen('ingetrokken_tokens'), 2);
  assert.equal(await T.trekInActie('vormloos', 'x'), false);
  assert.equal(await T.trekInActie(teken('7.x.' + (Date.now() - 5) + '.n'), 'x'), true, 'verlopen actietoken: niets');
  assert.equal(rijen('ingetrokken_tokens'), 2);
});

test('7. een verlopen rij telt niet meer en wordt bij het intrekken opgeruimd', async () => {
  const T = vers();
  const t0 = Date.now();
  const kort = teken('7.' + (t0 + 1000) + '.' + t0 + '.abcdefghijkl');
  assert.equal(await T.trekIn(kort), true);
  assert.equal(await T.trekInSessie('mnopqrstuvwx', t0 + 1000), true);
  assert.equal(T.isIngetrokken(kort), true);
  signaal._wis();
  Date.now = () => t0 + 2000;
  assert.equal(T.isIngetrokken(kort), false, 'na de vervaldatum telt de rij niet meer');
  assert.equal(T.sessieIngetrokken('mnopqrstuvwx'), false);
  assert.equal(rijen('ingetrokken_tokens'), 2, 'nog niet opgeruimd');
  const lang = T.issueToken(7);
  assert.equal(await T.trekIn(lang), true);
  assert.equal(rijen('ingetrokken_tokens'), 1, 'de volgende intrekking ruimt verlopen rijen op');
  assert.equal(rijen('intrekking_outbox'), 1);
});

test('8. de outbox blijft staan tot de gedeelde autoriteit hem heeft, en wordt na herstel opnieuw afgeleverd', async () => {
  const T = vers();
  const opgeslagen = [];
  let standFn = null;
  let bewaarKapot = true;
  const bus = { soort: 'redis', publish() {}, subscribe() {},
    onStand(fn) { standFn = fn; },
    gereed: () => true,
    async bewaar(kanaal, sleutel, bericht, ttl) {
      if (bewaarKapot) throw new Error('redis weg');
      assert.ok(ttl > 0, 'de gedeelde rij vervalt met het token');
      opgeslagen.push(sleutel);
    },
    async herhaal() { return []; } };
  assert.equal(signaal.koppelBus(bus), true);
  standFn({ soort: 'redis', gereed: true });
  const lees = () => signaal.stand();
  // hydrateren is async: wachten tot de leiding gereed meldt (zonder slaap)
  for (let i = 0; i < 50 && !lees().gereed; i++) await Promise.resolve();
  assert.equal(lees().gereed, true);

  const t = T.issueToken(7);
  await assert.rejects(T.trekIn(t), /redis weg/, 'een niet-duurzame intrekking is geen succes');
  assert.equal(rijen('intrekking_outbox'), 1, 'de outbox houdt hem vast');
  assert.equal(T.verifyToken(t), null, 'lokaal is hij wel meteen ingetrokken');

  bewaarKapot = false;
  standFn({ soort: 'redis', gereed: true }); // herverbinding
  for (let i = 0; i < 50 && rijen('intrekking_outbox'); i++) await Promise.resolve();
  assert.equal(rijen('intrekking_outbox'), 0, 'na een geslaagde herhaling is de outbox leeg');
  assert.deepEqual(opgeslagen, [signaal.PREFIX + 'token:' + signaal.vingerVanToken(t)]);

  // een rechtstreekse intrekking met een gezonde leiding wist zijn outboxregel zelf
  process.env.REDIS_URL = 'redis://proef';
  const t2 = T.issueToken(8);
  assert.equal(await T.trekIn(t2), true);
  assert.equal(rijen('intrekking_outbox'), 0);
  assert.equal(T.verifyToken(t2), null);
  assert.equal(T.verifyToken(T.issueToken(8)).id, 8, 'met een gereede leiding werkt een gewoon token');
});

test('9. de outbox weigert op te ruimen zonder database en geeft een lege lijst', () => {
  vers();
  let bron = null;
  const echt = signaal.koppelOutbox;
  signaal.koppelOutbox = (b) => { bron = b; return true; };
  try { require('../server/accounts/intreklijst')(x => x); } finally { signaal.koppelOutbox = echt; }
  S.db = null;
  assert.deepEqual(bron.lijst(), []);
  assert.equal(bron.voltooi(['token:x']), 0);
  S.db = db;
  db.prepare("INSERT INTO intrekking_outbox (sleutel, soort, waarde, verloopt) VALUES ('sessie:abcdefghijkl','sessie','abcdefghijkl',?)").run(Date.now() + 60000);
  db.prepare("INSERT INTO intrekking_outbox (sleutel, soort, waarde, verloopt) VALUES ('sessie:oudoudoudoud','sessie','oudoudoudoud',?)").run(Date.now() - 60000);
  assert.deepEqual(bron.lijst().map(r => r.sleutel), ['sessie:abcdefghijkl'], 'verlopen outboxregels gaan niet meer de deur uit');
  assert.equal(bron.voltooi(['sessie:abcdefghijkl', 'sessie:bestaatniet']), 1);
  assert.equal(bron.voltooi(null), 0);
});

test('9. onzekere opslag is nooit "niet ingetrokken"', async () => {
  const T = vers();
  const t = T.issueToken(7);
  process.env.REDIS_URL = 'redis://niet-gekoppeld';
  assert.throws(() => T.isIngetrokken(t), e => e.code === 'INTREKOPSLAG_ONZEKER');
  assert.equal(T.verifyToken(t), null, 'zonder aantoonbare leiding geen toegang');
  delete process.env.REDIS_URL;
  S.zin = () => { throw new Error('schijf vol'); };
  await assert.rejects(T.trekInActie(T.issueActionToken(7, 'sso-overdracht', 60000), 'sso-overdracht'),
    e => e.code === 'INTREKOPSLAG_ONZEKER');
  await assert.rejects(T.trekInSessie('abcdefghijkl', Date.now() + 60000), e => e.code === 'INTREKOPSLAG_ONZEKER');
  assert.throws(() => T.sessieIngetrokken('abcdefghijkl'), e => e.code === 'INTREKOPSLAG_ONZEKER');
  S.zin = oud.zin;
  // een sid die al in het procesgeheugen staat, is ingetrokken zonder de schijf te raadplegen
  signaal.meldSessie('abcdefghijkl', Date.now() + 60000);
  S.zin = () => { throw new Error('schijf weg'); };
  assert.equal(T.sessieIngetrokken('abcdefghijkl'), true);
});

test('9. een handle zonder exec (adapter) schrijft zonder eigen transactie, en een mislukte commit rolt terug', async () => {
  const T = vers();
  const echt = db;
  // adapter zonder exec: geen BEGIN eromheen, de rijen komen er toch
  S.db = { prepare: (sql) => echt.prepare(sql) };
  assert.equal(await T.trekIn(T.issueToken(7)), true);
  S.db = echt;
  assert.equal(rijen('ingetrokken_tokens'), 1);
  // een COMMIT die faalt: de fout komt boven en er blijft geen halve intrekking
  const proxy = new Proxy(echt, { get(doel, naam) {
    if (naam === 'exec') return (sql) => { if (sql === 'COMMIT') throw new Error('commit faalt'); return doel.exec(sql); };
    const v = doel[naam]; return typeof v === 'function' ? v.bind(doel) : v;
  } });
  S.db = proxy;
  const t = T.issueToken(8);
  await assert.rejects(T.trekIn(t), e => /commit faalt/.test(e.message) && e.code === 'INTREKOPSLAG_ONZEKER');
  S.db = echt;
  assert.equal(rijen('ingetrokken_tokens'), 1, 'de tweede intrekking is teruggedraaid');
});

test('9. binnen een accountverzoek landt de intrekking in de werkkopie, zonder tweede transactie', async () => {
  const T = vers();
  const transactie = require('../server/accounts/transactie');
  const werk = new DatabaseSync(':memory:');
  migraties.draai(werk);
  const echtDatabase = transactie.database;
  const echtExec = db.exec.bind(db);
  let beginOpHoofd = 0;
  db.exec = (sql) => { if (/BEGIN/.test(sql)) beginOpHoofd++; return echtExec(sql); };
  transactie.database = () => werk;
  try {
    assert.equal(await T.trekIn(T.issueToken(7)), true);
  } finally { transactie.database = echtDatabase; delete db.exec; }
  assert.equal(beginOpHoofd, 0, 'geen BEGIN op de bevestigde cache terwijl de werkkopie open staat');
  assert.equal(werk.prepare('SELECT COUNT(*) AS n FROM ingetrokken_tokens').get().n, 1);
  assert.equal(rijen('ingetrokken_tokens'), 0, 'de hoofdhandle is (nog) niet aangeraakt');
  werk.close();
});

test('9. de outbox wordt niet gewist zolang een accountmutatie nog bevestigd wordt', () => {
  vers();
  let bron = null;
  const echt = signaal.koppelOutbox;
  signaal.koppelOutbox = (b) => { bron = b; return true; };
  try { require('../server/accounts/intreklijst')(x => x); } finally { signaal.koppelOutbox = echt; }
  db.prepare("INSERT INTO intrekking_outbox (sleutel, soort, waarde, verloopt) VALUES ('sessie:abcdefghijkl','sessie','abcdefghijkl',?)").run(Date.now() + 60000);
  const transactie = require('../server/accounts/transactie');
  const echtBezet = transactie.bezet;
  transactie.bezet = () => true;
  try { assert.equal(bron.voltooi(['sessie:abcdefghijkl']), 0); } finally { transactie.bezet = echtBezet; }
  assert.equal(rijen('intrekking_outbox'), 1, 'de regel blijft tot de mutatie klaar is');
  assert.equal(bron.voltooi(['sessie:abcdefghijkl']), 1);
});

test('9. een leesfout bij het token zelf en een falende ROLLBACK maskeren de oorzaak niet', async () => {
  const T = vers();
  const t = T.issueToken(7);
  S.zin = () => { throw new Error('index corrupt'); };
  assert.throws(() => T.isIngetrokken(t), e => e.code === 'INTREKOPSLAG_ONZEKER' && /index corrupt/.test(e.message));
  S.zin = oud.zin;
  const echt = db;
  S.db = new Proxy(echt, { get(doel, naam) {
    if (naam === 'exec') return (sql) => { if (sql === 'COMMIT' || sql === 'ROLLBACK') throw new Error(sql + ' faalt'); return doel.exec(sql); };
    const v = doel[naam]; return typeof v === 'function' ? v.bind(doel) : v;
  } });
  await assert.rejects(T.trekIn(t), e => /COMMIT faalt/.test(e.message), 'de oorspronkelijke fout komt boven, niet die van de rollback');
  S.db = echt;
  try { echt.exec('ROLLBACK'); } catch (e) {}
});
