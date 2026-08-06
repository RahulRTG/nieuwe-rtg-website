/* Payroll OS: het loonjournaal, het betaalbestand, en verzuim.

   DE VIERDE VRAAG: waar is het bedrag geboekt en betaald. Twee uitgangen uit
   dezelfde definitieve run, en ze moeten op elkaar kloppen -- lopen ze uiteen,
   dan klopt de boekhouding niet met de bankafschriften en merkt niemand dat
   tot de accountant komt.

   Wat hier wordt bewaakt:
   - de boeking telt op tot nul (anders gaat er een bedrag nergens heen);
   - een component zonder grootboekrekening stuit, en lekt niet weg;
   - betaalbestand en journaal spreken elkaar niet tegen;
   - geen van beide komt uit een concept;
   - en bij ziekte: er is geen veld voor wat iemand heeft, en een
     leidinggevende ziet "afwezig", niet "ziek".

   Draai los: node --experimental-sqlite --test test/payroll-journaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakRun } = require('../server/kern/payroll/run');
const { maakJournaal } = require('../server/kern/payroll/journaal');
const { maakVerzuim } = require('../server/kern/payroll/verzuim');
const motor = require('../server/kern/payroll/motor');

function opzet() {
  const db = { data: {} };
  const save = () => {};
  const nu = () => '2026-08-06T12:00:00.000Z';
  const regelpakket = maakRegelpakket({ db, save, nu });
  const componenten = maakComponenten({ db, save, nu });
  regelpakket.neemOp({ land: 'NL', versie: 'nl-2026.1', geldigVan: '2026-01-01', geldigTot: '2026-12-31',
    regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
      premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 } }, { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ db, save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ db, save, nu, crypto });
  const verzuim = maakVerzuim({ db, save, nu });
  return { db, regelpakket, componenten, run, journaal, verzuim };
}

const persoon = (staffId, naam, uren, extra) => ({ staffId, naam,
  contract: { uurloonCenten: 1800, soort: 'vast', urenPerWeek: 32 },
  invoer: [{ component: 'gewerkte_uren', aantal: uren }].concat(extra || []),
  leeftijdsgroep: '21+', gewerkteUren: uren });

function definitieveRun(run, regels) {
  const o = run.open({ code: 'ESVEDRA', zaak: 'Es Vedra', periode: '2026-06', land: 'NL',
    regels: regels || [persoon(1, 'Sam', 100), persoon(2, 'Robin', 80)], door: 'M. de Wit' });
  assert.ok(o.ok, JSON.stringify(o).slice(0, 200));
  run.keurGoed(o.run.id, 'manager', 'M. de Wit', 900);
  run.keurGoed(o.run.id, 'administrateur', 'A. Bakker', 901);
  assert.ok(run.maakDefinitief(o.run.id, 'A. Bakker').ok);
  return run.haal(o.run.id);
}

const IBANS = { 1: 'NL91ABNA0417164300', 2: 'NL02RABO0123456789' };

test('de boeking telt op tot nul', () => {
  const { run, journaal } = opzet();
  const r = definitieveRun(run);
  const b = journaal.boeking(r);
  assert.ok(b.ok, JSON.stringify(b).slice(0, 250));
  assert.equal(b.somDebet, b.somCredit, 'debet en credit horen gelijk te zijn');
  assert.ok(b.somDebet > 0);
  assert.equal(b.regelversie, 'nl-2026.1', 'de boeking draagt de regelversie waarop hij berust');
});

test('een component zonder grootboekrekening stuit', () => {
  const { run, journaal, componenten } = opzet();
  componenten.zet({ sleutel: 'losse_toeslag', naam: 'Losse toeslag', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing'], invoerbron: 'handmatig', goedkeuring: 'manager' }, 'test'); // geen grootboek
  const r = definitieveRun(run, [persoon(1, 'Sam', 100, [{ component: 'losse_toeslag', centen: 5000 }])]);
  const b = journaal.boeking(r);
  assert.equal(b.status, 422, 'een bedrag dat nergens heen gaat hoort te stuiten');
  assert.ok(b.componenten.includes('losse_toeslag'), JSON.stringify(b.componenten));
});

test('het betaalbestand telt op tot exact het netto van de run', () => {
  const { run, journaal } = opzet();
  const r = definitieveRun(run);
  const bet = journaal.betaalbestand(r, IBANS);
  assert.ok(bet.ok, JSON.stringify(bet).slice(0, 250));
  const verwacht = r.stroken.reduce((s, x) => s + x.strook.nettoCenten, 0);
  assert.equal(bet.bestand.totaalCenten, verwacht);
  assert.equal(bet.bestand.aantal, 2);
});

test('journaal en betaalbestand spreken elkaar niet tegen', () => {
  const { run, journaal } = opzet();
  const r = definitieveRun(run);
  const a = journaal.sluitAan(r, IBANS);
  assert.ok(a.ok, JSON.stringify(a).slice(0, 250));
});

test('een ontbrekend of onzinnig rekeningnummer stuit het betaalbestand', () => {
  const { run, journaal } = opzet();
  const r = definitieveRun(run);
  const bet = journaal.betaalbestand(r, { 1: 'NL91ABNA0417164300', 2: 'geen iban' });
  assert.equal(bet.status, 422);
  assert.equal(bet.medewerkers[0].staffId, 2);
});

test('uit een concept komt geen boeking en geen betaalbestand', () => {
  const { run, journaal } = opzet();
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  const concept = run.haal(o.run.id);
  assert.equal(journaal.boeking(concept).status, 409);
  assert.equal(journaal.betaalbestand(concept, IBANS).status, 409);
});

test('een ziekmelding draagt geen omschrijving', () => {
  const { verzuim } = opzet();
  const nee = verzuim.meld('ESVEDRA', 1, { soort: 'ziek', van: '2026-06-03',
    toelichting: 'rugklachten na ongeval' }, 'M. de Wit');
  assert.equal(nee.status, 422, 'wat iemand heeft, hoort bij de arbodienst');
  assert.ok(nee.bezwaren.some(b => /arbodienst/.test(b)), JSON.stringify(nee.bezwaren));

  const ja = verzuim.meld('ESVEDRA', 1, { soort: 'ziek', van: '2026-06-03', tot: '2026-06-10',
    inzetbaarheid: 'aangepast' }, 'M. de Wit');
  assert.ok(ja.ok, JSON.stringify(ja).slice(0, 200));
});

test('een leidinggevende ziet afwezig, de payroll ziet de soort', () => {
  const { verzuim } = opzet();
  verzuim.meld('ESVEDRA', 1, { soort: 'ziek', van: '2026-06-03', tot: '2026-06-10',
    inzetbaarheid: 'deels' }, 'M. de Wit');
  verzuim.meld('ESVEDRA', 1, { soort: 'vakantie', van: '2026-06-20', tot: '2026-06-27' }, 'M. de Wit');

  const plan = verzuim.voorPlanning('ESVEDRA', 1, '2026-06-01', '2026-06-30');
  const ziekRegel = plan.find(p => p.van === '2026-06-03');
  assert.equal(ziekRegel.wat, 'afwezig', '"ziek" is zelf al een gezondheidsgegeven');
  assert.equal(ziekRegel.inzetbaarheid, 'deels', 'wat iemand nog kan, mag hij wel weten');
  assert.ok(!JSON.stringify(plan).toLowerCase().includes('ziek'), 'nergens: ' + JSON.stringify(plan));
  assert.equal(plan.find(p => p.van === '2026-06-20').wat, 'Vakantie', 'verlof mag wel bij naam');

  const pay = verzuim.voorPayroll('ESVEDRA', 1, '2026-06-01', '2026-06-30');
  const ziek = pay.find(p => p.soort === 'ziek');
  assert.ok(ziek, 'de payroll kent de soort wel; die moet het percentage weten');
  assert.equal(ziek.betaaldDeel, 0.7);
});
