/* HET INTREKSIGNAAL, AANGEVALLEN (kern/intreksignaal.js).

   Dit is de laag waarlangs "intrekking wint" de andere processen bereikt. Een
   uitlog op instance A moet op instance B meteen gelden, en in een cluster is
   Redis daarvoor de gedeelde, vervallende autoriteit; lokaal blijft de
   intreklijst in SQLite (accounts/intreklijst.js) het herstelbewijs. Over de
   bus reist nooit een token: alleen een SHA-256-vinger of een niet-geheime
   sessie-id. Deze toets drijft de echte module met een nep-bus die zich als
   Redis voordoet, en met de nep-klok van node:test voor de hersteltimer -- er
   wordt nergens echt gewacht.

   Wat hier niet mag sneuvelen:
   1. een bericht van de bus dat niet van versie 1 is, al verlopen is, een
      ongeldige vinger of sid draagt of een onbekende soort heeft, trekt niets
      in (anders kan wie de bus beschrijft willekeurig sleutels vergiftigen), en
      de eigen echo wordt herkend;
   2. een geldige intrekking geldt tot haar vervaldatum en daarna niet meer
      (de lijst groeit niet eeuwig);
   3. een luisteraar die omvalt, houdt de andere luisteraars niet tegen: een
      kapotte realtimeverbinding mag niet verhinderen dat de rest sluit;
   4. tegen Redis is een intrekking pas duurzaam als bewaar() slaagt; faalt
      dat, of is de leiding niet gereed, dan zegt wachtDuurzaam() dat luid, en
      de stand gaat op niet-gereed;
   5. na een fout plant de module zelf herstel: zolang de bus niet gereed is
      blijft hij proberen, en zodra hij gereed is worden de opgeslagen
      intrekkingen opnieuw afgeleverd en wordt de stand weer gereed;
   6. een tweede bus wordt geweigerd (twee waarheden), een halve bus niet
      gekoppeld;
   7. over de bus gaat geen token, alleen een vinger.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in geldig() `Number(bericht.verloopt) <= Date.now()` vervangen door
     `false` -> "1. vergiftigde of verlopen busberichten" ZAKT (RAAK).
   - in lever() de try/catch rond `fn(...)` weggehaald -> "3. een omvallende
     luisteraar" ZAKT (RAAK): de tweede luisteraar hoort niets en de fout komt
     in de bus-callback terecht.
   - in planHerstel `if (!bus || typeof bus.gereed !== 'function' ||
     !bus.gereed()) return planHerstel();` vervangen door `return;`
     -> "5. herstel na een fout" ZAKT (RAAK): na een eerste niet-gerede tik
     wordt er nooit meer gehydrateerd.

   Draai: node --test test/intreksignaal-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const signaal = require('../server/kern/intreksignaal');

test.beforeEach(() => signaal._wis());
test.afterEach(() => signaal._wis());

const VINGER = 'a'.repeat(64);
const SID = 'abcdefghijkl';
const straks = () => Date.now() + 60000;

function redisBus(opties) {
  const o = Object.assign({ gereed: true }, opties || {});
  const b = {
    soort: 'redis', luisteraar: null, standFn: null, opgeslagen: [], gepubliceerd: [],
    bewaarFout: null, herhaalBerichten: [], isGereed: o.gereed,
    publish(k, m) { b.gepubliceerd.push(m); },
    subscribe(k, fn) { b.luisteraar = fn; },
    onStand(fn) { b.standFn = fn; },
    gereed() { return b.isGereed; },
    async bewaar(k, sleutel, bericht, ttl) {
      if (b.bewaarFout) throw b.bewaarFout;
      b.opgeslagen.push({ sleutel, bericht, ttl });
    },
    async herhaal() { return b.herhaalBerichten; }
  };
  return b;
}
async function totDat(fn) {
  for (let i = 0; i < 200 && !fn(); i++) await Promise.resolve();
  return fn();
}

test('1. vergiftigde of verlopen busberichten trekken niets in', () => {
  const bus = redisBus();
  assert.equal(signaal.koppelBus({ soort: 'lokaal', publish() {}, subscribe(k, fn) { bus.luisteraar = fn; } }), true);
  const gezien = [];
  signaal.abonneer(e => gezien.push(e));
  const ander = 'andere-instance';
  for (const slecht of [
    null, undefined, {},
    { versie: 2, bron: ander, soort: 'token', waarde: VINGER, verloopt: straks() },
    { versie: 1, bron: ander, soort: 'token', waarde: VINGER, verloopt: Date.now() - 1 },
    { versie: 1, bron: ander, soort: 'token', waarde: VINGER, verloopt: 'morgen' },
    { versie: 1, bron: ander, soort: 'token', waarde: 'het-token-zelf', verloopt: straks() },
    { versie: 1, bron: ander, soort: 'token', waarde: VINGER.toUpperCase(), verloopt: straks() },
    { versie: 1, bron: ander, soort: 'sessie', waarde: 'kort', verloopt: straks() },
    { versie: 1, bron: ander, soort: 'sessie', waarde: null, verloopt: straks() },
    { versie: 1, bron: ander, soort: 'gebruiker', waarde: SID, verloopt: straks() }
  ]) bus.luisteraar(slecht);
  assert.deepEqual(gezien, [], 'geen enkel ongeldig bericht wordt afgeleverd');
  assert.equal(signaal.sessieIngetrokken('kort'), false);
  bus.luisteraar({ versie: 1, bron: ander, soort: 'sessie', waarde: SID, verloopt: straks() });
  assert.equal(signaal.sessieIngetrokken(SID), true, 'een geldig bericht van elders wel');
  assert.deepEqual(gezien, [{ soort: 'sessie', waarde: SID }]);
});

test('1. de eigen echo wordt herkend en niet dubbel afgeleverd', () => {
  const uit = [];
  let luister = null;
  signaal.koppelBus({ soort: 'lokaal', publishDirect: (k, m) => uit.push(m), publish() { throw new Error('niet deze'); },
    subscribe(k, fn) { luister = fn; } });
  const gezien = [];
  signaal.abonneer(e => gezien.push(e));
  assert.equal(signaal.meldSessie(SID, straks()), true);
  assert.equal(uit.length, 1, 'via publishDirect');
  assert.equal(uit[0].envelop.classificatie, 'intern');
  luister(uit[0]); // de echo
  assert.equal(gezien.length, 1, 'de eigen echo telt niet nog eens');
});

test('2. een intrekking geldt tot haar vervaldatum en daarna niet meer', () => {
  const echt = Date.now;
  const t0 = echt();
  try {
    assert.equal(signaal.meldVinger(VINGER, t0 + 1000), true);
    assert.equal(signaal.meldSessie(SID, t0 + 1000), true);
    const token = 'x.' + 'b'.repeat(32);
    assert.equal(signaal.meldToken(token, t0 + 1000), true);
    assert.equal(signaal.tokenIngetrokken(token), true);
    Date.now = () => t0 + 2000;
    assert.equal(signaal.tokenIngetrokken(token), false, 'verlopen');
    assert.equal(signaal.sessieIngetrokken(SID), false);
    assert.equal(signaal.sessieIngetrokken(SID), false, 'en opgeruimd: ook een tweede keer niet');
  } finally { Date.now = echt; }
  assert.equal(signaal.meldToken('', straks()), false, 'een leeg token is geen intrekking');
  assert.equal(signaal.meldToken(42, straks()), false);
  assert.equal(signaal.meldVinger('geen vinger', straks()), false);
  assert.equal(signaal.meldSessie('', straks()), false);
  // zonder vervaldatum geldt een ruime standaard en is de intrekking er meteen
  assert.equal(signaal.meldSessie(SID), true);
  assert.equal(signaal.sessieIngetrokken(SID), true);
  assert.equal(signaal.meldVinger(VINGER), true);
  assert.equal(signaal.tokenIngetrokken('niet dit token'), false);
  // een sessietoken zonder expliciete vervaldatum leest hem uit de body
  const body = '7.' + straks() + '.1.' + SID;
  const sessieToken = Buffer.from(body).toString('base64url') + '.' + 'c'.repeat(32);
  assert.equal(signaal.meldToken(sessieToken), true);
  assert.equal(signaal.tokenIngetrokken(sessieToken), true);
});

test('2b. zonder vervaldatum leest de intrekking het verval van de juiste plek', () => {
  /* Op het aantal delen gokken las bij een oud sessietoken (`id.exp.uitgegeven`)
     de UITGIFTE als verval -- een tijd in het verleden, zodat de intrekking
     meteen verliep: fail-open. En bij een actietoken (`id.doel.exp.nonce`) las
     hij het doel. */
  const token = (body) => Buffer.from(body).toString('base64url') + '.' + crypto.randomBytes(16).toString('hex');
  const oudSessie = token('7.' + straks() + '.' + (Date.now() - 86400000));
  assert.equal(signaal.meldToken(oudSessie), true);
  assert.equal(signaal.tokenIngetrokken(oudSessie), true, 'een oud sessietoken blijft ingetrokken');
  const echt = Date.now;
  const t0 = echt();
  const actie = token('7.wachtwoord-herstel.' + (t0 + 5000) + '.n1');
  try {
    assert.equal(signaal.meldToken(actie), true);
    assert.equal(signaal.tokenIngetrokken(actie), true);
    Date.now = () => t0 + 6000;
    assert.equal(signaal.tokenIngetrokken(actie), false, 'het actietoken verloopt op zijn eigen exp, niet na dertig dagen');
  } finally { Date.now = echt; }
});

test('3. een omvallende luisteraar houdt de andere niet tegen', () => {
  const gezien = [], standen = [];
  signaal.abonneer(() => { throw new Error('websocket kapot'); });
  const weg = signaal.abonneer(e => gezien.push(e.soort));
  assert.equal(typeof signaal.abonneer('geen functie'), 'function');
  let eerste = true; // de aanmelding zelf mag gewoon slagen; daarna valt hij om
  signaal.bewaakStand(() => { if (eerste) { eerste = false; return; } throw new Error('ook kapot'); });
  signaal.bewaakStand(s => standen.push(s.soort));
  assert.equal(typeof signaal.bewaakStand(null), 'function');
  signaal.meldSessie(SID, straks());
  assert.deepEqual(gezien, ['sessie']);
  weg();
  signaal.meldVinger(VINGER, straks());
  assert.deepEqual(gezien, ['sessie'], 'na afmelden niets meer');
  signaal.koppelBus({ soort: 'lokaal', publish() {}, subscribe() {} });
  assert.deepEqual(standen, ['geen', 'lokaal'], 'de standwacht hoort de koppeling ondanks de kapotte buurman');
  assert.equal(signaal.stand().gereed, true, 'een lokale bus is meteen gereed');
});

test('4. tegen Redis is een intrekking pas duurzaam als bewaar slaagt', async () => {
  const bus = redisBus();
  assert.equal(signaal.koppelBus(bus), true);
  assert.equal(signaal.stand().gereed, false, 'Redis begint ongereed tot de replay klaar is');
  // niet gereed: de intrekking geldt lokaal, maar duurzaam is hij niet
  signaal.meldSessie(SID, straks());
  assert.equal(signaal.sessieIngetrokken(SID), true, 'lokaal sluit hij meteen');
  await assert.rejects(signaal.wachtDuurzaam(), /niet gereed/);
  signaal._wis();

  const b2 = redisBus();
  signaal.koppelBus(b2);
  b2.standFn({ soort: 'redis', gereed: true });
  assert.equal(await totDat(() => signaal.stand().gereed), true);
  const lokaalWeg = [], gedeeldWeg = [];
  signaal.koppelOutbox({ lijst: () => [], voltooi: (s) => { lokaalWeg.push(...s); return s.length; },
    gedeeldVoltooi: async (s) => { gedeeldWeg.push(...s); } });
  signaal.meldVinger(VINGER, straks());
  assert.deepEqual(lokaalWeg, [], 'de outboxregel blijft staan tot Redis bevestigt');
  assert.equal(await signaal.wachtDuurzaam(), true);
  assert.deepEqual(gedeeldWeg, ['token:' + VINGER], 'eerst de gedeelde outbox...');
  assert.deepEqual(lokaalWeg, ['token:' + VINGER], '...dan de lokale');
  assert.equal(b2.opgeslagen.length, 1);
  assert.equal(b2.opgeslagen[0].sleutel, signaal.PREFIX + 'token:' + VINGER);
  assert.ok(b2.opgeslagen[0].ttl > 0 && b2.opgeslagen[0].ttl <= 60000, 'de gedeelde rij vervalt met het token');
  b2.bewaarFout = new Error('READONLY replica');
  signaal.meldSessie(SID, straks());
  await assert.rejects(signaal.wachtDuurzaam(), /READONLY/);
  assert.equal(signaal.stand().gereed, false, 'na een mislukte bewaar is de leiding niet gereed');
  await assert.rejects(signaal.wachtDuurzaam(), /READONLY/, 'en dat blijft hij zeggen tot herstel');
});

test('5. herstel na een fout: blijft proberen, levert daarna de opgeslagen intrekkingen opnieuw af', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const bus = redisBus();
  signaal.koppelBus(bus);
  bus.standFn({ soort: 'redis', gereed: true });
  await totDat(() => signaal.stand().gereed);
  const outbox = [{ sleutel: 'sessie:' + SID, soort: 'sessie', waarde: SID, verloopt: straks() },
    { sleutel: 'sessie:verlopenoud1', soort: 'sessie', waarde: 'verlopenoud1', verloopt: Date.now() - 1 }];
  const voltooid = [], gedeeldVoltooid = [];
  /* een tweede instance had een intrekking alleen in de GEDEELDE outbox
     (PostgreSQL) gezet en viel daarna om: die moet ook mee */
  const gedeeld = [{ sleutel: 'sessie:vanelders12_', soort: 'sessie', waarde: 'vanelders12_', verloopt: straks() },
    { sleutel: 'sessie:' + SID, soort: 'sessie', waarde: SID, verloopt: straks() }];
  assert.equal(signaal.koppelOutbox({ lijst: () => outbox, voltooi: (s) => { voltooid.push(...s); return s.length; },
    gedeeld: async () => gedeeld, gedeeldVoltooi: async (s) => { gedeeldVoltooid.push(...s); } }), true);
  assert.equal(signaal.koppelOutbox({ lijst() {} }), false, 'een halve outbox wordt niet gekoppeld');
  assert.equal(signaal.koppelOutbox(null), false);

  bus.bewaarFout = new Error('verbinding weg');
  signaal.meldVinger(VINGER, straks());
  await assert.rejects(signaal.wachtDuurzaam());
  bus.isGereed = false;
  bus.bewaarFout = null;
  t.mock.timers.tick(500); // eerste herstelpoging: bus nog niet gereed, opnieuw plannen
  assert.equal(signaal.stand().gereed, false);
  bus.isGereed = true;
  bus.herhaalBerichten = [{ versie: 1, bron: 'elders', soort: 'token', waarde: 'd'.repeat(64), verloopt: straks() }];
  const afgeleverd = [];
  signaal.abonneer(e => afgeleverd.push(e.waarde));
  t.mock.timers.tick(500);
  assert.equal(await totDat(() => signaal.stand().gereed), true, 'na herstel weer gereed');
  assert.ok(afgeleverd.includes('d'.repeat(64)), 'wat Redis al wist, is na herstel ook hier ingetrokken');
  assert.equal(await signaal.wachtDuurzaam(), true, 'de fout is opgeruimd');
  assert.ok(gedeeldVoltooid.includes('sessie:vanelders12_'), 'de gedeelde outbox wordt pas na bewaar geleegd');
  assert.ok(bus.opgeslagen.some(r => r.sleutel === signaal.PREFIX + 'sessie:vanelders12_'));
  assert.equal(bus.opgeslagen.filter(r => r.sleutel === signaal.PREFIX + 'sessie:' + SID).length, 1,
    'dezelfde rij uit beide outboxen gaat een keer');
  assert.deepEqual(voltooid.filter(x => x !== 'sessie:vanelders12_').sort(), ['sessie:' + SID, 'sessie:verlopenoud1'].sort(),
    'de geldige rij is opnieuw bewaard, de verlopen rij is gewoon afgevoerd');
  assert.ok(bus.opgeslagen.some(r => r.sleutel === signaal.PREFIX + 'sessie:' + SID));
  assert.ok(!bus.opgeslagen.some(r => r.sleutel.endsWith('verlopenoud1')), 'een verlopen rij gaat niet naar Redis');
  // de replay uit Redis is lokaal afgeleverd
  assert.equal(signaal.sessieIngetrokken(SID), true);
});

test('5. een replay die faalt, plant opnieuw herstel en de stand blijft ongereed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const bus = redisBus();
  bus.herhaal = async () => { throw new Error('SCAN mislukt'); };
  signaal.koppelBus(bus);
  bus.standFn({ soort: 'redis', gereed: true });
  await totDat(() => false);
  assert.equal(signaal.stand().gereed, false);
  await assert.rejects(signaal.wachtDuurzaam(), /SCAN mislukt/);
  bus.herhaal = async () => [];
  t.mock.timers.tick(500);
  assert.equal(await totDat(() => signaal.stand().gereed), true, 'de geplande poging herstelt');
  // een niet-Redis-stand is meteen gereed; een transport dat niet gereed is wacht
  bus.standFn({ soort: 'redis', gereed: false });
  assert.equal(signaal.stand().gereed, false);
  bus.standFn({ soort: 'lokaal', gereed: false });
  assert.equal(signaal.stand().gereed, true);
  bus.standFn(null); // een lege standmelding valt terug op de soort van de bus zelf
  assert.equal(signaal.stand().soort, 'redis');
  assert.equal(signaal.stand().gereed, false, 'zonder transport geen gereedheid');
});

test('6. een tweede bus wordt geweigerd, een halve niet gekoppeld', () => {
  assert.equal(signaal.koppelBus(undefined), false);
  assert.equal(signaal.koppelBus(null), false, 'geen bus is geen geslaagde koppeling');
  assert.equal(signaal.koppelBus({ publish() {} }), false);
  assert.equal(signaal.stand().gekoppeld, false);
  const bus = { publish() {}, subscribe() {} };
  assert.equal(signaal.koppelBus(bus), true);
  assert.equal(signaal.koppelBus(bus), true, 'dezelfde bus opnieuw is geen tweede waarheid');
  assert.throws(() => signaal.koppelBus({ publish() {}, subscribe() {} }), /twee waarheden/);
  assert.equal(signaal.stand().soort, 'onbekend', 'een bus zonder soort heet onbekend');
});

test('7. over de bus gaat geen token, alleen een vinger', async () => {
  const bus = redisBus();
  signaal.koppelBus(bus);
  bus.standFn({ soort: 'redis', gereed: true });
  await totDat(() => signaal.stand().gereed);
  const token = Buffer.from('7.' + straks() + '.1.' + SID).toString('base64url') + '.' + 'e'.repeat(32);
  signaal.meldToken(token, straks());
  await signaal.wachtDuurzaam();
  const alles = JSON.stringify(bus.opgeslagen);
  assert.ok(!alles.includes(token), 'het token zelf reist niet');
  assert.ok(!alles.includes(token.split('.')[0]));
  assert.ok(alles.includes(crypto.createHash('sha256').update(token).digest('hex')));
  // bereid weigert een rij die geen geldige intrekking is
  await assert.rejects(signaal.bereid({ soort: 'token', waarde: token, verloopt: straks() }), /ongeldige intrekking/);
  await assert.rejects(signaal.bereid(null), /ongeldige intrekking/);
  const gedeeld = [];
  signaal.koppelOutbox({ lijst: () => [], voltooi: () => 0, deel: async (r) => { gedeeld.push(r.sleutel); } });
  assert.equal(await signaal.bereid({ sleutel: 'sessie:' + SID, soort: 'sessie', waarde: SID, verloopt: straks() }), true);
  assert.deepEqual(gedeeld, ['sessie:' + SID], 'de gedeelde outbox krijgt hem voor de melding');
});
