'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../scripts/lib/outputbinding');
const pass = { toetsen: 3, overgeslagen: 0, gezakt: 0, status: 0, signal: null, error: null, tijdout: false };
test('only an actually completed passing baseline belongs to its candidate', () => {
  assert.equal(B.currentBaseline({ binding: 'candidate-a', staat: 'groen', execution: pass }, 'candidate-a'), true);
  assert.equal(B.currentBaseline({ binding: 'candidate-a', staat: 'groen', execution: pass }, 'candidate-b'), false);
  assert.equal(B.currentBaseline('groen', 'candidate-a'), false);
  assert.equal(B.currentBaseline({ binding: 'candidate-a', staat: 'groen' }, 'candidate-a'), false);
});
test('timeout, skips, zero tests, process crashes and failed cleanup cannot become output proof', () => {
  for (const patch of [{ tijdout: true }, { signal: 'SIGKILL' }, { error: 'ENOENT' },
    { toetsen: 0 }, { overgeslagen: 1 }, { status: null }, { status: 2 }, { status: 1 }]) {
    assert.equal(B.complete({ ...pass, ...patch }), false, JSON.stringify(patch));
    assert.equal(B.green({ ...pass, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(B.green({ ...pass, status: 1 }), false);
  assert.equal(B.green({ ...pass, gezakt: 1, status: 1 }), false);
  assert.equal(B.complete({ ...pass, gezakt: 1, status: 1 }), true);
});

const route = 'POST /api/proef';
function specimen() {
  const identity = { commit: 'a'.repeat(40), sourceTree: 'b'.repeat(40) };
  const candidate = { ...identity, id: B.digest(JSON.stringify(identity)) };
  const row = { staat: 'bewezen', evidenceCommit: candidate.commit, evidenceBinding: candidate.id };
  const direct = { evidenceCommit: candidate.commit, binding: candidate.id, provenance: 'CURRENT_CANDIDATE',
    merkt: true, toets: 'proef.test.js', evidence: { mutation: { ...pass, gezakt: 1, status: 1 },
      control: pass, changedResponses: 1, hitDigest: 'c'.repeat(64) } };
  return { row, register: { binding: candidate, stempel: { commit: 'new-register-stamp' }, gericht: { [route]: direct } }, direct };
}
test('only a bound route mutation with a passing control reaches the current evidence matrix', () => {
  const s = specimen(), cell = B.outputCell(s.row, s.register, route);
  assert.equal(cell.staat, 'bewezen');
  assert.equal(cell.evidenceCommit, 'a'.repeat(40));
  assert.equal(cell.provenance, 'CANDIDATE_BOUND');
});
test('a fresh register stamp cannot renew historical route proof or a forged PASS counter', () => {
  const s = specimen();
  s.direct.provenance = 'HISTORICAL_UNREVALIDATED';
  let cell = B.outputCell(s.row, s.register, route);
  assert.equal(cell.staat, 'ongemeten');
  assert.equal(cell.historicalState, 'bewezen');
  assert.equal(cell.evidenceCommit, 'a'.repeat(40));
  for (const change of [x => { delete x.direct.evidence; }, x => { x.direct.evidence.changedResponses = 0; },
    x => { x.direct.evidence.control = { ...pass, overgeslagen: 1 }; },
    x => { x.direct.binding = 'wrong'; }, x => { x.row.evidenceCommit = 'd'.repeat(40); },
    x => { x.register.binding.commit = 'e'.repeat(40); }]) {
    const next = specimen(); change(next);
    cell = B.outputCell(next.row, next.register, route);
    assert.equal(cell.staat, 'ongemeten');
  }
});
test('the persisted mixed register keeps candidate binding through the real matrix reader', t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const matrix = require('../scripts/bewijsmatrix');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-output-consumer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'OUTPUTPROEF.json'), s = specimen();
  const historical = 'POST /api/oud';
  s.register.perRoute = { [route]: s.row, [historical]: { staat: 'bewezen', evidenceCommit: 'old-commit',
    provenance: 'HISTORICAL_UNREVALIDATED', reden: 'old observed mutation' } };
  fs.writeFileSync(file, JSON.stringify(s.register));
  const result = matrix.bouw({ tabel: { routes: [{ methode: 'POST', pad: '/api/proef' }, { methode: 'POST', pad: '/api/oud' }] },
    bewakers: new Map(), journaal: null, poort: null, rol: null, keten: null, invoer: null, idem: null,
    audit: null, staat: null, output: matrix.objectRegister(file), handeling: null, uitvoer: null, auditp: null, faal: null });
  assert.equal(result.rijen[0].cellen.OUTPUT.staat, 'bewezen');
  assert.equal(result.rijen[0].cellen.OUTPUT.evidenceCommit, s.register.binding.commit);
  assert.equal(result.rijen[1].cellen.OUTPUT.staat, 'ongemeten');
  assert.equal(result.rijen[1].cellen.OUTPUT.evidenceCommit, 'old-commit');
  assert.equal(result.rijen[1].cellen.OUTPUT.historicalState, 'bewezen');
});
