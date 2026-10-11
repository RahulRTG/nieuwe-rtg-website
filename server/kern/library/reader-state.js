'use strict';

const M = require('./model'), envelope = require('../envelop');

function emptyReaderState() { return { schemaVersion: 1, readers: {}, receipts: {}, journal: [] }; }
function readerState(raw) {
  if (!Object.keys(raw).length) return emptyReaderState();
  if (raw.schemaVersion !== 1 || !raw.readers || !raw.receipts || !Array.isArray(raw.journal))
    M.fail('SCHEMA_UNAVAILABLE', 'De persoonlijke leesopslag heeft een onbekende versie.', 503);
  return M.clone(raw);
}
function appendReaderEvent(s, actor, action, inputHash, result, at, operationId, workId, editionId) {
  const previous = s.journal.findLast(e => e.actorRef === actor);
  const eventId = 'libread_' + M.hash([actor, operationId]).slice(0, 32);
  const event = { sequence: s.journal.length + 1, actorRef: actor, workId, editionId, action,
    type: 'library.reader.' + action, inputHash, result: M.clone(result), previousHash: previous?.hash || null,
    at, envelop: envelope.maak({ id: eventId, at, kanaal: 'library-reader', actor,
      correlatie: previous?.envelop.correlatie || eventId, oorzaak: previous?.envelop.id || null,
      classificatie: 'persoonsgegeven' }) };
  event.hash = M.hash(event); s.journal.push(event); return event;
}
function verifyReaderJournal(events) {
  let previous = null;
  for (const event of events) {
    const { hash, ...body } = event;
    if (body.previousHash !== previous || M.hash(body) !== hash) return false;
    previous = hash;
  }
  return true;
}

module.exports = { readerState, appendReaderEvent, verifyReaderJournal };
