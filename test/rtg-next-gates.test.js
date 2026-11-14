'use strict';
/* Protocolproeven. Mocks bewijzen poortgedrag, nooit RTG-productkwaliteit.
   Alleen tijdelijke fixturebestanden; geen browser, netwerk of productieactie. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const gates = require('../scripts/lib/experience/qualification-gates');
const evidence = require('../scripts/lib/experience/evidence');
const coverage = require('../scripts/lib/experience/coverage');
const planning = require('../scripts/rtg-next-programma');
const root = path.resolve(__dirname, '..');
const {fixture} = require('./lib/experience-artifact-fixture');
const find = (result, id) => result.checks.find(item => item.id === id);

test('de echte CLI beoordeelt alle vier poorten en vijf ervaringsvragen zonder cyclische importfout', () => {
  const run = require('node:child_process').spawnSync(process.execPath,
    ['scripts/rtg-next-programma.js','--gate=G4'], {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  const result = JSON.parse(run.stdout);
  assert.equal(run.status,result.status==='PROVEN' ? 0 : 1,run.stderr);
  assert.doesNotMatch(run.stderr,/circular dependency|not a function/);
  assert.equal(result.releaseAuthorized,false);
  assert.deepEqual(result.dependencies.map(row=>row.gate),['G1','G2','G3']);
  const model = planning.load();
  assert.equal(result.scope.functions.length,model.inventory.length);
  assert.equal(result.scope.screens.length,model.screens.length);
  for (const row of result.dependencies.slice(0,2)) {
    const premium = find(row,'PremiumExperience');
    assert.equal(premium.checks.length,5);
  }
});

function harness(t, mutate = () => {}) {
  const model = planning.load();
  const contract = require('../experience-architecture/coverage-contract.json');
  const baseline = coverage.build(root, {sourceHash:'unit-source', commit:'a'.repeat(40)});
  mutate(model, baseline);
  t.mock.method(planning, 'load', () => model);
  t.mock.method(planning, 'report', () => ({errors:[], buildReadiness:{status:'READY_TO_BUILD', blockers:[]}}));
  t.mock.method(evidence, 'candidate', () => ({ok:true, commit:'a'.repeat(40)}));
  t.mock.method(coverage, 'sourceHash', () => 'unit-source');
  t.mock.method(coverage, 'build', () => baseline);
  // De echte inventarisvalidator blijft actief en kan op subset en duplicatie zakken.
  assert.equal(baseline.logicalApps.length, contract.inventoryBaselines.logicalApps);
  return {model, baseline};
}

test('API accepteert alleen vaste poorten en geen groen-, scope-, klok- of reviewer-overrides', () => {
  for (const options of [{gate:'G0'}, {gate:'G5'}, {gate:'G1', proven:true},
    {gate:'G2', scope:[]}, {gate:'G3', reviewer:{type:'human'}},
    {gate:'G4', dependencies:{G3:'PROVEN'}}, {gate:'G1', now:0}, {gate:'G1', executions:{}}])
    assert.throws(() => gates.assess(root, options), /geen bewijs- of statusoverrides/);
  assert.throws(() => gates.assess(os.tmpdir(), {gate:'G1'}), /uitsluitend de gekoppelde repository/);
});

test('ontbrekende canonieke bron geeft expliciete blokkade en nooit lege groene verzameling', t => {
  t.mock.method(planning, 'load', () => { throw new Error('APPWERKT ontbreekt'); });
  const result = gates.assess(root, {gate:'G1'});
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.releaseAuthorized, false);
  assert.deepEqual(result.blockers, ['CANONICAL_SOURCE_UNAVAILABLE']);
});

test('groene planning en groen opgeslagen register bewijzen geen Experience-kwaliteit', t => {
  harness(t, model => {
    model.program.completed = true;
    model.experienceEvidence.status = 'PROVEN';
    model.experienceEvidence.summary = {logicalApps:{proven:114,total:114},screens:{proven:316,total:316}};
  });
  const result = gates.assess(root, {gate:'G1'});
  assert.equal(find(result, 'P0').status, 'PROVEN', 'uitsluitend de gemockte planningsvoorwaarde is groen');
  assert.equal(find(result, 'Experience').status, 'NOT_TESTED');
  assert.equal(find(result, 'human-quality').status, 'BLOCKED');
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.scope.functions.length, 12);
});

test('APPWERKT van een andere kandidaat blijft stale ondanks groene telling', t => {
  harness(t, model => {
    model.appEvidence.stempel = {commit:'b'.repeat(40), op:new Date().toISOString(), boomVuil:false};
    for (const row of model.appEvidence.regels) row.status = 'BEWEZEN';
  });
  assert.equal(find(gates.assess(root, {gate:'G1'}), 'APPWERKT').reason, 'APP_PROOF_CANDIDATE_MISMATCH');
});

test('referentiecohort met elf taken kan geen twaalf claimen', t => {
  harness(t, model => model.program.referenceCohort.pop());
  const result = gates.assess(root, {gate:'G1'});
  assert.equal(find(result, 'scope').status, 'BLOCKED');
  assert.equal(find(result, 'scope').requiredApps, 12);
  assert.equal(find(result, 'scope').apps, 11);
});

test('gekozen Mall-samenvoeging blijft ongekwalificeerd zolang de consolidatie openstaat', t => {
  const {model} = harness(t);
  const reference = find(gates.assess(root, {gate:'G1'}), 'ownership-decisions');
  assert.equal(reference.status, 'BLOCKED');
  assert.ok(reference.unresolved.some(item => item.screens.includes('apps/mall.html') && item.kind === 'CONSOLIDATION_REQUIRED'));
  const portfolio = find(gates.assess(root, {gate:'G2'}), 'ownership-decisions');
  assert.equal(portfolio.status, 'BLOCKED');
  assert.equal(portfolio.unresolved.length, model.owners.oordelen.filter(row => row.stand === 'open').length);
  assert.equal(portfolio.unresolved.length, 8);
  for (const item of portfolio.unresolved) assert.match(item.source, /^SCHERMEIGENAAR\.json#\/oordelen\/\d+$/);
  for (const route of ['apps/pulse.html', 'apps/sociaal.html', 'apps/mall.html']) {
    const besluit = portfolio.unresolved.find(item => item.screens.includes(route));
    assert.equal(besluit.kind, 'CONSOLIDATION_REQUIRED', 'productkeuze is gemaakt, uitvoering niet');
    assert.match(besluit.followUp, /Eigenaarskeuze 13 november 2026/);
  }
});

test('een nog niet gemaakt eigenaarsbesluit blijft herkenbaar en blokkeert eveneens', t => {
  harness(t, model => {
    const mall = model.owners.oordelen.find(row => row.stand === 'open' && row.schermen.includes('apps/mall.html'));
    mall.vervolg = 'Besluit nodig: kies eerst de productrichting.';
  });
  const reference = find(gates.assess(root, {gate:'G1'}), 'ownership-decisions');
  assert.equal(reference.status, 'BLOCKED');
  assert.ok(reference.unresolved.some(item => item.screens.includes('apps/mall.html') && item.kind === 'OWNER_DECISION_REQUIRED'));
});

test('uitsluitend opgelost eigenaarschap kan eigen poortvoorwaarde sluiten, niet productkwaliteit', t => {
  harness(t, model => { for (const row of model.owners.oordelen) if (row.stand === 'open') row.stand = 'uitgevoerd'; });
  const result = gates.assess(root, {gate:'G2'});
  assert.equal(find(result, 'ownership-decisions').status, 'PROVEN');
  assert.deepEqual(find(result, 'ownership-decisions').unresolved, []);
  assert.equal(result.status, 'BLOCKED');
});

test('ontbrekend of dubbel appbewijs wordt afgewezen voordat versheid wordt geloofd', t => {
  const {model} = harness(t);
  const id = model.program.referenceCohort[0].function;
  const original = model.appEvidence.regels.find(row => row.functie === id);
  model.appEvidence.regels = model.appEvidence.regels.filter(row => row.functie !== id);
  assert.equal(find(gates.assess(root, {gate:'G1'}), 'APPWERKT').reason, 'APP_PROOF_SCOPE_MISSING_OR_DUPLICATE');
  model.appEvidence.regels.push(original, original);
  assert.equal(find(gates.assess(root, {gate:'G1'}), 'APPWERKT').reason, 'APP_PROOF_SCOPE_MISSING_OR_DUPLICATE');
});

test('portfolio kan niet alleen referenties of een schermsubset kwalificeren', t => {
  const {baseline} = harness(t);
  baseline.screens.pop();
  const result = gates.assess(root, {gate:'G2'});
  assert.equal(find(result, 'scope').status, 'BLOCKED');
  assert.equal(result.dependencies[0].checks.find(item => item.id === 'inventory').status, 'BLOCKED');
  assert.equal(result.scope.functions.length, 114);
  assert.equal(result.scope.screens.length, 315);
});

test('onafhankelijke kwalificatie herbeoordeelt alle voorlopers en vereist twee volledige runs', t => {
  harness(t);
  const result = gates.assess(root, {gate:'G3'});
  assert.deepEqual(result.dependencies.map(item => item.gate), ['G1','G2']);
  assert.equal(find(result, 'dependency:G2').status, 'BLOCKED');
  const independent = find(result, 'independent-evidence-builds');
  assert.equal(independent.required, 2);
  assert.equal(independent.proven, 0);
  assert.equal(independent.status, 'NOT_TESTED');
  assert.equal(find(result, 'external-qualification').status, 'BLOCKED');
});

test('productiepoort kan de drie eerdere poorten niet overslaan en schrijft niets', t => {
  harness(t);
  const writes = t.mock.method(fs, 'writeFileSync', () => { throw new Error('Poort mag niets schrijven'); });
  const result = gates.assess(root, {gate:'G4'});
  assert.deepEqual(result.dependencies.map(item => item.gate), ['G1','G2','G3']);
  assert.equal(find(result, 'dependency:G3').status, 'BLOCKED');
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.releaseAuthorized, false);
  assert.equal(writes.mock.callCount(), 0);
});

test('bronwijziging tijdens beoordeling maakt ook een schone beginmeting stale', t => {
  harness(t);
  let calls = 0;
  t.mock.method(evidence, 'candidate', () => ({ok:true, commit:(calls++ ? 'b' : 'a').repeat(40)}));
  const result = gates.assess(root, {gate:'G1'});
  assert.equal(find(result, 'stable-candidate').status, 'STALE');
});

function importedRun(f, change = {}) {
  return {record:{version:1, runId:'local-record', test:'test/sample.js', at:new Date().toISOString(),
    sourceHash:evidence.fingerprint(f.root), commit:'candidate', worktreeDirty:false,
    passed:true, exitCode:0, tests:1, skipped:0, logHash:'hash', ...change},
  coverage:{runId:'local-record', records:[f.record]}};
}

test('correcte artefactbytes zijn zichtbaar als integriteit maar import wordt geen uitvoering', t => {
  const f = fixture(t), result = gates.inspectExecution(f.root, importedRun(f), 'source', 'candidate');
  assert.equal(result.records.length, 0);
  assert.equal(result.checks[0].integrity, 'VALID');
  assert.equal(result.checks[0].reason, 'AUTHORITATIVE_EXECUTION_RECEIPT_MISSING');
});

test('verlopen, verkeerde kandidaat en veranderde bron leveren geen uitvoeringsbijdrage', t => {
  const f = fixture(t);
  for (const patch of [{at:new Date(Date.now() - 86400001).toISOString()}, {commit:'other'}, {sourceHash:'other'}]) {
    const result = gates.inspectExecution(f.root, importedRun(f, patch), 'source', 'candidate');
    assert.equal(result.records.length, 0);
    assert.equal(result.checks[0].status, 'STALE');
  }
});

test('zelf ingevulde menselijke reviewer omzeilt bestaande human-quality-verifier niet', t => {
  const f = fixture(t);
  f.record = {...f.record, dimension:'human-quality', reviewer:{type:'human', name:'Zelf benoemd', independent:true}, status:'PROVEN'};
  const result = gates.inspectExecution(f.root, importedRun(f), 'source', 'candidate');
  assert.equal(result.records.length, 0);
  assert.equal(result.checks[0].integrity, 'BLOCKED');
  assert.equal(result.checks[0].status, 'BLOCKED');
});

test('bestaande uitvoerder kan een echte procesgebonden deelcel bijdragen zonder scherm vrij te geven', t => {
  const cp = require('node:child_process');
  const execution = require('../scripts/lib/experience/execution');
  const artifact = require('../scripts/lib/experience/artifact');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-next-gate-unit-'));
  t.after(() => fs.rmSync(temporary, {recursive:true, force:true}));
  const put = (name, data) => { const file = path.join(temporary, name); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, data); };
  const contract = structuredClone(require('../experience-architecture/coverage-contract.json'));
  const binding = contract.executedProofs[0]; contract.executedProofs = [binding];
  put('experience-architecture/coverage-contract.json', JSON.stringify(contract));
  put('experience-architecture/signatures.json', '{"version":1,"apps":{},"screens":{}}');
  put(binding.instrument, '// Alleen protocolfixture\n');
  t.mock.method(evidence, 'candidate', () => ({ok:true, commit:'candidate'}));
  t.mock.method(cp, 'spawnSync', (bin, args, options) => {
    const configuration = {...binding.configuration, browserVersion:'145.0.1.2'};
    const observation = {version:1, instrument:binding.instrument, subjectType:binding.subjectType,
      subjectId:binding.subjectId, dimension:binding.dimension, requirement:binding.requirement,
      sourceHash:options.env.RTG_EXPERIENCE_SOURCE, commit:'candidate',
      configurationHash:evidence.sha(JSON.stringify(artifact.stable(configuration))), method:binding.method,
      checks:[{id:binding.check, observed:binding.expected, expected:binding.expected, passed:true}], result:'passed'};
    return {status:0, stderr:'', stdout:'ok 1 - ' + binding.check + '\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n' +
      '# RTG_EXPERIENCE_CONFIGURATION ' + JSON.stringify(configuration) + '\n' +
      '# RTG_EXPERIENCE_OBSERVATION ' + JSON.stringify(observation) + '\n'};
  });
  const run = execution.execute(temporary, {id:'hotels-destination', test:binding.instrument});
  assert.equal(run.coverage.records.length, 1);
  const result = gates.inspectExecution(temporary, run, run.coverage.records[0].sourceHash, 'candidate');
  assert.equal(result.records.length, 1);
  assert.equal(result.checks[0].scopedStatus, 'PROVEN_IN_SCOPE');
  assert.equal(result.checks[0].status, 'BLOCKED', 'een deelcel blijft onvolledige configuratiedekking');
  const clone = gates.inspectExecution(temporary, structuredClone(run), run.coverage.records[0].sourceHash, 'candidate');
  assert.equal(clone.records.length, 0);
  assert.equal(clone.checks[0].reason, 'AUTHORITATIVE_EXECUTION_RECEIPT_MISSING');
});
