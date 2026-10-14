/* DE SESSIE-OPSLAG, AANGEVALLEN (kern/sessies.js).

   Werksessies (kantoor, leverancier, werkplek) bestaan alleen als record: een
   Map in het geheugen, gespiegeld in db.data.sessions, met als sleutel de
   SHA-256 van het token. Wie de database in handen krijgt, heeft geen bruikbaar
   token; wie de realtimebus kan beschrijven, mag er geen sessie mee planten; en
   een sessie die is ingetrokken -- op token of op sessie-id -- komt niet terug.
   Deze toets drijft de echte fabriek met een eigen klok (Date vervangen en
   altijd teruggezet) en een nep-bus die precies vastlegt wat er de deur uitgaat.

   Wat hier niet mag sneuvelen:
   1. alleen de hash van het token staat in de opslag en op de bus, nooit het
      token zelf; een bericht zonder sessie is als 'intern' geclassificeerd en
      een met sessie als 'persoonsgegeven';
   2. een sessie die dertig dagen niet is gebruikt bestaat niet meer, en het
      venster schuift alleen op bij gebruik (hooguit eens per uur wegschrijven);
   3. een intrekking op de sessie-id sluit ook een recordsessie, en een
      ingetrokken token (centrale replay) wint van een oude snapshot;
   4. een bericht op de bus dat niet van versie 1 is, van onszelf komt, een
      ongeldige hash draagt of een kapotte/te grote sessie meebrengt, verandert
      niets; een tweede of halve bus wordt geweigerd;
   5. een kapotte snapshot (sessions geen object, of een array) wordt een lege
      bak in plaats van een crash, en herbouwen neemt alleen geldige records
      over;
   6. expliciet uitloggen van een onbekende of vormloze hash meldt geen succes;
   7. binnen een verzoek wordt een sessie pas na de commit zichtbaar.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in sessionFor de regel
     `if (sess.sid && typeof sessieIngetrokken === 'function' && sessieIngetrokken(sess.sid))`
     vervangen door `if (false)` -> "3. een sid-intrekking sluit ook een
     recordsessie" ZAKT (RAAK).
   - in koppelBus `bericht.bron === bron ||` weggehaald -> "4. de eigen echo"
     ZAKT (RAAK): de eigen echo zet dan een oude sessie terug.
   - in geldigeSessie de grens `<= 16 * 1024` vervangen door `true`
     -> "4. vergiftigde busberichten" ZAKT (RAAK).

   Draai: node --test test/sessies-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakSessies, tokenHash, TOKEN_TTL_MS } = require('../server/kern/sessies');
const signaal = require('../server/kern/intreksignaal');
const verzoekcontext = require('../server/db/verzoekcontext');

const EchtDate = Date;
const echtNu = Date.now;
const oudRedis = process.env.REDIS_URL;
let t0;
test.beforeEach(() => { signaal._wis(); delete process.env.REDIS_URL; t0 = echtNu(); });
test.afterEach(() => {
  global.Date = EchtDate;
  Date.now = echtNu;
  if (oudRedis === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oudRedis;
  signaal._wis();
});
/* klok.datum() doet `new Date()` en klok.nu() doet Date.now(): allebei verzetten,
   anders loopt de vervaldatum op de ene klok en de leeftijd op de andere. */
const zetKlok = (ms) => {
  class NepDate extends EchtDate {
    constructor(...a) { if (a.length) super(...a); else super(t0 + ms); }
    static now() { return t0 + ms; }
  }
  global.Date = NepDate;
};

function opslag(extra) {
  const db = { data: { sessions: {} } };
  let saves = 0, sleutels = [];
  const save = () => { saves++; };
  save.sleutels = (k) => { saves++; sleutels.push(k.join(',')); };
  const s = maakSessies(Object.assign({ db, save, crypto }, extra || {}));
  return { s, db, saves: () => saves, sleutels: () => sleutels };
}
function nepBus(metDirect) {
  const uit = [];
  let luisteraar = null;
  const bus = { publish: (k, b) => uit.push({ k, b, via: 'publish' }),
    subscribe: (k, fn) => { luisteraar = fn; } };
  if (metDirect) bus.publishDirect = (k, b) => uit.push({ k, b, via: 'direct' });
  return { bus, uit, stuur: (b) => luisteraar(b) };
}

test('1. alleen de hash staat in de opslag en op de bus, met de juiste classificatie', () => {
  const { s, db, sleutels } = opslag();
  const { bus, uit } = nepBus(true);
  assert.equal(s.koppelBus(bus), true);
  s.rememberSession('geheim-token-123', { tier: 'kantoor', key: 'K1' });
  const h = tokenHash('geheim-token-123');
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(db.data.sessions), [h]);
  assert.ok(!JSON.stringify(db.data).includes('geheim-token-123'), 'het token zelf staat nergens');
  assert.ok(!JSON.stringify(uit).includes('geheim-token-123'));
  assert.match(db.data.sessions[h].sid, /^[A-Za-z0-9_-]{12}$/, 'elke recordsessie krijgt een sid');
  assert.deepEqual(sleutels(), ['sessions'], 'alleen de sessies worden weggeschreven');
  assert.equal(uit.length, 1);
  assert.equal(uit[0].via, 'direct', 'een login gaat met publishDirect als die er is');
  assert.equal(uit[0].b.actie, 'zet');
  assert.equal(uit[0].b.envelop.classificatie, 'persoonsgegeven');
  s.forgetSession(h);
  assert.equal(uit[1].b.actie, 'weg');
  assert.equal(uit[1].b.envelop.classificatie, 'intern', 'alleen een verdwijnende hash');
  assert.equal(uit[1].b.sess, undefined);
  assert.equal(s.sessionFor('geheim-token-123'), null);
  // een vooraf gezette sid blijft staan
  s.rememberSession('t2', { tier: 'kantoor', sid: 'vastesid1234' });
  assert.equal(s.sessionFor('t2').sid, 'vastesid1234');
});

test('1. zonder publishDirect gaat het via publish, en zonder save.sleutels via save()', () => {
  const db = { data: {} };
  let saves = 0;
  const s = maakSessies({ db, save: () => { saves++; }, crypto });
  const { bus, uit } = nepBus(false);
  s.koppelBus(bus);
  s.rememberSession('tok', { tier: 'rtg' });
  assert.equal(saves, 1);
  assert.equal(uit[0].via, 'publish');
  assert.ok(db.data.sessions, 'de bak wordt aangemaakt als hij ontbrak');
});

test('2. dertig dagen stilte is uitgelogd; gebruik schuift het venster, hooguit eens per uur', () => {
  const { s, db, saves } = opslag();
  s.rememberSession('tok', { tier: 'rtg' });
  const h = tokenHash('tok');
  const begin = db.data.sessions[h].at;
  const na1 = saves();
  zetKlok(30 * 60 * 1000);
  assert.equal(s.sessionFor('tok').at, begin, 'binnen het uur geen nieuwe tijd');
  assert.equal(saves(), na1, 'en geen schrijfactie');
  zetKlok(2 * 60 * 60 * 1000);
  const vernieuwd = s.sessionFor('tok');
  assert.notEqual(vernieuwd.at, begin, 'na een uur schuift het venster');
  assert.equal(saves(), na1 + 1);
  assert.equal(s.sessions.get(h).at, vernieuwd.at);
  zetKlok(2 * 60 * 60 * 1000 + TOKEN_TTL_MS - 1000);
  assert.ok(s.sessionFor('tok'), 'net binnen dertig dagen na het laatste gebruik');
  zetKlok(2 * 60 * 60 * 1000 + TOKEN_TTL_MS + TOKEN_TTL_MS + 1000);
  assert.equal(s.sessionFor('tok'), null, 'dertig dagen stil: weg');
  assert.equal(db.data.sessions[h], undefined, 'ook uit de snapshot');
  assert.equal(s.sessionFor(''), null);
  assert.equal(s.sessionFor(null), null);
  assert.equal(s.sessionFor('nooit-gezien'), null);
});

test('3. een sid-intrekking sluit ook een recordsessie', () => {
  const ingetrokken = new Set();
  const { s, db } = opslag({ sessieIngetrokken: (sid) => ingetrokken.has(sid) });
  s.rememberSession('a', { tier: 'kantoor', sid: 'sessieAAAAAA' });
  s.rememberSession('b', { tier: 'kantoor', sid: 'sessieBBBBBB' });
  ingetrokken.add('sessieAAAAAA');
  assert.equal(s.sessionFor('a'), null, 'ingetrokken op sid');
  assert.equal(db.data.sessions[tokenHash('a')], undefined, 'en opgeruimd');
  assert.ok(s.sessionFor('b'), 'de andere sessie blijft');
});

test('3. een ingetrokken token wint van een oude snapshot, en een onzekere Redis sluit dicht', () => {
  const { s, db } = opslag();
  s.rememberSession('tok', { tier: 'kantoor' });
  signaal.meldToken('tok', Date.now() + 60000);
  assert.equal(s.sessionFor('tok'), null);
  assert.equal(db.data.sessions[tokenHash('tok')], undefined);
  s.rememberSession('tok2', { tier: 'kantoor' });
  process.env.REDIS_URL = 'redis://nog-niet';
  assert.equal(s.sessionFor('tok2'), null, 'zonder aantoonbare leiding geen sessie');
  delete process.env.REDIS_URL;
  assert.ok(s.sessionFor('tok2'), 'maar hij is niet weggegooid: na herstel werkt hij weer');
});

test('4. vergiftigde busberichten veranderen niets', () => {
  const { s, db } = opslag();
  const { bus, stuur } = nepBus(true);
  s.koppelBus(bus);
  s.rememberSession('tok', { tier: 'kantoor', key: 'K' });
  const h = tokenHash('tok');
  const ander = tokenHash('ander');
  const goed = { versie: 1, bron: 'andere-instance', actie: 'zet', hash: ander, sess: { tier: 'kantoor', at: new Date().toISOString() } };
  for (const slecht of [
    null, 'tekst', Object.assign({}, goed, { versie: 2 }),
    Object.assign({}, goed, { hash: 'GEENHASH' }), Object.assign({}, goed, { hash: undefined }),
    Object.assign({}, goed, { sess: null }), Object.assign({}, goed, { sess: [1, 2] }),
    Object.assign({}, goed, { sess: 'tekst' }),
    Object.assign({}, goed, { sess: { at: 'geen datum' } }),
    Object.assign({}, goed, { sess: { at: new Date().toISOString(), vulsel: 'x'.repeat(17 * 1024) } }),
    Object.assign({}, goed, { actie: 'iets-anders' })
  ]) stuur(slecht);
  assert.equal(s.sessions.has(ander), false, 'geen enkel vergiftigd bericht plant een sessie');
  assert.equal(db.data.sessions[ander], undefined);
  // een kringverwijzing is geen geldige sessie (JSON.stringify gooit)
  const kring = { at: new Date().toISOString() }; kring.zelf = kring;
  stuur(Object.assign({}, goed, { sess: kring }));
  assert.equal(s.sessions.has(ander), false);
  // het goede bericht wel, als kopie
  stuur(goed);
  assert.equal(s.sessions.get(ander).tier, 'kantoor');
  assert.notEqual(s.sessions.get(ander), goed.sess, 'een kopie, niet het object van de bus');
  stuur({ versie: 1, bron: 'andere-instance', actie: 'weg', hash: h });
  assert.equal(s.sessionFor('tok'), null, 'een geldige weg-melding van elders werkt');
});

test('4. de eigen echo zet niets terug, en een tweede of halve bus wordt geweigerd', () => {
  const { s } = opslag();
  const { bus, uit, stuur } = nepBus(true);
  assert.equal(s.koppelBus(null), false);
  assert.equal(s.koppelBus({ publish() {} }), false, 'zonder subscribe geen bus');
  assert.equal(s.koppelBus({ subscribe() {} }), false, 'zonder publish geen bus');
  assert.equal(s.koppelBus(bus), true);
  assert.equal(s.koppelBus(nepBus(true).bus), false, 'een tweede bus zou twee waarheden maken');
  s.rememberSession('tok', { tier: 'kantoor' });
  const echo = uit[0].b;
  s.forgetSession(tokenHash('tok'));
  stuur(echo); // onze eigen login komt terug van de bus
  /* sessionFor zou hem ook via het intreksignaal weigeren; de echo mag de
     index en de snapshot echter niet eens bereiken (dan herleeft hij bij de
     eerstvolgende save of herbouw). */
  assert.equal(s.sessions.has(tokenHash('tok')), false, 'de eigen echo zet niets terug in de index');
  assert.equal(s.herbouwSessions(), 0, 'en ook niet in de snapshot');
  assert.equal(s.sessionFor('tok'), null);
});

test('5. een kapotte snapshot wordt een lege bak, en herbouwen neemt alleen geldige records over', () => {
  for (const kapot of [null, 'tekst', [1, 2], 42]) {
    const db = { data: { sessions: kapot } };
    const s = maakSessies({ db, save: () => {}, crypto });
    s.rememberSession('tok', { tier: 'rtg' });
    assert.equal(typeof db.data.sessions, 'object');
    assert.equal(Array.isArray(db.data.sessions), false);
    assert.ok(s.sessionFor('tok'));
  }
  const geldig = tokenHash('geldig');
  const db = { data: { sessions: {
    [geldig]: { tier: 'rtg', at: new Date().toISOString() },
    'geen-hash': { tier: 'rtg', at: new Date().toISOString() },
    [tokenHash('slecht1')]: null,
    [tokenHash('slecht2')]: { at: 'gisteren-ofzo' },
    [tokenHash('slecht3')]: ['array']
  } } };
  const s = maakSessies({ db, save: () => {}, crypto });
  assert.equal(s.herbouwSessions(), 1);
  assert.ok(s.sessionFor('geldig'));
  assert.equal(s.sessionFor('slecht2'), null);
});

test('6. uitloggen van een vormloze of onbekende hash meldt geen succes', async () => {
  const { s, db } = opslag();
  s.rememberSession('tok', { tier: 'rtg' });
  const voor = JSON.stringify(db.data.sessions);
  s.forgetSession('geen-hash');
  s.forgetSession(null);
  assert.equal(JSON.stringify(db.data.sessions), voor, 'een vormloze hash raakt niets');
  assert.equal(await s.forgetSessionDuurzaam('geen-hash'), false);
  assert.equal(await s.forgetSessionDuurzaam(tokenHash('onbekend')), false, 'niets ingetrokken, dus geen succes');
  // een bekende sessie met een kapotte tijd krijgt toch een toekomstige vervaldatum
  const h = tokenHash('tok');
  db.data.sessions[h].at = 'onzin';
  s.sessions.delete(h); // alleen nog in de snapshot
  assert.equal(await s.forgetSessionDuurzaam(h), true);
  assert.equal(db.data.sessions[h], undefined);
  assert.equal(signaal.tokenIngetrokken('tok'), true, 'de intrekking staat in het signaal, op de vinger');
});

test('7. binnen een verzoek wordt een sessie pas na de commit zichtbaar', async () => {
  const { s } = opslag();
  const naCommit = [];
  const echt = verzoekcontext.haakNaCommit;
  verzoekcontext.haakNaCommit = (fn) => { naCommit.push(fn); return true; };
  try {
    s.rememberSession('tok', { tier: 'kantoor' });
    assert.equal(s.sessionFor('tok'), null, 'voor de commit bestaat de sessie nog niet in de index');
    for (const fn of naCommit.splice(0)) fn();
    const sess = s.sessionFor('tok');
    assert.ok(sess, 'na de commit wel');
    // vernieuwen na een uur volgt dezelfde regel
    zetKlok(2 * 60 * 60 * 1000);
    const vernieuwd = s.sessionFor('tok');
    assert.notEqual(vernieuwd.at, sess.at);
    assert.equal(s.sessions.get(tokenHash('tok')).at, sess.at, 'de index wacht op de commit');
    for (const fn of naCommit.splice(0)) fn();
    assert.equal(s.sessions.get(tokenHash('tok')).at, vernieuwd.at);
  } finally { verzoekcontext.haakNaCommit = echt; }
});

test('3. met een gereede Redis-leiding werkt een recordsessie gewoon, met een ongerede niet', async () => {
  const { s } = opslag();
  s.rememberSession('tok', { tier: 'kantoor' });
  let standFn = null;
  signaal.koppelBus({ soort: 'redis', publish() {}, subscribe() {}, onStand(fn) { standFn = fn; },
    async herhaal() { return []; }, async bewaar() {} });
  process.env.REDIS_URL = 'redis://proef';
  assert.equal(s.sessionFor('tok'), null, 'gekoppeld maar nog niet gereed: dicht');
  standFn({ soort: 'redis', gereed: true });
  for (let i = 0; i < 100 && !signaal.stand().gereed; i++) await Promise.resolve();
  assert.ok(s.sessionFor('tok'), 'gereed: open');
  // en een duurzaam uitlog met een geldige tijd vervalt dertig dagen na het laatste gebruik
  const h = tokenHash('tok');
  const at = new Date(s.sessions.get(h).at).getTime();
  const bewaard = [];
  signaal.koppelOutbox({ lijst: () => [], voltooi: () => 0, deel: async (r) => { bewaard.push(r); } });
  assert.equal(await s.forgetSessionDuurzaam(h), true);
  assert.equal(bewaard.length, 1);
  assert.equal(bewaard[0].waarde, h, 'de outbox krijgt de hash, niet het token');
  assert.equal(bewaard[0].verloopt, at + TOKEN_TTL_MS);
  assert.equal(s.sessionFor('tok'), null);
});

test('2. boven de bovengrens gaan eerst verlopen sessies weg, en pas dan de oudste', () => {
  const pad = require.resolve('../server/kern/sessies');
  const oudGrens = process.env.RTG_MAX_SESSIONS;
  process.env.RTG_MAX_SESSIONS = '1'; // de vloer is 400: lager mag niet
  delete require.cache[pad];
  try {
    const { maakSessies: maak } = require('../server/kern/sessies');
    const db = { data: { sessions: {} } };
    const s = maak({ db, save: () => {}, crypto });
    const { bus, uit } = nepBus(true);
    s.koppelBus(bus);
    zetKlok(0);
    s.rememberSession('oudste', { tier: 'rtg' });
    for (let i = 1; i < 400; i++) { zetKlok(i * 1000); s.rememberSession('t' + i, { tier: 'rtg' }); }
    assert.equal(Object.keys(db.data.sessions).length, 400, 'de vloer van 400 geldt ook bij een lagere instelling');
    zetKlok(500 * 1000);
    s.rememberSession('nieuw', { tier: 'rtg' });
    assert.equal(Object.keys(db.data.sessions).length, 400);
    assert.equal(db.data.sessions[tokenHash('oudste')], undefined, 'als vangnet de oudste eruit');
    assert.ok(db.data.sessions[tokenHash('nieuw')], 'de zojuist gezette sessie nooit');
    assert.ok(uit.some(u => u.b.actie === 'weg' && u.b.hash === tokenHash('oudste')), 'en de andere instances horen het');
    // nu een verlopen sessie: die gaat eerst, en verder niemand
    db.data.sessions[tokenHash('t1')].at = new EchtDate(t0 - TOKEN_TTL_MS - 1).toISOString();
    s.rememberSession('nog-een', { tier: 'rtg' });
    assert.equal(db.data.sessions[tokenHash('t1')], undefined, 'de verlopen sessie is weg');
    assert.ok(db.data.sessions[tokenHash('t2')], 'de oudste nog-geldige blijft');
    assert.equal(Object.keys(db.data.sessions).length, 400);
  } finally {
    if (oudGrens === undefined) delete process.env.RTG_MAX_SESSIONS; else process.env.RTG_MAX_SESSIONS = oudGrens;
    delete require.cache[pad];
  }
});
