/* DE MANDAATPOORT (server/kern/stuur/mandaatpoort.js).

   DE REGEL DIE HIJ BEWAAKT: geen muterend effect vanuit een intentie zonder
   aantoonbaar gezag. Dat gezag is OF een mens die zojuist bevestigde, OF een
   mandaat dat de handeling dekt. Nooit niets.

   DRIE DINGEN DIE DEZE TOETS VASTHOUDT EN DIE ALLE DRIE UIT EEN FOUT KOMEN:

     1 `nvt` IS GEEN `toegestaan`. "Deze poort gaat hier niet over" en "deze
       poort liet het toe" zijn verschillende uitspraken. Wie ze samenvoegt kan
       achteraf niet zien of de grens ergens heeft gewogen -- dezelfde reden als
       ONBEKEND naast WEIGEREN in CONTROLPLANE.md.
     2 EEN MENS DIE BEVESTIGT HEEFT GEEN MANDAAT NODIG. Zonder die tak blokkeert
       de poort de ja-knop van het lid zelf, en dan is de grens onzin. Er staat
       daarom een TEGENproef: de bevestigde weg moet open BLIJVEN.
     3 DE POORT MOET KUNNEN BIJTEN. Een poort die in geen enkele stand weigert,
       is geen poort. Beide standen worden hier beproefd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');
const POORT = path.join(WORTEL, 'server/kern/stuur/mandaatpoort.js');

/* COMMENTAAR ERAF VOOR ELKE BRONBEWERING, en dat is hier geen netheid maar een
   reparatie. De eerste versie zocht `t.input` in de rauwe bron en zakte -- op de
   KOP van de poort zelf, die uitlegt dat het mandaat nooit uit `t.input` komt.
   De marker stond letterlijk in de zin die de regel beschrijft. Zelfde vorm als
   BEWIJSMACHINE.md par. 6a: een proef kan een geldige uitslag geven en toch het
   verkeerde experiment zijn. `scripts/lib/bron.js` deed dit al; er komt geen
   tweede stripper naast. */
const kaal = (pad) => zonderCommentaar(fs.readFileSync(pad, 'utf8'));

/* De poort leest de vlag bij ELKE aanroep, dus een verse module is niet nodig;
   wel het terugzetten van de omgeving, anders lekt een stand naar de volgende. */
function metAfdwingen(aan, fn) {
  const oud = process.env.RTG_MANDAAT_AFDWINGEN;
  if (aan) process.env.RTG_MANDAAT_AFDWINGEN = '1'; else delete process.env.RTG_MANDAAT_AFDWINGEN;
  try { return fn(require('../server/kern/stuur/mandaatpoort')); }
  finally { if (oud === undefined) delete process.env.RTG_MANDAAT_AFDWINGEN; else process.env.RTG_MANDAAT_AFDWINGEN = oud; }
}

const DEKKEND = { capabilities: ['/api/bijles/*'] };

/* ---- waar de poort NIET over gaat ---------------------------------------- */

test('een leesactie raakt de poort niet, en dat heet nvt en niet toegestaan', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  const r = p.beoordeel('/api/agenda/mijn', 'member', {});
  assert.strictEqual(r.soort, 'nvt');
  assert.notStrictEqual(r.soort, 'toegestaan',
    'een pad waar de poort niet over gaat mag nooit als "de poort liet het toe" tellen');
  assert.strictEqual(r.mag, true);
});

test('een voorstel vraagt al een mens, dus de poort voegt daar niets toe', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  assert.strictEqual(p.beoordeel('/api/agenda/bewaar', 'member', {}).soort, 'nvt');
});

/* TEGENPROEF, en zonder deze is de goedkoopste implementatie "blokkeer alles". */
test('wat een mens zojuist bevestigde heeft geen mandaat nodig', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  const r = p.beoordeel('/api/bijles/vraag', 'member', { menselijkBevestigd: true });
  assert.strictEqual(r.soort, 'nvt');
  assert.match(r.reden, /mens/, 'de reden moet de bevestiging noemen, anders is niet na te gaan waarom dit open ging');
});

/* ---- waar hij WEL over gaat ---------------------------------------------- */

test('een zelfstandige mutatie zonder mandaat wordt geweigerd', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  const r = p.beoordeel('/api/bijles/vraag', 'member', {});
  assert.strictEqual(r.soort, 'geweigerd');
  assert.match(r.reden, /geen mandaat/, 'leeg is dicht, en de reden zegt dat');
});

test('een dekkend mandaat laat dezelfde handeling door', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  assert.strictEqual(p.beoordeel('/api/bijles/vraag', 'member', { mandaat: DEKKEND }).soort, 'toegestaan');
});

test('een mandaat dat dit pad niet noemt, dekt het niet', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  const r = p.beoordeel('/api/bijles/vraag', 'member', { mandaat: { capabilities: ['/api/mediaos/*'] } });
  assert.strictEqual(r.soort, 'geweigerd');
});

test('een verlopen mandaat is geen mandaat', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  const r = p.beoordeel('/api/bijles/vraag', 'member',
    { mandaat: { capabilities: ['/api/bijles/*'], tot: '2020-01-01T00:00:00Z' } });
  assert.strictEqual(r.soort, 'geweigerd');
  assert.match(r.reden, /verlopen/);
});

/* ---- de poort moet kunnen bijten ----------------------------------------- */

/* MUTATIE GEZIEN ZAKKEN: `mag: !AFDWINGEN()` vervangen door `mag: true`; deze
   toets zakte op de tweede bewering. */
test('meelopend laat door en telt; afdwingend weigert echt', () => {
  const meelopend = metAfdwingen(false, (p) => p.beoordeel('/api/bijles/vraag', 'member', {}));
  assert.strictEqual(meelopend.mag, true, 'in de schaduw houdt de poort niets tegen');
  assert.strictEqual(meelopend.afgedwongen, false);
  assert.match(meelopend.uitleg, /MEELOPEND/, 'een schaduwronde moet zichzelf zo noemen, anders leest hij als een weigering');

  const hard = metAfdwingen(true, (p) => p.beoordeel('/api/bijles/vraag', 'member', {}));
  assert.strictEqual(hard.mag, false, 'met RTG_MANDAAT_AFDWINGEN=1 hoort hij werkelijk te weigeren');
  assert.strictEqual(hard.afgedwongen, true);
});

test('de schaduw telt wat hij zou sluiten, en houdt geen mens bij', () => {
  const p = require('../server/kern/stuur/mandaatpoort');
  p.nulstel();
  p.beoordeel('/api/bijles/vraag', 'member', {});                 // zou sluiten
  p.beoordeel('/api/bijles/vraag', 'member', { mandaat: DEKKEND });// door
  p.beoordeel('/api/agenda/mijn', 'member', {});                  // nvt: telt niet
  const s = p.stand();
  assert.strictEqual(s.gewogen, 2, 'alleen wat de poort werkelijk woog, telt mee');
  assert.strictEqual(s.zouSluiten, 1);
  assert.strictEqual(s.doorgelaten, 1);
  const tekst = JSON.stringify(s);
  assert.ok(!/key|sleutel|codenaam|member_|token/i.test(tekst),
    'er zit iets persoonsachtigs in de tellers; deze laag telt handelingen en geen mensen');
});

/* ---- de plaats van de poort is de helft van het ontwerp ------------------- */

test('de poort hangt aan de uitvoeringsgrens en niet in de AI-lus', () => {
  const toets = kaal(path.join(WORTEL, 'server/kern/stuur/toets.js'));
  assert.match(toets, /mandaatpoort\(\)\.beoordeel\(/,
    'stuurToets roept de poort niet aan -- dan geldt de grens alleen voor wie eraan denkt');
  const lus = kaal(path.join(WORTEL, 'server/kern/stuur/lusstap.js'));
  assert.ok(!/mandaatpoort/.test(lus),
    'de poort staat in de AI-lus; dan is hij een eigenschap van Rahul in plaats van van de uitvoeringsgrens, ' +
    'en erft een stem- of agentingang hem niet');
});

test('het mandaat komt uit de opties en nooit uit de modelinvoer', () => {
  const bron = kaal(POORT);
  assert.ok(!/t\.input|\binput\b/.test(bron),
    'de poort leest modelinvoer; dan kan het model zijn eigen mandaat meesturen en keurt de poort zichzelf goed');
  const toets = kaal(path.join(WORTEL, 'server/kern/stuur/toets.js'));
  assert.match(toets, /mandaat: o\.mandaat/,
    'het mandaat hoort uit de opties van de aanroeper te komen, uit servergegevens');
});

test('de poort voert niets uit', () => {
  const bron = kaal(POORT);
  for (const verboden of ['fetch(', 'stuurRoep', 'messages.create', 'writeFileSync'])
    assert.ok(!bron.includes(verboden),
      'de poort bevat `' + verboden + '`; een poort die zelf iets doet, is geen poort');
});
