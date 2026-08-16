const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const functies = require('../server/functies');
const maakScanner = require('../server/kern/magnaat-capabilities');
const bronnen = require('../server/kern/magnaat-capabilities-bronnen');

const root = path.join(__dirname, '..');

test('de Capability Graph leest apps, routes, werkprocessen en kantoren rechtstreeks uit de RTG-code', () => {
  const graph = maakScanner({ root, functies }).scan();
  assert.ok(graph.cijfers.apps >= 150, 'alle echte app-pagina’s worden gevonden');
  assert.ok(graph.cijfers.apiActies >= 1500, 'de echte API-deuren worden gevonden');
  assert.ok(graph.cijfers.werkprocessen >= 500, 'routes worden tot procesfamilies gebundeld');
  assert.ok(graph.cijfers.kantoren >= 29, 'afdelingen en specialistische kamers worden gevonden');
  assert.ok(graph.cijfers.ongedekteApiActies > 0, 'de scanner toont wat het functieregister nog mist');
  assert.ok(graph.cijfers.controlepunten >= 2500, 'iedere API, app, functie en procesfamilie krijgt een controlepunt');
  assert.ok(graph.cijfers.dekkingspercentage > 0 && graph.cijfers.dekkingspercentage < 100,
    'gevonden code wordt niet meer ten onrechte als honderd procent gekoppeld gemeld');
  assert.equal(graph.dekkingsmatrix.dimensies.length, 11, 'alle bestuurlijke dekkingsassen staan in de matrix');
  assert.ok(graph.dekkingsmatrix.metGaten > 0, 'onbewezen koppelingen blijven zichtbaar als werk');
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'kantoor').percentage, 100,
    'ieder codepunt heeft een expliciete bestaande RTG-kantoorruimte');
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'economie').percentage, 100,
    'ieder economisch relevant punt is aan de spel-economie gekoppeld');
  assert.equal(graph.apps.some(a => a.pad === '/apps/kantoren.html'), true);
  assert.equal(graph.kantoren.some(k => k.id === 'klantenservice'), true);
  assert.equal(graph.workflows.some(w => w.familie === '/api/office/bank' && w.actieAantal >= 20), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/bank' && p.kantoor.id === 'bank'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/redactie' && p.kantoor.id === 'redactie'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/weefsel' && p.kantoor.id === 'stad'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/member/magnaat' && p.kantoor.id === 'controleregister'), true);
  const kantoorIds = new Set(graph.kantoren.map(k => k.id));
  assert.equal(graph.controlepunten.some(p => p.kantoor.toewijzing === 'regel' && !kantoorIds.has(p.kantoor.id)), false,
    'een expliciete regel mag nooit naar een niet-bestaande kamer wijzen');
  assert.equal(graph.controlepunten.some(p => p.kantoor.toewijzing === 'terugval'), false,
    'de kantoormatrix bevat geen stil vangnet meer');
  assert.equal(graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/health').dekking.waarden.economie, null,
    'een technische healthcheck krijgt geen verzonnen geld-effect');
  assert.equal(graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/techniek/controle/integriteit').dekking.waarden.economie, null,
    'de permanente herstelbediening blijft bestuurlijk, ook als een woorddeel economisch lijkt');
  assert.equal(graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/office/bank').dekking.waarden.economie, true,
    'een bankroute loopt wel door de spel-economie');
  assert.ok(graph.controlepunten.every(p => p.dekking && Array.isArray(p.dekking.ontbreekt)),
    'ieder codepunt krijgt automatisch een controleerbare dekkingskaart');
  assert.ok(graph.controlepunten.filter(p => p.soort === 'scherm').every(p =>
    p.dekking.waarden.gameplay === true && p.signalen.schermbrug === true),
  'ieder bestaand appscherm opent via de aantoonbaar geïsoleerde Magnaat-schermbrug');
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'gameplay').percentage, 100,
    'ook technische codepunten zijn interactief via de Controleregister-spelbrug');
  const health = graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/health');
  assert.equal(health.signalen.functiespel, false, 'een healthcheck wordt geen verzonnen eindgebruikersmissie');
  assert.equal(health.signalen.controleSpelbrug, true);
  assert.equal(health.dekking.waarden.gameplay, true, 'maar blijft wel veilig bestuurbare gameplay');
  assert.ok(graph.workflows.every(w => w.bronstand && w.dekking && w.dekking.waarden),
    'ieder gegroepeerd werkproces krijgt stand, rollen en dekkingsvelden');
});

test('een expliciete realistische werkroute maakt alleen de genoemde codefamilie groen', () => {
  const graph = maakScanner({ root, functies,
    volledigeWerkprocessen: [{ codeFamilies: ['/api/office/bank'] }]
  }).scan();
  const bank = graph.workflows.find(w => w.familie === '/api/office/bank');
  const ander = graph.workflows.find(w => w.familie !== '/api/office/bank');
  assert.equal(bank.dekking.waarden.werkroute, true);
  assert.equal(ander.dekking.waarden.werkroute, false, 'een generiek scenario is nog geen volledige werkroute');
});

test('dezelfde code levert een stabiele vingerafdruk en geen dynamische nepkamer op', () => {
  const scanner = maakScanner({ root, functies });
  const a = scanner.scan();
  const b = scanner.scan();
  assert.equal(a.vingerafdruk, b.vingerafdruk);
  assert.equal(a.kantoren.some(k => /esc\(|[+'$]/.test(k.naam)), false);
});

const nativeBin = process.env.RTG_CAPABILITY_RUST_BIN || path.join(root, 'motor/target/release/rtg-motor');
function metEnv(waarden, werk) {
  const oud = {};
  for (const [naam, waarde] of Object.entries(waarden)) {
    oud[naam] = process.env[naam];
    if (waarde === undefined) delete process.env[naam];
    else process.env[naam] = String(waarde);
  }
  try {
    return werk();
  } finally {
    for (const [naam, waarde] of Object.entries(oud)) {
      if (waarde === undefined) delete process.env[naam];
      else process.env[naam] = waarde;
    }
  }
}

test('de native broncodescan is byte-voor-byte gelijk en doorloopt schaduw en canary veilig', () => {
  const javascript = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'uit', RTG_CAPABILITY_RUST_BIN: nativeBin
  });
  const schaduw = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'schaduw', RTG_CAPABILITY_RUST_BIN: nativeBin
  });
  const canary = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'canary', RTG_CAPABILITY_RUST_BIN: nativeBin,
    RTG_CAPABILITY_RUST_CANARY_PCT: '100', RTG_CAPABILITY_RUST_CANARY_KEY: 'toets'
  });
  assert.deepEqual(schaduw.apps, javascript.apps);
  assert.deepEqual(schaduw.endpoints, javascript.endpoints);
  assert.equal(schaduw.motor.bron, 'javascript');
  assert.equal(schaduw.motor.pariteit, true);
  assert.equal(canary.motor.bron, 'rust');
  assert.equal(canary.motor.pariteit, true);
  assert.equal(canary.motor.canaryGekozen, true);
});

test('capability-noodstop en een kapotte binary vallen aantoonbaar terug naar JavaScript', () => {
  const nood = bronnen.scan(root, {
    RTG_RUST_ALLES_UIT: '1', RTG_CAPABILITY_RUST_MODE: 'motor',
    RTG_CAPABILITY_RUST_BIN: '/bestaat/bewust/niet'
  });
  const kapot = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'motor', RTG_CAPABILITY_RUST_BIN: '/bestaat/bewust/niet'
  });
  assert.equal(nood.motor.globaleNoodstop, true);
  assert.equal(nood.motor.reden, 'globale-noodstop');
  assert.equal(nood.motor.bron, 'javascript');
  assert.equal(kapot.motor.terugval, true);
  assert.equal(kapot.motor.reden, 'native-fout');
});

test('de Capability Graph maakt de gekozen motorstand zichtbaar', () => {
  metEnv({
    RTG_RUST_ALLES_UIT: undefined, RTG_CAPABILITY_RUST_MODE: 'canary',
    RTG_CAPABILITY_RUST_BIN: nativeBin, RTG_CAPABILITY_RUST_CANARY_PCT: '100',
    RTG_CAPABILITY_RUST_CANARY_KEY: 'graph-toets'
  }, () => {
    const graph = maakScanner({ root, functies }).scan();
    assert.equal(graph.motor.bron, 'rust');
    assert.equal(graph.motor.pariteit, true);
  });
});
