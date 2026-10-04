'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const verdict = require('../scripts/codeql-verdict');

const SHA = 'a'.repeat(40);
function mapMet(document) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-codeql-'));
  fs.writeFileSync(path.join(map, 'javascript.sarif'), JSON.stringify(document));
  return map;
}
const sarif = results => ({ version:'2.1.0', runs:[{
  tool:{ driver:{ name:'CodeQL', rules:[] } },
  invocations:[{ executionSuccessful:true }], results
}] });

test('CodeQL-verdict bindt nul SARIF-resultaten aan commit, ref en bestanddigest', () => {
  const map = mapMet(sarif([]));
  try {
    const r = verdict.beoordeel({ map, commit:SHA, ref:'refs/heads/main', runId:'42' });
    assert.equal(r.stand, 'PASS');
    assert.equal(r.openResultaten, 0);
    assert.equal(r.commit, SHA);
    assert.match(r.bestanden[0].sha256, /^[a-f0-9]{64}$/);
  } finally { fs.rmSync(map, { recursive:true, force:true }); }
});

test('ieder CodeQL-resultaat, mislukte run en ongebonden bron faalt gesloten', () => {
  const rood = mapMet(sarif([{ ruleId:'js/example', level:'error' }]));
  const mislukt = mapMet({ version:'2.1.0', runs:[{ tool:{ driver:{ name:'CodeQL' } },
    invocations:[{ executionSuccessful:false }], results:[] }] });
  try {
    assert.equal(verdict.beoordeel({ map:rood, commit:SHA, ref:'refs/heads/main' }).stand, 'FAIL');
    assert.throws(() => verdict.beoordeel({ map:mislukt, commit:SHA, ref:'refs/heads/main' }), /mislukte uitvoering/);
    assert.throws(() => verdict.beoordeel({ map:rood, commit:'kort', ref:'refs/heads/main' }), /commit-SHA/);
    assert.throws(() => verdict.beoordeel({ map:rood, commit:SHA, ref:'main' }), /Git-ref/);
    assert.equal(verdict.beoordeel({ map:rood, commit:SHA, ref:'refs/pull/447/merge' }).ref, 'refs/pull/447/merge',
      'een pull_request-run draagt zijn merge-ref als herkomst');
    for (const fout of ['refs/pull/447/head', 'refs/pull/0/merge', 'refs/pull/x/merge'])
      assert.throws(() => verdict.beoordeel({ map:rood, commit:SHA, ref:fout }), /Git-ref/);
  } finally {
    fs.rmSync(rood, { recursive:true, force:true });
    fs.rmSync(mislukt, { recursive:true, force:true });
  }
});

test('ontbrekende, vreemde en gelinkte SARIF kan geen groen verdict maken', () => {
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-codeql-leeg-'));
  const vreemd = mapMet({ version:'2.1.0', runs:[{ tool:{ driver:{ name:'Andere scanner' } }, results:[] }] });
  try {
    assert.throws(() => verdict.beoordeel({ map:leeg, commit:SHA, ref:'refs/heads/main' }), /geen SARIF/);
    assert.throws(() => verdict.beoordeel({ map:vreemd, commit:SHA, ref:'refs/heads/main' }), /niet aantoonbaar/);
  } finally {
    fs.rmSync(leeg, { recursive:true, force:true });
    fs.rmSync(vreemd, { recursive:true, force:true });
  }
});
