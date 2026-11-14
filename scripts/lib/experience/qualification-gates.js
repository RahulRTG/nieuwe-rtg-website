/* RTG NEXT: vier beslispoorten als lezers van bestaande bewijsvoorzieningen.
   Geen register, proefuitvoerder of productiehandeling. Een planning, lokaal
   groen veld of reviewer-naam verkrijgt hier geen bewijsgezag. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const evidence = require('./evidence'), coverage = require('./coverage');
const artifact = require('./artifact'), execution = require('./execution');
const ROOT = path.resolve(__dirname, '../../..');
const GATES = Object.freeze(['G1', 'G2', 'G3', 'G4']);
const json = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const check = (id, status, reason, details = {}) => ({id, status, reason, ...details});
const complete = rows => rows.length > 0 && rows.every(row => row.signature.status === 'DECLARED' &&
  row.dimensions.some(dimension => dimension.applicable) &&
  row.dimensions.filter(dimension => dimension.applicable).every(dimension => dimension.status === 'PROVEN'));

function measuredAncestor(root, short, expected) {
  if (!/^[a-f0-9]{7,64}$/i.test(short || '') || !/^[a-f0-9]{40,64}$/i.test(expected || '')) return null;
  try {
    const options = {cwd:root, encoding:'utf8', stdio:['ignore', 'pipe', 'ignore']};
    const measured = cp.execFileSync('git', ['rev-parse', '--verify', short + '^{commit}'], options).trim();
    cp.execFileSync('git', ['merge-base', '--is-ancestor', measured, expected], options);
    return measured;
  } catch (_) { return null; }
}

function planningCommitted(root) {
  try {
    return cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--',
      'docs/rtg-next', 'docs/rtg-premium-afbouwplan.md', 'AFBOUWPROGRAMMA.md'],
    {cwd:root, encoding:'utf8', stdio:['ignore', 'pipe', 'ignore']}).trim() === '';
  } catch (_) { return false; }
}

/* Deze lage-niveaulezer kan alleen bijdragen teruggeven. Zelfs een correct
   lokaal bestand is zonder de bestaande WeakMap-procesreceipt geen uitvoering.
   Geen injectable verifier, klok, reviewer, boolean of scope-override. */
function inspectExecution(root, run, sourceHash, commit) {
  const records = [], checks = [], record = run && run.record;
  const state = evidence.state(record, evidence.fingerprint(root), record?.test, Date.now(), commit);
  if (state !== 'PROVEN') return {records, checks:[check('execution', state, 'EXECUTION_NOT_CURRENT')]};
  if (!Array.isArray(run.coverage?.records) || !run.coverage.records.length)
    return {records, checks:[check('execution', 'NOT_TESTED', 'NO_TYPED_EXECUTION_RECORDS')]};
  for (const item of run.coverage.records) {
    const receipt = execution.scoped(item, root);
    const assessment = artifact.assessment(item, sourceHash, commit, item.dimension, {
      root, subjectType:item.subjectType, subjectId:item.subjectId,
      requirement:item.requirement, configurationHash:item.configurationHash
    });
    const owned = !!receipt && receipt.runId === record.runId &&
      receipt.runId === run.coverage.runId && item.commit === commit;
    checks.push(check('execution:' + item.subjectId + ':' + item.dimension + ':' + item.requirement,
      owned ? assessment.status : 'BLOCKED', owned ? assessment.reason : 'AUTHORITATIVE_EXECUTION_RECEIPT_MISSING',
      {integrity:assessment.integrity, ...(owned && assessment.scopedStatus ? {scopedStatus:assessment.scopedStatus, scope:receipt} : {})}));
    if (owned && assessment.integrity === 'VALID') records.push(item);
  }
  return {records, checks};
}

function appProof(root, model, functions, commit) {
  const register = model.appEvidence, stamp = register?.stempel;
  const at = Date.parse(stamp?.op), now = Date.now();
  if (!(functions instanceof Set) || !functions.size || !Array.isArray(register?.regels))
    return check('APPWERKT', 'BLOCKED', 'APP_PROOF_SCOPE_MISSING_OR_DUPLICATE');
  const rows = (register?.regels || []).filter(row => functions.has(row.functie));
  if (rows.length !== functions.size || new Set(rows.map(row => row.functie)).size !== rows.length)
    return check('APPWERKT', 'BLOCKED', 'APP_PROOF_SCOPE_MISSING_OR_DUPLICATE');
  const commits = new Map(), ancestor = id => {
    if (!commits.has(id)) commits.set(id, measuredAncestor(root, id, commit));
    return commits.get(id);
  };
  const measuredCommit = ancestor(stamp?.commit);
  if (!measuredCommit) return check('APPWERKT', 'STALE', 'APP_PROOF_CANDIDATE_MISMATCH');
  if (!Number.isFinite(at) || at > now || stamp?.boomVuil !== false)
    return check('APPWERKT', 'BLOCKED', 'APP_PROOF_STAMP_INVALID');
  if (now - at > 86400000) return check('APPWERKT', 'STALE', 'APP_PROOF_OLDER_THAN_24H');
  if (stamp.node !== process.version) return check('APPWERKT', 'STALE', 'APP_PROOF_RUNTIME_MISMATCH');
  const names = require('../appcontract').BEWIJZEN;
  let fresh;
  try {
    const R = require('../bewijsraakvlak'), paired = json(root, 'APPWERKT-RAAKVLAK.json');
    // De oude ingebedde-hashesvariant omzeilt de koppeling aan het tweede
    // canonieke bestand. Een NEXT-poort vereist het gecontroleerde meetpaar.
    if (register.raakvlak?.register !== R.REGISTER || register.raakvlak?.hashes ||
        !R.hashesVoor(register, paired).hashes)
      return check('APPWERKT', 'BLOCKED', 'APP_PROOF_CANONICAL_PAIR_INVALID');
    fresh = require('../../appwerkt-vers').beoordeel(register, {
      wortel:root, raakvlakRegister:paired,
      grof:() => ({vers:false, reden:'Onbepaald raakvlak is geen kandidaatbinding'})
    });
  } catch (error) { return check('APPWERKT', 'BLOCKED', 'APP_PROOF_FRESHNESS_UNAVAILABLE', {detail:error.message}); }
  const incomplete = rows.filter(row => row.status !== 'BEWEZEN' || names.some(name => {
    const proof = row.bewijzen?.[name], records = proof?.raakvlak;
    const current = fresh.rijen.find(entry => entry.functie === row.functie)?.bewijzen?.[name];
    return proof?.status !== 'BEWEZEN' || !Array.isArray(records) || !records.length ||
      records.some(record => !record || !ancestor(record.commit) ||
        (record.bronnen !== undefined && (!Array.isArray(record.bronnen) ||
          record.bronnen.some(source => !ancestor(source?.stempel?.commit))))) ||
      current?.stand !== 'VERS' || current.vers !== true;
  }));
  return check('APPWERKT', incomplete.length ? 'NOT_TESTED' : 'PROVEN',
    incomplete.length ? 'EIGHT_APP_PROOFS_NOT_CURRENT_AND_COMPLETE' : 'CANONICAL_APP_PROOFS_CURRENT',
    {required:functions.size, proven:functions.size - incomplete.length, incomplete:incomplete.map(row => row.functie),
      measuredCommit, candidateCommit:commit, binding:'SCOPED_SOURCE_EQUIVALENCE'});
}

/* Read-only bijdrage, geen releasepoort: leest uitsluitend het echte meetpaar.
   Meetcommit A blijft A wanneer een bewijscommit B dezelfde gemeten bron heeft.
   Ook bij rechtstreeks gebruik zijn een lege scope en een vuile boom ongeldig. */
function inspectAppProof(root, functions, commit) {
  try {
    const before = evidence.candidate(root), source = evidence.fingerprint(root);
    if (!before.ok || before.commit !== commit)
      return check('APPWERKT', 'BLOCKED', 'APP_PROOF_CANDIDATE_NOT_CLEAN');
    const result = appProof(root, {appEvidence:json(root, 'APPWERKT.json')}, functions, commit);
    const after = evidence.candidate(root);
    if (!after.ok || after.commit !== commit || evidence.fingerprint(root) !== source)
      return check('APPWERKT', 'STALE', 'APP_PROOF_CANDIDATE_CHANGED');
    return result;
  } catch (error) { return check('APPWERKT', 'BLOCKED', 'APP_PROOF_SOURCE_UNAVAILABLE', {detail:error.message}); }
}

function scopeFor(model, report, reference, planning) {
  const functions = new Set((reference ? model.program.referenceCohort : model.inventory).map(row => row.function));
  const apps = report.logicalApps.filter(row => functions.has(row.function));
  const selectedScreens = new Set(apps.flatMap(row => row.screenIds));
  if (reference) for (const row of planning.screenAssignments(model)) {
    if ((row.functions || []).some(id => functions.has(id))) selectedScreens.add(row.id);
  }
  const screens = reference ? report.screens.filter(row => selectedScreens.has(row.id)) : report.screens;
  return {functions, apps, screens};
}

function ownershipDecisions(model, scope, planning) {
  if (!Array.isArray(model.owners?.oordelen))
    return check('ownership-decisions', 'BLOCKED', 'CANONICAL_OWNERSHIP_DECISIONS_MISSING');
  const normalize = route => String(route || '').replace(/^\//, '');
  const routes = new Set(scope.screens.flatMap(screen => [normalize(screen.route),
    ...planning.screenOwners(model, {entry:screen.route}).map(owner => normalize(owner.canonical))]));
  const unresolved = model.owners.oordelen.map((decision, index) => ({decision, index}))
    .filter(({decision}) => !['blijft', 'uitgevoerd'].includes(decision.stand) &&
      (!Array.isArray(decision.schermen) || !decision.schermen.length || decision.schermen.some(route => routes.has(normalize(route)))))
    .map(({decision, index}) => ({source:'SCHERMEIGENAAR.json#/oordelen/' + index,
      screens:decision.schermen, status:decision.stand || 'UNKNOWN', owner:decision.eigenaar,
      kind:/^Besluit nodig:/.test(decision.vervolg || '') ? 'OWNER_DECISION_REQUIRED' : 'CONSOLIDATION_REQUIRED',
      reason:decision.reden, followUp:decision.vervolg}));
  return check('ownership-decisions', unresolved.length ? 'BLOCKED' : 'PROVEN',
    unresolved.length ? 'OPEN_OWNERSHIP_OR_CONSOLIDATION_WITHIN_GATE_SCOPE' : 'NO_OPEN_OWNERSHIP_DECISIONS_IN_SCOPE',
    {source:'SCHERMEIGENAAR.json#/oordelen', unresolved});
}

function assess(root = ROOT, options = {}) {
  if (path.resolve(root) !== ROOT) throw new Error('RTG NEXT-poort gebruikt uitsluitend de gekoppelde repository; geen alternatieve catalogus.');
  if (!options || Object.keys(options).some(key => !['gate', 'executions'].includes(key)) ||
      !GATES.includes(options.gate) || (options.executions !== undefined && !Array.isArray(options.executions)))
    throw new Error('Gebruik assess(root, {gate: G1..G4, executions?: bestaande execute-uitkomsten}); geen bewijs- of statusoverrides.');
  const through = GATES.indexOf(options.gate), checks = [], results = [];
  const before = evidence.candidate(root);
  const planning = require('../../rtg-next-programma'); // lazy: CLI roept deze lezer aan
  let model, contract, signatures, source, report, planningResult;
  try {
    model = planning.load(); planningResult = planning.report(model);
    contract = json(root, 'experience-architecture/coverage-contract.json');
    signatures = json(root, 'experience-architecture/signatures.json');
    source = coverage.sourceHash(root, contract, signatures);
  } catch (error) {
    return {gate:options.gate, status:'BLOCKED', releaseAuthorized:false, candidateCommit:before.commit || null,
      checks:[check('sources', 'BLOCKED', 'CANONICAL_SOURCE_UNAVAILABLE', {detail:error.message})],
      blockers:['CANONICAL_SOURCE_UNAVAILABLE'], dependencies:[], limits:['Geen bewijs- of productiestatus gewijzigd.']};
  }
  checks.push(check('candidate', before.ok ? 'PROVEN' : 'BLOCKED', before.ok ? 'CLEAN_CANDIDATE' : before.reason));
  checks.push(check('committed-scope', planningCommitted(root) ? 'PROVEN' : 'BLOCKED', 'PLANNING_SCOPE_MUST_BELONG_TO_CANDIDATE'));
  checks.push(check('P0', !planningResult.errors.length && planningResult.buildReadiness?.status === 'READY_TO_BUILD' ? 'PROVEN' : 'BLOCKED',
    'PLANNING_IS_BUILD_PRECONDITION_ONLY', {errors:planningResult.errors, blockers:planningResult.buildReadiness?.blockers || []}));
  const contributions = (options.executions || []).map(run => inspectExecution(root, run, source, before.commit));
  const records = contributions.flatMap(item => item.records);
  report = coverage.build(root, {contract, signatures, commit:before.commit, evidence:{version:1, records}});
  const errors = coverage.validate(root, report, contract, signatures);
  checks.push(check('inventory', errors.length ? 'BLOCKED' : 'PROVEN', 'LIVE_CANONICAL_INVENTORY', {errors}));
  const finalCandidate = evidence.candidate(root);
  checks.push(check('stable-candidate', finalCandidate.ok && finalCandidate.commit === before.commit &&
    coverage.sourceHash(root, contract, signatures) === source ? 'PROVEN' : 'STALE', 'SOURCE_AND_COMMIT_RECHECKED'));
  for (let index = 0; index <= through; index++) {
    const gate = GATES[index], scope = scopeFor(model, report, index === 0, planning);
    const local = index === 0 ? [...checks] : [check('dependency:' + GATES[index - 1],
      results[index - 1].status, 'PREVIOUS_GATE_REASSESSED')];
    if (index <= 1) {
      const expected = index === 0 ? 12 : model.inventory.length;
      local.push(check('scope', scope.functions.size === expected && scope.apps.length === expected && scope.screens.length > 0 &&
        (index === 0 || scope.screens.length === model.screens.length) ? 'PROVEN' : 'BLOCKED', 'FULL_REQUIRED_SCOPE',
        {requiredApps:expected, apps:scope.apps.length, screens:scope.screens.length}));
      local.push(ownershipDecisions(model, scope, planning));
      local.push(appProof(root, model, scope.functions, before.commit));
      local.push(check('Experience', complete(scope.apps) && complete(scope.screens) ? 'PROVEN' : 'NOT_TESTED',
        'REBUILT_FROM_TYPED_EXECUTION_NOT_STORED_GREEN_FIELDS',
        {apps:{required:scope.apps.length, proven:scope.apps.filter(row => complete([row])).length},
          screens:{required:scope.screens.length, proven:scope.screens.filter(row => complete([row])).length}}));
      const premium = require('./qualification-planning').premiumExperienceAssessment(contract,[...scope.apps,...scope.screens]);
      local.push(check('PremiumExperience', premium.status, 'ALL_FIVE_EXPERIENCE_QUESTIONS_REQUIRE_SCOPED_HUMAN_AND_TASK_PROOF',
        {checks:premium.checks,excludedRedirects:premium.excludedRedirects}));
      const human = [...scope.apps, ...scope.screens].flatMap(row => row.dimensions)
        .filter(dimension => dimension.id === 'human-quality' && dimension.applicable);
      local.push(check('human-quality', human.length > 0 && human.every(row => row.status === 'PROVEN') ? 'PROVEN' : 'BLOCKED',
        'AUTHORITATIVE_HUMAN_CONFIRMATION_REQUIRED_BY_EXISTING_ARTIFACT_VERIFIER'));
    }
    if (index === 2) {
      for (const required of contract.release.requiredQualificationGates) {
        const measured = report.releaseReadiness.qualificationGates.find(item => item.id === required.id);
        local.push(check(required.id, measured?.status || 'NOT_TESTED', required.requires));
      }
      const fullRuns = new Set();
      for (let run = 0; run < contributions.length; run++) {
        const own = contributions[run].records;
        if (!own.length) continue;
        const one = coverage.build(root, {contract, signatures, commit:before.commit, evidence:{version:1, records:own}});
        if (complete(one.logicalApps) && complete(one.screens)) fullRuns.add(options.executions[run].record.runId);
      }
      local.push(check('independent-evidence-builds', fullRuns.size >= contract.release.independentQualificationRunsRequired ? 'PROVEN' : 'NOT_TESTED',
        'INDEPENDENT_FULL_SCOPE_EXECUTIONS_SAME_CANDIDATE', {required:contract.release.independentQualificationRunsRequired, proven:fullRuns.size}));
      const external = require('../../../server/config/external-release').controleerReleaseRoot(root, before.commit);
      local.push(check('external-qualification', external.ok ? 'PROVEN' : 'BLOCKED', external.reden,
        {source:'server/config/external-release.js'}));
    }
    if (index === 3) {
      try {
        const stored = json(root, '.release/productie-status.json');
        const current = require('../../productie-status').maak(root, stored.artifactSoort || 'oci');
        // Een beperkte V1-release mag geen volle RTG NEXT-productieclaim worden.
        local.push(check('production-status', current.PRODUCTION_STATUS === 'READY' && current.commit === before.commit ? 'PROVEN' : 'BLOCKED',
          'EXISTING_PRODUCTION_ASSESSOR', {source:'scripts/productie-status.js', blockers:current.blokkades}));
        const approved = require('../productie-promotie').controleer(root, before.commit);
        local.push(check('owner-go-no-go', approved.productieStand === 'READY' ? 'PROVEN' : 'BLOCKED',
          'SIGNED_EXISTING_PROMOTION_DECISION', {source:'scripts/lib/productie-promotie.js'}));
      } catch (error) { local.push(check('production', 'BLOCKED', 'PRODUCTION_OR_SIGNED_OWNER_DECISION_MISSING', {detail:error.message})); }
    }
    const blockers = local.filter(item => item.status !== 'PROVEN').map(item => item.id + ':' + item.reason);
    results.push({gate, status:blockers.length ? 'BLOCKED' : 'PROVEN',
      scope:{functions:[...scope.functions], screens:scope.screens.map(row => row.id)}, checks:local, blockers});
  }
  const selected = results[through];
  // Ook de mogelijk tragere externe- en productiecontrole mag geen wijzigingen
  // tussen het eerste lezen en het laatste oordeel ongemerkt passeren.
  const last = evidence.candidate(root);
  if (!last.ok || last.commit !== before.commit || coverage.sourceHash(root, contract, signatures) !== source || !planningCommitted(root)) {
    selected.checks.push(check('final-candidate', 'STALE', 'CANDIDATE_CHANGED_OR_UNCOMMITTED_SCOPE'));
    selected.blockers.push('final-candidate:CANDIDATE_CHANGED_OR_UNCOMMITTED_SCOPE');
    selected.status = 'BLOCKED';
  }
  return {...selected, candidateCommit:before.commit || null, sourceHash:source, releaseAuthorized:false,
    dependencies:results.slice(0, through), executionContributions:contributions.flatMap(item => item.checks),
    limits:['Dit is een read-only poortoordeel; geen productiepromotie of releasehandeling.',
      'Geïmporteerde groene velden en zelfbenoemde menselijke reviewers worden niet vertrouwd.',
      'De bestaande Experience-laag heeft nog geen autoritatieve menselijke ontvangstcontrole; die ontbrekende koppeling blijft blokkerend.']};
}

module.exports = {assess, inspectExecution, inspectAppProof, GATES};
