'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, driver } = require('./lib/library-fixture');
const M = require('../server/kern/library/model');

async function released() {
  const f = fixture(), d = driver(f.raw, f.query), setup = await d.setup(), e1 = await d.edition();
  await d.consent(d.A, e1); await d.consent(d.B, e1); await d.release(e1);
  return { f, d, setup, e1 };
}

test('Creation Studio ordent stabiele inhoudsankers zonder een released snapshot te wijzigen', async () => {
  const { f, d, setup, e1 } = await released();
  const second = await d.command(d.A, 'revision.add', { kind: 'afterword', title: 'Nawoord',
    content: 'Wat de gemeenschap later toevoegde.', changeSummary: 'Nawoord toegevoegd.' });
  const before = M.canonical((await d.work()).editions[e1].snapshot);
  await d.command(d.A, 'structure.reorder', { nodeIds: [second.result.nodeId, setup.nodeId] });
  const workspace = f.query(d.A, 'workspace', { workId: setup.workId });
  assert.deepEqual(workspace.workspace.nodes.map(n => n.id), [second.result.nodeId, setup.nodeId]);
  assert.equal(M.canonical((await d.work()).editions[e1].snapshot), before);
  const bad = await f.raw(d.A, 'structure.reorder', await d.input('structure.reorder', { nodeIds: [setup.nodeId] }));
  assert.equal(bad.code, 'INVALID_STRUCTURE');
  const denied = await f.raw(d.B, 'structure.reorder', await d.input('structure.reorder', { nodeIds: [setup.nodeId, second.result.nodeId] }));
  assert.equal(denied.code, 'EDIT_DENIED');
});

test('Reader opent exact een released editie en bewaart persoonlijke staat buiten het Work', async () => {
  const { f, d, setup, e1 } = await released();
  const beforeWork = M.canonical(f.db.data.libraryKernel), opened = f.readerQuery(d.B, 'open', { workId: setup.workId, editionId: e1 });
  assert.equal(opened.ok, true); assert.equal(opened.edition.nodes[0].revision.content, 'De herinnering zoals opgetekend.');
  assert.equal(M.canonical(f.db.data.libraryKernel), beforeWork, 'openen schrijft of meet geen leesgedrag');
  assert.equal(Object.hasOwn(f.db.data, 'libraryReader'), false, 'lezen schept geen persoonlijke collectie');
  let revision = 0, serial = 0;
  const write = async (action, data, operationId) => {
    const input = { operationId: operationId || 'reader_operation_' + String(++serial).padStart(6, '0'),
      workId: setup.workId, editionId: e1, expectedRevision: revision, data };
    const out = await f.readerRaw(d.B, action, input); assert.equal(out.ok, true, JSON.stringify(out)); revision = out.revision;
    return { out, input };
  };
  await write('progress.set', { nodeId: setup.nodeId, fraction: 0.375 });
  const bookmark = await write('bookmark.put', { nodeId: setup.nodeId, label: 'Teruglezen' });
  const highlight = await write('highlight.put', { nodeId: setup.nodeId, start: 3, end: 14 });
  const note = await write('note.put', { nodeId: setup.nodeId, content: 'Navragen bij de geïnterviewde.' });
  const state = f.readerQuery(d.B, 'state', { workId: setup.workId, editionId: e1 });
  assert.equal(state.revision, 4); assert.equal(state.state.progress.fraction, 0.375);
  assert.equal(state.state.bookmarks[bookmark.out.result.id].label, 'Teruglezen');
  assert.ok(state.state.highlights[highlight.out.result.id].excerptHash); assert.equal(Object.hasOwn(state.state.highlights[highlight.out.result.id], 'text'), false);
  assert.equal(state.state.notes[note.out.result.id].content, 'Navragen bij de geïnterviewde.');
  const results = f.readerQuery(d.B, 'search', { workId: setup.workId, editionId: e1, query: 'herinnering' });
  assert.equal(results.matches.length, 1); assert.equal(results.matches[0].nodeId, setup.nodeId);
  const proof = f.readerQuery(d.B, 'proof', { workId: setup.workId, editionId: e1 });
  assert.equal(proof.integrity, true); assert.equal(proof.events.length, 4);
  assert.equal(f.readerQuery('user-3', 'open', { workId: setup.workId, editionId: e1 }).status, 404);
});

test('Reader weigert een draft of alleen frozen Edition', async () => {
  const f = fixture(), d = driver(f.raw, f.query), setup = await d.setup();
  const made = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Nog niet vrijgegeven.' });
  assert.equal(f.readerQuery(d.A, 'open', { workId: setup.workId, editionId: made.result.id }).code, 'RELEASE_REQUIRED');
  await d.command(d.A, 'edition.freeze', { editionId: made.result.id });
  assert.equal(f.readerQuery(d.B, 'open', { workId: setup.workId, editionId: made.result.id }).code, 'RELEASE_REQUIRED');
  assert.equal(Object.hasOwn(f.db.data, 'libraryReader'), false);
});

test('Reader-mutaties zijn revision- en payloadgebonden en valideren editieankers', async () => {
  const { f, d, setup, e1 } = await released();
  const input = { operationId: 'reader_replay_operation_01', workId: setup.workId, editionId: e1,
    expectedRevision: 0, data: { nodeId: setup.nodeId, fraction: 0.5 } };
  const first = await f.readerRaw(d.A, 'progress.set', input); assert.equal(first.ok, true);
  assert.equal((await f.readerRaw(d.A, 'progress.set', input)).replay, true);
  assert.equal((await f.readerRaw(d.A, 'progress.set', { ...input, data: { ...input.data, fraction: 0.8 } })).code, 'REPLAY_CONFLICT');
  const stale = { operationId: 'reader_stale_operation_01', workId: setup.workId, editionId: e1,
    expectedRevision: 0, data: { nodeId: setup.nodeId, label: 'Oud' } };
  assert.equal((await f.readerRaw(d.A, 'bookmark.put', stale)).code, 'STALE_REVISION');
  const bad = { operationId: 'reader_bad_highlight_01', workId: setup.workId, editionId: e1,
    expectedRevision: 1, data: { nodeId: setup.nodeId, start: 0, end: 99999 } };
  assert.equal((await f.readerRaw(d.A, 'highlight.put', bad)).code, 'INVALID_INPUT');
});

test('persoonlijke leesstaat herstelt veilig vóór en na commit', async () => {
  const { f, d, setup, e1 } = await released();
  const input = { operationId: 'reader_recovery_operation_01', workId: setup.workId, editionId: e1,
    expectedRevision: 0, data: { nodeId: setup.nodeId, fraction: 0.25 } };
  f.fail('before'); assert.equal((await f.readerRaw(d.A, 'progress.set', input)).code, 'OUTCOME_UNKNOWN');
  assert.equal(Object.hasOwn(f.db.data, 'libraryReader'), false);
  f.fail('after'); assert.equal((await f.readerRaw(d.A, 'progress.set', input)).code, 'OUTCOME_UNKNOWN');
  f.fail(''); const replay = await f.readerRaw(d.A, 'progress.set', input);
  assert.equal(replay.replay, true); assert.equal(f.db.data.libraryReader.journal.length, 1);
});

test('inhoudelijke feedback sluit via een nieuwe revisie en Edition 2', async () => {
  const { f, d, setup, e1 } = await released();
  const edition1 = await f.query(d.A, 'edition', { workId: setup.workId, editionId: e1 }), bytes = M.canonical(edition1.edition.snapshot);
  const made = await d.command(d.B, 'feedback.create', { editionId: e1, nodeId: setup.nodeId,
    kind: 'correction', message: 'De datum in dit hoofdstuk vraagt correctie.', evidenceRefs: ['interview:2026-10-04'] });
  assert.equal((await f.raw(d.B, 'feedback.decide', await d.input('feedback.decide', {
    feedbackId: made.result.id, decision: 'accepted', reason: 'Ik heb dit zelf gemeld.' }))).code, 'EDIT_DENIED');
  await d.command(d.A, 'feedback.decide', { feedbackId: made.result.id, decision: 'accepted', reason: 'Bron opnieuw gecontroleerd.' });
  assert.equal((await f.raw(d.A, 'feedback.resolve', await d.input('feedback.resolve', {
    feedbackId: made.result.id, revisionId: edition1.edition.snapshot.content[0].revision.id, summary: 'Nog niet gewijzigd.' }))).code, 'NEW_REVISION_REQUIRED');
  const revision = await d.command(d.A, 'revision.add', { nodeId: setup.nodeId, kind: 'chapter', title: 'De haven',
    content: 'De herinnering met de aantoonbaar gecorrigeerde datum.', changeSummary: 'Correctie uit lezersfeedback.' });
  await d.command(d.A, 'feedback.resolve', { feedbackId: made.result.id, revisionId: revision.result.id,
    summary: 'Datum gecorrigeerd op basis van de genoemde bron.' });
  const feedback = f.query(d.A, 'feedback', { workId: setup.workId, editionId: e1 });
  assert.equal(feedback.feedback[0].status, 'resolved'); assert.equal(feedback.feedback[0].resolution.revisionHash, revision.result.hash);
  const e2 = await d.edition(e1); await d.consent(d.A, e2); await d.consent(d.B, e2); await d.release(e2);
  assert.equal(M.canonical((await d.work()).editions[e1].snapshot), bytes);
  const opened = f.readerQuery(d.B, 'open', { workId: setup.workId, editionId: e2 });
  assert.match(opened.edition.nodes[0].revision.content, /gecorrigeerde datum/);
  const proof = f.query(d.A, 'proof', { workId: setup.workId });
  for (const name of ['library.feedback.created', 'library.feedback.decided', 'library.feedback.resolved'])
    assert.ok(proof.events.some(e => e.type === name), name);
});

test('schema 1 migreert structuur, feedback en onderwijsreleases zonder historische editiebytes te wijzigen', () => {
  const legacy = { schemaVersion: 1, works: { w: { nodes: { b: {}, a: {} } } }, receipts: {}, journal: [], delivery: {} };
  const migrated = M.state(legacy);
  // schema 1 loopt door tot de huidige versie: 1 -> 2 (structuur, feedback) -> 3 (onderwijsreleases)
  assert.equal(migrated.schemaVersion, 3); assert.deepEqual(migrated.works.w.structure, ['a', 'b']);
  assert.deepEqual(migrated.works.w.feedback, {}); assert.deepEqual(migrated.works.w.educationReleases, {});
  assert.equal(legacy.schemaVersion, 1);
});
