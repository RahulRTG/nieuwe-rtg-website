'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const snapshotModule = require('../scripts/lib/repository-snapshot');
const dagModule = require('../scripts/lib/evidence-dag');
const bb = require('../scripts/lib/bewijsboek');
const planner = require('../scripts/plan');
const uitvoerder = require('../scripts/evidence');
const basis = require('../scripts/evidence-base');
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
