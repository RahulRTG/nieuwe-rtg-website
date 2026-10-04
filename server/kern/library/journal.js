'use strict';
const M = require('./model'), envelope = require('../envelop');
const NAMES = { 'work.create': 'library.work.created', 'contribution.accept': 'library.contribution.accepted',
  'agreement.accept': 'library.agreement.accepted', 'edition.freeze': 'library.edition.frozen',
  'publication.confirm': 'library.publication.released', 'structure.reorder': 'library.structure.reordered',
  'feedback.create': 'library.feedback.created', 'feedback.decide': 'library.feedback.decided',
  'feedback.resolve': 'library.feedback.resolved' };
function append(ctx, result, operationId) {
  const { s, w, actor, action, at, receiptKey } = ctx;
  const eventId = 'libevt_' + receiptKey.slice(0, 32);
  const previous = s.journal.findLast(e => e.workId === w.id);
  const event = { sequence: s.journal.length + 1, workId: w.id, workRevision: w.revision,
    action, type: action === 'agreement.accept' && result.status !== 'accepted' ? 'library.agreement.party-accepted' : NAMES[action] || 'library.' + action,
    result: M.clone(result), inputHash: M.hash(ctx.data), stateHash: M.hash(w),
    policy: M.POLICY, operationId, actorRef: actor, previousHash: previous?.hash || null,
    envelop: envelope.maak({ id: eventId, at, kanaal: 'library', actor,
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
// A durable Library outbox over the same journal, not another event transport.
// Trusted consumers must commit/deduplicate envelop.id before resolving handle.
function outbox({ read, transaction }) {
  return async function deliver(consumer, handle, limit = 100) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle !== 'function') throw new Error('Invalid Library consumer');
    const s = read(), start = s.delivery[consumer] || 0;
    let cursor = start;
    for (const event of s.journal.filter(e => e.sequence > start).slice(0, Math.max(1, Math.min(limit, 100)))) {
      await handle(M.clone(event));
      await transaction(raw => {
        const current = M.state(raw);
        if ((current.delivery[consumer] || 0) < cursor) M.fail('CURSOR_CONFLICT', 'Herhaal de overdracht vanaf het duurzame checkpoint.', 409);
        if ((current.delivery[consumer] || 0) === cursor) {
          current.delivery[consumer] = event.sequence; Object.assign(raw, current);
        }
      });
      cursor = event.sequence;
    }
    return { deliveredThrough: cursor };
  };
}
module.exports = { append, verify, outbox };
