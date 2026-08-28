/* Payroll OS: de loonrun (vier ogen, definitief, correctie) en de contracten.

   WAT HIER OP HET SPEL STAAT. Een loonstrook die is uitgegeven, een bedrag dat
   is betaald en een aangifte die is verzonden staan tegenover elkaar. Wie een
   definitieve run alsnog bijwerkt, laat die drie uit elkaar lopen zonder spoor.
   En vier ogen dat neerkomt op twee knoppen voor dezelfde persoon is geen
   controle maar een formulier.

   De toetsen gaan daarom vooral over wat NIET mag:
   - dezelfde persoon kan niet twee keer goedkeuren;
   - wie zelf in de run staat, keurt hem niet goed;
   - definitief kan niet zonder beide handtekeningen;
   - definitief kan niet op een ongecontroleerd regelpakket;
   - na definitief verandert er niets meer -- corrigeren maakt een NIEUWE run;
   - een correctie rekent op de regels van TOEN, niet die van vandaag;
   - een contractwijziging overschrijft niet, en terugwerkend is zichtbaar.

   Draai los: node --test test/payroll-run.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegelpakket } = require('../server/kern/payroll/regelpakket');
const { maakComponenten } = require('../server/kern/payroll/componenten');
const { maakContracten } = require('../server/kern/payroll/contracten');
const { maakRun } = require('../server/kern/payroll/run');
const motor = require('../server/kern/payroll/motor');
const maakOpslag = require('../server/kern/payroll/opslag');

function pakket(versie, over) {
  return Object.assign({
    land: 'NL', versie, geldigVan: '2026-01-01', geldigTot: '2026-12-31',
    regels: { minimumUurloon: { '21+': 1499 }, loonheffing: { tarief: 0.37 },
      premies: { tarief: 0.20 }, zvw: 0.0657, vakantiegeld: 0.08 }
  }, over || {});
}

function opzet(merkAan) {
  const db = { data: {} };
  const save = () => {};
  const nu = () => new Date().toISOString();
  const regelpakket = maakRegelpakket({ opslag: maakOpslag({ db }), save, nu });
  const componenten = maakComponenten({ opslag: maakOpslag({ db }), save, nu });
  const contracten = maakContracten({ opslag: maakOpslag({ db }), save, nu });
  regelpakket.neemOp(pakket('nl-2026.1'), { soort: 'test' });
  if (merkAan !== false) regelpakket.merkAan('NL', 'nl-2026.1', 'R. Sardjoe');
  const run = maakRun({ opslag: maakOpslag({ db }), save, nu, crypto, motor, regelpakket, componenten });
  return { db, regelpakket, componenten, contracten, run };
}

const persoon = (staffId, naam, uren) => ({ staffId, naam,
  contract: { uurloonCenten: 1800, soort: 'vast', urenPerWeek: 32 },
  invoer: [{ component: 'gewerkte_uren', aantal: uren }],
  leeftijdsgroep: '21+', gewerkteUren: uren });

function tweeGoedkeuringen(run, runId) {
  run.keurGoed(runId, 'manager', 'M. de Wit', 900);
  return run.keurGoed(runId, 'administrateur', 'A. Bakker', 901);
}

test('vier ogen: dezelfde persoon kan niet twee keer tekenen', () => {
  const { run } = opzet();
  const o = run.open({ code: 'ESVEDRA', zaak: 'Es Vedra', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  assert.ok(o.ok, JSON.stringify(o).slice(0, 200));

  assert.ok(run.keurGoed(o.run.id, 'manager', 'M. de Wit', 900).ok);
  const nog = run.keurGoed(o.run.id, 'administrateur', 'M. de Wit', 900);
  assert.equal(nog.status, 403, 'de tweede handtekening moet van iemand anders komen');
});

test('wie zelf in de loonrun staat, keurt hem niet goed', () => {
  const { run } = opzet();
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(42, 'Sam', 100)], door: 'M. de Wit' });
  const r = run.keurGoed(o.run.id, 'manager', 'Sam', 42);
  assert.equal(r.status, 403, 'niemand keurt zijn eigen salaris goed');
});

test('definitief kan niet zonder beide handtekeningen', () => {
  const { run } = opzet();
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  assert.equal(run.maakDefinitief(o.run.id, 'M. de Wit').status, 409, 'zonder goedkeuring niet');
  run.keurGoed(o.run.id, 'manager', 'M. de Wit', 900);
  assert.equal(run.maakDefinitief(o.run.id, 'M. de Wit').status, 409, 'met een handtekening ook niet');
  run.keurGoed(o.run.id, 'administrateur', 'A. Bakker', 901);
  assert.ok(run.maakDefinitief(o.run.id, 'A. Bakker').ok, 'met beide wel');
});

test('definitief kan niet op een regelpakket dat niemand heeft aangemerkt', () => {
  const { run } = opzet(false); // niet aangemerkt
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  assert.ok(o.waarschuwingen.some(w => w.soort === 'ongecontroleerd_regelpakket'), 'de proefrun waarschuwt');
  tweeGoedkeuringen(run, o.run.id);
  const d = run.maakDefinitief(o.run.id, 'A. Bakker');
  assert.equal(d.status, 409, 'geld overmaken op ongekeurde tarieven: nee');
});

test('na definitief verandert er niets meer; corrigeren maakt een nieuwe run', () => {
  const { run } = opzet();
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  tweeGoedkeuringen(run, o.run.id);
  run.maakDefinitief(o.run.id, 'A. Bakker');
  const nettoWas = run.haal(o.run.id).stroken[0].strook.nettoCenten;

  assert.equal(run.keurGoed(o.run.id, 'manager', 'X', 902).status, 409, 'de oude run is dicht');

  const c = run.corrigeer({ runId: o.run.id, door: 'A. Bakker', reden: 'vergeten overuren',
    regels: [Object.assign(persoon(1, 'Sam', 100), {
      invoer: [{ component: 'gewerkte_uren', aantal: 100 }, { component: 'overuren_125', aantal: 8, tariefCenten: 2250 }] })] });
  assert.ok(c.ok, JSON.stringify(c).slice(0, 200));
  assert.equal(c.run.correctieVan, o.run.id, 'de correctie wijst naar de oude run');
  assert.ok(c.run.totaalVerschilCenten > 0, 'en draagt het verschil: ' + c.run.totaalVerschilCenten);

  assert.equal(run.haal(o.run.id).stroken[0].strook.nettoCenten, nettoWas, 'de oude run staat er nog precies zo');
  assert.equal(run.haal(o.run.id).stand, 'definitief');
});

test('een correctie rekent op de regels van toen, niet die van vandaag', () => {
  const { run, regelpakket } = opzet();
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  tweeGoedkeuringen(run, o.run.id);
  run.maakDefinitief(o.run.id, 'A. Bakker');

  // daarna gaat het tarief flink omhoog
  regelpakket.neemOp(pakket('nl-2026.9', { geldigVan: '2026-01-01',
    regels: Object.assign({}, pakket('x').regels, { loonheffing: { tarief: 0.60 } }) }), { soort: 'test' });
  regelpakket.merkAan('NL', 'nl-2026.9', 'R. Sardjoe');

  const c = run.corrigeer({ runId: o.run.id, door: 'A. Bakker', reden: 'controle',
    regels: [persoon(1, 'Sam', 100)] });
  assert.equal(c.run.regelversie, 'nl-2026.1', 'de correctie draait op de oorspronkelijke jaargang');
  assert.equal(c.run.totaalVerschilCenten, 0, 'dezelfde invoer, dus geen verschil');
});

test('twee loonruns over dezelfde periode kunnen niet', () => {
  const { run } = opzet();
  run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL', regels: [persoon(1, 'Sam', 100)], door: 'M' });
  const nog = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL', regels: [persoon(1, 'Sam', 100)], door: 'M' });
  assert.equal(nog.status, 409, 'anders staan er twee waarheden over een maand');
});

test('een contractwijziging overschrijft niet, en terugwerkend is zichtbaar', () => {
  const { contracten } = opzet();
  const a = contracten.leg('ESVEDRA', 1, { vanaf: '2026-01-01', soort: 'vast',
    uurloonCenten: 1600, urenPerWeek: 32 }, 'M. de Wit');
  assert.ok(a.ok, JSON.stringify(a).slice(0, 200));
  const b = contracten.leg('ESVEDRA', 1, { vanaf: '2026-07-01', soort: 'vast',
    uurloonCenten: 1800, urenPerWeek: 32 }, 'M. de Wit');
  assert.ok(b.ok);
  assert.equal(b.terugwerkend, true, 'vastgelegd na de ingangsdatum');
  assert.ok(b.let, 'en dat wordt gezegd, niet stilzwijgend gedaan');

  assert.equal(contracten.opDatum('ESVEDRA', 1, '2026-06-15').uurloonCenten, 1600, 'juni houdt het oude loon');
  assert.equal(contracten.opDatum('ESVEDRA', 1, '2026-08-15').uurloonCenten, 1800, 'augustus het nieuwe');
  assert.equal(contracten.geschiedenis('ESVEDRA', 1).length, 2, 'en er is niets overschreven');
});

test('een tijdelijk contract zonder einddatum wordt geweigerd', () => {
  const { contracten } = opzet();
  const r = contracten.leg('ESVEDRA', 2, { vanaf: '2026-01-01', soort: 'tijdelijk', uurloonCenten: 1600 }, 'M');
  assert.equal(r.status, 422);
  assert.ok(r.bezwaren.some(b => /einddatum/.test(b)), JSON.stringify(r.bezwaren));
});

test('een loonstrook bestaat pas als de run definitief is', () => {
  const { run } = opzet();
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(7, 'Sam', 100)], door: 'M. de Wit' });
  assert.deepEqual(run.strokenVan('ESVEDRA', 7), [], 'een concept is geen loonstrook');
  tweeGoedkeuringen(run, o.run.id);
  run.maakDefinitief(o.run.id, 'A. Bakker');
  const s = run.strokenVan('ESVEDRA', 7);
  assert.equal(s.length, 1);
  assert.equal(s[0].regelversie, 'nl-2026.1', 'met de regelversie waarop hij berust');
});

/* EEN PAKKET DAT ZEGT DAT HET NIET DEUGT, GAAT NIET ZOMAAR AAN.

   De meegeleverde jaargang (kern/payroll/jaargangen/nl-2026.json) meldt in zijn
   eigen `_let_op` dat de cijfers NIET tegen het Handboek Loonheffingen zijn
   gelegd en niet geschikt zijn voor een definitieve loonrun. Dat stond alleen
   in het bestand: aanmerken kon gewoon, en daarna draaide er een definitieve
   run op -- met loonstroken en een aangifte eraan vast. Een belofte in tekst
   die niets tegenhield (LAT.md regel 6).

   Aanmerken kan nog steeds, want er moet mee te werken zijn en de mens beslist.
   Maar dan met zoveel woorden, met een reden die blijft staan, en met een
   stempel dat meereist tot in de run. */
const demoPakket = (versie) => Object.assign(pakket(versie), {
  _let_op: 'ONGECONTROLEERD. Deze cijfers zijn NIET tegen het Handboek Loonheffingen gelegd.' });

test('een zelfverklaard ongecontroleerd pakket gaat niet zomaar aan', () => {
  const { regelpakket } = opzet(false);
  regelpakket.neemOp(demoPakket('nl-demo.1'), { soort: 'meegeleverd' });

  const zomaar = regelpakket.merkAan('NL', 'nl-demo.1', 'R. Sardjoe');
  assert.equal(zomaar.status, 409, 'zonder het uit te spreken: nee');
  assert.match(zomaar.waarschuwing, /Handboek/, 'en de reden komt uit het pakket zelf');

  const zonderReden = regelpakket.merkAan('NL', 'nl-demo.1', 'R. Sardjoe', { ondanks: true });
  assert.equal(zonderReden.status, 400, 'uitdrukkelijk maar zonder reden: ook nee');

  const wel = regelpakket.merkAan('NL', 'nl-demo.1', 'R. Sardjoe', { ondanks: true, reden: 'tegen de bron gelegd op 9 aug' });
  assert.equal(wel.ok, true);
  assert.equal(wel.opDemoTabellen, true, 'en het pakket draagt waarop het berust');
  const uit = regelpakket.alle('NL').find(p => p.versie === 'nl-demo.1');
  assert.equal(uit.ondanksWaarschuwing, 'tegen de bron gelegd op 9 aug', 'de reden blijft staan');
});

test('een gewoon pakket merk je gewoon aan, zonder plichtplegingen', () => {
  const { regelpakket } = opzet(false);
  regelpakket.neemOp(pakket('nl-echt.1'), { soort: 'handmatig' });
  const r = regelpakket.merkAan('NL', 'nl-echt.1', 'R. Sardjoe');
  assert.equal(r.ok, true, 'geen zelfverklaring, geen extra stap: ' + JSON.stringify(r));
  assert.equal(r.opDemoTabellen, false);
});

test('de run stempelt waarop hij berust, en dat overleeft definitief worden', () => {
  const { regelpakket, componenten, run } = opzet(false);
  regelpakket.neemOp(demoPakket('nl-demo.2'), { soort: 'meegeleverd' });
  regelpakket.merkAan('NL', 'nl-demo.2', 'R. Sardjoe', { ondanks: true, reden: 'demo' });
  void componenten;
  const o = run.open({ code: 'ESVEDRA', periode: '2026-06', land: 'NL',
    regels: [persoon(1, 'Sam', 100)], door: 'M. de Wit' });
  assert.ok(o.ok, JSON.stringify(o).slice(0, 200));
  assert.equal(run.haal(o.run.id).opDemoTabellen, true, 'de run weet het');
  tweeGoedkeuringen(run, o.run.id);
  run.maakDefinitief(o.run.id, 'A. Bakker');
  assert.equal(run.haal(o.run.id).opDemoTabellen, true, 'en na definitief staat het er nog');
});
