/* Payroll OS: de invoer van een loonrun samenstellen -- vast loon en verzuim.

   TWEE FOUTEN DIE HIER WORDEN RECHTGEZET, en ze waren allebei stil.

   1. VAST LOON BESTOND NIET. De loonrun bouwde zijn invoer uit EEN bron: de
      klok. `basissalaris` stond wel in het componentenregister maar werd door
      niets geproduceerd. Iedereen met een maandsalaris die niet prikt --
      kantoor, management, elke vaste kracht zonder prikklok -- stond niet eens
      IN de loonrun. Geen strook, geen betaling, en geen foutmelding: je
      verdween gewoon uit de lijst.

   2. ZIEKTE VERLAAGDE HET LOON. De verzuimlaag kende de
      doorbetalingspercentages en `voorPayroll()` werd door niemand aangeroepen.
      Iemand die twee weken ziek was klokte twee weken niet, en kreeg dus twee
      weken niets -- terwijl de wet zegt dat er wordt doorbetaald.

   De mutaties die deze toets horen te laten zakken: laat `stel()` weer over de
   geklokte feiten lopen in plaats van over het personeel met een contract, of
   haal de verzuim-tak uit `voorMens()`.

   Draai los: node --test test/payroll-samenstellen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakSamenstellen, werkdagenVan, periodeloonVan } = require('../server/kern/payroll/samenstellen');
const { maakContracten } = require('../server/kern/payroll/contracten');
const { maakUren } = require('../server/kern/payroll/uren');
const { maakVerzuim } = require('../server/kern/payroll/verzuim');
const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakRun } = require('../server/kern/payroll/run');
const motor = require('../server/kern/payroll/motor');
const maakOpslag = require('../server/kern/payroll/opslag');

const PERIODE = '2026-03';   // maart 2026: 22 werkdagen

function opzet() {
  const db = { data: {} };
  const save = () => {};
  let t = 0;
  const nu = () => '2026-04-01T10:0' + (t++ % 10) + ':00.000Z';
  const contracten = maakContracten({ opslag: maakOpslag({ db }), save, nu });
  const uren = maakUren({ opslag: maakOpslag({ db })});
  const verzuim = maakVerzuim({ opslag: maakOpslag({ db }), save, nu });
  const samenstellen = maakSamenstellen({ contracten, uren, verzuim });
  return { db, save, nu, contracten, uren, verzuim, samenstellen };
}

const vastContract = (over) => Object.assign({ vanaf: '2026-01-01', soort: 'vast',
  uurloonCenten: 2000, urenPerWeek: 40, betaling: 'maand' }, over || {});

/* Diensten zoals de klok ze schrijft. */
function klok(db, code, staffId, naam, dagen) {
  db.data.klok = db.data.klok || {};
  db.data.klok[code] = (db.data.klok[code] || []).concat(dagen.map((d, i) => ({
    id: 'k' + staffId + i, staffId, name: naam,
    in: d + 'T09:00:00.000Z', out: d + 'T17:00:00.000Z' })));
}

test('maart 2026 heeft 22 werkdagen, en dat blijft zo als je de run overdoet', () => {
  const a = werkdagenVan('2026-03');
  assert.equal(a.length, 22);
  assert.equal(a[0], '2026-03-02', 'de eerste maandag');
  assert.deepEqual(werkdagenVan('2026-03'), a, 'dezelfde periode, hetzelfde antwoord');
  assert.equal(werkdagenVan('2026-02').length, 20);
});

test('het periodeloon komt uit het contract, of anders zichtbaar uit een afleiding', () => {
  const uit = periodeloonVan(vastContract({ maandloonCenten: 350000 }));
  assert.equal(uit.centen, 350000);
  assert.equal(uit.afgeleid, false, 'staat het er, dan is dat het -- geen afleiding overheen');

  const af = periodeloonVan(vastContract());
  assert.equal(af.afgeleid, true);
  assert.equal(af.centen, Math.round(2000 * 40 * (52 / 12)));
  assert.match(af.uitleg, /2000 cent x 40 uur/, 'en de afleiding staat erbij: ' + af.uitleg);
});

test('WIE NIET KLOKT MAAR EEN VAST CONTRACT HEEFT, STAAT GEWOON IN DE RUN', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 350000 }), 'M. de Wit');
  // geen enkele klokregel: dit is precies de persoon die eerder verdween
  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] });

  assert.equal(uit.regels.length, 1, 'zonder deze regel kreeg zij geen loonstrook en geen geld');
  const r = uit.regels[0];
  const basis = r.invoer.find(x => x.component === 'basissalaris');
  assert.ok(basis, 'met een basissalaris: ' + JSON.stringify(r.invoer));
  assert.equal(basis.centen, 350000, 'het hele maandsalaris, want zij was er alle 22 dagen');
  assert.equal(basis.dagen, 22);
  assert.ok(r.gewerkteUren > 0, 'en contracturen voor de minimumloontoets, niet nul geklokte uren');
});

test('een oproepkracht blijft op zijn geklokte uren', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 8, vastContract({ soort: 'oproep', urenPerWeek: null }), 'M. de Wit');
  klok(k.db, 'MERIDIAAN', 8, 'Sanne Roos', ['2026-03-02', '2026-03-03', '2026-03-04']);
  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 8, naam: 'Sanne Roos' }] });
  const r = uit.regels[0];
  assert.ok(r.invoer.some(x => x.component === 'gewerkte_uren'), 'de klok is hier de waarheid');
  assert.ok(!r.invoer.some(x => x.component === 'basissalaris'), 'en er is geen maandsalaris');
  assert.equal(r.gewerkteUren, 24);
});

test('ZIEKTE WORDT DOORBETAALD, NIET VAN HET LOON AFGETROKKEN', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 220000 }), 'M. de Wit');
  // vijf werkdagen ziek (ma 9 maart t/m vr 13 maart)
  k.verzuim.meld('MERIDIAAN', 7, { soort: 'ziek', van: '2026-03-09', tot: '2026-03-13' }, 'Evi van Dalen');

  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] });
  const inv = uit.regels[0].invoer;
  const basis = inv.find(x => x.component === 'basissalaris');
  const door = inv.find(x => x.component === 'loondoorbetaling');

  assert.equal(basis.dagen, 17, '22 werkdagen min 5 ziektedagen');
  assert.equal(basis.centen, Math.round(220000 * (17 / 22)));
  assert.ok(door, 'en er staat doorbetaling op de strook: ' + JSON.stringify(inv));
  assert.equal(door.dagen, 5);
  assert.equal(door.betaaldDeel, 0.7, '70% bij ziekte, uit de verlofsoort en niet uit deze code');
  assert.equal(door.centen, Math.round(220000 * (5 / 22) * 0.7));
  assert.match(door.uitleg, /Ziek: 5 van 22 werkdagen tegen 70%/, door.uitleg);

  /* HET PUNT: zonder de doorbetaling zou hier alleen 17/22 staan. Met de
     doorbetaling is het loon hoger, en dat is wat de wet zegt. */
  assert.ok(basis.centen + door.centen > Math.round(220000 * (17 / 22)),
    'het totaal ligt boven het loon over alleen de gewerkte dagen');
});

test('een weekend telt niet als ziektedag', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 220000 }), 'M. de Wit');
  // zaterdag en zondag ziek
  k.verzuim.meld('MERIDIAAN', 7, { soort: 'ziek', van: '2026-03-07', tot: '2026-03-08' }, 'Evi van Dalen');
  const inv = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] }).regels[0].invoer;
  assert.equal(inv.find(x => x.component === 'basissalaris').dagen, 22, 'het volle salaris');
  assert.ok(!inv.some(x => x.component === 'loondoorbetaling'), 'en geen doorbetalingsregel');
});

test('onbetaald verlof gaat er wel af, en zegt dat', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 220000 }), 'M. de Wit');
  k.verzuim.meld('MERIDIAAN', 7, { soort: 'onbetaald', van: '2026-03-09', tot: '2026-03-13' }, 'Evi van Dalen');
  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] });
  const inv = uit.regels[0].invoer;
  assert.equal(inv.find(x => x.component === 'basissalaris').dagen, 17);
  assert.ok(!inv.some(x => x.component === 'loondoorbetaling'), '0% is geen regel van nul euro');
  assert.ok(uit.bevindingen.some(b => b.soort === 'onbetaald_verlof'),
    'maar het staat wel als bevinding, zodat niemand zich afvraagt waar het loon bleef');
});

test('zwangerschapsverlof wordt volledig doorbetaald en meldt het UWV', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 220000 }), 'M. de Wit');
  k.verzuim.meld('MERIDIAAN', 7, { soort: 'zwangerschap', van: '2026-03-02', tot: '2026-03-31' }, 'Evi van Dalen');
  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] });
  const inv = uit.regels[0].invoer;
  assert.ok(!inv.some(x => x.component === 'basissalaris'), 'de hele maand afwezig');
  const door = inv.find(x => x.component === 'loondoorbetaling');
  assert.equal(door.centen, 220000, '100% doorbetaald');
  assert.ok(uit.bevindingen.some(b => b.soort === 'uwv_uitkering'),
    'en de uitkering bij het UWV wordt gemeld: die vraag je apart aan');
});

test('een zieke oproepkracht krijgt geen verzonnen bedrag maar een bevinding', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 8, vastContract({ soort: 'oproep', urenPerWeek: null }), 'M. de Wit');
  klok(k.db, 'MERIDIAAN', 8, 'Sanne Roos', ['2026-03-02']);
  k.verzuim.meld('MERIDIAAN', 8, { soort: 'ziek', van: '2026-03-09', tot: '2026-03-13' }, 'Sanne Roos');
  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 8, naam: 'Sanne Roos' }] });
  assert.ok(!uit.regels[0].invoer.some(x => x.component === 'loondoorbetaling'),
    'bij een oproepcontract volgt de doorbetaling uit het gemiddelde van eerdere perioden; dat verzinnen we niet');
  const b = uit.bevindingen.find(x => x.soort === 'doorbetaling_handmatig');
  assert.ok(b, 'maar het meldt zichzelf: ' + JSON.stringify(uit.bevindingen));
  assert.match(b.uitleg, /met de hand/);
});

test('een vaste kracht houdt zijn nachttoeslag, maar krijgt zijn uren niet dubbel', () => {
  const k = opzet();
  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 350000 }), 'M. de Wit');
  klok(k.db, 'MERIDIAAN', 7, 'Evi van Dalen', ['2026-03-02', '2026-03-03']);
  const inv = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] }).regels[0].invoer;
  assert.ok(inv.some(x => x.component === 'basissalaris'));
  assert.ok(!inv.some(x => x.component === 'gewerkte_uren'),
    'zijn geklokte uren komen NIET bovenop het maandsalaris -- dat zou dubbel betalen zijn');
});

test('zonder contract geen strook, ook niet met geklokte uren', () => {
  const k = opzet();
  klok(k.db, 'MERIDIAAN', 9, 'Deniz Kaya', ['2026-03-02']);
  const uit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 9, naam: 'Deniz Kaya' }] });
  assert.equal(uit.regels.length, 0, 'een uurloon verzinnen is erger dan een lege run');
});

test('de hele keten: van contract en ziekmelding tot een berekende strook', () => {
  const k = opzet();
  const regelpakket = maakRegelpakket({ opslag: maakOpslag({ db: k.db }), save: k.save, nu: k.nu });
  const componenten = maakComponenten({ opslag: maakOpslag({ db: k.db }), save: k.save, nu: k.nu });
  regelpakket.neemOp({ land: 'NL', versie: 'nl-2026.1', geldigVan: '2026-01-01', geldigTot: '2026-12-31',
    valuta: 'EUR', regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
      premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 } }, { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ opslag: maakOpslag({ db: k.db }), save: k.save, nu: k.nu, crypto, motor, regelpakket, componenten });

  k.contracten.leg('MERIDIAAN', 7, vastContract({ maandloonCenten: 220000 }), 'M. de Wit');
  k.verzuim.meld('MERIDIAAN', 7, { soort: 'ziek', van: '2026-03-09', tot: '2026-03-13' }, 'Evi van Dalen');
  const opzetUit = k.samenstellen.stel({ code: 'MERIDIAAN', periode: PERIODE,
    personeel: [{ id: 7, naam: 'Evi van Dalen' }] });

  const r = run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: PERIODE,
    land: 'NL', regels: opzetUit.regels, door: 'A. Bakker' });
  assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  const strook = run.haal(r.run.id).stroken[0].strook;

  const namen = strook.regels.map(x => x.component);
  assert.ok(namen.includes('basissalaris'), namen.join(', '));
  assert.ok(namen.includes('loondoorbetaling'), 'de doorbetaling staat als eigen regel op de strook');
  assert.ok(namen.includes('vakantiegeld'), 'en er wordt vakantiegeld over opgebouwd');
  assert.ok(strook.nettoCenten > 0);

  /* De doorbetaling telt mee voor de loonheffing: het is loon. Zou hij dat niet
     doen, dan is de aangifte te laag en komt dat pas bij een controle boven. */
  const g = strook.stappen.find(s => s.stap === 'grondslagen');
  assert.equal(g.loonheffing, strook.brutoCenten,
    'alles op deze strook is belast loon');
});
