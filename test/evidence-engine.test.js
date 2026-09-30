'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const snapshotModule = require('../scripts/lib/repository-snapshot');
const dagModule = require('../scripts/lib/evidence-dag');
const bb = require('../scripts/lib/bewijsboek');
const planner = require('../scripts/plan');
const uitvoerder = require('../scripts/evidence');
const basis = require('../scripts/evidence-base');
const prReady = require('../scripts/pr-ready');
const evidenceGate = require('../scripts/evidence-gate');
const controlPlane = require('../scripts/evidence-control');
const calibration = require('../scripts/evidence-calibration');
const werkelijkheid = require('../scripts/lib/werkelijkheid');
const { metGedeeldeBrowser } = require('./helper');

let snapshot;
test.before(() => { snapshot = snapshotModule.maak(['scripts/lib', 'test', '.']); });

test('RepositorySnapshot leest een keer en memoized transitieve sluitingen', () => {
  assert.match(snapshot.rootHash, /^[0-9a-f]{64}$/);
  assert.ok(snapshot.aantalBestanden > 10);
  const een = snapshot.sluiting(['test/bewijsboek.test.js']);
  const twee = snapshot.sluiting(['test/bewijsboek.test.js']);
  assert.equal(een, twee, 'dezelfde vraag levert exact hetzelfde immutable resultaat');
  assert.ok(Object.isFrozen(een));
  assert.ok(een.paden.includes('scripts/lib/bewijsboek.js'));
});

test('een dynamisch zoekpad naar hetzelfde externe pakket maakt de interne graaf niet onbegrensd', () => {
  const bron = "const x = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright');";
  const kanten = werkelijkheid.kantenUit(bron, [[1, bron]], __filename, 'test/x.test.js');
  assert.deepEqual(kanten.onbekend, []);
});

test('Evidence DAG loopt vanaf gewijzigde bron naar afhankelijk bewijs', () => {
  const dag = dagModule.bouw(snapshot, ['test/bewijsboek.test.js']);
  const geraakt = dag.ongeldigVanaf(['bestand:scripts/lib/bewijsboek.js']);
  assert.ok(geraakt.includes('bewijs:test/bewijsboek.test.js'));
  const invoer = dag.bewijsInvoer('test/bewijsboek.test.js');
  assert.match(invoer.hash, /^[0-9a-f]{64}$/);
  assert.ok(invoer.invoer.length > 1);
});

test('bewijsplanner onderscheidt REUSED, REPROVE en UNKNOWN fail-closed', () => {
  const toets = 'test/bewijsboek.test.js';
  const omgeving = bb.omgeving();
  const profiel = bb.omgevingVoor(toets, omgeving);
  const stempel = bb.stempel(snapshot.index, [toets], profiel);
  let nu = 1_800_000_000_000;
  while (bb.inSteekproef(stempel.hash, Math.floor(nu / 86400000))) nu += 86400000;
  const boek = bb.nieuwBoek();
  boek.bewijzen[toets] = bb.bewijsRecord(toets, stempel, profiel, 'groen',
    { vertrouwd: true, commit: 'abc', run: '1', bron: 'test' }, nu - 1000);

  const hergebruik = planner.plan({ snapshot, toetsen: [toets], omgeving, boek, nu,
    wijziging: { basis: 'basis', bestanden: [] } });
  assert.equal(hergebruik.toetsen[0].status, 'REUSED');

  const opnieuw = planner.plan({ snapshot, toetsen: [toets], omgeving, boek, nu,
    wijziging: { basis: 'basis', bestanden: [{ pad: 'scripts/lib/bewijsboek.js',
      verwijderd: false, klasse: 'besturing' }] } });
  assert.equal(opnieuw.toetsen[0].status, 'REPROVE');

  const onbekend = planner.plan({ snapshot, toetsen: [toets], omgeving, boek, nu,
    wijziging: { basis: 'basis', bestanden: [{ pad: 'buiten/de-index.xyz',
      verwijderd: false, klasse: 'implementation' }] } });
  assert.equal(onbekend.toetsen[0].status, 'UNKNOWN');
  assert.equal(onbekend.mode, 'full');
});

test('uitvoerder versmalt alleen REPROVE en schaalt UNKNOWN op naar full', () => {
  const basis = { telling: { REUSED: 1, REPROVE: 1, UNKNOWN: 0 }, toetsen: [
    { toets: 'test/a.test.js', status: 'REUSED' },
    { toets: 'test/b.e2e.js', status: 'REPROVE' }
  ] };
  assert.deepEqual(uitvoerder.selectie(basis), {
    volledig: false, unit: [], e2e: ['b.e2e.js'], reused: 1
  });
  const onzeker = { mode: 'full', telling: { REUSED: 0, REPROVE: 0, UNKNOWN: 1 }, toetsen: [
    { toets: 'test/a.test.js', status: 'UNKNOWN' }
  ] };
  assert.deepEqual(uitvoerder.selectie(onzeker), {
    volledig: true, unit: ['a.test.js'], e2e: [], reused: 0
  });
  const gemengd = { mode: 'incremental', telling: { REUSED: 1, REPROVE: 0, UNKNOWN: 1 }, toetsen: [
    { toets: 'test/a.test.js', status: 'REUSED' },
    { toets: 'test/b.test.js', status: 'UNKNOWN' }
  ] };
  assert.deepEqual(uitvoerder.selectie(gemengd).unit, ['b.test.js'],
    'een lokaal onbekend bewijs draait zelf, zonder alle onafhankelijke bewijzen ongeldig te maken');
  assert.deepEqual(uitvoerder.selectie({ ...gemengd, toetsen: gemengd.toetsen.concat([
    { toets: 'test/c.e2e.js', status: 'REPROVE' }
  ]) }, 'unit').e2e, [], 'de unithelft start geen browserwerk');
  assert.deepEqual(uitvoerder.selectie({ ...gemengd, toetsen: gemengd.toetsen.concat([
    { toets: 'test/c.e2e.js', status: 'REPROVE' }
  ]) }, 'e2e').unit, [], 'de browserhelft start geen unitwerk');
});

test('bewijsbasis kiest alleen een groene push-run van exact dezelfde commit', () => {
  const runs = [
    { id: 1, head_sha: 'abc', status: 'completed', conclusion: 'failure', event: 'push' },
    { id: 2, head_sha: 'anders', status: 'completed', conclusion: 'success', event: 'push' },
    { id: 3, head_sha: 'abc', status: 'completed', conclusion: 'success', event: 'pull_request' },
    { id: 4, head_sha: 'abc', status: 'completed', conclusion: 'success', event: 'push' }
  ];
  assert.equal(basis.kiesRun(runs, 'abc').id, 4);
  assert.equal(basis.kiesRun(runs, 'weg'), null);
});

test('bewijsbasis valt alleen terug op een groene voorouder en houdt exact vooraan', () => {
  const runs = [
    { id: 9, head_sha: 'zijtak', status: 'completed', conclusion: 'success', event: 'push' },
    { id: 8, head_sha: 'ouder', status: 'completed', conclusion: 'success', event: 'push' },
    { id: 7, head_sha: 'basis', status: 'completed', conclusion: 'success', event: 'push' },
    { id: 6, head_sha: 'rood', status: 'completed', conclusion: 'failure', event: 'push' }
  ];
  const voorouders = new Set(['ouder', 'basis']);
  assert.deepEqual(basis.kiesRuns(runs, 'basis', (a) => voorouders.has(a)).map((r) => r.id),
    [7, 8], 'exact wint; alleen bewezen voorouders volgen');
  assert.deepEqual(basis.kiesRuns(runs, 'nieuw', (a) => voorouders.has(a)).map((r) => r.id),
    [8, 7], 'zonder exacte run blijven niet-voorouders buiten beeld');
});

test('een nieuwere rode nachtelijke ijking degradeert ouder bewijs fail-closed', () => {
  const bewijs = { created_at: '2026-09-29T12:00:00Z' };
  assert.equal(basis.kalibratieBlokkeert(bewijs, {
    created_at: '2026-09-30T02:00:00Z', status: 'completed', conclusion: 'failure' }), true);
  assert.equal(basis.kalibratieBlokkeert(bewijs, {
    created_at: '2026-09-30T02:00:00Z', status: 'completed', conclusion: 'success' }), false);
  assert.equal(basis.kalibratieBlokkeert({ created_at: '2026-09-30T03:00:00Z' }, {
    created_at: '2026-09-30T02:00:00Z', status: 'completed', conclusion: 'failure' }), false,
  'een later schoon bewijs herstelt het vertrouwen');
  assert.equal(basis.laatsteAndereRun([{ id: 12 }, { id: 11 }], '12').id, 11,
    'de lopende schedule is nog geen kalibratie-uitspraak over zichzelf');
});

test('de planner noemt de volledige fallback en de risicobaan expliciet', () => {
  const besluit = planner.modusbesluit({ volledig: true },
    { REUSED: 0, REPROVE: 4, UNKNOWN: 0 }, { bewijzen: {} }, false);
  assert.deepEqual(besluit, { mode: 'full', code: 'geen-vertrouwd-bewijsboek',
    reden: 'geen vertrouwd content-addressed bewijsboek beschikbaar' });
  assert.equal(planner.risicobaan('money'), 'sensitive');
  assert.equal(planner.risicobaan('cosmetic'), 'light');
});

test('de Evidence Control Plane bindt elke hergebruikte toets aan een negatieve claim', () => {
  const plan = { formaat: 'rtg-evidence-plan-v2', basis: 'basis',
    snapshot: { rootHash: 'snap' }, gewijzigd: ['server/a.js'], mode: 'incremental',
    baan: 'product', betrouwbaar: true, gedwongenVolledig: false,
    besluit: { code: 'bewijs-hergebruikt' }, telling: { REUSED: 1, REPROVE: 1, UNKNOWN: 0 },
    impactClaims: [{ pad: 'server/a.js', via: 'zeker', kant: 'wijziging',
      vertrouwen: 1, afstand: 0, reden: 'zelf gewijzigd' }],
    toetsen: [
      { toets: 'test/a.test.js', status: 'REPROVE' },
      { toets: 'test/b.test.js', status: 'REUSED', reden: 'inhoudelijk geldig',
        bewijsSleutel: 'bewijs', invoerHash: 'invoer', omgeving: 'omgeving', onbegrensd: null }
    ] };
  const control = controlPlane.bouwen(plan, { commit: 'c', nu: '2026-09-30T00:00:00.000Z' });
  assert.equal(control.uitsluitingen.length, 1);
  assert.equal(control.uitsluitingen[0].claim, 'niet-geraakt');
  assert.equal(controlPlane.verifieren(control, plan).geldig, true);
  assert.throws(() => controlPlane.verifieren({ ...control, uitsluitingen: [] }, plan),
    /hash klopt niet|REUSED zonder uitsluitingsgrond/);
});

test('nachtelijke kalibratie bevestigt of degradeert iedere uitsluitingsclaim fail-closed', () => {
  const control = {
    formaat: 'rtg-evidence-control-v1', controlHash: 'control', commit: 'c',
    plan: { hash: 'plan' }, kalibratie: { vereist: true },
    uitsluitingen: [{ toets: 'test/a.test.js', claim: 'niet-geraakt', vertrouwen: 1 }],
    kanten: [{ bron: 'server/a.js', doel: 'test/a.test.js', soort: 'opgelost', vertrouwen: 1 }]
  };
  const groen = calibration.kalibreer(control, { unit: 'success', browser: 'success' },
    { nu: '2026-09-30T00:00:00.000Z' });
  assert.equal(groen.stand, 'BEVESTIGD');
  assert.equal(groen.uitsluitingen[0].daarna, 1);
  assert.equal(calibration.verifieren(groen).geldig, true);

  const rood = calibration.kalibreer(control, { unit: 'failure', browser: 'success' },
    { nu: '2026-09-30T00:00:00.000Z' });
  assert.equal(rood.stand, 'GEDEGRADEERD');
  assert.equal(rood.uitsluitingen[0].daarna, 0);
  assert.equal(rood.kanten[0].daarna, 0);
  assert.deepEqual(rood.afwijkingen, [{ naam: 'unit', waarde: 'failure' }]);
});

test('pr:ready kiest geraakte bewijzen en niet toevallig alle ontbrekende boekrecords', () => {
  const selectie = prReady.geraakteSelectie({ toetsen: [
    { toets: 'test/a.test.js', status: 'REPROVE', geraakt: 0 },
    { toets: 'test/b.test.js', status: 'REPROVE', geraakt: 2 },
    { toets: 'test/c.e2e.js', status: 'UNKNOWN', geraakt: 0 }
  ] });
  assert.deepEqual(selectie, { unit: ['b.test.js'], e2e: ['c.e2e.js'], totaal: 2 });
});

test('de gesplitste incrementele poort is fail-closed over beide helften', () => {
  assert.match(evidenceGate.controleer({ mode: 'split', unit: 'success', 'unit-count': '2',
    browser: 'success', 'browser-count': '1' }),
    /onafhankelijk groen/);
  assert.match(evidenceGate.controleer({ mode: 'split', unit: 'success', 'unit-count': '2',
    browser: 'skipped', 'browser-count': '0' }), /onafhankelijk groen/,
  'een lege helft mag zonder runner worden overgeslagen');
  assert.throws(() => evidenceGate.controleer({ mode: 'split', unit: 'success', 'unit-count': '2',
    browser: 'skipped', 'browser-count': '1' }),
    /browser=skipped/);
  assert.throws(() => evidenceGate.controleer({ mode: 'split', unit: 'failure', 'unit-count': '2',
    browser: 'success', 'browser-count': '1' }),
    /unit=failure/);
  assert.throws(() => evidenceGate.controleer({ mode: 'split', unit: 'success',
    browser: 'success', 'browser-count': '1' }), /unit=success/,
  'een ontbrekend aantal is onbekend en dus rood');
});

test('de mergepoort eist alleen de poorten van de gekozen risicobaan en niets minder', () => {
  const basis = { mode: 'merge', route: 'incremental', risk: 'product', event: 'pull_request',
    norm: 'success', security: 'success', dependency: 'success', adversarial: 'skipped',
    container: 'success' };
  assert.match(evidenceGate.controleer(basis), /Merge Gate/);
  assert.throws(() => evidenceGate.controleer({ ...basis, dependency: 'skipped' }), /dependency=skipped/);
  assert.throws(() => evidenceGate.controleer({ ...basis, risk: 'sensitive', adversarial: 'skipped' }),
    /adversarial=skipped/);
  assert.match(evidenceGate.controleer({ ...basis, risk: 'light', container: 'skipped' }), /Merge Gate/);
  assert.throws(() => evidenceGate.controleer({ ...basis, risk: '' }), /onbekende risicobaan/);
});

test('de gebundelde adversarial runner kan geen rood onderdeel verbergen', () => {
  const groen = { mode: 'adversarial', ladder: 'success', roles: 'success',
    'gluur-self': 'success', gluur: 'success' };
  assert.match(evidenceGate.controleer(groen), /adversarial bewijs/);
  assert.throws(() => evidenceGate.controleer({ ...groen, gluur: 'failure' }), /gluur=failure/);
});

test('warme browserfabriek ruimt contexten op zonder het gedeelde proces te sluiten', async () => {
  let verbonden = null, browserDicht = 0, geisoleerd = 0;
  const browser = {
    close: async () => { browserDicht++; },
    newContext: async () => 'context'
  };
  const mod = { chromium: {
    connect: async (endpoint) => { verbonden = endpoint; return browser; },
    launch: async () => { geisoleerd++; return browser; }
  } };
  const gedeeld = metGedeeldeBrowser(mod, 'ws://bewijs');
  const client = await Reflect.get(gedeeld.chromium, 'launch')({ headless: true });
  assert.equal(await client.newContext(), 'context');
  await client.close();
  assert.equal(verbonden, 'ws://bewijs');
  assert.equal(browserDicht, 1, 'een testbestand moet zijn clientverbinding afsluiten');
  const apart = await Reflect.get(gedeeld.chromium, 'launch')({ args: ['--use-fake-device-for-media-stream'] });
  await apart.close();
  assert.equal(geisoleerd, 1, 'procesvlaggen krijgen een eigen browserproces');
});
