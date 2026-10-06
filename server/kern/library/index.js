'use strict';
const M = require('./model'), P = require('./policy'), journal = require('./journal');
const { requirements, publication } = require('./publication');
const { intact } = require('./editions');
const studio = require('./studio'), feedback = require('./feedback');
const education = require('./education');
const klok = require('../../lib/klok');
const handlers = {
  'work.create': require('./works'), 'revision.add': require('./works'),
  'contribution.invite': require('./agreements'), 'contribution.accept': require('./agreements'),
  'agreement.propose': require('./agreements'), 'agreement.accept': require('./agreements'), 'agreement.conflict': require('./agreements'),
  'rights.grant': require('./rights').rights, 'rights.revoke': require('./rights').rights,
  'structure.reorder': studio.command,
  'feedback.create': feedback.command, 'feedback.decide': feedback.command, 'feedback.resolve': feedback.command,
  'education.release': education.command, 'education.withdraw': education.command,
  'edition.create': require('./editions'), 'edition.freeze': require('./editions'),
  'edition.withdraw': require('./editions'), 'edition.warn': require('./editions'),
  'publication.consent': publication, 'publication.revoke-consent': publication, 'publication.confirm': publication
};
module.exports = function makeLibrary({ db, bewerkCollectie, store, identities, now, serviceProof }) {
  const own = require('../eigencollectie')({ db, domein: 'kern/library', bezit: { libraryKernel: 'kaart', libraryReader: 'kaart' } });
  const read = () => M.state(own.kijk('libraryKernel'));
  const time = now || (() => klok.datum().toISOString());
  const transaction = fn => {
    if (!bewerkCollectie || !['sqlite', 'postgres'].includes(store))
      M.fail('STORAGE_UNAVAILABLE', 'Deze handeling vereist duurzame collectietransacties.', 503);
    return bewerkCollectie('libraryKernel', fn);
  };
  function context(actor, s, workId, authority) {
    if (typeof authority !== 'function' || authority() !== true || !identities.exists(actor))
      M.fail('AUTHORITY_REVOKED', 'Uw toegang is niet meer geldig.', 401);
    return { actor, identities, s, w: workId ? M.get(s.works, workId) : null, at: time() };
  }
  const error = e => {
    if (e.library) return { error: e.message, status: e.status, code: e.code };
    return { error: 'De opslag heeft de uitkomst niet bevestigd. Herhaal dezelfde operatie-ID.', status: 503, code: 'OUTCOME_UNKNOWN' };
  };
  async function execute(actor, action, input, authority) {
    try {
      M.fields(input, ['operationId', 'workId', 'expectedRevision', 'data']);
      if (!Object.hasOwn(handlers, action)) M.fail('UNKNOWN_ACTION', 'Deze handeling bestaat niet.');
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(input.operationId || '')) M.fail('OPERATION_REQUIRED', 'Een geldige operatie-ID is vereist.', 428);
      if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data) || M.canonical(input.data).length > 100000)
        M.fail('INVALID_INPUT', 'Ongeldige of te grote invoer.');
      if (action === 'work.create' && input.workId) M.fail('INVALID_INPUT', 'Een nieuw werk heeft nog geen werk-ID.');
      const fingerprint = M.hash({ action, input }), receiptKey = M.hash([actor, input.operationId]);
      return await transaction(raw => {
        const s = M.state(raw), ctx = context(actor, s, input.workId, authority);
        const previous = s.receipts[receiptKey];
        if (previous) {
          P.readable({ ...ctx, w: M.get(s.works, previous.result.workId) });
          if (previous.fingerprint !== fingerprint) M.fail('REPLAY_CONFLICT', 'Deze operatie-ID hoort bij andere invoer.', 409);
          return { ...M.clone(previous.result), replay: true };
        }
        if (action !== 'work.create') {
          if (!ctx.w) M.fail('NOT_FOUND', 'Kies een werk.', 404);
          // An invitation grants only acceptance, not general draft access.
          if (action !== 'contribution.accept') P.readable(ctx);
          M.version(ctx.w, input.expectedRevision);
        }
        Object.assign(ctx, { action, data: M.clone(input.data), id: 'lib_' + receiptKey.slice(0, 32), receiptKey });
        if(action==='feedback.create'&&ctx.data.verificationOf&&!loopSource.hasReceipt(ctx.w.id,ctx.data.verificationOf))
          M.fail('CHANGE_RECEIPT_REQUIRED','De verificatie verwijst niet naar een source-issued Library ChangeReceipt.',409);
        const result = handlers[action](ctx);
        ctx.w.revision++; ctx.w.updatedAt = ctx.at; ctx.w.updatedBy = actor;
        const event = journal.append(ctx, result, input.operationId);
        const out = { ok: true, workId: ctx.w.id, revision: ctx.w.revision, result,
          auditRef: event.envelop.id, policy: M.POLICY, replay: false };
        s.receipts[receiptKey] = { fingerprint, result: M.clone(out) };
        // Never silently evict history, editions, pending events or replay receipts.
        if (Buffer.byteLength(M.canonical(s)) > 25 * 1024 * 1024)
          M.fail('CAPACITY', 'De kernelopslag vraagt onderhoud; er is niets verwijderd.', 503);
        Object.assign(raw, s); return out;
      });
    } catch (e) { return error(e); }
  }
  function query(actor, kind, input, authority) {
    try {
      M.fields(input, ['workId', 'editionId', 'releaseId']);
      const ctx = context(actor, read(), input.workId, authority);
      if (kind === 'context') return { ok: true, actorRef: actor, policy: M.POLICY };
      if (kind === 'work-list') {
        const works = Object.values(ctx.s.works).filter(w => P.member({ ...ctx, w })).map(w => ({
          id: w.id, title: w.title, description: w.description, type: w.type, originalLanguage: w.originalLanguage,
          lifecycle: w.lifecycle, revision: w.revision, updatedAt: w.updatedAt,
          editions: Object.values(w.editions).filter(e => e.status === 'released').length
        })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { ok: true, works };
      }
      if (!ctx.w) M.fail('NOT_FOUND', 'Kies een werk.', 404);
      P.readable(ctx);
      if (kind === 'work') return { ok: true, work: M.clone(ctx.w) };
      if (kind === 'workspace') return { ok: true, workspace: studio.workspace(ctx.w) };
      if (kind === 'feedback') return { ok: true, feedback: feedback.list(ctx.w, input.editionId) };
      if (kind === 'education-release') {
        const row=M.get(ctx.w.educationReleases,input.releaseId);return {ok:true,educationRelease:M.clone(row)};
      }
      if (kind === 'proof') {
        const events = ctx.s.journal.filter(e => e.workId === ctx.w.id);
        Object.values(ctx.w.editions).filter(e => e.status !== 'draft').forEach(intact);
        return { ok: true, events, integrity: journal.verify(events) && events.at(-1)?.stateHash === M.hash(ctx.w),
          scope: 'local-chain-current-state-and-edition-content-not-external-anchoring' };
      }
      const e = M.get(ctx.w.editions, input.editionId);
      if (kind === 'preview') return { ok: true, ...requirements(ctx, e) };
      if (kind !== 'edition') M.fail('UNKNOWN_QUERY', 'Onbekende leesvraag.');
      if (e.status !== 'draft') intact(e);
      let rightsStatus = 'not-evaluated';
      try { rightsStatus = requirements(ctx, e).ready ? 'current' : 'restricted'; }
      catch (err) { if (!err.library || err.status >= 500) throw err; rightsStatus = 'restricted'; }
      return { ok: true, edition: M.clone(e), rightsStatus,
        available: e.status === 'released' && e.distribution.status === 'released' && rightsStatus === 'current' };
    } catch (e) { return error(e); }
  }
  const reader = require('./reader')({ own, bewerkCollectie, store, identities, libraryRead: read, now: time });
  const deliver=journal.outbox({read,transaction});
  const loopSource=require('./loop-source')({read,deliver,identities,time,serviceProof});
  const educationResolve=education.resolver({read,time});
  return { execute, query, reader, deliver, loopSource, education:{resolve:educationResolve} };
};
