'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const P = require('../scripts/lib/proof-envelope');

const ROOT = path.join(__dirname, '..');
const HEAD = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const NOW = Date.parse('2026-11-09T12:00:00.000Z');
const EMPTY_PRS = { capturedAt: '2026-11-09T11:55:00.000Z', pullRequests: [] };

test('Proof Envelope bindt een schermtaak aan commit, eigenaar en gerichte toetsen', () => {
  const envelope = P.buildEnvelope({
    root: ROOT,
    taskId: 'historisch-browser-tabs',
    agent: 'test-agent',
    taskClass: 'scherm-wijzigen',
    subject: 'public/apps/browser.html',
    allowedFiles: ['public/apps/browser.html'],
    baseCommit: HEAD,
    prSnapshotData: EMPTY_PRS,
    now: NOW
  });
  assert.equal(envelope.format, 'rtg-proof-envelope-v1');
  assert.equal(envelope.git.baseCommit, HEAD);
  assert.equal(envelope.git.headCommit, HEAD);
  assert.deepEqual(envelope.scope.allowedFiles, ['public/apps/browser.html']);
  assert.ok(envelope.context.screens.some(row => row.screen === 'apps/browser.html' && row.capability === 'web.browser'));
  assert.ok(envelope.tests.direct.includes('test/browser-ds.e2e.js'));
  assert.equal(envelope.tests.narrowingAllowed, false);
  assert.ok(envelope.tests.integralRequired.includes(P.FULL_GATES[0]), 'onbekende afhankelijkheden moeten de volledige poort behouden');
  assert.equal(envelope.validation.valid, true);
});

test('gedeelde presentatiebron vindt de historische wereldschermen en regressies zonder bewijs te promoveren', () => {
  const envelope = P.buildEnvelope({
    root: ROOT,
    taskId: 'historisch-zeven-appwerkt-gaten',
    agent: 'test-agent',
    taskClass: 'scherm-wijzigen',
    subject: 'public/shared/interface/world-presentation.js',
    allowedFiles: ['public/shared/interface/world-presentation.js'],
    baseCommit: HEAD,
    prSnapshotData: EMPTY_PRS,
    now: NOW
  });
  const screens = new Set(envelope.context.screens.map(row => row.screen));
  assert.ok(screens.has('apps/wonen.html'));
  assert.ok(screens.has('apps/decision-room.html'));
  assert.ok(envelope.tests.direct.includes('test/world-desktop-beelden.e2e.js') ||
    envelope.tests.indirect.includes('test/world-desktop-beelden.e2e.js'));
  assert.equal(envelope.evidence.plan.status, 'PRESENT_UNVERIFIED');
  assert.match(envelope.evidence.policy, /blijven ongeldig|herkwalificeren/);
});

test('historische 166-DS-oorzaak en desktop/mobiel-problemen leveren gedeeld bereik en gerichte toetsen', () => {
  const gestureRuntime = P.runtimeReferences(ROOT, ['public/shared/gebaar.js']);
  const gestureOwners = P.ownersFor(ROOT, gestureRuntime.files);
  const gestureTests = P.testsFor(ROOT, gestureRuntime.files, ['public/shared/gebaar.js']);
  assert.ok(gestureOwners.length >= 50, 'de historische gedeelde gebaarloader hoort tientallen schermowners te raken');
  assert.ok(gestureTests.directlyReferenced.includes('test/gebaar.test.js'));

  const desktopRuntime = P.runtimeReferences(ROOT, ['public/shared/rtg-world-desktop.js']);
  const desktopTests = P.testsFor(ROOT, desktopRuntime.files, ['public/shared/rtg-world-desktop.js']);
  assert.ok(desktopTests.directlyReferenced.some(file => /world-desktop.*\.test\.js$/.test(file)),
    'de desktop- en mobiele regressietoetsen moeten gericht zichtbaar worden');
});

test('actuele PR-snapshot maakt een overlap vóór de wijziging zichtbaar', () => {
  const result = P.pullRequestConflicts(ROOT, {
    capturedAt: '2026-11-09T11:55:00.000Z',
    pullRequests: [{ number: 702, branch: 'voorbeeld', head: 'a'.repeat(40), files: ['public/apps/browser.html'] }]
  }, ['public/apps/browser.html'], NOW);
  assert.equal(result.status, 'CURRENT');
  assert.deepEqual(result.conflicts[0].files, ['public/apps/browser.html']);
});

test('PR-snapshot mag tijdelijk zijn maar leest geen willekeurig bestand buiten repository of temp', () => {
  const temporary = path.join(os.tmpdir(), 'rtg-preflight-prs-' + process.pid + '.json');
  fs.writeFileSync(temporary, JSON.stringify(EMPTY_PRS));
  try {
    assert.equal(P.pullRequestConflicts(ROOT, temporary, [], NOW).status, 'CURRENT');
    const forbidden = P.pullRequestConflicts(ROOT, path.join(path.dirname(ROOT), 'geen-pr-snapshot.json'), [], NOW);
    assert.equal(forbidden.status, 'UNKNOWN');
  } finally { fs.unlinkSync(temporary); }
});

function synthetic() {
  return {
    format: P.FORMAT,
    contractVersion: P.CONTRACT_VERSION,
    task: { id: 'synthetic-task', agent: 'agent', class: 'scherm-wijzigen', subject: 'public/apps/browser.html', risk: 'medium',
      budget: { minutes: 30, tokens: 10000, ciMinutes: 5 } },
    git: { baseCommit: HEAD, headCommit: HEAD, clean: true },
    scope: { allowedFiles: ['public/apps/browser.html'], missingFiles: [] },
    context: { architectStatus: 'voldoende', productOwnershipRequired: true, screens: [{ screen: 'apps/browser.html' }] },
    tests: { direct: ['test/browser-ds.test.js'], indirect: [], integralRequired: [...P.FULL_GATES],
      unknownDependencies: ['runtime-afhankelijkheid onbekend'], narrowingAllowed: false },
    evidence: {},
    conflicts: { pullRequests: { status: 'CURRENT' }, detected: [] },
    validity: { status: 'INSUFFICIENT_CONTEXT' }
  };
}

test('validator weigert testversmalling bij een onbekende afhankelijkheid', () => {
  const envelope = synthetic();
  envelope.tests.integralRequired = [];
  const result = P.validateEnvelope(envelope, { currentHead: HEAD });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.startsWith('tests.fail-closed:')));
});

test('validator weigert een andere of verouderde base-commit', () => {
  const envelope = synthetic();
  envelope.git.baseCommit = '0'.repeat(40);
  const result = P.validateEnvelope(envelope, { currentHead: HEAD });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('git.baseCommit-not-head'));
});

test('validator leidt CONFLICT af en accepteert geen administratief groen', () => {
  const envelope = synthetic();
  envelope.conflicts.detected = [{ type: 'pull-request', files: ['public/apps/browser.html'] }];
  envelope.validity.status = 'VALID';
  const result = P.validateEnvelope(envelope, { currentHead: HEAD });
  assert.equal(result.valid, false);
  assert.equal(result.expectedStatus, 'CONFLICT');
  assert.ok(result.errors.includes('validity.status-derived'));
});

test('Proof Envelope-module bevat geen schrijvende bestandssysteemoperatie', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/lib/proof-envelope.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:writeFile|appendFile|rename|unlink|mkdir|rm)Sync?\b/);
  assert.doesNotMatch(source, /\bexecSync\b|\bshell\s*:\s*true\b/, 'repositorytekst mag nooit als shellcode worden uitgevoerd');
});
