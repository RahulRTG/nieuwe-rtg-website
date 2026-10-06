'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, driver } = require('./lib/library-fixture');
test('PostgreSQL: twee instances, freeze/revoke/release, rollback, replay en restart', { timeout: 30000 }, async t => {
  const url = process.env.RTG_LIBRARY_TEST_PG_URL || process.env.DATABASE_URL || process.env.PG_URL;
  assert.ok(url, 'Vereist een geïsoleerde PostgreSQL-testserver via RTG_LIBRARY_TEST_PG_URL of npm run test:pg.');
  const isolated = await require('./lib/living-world-pg-database')(url); t.after(isolated.close);
  const { maakPg } = require('../server/pg'), { merge3 } = require('../server/db/merge'), kluis = require('../server/kluis');
  const a = maakPg({ url: isolated.url, merge3, kluis }), b = maakPg({ url: isolated.url, merge3, kluis });
  const f = fixture(), d = driver(f.raw, f.query), make = require('../server/kern/library');
  try {
    await a.schema(); const dataA = await a.laadAlles() || {}, dataB = await b.laadAlles() || {};
    const core = (pg, data, fault) => make({ db: { data, writable: true }, store: 'postgres', identities: f.identities,
      now: () => '2026-10-03T10:00:00.000Z', bewerkCollectie: async (name, fn) => {
        const out = await pg.bewerkCollectie(name, data, s => { const r = fn(s); if (fault === 'before') throw new Error('before commit'); return r; });
        if (fault === 'after') throw new Error('after commit'); return out;
      } });
    const ca = core(a, dataA), cb = core(b, dataB), setup = await d.setup();
    const draft = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
    await a.bewerkCollectie('libraryKernel', dataA, s => Object.assign(s, f.db.data.libraryKernel));
    const freeze = await d.input('edition.freeze', { editionId: draft.result.id });
    const frozen = await Promise.all([ca.execute(d.A, 'edition.freeze', freeze, () => true), cb.execute(d.A, 'edition.freeze', freeze, () => true)]);
    assert.equal(frozen.filter(x => x.ok).length, 2); assert.equal(frozen.filter(x => x.replay).length, 1);
    f.db.data.libraryKernel = (await a.laadAlles()).libraryKernel;
    await d.consent(d.A, draft.result.id); await d.consent(d.B, draft.result.id);
    await a.bewerkCollectie('libraryKernel', dataA, s => Object.assign(s, f.db.data.libraryKernel));
    const p = await d.preview(draft.result.id);
    const release = await d.input('publication.confirm', { editionId: draft.result.id, consentDigest: p.consentDigest });
    const before = (await a.laadAlles()).libraryKernel;
    assert.equal((await core(a, dataA, 'before').execute(d.A, 'publication.confirm', release, () => true)).code, 'OUTCOME_UNKNOWN');
    assert.deepEqual((await a.laadAlles()).libraryKernel, before);
    const revoke = await d.input('rights.revoke', { grantId: setup.grants[1], reason: 'Stop tijdens publicatie.' });
    const race = await Promise.all([ca.execute(d.A, 'publication.confirm', release, () => true), cb.execute(d.B, 'rights.revoke', revoke, () => true)]);
    assert.equal(race.filter(x => x.ok).length, 1); assert.equal(race.filter(x => x.code === 'STALE_REVISION').length, 1);
    const stored = (await a.laadAlles()).libraryKernel;
    assert.equal(Object.keys(stored.works[setup.workId].releases).length, race[0].ok ? 1 : 0);
    // Reset only this isolated fixture to test an uncertain COMMIT response.
    await a.bewerkCollectie('libraryKernel', dataA, s => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, before); });
    assert.equal((await core(a, dataA, 'after').execute(d.A, 'publication.confirm', release, () => true)).code, 'OUTCOME_UNKNOWN');
    const restarted = core(b, await b.laadAlles());
    assert.equal((await restarted.execute(d.A, 'publication.confirm', release, () => true)).replay, true);
    const final = (await a.laadAlles()).libraryKernel;
    assert.equal(Object.keys(final.works[setup.workId].releases).length, 1);
    assert.equal(final.journal.length, before.journal.length + 1);
    assert.equal(final.works[setup.workId].editions[draft.result.id].snapshotHash, p.snapshotHash);
  } finally { await Promise.all([a.pool.end(), b.pool.end()]); }
});

test('PostgreSQL Reader: persoonlijke staat is race-, replay- en antwoordverliesbestendig', { timeout: 30000 }, async t => {
  const url = process.env.RTG_LIBRARY_TEST_PG_URL || process.env.DATABASE_URL || process.env.PG_URL;
  assert.ok(url, 'Vereist een geïsoleerde PostgreSQL-testserver via RTG_LIBRARY_TEST_PG_URL of npm run test:pg.');
  const isolated = await require('./lib/living-world-pg-database')(url); t.after(isolated.close);
  const { maakPg } = require('../server/pg'), { merge3 } = require('../server/db/merge'), kluis = require('../server/kluis');
  const a = maakPg({ url: isolated.url, merge3, kluis }), b = maakPg({ url: isolated.url, merge3, kluis });
  const f = fixture(), d = driver(f.raw, f.query), make = require('../server/kern/library');
  try {
    const setup = await d.setup(), edition = await d.edition(); await d.consent(d.A, edition); await d.consent(d.B, edition); await d.release(edition);
    await a.schema(); const dataA = await a.laadAlles() || {}; let dataB = await b.laadAlles() || {};
    await a.bewerkCollectie('libraryKernel', dataA, s => Object.assign(s, f.db.data.libraryKernel));
    dataB = await b.laadAlles() || {};
    const core = (pg, data, fault) => make({ db: { data, writable: true }, store: 'postgres', identities: f.identities,
      now: () => '2026-10-04T10:00:00.000Z', bewerkCollectie: async (name, fn) => {
        const out = await pg.bewerkCollectie(name, data, s => { const r = fn(s); if (fault === 'before') throw new Error('before commit'); return r; });
        if (fault === 'after') throw new Error('after commit'); return out;
      } });
    const ca = core(a, dataA), cb = core(b, dataB);
    const first = { operationId: 'pg_reader_same_operation_01', workId: setup.workId, editionId: edition,
      expectedRevision: 0, data: { nodeId: setup.nodeId, fraction: 0.2 } };
    const same = await Promise.all([ca.reader.execute(d.A, 'progress.set', first, () => true),
      cb.reader.execute(d.A, 'progress.set', first, () => true)]);
    assert.equal(same.filter(x => x.ok).length, 2); assert.equal(same.filter(x => x.replay).length, 1);
    const after = { operationId: 'pg_reader_after_commit_01', workId: setup.workId, editionId: edition,
      expectedRevision: 1, data: { nodeId: setup.nodeId, label: 'Herstel' } };
    assert.equal((await core(a, dataA, 'after').reader.execute(d.A, 'bookmark.put', after, () => true)).code, 'OUTCOME_UNKNOWN');
    const restarted = core(b, await b.laadAlles());
    assert.equal((await restarted.reader.execute(d.A, 'bookmark.put', after, () => true)).replay, true);
    const left = { operationId: 'pg_reader_race_left_01', workId: setup.workId, editionId: edition,
      expectedRevision: 2, data: { nodeId: setup.nodeId, fraction: 0.6 } };
    const right = { operationId: 'pg_reader_race_right_1', workId: setup.workId, editionId: edition,
      expectedRevision: 2, data: { nodeId: setup.nodeId, fraction: 0.8 } };
    const race = await Promise.all([ca.reader.execute(d.A, 'progress.set', left, () => true),
      cb.reader.execute(d.A, 'progress.set', right, () => true)]);
    assert.equal(race.filter(x => x.ok).length, 1); assert.equal(race.filter(x => x.code === 'STALE_REVISION').length, 1);
    const stored = (await a.laadAlles()).libraryReader;
    assert.equal(stored.readers[d.A].revision, 3); assert.equal(stored.journal.length, 3);
  } finally { await Promise.all([a.pool.end(), b.pool.end()]); }
});
