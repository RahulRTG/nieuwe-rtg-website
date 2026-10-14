/* HET DOORGEEFJOURNAAL ONDER DRUK (server/kern/doorgeefjournaal.js).

   Het doorgeefjournaal beantwoordt na een storing de vraag "wat kwam er binnen,
   wat ging er de deur uit, en wat MISLUKTE er". test/doorgeefjournaal.test.js
   legt de gewone weg en de privacyregel vast. Dit bestand kijkt naar wat een
   vreemde of een kapotte opslag eraan kan doen: het journaal laten volstromen,
   een persoon erin smokkelen via een veld dat daar niet voor is, een save laten
   omvallen, een verhuizing die halverwege breekt, en lezen met onzinnige
   grenzen.

   Wat hier niet mag sneuvelen:
   1. een persoon komt er via GEEN veld in: een uitgaand bericht neemt de
      bestemming in vorm, ook als de aanroeper zelf een `wie` meegeeft;
   2. elk veld is begrensd (wat 120, wie 60, reden 140) en een getal is een
      getal of null -- een aanroeper kan de regel niet opblazen of vergiftigen;
   3. het venster en het bewaarde deel zijn begrensd, ook onder een stroom van
      mislukkingen, en snoeien gebeurt in blokken;
   4. een vreemde met een GET naar een onbekend pad dwingt hooguit EEN
      schijfschrijving per seconde af, en een save die omvalt breekt niets en
      laat de volgende spoeling niet liggen;
   5. een verhuizing die gooit, breekt het opbouwen van het journaal niet;
   6. lezen met een rare grens of een rare bron geeft een begrensd, nieuwste-
      eerst antwoord, en filtert VOOR het afkappen.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in buiten() `wie: bestemmingVorm(r.naar)` vervangen door `wie: r.wie || bestemmingVorm(r.naar)`
     -> "1. een uitgaand bericht" ZAKT (RAAK)
   - in plan() `if (spoelt) return;` weggehaald
     -> "4. een stroom mislukkingen geeft een schrijving per seconde" ZAKT (RAAK)
   - in snoei() `- max + blok` vervangen door `- max`
     -> "3. het venster en het bewaarde deel zijn begrensd" ZAKT (RAAK)

   Draai: node --test test/doorgeefjournaal-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakDoorgeefjournaal, padVorm, bestemmingVorm } = require('../server/kern/doorgeefjournaal');
const haak = require('../server/journaalhaak');

/* Elk journaal meldt zich aan bij de haak; na afloop staat die weer leeg. */
test.afterEach(() => haak.zet(null));

const opzet = (extra = {}) => {
  const db = { data: {} };
  let saves = 0;
  const j = maakDoorgeefjournaal(Object.assign({ db, save: () => { saves++; }, nu: () => '2026-10-14T10:00:00.000Z' }, extra));
  return { j, db, saves: () => saves };
};

test('1. een uitgaand bericht neemt de bestemming in vorm, ook als de aanroeper zelf een persoon als wie meegeeft', () => {
  const { j } = opzet();
  const r = j.journaalBuiten({ wat: 'post/outbox', naar: 'sms:+31612345678', wie: 'Jamie de Vries' });
  assert.equal(r.wie, 'sms', 'het veld wie komt voor uitgaand verkeer alleen uit de bestemming');
  assert.equal(j.journaalBuiten({ wat: 'post/outbox', naar: 'a@' + 'd'.repeat(80) }).wie, 'mail:' + 'd'.repeat(40));
  assert.equal(j.journaalBuiten({ wat: 'push' }).wie, 'onbekend', 'zonder bestemming geen verzonnen naam');
  assert.equal(j.journaalBuiten({ wat: 'push', naar: '@domein.nl' }).wie, '@domein.nl', 'een adres zonder lokaal deel is geen persoon');
  assert.equal(j.journaalBuiten({ wat: 'webhook', naar: 'https://partner.example/hook' }).richting, 'uit');
  const alles = JSON.stringify(j.journaalLees({ max: 1000 }));
  assert.ok(!alles.includes('Jamie') && !alles.includes('+316'), 'nergens in het journaal een naam of nummer');
});

test('2. elk veld is begrensd en een getal is een getal of null', () => {
  const { j } = opzet();
  const r = j.journaalBinnen({ wat: 'w'.repeat(500), wie: 'c'.repeat(200), methode: 'POST', status: '200',
    ms: 12.6, bytes: Infinity, reden: 'r'.repeat(500), mislukt: 'ja', richting: 'zijwaarts' });
  assert.equal(r.wat.length, 120);
  assert.equal(r.wie.length, 60);
  assert.equal(r.reden.length, 140);
  assert.equal(r.status, null, 'een status als tekst wordt niet als getal geloofd');
  assert.equal(r.ms, 13);
  assert.equal(r.bytes, null, 'oneindig is geen omvang');
  assert.equal(r.mislukt, true);
  assert.equal(r.richting, 'in', 'een onbekende richting is binnenkomend, niet een derde soort');
  assert.equal(r.t, '2026-10-14T10:00:00.000Z', 'de tijd komt van de meegegeven klok');
  const kaal = j.journaalBinnen({});
  assert.deepEqual(kaal, { t: '2026-10-14T10:00:00.000Z', richting: 'in', wat: '', wie: null, methode: null,
    status: null, ms: null, bytes: null, mislukt: false, reden: null });
});

test('2b. zonder meegegeven klok is de tijd een echte ISO-tijd', () => {
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => {} });
  assert.match(j.journaalBinnen({ wat: '/x' }).t, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
});

test('3. het venster en het bewaarde deel zijn begrensd, en snoeien gaat in blokken', () => {
  const { j, db } = opzet();
  for (let i = 0; i < 4000; i++) j.journaalBinnen({ wat: '/a', methode: 'GET', status: 200 });
  assert.equal(j.journaalBeeld().venster, 4000, 'tot het maximum blijft alles');
  j.journaalBinnen({ wat: '/a', methode: 'GET', status: 200 });
  assert.equal(j.journaalBeeld().venster, 3800, 'een regel over de grens haalt een blok van 5% weg');
  assert.deepEqual(db.data.doorgeefjournaal || [], [], 'een geslaagde GET wordt niet bewaard');
  for (let i = 0; i < 20001; i++) j.journaalBinnen({ wat: '/b', methode: 'POST', status: 201 });
  assert.equal(db.data.doorgeefjournaal.length, 19000, 'het bewaarde deel gaat nooit over 20.000 en snoeit 1.000 tegelijk');
  assert.ok(j.journaalBeeld().venster <= 4000);
  assert.equal(j.journaalBeeld().bewaard, 19000);
});

test('4. een stroom mislukkingen geeft hooguit een schrijving per seconde, en een omvallende save breekt niets', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let saves = 0, gooi = true;
  const { j } = opzet({ save: () => { saves++; if (gooi) throw new Error('schijf vol'); } });
  for (let i = 0; i < 500; i++) j.journaalBinnen({ wat: '/onbekend/' + i, methode: 'GET', status: 404, mislukt: true });
  assert.equal(saves, 0, 'niet bij elke regel een save');
  t.mock.timers.tick(999);
  assert.equal(saves, 0);
  t.mock.timers.tick(1);
  assert.equal(saves, 1, 'vijfhonderd mislukkingen, een schrijving');
  /* De save gooide; het journaal leeft door en de volgende mislukking plant opnieuw. */
  gooi = false;
  assert.doesNotThrow(() => j.journaalBinnen({ wat: '/x', methode: 'GET', mislukt: true }));
  t.mock.timers.tick(1000);
  assert.equal(saves, 2, 'na een omgevallen save is de rem niet blijven hangen');
  j.journaalBinnen({ wat: '/y', methode: 'POST', status: 200 });
  t.mock.timers.tick(5000);
  assert.equal(saves, 2, 'een geslaagde schrijvende regel wordt bewaard, maar dwingt geen schijfschrijving af');
});

test('4b. met een bestand gaat het bewaarde deel naar het boek, zonder save', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const genoteerd = [];
  const boek = { noteerRegel: (r) => { genoteerd.push(r); return true; }, lees: (n) => genoteerd.slice(-n), aantal: () => genoteerd.length,
    spoelNu: () => 0, stand: () => ({ stuk: null, map: '/nergens' }) };
  const { j, db, saves } = opzet({ bestand: boek });
  j.journaalBinnen({ wat: '/a', methode: 'GET', mislukt: true });
  j.journaalBinnen({ wat: '/b', methode: 'GET' });
  j.journaalBuiten({ wat: 'post', naar: 'x@y.nl' });
  t.mock.timers.tick(5000);
  assert.equal(saves(), 0, 'het bestand spoelt zichzelf; geen save van de hele database');
  assert.equal(db.data.doorgeefjournaal, undefined, 'en er groeit geen collectie naast het bestand');
  assert.deepEqual(genoteerd.map(r => r.wat), ['/a', 'post']);
  assert.equal(j.journaalBeeld().bewaard, 2);
  assert.deepEqual(j.journaalLees({ bron: 'bewaard' }).regels.map(r => r.wat), ['post', '/a'], 'bewaard, nieuwste eerst');
});

test('5. een verhuizing die gooit breekt het opbouwen niet, en het journaal werkt daarna gewoon', (t) => {
  const gemeld = [];
  t.mock.method(console, 'warn', (...a) => { gemeld.push(a.join(' ')); });
  const boek = { noteerRegel() { throw new Error('boek kapot'); }, lees: () => [], aantal: () => 0, spoelNu: () => 0, stand: () => ({}) };
  const db = { data: { doorgeefjournaal: [{ wat: '/oud' }] } };
  let j;
  assert.doesNotThrow(() => { j = maakDoorgeefjournaal({ db, save: () => {}, bestand: boek }); });
  assert.ok(gemeld.some(m => /verhuizen mislukt: boek kapot/.test(m)), 'de mislukking is gemeld, niet verzwegen');
  assert.deepEqual(db.data.doorgeefjournaal, [{ wat: '/oud' }], 'en de oude collectie staat er nog');
  assert.equal(j.journaalBinnen({ wat: '/nieuw' }).wat, '/nieuw');
});

test('5b. de haak stuurt uitgaand naar buiten() en de rest naar binnen(); een tweede journaal neemt het over', () => {
  const a = opzet(), b = opzet();
  haak.meld({ richting: 'uit', wat: 'post', naar: 'sms:+31600000000' });
  haak.meld({ wat: '/api/x', methode: 'POST' });
  haak.meld(null);
  assert.equal(a.j.journaalBeeld().venster, 0, 'het eerst opgebouwde journaal krijgt niets meer');
  const beeld = b.j.journaalBeeld();
  assert.equal(beeld.uit, 1);
  assert.equal(beeld.in, 2, 'een lege melding telt als binnenkomend, en breekt niets');
  assert.equal(b.j.journaalLees({ richting: 'uit' }).regels[0].wie, 'sms');
});

test('6. lezen: begrensd, nieuwste eerst, en gefilterd VOOR het afkappen', () => {
  const { j } = opzet();
  for (let i = 0; i < 1500; i++) j.journaalBinnen({ wat: '/pad/' + i, methode: 'GET', mislukt: i === 3 });
  const standaard = j.journaalLees();
  assert.equal(standaard.bron, 'venster');
  assert.equal(standaard.totaal, 1500);
  assert.equal(standaard.regels.length, 200, 'zonder grens 200');
  assert.equal(standaard.regels[0].wat, '/pad/1499', 'nieuwste eerst');
  assert.equal(j.journaalLees({ max: 999999 }).regels.length, 1000, 'nooit meer dan 1000');
  assert.equal(j.journaalLees({ max: -5 }).regels.length, 1, 'een negatieve grens is er een');
  assert.equal(j.journaalLees({ max: 'veel' }).regels.length, 200, 'onzin is de standaard');
  const mis = j.journaalLees({ alleenMislukt: true, max: 1 });
  assert.equal(mis.totaal, 1);
  assert.equal(mis.regels[0].wat, '/pad/3', 'de mislukking van lang geleden wordt gevonden, niet weggekapt');
  assert.equal(j.journaalLees({ zoek: '/PAD/149', max: 1000 }).totaal, 11, 'zoeken is hoofdletterongevoelig');
  assert.equal(j.journaalLees({ bron: 'iets-anders' }).bron, 'venster', 'een onbekende bron is het venster');
  assert.equal(j.journaalLees({ bron: 'bewaard' }).totaal, 1, 'alleen de mislukking is bewaard');
  const beeld = j.journaalBeeld();
  assert.equal(beeld.mislukt, 1);
  assert.equal(beeld.uitMislukt, 0);
  assert.equal(beeld.oudste, '2026-10-14T10:00:00.000Z');
  assert.equal(opzet().j.journaalBeeld().oudste, null, 'een leeg journaal heeft geen oudste');
});

test('6b. zoeken kijkt ook in wie, en een regel zonder wie breekt het zoeken niet', () => {
  const { j } = opzet();
  j.journaalBinnen({ wat: '/a', wie: 'codenaam-zilver' });
  j.journaalBinnen({ wat: '/b' });
  assert.deepEqual(j.journaalLees({ zoek: 'ZILVER' }).regels.map(r => r.wat), ['/a']);
});

test('7. de padvorm haalt elke bearer uit het pad voor hij in het journaal komt', () => {
  const { j } = opzet();
  assert.equal(j.journaalPadVorm, padVorm);
  const gevallen = [
    ['/api/vonk/profile-photo/delivery/abc_DEF-123/x', '/api/vonk/profile-photo/delivery/:ticket/x'],
    ['/api/member/rendezvous/profile-photo/delivery/zzz', '/api/member/rendezvous/profile-photo/delivery/:ticket'],
    ['/api/connection/vonk/message-media/delivery/t0k3n', '/api/connection/vonk/message-media/delivery/:ticket'],
    ['/api/connection/rendezvous/message-media/delivery/t0k3n', '/api/connection/rendezvous/message-media/delivery/:ticket'],
    ['/werken/AB12CD', '/werken/:code'],
    ['/media/t/ondertekend.kenmerk', '/media/t/:ticket'],
    ['/api/doos/0123456789abcdef0123/stand', '/api/doos/:sleutel/stand'],
    ['/api/lid/42/pas/7', '/api/lid/:id/pas/:id']
  ];
  for (const [in_, uit] of gevallen) assert.equal(padVorm(in_), uit, in_);
  assert.equal(padVorm(null), '');
  assert.equal(padVorm('/' + 'z'.repeat(300)).length, 120);
  assert.equal(bestemmingVorm(undefined), 'onbekend');
});

test('5c. verhuizing: een boek dat weigert of te weinig schrijft houdt de oude collectie; een geslaagde verhuizing overleeft een omvallende save', (t) => {
  const gemeld = [], gelogd = [];
  t.mock.method(console, 'warn', (...a) => { gemeld.push(a.join(' ')); });
  t.mock.method(console, 'log', (...a) => { gelogd.push(a.join(' ')); });
  const oud = () => [{ wat: '/een' }, { wat: '/twee' }];
  const boek = (over) => Object.assign({ noteerRegel: () => true, lees: () => [], aantal: () => 0,
    spoelNu: () => 2, stand: () => ({ stuk: null, map: '/tmp/x' }) }, over);

  const weigert = { data: { doorgeefjournaal: oud() } };
  maakDoorgeefjournaal({ db: weigert, save: () => {}, bestand: boek({ noteerRegel: () => false, spoelNu: () => 0,
    stand: () => ({ stuk: 'al eerder kapot', map: '/tmp/x' }) }) });
  assert.equal(weigert.data.doorgeefjournaal.length, 2, 'een dichtgezet boek (dat niets meer aanneemt) is geen verhuizing');

  const half = { data: { doorgeefjournaal: oud() } };
  maakDoorgeefjournaal({ db: half, save: () => {}, bestand: boek({ spoelNu: () => 1 }) });
  assert.equal(half.data.doorgeefjournaal.length, 2, 'een van de twee geschreven: de collectie blijft');
  assert.ok(gemeld.some(m => /1 van 2 regels geschreven\)/.test(m)), 'en dat wordt met aantallen gemeld');

  const stuk = { data: { doorgeefjournaal: oud() } };
  maakDoorgeefjournaal({ db: stuk, save: () => {}, bestand: boek({ stand: () => ({ stuk: 'EACCES', map: '/tmp/x' }) }) });
  assert.equal(stuk.data.doorgeefjournaal.length, 2);
  assert.ok(gemeld.some(m => /reden: EACCES/.test(m)), 'de reden staat erbij');

  const goed = { data: { doorgeefjournaal: oud() } };
  assert.doesNotThrow(() => maakDoorgeefjournaal({ db: goed, save: () => { throw new Error('save stuk'); }, bestand: boek() }));
  assert.equal(goed.data.doorgeefjournaal, undefined, 'de regels staan in het bestand; een omvallende save maakt dat niet ongedaan');
  assert.ok(gelogd.some(m => /2 bewaarde regels verhuisd/.test(m)));

  const leeg = { data: { doorgeefjournaal: [] } };
  maakDoorgeefjournaal({ db: leeg, save: () => {}, bestand: boek({ noteerRegel: () => { throw new Error('mag niet'); } }) });
  assert.deepEqual(leeg.data.doorgeefjournaal, [], 'een lege collectie hoeft niet te verhuizen');
});

test('5d. een ontvanger die gooit, breekt de melder niet', () => {
  const { j } = opzet();
  haak.zet(() => { throw new Error('journaal stuk'); });
  assert.doesNotThrow(() => haak.meld({ wat: '/x' }));
  haak.zet('geen functie');
  assert.doesNotThrow(() => haak.meld({ wat: '/y' }), 'een ongeldige ontvanger is geen ontvanger');
  assert.equal(j.journaalBeeld().venster, 0);
});
