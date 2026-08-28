/* Payroll OS: VALUTA -- want "centen" is niet overal honderdsten.

   WAT HIER OP HET SPEL STAAT, en het is geen opsmuk. De hele loonlaag rekent in
   gehele getallen, en dat is goed. Maar het veld heet `brutoCenten`, het scherm
   zet er een euroteken voor, en beide gaan ervan uit dat honderd van dat getal
   een eenheid is. In Japan is dat niet zo: de yen heeft GEEN onderverdeling.
   Wie daar met honderdsten rekent, betaalt honderd keer te veel of te weinig --
   en te veel is erger, want dat merkt niemand die het geld ontvangt.

   Andersom bestaan er valuta's met DRIE decimalen (Koeweit, Bahrein, Tunesie).

   De toetsen gaan over wat NIET mag:
   - een onbekende valutacode stilzwijgend als "twee decimalen" behandelen;
   - een pakket met een verzonnen muntcode binnenlaten;
   - een strook zonder valuta uitgeven (of erger: met een stille aanname);
   - een SEPA-betaalbestand maken voor een run die niet in euro's staat.

   Draai los: node --test test/payroll-valuta.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const valuta = require('../server/kern/payroll/valuta');
const motor = require('../server/kern/payroll/motor');
const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakRun } = require('../server/kern/payroll/run');
const { maakJournaal } = require('../server/kern/payroll/journaal');
const maakOpslag = require('../server/kern/payroll/opslag');

const pakket = (over) => Object.assign({
  land: 'NL', versie: 'proef-1', geldigVan: '2026-01-01', geldigTot: '2026-12-31',
  regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
    premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 }
}, over || {});

test('de yen heeft geen onderverdeling, de dinar heeft er drie', () => {
  assert.equal(valuta.decimalenVan('EUR'), 2);
  assert.equal(valuta.decimalenVan('JPY'), 0, 'de yen kent geen centen');
  assert.equal(valuta.decimalenVan('KRW'), 0);
  assert.equal(valuta.decimalenVan('KWD'), 3, 'duizend fils zijn een dinar');
  assert.equal(valuta.schaalVan('JPY'), 1);
  assert.equal(valuta.schaalVan('EUR'), 100);
  assert.equal(valuta.schaalVan('KWD'), 1000);
});

test('een onbekende code levert null en NIET een vriendelijke twee', () => {
  /* Dit is de kern. Een gok van twee decimalen op een munt die je niet kent, is
     een factor honderd in een bedrag dat naar iemands rekening gaat. Liever
     stoppen dan gokken. */
  assert.equal(valuta.decimalenVan('XYZZY'), null);
  assert.equal(valuta.decimalenVan(''), null);
  assert.equal(valuta.decimalenVan(null), null);
  assert.equal(valuta.schaalVan('xx'), null);
});

test('bedragen worden getoond in hun eigen munt en hun eigen schaal', () => {
  assert.equal(valuta.toon(420000, 'EUR'), '€ 4.200,00');
  assert.equal(valuta.toon(420000, 'JPY'), '¥ 420.000', 'geen decimalen, en dus geen komma');
  assert.equal(valuta.toon(4200000, 'KWD'), 'KWD 4.200,000', 'drie decimalen');
  assert.equal(valuta.toon(-1250, 'EUR'), '-€ 12,50');
  assert.equal(valuta.toon(5, 'EUR'), '€ 0,05');
  /* Zonder symbool komt de CODE in beeld en niet een teken dat bij een andere
     munt hoort: een dollarteken voor een Canadese dollar naast een Amerikaanse
     is hoe je een bedrag in het verkeerde land leest. */
  assert.equal(valuta.toon(100000, 'CAD'), 'CAD 1.000,00');
  assert.match(valuta.toon(1000, 'XYZZY'), /onbekende valuta|XYZZY/);
});

test('het regelpakket weigert een verzonnen muntcode', () => {
  const db = { data: {} };
  const rp = maakRegelpakket({ opslag: maakOpslag({ db }), save: () => {}, nu: () => '2026-03-01T00:00:00.000Z' });
  const fout = rp.neemOp(pakket({ valuta: 'euro' }), { soort: 'test' });
  assert.equal(fout.status, 422);
  assert.ok(fout.bezwaren.some(b => /ISO 4217/.test(b)), fout.bezwaren.join(' '));

  assert.ok(rp.neemOp(pakket({ versie: 'proef-2', valuta: 'JPY' }), { soort: 'test' }).ok);
  const opgeslagen = rp.alle('NL').find(p => p.versie === 'proef-2');
  assert.equal(opgeslagen.valuta, 'JPY', 'de munt hoort bij het pakket, niet bij het land');
});

test('een strook draagt zijn valuta, en een aanname zegt dat hij aangenomen is', () => {
  const comp = { gewerkte_uren: { sleutel: 'gewerkte_uren', naam: 'Gewerkte uren', soort: 'bruto',
    grondslagen: ['loonheffing'], vakantiegeldgevend: false, grootboek: '4000' } };

  const zonder = motor.bereken({ contract: { uurloonCenten: 1800 }, periode: { van: '2026-03-01' },
    invoer: [{ component: 'gewerkte_uren', aantal: 10 }],
    regelpakket: Object.assign({ stand: 'goedgekeurd' }, pakket()), componenten: comp });
  assert.equal(zonder.valuta.code, 'EUR');
  assert.equal(zonder.valuta.aangenomen, true,
    'zonder valuta op het pakket wordt EUR aangenomen -- en dat staat erbij, niet stil');

  const met = motor.bereken({ contract: { uurloonCenten: 1800 }, periode: { van: '2026-03-01' },
    invoer: [{ component: 'gewerkte_uren', aantal: 10 }],
    regelpakket: Object.assign({ stand: 'goedgekeurd' }, pakket({ valuta: 'JPY' })), componenten: comp });
  assert.equal(met.valuta.code, 'JPY');
  assert.equal(met.valuta.decimalen, 0);
  assert.equal(met.valuta.aangenomen, false);
  /* De REKENSOM verandert niet: 10 x 1800 is 18000 in de kleinste eenheid,
     welke munt dat ook is. Wat verandert is wat dat getal BETEKENT -- 180 euro
     of 18.000 yen -- en dat is precies waarom het erbij hoort te staan. */
  assert.equal(met.brutoCenten, zonder.brutoCenten);
  assert.equal(valuta.toon(met.brutoCenten, met.valuta.code), '¥ 18.000');
  assert.equal(valuta.toon(zonder.brutoCenten, zonder.valuta.code), '€ 180,00');
});

test('een SEPA-betaalbestand wordt geweigerd voor een run die niet in euro staat', () => {
  const db = { data: {} };
  const save = () => {};
  let t = 0;
  const nu = () => '2026-04-01T10:0' + (t++ % 10) + ':00.000Z';
  const regelpakket = maakRegelpakket({ opslag: maakOpslag({ db }), save, nu });
  const componenten = maakComponenten({ opslag: maakOpslag({ db }), save, nu });
  regelpakket.neemOp(pakket({ land: 'JP', versie: 'jp-2026.1', valuta: 'JPY' }), { soort: 'test' });
  regelpakket.merkAan('JP', 'jp-2026.1', 'R. Sardjoe');
  const run = maakRun({ opslag: maakOpslag({ db }), save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ opslag: maakOpslag({ db }), save, nu, crypto });

  const r = run.open({ code: 'TOKIO', zaak: 'RTG Tokio', periode: '2026-03', land: 'JP',
    regels: [{ staffId: 1, naam: 'K. Tanaka', contract: { uurloonCenten: 1800, soort: 'vast' },
      invoer: [{ component: 'gewerkte_uren', aantal: 160 }], leeftijdsgroep: '21+', gewerkteUren: 160 }],
    door: 'A. Bakker' });
  run.keurGoed(r.run.id, 'manager', 'M. de Wit', 900);
  run.keurGoed(r.run.id, 'administrateur', 'A. Bakker', 901);
  run.maakDefinitief(r.run.id, 'A. Bakker');
  const vol = run.haal(r.run.id);

  /* HET JOURNAAL MAG WEL: boeken kan in elke munt, dat is administratie. */
  const b = journaal.boeking(vol);
  assert.ok(b.ok, b.error || '');

  /* HET BETAALBESTAND NIET. SEPA draagt geen muntaanduiding: yen erin zetten
     levert geen foutmelding op bij de bank maar een BETALING in euro's. */
  const bet = journaal.betaalbestand(vol, { 1: 'NL91ABNA0417164300' });
  assert.equal(bet.status, 422, JSON.stringify(bet).slice(0, 200));
  assert.equal(bet.valuta, 'JPY');
  assert.match(bet.error, /alleen euro/, bet.error);
  assert.match(bet.error, /buiten RTG om/, 'en zegt wat er dan wel moet gebeuren');
});

test('in euro werkt het betaalbestand gewoon', () => {
  const db = { data: {} };
  const save = () => {};
  let t = 0;
  const nu = () => '2026-04-01T10:0' + (t++ % 10) + ':00.000Z';
  const regelpakket = maakRegelpakket({ opslag: maakOpslag({ db }), save, nu });
  const componenten = maakComponenten({ opslag: maakOpslag({ db }), save, nu });
  regelpakket.neemOp(pakket({ versie: 'nl-2026.1', valuta: 'EUR' }), { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ opslag: maakOpslag({ db }), save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ opslag: maakOpslag({ db }), save, nu, crypto });
  const r = run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: '2026-03', land: 'NL',
    regels: [{ staffId: 1, naam: 'Timo Vos', contract: { uurloonCenten: 1800, soort: 'vast' },
      invoer: [{ component: 'gewerkte_uren', aantal: 160 }], leeftijdsgroep: '21+', gewerkteUren: 160 }],
    door: 'A. Bakker' });
  run.keurGoed(r.run.id, 'manager', 'M. de Wit', 900);
  run.keurGoed(r.run.id, 'administrateur', 'A. Bakker', 901);
  run.maakDefinitief(r.run.id, 'A. Bakker');
  const bet = journaal.betaalbestand(run.haal(r.run.id), { 1: 'NL91ABNA0417164300' });
  assert.ok(bet.ok, JSON.stringify(bet).slice(0, 200));
  assert.equal(bet.bestand.aantal, 1);
});
