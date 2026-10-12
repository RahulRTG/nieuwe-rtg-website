'use strict';
/* ============================================================================
   DE ARCHITECT OP EEN NAGEBOUWDE WORTEL

   codearchitect.test.js en architectcontext.test.js toetsen de Architect op
   de echte registers van het huis. Die zijn groot en veranderen; welke tak er
   dan geraakt wordt, hangt van de dag af. Dit bestand bouwt een kleine,
   vaste wortel met elk register dat de Architect leest (en een paar kapotte),
   zodat elke uitkomst met de hand na te rekenen is:

     - de lezer: cache, een onleesbaar register, en de versheid per soort
       register (geen stempel, geen invoer, met de hand geschreven, een
       invoerblok dat de versheid laat struikelen, TOETSROUTES zonder ronde);
     - regel() en volg(): lege waarden, nul, filters met = en ~, alle
       treffers met *, #aantal en kies over een lijst;
     - vind() en uitleg() voor route, bestand, wet, domein en symbool, ook
       dubbelzinnig, onbekend, en met tegenspraak tussen twee registers;
     - impact(), onbekenden(), waarom(), context() en kaart(), elk op de
       volle wortel en op een lege wortel waar elk register ontbreekt.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const A = require('../scripts/lib/codearchitect');

const GELD = 'server/kern/geld/a.js';
const ROUTE = 'server/routes/geld.js';
const LOS = 'server/kern/los.js';

const REGISTERS = {
  'SYMBOLEN.json': { stempel: { commit: 'abc' }, perBestand: [
    { bestand: GELD, symbolen: [{ naam: 'betaal', lijn: 3 }], gebruiktDoor: [ROUTE], requires: [] },
    { bestand: ROUTE, symbolen: [{ naam: 'route', lijn: 1 }, { naam: 'betaal', lijn: 9 }], gebruiktDoor: [], requires: [GELD] },
    { bestand: LOS, symbolen: [] },
  ] },
  'ROUTEBRON.json': { gemeten: { waarvanTegenspraak: 1, waarvanVerouderd: 0, waarvanNietVastTeStellen: 2, routerRoutesMetBestand: 3 }, perRoute: [
    { route: 'GET /api/geld', bestand: ROUTE, regel: 10 },
    { route: 'POST /api/geld', bestand: ROUTE, regel: 20 },
    { route: 'GET /api/los', bestand: LOS, regel: 1 },
  ] },
  'AANROEPGRAAF.json': { routeNaarSymbool: [
    { route: 'GET /api/geld', bestand: ROUTE, symbolen: ['route'] },
    { route: 'GET /api/los', bestand: 'server/anders.js', symbolen: [] },
  ] },
  'WETTEN.json': { wetten: [
    { id: 'geld-wet', wet: 'geen cent kwijt', bron: 'GELD.md', bewaaktDoor: ['test/geld.test.js', 'scripts/zelfproef.js'],
      sabotage: { bestand: GELD }, draagt: [ROUTE] },
    { id: 'losse-wet' },
  ] },
  'GRENZEN.json': { domeinen: { geld: ['pay'], leeg: [] } },
  'EXECUTION_MAP.json': {
    gemeten: { op: '2026-10-01', commit: 'abc', invoer: { meting: 'invoerspoor', boomVuil: false, ongecommitteInvoer: 'geen-lijst' } },
    stempel: null,
    capabilities: [{ pad: '/api/geld', rol: 'lid', herhaling: 'idempotent', bewijs: 'ONBEPAALD', bewijsReden: 'nog geen proef', bereik: 'geen' }],
  },
  'TOETSROUTES.json': { rondes: [], per: { 'geld.test.js': { kanten: { 'GET /api/geld': '11-' } }, 'stil.test.js': {} } },
  'MUTATIES.json': { toetsen: { 'geld-mut.test.js': { module: GELD }, 'zonder.test.js': {} } },
  'BEWIJSSCHULD.json': { posten: [
    { id: 'geld-schuld', soort: 'ongetoetst', aantal: 2, wat: GELD + ' heeft geen toets' },
    { id: 'ander', soort: 'x', aantal: 1, wat: 'iets anders' },
  ] },
  'AFGELEID.json': { artefacten: [{ naam: 'WETTEN.json', soort: 'BRON' }, { naam: 'SYMBOLEN.json', soort: 'AFGELEID' }] },
};

let tmp, wortel, bron, leeg;
test.before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-architect-'));
  wortel = path.join(tmp, 'wortel');
  bron = path.join(tmp, 'bron');
  leeg = path.join(tmp, 'leeg');
  for (const d of [wortel, bron, leeg]) fs.mkdirSync(d);
  for (const [naam, data] of Object.entries(REGISTERS)) fs.writeFileSync(path.join(wortel, naam), JSON.stringify(data));
  fs.writeFileSync(path.join(wortel, 'KAPOT.json'), '{kapot');
  for (const f of [GELD, ROUTE, LOS]) {
    fs.mkdirSync(path.dirname(path.join(bron, f)), { recursive: true });
    fs.writeFileSync(path.join(bron, f), '// ' + f + '\n');
  }
});
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const lezer = () => A.maakLezer({ wortel, bron });
const legeLezer = () => A.maakLezer({ wortel: leeg, bron });
const veld = (regels, v) => regels.find((r) => r.veld === v);

/* Een planwortel met .evidence/plan.json, voor waarom(). */
function planWortel(t, plan) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-architect-plan-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  fs.mkdirSync(path.join(d, '.evidence'));
  fs.writeFileSync(path.join(d, A.PLAN), JSON.stringify(plan));
  return A.maakLezer({ wortel: d, bron: d });
}

test('de lezer: standaardwortel, cache, en een onleesbaar register draagt zijn reden', () => {
  const std = A.maakLezer();
  assert.equal(std.wortel, A.WORTEL);
  assert.equal(std.bron, A.WORTEL);
  const l = lezer();
  assert.equal(l.laad('GRENZEN.json'), l.laad('GRENZEN.json'), 'een tweede laad komt uit de cache');
  const k = l.laad('KAPOT.json');
  assert.equal(k.ontbreekt, true);
  assert.match(k.reden, /^KAPOT\.json is niet te lezen: /);
  assert.deepEqual(l.laad('NIETS.json'), { naam: 'NIETS.json', ontbreekt: true, reden: 'NIETS.json bestaat hier niet' });
});

test('de versheid per soort register, en nooit "actueel" zonder meting', () => {
  const l = lezer();
  assert.deepEqual(l.laad('SYMBOLEN.json').versheid,
    { stand: 'onbekend', reden: 'dit register draagt geen gemeten invoer (fase 2 dekt nog niet elke generator)' });
  assert.match(l.laad('WETTEN.json').versheid.reden, /met de hand geschreven \(AFGELEID\.json: BRON\)/);
  assert.equal(l.laad('BEWIJSSCHULD.json').versheid.reden, 'dit register draagt geen stempel');
  const em = l.laad('EXECUTION_MAP.json').versheid;
  assert.equal(em.stand, 'onbekend');
  assert.match(em.reden, /^versheid niet te bepalen: /, 'een invoerblok dat de versheid laat struikelen, crasht niet');
  assert.deepEqual(l.laad('TOETSROUTES.json').versheid, { stand: 'onbekend', reden: 'geen ronde in het register' });
  /* een kapot AFGELEID.json maakt de soortvraag leeg en niet fataal */
  const zonderAfgeleid = A.maakLezer({ wortel: leeg, bron });
  assert.equal(zonderAfgeleid.laad('AFGELEID.json').ontbreekt, true);
});

test('regel: een ontbrekend register, een lege waarde, nul, een lege lijst en een bron zonder graad', () => {
  const l = lezer();
  const weg = A.regel(l, { veld: 'x', waarde: 5, register: 'NIETS.json', pad: 'a' });
  assert.deepEqual(weg, { veld: 'x', waarde: null, graad: 'onbekend', versheid: 'onbekend', tegenspraak: 'onbepaald',
    herkomst: { register: 'NIETS.json', pad: null }, reden: 'NIETS.json bestaat hier niet' });
  const niets = A.regel(l, { veld: 'x', waarde: undefined, register: 'GRENZEN.json', pad: 'domeinen.x' });
  assert.equal(niets.waarde, null);
  assert.equal(niets.graad, 'onbekend');
  assert.equal(niets.reden, 'GRENZEN.json noemt hier niets');
  const nul = A.regel(l, { veld: 'x', waarde: 0, register: 'GRENZEN.json', pad: 'p', kies: '#aantal', toelichting: 't' });
  assert.equal(nul.graad, 'vermoed', 'nul is een waarde, geen leegte');
  assert.deepEqual(nul.herkomst, { register: 'GRENZEN.json', pad: 'p', kies: '#aantal' });
  assert.equal(nul.toelichting, 't');
  assert.equal('reden' in nul, false);
  const lijst = A.regel(l, { veld: 'x', waarde: [], register: 'SYMBOLEN.json', pad: 'p', navolgbaar: false, tegenspraak: 'gevonden' });
  assert.equal(lijst.graad, 'gemeten', 'een lege lijst is een gemeten "geen"');
  assert.equal(lijst.tegenspraak, 'gevonden');
  assert.equal(lijst.herkomst.navolgbaar, false);
  assert.equal('reden' in lijst, false);
  const zonderGraad = A.regel(l, { veld: 'x', waarde: 1, register: 'AFGELEID.json', pad: 'p' });
  assert.equal(zonderGraad.graad, 'onbekend', 'een bron zonder verklaarde graad');
});

test('volg: paden, filters met = en ~, alle treffers met *, #aantal en kies', () => {
  const data = { a: { b: [{ id: 'x', w: { n: 1 } }, { id: 'y', w: { n: 2 } }, { id: 'xy', w: { n: 3 } }] }, o: { p: 1, q: 2 } };
  assert.equal(A.volg(data, null), undefined);
  assert.equal(A.volg(data, 'a.b[id=y].w.n'), 2);
  assert.deepEqual(A.volg(data, 'a.b[id~^x]*', 'w.n'), [1, 3]);
  assert.equal(A.volg(data, 'a.b[id~y$]', 'id'), 'y', 'zonder * de eerste treffer');
  assert.equal(A.volg(data, 'a.b', '#aantal'), 3);
  assert.equal(A.volg(data, 'o', '#aantal'), 2);
  assert.equal(A.volg(data, 'o[p=1]'), undefined, 'een filter op een object geeft niets');
  assert.equal(A.volg(data, 'x.y.z'), undefined, 'een tussenstap die ontbreekt');
  assert.equal(A.volg(data, 'a.b[id=zz]', 'id'), undefined, 'geen treffer, dan geen kies');
  assert.deepEqual(A.volg(data, 'o'), { p: 1, q: 2 });
});

test('vind: route, pad met meerdere methodes, bestand, wet, domein, symbool en niets', () => {
  const l = lezer();
  assert.deepEqual(A.vind(l, 'GET   /api/geld'), [{ soort: 'route', id: 'GET /api/geld' }]);
  assert.deepEqual(A.vind(l, '/api/geld'), [{ soort: 'route', id: 'GET /api/geld' }, { soort: 'route', id: 'POST /api/geld' }]);
  assert.deepEqual(A.vind(l, GELD), [{ soort: 'bestand', id: GELD }]);
  assert.deepEqual(A.vind(l, 'geld-wet'), [{ soort: 'wet', id: 'geld-wet' }]);
  assert.deepEqual(A.vind(l, 'geld'), [{ soort: 'domein', id: 'geld' }]);
  assert.deepEqual(A.vind(l, 'route'), [{ soort: 'symbool', id: ROUTE + '#route:1' }]);
  assert.equal(A.vind(l, 'betaal').length, 2, 'een symbool in twee bestanden');
  assert.deepEqual(A.vind(l, 'server'), [], 'een map is geen bestand');
  assert.deepEqual(A.vind(l, 'geen symbool!'), []);
  assert.deepEqual(A.vind(l, undefined), []);
  assert.deepEqual(A.vind(legeLezer(), 'betaal'), [], 'zonder registers geen symbool');
  assert.deepEqual(A.vind(legeLezer(), '/api/geld'), []);
});

test('uitleg van een route: regel, bestand zonder tegenspraak, symbolen, rollen en waargenomen toetsen', () => {
  const u = A.uitleg(lezer(), 'GET /api/geld');
  assert.equal(u.gevonden, true);
  assert.equal(u.soort, 'route');
  assert.equal(veld(u.regels, 'regel').waarde, 10);
  assert.equal(veld(u.regels, 'bestand').tegenspraak, 'geen-gevonden');
  assert.deepEqual(veld(u.regels, 'symbolen').waarde, ['route']);
  assert.equal(veld(u.regels, 'rol lid: herhaling').waarde, 'idempotent');
  assert.equal(veld(u.regels, 'rol lid: bewijs').toelichting, 'nog geen proef');
  assert.deepEqual(veld(u.regels, 'waargenomen toetsen').waarde, ['geld.test.js (11-)']);
  for (const r of u.regels.filter((x) => x.herkomst.navolgbaar !== false && x.waarde !== null)) {
    assert.deepEqual(A.volg(REGISTERS[r.herkomst.register], r.herkomst.pad, r.herkomst.kies), r.waarde, r.veld);
  }
});

test('uitleg van een route waarover twee registers het oneens zijn, en van een onbekende route', () => {
  const u = A.uitleg(lezer(), 'GET /api/los');
  const b = veld(u.regels, 'bestand');
  assert.equal(b.tegenspraak, 'gevonden');
  assert.equal(b.toelichting, 'AANROEPGRAAF.json zegt server/anders.js');
  assert.deepEqual(veld(u.regels, 'waargenomen toetsen').waarde, []);
  const onbekend = A.uitleg(lezer(), 'DELETE /api/niets');
  assert.equal(onbekend.gevonden, true, 'een route-vorm wordt altijd als route gelezen');
  assert.equal(veld(onbekend.regels, 'regel').graad, 'onbekend');
  assert.equal(veld(onbekend.regels, 'bestand').tegenspraak, 'onbepaald');
  assert.equal(veld(onbekend.regels, 'symbolen').waarde, null);
  const zonder = A.uitleg(legeLezer(), 'GET /api/geld');
  assert.ok(zonder.regels.every((r) => r.graad === 'onbekend'));
  assert.equal(veld(zonder.regels, 'waargenomen toetsen').reden, 'TOETSROUTES.json bestaat hier niet');
});

test('uitleg van een bestand: routes uit de router tegen de aanroepgraaf, en de wetten die het breken', () => {
  const u = A.uitleg(lezer(), ROUTE);
  assert.equal(u.soort, 'bestand');
  const routes = veld(u.regels, 'routes (router)');
  assert.deepEqual(routes.waarde, ['GET /api/geld', 'POST /api/geld']);
  assert.equal(routes.tegenspraak, 'gevonden');
  assert.equal(routes.toelichting, 'AANROEPGRAAF.json noemt 1 route(s) voor dit bestand, ROUTEBRON.json 2');
  assert.deepEqual(veld(u.regels, 'symbolen').waarde, ['route', 'betaal']);
  assert.deepEqual(veld(u.regels, 'laadt').waarde, [GELD]);
  assert.deepEqual(veld(u.regels, 'wetten').waarde, []);
  const g = A.uitleg(lezer(), GELD);
  assert.deepEqual(veld(g.regels, 'wetten').waarde, ['geld-wet']);
  assert.deepEqual(veld(g.regels, 'routes (router)').waarde, []);
  assert.equal(veld(g.regels, 'routes (router)').tegenspraak, 'geen-gevonden', 'beide registers noemen geen route');
  const leegBestand = A.uitleg(legeLezer(), LOS);
  assert.equal(leegBestand.gevonden, true, 'het bestand staat in de bron, ook zonder registers');
  assert.ok(leegBestand.regels.every((r) => r.graad === 'onbekend'));
  assert.equal(veld(leegBestand.regels, 'routes (router)').tegenspraak, 'onbepaald');
});

test('uitleg van een wet, een domein, een symbool, en wat dubbelzinnig of onvindbaar is', () => {
  const w = A.uitleg(lezer(), 'geld-wet');
  assert.deepEqual(w.regels.map((r) => r.waarde), ['geen cent kwijt', 'GELD.md', ['test/geld.test.js', 'scripts/zelfproef.js']]);
  const los = A.uitleg(lezer(), 'losse-wet');
  assert.ok(los.regels.every((r) => r.waarde === null && r.graad === 'onbekend'));

  const d = A.uitleg(lezer(), 'geld');
  assert.deepEqual(veld(d.regels, 'mag aan de kern').waarde, ['pay']);
  assert.deepEqual(veld(d.regels, 'bestanden').waarde, [GELD, ROUTE]);
  assert.deepEqual(veld(d.regels, 'routes in die bestanden').waarde, ['GET /api/geld', 'POST /api/geld']);
  const ld = A.uitleg(lezer(), 'leeg');
  assert.deepEqual(veld(ld.regels, 'bestanden').waarde, []);
  assert.deepEqual(veld(ld.regels, 'routes in die bestanden').waarde, []);

  const s = A.uitleg(lezer(), 'route');
  assert.equal(s.soort, 'symbool');
  assert.deepEqual(veld(s.regels, 'symbolen').waarde, ['route', 'betaal'], 'een symbool legt zijn bestand uit');

  const dubbel = A.uitleg(lezer(), 'betaal');
  assert.equal(dubbel.gevonden, false);
  assert.equal(dubbel.kandidaten.length, 2);
  assert.match(dubbel.reden, /dubbelzinnig/);
  const niets = A.uitleg(lezer(), 'onvindbaar');
  assert.deepEqual(niets.kandidaten, []);
  assert.match(niets.reden, /^geen route, bestand/);
});

test('impact: de omgekeerde require-sluiting, de routes erin en de toetsen die ze raakten', () => {
  const i = A.impact(lezer(), [GELD]);
  assert.deepEqual(i.statisch[0].waarde, [GELD, ROUTE]);
  assert.deepEqual(i.statisch[1].waarde, ['GET /api/geld', 'POST /api/geld']);
  assert.deepEqual(i.waargenomen[0].waarde, ['geld.test.js']);
  assert.match(i.kennisgaten[2], /een relatie die een ronde niet gezien werd/);
  assert.equal(i.toetsreductie.toegestaan, false);
  const los = A.impact(lezer(), [LOS, 'server/onbekend.js']);
  assert.deepEqual(los.statisch[0].waarde, [LOS, 'server/onbekend.js']);
  assert.deepEqual(los.waargenomen[0].waarde, []);
  const leegI = A.impact(legeLezer(), [GELD]);
  assert.deepEqual(leegI.statisch[0].waarde, null, 'zonder SYMBOLEN.json is ook de sluiting onbekend');
  assert.equal(leegI.statisch[1].waarde, null);
  assert.equal(leegI.waargenomen[0].waarde, null);
  assert.match(leegI.kennisgaten[2], /TOETSROUTES\.json ontbreekt/);
});

test('onbekenden: vier bakken, met en zonder scope, en zonder registers', () => {
  const o = A.onbekenden(lezer());
  const namen = o.versheid.onbekend.map((x) => x.register);
  assert.ok(namen.includes('KAPOT.json'), 'een kapot register is onbekend met reden');
  assert.ok(namen.includes('SYMBOLEN.json'));
  assert.deepEqual(o.versheid.actueel, []);
  assert.deepEqual(o.graadOnbekend.ontbrekendeBronnen.map((x) => x.register), ['SCHERMROUTES.json', A.PLAN]);
  assert.deepEqual(o.tegenspraak, [
    { register: 'ROUTEBRON.json', pad: 'gemeten.waarvanTegenspraak', aantal: 1, ook: { verouderd: 0, nietVastTeStellen: 2 } },
    { register: 'EXECUTION_MAP.json', pad: 'capabilities', aantal: 1 }]);
  assert.equal(o.verklaardeSchuld.length, 2);
  const g = A.onbekenden(lezer(), 'geld');
  assert.deepEqual(g.verklaardeSchuld.map((x) => x.id), ['geld-schuld']);
  assert.deepEqual(g.versheid.onbekend, [], 'geen register heeft geld in zijn naam');
  const s = A.onbekenden(lezer(), 'SYMBOLEN');
  assert.deepEqual(s.versheid.onbekend.map((x) => x.register), ['SYMBOLEN.json']);
  const l = A.onbekenden(legeLezer());
  assert.deepEqual(l.tegenspraak, []);
  assert.deepEqual(l.verklaardeSchuld, { reden: 'BEWIJSSCHULD.json bestaat hier niet' });
  assert.equal(l.graadOnbekend.ontbrekendeBronnen.length, Object.keys(A.GRAAD).length);
});

test('waarom zonder onderwerp noemt de poorten; zonder plan of met een oud plan is het niet gevonden', (t) => {
  const zonder = A.waarom(legeLezer());
  assert.equal(zonder.onderwerp, 'poorten');
  assert.ok(Array.isArray(zonder.poorten) && zonder.poorten.length > 0);
  assert.equal('gevonden' in zonder, false);
  assert.equal(A.waarom(legeLezer(), ' poorten ').onderwerp, 'poorten');
  const geenPlan = A.waarom(legeLezer(), 'keuring');
  assert.equal(geenPlan.gevonden, false);
  assert.equal(geenPlan.regels[0].reden, A.PLAN + ' bestaat hier niet');
  const oud = A.waarom(planWortel(t, { mode: 'full' }), 'keuring');
  assert.equal(oud.gevonden, false);
  assert.match(oud.reden, /van voor fase 6/);
});

test('waarom met een plan: kiezen op keuring, wet, regel, code en pad; een poort zonder reden; en een narekening die niet klopt', (t) => {
  const redenen = {
    klasse: 'money',
    klopt: { ja: false, strengste: 'security' },
    bereik: { gewijzigd: 1 },
    regels: [
      { wet: 'keuring-zwaarste-regel-wint', regel: 'vorm', klasse: 'money', graad: 'vermoed', gemeten: { pad: GELD } },
      { wet: null, bron: 'scripts/plan.js modusbesluit()', regel: 'modus', klasse: null, graad: 'gemeten', gemeten: { code: 'volledig' } },
    ],
  };
  const l = planWortel(t, { redenen });
  const alles = A.waarom(l, 'keuring');
  assert.equal(alles.gevonden, true);
  assert.equal(alles.regels.length, 4);
  assert.equal(alles.regels[0].veld, 'keuring-zwaarste-regel-wint / vorm');
  assert.equal(alles.regels[0].herkomst.pad, 'redenen.regels[gemeten.pad=' + GELD + ']');
  assert.equal(alles.regels[0].toelichting, 'graad van de meting: vermoed; dwingt money af');
  assert.equal(alles.regels[1].veld, 'geen wet / modus');
  assert.equal(alles.regels[1].herkomst.pad, 'redenen.regels[regel=modus]');
  assert.equal(alles.regels[1].toelichting, 'graad van de meting: gemeten; bron: scripts/plan.js modusbesluit()');
  const klasse = veld(alles.regels, 'klasse van de keuring');
  assert.equal(klasse.tegenspraak, 'gevonden');
  assert.equal(klasse.toelichting, 'de narekening noemt security');
  assert.equal(A.waarom(l, 'volledig').regels.length, 3, 'op besluitcode');
  assert.equal(A.waarom(l, GELD).regels[0].waarde.regel, 'vorm', 'op pad');
  assert.equal(A.waarom(l, 'modus').regels[0].waarde.regel, 'modus', 'op regelnaam');

  const poort = alles.poorten[0];
  const bekend = A.waarom(l, poort.naam);
  assert.equal(bekend.gevonden, false);
  assert.match(bekend.reden, /deze poort schrijft nog geen reden uit/);
  assert.match(A.waarom(l, 'iets-wat-niet-bestaat').reden, /geen afgegane regel, besluit, wet of pad/);

  const goed = A.waarom(planWortel(t, { redenen: { ...redenen, klopt: { ja: true } } }), 'keuring');
  assert.equal(veld(goed.regels, 'klasse van de keuring').tegenspraak, 'geen-gevonden');
  const zonderKlopt = A.waarom(planWortel(t, { redenen: { ...redenen, klopt: undefined } }), 'keuring');
  assert.equal(veld(zonderKlopt.regels, 'klasse van de keuring').toelichting, 'de narekening noemt undefined');
});

test('context: een onbekende taakklasse, een dubbelzinnig en een onvindbaar onderwerp', () => {
  const l = lezer();
  const fout = A.context(l, 'herschrijven', GELD);
  assert.equal(fout.gevonden, false);
  assert.match(fout.reden, /onbekende taakklasse; kies uit toets-toevoegen/);
  const dubbel = A.context(l, 'toets-toevoegen', 'betaal');
  assert.equal(dubbel.gevonden, false);
  assert.equal(dubbel.kandidaten.length, 2);
  assert.equal(dubbel.voldoendheid.uitslag, 'onvoldoende');
  assert.deepEqual(dubbel.voldoendheid.ontbreekt.map((x) => x.eis), ['onderwerp', 'toetsen']);
  assert.equal(dubbel.voldoendheid.ontbreekt[0].reden, 'dubbelzinnig: kies een van de kandidaten');
  const niets = A.context(l, 'toets-toevoegen', 'onvindbaar');
  assert.equal(niets.reden, 'geen route, bestand, wet, domein of symbool met deze naam');
});

test('context van een geldbestand: domein, wetten, toetsen, bevindingen, en voldoendheid per taakklasse', () => {
  const l = lezer();
  const c = A.context(l, 'code-wijzigen', GELD);
  assert.equal(c.gevonden, true);
  assert.equal(c.domein, 'geld');
  assert.deepEqual(c.bestanden, [GELD]);
  assert.deepEqual(veld(c.regels, 'symbolen').waarde, ['betaal']);
  assert.equal(veld(c.regels, 'symbolen').herkomst.pad, 'perBestand[bestand=' + GELD + '].symbolen');
  assert.deepEqual(veld(c.regels, 'routes').waarde, []);
  assert.deepEqual(veld(c.regels, 'wetten').waarde, ['geld-wet']);
  assert.deepEqual(veld(c.regels, 'grenzen (mag aan de kern)').waarde, ['pay']);
  assert.deepEqual(veld(c.regels, 'bekende bevindingen').waarde, ['geld-schuld']);
  assert.deepEqual(veld(c.regels, 'toetsen waargenomen').waarde, []);
  assert.deepEqual(veld(c.regels, 'toetsen mogelijk relevant').waarde, ['test/geld-mut.test.js', 'test/geld.test.js']);
  assert.equal(c.voldoendheid.uitslag, 'voldoende');
  assert.equal(c.voldoendheid.schaduw, true);
  assert.equal(c.voldoendheid.houdtTegen, false);
  assert.equal(c.nietAannemen, A.NIET_AANNEMEN);

  const geld = A.context(l, 'geldregel-wijzigen', GELD);
  assert.equal(geld.voldoendheid.uitslag, 'onvoldoende');
  assert.deepEqual(geld.voldoendheid.ontbreekt.map((x) => x.eis), ['toetsenWaargenomen', 'vers']);
  assert.equal(geld.voldoendheid.ontbreekt[0].reden, 'geen toets is waargenomen die deze routes raakt');
  assert.equal(geld.voldoendheid.ontbreekt[1].reden, 'de symboolmeting is niet aantoonbaar actueel (onbekend)');
});

test('context van een route, een domein, een symbool, een wet en een bestand zonder domein', () => {
  const l = lezer();
  const r = A.context(l, 'geldregel-wijzigen', 'GET /api/geld');
  assert.deepEqual(r.bestanden, [ROUTE]);
  assert.equal(r.domein, 'geld', 'server/routes/geld.js hoort bij het domein geld');
  assert.deepEqual(veld(r.regels, 'toetsen waargenomen').waarde, ['geld.test.js']);
  assert.deepEqual(veld(r.regels, 'wetten').waarde, ['geld-wet'], 'via het veld draagt');
  assert.deepEqual(veld(r.regels, 'grenzen (mag aan de kern)').waarde, ['pay']);
  assert.deepEqual(r.voldoendheid.ontbreekt.map((x) => x.eis), ['vers'], 'alleen de versheid ontbreekt');

  const d = A.context(l, 'code-wijzigen', 'geld');
  assert.equal(d.soort, 'domein');
  assert.equal(d.domein, 'geld');
  assert.deepEqual(d.bestanden, [GELD, ROUTE]);
  const sym = veld(d.regels, 'symbolen');
  assert.deepEqual(sym.waarde, [GELD + '#betaal', ROUTE + '#route', ROUTE + '#betaal'], 'meer bestanden: met bestandsnaam');
  assert.equal(sym.herkomst.navolgbaar, false);
  assert.equal(veld(d.regels, 'routes').herkomst.pad, 'perRoute');

  const s = A.context(l, 'toets-toevoegen', 'route');
  assert.equal(s.soort, 'symbool');
  assert.deepEqual(s.bestanden, [ROUTE]);

  const w = A.context(l, 'toets-toevoegen', 'geld-wet');
  assert.equal(w.soort, 'wet');
  assert.deepEqual(w.bestanden, []);
  assert.deepEqual(w.kennisgaten, ['geen bestand bekend: de impact is niet te bepalen']);
  assert.deepEqual(veld(w.regels, 'toetsen mogelijk relevant').waarde, []);

  const onbekendeRoute = A.context(l, 'toets-toevoegen', 'PUT /api/nergens');
  assert.deepEqual(onbekendeRoute.bestanden, []);

  const los = A.context(l, 'code-wijzigen', LOS);
  assert.equal(los.domein, null);
  const grens = veld(los.regels, 'grenzen (mag aan de kern)');
  assert.equal(grens.graad, 'onbekend');
  assert.equal(grens.herkomst.pad, null);
  assert.equal(grens.toelichting, 'geen domein in GRENZEN.json voor deze bestanden');
  assert.deepEqual(veld(los.regels, 'routes').waarde, ['GET /api/los']);
  assert.deepEqual(veld(los.regels, 'toetsen waargenomen').waarde, []);
});

test('context zonder registers: elk veld onbekend, en de voldoendheid noemt elke eis', () => {
  const c = A.context(legeLezer(), 'geldregel-wijzigen', GELD);
  assert.equal(c.gevonden, true);
  assert.equal(c.domein, null);
  assert.ok(c.regels.every((r) => r.waarde === null && r.graad === 'onbekend'));
  assert.equal(veld(c.regels, 'toetsen mogelijk relevant').waarde, null, 'zonder mutaties en wetten is ook "mogelijk" onbekend');
  assert.deepEqual(c.voldoendheid.ontbreekt.map((x) => x.eis), ['wettenGenoemd', 'grenzen', 'toetsenWaargenomen', 'vers']);
  assert.equal(c.voldoendheid.ontbreekt[2].reden, 'TOETSROUTES.json bestaat hier niet');
  const code = A.context(legeLezer(), 'code-wijzigen', GELD);
  assert.deepEqual(code.voldoendheid.ontbreekt.map((x) => x.eis), ['wetten', 'grenzen', 'toetsen']);
});

test('voldoendheid op een pakket zonder regels mist elke eis, met de standaardreden', () => {
  const v = A.voldoendheid({ gevonden: false }, 'geldregel-wijzigen');
  assert.deepEqual(v.ontbreekt.map((x) => x.reden), [
    'het onderwerp is niet gevonden',
    'geen wet noemt deze bestanden: wat mag hier niet stuk?',
    'het domein en zijn grens zijn niet bekend',
    'geen toets is waargenomen die deze routes raakt',
    'de symboolmeting is niet aantoonbaar actueel (onbekend)']);
});

test('kaart: de bronnen met hun graad en versheid, en de omvang per register', () => {
  const k = A.kaart(lezer());
  assert.equal(k.bronnen.length, Object.keys(A.GRAAD).length);
  const plan = k.bronnen.find((b) => b.register === A.PLAN);
  assert.equal(plan.versheid, 'onbekend');
  assert.equal(plan.reden, A.PLAN + ' bestaat hier niet');
  assert.deepEqual(k.omvang.map((r) => r.waarde), [3, 3, 2, 2]);
  for (const r of k.omvang) assert.equal(A.volg(REGISTERS[r.herkomst.register], r.herkomst.pad, r.herkomst.kies), r.waarde, r.veld);
  const leegK = A.kaart(legeLezer());
  assert.ok(leegK.omvang.every((r) => r.waarde === null && r.graad === 'onbekend'));
});

/* Een wortel waarin elk register BESTAAT maar zijn lijsten mist: de Architect
   leest dan een gemeten "geen" (lege lijst) en geen onbekend. */
function skeletLezer(t, over = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-architect-skelet-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  for (const naam of Object.keys(REGISTERS)) fs.writeFileSync(path.join(d, naam), JSON.stringify(over[naam] || {}));
  return A.maakLezer({ wortel: d, bron });
}

test('registers zonder lijsten: elke vraag geeft een lege lijst en geen crash', (t) => {
  const l = skeletLezer(t);
  assert.deepEqual(A.vind(l, '/api/geld'), []);
  assert.deepEqual(A.vind(l, 'betaal'), []);
  assert.deepEqual(A.vind(l, 'geld'), [], 'GRENZEN.json zonder domeinen kent geen domein');
  const b = A.uitleg(l, GELD);
  assert.equal(veld(b.regels, 'symbolen').waarde, null, 'het bestand staat niet in SYMBOLEN.json');
  assert.deepEqual(veld(b.regels, 'routes (router)').waarde, []);
  assert.equal(veld(b.regels, 'routes (router)').tegenspraak, 'geen-gevonden');
  assert.deepEqual(veld(b.regels, 'wetten').waarde, []);
  const r = A.uitleg(l, 'GET /api/geld');
  assert.equal(veld(r.regels, 'regel').waarde, null);
  assert.deepEqual(veld(r.regels, 'waargenomen toetsen').waarde, []);
  assert.equal(A.uitleg(l, 'geld-wet').gevonden, false);
  const i = A.impact(l, [GELD]);
  assert.deepEqual(i.statisch[0].waarde, [GELD]);
  assert.deepEqual(i.statisch[1].waarde, []);
  assert.deepEqual(i.waargenomen[0].waarde, []);
  const o = A.onbekenden(l);
  assert.deepEqual(o.tegenspraak, [{ register: 'EXECUTION_MAP.json', pad: 'capabilities', aantal: 0 }]);
  assert.deepEqual(o.verklaardeSchuld, []);
  const c = A.context(l, 'code-wijzigen', GELD);
  assert.equal(c.domein, null);
  assert.deepEqual(veld(c.regels, 'symbolen').waarde, []);
  assert.deepEqual(veld(c.regels, 'wetten').waarde, []);
  assert.deepEqual(veld(c.regels, 'toetsen mogelijk relevant').waarde, []);
  assert.deepEqual(veld(c.regels, 'bekende bevindingen').waarde, []);
  assert.deepEqual(A.kaart(l).omvang.map((x) => x.waarde), [0, null, 0, 0], 'ROUTEBRON.json zonder gemeten-blok noemt geen aantal');
});

test('een domein uit de lege lijst, een wet zonder handhavers en schuld die alleen in de omschrijving past', (t) => {
  const l = skeletLezer(t, {
    'GRENZEN.json': { domeinen: { geld: [] } },
    'WETTEN.json': { wetten: [{ id: 'kale-wet', sabotage: { bestand: GELD } }] },
    'BEWIJSSCHULD.json': { posten: [{ id: 'x-1', wat: 'het geld lekt' }, { id: 'y', wat: 'niets' }] },
    'SYMBOLEN.json': { perBestand: [{ bestand: GELD, symbolen: [{ naam: 'a', lijn: 1 }] }] },
  });
  const d = A.uitleg(l, 'geld');
  assert.deepEqual(veld(d.regels, 'mag aan de kern').waarde, [], 'een lege grens is een gemeten "niets"');
  assert.deepEqual(veld(d.regels, 'bestanden').waarde, [GELD]);
  assert.deepEqual(veld(d.regels, 'routes in die bestanden').waarde, []);
  const c = A.context(l, 'code-wijzigen', GELD);
  assert.deepEqual(veld(c.regels, 'wetten').waarde, ['kale-wet']);
  assert.deepEqual(veld(c.regels, 'toetsen mogelijk relevant').waarde, [], 'een wet zonder bewaaktDoor noemt geen toets');
  assert.deepEqual(veld(c.regels, 'bekende bevindingen').waarde, ['x-1']);
  assert.deepEqual(A.onbekenden(l, 'lekt').verklaardeSchuld.map((p) => p.id), ['x-1']);
  assert.deepEqual(A.uitleg(l, 'kale-wet').regels.map((r) => r.waarde), [null, null, null]);
});
