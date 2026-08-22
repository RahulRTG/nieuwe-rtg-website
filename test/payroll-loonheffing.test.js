/* Payroll OS: de loonheffing als TABEL -- schijven, heffingskortingen en het
   bijzondere tarief.

   WAT HIER OP HET SPEL STAAT. De motor rekende de loonheffing met een vlak
   percentage. Dat is niet hoe de Nederlandse loonbelasting werkt, en het
   verschil zit juist aan de onderkant in de tientallen procenten: daar zijn de
   heffingskortingen het grootst. Een minimumloner kreeg zo een strook die
   honderden euro's per jaar naast de werkelijkheid zat.

   DE BEDRAGEN HIERONDER ZIJN VERZONNEN, en dat mag hier: dit is een toets op de
   REKENWIJZE, niet op de tarieven. Ze zijn met opzet rond gekozen zodat elke
   uitkomst met de hand na te rekenen is en in de melding staat hoe. De echte
   cijfers horen in een jaargang (server/kern/payroll/jaargangen/) en die moet
   tegen het Handboek Loonheffingen worden gelegd; geen enkele toets kan dat
   vervangen.

   De vier dingen die niet mogen verschuiven:
   1. HERLEIDEN. Een maandloon gaat maal twaalf voordat het de schijven in gaat.
      Zonder dat valt elk maandsalaris in de eerste schijf.
   2. PER SCHIJF ALLEEN WAT ERIN VALT. Niet het hele bedrag opnieuw belasten.
   3. KORTINGEN BOUWEN AF. Wie ze als vast bedrag rekent, geeft een hoog
      inkomen een korting die het niet heeft.
   4. BIJZONDER LOON GAAT APART. Vakantiegeld bij het periodeloon optellen
      betekent het maal twaalf herleiden -- en dan jaagt een enkele
      vakantiegeldbetaling de hele strook een schijf omhoog.

   Draai los: node --test test/payroll-loonheffing.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const lh = require('../server/kern/payroll/loonheffing');
const motor = require('../server/kern/payroll/motor');
const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');

/* Een verzonnen maar goed rekenbare tabel:
     - tot 30.000 euro (3.000.000 cent): 30%
     - daarboven:                        50%
     - algemene korting: 2.000 euro vast tot 20.000, daarna 10 cent per euro af
     - bijzonder tarief: 40% */
const TABEL = {
  schijven: [{ tot: 3000000, deel: 0.30 }, { tot: null, deel: 0.50 }],
  heffingskortingen: {
    algemeen: [{ tot: 2000000, vast: 200000, deel: 0 },
      { tot: 4000000, vast: 200000, deel: -0.10 },
      { tot: null, vast: 0, deel: 0 }]
  },
  bijzonderTarief: 0.40,
  periodenPerJaar: 12
};
const pakket = (over) => ({ land: 'NL', versie: 'proef-1', geldigVan: '2026-01-01',
  regels: Object.assign({ minimumUurloon: { '21+': 1499 }, loonheffing: TABEL,
    premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 }, over || {}) });

test('een maandloon wordt eerst naar een jaarloon herleid', () => {
  // 2.000 euro per maand = 24.000 per jaar: helemaal in de eerste schijf (30%)
  const r = lh.bereken({ regelpakket: pakket(), grondslagCenten: 200000, betaling: 'maand' });
  const jaar = r.stappen.find(s => s.stap === 'herleid_jaarloon');
  assert.equal(jaar.centen, 2400000, '200000 cent x 12 = 2.400.000');
  /* belasting 30% van 2.400.000 = 720.000; korting = 200.000 - 10% van
     (2.400.000 - 2.000.000) = 200.000 - 40.000 = 160.000; blijft 560.000 per
     jaar, gedeeld door 12 = 46.667 per maand */
  assert.equal(r.centen, 46667, 'gerekend: (720000 - 160000) / 12');
});

test('per schijf telt alleen wat IN die schijf valt', () => {
  // 4.000 euro per maand = 48.000 per jaar: 30.000 tegen 30%, 18.000 tegen 50%
  const r = lh.bereken({ regelpakket: pakket(), grondslagCenten: 400000, betaling: 'maand' });
  const schijven = r.stappen.filter(s => s.stap === 'schijf');
  assert.equal(schijven.length, 2, 'twee schijven geraakt');
  assert.equal(schijven[0].centen, 900000, '30% over 3.000.000');
  assert.equal(schijven[1].centen, 900000, '50% over 1.800.000');
  const voor = r.stappen.find(s => s.stap === 'belasting_voor_korting');
  assert.equal(voor.centen, 1800000, 'samen 1.800.000 -- niet 50% over alles (dat zou 2.400.000 zijn)');
});

/* DEZE TOETS BESTAAT OMDAT DE VORIGE HEM MISTE. Ik mutéerde de schijvenlus --
   `Math.min(rest, boven)` in plaats van `Math.min(rest, boven - onder)`, oftewel
   elke schijf belast het hele bedrag opnieuw -- en de toets bleef groen. Met een
   tabel van TWEE schijven kan dat ook niet anders: de eerste begint bij nul (dan
   is `boven - onder` gelijk aan `boven`) en de laatste is open (dan is het
   allebei oneindig). Het verschil zit alleen in een schijf die van BOVEN EN
   ONDER begrensd is, en die had ik niet.

   Vandaar deze: drie schijven, met een middelste die echt een breedte heeft. */
test('een middelste schijf belast alleen zijn eigen breedte, niet het hele bedrag', () => {
  const drie = [{ tot: 1000000, deel: 0.10 }, { tot: 3000000, deel: 0.20 }, { tot: null, deel: 0.50 }];
  const r = lh.overSchijven(4000000, drie);
  assert.deepEqual(r.stappen.map(s => s.grondslag), [1000000, 2000000, 1000000],
    'de middelste schijf is 2.000.000 breed (van 1 tot 3 miljoen), niet 3.000.000');
  assert.equal(r.stappen[1].centen, 400000, '20% over 2.000.000');
  assert.equal(r.centen, 100000 + 400000 + 500000);
});

test('de heffingskorting bouwt af en gaat nooit onder nul', () => {
  // jaarloon 15.000: onder de afbouwgrens, dus de volle korting
  const laag = lh.bereken({ regelpakket: pakket(), grondslagCenten: 125000, betaling: 'maand' });
  const kLaag = laag.stappen.find(s => s.stap === 'heffingskorting');
  assert.equal(kLaag.centen, -200000, 'de volle korting van 200.000 cent');

  // jaarloon 48.000: ruim boven de afbouw, de korting is op
  const hoog = lh.bereken({ regelpakket: pakket(), grondslagCenten: 400000, betaling: 'maand' });
  const kHoog = hoog.stappen.find(s => s.stap === 'heffingskorting');
  assert.equal(kHoog.centen, 0, 'boven het laatste stuk is er geen korting meer');
});

test('meer korting dan belasting levert geen negatieve loonheffing op', () => {
  /* Een jaarloon van 6.000 (500 per maand): belasting 30% = 180.000, korting
     200.000. Zonder afkapping zou hier -20.000 staan, en dat zou betekenen dat
     de werkgever belasting UITBETAALT via de strook. Dat verrekent de
     Belastingdienst bij de aangifte, niet wij. */
  const r = lh.bereken({ regelpakket: pakket(), grondslagCenten: 50000, betaling: 'maand' });
  assert.equal(r.centen, 0);
  assert.ok(r.stappen.some(s => s.stap === 'korting_afgekapt'),
    'en dat staat als eigen stap op de strook, niet stilletjes');
});

test('vier weken is geen maand: dertien perioden, niet twaalf', () => {
  const r = lh.bereken({ regelpakket: pakket({ loonheffing: Object.assign({}, TABEL,
    { periodenPerJaar: null }) }), grondslagCenten: 200000, betaling: 'vierweken' });
  assert.equal(r.periodenPerJaar, 13);
  assert.equal(r.stappen.find(s => s.stap === 'herleid_jaarloon').centen, 2600000);
});

test('bijzonder loon gaat tegen het bijzondere tarief, apart van het periodeloon', () => {
  const r = lh.bereken({ regelpakket: pakket(), grondslagCenten: 200000,
    bijzonderCenten: 160000, betaling: 'maand' });
  const bijz = r.stappen.find(s => s.stap === 'bijzonder_tarief');
  assert.equal(bijz.centen, 64000, '40% van 160.000');
  // en het periodeloon is er niet door veranderd
  assert.equal(r.stappen.find(s => s.stap === 'herleid_jaarloon').centen, 2400000,
    'het vakantiegeld is NIET meegeherleid; anders stond hier 2.400.000 + 12 x 160.000');
  assert.equal(r.centen, 46667 + 64000);
});

test('zonder bijzonderTarief valt het terug op het marginale tarief, met die keuze in beeld', () => {
  const zonder = Object.assign({}, TABEL); delete zonder.bijzonderTarief;
  const r = lh.bereken({ regelpakket: pakket({ loonheffing: zonder }),
    grondslagCenten: 400000, bijzonderCenten: 100000, betaling: 'maand' });
  const s = r.stappen.find(x => x.stap === 'bijzonder_zonder_tarief');
  assert.ok(s, 'de terugval staat als eigen stap op de strook');
  assert.equal(s.centen, 50000, 'jaarloon 48.000 zit in de 50%-schijf: 50% van 100.000');
});

test('een pakket met alleen een vlak percentage blijft precies werken zoals het werkte', () => {
  const vlak = pakket({ loonheffing: { tarief: 0.37 } });
  const r = lh.bereken({ regelpakket: vlak, grondslagCenten: 200000, bijzonderCenten: 50000, betaling: 'maand' });
  assert.equal(r.soort, 'vlak');
  assert.equal(r.centen, Math.round(250000 * 0.37), 'vlak rekent over alles, ook het bijzondere deel');
  /* En dat staat er ook bij. Een bedrag dat met een vlak percentage is gerekend
     is een SCHATTING; wie dat niet ziet, houdt het voor een aangifte. */
  assert.match(r.stappen[0].uitleg, /geen jaartabel/);
});

test('de keuring houdt een tabel tegen die niet klopt', () => {
  const scheef = lh.keurTabel({ schijven: [{ tot: 3000000, deel: 0.30 }, { tot: 2000000, deel: 0.50 }] });
  assert.ok(scheef.some(b => /loopt niet op/.test(b)), 'schijven die terugspringen: ' + scheef.join(' '));

  const open = lh.keurTabel({ schijven: [{ tot: null, deel: 0.30 }, { tot: 5000000, deel: 0.50 }] });
  assert.ok(open.some(b => /niet de laatste/.test(b)), 'een open schijf in het midden: ' + open.join(' '));

  const gek = lh.keurTabel({ schijven: [{ tot: null, deel: 3.7 }] });
  assert.ok(gek.some(b => /niet aannemelijk/.test(b)), 'een tarief van 370%: ' + gek.join(' '));

  const kort = lh.keurTabel({ schijven: [{ tot: null, deel: 0.3 }],
    heffingskortingen: { algemeen: [{ tot: 100, vast: -5, deel: 0 }] } });
  assert.ok(kort.some(b => /vast is geen positief bedrag/.test(b)), kort.join(' '));

  assert.deepEqual(lh.keurTabel(TABEL), [], 'en een tabel die wel klopt komt er gewoon door');
});

test('het regelpakket weigert een pakket met een kapotte tabel', () => {
  const db = { data: {} };
  const rp = maakRegelpakket({ db, save: () => {}, nu: () => '2026-03-01T00:00:00.000Z' });
  const r = rp.neemOp(pakket({ loonheffing: { schijven: [{ tot: 100, deel: 9 }] } }), { soort: 'test' });
  assert.equal(r.status, 422);
  assert.ok(r.bezwaren.some(b => /niet aannemelijk/.test(b)), r.bezwaren.join(' '));
  // en de goede versie komt er wel in
  assert.ok(rp.neemOp(pakket(), { soort: 'test' }).ok);
});

test('de motor rekent een strook met de tabel, en het vakantiegeld gaat apart', () => {
  const comp = {
    gewerkte_uren: { sleutel: 'gewerkte_uren', naam: 'Gewerkte uren', soort: 'bruto',
      grondslagen: ['loonheffing', 'premies', 'zvw'], vakantiegeldgevend: true, grootboek: '4000' },
    vakantiegeld: { sleutel: 'vakantiegeld', naam: 'Vakantiegeld', soort: 'bruto', bijzonder: true,
      grondslagen: ['loonheffing', 'premies', 'zvw'], vakantiegeldgevend: false, grootboek: '4020' }
  };
  const strook = motor.bereken({
    contract: { uurloonCenten: 1250, betaling: 'maand' },
    periode: { van: '2026-03-01' },
    invoer: [{ component: 'gewerkte_uren', aantal: 160 }],
    regelpakket: Object.assign({ stand: 'goedgekeurd' }, pakket()),
    componenten: comp
  });
  assert.ok(!strook.fout, strook.fout || '');
  // 160 x 1250 = 200.000 bruto, plus 8% vakantiegeld = 16.000
  assert.equal(strook.brutoCenten, 216000);
  const stap = strook.stappen.find(s => s.stap === 'loonheffing');
  assert.equal(stap.soort, 'tabel', 'de tabel is gebruikt, niet het vlakke percentage');
  assert.equal(stap.bijzonder, 16000, 'het vakantiegeld staat als bijzonder loon apart');
  assert.equal(stap.regulier, 200000, 'en telt niet mee in het periodeloon dat wordt herleid');
  // 46.667 over het periodeloon + 40% van 16.000
  assert.equal(strook.loonheffingCenten, 46667 + 6400);
  assert.equal(strook.nettoCenten, 216000 - (46667 + 6400));
});
