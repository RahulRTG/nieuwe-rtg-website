/* Payroll OS: de uren uit de klok en de automatische controles.

   HIER SLUIT DE KETEN: dienst plannen, inklokken, toeslagen berekenen,
   afwijkingen zien, en dan pas de loonrun. Dat is wat een payroll onderscheidt
   van een salarisberekenaar, en het is ook waar het stilletjes fout gaat.

   Wat de toetsen bewaken, en waarom juist dat:
   - een ontbrekende uitklok wordt NIET geschat maar overgeslagen en gemeld;
   - overlappende diensten verdubbelen de uren niet;
   - nachturen kloppen over middernacht heen (waar de meeste fouten zitten);
   - meten en wegen zijn gescheiden: de cao zit niet in de meetcode;
   - de controlelaag repareert niets, hij meldt;
   - een openstaande hoge bevinding houdt de run tegen;
   - verklaren kan, wegklikken zonder reden niet.

   Draai los: node --experimental-sqlite --test test/payroll-uren-controles.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakUren, nachtUren } = require('../server/kern/payroll/uren');
const { maakControles } = require('../server/kern/payroll/controles');
const maakOpslag = require('../server/kern/payroll/opslag');

/* Een klok met vaste tijden. Let op: de tijden zijn lokaal, want dat is ook hoe
   er geklokt wordt -- een dienst van 22:00 is 22:00 op de vloer. */
function klok(rijen) {
  return { data: { klok: { ESVEDRA: rijen } } };
}
const dienst = (staffId, van, tot, naam) => ({ staffId, name: naam || 'Sam',
  in: van, out: tot === null ? null : tot });

test('nachturen kloppen over middernacht heen', () => {
  const van = new Date('2026-06-10T22:00:00').getTime();
  const tot = new Date('2026-06-11T06:00:00').getTime();
  assert.equal(Math.round(nachtUren(van, tot, 0, 6)), 6, 'van 22:00 tot 06:00 zijn zes nachturen');

  const dag = new Date('2026-06-10T09:00:00').getTime();
  const dagTot = new Date('2026-06-10T17:00:00').getTime();
  assert.equal(nachtUren(dag, dagTot, 0, 6), 0, 'een dagdienst heeft er geen');
});

test('een ontbrekende uitklok wordt niet geschat maar gemeld', () => {
  const db = klok([dienst(1, '2026-06-03T09:00:00', '2026-06-03T17:00:00'),
    dienst(1, '2026-06-04T09:00:00', null)]);
  const uren = maakUren({ opslag: maakOpslag({ db })});
  const m = uren.meet('ESVEDRA', '2026-06');
  assert.equal(m.feiten[0].uren, 8, 'alleen de volledige dienst telt');
  const b = m.bevindingen.find(x => x.soort === 'ontbrekende_uitklok');
  assert.ok(b, JSON.stringify(m.bevindingen));
  assert.equal(b.ernst, 'hoog');
  assert.equal(b.eigenaar, 'manager');
  assert.equal(b.status, 'open');
});

test('overlappende diensten verdubbelen de uren niet', () => {
  const db = klok([dienst(1, '2026-06-03T09:00:00', '2026-06-03T17:00:00'),
    dienst(1, '2026-06-03T15:00:00', '2026-06-03T20:00:00')]);
  const m = maakUren({ opslag: maakOpslag({ db })}).meet('ESVEDRA', '2026-06');
  assert.equal(m.feiten[0].uren, 8, 'de tweede telt niet mee: iemand klokt niet op twee plekken');
  assert.ok(m.bevindingen.some(b => b.soort === 'overlappende_dienst'));
});

test('uren na de laatste werkdag tellen niet mee', () => {
  const db = klok([dienst(1, '2026-06-03T09:00:00', '2026-06-03T17:00:00'),
    dienst(1, '2026-06-20T09:00:00', '2026-06-20T17:00:00')]);
  const m = maakUren({ opslag: maakOpslag({ db })}).meet('ESVEDRA', '2026-06', { uitDienstOp: { 1: '2026-06-10' } });
  assert.equal(m.feiten[0].uren, 8);
  const b = m.bevindingen.find(x => x.soort === 'uren_na_uitdienst');
  assert.ok(b && b.eigenaar === 'administrateur', JSON.stringify(m.bevindingen));
});

test('meten en wegen zijn gescheiden: de cao zit niet in de meting', () => {
  const db = klok([dienst(1, '2026-06-01T22:00:00', '2026-06-02T06:00:00')]);
  const uren = maakUren({ opslag: maakOpslag({ db })});
  const m = uren.meet('ESVEDRA', '2026-06');
  const feit = m.feiten[0];
  assert.equal(feit.uren, 8);
  assert.equal(feit.nachturen, 6);
  assert.ok(!JSON.stringify(feit).includes('component'), 'de meting kent geen looncomponenten');

  // pas het wegen maakt er componenten van, en dat is instelbaar
  const contract = { uurloonCenten: 1800, urenPerWeek: 40 };
  const zuinig = uren.weeg(feit, contract, { nachtDeel: 0 });
  assert.ok(!zuinig.invoer.some(i => i.component === 'nachttoeslag'), 'zonder afspraak geen toeslag');
  const ruim = uren.weeg(feit, contract, { nachtDeel: 0.20 });
  const nacht = ruim.invoer.find(i => i.component === 'nachttoeslag');
  assert.equal(nacht.aantal, 6);
  assert.equal(nacht.tariefCenten, 360, '20% van 18,00');
});

test('overuren gaan over het contract heen, niet over een vast getal', () => {
  const db = klok([]);
  const uren = maakUren({ opslag: maakOpslag({ db })});
  const feit = { staffId: 1, uren: 200, nachturen: 0, zondaguren: 0 };
  const klein = uren.weeg(feit, { uurloonCenten: 1800, urenPerWeek: 24 });
  const groot = uren.weeg(feit, { uurloonCenten: 1800, urenPerWeek: 40 });
  const overVan = (w) => (w.invoer.find(i => i.component === 'overuren_125') || {}).aantal || 0;
  assert.ok(overVan(klein) > overVan(groot), 'een 24-urencontract komt eerder aan overuren toe');
});

/* ---------- de controlelaag ---------- */
function nepRun(over) {
  return Object.assign({ id: 'run_test', periode: '2026-06', stroken: [
    { staffId: 1, naam: 'Sam', waarschuwingen: [], strook: { nettoCenten: 150000, regels: [
      { component: 'gewerkte_uren', aantal: 100, centen: 180000 }] } }
  ] }, over || {});
}
const opzetC = () => { const db = { data: {} }; return maakControles({ opslag: maakOpslag({ db }), save: () => {}, nu: () => '2026-07-01T12:00:00.000Z' }); };

test('een sterke afwijking van de vorige periode wordt gezien, niet gerepareerd', () => {
  const c = opzetC();
  const vorige = nepRun({ stroken: [{ staffId: 1, naam: 'Sam', waarschuwingen: [],
    strook: { nettoCenten: 300000, regels: [] } }] });
  const r = c.loop(nepRun(), { vorigeRun: vorige });
  const b = r.bevindingen.find(x => x.soort === 'afwijking_vorige_periode');
  assert.ok(b, JSON.stringify(r.bevindingen));
  assert.match(b.uitleg, /3000\.00 naar 1500\.00/, 'met de getallen erin: ' + b.uitleg);
  assert.equal(b.eigenaar, 'manager');
});

test('een openstaande hoge bevinding houdt de run tegen', () => {
  const c = opzetC();
  c.loop(nepRun({ stroken: [{ staffId: 1, naam: 'Sam', waarschuwingen: [],
    strook: { nettoCenten: -500, regels: [] } }] }), {});
  const mag = c.magDefinitief('run_test');
  assert.equal(mag.status, 409, 'negatief netto is hoog en blijft in de weg staan');
  assert.ok(mag.bevindingen.some(b => b.soort === 'negatief_netto'));
});

test('verklaren kan met een reden, wegklikken zonder reden niet', () => {
  const c = opzetC();
  c.loop(nepRun({ stroken: [{ staffId: 1, naam: 'Sam', waarschuwingen: [],
    strook: { nettoCenten: -500, regels: [] } }] }), {});
  assert.equal(c.verklaar('run_test', 'negatief_netto', 1, 'ok', 'A. Bakker').status, 400, 'een reden van niks telt niet');
  const v = c.verklaar('run_test', 'negatief_netto', 1, 'terugvordering voorschot mei, afgesproken', 'A. Bakker');
  assert.ok(v.ok, JSON.stringify(v));
  assert.ok(c.magDefinitief('run_test').ok, 'verklaard staat niet meer in de weg');
  assert.equal(c.van('run_test')[0].verklaring.length > 0, true, 'en de verklaring blijft staan');
});

test('een bankrekening die net is gewijzigd gaat altijd langs een mens', () => {
  const c = opzetC();
  const r = c.loop(nepRun(), { bankGewijzigd: { 1: '2026-06-29T10:00:00.000Z' } });
  const b = r.bevindingen.find(x => x.soort === 'bankrekening_net_gewijzigd');
  assert.ok(b && b.ernst === 'hoog', JSON.stringify(r.bevindingen));
  assert.match(b.uitleg, /niet per e-mail/, 'met de juiste raad erbij');
});

test('de bevindingen uit de urenimport komen in dezelfde lijst', () => {
  const c = opzetC();
  const r = c.loop(nepRun(), { urenBevindingen: [
    { soort: 'ontbrekende_uitklok', ernst: 'hoog', eigenaar: 'manager', staffId: 1, uitleg: 'geen uitklok' }] });
  assert.ok(r.bevindingen.some(b => b.soort === 'ontbrekende_uitklok'),
    'twee lijstjes op twee schermen betekent dat er een wordt vergeten');
  assert.ok(r.hoogOpen >= 1);
});

test('zonder contractgegevens meldt de controlelaag niet iedereen als contractloos', () => {
  const c = opzetC();
  const zonder = c.loop(nepRun(), {});
  assert.ok(!zonder.bevindingen.some(b => b.soort === 'geen_geldig_contract'),
    'een controle die afgaat omdat de aanroeper niets meegaf, is een vals alarm: ' + JSON.stringify(zonder.bevindingen));

  // MET contractgegevens, en dan ontbreekt er echt een: dan wel
  const c2 = opzetC();
  const met = c2.loop(nepRun(), { contracten: {} });
  assert.ok(met.bevindingen.some(b => b.soort === 'geen_geldig_contract'),
    'maar wie contracten meegeeft en er een mist, hoort het wel te horen');
});
