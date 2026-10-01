/* Transactional-outbox/inbox primitive. De aanroeper zet enqueue samen met de
   domeinmutatie in zijn bestaande commit; consumers dedupliceren vóór effect. */
'use strict';

const { hash, kopie, bevries } = require('./canon');

function maakTransport(opties) {
  const o = opties || {}, outbox = o.outbox || [], inbox = o.inbox || [];
  const save = typeof o.save === 'function' ? o.save : () => {};
  const nu = o.nu || (() => new Date().toISOString());

  function enqueue(event) {
    if (!event || !event.id || !event.type || !event.chainId) throw new Error('bewijsvlak outbox: id, type en chainId zijn verplicht');
    const payloadHash = hash(event.payload === undefined ? null : event.payload);
    const eerder = outbox.find(x => x.id === event.id);
    if (eerder) {
      if (eerder.payloadHash !== payloadHash) throw Object.assign(new Error('event-id hoort bij andere inhoud'), { code: 'IDEMPOTENCY_CONFLICT' });
      return { event: kopie(eerder), replay: true };
    }
    const rij = bevries({ id: event.id, type: event.type, chainId: event.chainId,
      causedBy: event.causedBy || null, payloadHash, payload: kopie(event.payload),
      state: 'PENDING', attempts: 0, nextAt: event.nextAt || nu(), createdAt: nu() });
    outbox.push(rij); save(); return { event: kopie(rij), replay: false };
  }

  function vervang(id, wijzig) {
    const i = outbox.findIndex(x => x.id === id); if (i < 0) return null;
    outbox[i] = bevries(Object.assign({}, outbox[i], wijzig)); save(); return kopie(outbox[i]);
  }
  function due(at) { const t = at || nu(); return outbox.filter(x => x.state === 'PENDING' && x.nextAt <= t).map(kopie); }
  function sent(id, providerRef) { return vervang(id, { state: 'SENT', sentAt: nu(), providerRef: providerRef || null }); }
  function failed(id, receipt) { return vervang(id, { state: receipt.delayMs == null ? 'DEAD' : 'PENDING',
    attempts: receipt.attempt, nextAt: receipt.delayMs == null ? null : new Date(Date.parse(nu()) + receipt.delayMs).toISOString(),
    lastFailure: kopie(receipt) }); }

  async function consume(event, handler) {
    if (!event || !event.id) throw new Error('bewijsvlak inbox: event-id ontbreekt');
    const payloadHash = hash(event.payload === undefined ? null : event.payload);
    const eerder = inbox.find(x => x.id === event.id);
    if (eerder) {
      if (eerder.payloadHash !== payloadHash) throw Object.assign(new Error('event-id hoort bij andere inhoud'), { code: 'IDEMPOTENCY_CONFLICT' });
      return { replay: true, result: kopie(eerder.result) };
    }
    const result = await handler(kopie(event));
    inbox.push(bevries({ id: event.id, payloadHash, consumedAt: nu(), result: kopie(result) }));
    save(); return { replay: false, result };
  }

  return Object.freeze({ enqueue, due, sent, failed, consume,
    stand: () => ({ pending: outbox.filter(x => x.state === 'PENDING').length,
      dead: outbox.filter(x => x.state === 'DEAD').length, sent: outbox.filter(x => x.state === 'SENT').length,
      consumed: inbox.length }) });
}

module.exports = { maakTransport };
