'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bewijs = require('../scripts/release-workflow-bewijs');

const COMMIT = 'a'.repeat(40);
const NU = Date.parse('2026-10-01T12:00:00.000Z');

function run(eis, patch = {}) {
  return {
    id:101,
    run_attempt:1,
    head_sha:COMMIT,
    head_branch:'main',
    path:'.github/workflows/' + eis.workflow,
    event:eis.events[0],
    status:'completed',
    conclusion:'success',
    created_at:'2026-10-01T10:00:00.000Z',
    updated_at:'2026-10-01T10:30:00.000Z',
    ...patch
  };
}

function artifacts(eis, patch = {}) {
  return eis.artifacts.map((naam, i) => ({
    id:200 + i,
    name:naam,
    expired:false,
    digest:'sha256:' + String(i + 1).repeat(64),
    size_in_bytes:100 + i,
    ...patch
  }));
}

test('prereleaseprofiel is acyclisch en ieder exact groen onderdeel wordt begrensd', () => {
  assert.equal(bewijs.VEREISTEN.some(e => e.workflow === 'release-image.yml'), false);
  assert.deepEqual(bewijs.VEREISTEN.map(e => e.workflow),
    ['ci.yml', 'ronde.yml', 'desktop-standard.yml', 'codeql.yml']);
  for (const eis of bewijs.VEREISTEN) {
    const gekozen = bewijs.kiesRun(eis, [run(eis)], COMMIT, NU, '999');
    const dossier = bewijs.runBewijs(eis, gekozen, artifacts(eis));
    assert.equal(dossier.commit, COMMIT);
    assert.equal(dossier.workflowPad, '.github/workflows/' + eis.workflow);
    assert.equal(dossier.branch, 'main');
    assert.equal(dossier.status, 'completed');
    assert.equal(dossier.conclusie, 'success');
    assert.deepEqual(dossier.artifacts.map(a => a.naam), [...eis.artifacts]);
  }
});

test('de nieuwste exacte run wint ook wanneer een oudere run groen was', () => {
  const eis = bewijs.VEREISTEN[0];
  const ouder = run(eis, { id:100, updated_at:'2026-10-01T09:00:00.000Z' });
  const nieuwerRood = run(eis, { id:101, status:'completed', conclusion:'failure',
    updated_at:'2026-10-01T11:00:00.000Z' });
  assert.throws(() => bewijs.kiesRun(eis, [ouder, nieuwerRood], COMMIT, NU), /failure/);
  assert.throws(() => bewijs.kiesRun(eis, [ouder, { ...nieuwerRood, status:'in_progress', conclusion:null }], COMMIT, NU),
    /in_progress/);
});

test('verkeerde bron, ref, workflow, event, leeftijd en zelfbewijs sluiten fail-closed', () => {
  const eis = bewijs.VEREISTEN[0], goed = run(eis);
  const gevallen = [
    [{ ...goed, head_sha:'b'.repeat(40) }, /geen workflowrun/],
    [{ ...goed, head_branch:'release' }, /geen workflowrun/],
    [{ ...goed, path:null }, /geen workflowrun/],
    [{ ...goed, path:'.github/workflows/release-image.yml' }, /geen workflowrun/],
    [{ ...goed, event:'pull_request' }, /geen workflowrun/],
    [{ ...goed, updated_at:'2026-09-20T00:00:00.000Z' }, /oud/],
    [{ ...goed, updated_at:'2026-10-02T12:00:00.000Z' }, /toekomstig/]
  ];
  for (const [invoer, fout] of gevallen) assert.throws(() => bewijs.kiesRun(eis, [invoer], COMMIT, NU), fout);
  assert.throws(() => bewijs.kiesRun(eis, [goed], COMMIT, NU, String(goed.id)), /zichzelf/);
  assert.throws(() => bewijs.kiesRun(eis, [goed], 'kort', NU), /volledige Git-SHA/);
});

test('artifactbewijs weigert ontbreken, dubbel, verlopen, leeg en ongetekend', () => {
  const eis = bewijs.VEREISTEN[0], goed = artifacts(eis);
  assert.equal(bewijs.artifactBewijs(eis, goed)[0].digest, goed[0].digest);
  assert.throws(() => bewijs.artifactBewijs(eis, []), /ontbreekt/);
  assert.throws(() => bewijs.artifactBewijs(eis, [goed[0], { ...goed[0], id:999 }]), /dubbel/);
  assert.throws(() => bewijs.artifactBewijs(eis, [{ ...goed[0], expired:true }]), /verlopen/);
  assert.throws(() => bewijs.artifactBewijs(eis, [{ ...goed[0], expired:undefined }]), /expirybewijs/);
  assert.throws(() => bewijs.artifactBewijs(eis, [{ ...goed[0], digest:null }]), /mist SHA-256/);
  assert.throws(() => bewijs.artifactBewijs(eis, [{ ...goed[0], size_in_bytes:0 }]), /leeg/);
});

test('verzamel bouwt één gesanitiseerd dossier voor exact de checkoutcommit', async () => {
  const commit = bewijs.gitCommit();
  assert.match(commit, /^[0-9a-f]{40}$/);
  const ids = new Map(bewijs.VEREISTEN.map((e, i) => [e.workflow, 300 + i]));
  const fake = async url => {
    for (const eis of bewijs.VEREISTEN) {
      const id = ids.get(eis.workflow);
      if (url.includes('/actions/workflows/' + encodeURIComponent(eis.workflow) + '/runs')) {
        return { workflow_runs:[run(eis, { id, head_sha:commit })] };
      }
      if (url.includes('/actions/runs/' + id + '/artifacts')) return { artifacts:artifacts(eis) };
    }
    throw new Error('onverwachte API-vraag: ' + url);
  };
  const dossier = await bewijs.verzamel({ repository:'rtg/platform', token:'testtoken', commit,
    eventCommit:commit, huidigeRun:'999', nu:NU, request:fake });
  assert.equal(dossier.stand, 'VERIFIED');
  assert.equal(dossier.commit, commit);
  assert.equal(dossier.workflows.length, 4);
  assert.equal(dossier.profiel, 'release-workflows-v2');
  assert.deepEqual(dossier.workflows.find(w => w.workflow === 'codeql.yml').artifacts
    .map(a => a.naam), ['codeql-verdict']);
  assert.equal(JSON.stringify(dossier).includes('testtoken'), false);
  assert.throws(() => bewijs.apiBasis('https://api.github.com', 'rtg/platform/extra'), /vorm/);
  await assert.rejects(() => bewijs.verzamel({ repository:'rtg/platform', token:'', commit,
    eventCommit:commit, huidigeRun:'999', nu:NU, request:fake }), /GITHUB_TOKEN/);
  await assert.rejects(() => bewijs.verzamel({ repository:'rtg/platform', token:'x', commit,
    eventCommit:'b'.repeat(40), huidigeRun:'999', nu:NU, request:fake }), /releasebron/);
});
