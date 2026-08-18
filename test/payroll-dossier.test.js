/* Payroll OS: HET DOSSIER -- de vier vragen, voor elk bedrag.

   DIT IS DE AFGESPROKEN MAATSTAF, en deze toets maakt hem toetsbaar. De premium
   enterprise-versie is pas klaar wanneer iedere euro antwoord kan geven op:

     1. Waarom is dit bedrag berekend?
     2. Welke regel en versie zijn gebruikt?
     3. Wie heeft de invoer en uitkomst goedgekeurd?
     4. Waar is het bedrag daarna geboekt, aangegeven en betaald?

   Elk antwoord stond er al, verspreid over vier schermen. Verspreid is niet
   hetzelfde als beschikbaar: wie bij een controle zelf moet optellen, verzint
   op een gegeven moment een antwoord.

   WAAR DEZE TOETS OVER GAAT is daarom niet "staat er iets" maar of het dossier
   EERLIJK is over wat er niet staat. Een dossier dat plausibele antwoorden
   invult is gevaarlijker dan een dossier met een gat -- een gat kun je zien.
   Dus: nog niet aangegeven hoort `open` te zijn en niet stilzwijgend
   weggelaten, en `volledig` hoort pas waar te worden als het echt waar is.

   Draai los: node --test test/payroll-dossier.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakContracten } = require('../server/kern/payroll/contracten');
const { maakRun } = require('../server/kern/payroll/run');
const { maakJournaal } = require('../server/kern/payroll/journaal');
const { maakAangifte } = require('../server/kern/payroll/aangifte');
const { maakDossier } = require('../server/kern/payroll/dossier');
const motor = require('../server/kern/payroll/motor');

const pakket = (versie) => ({ land: 'NL', versie, geldigVan: '2026-01-01', geldigTot: '2026-12-31',
  valuta: 'EUR',
  regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
    premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 } });

function opzet(merkAan) {
  const db = { data: {} };
  const save = () => {};
  let t = 0;
  const nu = () => '2026-04-01T10:0' + (t++ % 10) + ':00.000Z';
  const regelpakket = maakRegelpakket({ db, save, nu });
  const componenten = maakComponenten({ db, save, nu });
  const contracten = maakContracten({ db, save, nu });
  regelpakket.neemOp(pakket('nl-2026.1'), { soort: 'bron', naam: 'Proefbron' });
  if (merkAan !== false) regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ db, save, nu, crypto, motor, regelpakket, componenten });
  const journaal = maakJournaal({ db, save, nu, crypto });
  const aangifte = maakAangifte({ db, save, nu, crypto, run });
  const dossier = maakDossier({ run, journaal, aangifte, regelpakket, contracten });
  return { db, save, nu, regelpakket, contracten, run, journaal, aangifte, dossier };
}

function draaiRun(k, opties) {
  const o = opties || {};
  const contract = { uurloonCenten: 1800, soort: 'vast', urenPerWeek: 32,
    door: o.contractDoor === undefined ? 'M. de Wit' : o.contractDoor,
    vastgelegdOp: '2026-01-02T09:00:00.000Z', terugwerkend: false };
  const r = k.run.open({ code: 'MERIDIAAN', zaak: 'Meridiaan Toren', periode: '2026-03', land: 'NL',
    regels: [{ staffId: 7, naam: 'Timo Vos', contract,
      invoer: [{ component: 'gewerkte_uren', aantal: 160 }], leeftijdsgroep: '21+', gewerkteUren: 160 }],
    door: 'A. Bakker' });
  if (o.stop === 'concept') return r.run.id;
  k.run.keurGoed(r.run.id, 'manager', 'M. de Wit', 900);
  if (o.stop === 'manager') return r.run.id;
  k.run.keurGoed(r.run.id, 'administrateur', 'A. Bakker', 901);
  k.run.maakDefinitief(r.run.id, 'A. Bakker');
  return r.run.id;
}

test('vraag 1: waarom is dit bedrag berekend -- de invoer EN de stappen', () => {
  const k = opzet();
  const d = k.dossier.vanMedewerker(draaiRun(k), 7);
  const w = d.antwoorden.waarom;
  assert.equal(w.stand, 'beantwoord');
  assert.deepEqual(w.invoer, [{ component: 'gewerkte_uren', aantal: 160 }],
    'de invoer staat erbij: zonder haar zie je wel dat er 160 uur is gerekend, maar niet waar die vandaan kwam');
  assert.ok(w.stappen.some(s => s.stap === 'bruto'), 'en elke tussenstap');
  assert.ok(w.stappen.some(s => s.stap === 'loonheffing'));
  assert.equal(w.totalen.nettoCenten, d.bedrag.nettoCenten);
  assert.equal(w.valuta.code, 'EUR', 'met de munt erbij');
});

test('vraag 2: welke regel en versie -- met de herkomst, niet alleen een nummer', () => {
  const k = opzet();
  const d = k.dossier.vanMedewerker(draaiRun(k), 7);
  const r = d.antwoorden.welkeRegel;
  assert.equal(r.stand, 'beantwoord');
  assert.equal(r.versie, 'nl-2026.1');
  assert.equal(r.bron.naam, 'Proefbron', 'waar het pakket vandaan kwam');
  assert.equal(r.goedgekeurdDoor, 'R. Sardjoe', 'en wie het heeft aangemerkt');
  assert.equal(r.let, null);
});

test('een run op een ongecontroleerd pakket zegt dat, in het dossier zelf', () => {
  const k = opzet(false); // niet aangemerkt
  const runId = draaiRun(k, { stop: 'manager' });
  const d = k.dossier.vanMedewerker(runId, 7);
  assert.equal(d.antwoorden.welkeRegel.standVanPakket, 'ongecontroleerd');
  assert.match(d.antwoorden.welkeRegel.let, /nooit door een mens aangemerkt/);
});

test('vraag 3: drie handtekeningen bij drie momenten, en een ontbrekende valt op', () => {
  const k = opzet();
  const d = k.dossier.vanMedewerker(draaiRun(k), 7);
  const w = d.antwoorden.wieKeurde;
  assert.equal(w.stand, 'beantwoord');
  assert.equal(w.goedkeuringen.length, 2);
  assert.equal(w.definitiefDoor, 'A. Bakker');
  assert.equal(w.contractVastgelegdDoor, 'M. de Wit', 'wie de INVOER vastlegde is een eigen handtekening');
  assert.deepEqual(w.ontbreekt, []);

  // en zonder de tweede handtekening
  const k2 = opzet();
  const d2 = k2.dossier.vanMedewerker(draaiRun(k2, { stop: 'manager' }), 7);
  assert.equal(d2.antwoorden.wieKeurde.stand, 'onbekend');
  assert.ok(d2.antwoorden.wieKeurde.ontbreekt.includes('de administrateur'),
    d2.antwoorden.wieKeurde.ontbreekt.join(', '));

  // en zonder te weten wie het contract vastlegde
  const k3 = opzet();
  const d3 = k3.dossier.vanMedewerker(draaiRun(k3, { contractDoor: null }), 7);
  assert.ok(d3.antwoorden.wieKeurde.ontbreekt.includes('wie het contract vastlegde'));
});

test('vraag 4: nog niet aangegeven is OPEN en niet stilzwijgend weggelaten', () => {
  const k = opzet();
  const d = k.dossier.vanMedewerker(draaiRun(k), 7);
  const w = d.antwoorden.waarheen;
  assert.equal(w.geboekt.stand, 'beantwoord');
  assert.equal(w.geboekt.sluitAan, true, 'de boeking telt op tot nul');
  assert.equal(w.aangegeven.stand, 'open');
  assert.match(w.aangegeven.uitleg, /nog geen aangifte/);
  assert.equal(w.betaald.stand, 'open');
  assert.match(w.betaald.uitleg, /nog geen betaalbestand/);
  assert.equal(w.stand, 'open');

  /* EN DUS IS HET DOSSIER NIET VOLLEDIG. Dat is de hele maatstaf: `volledig`
     wordt pas waar als het echt waar is. */
  assert.equal(d.volledig, false);
  assert.equal(d.open, 1);
});

test('het dossier wordt volledig zodra alle vier de vragen antwoord hebben', () => {
  const k = opzet();
  const runId = draaiRun(k);
  const vol = k.run.haal(runId);

  const a = k.aangifte.maak(vol, 'A. Bakker').aangifte;
  k.aangifte.dienIn(a.id, 'A. Bakker', 'BD-2026-03-0001');
  const bet = k.journaal.betaalbestand(vol, { 7: 'NL91ABNA0417164300' });
  assert.ok(bet.ok, JSON.stringify(bet).slice(0, 160));

  const d = k.dossier.vanMedewerker(runId, 7);
  assert.equal(d.antwoorden.waarheen.aangegeven.stand, 'beantwoord');
  assert.equal(d.antwoorden.waarheen.aangegeven.kenmerk, 'BD-2026-03-0001');
  assert.equal(d.antwoorden.waarheen.betaald.stand, 'beantwoord');
  assert.equal(d.antwoorden.waarheen.betaald.bestanden[0].totaalCenten, bet.bestand.totaalCenten);
  assert.equal(d.volledig, true, 'alle vier de vragen beantwoord');
  assert.equal(d.open, 0);
});

test('het openen van een dossier maakt GEEN betaalbestand', () => {
  /* Een dossier dat zijn eigen antwoord fabriceert, zet geld in beweging zodra
     iemand het opent. Daarom leest het alleen. */
  const k = opzet();
  const runId = draaiRun(k);
  k.dossier.vanMedewerker(runId, 7);
  k.dossier.vanRun(runId);
  assert.equal((k.db.data.payrollBetaalbestanden || []).length, 0,
    'er is niets gemaakt door alleen te kijken');
});

test('het dossier van de hele run telt wie er nog een gat heeft', () => {
  const k = opzet();
  const runId = draaiRun(k);
  const d = k.dossier.vanRun(runId);
  assert.equal(d.run.aantal, 1);
  assert.equal(d.medewerkers.length, 1);
  assert.equal(d.volledig, false);
  assert.equal(d.onvolledig, 1, 'een medewerker met een open vraag');
  assert.equal(d.run.valuta.code, 'EUR');
});

test('een dossier van een run of medewerker die niet bestaat, verzint niets', () => {
  const k = opzet();
  const runId = draaiRun(k);
  assert.equal(k.dossier.vanMedewerker('run_bestaatniet', 7).status, 404);
  assert.equal(k.dossier.vanMedewerker(runId, 999).status, 404);
  assert.equal(k.dossier.vanRun('run_bestaatniet').status, 404);
});
