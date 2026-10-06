/* Transactional-outbox/inbox primitive. De aanroeper zet enqueue samen met de
   domeinmutatie in zijn bestaande commit; consumers dedupliceren vóór effect. */
'use strict';

const { hash, kopie, bevries } = require('./canon');

function maakTransport(opties) {
  const o = opties || {}, vasteOutbox = o.outbox || [], vasteInbox = o.inbox || [];
  const outbox = () => typeof o.outboxFor === 'function' ? o.outboxFor() : vasteOutbox;
  const inbox = () => typeof o.inboxFor === 'function' ? o.inboxFor() : vasteInbox;
  const save = typeof o.save === 'function' ? o.save : () => {};
  const nu = o.nu || (() => new Date().toISOString());

  function lijst(v, naam) {
    if (!Array.isArray(v)) throw new Error('bewijsvlak ' + naam + ': state ontbreekt');
    return v;
  }

  function enqueue(event) {
    if (!event || !event.id || !event.type || !event.chainId) throw new Error('bewijsvlak outbox: id, type en chainId zijn verplicht');
    const doos = lijst(outbox(), 'outbox');
    const payloadHash = hash(event.payload === undefined ? null : event.payload);
    const eerder = doos.find(x => x.id === event.id);
    if (eerder) {
      if (eerder.payloadHash !== payloadHash) throw Object.assign(new Error('event-id hoort bij andere inhoud'), { code: 'IDEMPOTENCY_CONFLICT' });
      return { event: kopie(eerder), replay: true };
    }
    const rij = bevries({ id: event.id, type: event.type, chainId: event.chainId,
      causedBy: event.causedBy || null, payloadHash, payload: kopie(event.payload),
      state: 'PENDING', attempts: 0, nextAt: event.nextAt || nu(), createdAt: nu() });
    doos.push(rij);
    try { save(); }
    catch (error) { const i = doos.indexOf(rij); if (i >= 0) doos.splice(i, 1); throw error; }
    return { event: kopie(rij), replay: false };
  }

  function vervang(id, wijzig) {
    const doos = lijst(outbox(), 'outbox');
    const i = doos.findIndex(x => x.id === id); if (i < 0) return null;
    const oud = doos[i], nieuw = bevries(Object.assign({}, oud, wijzig));
    doos[i] = nieuw;
    try { save(); } catch (error) { if (doos[i] === nieuw) doos[i] = oud; throw error; }
    return kopie(nieuw);
  }
  function due(at) { const t = at || nu(); return lijst(outbox(), 'outbox').filter(x => x.state === 'PENDING' && x.nextAt <= t).map(kopie); }
  function sent(id, providerRef) { return vervang(id, { state: 'SENT', sentAt: nu(), providerRef: providerRef || null }); }
  function failed(id, receipt) { return vervang(id, { state: receipt.delayMs == null ? 'DEAD' : 'PENDING',
    attempts: receipt.attempt, nextAt: receipt.delayMs == null ? null : new Date(Date.parse(nu()) + receipt.delayMs).toISOString(),
    lastFailure: kopie(receipt) }); }

  async function consume(event, handler) {
    if (!event || !event.id) throw new Error('bewijsvlak inbox: event-id ontbreekt');
    const doos = lijst(inbox(), 'inbox');
    const payloadHash = hash(event.payload === undefined ? null : event.payload);
    const eerder = doos.find(x => x.id === event.id);
    if (eerder) {
      if (eerder.payloadHash !== payloadHash) throw Object.assign(new Error('event-id hoort bij andere inhoud'), { code: 'IDEMPOTENCY_CONFLICT' });
      return { replay: true, result: kopie(eerder.result) };
    }
    const result = await handler(kopie(event));
    const rij = bevries({ id: event.id, payloadHash, consumedAt: nu(), result: kopie(result) });
    doos.push(rij);
    try { save(); }
    catch (error) { const i = doos.indexOf(rij); if (i >= 0) doos.splice(i, 1); throw error; }
    return { replay: false, result };
  }

  return Object.freeze({ enqueue, due, sent, failed, consume,
    stand: () => {
      const uit = lijst(outbox(), 'outbox'), inLijst = lijst(inbox(), 'inbox');
      return { pending: uit.filter(x => x.state === 'PENDING').length,
        dead: uit.filter(x => x.state === 'DEAD').length, sent: uit.filter(x => x.state === 'SENT').length,
        consumed: inLijst.length };
    } });
}

module.exports = { maakTransport };
