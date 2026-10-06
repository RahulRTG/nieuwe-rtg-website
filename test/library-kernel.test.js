'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, driver, fullScenario, terms, grant } = require('./lib/library-fixture');
const M = require('../server/kern/library/model');
const setup = () => { const f = fixture(); return { f, d: driver(f.raw, f.query) }; };
test('volledige menselijke lus: twee makers, twee immutable edities en editiegebonden instemming', async () => {
  const { f, d } = setup(); await fullScenario(d);
  for (const name of ['academy', 'foundation', 'pay', 'talent']) assert.deepEqual(f.db.data[name], { untouched: true });
  const work = await d.work(); assert.equal(work.responsible, 'user-1');
  assert.ok(!JSON.stringify(work.grants).includes('Foundation'));
  assert.equal(Object.hasOwn(work, 'copyrightOwner'), false);
});
test('actor spoofing en onbekende domeinhandelingen veranderen niets', async () => {
  const { f, d } = setup(); await d.setup(); const before = M.canonical(f.db.data);
  const input = await d.input('revision.add', { actor: 'user-1', title: 'X', content: 'X' });
  assert.equal((await f.raw('user-2', 'revision.add', input)).code, 'INVALID_INPUT');
  for (const action of ['academy.certify', 'foundation.complete', 'pay.settle', 'talent.expert'])
    assert.equal((await f.raw('user-1', action, input)).code, 'UNKNOWN_ACTION');
  assert.equal(M.canonical(f.db.data), before);
});
test('credit is geen edit/publish/expertise; buitenstaanders zien niets', async () => {
  const { f, d } = setup(); await d.setup();
  const edit = await d.input('revision.add', { kind: 'chapter', title: 'X', content: 'X', changeSummary: 'X' });
  assert.equal((await f.raw('user-2', 'revision.add', edit)).code, 'EDIT_DENIED');
  const e = await d.edition(), p = await d.preview(e);
  assert.equal((await f.raw('user-2', 'publication.confirm', await d.input('publication.confirm', { editionId: e, consentDigest: p.consentDigest }))).code, 'PUBLISH_DENIED');
  assert.equal(f.query('user-3', 'work', { workId: d.id() }).status, 404);
});
test('een edit-grant vervangt geen publish-grant', async () => {
  const { d } = setup(); const s = await d.setup();
  await d.command(d.B, 'rights.grant', grant(s.workId, d.B, d.A, { actions: ['edit'], supersedes: s.grants[1] }));
  const e = await d.edition(); assert.deepEqual((await d.preview(e)).missingRights, [d.B]);
});
test('geen willekeurige governance of publicatie zonder afspraak', async () => {
  const { f, d } = setup();
  await d.command(d.A, 'work.create', { title: 'W', type: 'poetry', language: 'nl' });
  const invalid = terms(d.A, d.B); delete invalid.decisionRule;
  assert.equal((await f.raw(d.A, 'agreement.propose', await d.input('agreement.propose', invalid))).code, 'GOVERNANCE_REQUIRED');
  await d.command(d.A, 'revision.add', { kind: 'poem', title: 'P', content: 'Woorden.', changeSummary: 'Nieuw.' });
  const e = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
  assert.equal((await f.raw(d.A, 'edition.freeze', await d.input('edition.freeze', { editionId: e.result.id }))).code, 'AGREEMENT_REQUIRED');
});
test('ingetrokken rechten blokkeren definitieve mutatie na een geldige preview', async () => {
  const { f, d } = setup(); const s = await d.setup(), e = await d.edition();
  await d.consent(d.A, e); await d.consent(d.B, e); const p = await d.preview(e);
  await d.command(d.B, 'rights.revoke', { grantId: s.grants[1], reason: 'Verlening ingetrokken.' });
  const out = await f.raw(d.A, 'publication.confirm', await d.input('publication.confirm', { editionId: e, consentDigest: p.consentDigest }));
  assert.equal(out.code, 'RIGHTS_MISSING'); assert.equal(Object.keys((await d.work()).releases).length, 0);
});
test('een ingetrokken instemming blokkeert release en beschikbaarheid, niet historie', async () => {
  const { f, d } = setup(); await d.setup(); const e = await d.edition();
  await d.consent(d.A, e); await d.consent(d.B, e); await d.release(e);
  const before = (await d.work()).editions[e].snapshotHash;
  await d.command(d.B, 'publication.revoke-consent', { editionId: e, reason: 'Nieuwe verspreiding stoppen.' });
  const out = f.query(d.A, 'edition', { workId: d.id(), editionId: e });
  assert.equal(out.available, false); assert.equal(out.edition.snapshotHash, before); assert.equal(out.edition.status, 'released');
});
test('freeze/release kunnen geen inhoud overschrijven; mutable draft beïnvloedt snapshot niet', async () => {
  const { f, d } = setup(); await d.setup(); const e = await d.edition(), before = M.canonical((await d.work()).editions[e]);
  const input = await d.input('edition.freeze', { editionId: e, content: 'Verborgen wijziging' });
  assert.equal((await f.raw(d.A, 'edition.freeze', input)).code, 'INVALID_INPUT');
  assert.equal((await f.raw(d.A, 'edition.freeze', await d.input('edition.freeze', { editionId: e }))).code, 'EDITION_IMMUTABLE');
  assert.equal(M.canonical((await d.work()).editions[e]), before);
  const view = f.query(d.A, 'edition', { workId: d.id(), editionId: e }); view.edition.snapshot.content[0].revision.content = 'X';
  assert.equal(M.canonical((await d.work()).editions[e]), before);
});
test('replay maakt geen tweede editie, gewijzigde replay wordt geweigerd', async () => {
  const { f, d } = setup(); await d.setup();
  const e = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
  assert.equal((await f.raw(d.A, 'edition.create', e.input)).replay, true);
  assert.equal((await f.raw(d.A, 'edition.create', { ...e.input, data: { ...e.input.data, changeSummary: 'Anders.' } })).code, 'REPLAY_CONFLICT');
  assert.equal(Object.keys((await d.work()).editions).length, 1);
});
test('opslagfout voor commit rolt alles terug, antwoordverlies na commit herstelt via replay', async () => {
  const { f, d } = setup(); await d.setup(); const before = M.canonical(f.db.data);
  const input = await d.input('edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
  f.fail('before'); assert.equal((await f.raw(d.A, 'edition.create', input)).code, 'OUTCOME_UNKNOWN');
  assert.equal(M.canonical(f.db.data), before);
  f.fail('after'); assert.equal((await f.raw(d.A, 'edition.create', input)).code, 'OUTCOME_UNKNOWN');
  f.fail(''); const replay = await f.raw(d.A, 'edition.create', input); assert.equal(replay.replay, true);
  assert.equal(Object.keys((await d.work()).editions).length, 1);
});
test('sessie-intrekking wordt onder het slot opnieuw gezien, ook bij replay', async () => {
  const { f, d } = setup(); await d.setup(); const input = await d.input('edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
  const pending = f.raw(d.A, 'edition.create', input); f.authority(false);
  assert.equal((await pending).code, 'AUTHORITY_REVOKED');
  f.authority(true); assert.equal((await f.raw(d.A, 'edition.create', input)).ok, true);
  f.authority(false); assert.equal((await f.raw(d.A, 'edition.create', input)).code, 'AUTHORITY_REVOKED');
});
test('gelijktijdige publicatie en intrekking hebben één geordende winnaar', async () => {
  for (const revokeFirst of [true, false]) {
    const { f, d } = setup(); const s = await d.setup(), e = await d.edition();
    await d.consent(d.A, e); await d.consent(d.B, e); const p = await d.preview(e);
    const revoke = await d.input('rights.revoke', { grantId: s.grants[1], reason: 'Stop.' });
    const release = await d.input('publication.confirm', { editionId: e, consentDigest: p.consentDigest });
    const calls = [() => f.raw(d.B, 'rights.revoke', revoke), () => f.raw(d.A, 'publication.confirm', release)];
    const out = await Promise.all((revokeFirst ? calls : calls.reverse()).map(fn => fn()));
    assert.equal(out.filter(x => x.ok).length, 1); assert.equal(out[1].code, 'STALE_REVISION');
    assert.equal(Object.keys((await d.work()).releases).length, revokeFirst ? 0 : 1);
  }
});
test('verlopen rechten, verkeerde taal en ontbrekende creditvoorwaarden blokkeren', async () => {
  const { f, d } = setup(); const s = await d.setup();
  await d.command(d.B, 'rights.grant', grant(s.workId, d.B, d.A, { supersedes: s.grants[1], conditions: { attributionRequired: true }, endsAt: '2026-10-04T00:00:00.000Z' }));
  const e = await d.edition(); assert.deepEqual((await d.preview(e)).missingRights, []);
  f.clock('2026-10-05T00:00:00.000Z'); assert.deepEqual((await d.preview(e)).missingRights, [d.B]);
  const fr = await d.command(d.A, 'edition.create', { language: 'fr', territory: 'WORLD', changeSummary: 'Frans.' });
  await d.command(d.A, 'edition.freeze', { editionId: fr.result.id });
  assert.deepEqual((await d.preview(fr.result.id)).missingRights, [d.A, d.B]);
});
test('conflict en nieuwe afspraak kunnen niet stil door oude instemming heen', async () => {
  const { f, d } = setup(); const s = await d.setup(), e = await d.edition();
  await d.command(d.B, 'agreement.conflict', { agreementId: s.agreementId, reason: 'Onenigheid over de uitgave.' });
  assert.equal(f.query(d.A, 'preview', { workId: d.id(), editionId: e }).code, 'BLOCKING_CONFLICT');
  const t = await d.command(d.A, 'agreement.propose', { ...terms(d.A, d.B), resolvesConflict: 'Nieuwe gezamenlijk beoordeelde afspraak.' });
  await d.command(d.A, 'agreement.accept', { agreementId: t.result.id, termsHash: t.result.termsHash });
  assert.equal((await d.work()).activeAgreementId, s.agreementId);
  await d.command(d.B, 'agreement.accept', { agreementId: t.result.id, termsHash: t.result.termsHash });
  assert.equal(f.query(d.A, 'preview', { workId: d.id(), editionId: e }).code, 'AGREEMENT_CHANGED');
});
test('organisatie gebruikt bestaande vertegenwoordiging; geen actor uit client', async () => {
  const { f, d } = setup();
  const create = await d.command(d.A, 'work.create', { title: 'Organisatiewerk', type: 'manual', language: 'nl', responsible: 'entiteit:ent_abcd' });
  assert.equal((await d.work()).responsible, 'entiteit:ent_abcd');
  const out = await f.raw(d.B, 'work.create', { ...create.input, operationId: d.key() }); assert.equal(out.code, 'AUTHORITY_DENIED');
  f.organizations['entiteit:ent_abcd'] = d.B;
  assert.equal(f.query(d.A, 'work', { workId: d.id() }).status, 404);
});
test('outbox herlevert na crash zonder dubbel gevolg bij idempotente ontvanger', async () => {
  const { f, d } = setup(); await d.setup(); const seen = new Set(); let calls = 0;
  const handle = async e => { calls++; seen.add(e.envelop.id); };
  f.fail('before'); await assert.rejects(f.library.deliver('library.test', handle));
  assert.equal(seen.size, 1); f.fail(''); await f.library.deliver('library.test', handle);
  assert.equal(seen.size, f.db.data.libraryKernel.journal.length); assert.equal(calls, seen.size + 1);
  const before = calls; await f.library.deliver('library.test', handle); assert.equal(calls, before);
});
test('corrupte snapshots en audit worden niet als bewezen gerapporteerd', async () => {
  const { f, d } = setup(); await d.setup(); const e = await d.edition();
  f.db.data.libraryKernel.journal[0].result.id = 'vervalst';
  assert.equal(f.query(d.A, 'proof', { workId: d.id() }).integrity, false);
  f.db.data.libraryKernel.works[d.id()].editions[e].snapshot.content[0].revision.content = 'vervalst';
  assert.equal(f.query(d.A, 'edition', { workId: d.id(), editionId: e }).code, 'INTEGRITY_FAILURE');
});
test('lezen schept niets; onduurzame opslag en onbekend schema weigeren veilig', async () => {
  const { f } = setup(); const before = M.canonical(f.db.data);
  assert.equal(f.query('user-1', 'work', { workId: 'missing' }).status, 404); assert.equal(M.canonical(f.db.data), before);
  const make = require('../server/kern/library');
  const memory = make({ db: f.db, store: 'json', identities: f.identities, bewerkCollectie: f.transaction });
  assert.equal((await memory.execute('user-1', 'work.create', { operationId: 'valid_operation_id', data: {} }, () => true)).code, 'STORAGE_UNAVAILABLE');
  f.db.data.libraryKernel = { schemaVersion: 99 };
  assert.equal(f.query('user-1', 'work', { workId: 'missing' }).code, 'SCHEMA_UNAVAILABLE');
});
test('vreemde grantor, scope, voorwaarden en brede AI-toestemming worden geweigerd', async () => {
  const { f, d } = setup(); await d.setup(); const before = M.canonical(f.db.data);
  const wrong = grant(d.id(), d.B, d.A);
  assert.equal((await f.raw(d.A, 'rights.grant', await d.input('rights.grant', wrong))).code, 'AUTHORITY_DENIED');
  for (const [extra, code] of [
    [{ actions: ['ai'], purpose: 'ai' }, 'UNSUPPORTED_RIGHT'],
    [{ actions: ['ai.training', 'ai.embeddings'], purpose: 'ai.training' }, 'AI_PURPOSE_REQUIRED'],
    [{ scope: { type: 'work', id: 'foreign-work' } }, 'INVALID_SCOPE'],
    [{ conditions: { attributionRequired: false, paid: true } }, 'INVALID_INPUT'],
    [{ authorityBasis: { kind: 'foundation-owner', statement: 'Ik ben de eigenaar van RTG.' } }, 'UNSUPPORTED_AUTHORITY_BASIS']
  ]) assert.equal((await f.raw(d.A, 'rights.grant', await d.input('rights.grant', grant(d.id(), d.A, d.A, extra)))).code, code);
  assert.equal(M.canonical(f.db.data), before);
});
test('editiegebonden recht voor editie 1 geldt niet voor editie 2', async () => {
  const { d } = setup(); const s = await d.setup();
  const first = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
  await d.command(d.B, 'rights.grant', grant(d.id(), d.B, d.A, { scope: { type: 'edition', id: first.result.id }, supersedes: s.grants[1] }));
  await d.command(d.A, 'edition.freeze', { editionId: first.result.id });
  assert.deepEqual((await d.preview(first.result.id)).missingRights, []);
  const second = await d.edition(first.result.id);
  assert.deepEqual((await d.preview(second)).missingRights, [d.B]);
});
test('nieuw bezwaar na samenwerkingsvoorstel kan niet door oude acceptatie verdwijnen', async () => {
  const { f, d } = setup(); const s = await d.setup();
  const next = await d.command(d.A, 'agreement.propose', terms(d.A, d.B));
  await d.command(d.B, 'agreement.conflict', { agreementId: s.agreementId, reason: 'Nieuw bezwaar.' });
  const result = await f.raw(d.A, 'agreement.accept', await d.input('agreement.accept', { agreementId: next.result.id, termsHash: next.result.termsHash }));
  assert.equal(result.code, 'CONFLICT_CHANGED');
  assert.equal((await d.work()).activeAgreementId, s.agreementId);
});
test('freeze, publicatie en intrekking tegelijk kunnen geen release zonder instemming maken', async () => {
  const { f, d } = setup(); const s = await d.setup();
  const e = await d.command(d.A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste.' });
  const freeze = await d.input('edition.freeze', { editionId: e.result.id });
  const release = await d.input('publication.confirm', { editionId: e.result.id, consentDigest: 'forged' });
  const revoke = await d.input('rights.revoke', { grantId: s.grants[1], reason: 'Stop.' });
  const result = await Promise.all([f.raw(d.A, 'edition.freeze', freeze), f.raw(d.A, 'publication.confirm', release), f.raw(d.B, 'rights.revoke', revoke)]);
  assert.equal(result.filter(x => x.ok).length, 1); assert.equal(Object.keys((await d.work()).releases).length, 0);
});
test('instemmingsgeschiedenis blijft bestaan na intrekken en opnieuw instemmen', async () => {
  const { d } = setup(); await d.setup(); const e = await d.edition();
  await d.consent(d.B, e); await d.command(d.B, 'publication.revoke-consent', { editionId: e, reason: 'Eerst opnieuw bekijken.' });
  await d.consent(d.B, e);
  assert.deepEqual((await d.work()).editions[e].consentHistory.map(c => c.status), ['accepted', 'revoked', 'accepted']);
});
