'use strict';
const M = require('./model'), P = require('./policy'), envelope = require('../envelop');
const klok = require('../../lib/klok');

function empty() { return { schemaVersion: 1, readers: {}, receipts: {}, journal: [] }; }
function state(raw) {
  if (!Object.keys(raw).length) return empty();
  if (raw.schemaVersion !== 1 || !raw.readers || !raw.receipts || !Array.isArray(raw.journal))
    M.fail('SCHEMA_UNAVAILABLE', 'De persoonlijke leesopslag heeft een onbekende versie.', 503);
  return M.clone(raw);
}

module.exports = function makeReader({ own, bewerkCollectie, store, identities, libraryRead, now }) {
  const time = now || (() => klok.datum().toISOString());
  const read = () => state(own.kijk('libraryReader'));
  const transaction = fn => {
    if (!bewerkCollectie || !['sqlite', 'postgres'].includes(store))
      M.fail('STORAGE_UNAVAILABLE', 'Deze handeling vereist duurzame collectietransacties.', 503);
    return bewerkCollectie('libraryReader', fn);
  };
  const failure = e => e.library ? { error: e.message, status: e.status, code: e.code } :
    { error: 'De opslag heeft de uitkomst niet bevestigd. Herhaal dezelfde operatie-ID.', status: 503, code: 'OUTCOME_UNKNOWN' };
  function access(actor, workId, editionId, authority) {
    if (typeof authority !== 'function' || authority() !== true || !identities.exists(actor))
      M.fail('AUTHORITY_REVOKED', 'Uw toegang is niet meer geldig.', 401);
    const library = libraryRead(), work = M.get(library.works, workId);
    P.readable({ actor, identities, s: library, w: work, at: time() });
    const edition = M.get(work.editions, editionId);
    if (edition.status !== 'released') M.fail('RELEASE_REQUIRED', 'Deze editie is nog niet vrijgegeven.', 409);
    require('./editions').intact(edition);
    return { work, edition };
  }
  const reader = (s, actor) => s.readers[actor] || { revision: 0, editions: {} };
  const shelf = (r, workId, editionId) => r.editions[editionId] || { workId, editionId,
    progress: null, bookmarks: {}, highlights: {}, notes: {}, updatedAt: null };
  function append(s, actor, action, inputHash, result, at, operationId, workId, editionId) {
    const previous = s.journal.findLast(e => e.actorRef === actor);
    const eventId = 'libread_' + M.hash([actor, operationId]).slice(0, 32);
    const event = { sequence: s.journal.length + 1, actorRef: actor, workId, editionId, action,
      type: 'library.reader.' + action, inputHash, result: M.clone(result), previousHash: previous?.hash || null,
      at, envelop: envelope.maak({ id: eventId, at, kanaal: 'library-reader', actor,
        correlatie: previous?.envelop.correlatie || eventId, oorzaak: previous?.envelop.id || null,
        classificatie: 'persoonsgegeven' }) };
    event.hash = M.hash(event); s.journal.push(event); return event;
  }
  function verify(events) {
    let previous = null;
    for (const event of events) {
      const { hash, ...body } = event;
      if (body.previousHash !== previous || M.hash(body) !== hash) return false;
      previous = hash;
    }
    return true;
  }
  async function execute(actor, action, input, authority) {
    try {
      M.fields(input, ['operationId', 'workId', 'editionId', 'expectedRevision', 'data']);
      if (!['progress.set', 'bookmark.put', 'bookmark.remove', 'highlight.put', 'highlight.remove', 'note.put', 'note.remove'].includes(action))
        M.fail('UNKNOWN_ACTION', 'Deze leeshandeling bestaat niet.');
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(input.operationId || '')) M.fail('OPERATION_REQUIRED', 'Een geldige operatie-ID is vereist.', 428);
      if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) M.fail('INVALID_INPUT', 'Ongeldige invoer.');
      const fingerprint = M.hash({ action, input }), receiptKey = M.hash([actor, input.operationId]);
      return await transaction(raw => {
        const { edition } = access(actor, input.workId, input.editionId, authority), s = state(raw);
        const old = s.receipts[receiptKey];
        if (old) {
          if (old.fingerprint !== fingerprint) M.fail('REPLAY_CONFLICT', 'Deze operatie-ID hoort bij andere invoer.', 409);
          return { ...M.clone(old.result), replay: true };
        }
        const r = reader(s, actor);
        if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== r.revision)
          M.fail('STALE_REVISION', 'Open de actuele leesstaat.', 409);
        const item = shelf(r, input.workId, input.editionId), d = input.data, id = 'reading_' + receiptKey.slice(0, 24), at = time();
        const node = nodeId => {
          const n = edition.snapshot.content.find(x => x.nodeId === nodeId);
          if (!n) M.fail('NOT_FOUND', 'Dit inhoudsanker staat niet in de editie.', 404);
          return n;
        };
        let result;
        if (action === 'progress.set') {
          M.fields(d, ['nodeId', 'fraction']); node(d.nodeId);
          if (typeof d.fraction !== 'number' || d.fraction < 0 || d.fraction > 1) M.fail('INVALID_INPUT', 'Voortgang ligt tussen 0 en 1.');
          item.progress = { nodeId: d.nodeId, fraction: Math.round(d.fraction * 1000) / 1000, at }; result = item.progress;
        } else if (action === 'bookmark.put') {
          M.fields(d, ['nodeId', 'label']); const n = node(d.nodeId);
          item.bookmarks[id] = { id, nodeId: n.nodeId, revisionHash: n.revision.hash, label: M.text(d.label || '', 200, false), at };
          result = item.bookmarks[id];
        } else if (action === 'bookmark.remove') {
          M.fields(d, ['bookmarkId']); M.get(item.bookmarks, d.bookmarkId); delete item.bookmarks[d.bookmarkId]; result = { id: d.bookmarkId };
        } else if (action === 'highlight.put') {
          M.fields(d, ['nodeId', 'start', 'end']); const n = node(d.nodeId), content = n.revision.content;
          if (!Number.isSafeInteger(d.start) || !Number.isSafeInteger(d.end) || d.start < 0 || d.end <= d.start || d.end > content.length || d.end - d.start > 2000)
            M.fail('INVALID_INPUT', 'De markering valt buiten de vastgelegde tekst.');
          item.highlights[id] = { id, nodeId: n.nodeId, revisionHash: n.revision.hash, start: d.start, end: d.end,
            excerptHash: M.hash(content.slice(d.start, d.end)), at }; result = item.highlights[id];
        } else if (action === 'highlight.remove') {
          M.fields(d, ['highlightId']); M.get(item.highlights, d.highlightId); delete item.highlights[d.highlightId]; result = { id: d.highlightId };
        } else if (action === 'note.put') {
          M.fields(d, ['nodeId', 'noteId', 'content']); const n = node(d.nodeId), noteId = d.noteId || id;
          if (d.noteId) M.get(item.notes, noteId);
          item.notes[noteId] = { id: noteId, nodeId: n.nodeId, revisionHash: n.revision.hash,
            content: M.text(d.content, 4000), at }; result = item.notes[noteId];
        } else {
          M.fields(d, ['noteId']); M.get(item.notes, d.noteId); delete item.notes[d.noteId]; result = { id: d.noteId };
        }
        item.updatedAt = at; r.editions[input.editionId] = item; r.revision++; s.readers[actor] = r;
        const event = append(s, actor, action, M.hash(d), result, at, input.operationId, input.workId, input.editionId);
        const out = { ok: true, revision: r.revision, result: M.clone(result), auditRef: event.envelop.id, replay: false };
        s.receipts[receiptKey] = { fingerprint, result: M.clone(out), workId: input.workId, editionId: input.editionId };
        if (Buffer.byteLength(M.canonical(s)) > 10 * 1024 * 1024) M.fail('CAPACITY', 'Uw leesopslag vraagt onderhoud; er is niets verwijderd.', 503);
        Object.assign(raw, s); return out;
      });
    } catch (e) { return failure(e); }
  }
  function query(actor, kind, input, authority) {
    try {
      M.fields(input, kind === 'search' ? ['workId', 'editionId', 'query'] : ['workId', 'editionId']);
      const { work, edition } = access(actor, input.workId, input.editionId, authority);
      if (kind === 'open') return { ok: true, work: { id: work.id, title: work.title, type: work.type },
        edition: { id: edition.id, language: edition.language, contentHash: edition.contentHash,
          warnings: M.clone(edition.warnings), distribution: M.clone(edition.distribution),
          nodes: M.clone(edition.snapshot.content) } };
      if (kind === 'state') {
        const r = reader(read(), actor); return { ok: true, revision: r.revision,
          state: M.clone(shelf(r, work.id, edition.id)) };
      }
      if (kind === 'proof') {
        const events = read().journal.filter(e => e.actorRef === actor && e.editionId === edition.id);
        return { ok: true, events, integrity: verify(read().journal.filter(e => e.actorRef === actor)),
          scope: 'personal-reader-local-hash-chain-not-independent-anchoring' };
      }
      if (kind === 'search') {
        const q = M.text(input.query, 120).toLocaleLowerCase();
        const matches = [];
        for (const n of edition.snapshot.content) {
          const title = n.revision.title.toLocaleLowerCase(), hay = n.revision.content.toLocaleLowerCase();
          if (title.includes(q)) matches.push({ nodeId: n.nodeId, revisionHash: n.revision.hash,
            offset: 0, field: 'title', excerpt: n.revision.title });
          let from = 0, at;
          while ((at = hay.indexOf(q, from)) >= 0 && matches.length < 100) {
            matches.push({ nodeId: n.nodeId, revisionHash: n.revision.hash, offset: at, field: 'content',
              excerpt: n.revision.content.slice(Math.max(0, at - 60), Math.min(n.revision.content.length, at + q.length + 100)) });
            from = at + Math.max(1, q.length);
          }
        }
        return { ok: true, matches };
      }
      M.fail('UNKNOWN_QUERY', 'Onbekende leesvraag.');
    } catch (e) { return failure(e); }
  }
  return { execute, query };
};
