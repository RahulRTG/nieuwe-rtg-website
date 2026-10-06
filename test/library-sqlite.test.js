'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawn } = require('node:child_process');
const { fixture, driver } = require('./lib/library-fixture');
function run(dir, task, gate) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['test/lib/library-db-child.cjs'], {
      cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe', ...(gate ? ['ipc'] : [])],
      env: { ...process.env, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', RTG_DATA_DIR: dir, RTG_ENC_KEY: '' } });
    let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; });
    child.on('error', reject); if (gate) child.on('message', () => gate(child));
    child.on('exit', code => { if (code) return reject(new Error(err || out));
      try { resolve(JSON.parse(out.trim().split('\n').at(-1))); } catch (e) { reject(e); } });
    child.stdin.end(JSON.stringify({ ...task, gate: !!gate }));
  });
}
function barrier() { const children = []; return c => { children.push(c); if (children.length === 2) children.forEach(x => x.send('go')); }; }
test('echte SQLite: freeze/release/revoke race, restart, rollback en verloren antwoord', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-library-'));
  try {
    const f = fixture(), d = driver(f.raw, f.query); const setup = await d.setup();
    const draft = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
    await run(dir, { kind: 'seed', state: f.db.data.libraryKernel });
    const freeze = { actor: d.A, action: 'edition.freeze', input: await d.input('edition.freeze', { editionId: draft.result.id }) };
    const gate = barrier(); const frozen = await Promise.all([run(dir, freeze, gate), run(dir, freeze, gate)]);
    assert.equal(frozen.filter(x => x.ok).length, 2); assert.equal(frozen.filter(x => x.replay).length, 1);
    f.db.data.libraryKernel = await run(dir, { kind: 'inspect' });
    const e = draft.result.id; await d.consent(d.A, e); await d.consent(d.B, e); const preview = await d.preview(e);
    await run(dir, { kind: 'seed', state: f.db.data.libraryKernel });
    const release = { actor: d.A, action: 'publication.confirm', input: await d.input('publication.confirm', { editionId: e, consentDigest: preview.consentDigest }) };
    const before = await run(dir, { kind: 'inspect' });
    assert.equal((await run(dir, { ...release, fail: 'before' })).code, 'OUTCOME_UNKNOWN');
    assert.deepEqual(await run(dir, { kind: 'inspect' }), before);
    const revoke = { actor: d.B, action: 'rights.revoke', input: await d.input('rights.revoke', { grantId: setup.grants[1], reason: 'Intrekking tijdens publicatie.' }) };
    const together = barrier(); const race = await Promise.all([run(dir, release, together), run(dir, revoke, together)]);
    assert.equal(race.filter(x => x.ok).length, 1); assert.equal(race.filter(x => x.code === 'STALE_REVISION').length, 1);
    const stored = await run(dir, { kind: 'inspect' }), work = stored.works[setup.workId];
    assert.equal(Object.keys(work.releases).length, race[0].ok ? 1 : 0);
    assert.equal(work.editions[e].snapshotHash, before.works[setup.workId].editions[e].snapshotHash);
    // Fresh isolated state for response loss after an actual durable release.
    await run(dir, { kind: 'seed', state: before });
    assert.equal((await run(dir, { ...release, fail: 'after' })).code, 'OUTCOME_UNKNOWN');
    assert.equal((await run(dir, release)).replay, true);
    const final = await run(dir, { kind: 'inspect' });
    assert.equal(Object.keys(final.works[setup.workId].releases).length, 1);
    assert.equal(final.journal.length, before.journal.length + 1);
    assert.equal((await run(dir, { ...release, input: { ...release.input, data: { ...release.input.data, consentDigest: 'changed' } } })).code, 'REPLAY_CONFLICT');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
