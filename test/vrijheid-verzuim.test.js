'use strict';
/* VRIJHEID -> VERZUIMREGISTER -> STROOK (kern/vrijheid/verzuimbrug.js).

   De echte motor, het echte verzuimregister (kern/payroll/verzuim.js) en de
   echte samenstelling van een loonrun (kern/payroll/samenstellen.js), zonder
   nabootsing ertussen: een toegekende vrije dag moet op de strook staan als
   wat hij is, en een ingetrokken dag moet er weer af -- inclusief het saldo. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakVrijheid } = require('../server/kern/vrijheid');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');
const T = require('../server/kern/vrijheid/tijd');
const maakVerzuimbrug = require('../server/kern/vrijheid/verzuimbrug');
const { maakVerzuim } = require('../server/kern/payroll/verzuim');
const { maakSamenstellen } = require('../server/kern/payroll/samenstellen');

const ORG = 'RTGTEAM';
const w = (waarde) => ({ waarde, bron: 'proefbeleid' });
const beleid = maakBeleid({
  LEGAL_BASELINE: { 'rust.minUurTussenDiensten': w(11) },
  ORGANIZATION_POLICY: { 'vroegVertrek.autoTotMinuten': w(180), 'eerlijkheid.vensterDagen': w(28), 'eerlijkheid.maxExtraDekking': w(2),
    'eerlijkheid.maxOpenSchaars': w(3), 'herstel.maxUren14Dagen': w(80), 'herstel.maxDagenAchterElkaar': w(6),
    'capaciteit.minAantal': w(3), 'capaciteit.minAandeel': w(0.3),
    'verjaardag.weekend': w('vorige-werkdag'), 'verjaardag.feestdag': w('vorige-werkdag'), 'verjaardag.geenWerkdag': w('vorige-werkdag'),
    'verjaardag.nachtdienst': w('dienst-die-begint'), 'verjaardag.schrikkeldag': w('28-februari') },
  RTG_ADDITIONAL_BENEFIT: { 'rtgDag.perJaar': w(3) }
});

function team() {
  const mensen = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, inDienst: { van: '2024-01-01', tot: null } }));
  mensen.find(m => m.id === 'e').verjaardag = '10-01';
  const ds = []; for (let d = '2026-09-28'; d <= '2026-10-30'; d = T.plusDagen(d, 1)) if (![0, 6].includes(T.weekdag(d))) ds.push(d);
  return { organisatie: ORG, rosterVersie: 'r1', managers: ['m'], mensen,
    diensten: ds.flatMap(datum => mensen.map(m => ({ persoon: m.id, datum, van: '09:00', tot: '17:00' }))),
    eisen: ds.map(datum => ({ datum, van: '09:00', tot: '17:00', minBezetting: 3, vereist: {} })),
    kwalificaties: [], feestdagen: [], verantwoordelijkheden: [], schaars: [] };
}

function wereld() {
  const bak = {};
  const opslag = { bak: (n) => bak[n] || (bak[n] = {}) };
  const verzuim = maakVerzuim({ opslag, save: () => {}, nu: () => '2026-09-27T10:00:00.000Z' });
  const m = maakVrijheid({ opslag, nu: () => '2026-09-27T10:00:00.000Z', rooster: maakVerzuimbrug({ verzuim: () => verzuim }) });
  const samenstellen = maakSamenstellen({ contracten: {}, uren: {}, verzuim });
  return { m, verzuim, samenstellen };
}
const opts = (door) => ({ door, beleid, rechten: { wettelijk: 160 }, vandaag: '2026-09-27' });
const vast = { soort: 'vast', urenPerWeek: 40, maandloonCenten: 400000 };

test('een toegekende RTG Day staat in het verzuimregister en op de strook als RTG Day, volledig betaald', () => {
  const { m, verzuim, samenstellen } = wereld();
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  assert.equal(r.verzoek.stand, 'SCHEDULED', JSON.stringify(r.verzoek.stappen));
  assert.equal(r.verzoek.rooster, 'BIJGEWERKT');
  const vz = verzuim.voorPayroll(ORG, 'b', '2026-10-01', '2026-10-31');
  assert.deepEqual(vz.map(x => [x.soort, x.van, x.betaaldDeel]), [['rtgdag', '2026-10-08', 1]]);
  assert.equal(verzuim.voorPlanning(ORG, 'b', '2026-10-01', '2026-10-31')[0].wat, 'RTG Day', 'het afwezigheidsoverzicht voor de planning ziet hem ook');
  const strook = samenstellen.voorMens({ code: ORG, periode: '2026-10', staffId: 'b', naam: 'B', contract: vast });
  const regel = strook.invoer.find(x => x.component === 'loondoorbetaling');
  assert.equal(regel.soort, 'rtgdag');
  assert.equal(regel.betaaldDeel, 1);
  const totaal = strook.invoer.reduce((s, x) => s + x.centen, 0);
  assert.ok(Math.abs(totaal - vast.maandloonCenten) <= 1, 'een betaalde vrije dag kost geen loon: ' + totaal);
});

test('intrekken haalt de dag uit het register, van de strook en uit het saldo', () => {
  const { m, verzuim } = wereld();
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  assert.equal(m.mijnTijd(ORG, 'b', { beleid, jaar: 2026 }).rtgDagen.over, 2);
  const t = m.trekIn(ORG, r.verzoek.id, 'b');
  assert.equal(t.verzoek.stand, 'CANCELLED');
  assert.equal(t.verzoek.rooster, 'TERUGGEDRAAID');
  assert.deepEqual(verzuim.voorPayroll(ORG, 'b', '2026-10-01', '2026-10-31'), []);
  assert.equal(m.mijnTijd(ORG, 'b', { beleid, jaar: 2026 }).rtgDagen.over, 3, 'een ingetrokken RTG Day telt niet meer mee');
});

test('intrekken raakt nooit een afwezigheid die langs een andere weg is vastgelegd', () => {
  const { m, verzuim } = wereld();
  verzuim.meld(ORG, 'b', { soort: 'vakantie', van: '2026-10-08', tot: '2026-10-08' }, 'oude verlofroute');
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  m.trekIn(ORG, r.verzoek.id, 'b');
  assert.deepEqual(verzuim.voorPayroll(ORG, 'b', '2026-10-01', '2026-10-31').map(x => x.soort), ['vakantie']);
});

test('een deel van een dag komt niet in het register, en zegt dat', () => {
  const { m, verzuim } = wereld();
  const r = m.vraag(ORG, team(), { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'c', datum: '2026-10-08', vanaf: '16:00' }, opts('c'));
  assert.equal(r.verzoek.stand, 'SCHEDULED', 'toegekend, anders bewijst deze toets niets');
  assert.equal(r.verzoek.rooster, 'NIET_DOORGEZET');
  assert.match(r.verzoek.roosterReden, /werkdagen/);
  assert.deepEqual(verzuim.voorPayroll(ORG, 'c', '2026-10-01', '2026-10-31'), []);
});

test('onbetaald verlof gaat van het loon af, bijzonder verlof niet', () => {
  const { verzuim, samenstellen } = wereld();
  const brug = maakVerzuimbrug({ verzuim: () => verzuim });
  brug.pas(ORG, { persoon: 'd', bron: 'v1', categorie: 'UNPAID_LEAVE', datum: '2026-10-08', dag: true });
  brug.pas(ORG, { persoon: 'd', bron: 'v2', categorie: 'SPECIAL_LEAVE', datum: '2026-10-09', dag: true });
  const strook = samenstellen.voorMens({ code: ORG, periode: '2026-10', staffId: 'd', naam: 'D', contract: vast });
  const totaal = strook.invoer.reduce((s, x) => s + x.centen, 0);
  assert.ok(totaal < vast.maandloonCenten - 10000, 'een dag onbetaald kost ongeveer een dag loon: ' + totaal);
  assert.ok(strook.bevindingen.some(b => b.soort === 'onbetaald_verlof'));
});

test('een ontbrekend register is ONBEKEND en nooit gelukt', () => {
  const bak = {};
  const m = maakVrijheid({ opslag: { bak: (n) => bak[n] || (bak[n] = {}) }, nu: () => '2026-09-27T10:00:00.000Z',
    rooster: maakVerzuimbrug({ verzuim: () => null }) });
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  assert.equal(r.verzoek.rooster, 'ONBEKEND');
  assert.match(r.verzoek.roosterFout, /verzuimregister/);
});

test('toch werken op je verjaardag haalt hem uit het register', () => {
  const { m, verzuim } = wereld();
  const p = m.planVerjaardagen(ORG, team(), 2026, { beleid });
  const j = (p.verjaardagen || []).find(x => x.persoon === 'e');
  assert.ok(j, JSON.stringify(p));
  assert.deepEqual(verzuim.voorPayroll(ORG, 'e', '2026-10-01', '2026-10-01').map(x => x.soort), ['verjaardag']);
  m.werkOpVerjaardag(ORG, j.id, 'e');
  assert.deepEqual(verzuim.voorPayroll(ORG, 'e', '2026-10-01', '2026-10-01'), []);
});

test('wie uit dienst gaat, houdt geen vrije dag in het register', () => {
  const { m, verzuim } = wereld();
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  assert.equal(r.verzoek.stand, 'SCHEDULED');
  const later = team(); later.mensen.find(x => x.id === 'b').inDienst.tot = '2026-10-01';
  assert.equal(m.herkeur(ORG, later).gevonden[0].wat, 'uit-dienst');
  assert.deepEqual(verzuim.voorPayroll(ORG, 'b', '2026-10-01', '2026-10-31'), []);
});

test('een terugname die mislukte, wordt bij het afstemmen afgemaakt en nooit als bijgewerkt bevestigd', () => {
  const { m, verzuim } = wereld();
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  const echt = verzuim.bronWeg;
  verzuim.bronWeg = () => { throw new Error('register even weg'); };
  const t = m.trekIn(ORG, r.verzoek.id, 'b');
  assert.equal(t.verzoek.rooster, 'ONBEKEND');
  verzuim.bronWeg = echt;
  m.reconcile(ORG);
  assert.equal(t.verzoek.rooster, 'TERUGGEDRAAID');
  assert.deepEqual(verzuim.voorPayroll(ORG, 'b', '2026-10-01', '2026-10-31'), []);
});
