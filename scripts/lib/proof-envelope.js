'use strict';

/* De Proof Envelope is geen register en bezit geen productwaarheid. Hij is een
   vluchtige, alleen-lezende projectie over de bestaande Code Architect,
   eigenaarschapregisters, Git-werkbomen en een optionele PR-snapshot. De AI
   stelt de taak vast; deze module rekent deterministisch uit of de beschikbare
   context voldoende is. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { performance } = require('node:perf_hooks');
const Architect = require('./codearchitect');

const FORMAT = 'rtg-proof-envelope-v1';
const CONTRACT_VERSION = 1;
const STATUSES = new Set(['VALID', 'INSUFFICIENT_CONTEXT', 'CONFLICT']);
const RISKS = new Set(['low', 'medium', 'high', 'critical']);
const FULL_GATES = [
  'bestaande verplichte CI op de definitieve commit',
  'geldige APPWERKT- en EXPERIENCEWERKT-herkwalificatie voor geraakte onderdelen'
];

function git(root, args, fallback = null) {
  try {
    return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
  } catch (_) { return fallback; }
}

function gitRaw(root, args, fallback = null) {
  try {
    return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  } catch (_) { return fallback; }
}

function json(root, file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (_) { return null; }
}

function normalizeFile(root, file) {
  const absolute = path.resolve(root, String(file || ''));
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  return relative;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

function parsePorcelain(text) {
  return String(text || '').split('\n').filter(Boolean).map(line => line.length > 3 ? line.slice(3) : line).map(line => {
    const arrow = line.indexOf(' -> ');
    return arrow >= 0 ? line.slice(arrow + 4) : line;
  });
}

function parseWorktrees(text) {
  const records = [];
  let current = null;
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) records.push(current);
      current = { path: line.slice(9), prunable: false };
    } else if (current && line.startsWith('HEAD ')) current.head = line.slice(5);
    else if (current && line.startsWith('branch ')) current.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (current && line === 'detached') current.detached = true;
    else if (current && line.startsWith('prunable')) current.prunable = true;
  }
  if (current) records.push(current);
  return records;
}

function literalVariants(file) {
  const withoutPublic = file.replace(/^public\//, '');
  return unique([file, withoutPublic, '/' + withoutPublic, './' + path.posix.basename(file)]);
}

function grepTracked(root, area, needles) {
  const usable = unique(needles).filter(needle => needle.length > 2).slice(0, 240);
  if (!usable.length) return [];
  const args = ['grep', '-Il', '-F'];
  for (const needle of usable) args.push('-e', needle);
  args.push('--', area);
  return String(git(root, args, '') || '').split('\n').filter(Boolean);
}

/* Browserimports staan niet altijd in de CommonJS-graaf. Deze begrensde
   aanvulling volgt alleen letterlijke paden die werkelijk in getrackte bron
   staan. Hij pretendeert geen complete runtimegraaf te zijn en houdt daarom
   de kennisgaten van de Architect intact. */
function runtimeReferences(root, seeds, options = {}) {
  /* Een zelfstandig appscherm is zelf de eigenaar; wie ernaartoe linkt is
     geen afhankelijkheid van een wijziging BINNEN dat scherm. Alleen gedeelde
     uitvoeringslagen worden omhoog gevolgd naar hun gebruikers. */
  if (seeds.every(file => /^public\/apps\/.*\.html$/.test(file)))
    return { files: [...seeds].sort(), capped: false };
  const maxDepth = options.maxDepth || 4;
  const maxFiles = options.maxFiles || 500;
  const found = new Set(seeds);
  let frontier = [...seeds];
  let capped = false;
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const needles = unique(frontier.flatMap(literalVariants));
    const next = [];
    for (const candidate of grepTracked(root, 'public', needles)) {
      if (found.has(candidate)) continue;
      found.add(candidate);
      next.push(candidate);
      if (found.size >= maxFiles) { capped = true; break; }
    }
    /* Een gevonden appscherm is een geraakte eindbestemming. Het opnieuw
       omhoog volgen van links NAAR dat scherm zou navigatie met afhankelijkheid
       verwarren en de hele appcatalogus ten onrechte meenemen. */
    frontier = next.filter(file => /^public\/(?:shared|ds)\//.test(file));
    if (capped) break;
  }
  return { files: [...found].sort(), capped };
}

function ownersFor(root, files) {
  const register = json(root, 'SCHERMEIGENAAR.json');
  const screens = register && register.schermen || {};
  const rows = [];
  for (const file of files) {
    const key = file.replace(/^public\//, '');
    if (!screens[key]) continue;
    rows.push({ screen: key, capability: screens[key].capability, role: screens[key].rol,
      source: 'SCHERMEIGENAAR.json' });
  }
  return rows.sort((a, b) => a.screen.localeCompare(b.screen));
}

function testsFor(root, files, seeds) {
  const relevantSources = unique((seeds || []).concat(files.filter(file => !/\.html$/.test(file)).slice(0, 40)));
  const variants = unique(relevantSources.flatMap(literalVariants));
  const referenced = grepTracked(root, 'test', variants);
  const cochanged = new Set();
  const broadHistoryCommits = [];
  for (const source of (seeds || files).slice(0, 25)) {
    const commits = git(root, ['log', '--no-merges', '--format=%H', '-n', '8', '--', source], '');
    for (const commit of String(commits || '').split('\n').filter(Boolean)) {
      const names = git(root, ['show', '--pretty=format:', '--name-only', commit], '');
      const changed = String(names || '').split('\n').filter(Boolean);
      if (changed.length > 100) { broadHistoryCommits.push(commit); continue; }
      for (const name of changed) if (/^test\/.*\.(?:js|cjs|mjs)$/.test(name)) cochanged.add(name);
    }
  }
  return {
    directlyReferenced: unique(referenced),
    regressionHistory: unique([...cochanged].filter(file => !referenced.includes(file))),
    broadHistoryCommits: unique(broadHistoryCommits)
  };
}

function worktreeConflicts(root, allowed, base, currentBranch) {
  const current = fs.realpathSync(root);
  const trees = parseWorktrees(git(root, ['worktree', 'list', '--porcelain'], ''));
  const checked = [];
  const conflicts = [];
  for (const tree of trees) {
    if (tree.prunable || !tree.path || !fs.existsSync(tree.path)) continue;
    let real;
    try { real = fs.realpathSync(tree.path); } catch (_) { continue; }
    if (real === current) continue;
    const changed = parsePorcelain(gitRaw(tree.path, ['status', '--porcelain=v1'], ''));
    let committed = [];
    if (tree.branch && tree.branch !== currentBranch && !/^(?:main|master)$/.test(tree.branch) && tree.head && base) {
      const mergeBase = git(root, ['merge-base', base, tree.head], null);
      if (mergeBase) committed = String(git(root, ['diff', '--name-only', mergeBase + '..' + tree.head], '') || '').split('\n').filter(Boolean);
    }
    checked.push({ path: tree.path, branch: tree.branch || null, head: tree.head || null,
      changedFiles: changed, committedFilesSinceCommonBase: committed });
    const overlap = unique(changed.concat(committed).filter(file => allowed.includes(file)));
    if (overlap.length) conflicts.push({ type: 'worktree', path: tree.path, branch: tree.branch || null, files: overlap,
      sources: { uncommitted: changed.filter(file => overlap.includes(file)), committed: committed.filter(file => overlap.includes(file)) } });
  }
  return { checked, conflicts };
}

function pullRequestConflicts(root, snapshotFile, allowed, now) {
  if (!snapshotFile) return { status: 'UNKNOWN', reason: 'geen commitgebonden PR-snapshot meegegeven', conflicts: [] };
  const inMemory = typeof snapshotFile === 'object';
  let file = null;
  if (!inMemory) {
    const candidate = path.resolve(root, String(snapshotFile));
    const inRepository = !path.relative(root, candidate).startsWith('../') && !path.isAbsolute(path.relative(root, candidate));
    const temporaryRoot = fs.realpathSync(os.tmpdir());
    let realCandidate = candidate;
    try { realCandidate = fs.realpathSync(candidate); } catch (_) {}
    const inTemporaryDirectory = realCandidate === temporaryRoot || realCandidate.startsWith(temporaryRoot + path.sep);
    if (inRepository || inTemporaryDirectory) file = candidate;
  }
  let snapshot = null;
  if (inMemory) snapshot = snapshotFile;
  else if (file) {
    try { snapshot = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  }
  if (!snapshot || !Array.isArray(snapshot.pullRequests) || !snapshot.capturedAt)
    return { status: 'UNKNOWN', reason: 'PR-snapshot ontbreekt of heeft niet het verwachte contract', conflicts: [] };
  const ageMs = now - Date.parse(snapshot.capturedAt);
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 15 * 60 * 1000;
  const conflicts = [];
  for (const pr of snapshot.pullRequests) {
    const overlap = unique((pr.files || []).map(file => normalizeFile(root, file)).filter(file => file && allowed.includes(file)));
    if (overlap.length) conflicts.push({ type: 'pull-request', number: pr.number, branch: pr.branch || null, head: pr.head || null, files: overlap });
  }
  return { status: fresh ? 'CURRENT' : 'STALE', capturedAt: snapshot.capturedAt, ageMs,
    source: inMemory ? 'supplied-snapshot' : file, conflicts,
    ...(fresh ? {} : { reason: 'PR-snapshot is ouder dan vijftien minuten of heeft een ongeldige tijd' }) };
}

function riskFor(files) {
  if (files.some(file => /(?:pay|bank|wallet|auth|gezag|autorisa|betaling|servicefee)/i.test(file))) return 'critical';
  if (files.some(file => /^(?:server\/kern|public\/(?:shared|ds)|\.github\/workflows)\//.test(file) ||
    /^(?:package(?:-lock)?\.json|Dockerfile)$/.test(file))) return 'high';
  if (files.some(file => /^(?:server|public)\//.test(file))) return 'medium';
  return 'low';
}

function evidenceState(root, head, screens) {
  const plan = json(root, '.evidence/plan.json');
  const planTracked = git(root, ['ls-files', '--error-unmatch', '.evidence/plan.json'], null) !== null;
  return {
    plan: !plan ? { status: 'MISSING' } : {
      status: 'PRESENT_UNVERIFIED', format: plan.formaat || null, basis: plan.basis || null,
      mode: plan.mode || null, reliable: plan.betrouwbaar === true,
      reason: 'de preflight leest het bestaande plan maar vernieuwt of promoveert geen bewijs'
    },
    planTracked,
    commit: head,
    affectedScreens: { count: screens.length, source: 'context.screens' },
    policy: 'geraakte APPWERKT- en EXPERIENCEWERKT-bewijzen blijven ongeldig of te herkwalificeren tot hun bestaande motor ze vernieuwt'
  };
}

function validateEnvelope(envelope, options = {}) {
  const errors = [];
  const warnings = [];
  const required = ['format', 'contractVersion', 'task', 'git', 'scope', 'context', 'tests', 'evidence', 'conflicts', 'validity'];
  for (const key of required) if (!envelope || envelope[key] == null) errors.push('missing:' + key);
  if (!envelope || envelope.format !== FORMAT) errors.push('format');
  if (!envelope || envelope.contractVersion !== CONTRACT_VERSION) errors.push('contractVersion');
  if (!envelope || !envelope.task || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/.test(String(envelope.task.id || ''))) errors.push('task.id');
  if (!envelope || !envelope.task || !String(envelope.task.agent || '').trim()) errors.push('task.agent');
  if (!envelope || !envelope.task || !Architect.TAAKKLASSEN[envelope.task.class]) errors.push('task.class');
  if (!envelope || !envelope.task || !RISKS.has(envelope.task.risk)) errors.push('task.risk');
  if (envelope && envelope.task && envelope.task.budget) {
    for (const [name, value] of Object.entries(envelope.task.budget))
      if (value !== null && (!Number.isFinite(value) || value < 0)) errors.push('task.budget.' + name);
  }
  if (!envelope || !envelope.git || !/^[0-9a-f]{40}$/.test(String(envelope.git.headCommit || ''))) errors.push('git.headCommit');
  if (!envelope || !envelope.git || !/^[0-9a-f]{40}$/.test(String(envelope.git.baseCommit || ''))) errors.push('git.baseCommit');
  if (envelope && envelope.git && envelope.git.baseCommit !== envelope.git.headCommit) errors.push('git.baseCommit-not-head');
  if (options.currentHead && envelope && envelope.git && envelope.git.headCommit !== options.currentHead) errors.push('git.commitbinding');
  if (!envelope || !envelope.scope || !Array.isArray(envelope.scope.allowedFiles) || !envelope.scope.allowedFiles.length) errors.push('scope.allowedFiles');
  if (envelope && envelope.scope && envelope.task && !envelope.scope.allowedFiles.includes(envelope.task.subject)) errors.push('scope.subject-not-allowed');
  if (envelope && envelope.scope && envelope.scope.missingFiles && envelope.scope.missingFiles.length) errors.push('scope.missing-files');
  if (envelope && envelope.context && envelope.context.architectStatus !== 'voldoende') warnings.push('context.architect-insufficient');
  if (envelope && envelope.git && envelope.git.clean !== true) warnings.push('git.worktree-not-clean');
  if (envelope && envelope.git && (!envelope.git.integration || envelope.git.integration.status === 'UNKNOWN'))
    warnings.push('git.integration-ref-unknown');
  if (envelope && envelope.git && envelope.git.integration && envelope.git.integration.behind > 0)
    warnings.push('git.integration-ref-behind');
  if (envelope && envelope.tests && envelope.tests.unknownDependencies.length) warnings.push('tests.unknown-dependencies');
  if (envelope && envelope.context && envelope.context.productOwnershipRequired && !envelope.context.screens.length)
    warnings.push('context.product-owner-unknown');
  if (envelope && envelope.context && envelope.context.productOwnershipRequired && envelope.tests.direct.length + envelope.tests.indirect.length === 0)
    warnings.push('tests.no-targeted-tests-found');
  if (envelope && envelope.conflicts && envelope.conflicts.pullRequests.status !== 'CURRENT') warnings.push('conflicts.pr-snapshot-not-current');
  if (envelope && envelope.conflicts && envelope.conflicts.detected.length) warnings.push('conflicts.detected');
  if (envelope && envelope.tests && envelope.tests.unknownDependencies.length) {
    for (const gate of FULL_GATES) if (!envelope.tests.integralRequired.includes(gate)) errors.push('tests.fail-closed:' + gate);
  }
  if (envelope && envelope.tests && envelope.tests.narrowingAllowed !== false) errors.push('tests.narrowing-must-be-false');
  if (envelope && envelope.validity && !STATUSES.has(envelope.validity.status)) errors.push('validity.status');
  const expected = envelope && envelope.conflicts && envelope.conflicts.detected.length ? 'CONFLICT'
    : warnings.length ? 'INSUFFICIENT_CONTEXT' : 'VALID';
  if (envelope && envelope.validity && envelope.validity.status !== expected) errors.push('validity.status-derived');
  return { valid: errors.length === 0, errors, warnings, expectedStatus: expected };
}

function buildEnvelope(options) {
  const started = performance.now();
  let checkpoint = started;
  const phases = {};
  const mark = name => { const now = performance.now(); phases[name] = Math.round((now - checkpoint) * 100) / 100; checkpoint = now; };
  const root = path.resolve(options.root || Architect.WORTEL);
  const head = git(root, ['rev-parse', 'HEAD']);
  const branch = git(root, ['branch', '--show-current'], '') || null;
  const subject = normalizeFile(root, options.subject);
  const allowed = unique((options.allowedFiles || [subject]).map(file => normalizeFile(root, file)));
  const missing = allowed.filter(file => !fs.existsSync(path.join(root, file)));
  const base = options.baseCommit || head;
  const integrationRef = options.integrationRef || 'origin/main';
  const integrationCommit = git(root, ['rev-parse', '--verify', integrationRef], null);
  let integration = { ref: integrationRef, status: 'UNKNOWN', reason: 'integratiereferentie is lokaal niet beschikbaar of niet ververst' };
  if (integrationCommit) {
    const counts = String(git(root, ['rev-list', '--left-right', '--count', integrationCommit + '...'+ head], '') || '').trim().split(/\s+/).map(Number);
    integration = { ref: integrationRef, commit: integrationCommit, status: 'LOCAL_SNAPSHOT',
      behind: Number.isFinite(counts[0]) ? counts[0] : null,
      ahead: Number.isFinite(counts[1]) ? counts[1] : null,
      freshness: 'UNKNOWN_WITHOUT_FETCH',
      reason: 'de preflight voert geen netwerkactie uit; de lokale remote-ref kan achterlopen' };
  }
  const context = Architect.context(Architect.maakLezer({ wortel: root, bron: root }), options.taskClass, subject || options.subject);
  mark('codeArchitect');
  const runtime = subject ? runtimeReferences(root, [subject]) : { files: [], capped: false };
  const screens = ownersFor(root, runtime.files);
  mark('runtimeAndOwnership');
  const testMap = testsFor(root, runtime.files, allowed);
  mark('testDiscovery');
  const worktrees = worktreeConflicts(root, allowed, base, branch);
  mark('worktreeConflicts');
  const prs = pullRequestConflicts(root, options.prSnapshotData || options.prSnapshot, allowed, options.now || Date.now());
  mark('pullRequestConflicts');
  const detected = [...worktrees.conflicts, ...prs.conflicts];
  const unknown = unique([
    ...(context.kennisgaten || []),
    ...(runtime.capped ? ['de letterlijke runtimeverwijzingen bereikten hun veiligheidslimiet'] : []),
    ...(testMap.broadHistoryCommits.length ? ['brede historische commits zijn niet gebruikt om gerichte toetsen te claimen: ' + testMap.broadHistoryCommits.join(', ')] : []),
    ...(prs.status === 'CURRENT' ? [] : [prs.reason || 'PR-conflicten zijn niet actueel bepaald'])
  ]);
  const missingContext = context.voldoendheid && context.voldoendheid.ontbreekt || [];
  const testSupplement = options.taskClass === 'scherm-wijzigen' && missingContext.length > 0 &&
    missingContext.every(item => item.eis === 'toetsen') &&
    testMap.directlyReferenced.length + testMap.regressionHistory.length > 0;
  const contextStatus = testSupplement ? 'voldoende'
    : context.voldoendheid && context.voldoendheid.uitslag || 'onvoldoende';
  const clean = parsePorcelain(gitRaw(root, ['status', '--porcelain=v1'], '')).length === 0;
  const ownershipRequired = allowed.some(file => /^public\//.test(file));
  const integrationInsufficient = integration.status === 'UNKNOWN' || (Number.isFinite(integration.behind) && integration.behind > 0);
  const status = detected.length ? 'CONFLICT'
    : contextStatus !== 'voldoende' || unknown.length || !clean || integrationInsufficient || (ownershipRequired && !screens.length)
      ? 'INSUFFICIENT_CONTEXT' : 'VALID';
  const architectSummary = {
    taskClass: context.taakklasse,
    subject: context.onderwerp,
    found: context.gevonden,
    type: context.soort || null,
    files: context.bestanden || [],
    domain: context.domein || null,
    routes: ((context.regels || []).find(row => row.veld === 'routes') || {}).waarde || [],
    requirements: context.voldoendheid || null,
    supplementedBy: testSupplement ? ['deterministische testverwijzingen en begrensde regressiehistorie uit Proof Envelope'] : [],
    sourceRules: (context.regels || []).map(row => ({ field: row.veld, grade: row.graad, freshness: row.versheid,
      contradiction: row.tegenspraak, provenance: row.herkomst, emptyReason: row.reden || null }))
  };
  const envelope = {
    format: FORMAT,
    contractVersion: CONTRACT_VERSION,
    advisory: true,
    generatedAt: new Date(options.now || Date.now()).toISOString(),
    task: {
      id: options.taskId,
      agent: options.agent,
      class: options.taskClass,
      subject,
      risk: riskFor(allowed),
      budget: {
        minutes: Number.isFinite(options.budgetMinutes) ? options.budgetMinutes : null,
        tokens: Number.isFinite(options.budgetTokens) ? options.budgetTokens : null,
        ciMinutes: Number.isFinite(options.budgetCiMinutes) ? options.budgetCiMinutes : null
      }
    },
    git: {
      baseCommit: base,
      baseSource: options.baseCommit ? 'explicit' : 'current-head-before-change',
      headCommit: head,
      branch,
      clean,
      integration
    },
    scope: {
      allowedFiles: allowed,
      missingFiles: missing,
      policy: 'advisory; wijzigingen buiten deze lijst vereisen een nieuwe preflight'
    },
    context: {
      architectStatus: contextStatus,
      architect: architectSummary,
      runtimeReferences: {
        sharedFiles: runtime.files.filter(file => !screens.some(row => row.screen === file.replace(/^public\//, ''))),
        affectedScreenCount: screens.length,
        capped: runtime.capped,
        method: 'begrensde letterlijke verwijzingen in getrackte public-bron'
      },
      screens,
      productOwnershipRequired: ownershipRequired,
      provenance: ['Code Architect-registers', 'SCHERMEIGENAAR.json', 'getrackte bronbestanden', 'lokale Git-metadata']
    },
    tests: {
      direct: testMap.directlyReferenced,
      indirect: testMap.regressionHistory,
      integralRequired: unknown.length ? [...FULL_GATES] : [],
      unknownDependencies: unknown,
      narrowingAllowed: false
    },
    evidence: evidenceState(root, head, screens),
    conflicts: {
      worktrees,
      pullRequests: prs,
      detected,
      advisory: true
    },
    validity: {
      status,
      reasons: unique([
        ...(detected.length ? ['overlappend werkgebied gevonden'] : []),
        ...(!clean ? ['werkboom is niet schoon: voer de preflight vóór de wijziging uit'] : []),
        ...(integration.status === 'UNKNOWN' ? ['integratiereferentie is niet lokaal beschikbaar'] : []),
        ...(Number.isFinite(integration.behind) && integration.behind > 0 ? ['HEAD loopt ' + integration.behind + ' commit(s) achter op de lokale integratiereferentie'] : []),
        ...(ownershipRequired && !screens.length ? ['geen producteigenaar voor het geraakte scherm of de gedeelde presentatielaag vastgesteld'] : []),
        ...(contextStatus !== 'voldoende' ? ['Code Architect-context is ' + contextStatus] : []),
        ...unknown
      ])
    },
    metrics: {
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      sourceFilesConsidered: runtime.files.length,
      testsIdentified: testMap.directlyReferenced.length + testMap.regressionHistory.length,
      contextBytes: 0,
      tokenEstimate: { status: 'PROXY_ONLY', method: 'ceil(JSON UTF-8 bytes / 4)', value: 0 },
      phases
    }
  };
  envelope.validation = validateEnvelope(envelope, { currentHead: head });
  const bytes = Buffer.byteLength(JSON.stringify(envelope));
  envelope.metrics.contextBytes = bytes;
  envelope.metrics.tokenEstimate.value = Math.ceil(bytes / 4);
  return envelope;
}

module.exports = {
  FORMAT, CONTRACT_VERSION, FULL_GATES, buildEnvelope, validateEnvelope,
  parseWorktrees, runtimeReferences, ownersFor, testsFor, pullRequestConflicts, riskFor
};
