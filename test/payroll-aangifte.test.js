/* Payroll OS: de loonaangifte -- de derde uitgang uit dezelfde definitieve run.

   WAT HIER OP HET SPEL STAAT. Uit een loonrun komen drie dingen: een boeking
   naar het grootboek, een betaalbestand naar de bank en een aangifte naar de
   Belastingdienst. Zeggen die drie niet hetzelfde, dan betaalt een werkgever
   iets anders dan hij aangeeft. Dat komt niet uit bij de eerstvolgende
   loonstrook maar bij een controle, jaren later, met boete en rente.

   De toetsen gaan daarom over wat NIET mag:
   - een aangifte uit een concept-run;
   - een nominatief deel dat niet optelt tot het collectieve deel;
   - een aangifte die iets anders zegt dan het loonjournaal;
   - een tweede aangifte over dezelfde run (dubbel aangeven);
   - "ingediend" zonder kenmerk -- een bewering zonder bewijs;
   - een ingediende aangifte die alsnog verandert;
   - een correctie die niet naar zijn oorspronkelijke aangifte verwijst.

   Draai los: node --experimental-sqlite --test test/payroll-aangifte.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakRun } = require('../server/kern/payroll/run');
const { maakJournaal, TEGENREKENINGEN } = require('../server/kern/payroll/journaal');
const { maakAangifte } = require('../server/kern/payroll/aangifte');
const motor = require('../server/kern/payroll/motor');
const maakOpslag = require('../server/kern/payroll/opslag');

const pakket = (versie) => ({ land: 'NL', versie, geldigVan: '2026-01-01', geldigTot: '2026-12-31',
  regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
    premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 } });

const persoon = (staffId, naam, uren) => ({ staffId, naam,
  contract: { uurloonCenten: 1800, soort: 'vast', urenPerWeek: 32 },
  invoer: [{ component: 'gewerkte_uren', aantal: uren }],
  leeftijdsgroep: '21+', gewerkteUren: uren });

function opzet() {
  const db = { data: {} };
  const save = () => {};
  let teller = 0;
  const nu = () => '2026-04-01T10:0' + (teller++ % 10) + ':00.000Z';
  const regelpakket = maakRegelpakket({ opslag: maakOpslag({ db }), save, nu });
  const componenten = maakComponenten({ opslag: maakOpslag({ db }), save, nu });
  regelpakket.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ opslag: maakOpslag({ db }), save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ opslag: maakOpslag({ db }), save, nu, crypto });
  const aangifte = maakAangifte({ opslag: maakOpslag({ db }), save, nu, crypto, run });
  return { db, run, journaal, aangifte };
}

function definitieveRun(k, regels) {
  const r = k.run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: '2026-03',
    land: 'NL', regels: regels || [persoon(1, 'Timo Vos', 160), persoon(2, 'Ilse Berg', 80)],
    door: 'A. Bakker' });
  k.run.keurGoed(r.run.id, 'manager', 'M. de Wit', 900);
  k.run.keurGoed(r.run.id, 'administrateur', 'A. Bakker', 901);
  k.run.maakDefinitief(r.run.id, 'A. Bakker');
  return k.run.haal(r.run.id);
}

test('uit een concept-run komt geen aangifte', () => {
  const k = opzet();
  const r = k.run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: '2026-03',
    land: 'NL', regels: [persoon(1, 'Timo Vos', 160)], door: 'A. Bakker' });
  const a = k.aangifte.maak(k.run.haal(r.run.id), 'A. Bakker');
  assert.equal(a.status, 409);
  assert.match(a.error, /definitieve/);
});

test('het nominatieve deel telt op tot het collectieve deel', () => {
  const k = opzet();
  const run = definitieveRun(k);
  const a = k.aangifte.maak(run, 'A. Bakker').aangifte;
  assert.equal(a.nominatief.length, 2, 'een regel per werknemer');
  for (const rubriek of ['loonLoonheffing', 'ingehoudenLoonheffing', 'premiesWerkgever', 'zvwWerkgever']) {
    const som = a.nominatief.reduce((s, x) => s + x[rubriek], 0);
    assert.equal(a.totalen[rubriek], som, rubriek + ': het totaal is de optelling, niet een tweede berekening');
  }
  const opStroken = run.stroken.reduce((s, x) => s + x.strook.loonheffingCenten, 0);
  assert.equal(a.totalen.ingehoudenLoonheffing, opStroken, 'en het klopt met de loonstroken zelf');
});

test('te betalen is de loonheffing plus de werkgeverslasten', () => {
  const k = opzet();
  const a = k.aangifte.maak(definitieveRun(k), 'A. Bakker').aangifte;
  assert.equal(a.teBetalenCenten,
    a.totalen.ingehoudenLoonheffing + a.totalen.premiesWerkgever + a.totalen.zvwWerkgever);
  assert.ok(a.teBetalenCenten > a.totalen.ingehoudenLoonheffing,
    'de werkgeverslasten zitten erbij; wie alleen de ingehouden heffing overmaakt, betaalt te weinig');
});

test('de aangifte en het loonjournaal zeggen hetzelfde over de loonheffing', () => {
  const k = opzet();
  const run = definitieveRun(k);
  const a = k.aangifte.maak(run, 'A. Bakker').aangifte;
  const b = k.journaal.boeking(run);
  assert.ok(!b.error, b.error || '');
  const s = k.aangifte.sluitAanOpJournaal(a, b, TEGENREKENINGEN.loonheffing);
  assert.ok(s.ok, s.error || '');
  assert.equal(s.loonheffingCenten, a.totalen.ingehoudenLoonheffing);

  /* En hij MERKT het als ze uiteenlopen. Zonder deze helft is de controle een
     versiering: hij zegt altijd ja. */
  const scheef = { regels: b.regels.map(r => r.rekening === TEGENREKENINGEN.loonheffing
    ? Object.assign({}, r, { creditCenten: r.creditCenten + 1 }) : r) };
  const mis = k.aangifte.sluitAanOpJournaal(a, scheef, TEGENREKENINGEN.loonheffing);
  assert.equal(mis.status, 422);
  assert.match(mis.error, /spreken elkaar tegen/);
});

test('dezelfde run twee keer aangeven levert geen tweede aangifte op', () => {
  const k = opzet();
  const run = definitieveRun(k);
  const een = k.aangifte.maak(run, 'A. Bakker').aangifte;
  const twee = k.aangifte.maak(run, 'A. Bakker');
  assert.ok(twee.ongewijzigd, 'de tweede keer levert dezelfde aangifte, geen nieuwe');
  assert.equal(twee.aangifte.id, een.id);
  assert.equal(k.aangifte.vanZaak('MERIDIAAN').length, 1, 'en er staat er maar een in de administratie');
});

test('indienen zonder kenmerk mag niet', () => {
  const k = opzet();
  const a = k.aangifte.maak(definitieveRun(k), 'A. Bakker').aangifte;
  assert.equal(k.aangifte.dienIn(a.id, 'A. Bakker', '').status, 400);
  assert.equal(k.aangifte.dienIn(a.id, 'A. Bakker', 'x').status, 400, 'een kenmerk van een teken is geen kenmerk');
  assert.equal(k.aangifte.dienIn(a.id, '', 'BD-2026-03-0001').status, 400, 'en er hoort een naam bij');
  const ok = k.aangifte.dienIn(a.id, 'A. Bakker', 'BD-2026-03-0001');
  assert.ok(ok.ok);
  assert.equal(ok.aangifte.stand, 'ingediend');
  assert.equal(ok.aangifte.kenmerk, 'BD-2026-03-0001');
  assert.match(ok.let, /buiten RTG om/, 'en het zegt eerlijk dat het verzenden hier niet gebeurt');
});

test('een ingediende aangifte wordt niet nog een keer ingediend', () => {
  const k = opzet();
  const a = k.aangifte.maak(definitieveRun(k), 'A. Bakker').aangifte;
  k.aangifte.dienIn(a.id, 'A. Bakker', 'BD-2026-03-0001');
  const nog = k.aangifte.dienIn(a.id, 'A. Bakker', 'BD-2026-03-0002');
  assert.equal(nog.status, 409);
  assert.equal(k.aangifte.haal(a.id).kenmerk, 'BD-2026-03-0001', 'het eerste kenmerk staat er nog');
});

test('een correctierun levert een correctieaangifte die naar de eerste verwijst', () => {
  const k = opzet();
  const run = definitieveRun(k);
  const eerste = k.aangifte.maak(run, 'A. Bakker').aangifte;
  k.aangifte.dienIn(eerste.id, 'A. Bakker', 'BD-2026-03-0001');

  const cor = k.run.corrigeer({ runId: run.id,
    regels: [persoon(1, 'Timo Vos', 168)], door: 'A. Bakker',
    reden: 'acht uur waren niet geklokt maar wel gewerkt' });
  assert.ok(cor.ok, cor.error || '');
  const corRun = k.run.haal(cor.run.id);
  k.run.keurGoed(corRun.id, 'manager', 'M. de Wit', 900);
  k.run.keurGoed(corRun.id, 'administrateur', 'A. Bakker', 901);
  k.run.maakDefinitief(corRun.id, 'A. Bakker');

  const tweede = k.aangifte.maak(k.run.haal(corRun.id), 'A. Bakker').aangifte;
  assert.equal(tweede.soort, 'correctie');
  assert.equal(tweede.corrigeert, eerste.id,
    'de correctie verwijst naar de aangifte die hij rechtzet -- anders telt de Belastingdienst hem erbovenop');
  assert.equal(tweede.corrigeertRun, run.id);
});

test('een correctie zonder eerste aangifte zegt dat er iets ontbreekt', () => {
  const k = opzet();
  const run = definitieveRun(k);
  // geen aangifte op de eerste run: meteen corrigeren
  const cor = k.run.corrigeer({ runId: run.id, regels: [persoon(1, 'Timo Vos', 168)],
    door: 'A. Bakker', reden: 'acht uur waren niet geklokt maar wel gewerkt' });
  const corRun = k.run.haal(cor.run.id);
  k.run.keurGoed(corRun.id, 'manager', 'M. de Wit', 900);
  k.run.keurGoed(corRun.id, 'administrateur', 'A. Bakker', 901);
  k.run.maakDefinitief(corRun.id, 'A. Bakker');
  const a = k.aangifte.maak(k.run.haal(corRun.id), 'A. Bakker').aangifte;
  assert.equal(a.corrigeert, null);
  assert.match(a.let, /geen aangifte is opgemaakt/, 'en dat staat er, in plaats van stil door te gaan');
});

test('de aangiftes van een zaak zijn terug te lezen, per periode', () => {
  const k = opzet();
  const a = k.aangifte.maak(definitieveRun(k), 'A. Bakker').aangifte;
  k.aangifte.dienIn(a.id, 'A. Bakker', 'BD-2026-03-0001');
  const lijst = k.aangifte.vanZaak('MERIDIAAN', '2026-03');
  assert.equal(lijst.length, 1);
  assert.equal(lijst[0].stand, 'ingediend');
  assert.equal(lijst[0].kenmerk, 'BD-2026-03-0001');
  assert.equal(k.aangifte.vanZaak('MERIDIAAN', '2026-04').length, 0, 'een andere periode levert niets');
  assert.equal(k.aangifte.vanZaak('KIKUNOI').length, 0, 'en een andere zaak ook niet');
});
