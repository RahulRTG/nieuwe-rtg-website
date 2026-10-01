'use strict';

const Consent = require('./connection-consent');
const trustAuthority = require('./bewijsvlak/v3-authority-hook');
const CALL_TYPES = Object.freeze({ voice: 'connection.voice', video: 'connection.video' });

module.exports = function maakConnectionCommunication({ product, db, save, crypto, media, schoon,
  resolveContext, isBlocked, notify, signal, ticketSecret }) {
  const rates = new Map();
  const now = () => new Date().toISOString();
  const eigen = require('./eigencollectie')({ db, domein: 'kern/connection-communication',
    bezit: { connectionCommunication: 'kaart' } });
  const root = () => {
    const r = eigen.bak('connectionCommunication', b => Object.assign(b,
      { messages: [], media: [], calls: [], consent: {} }));
    for (const k of ['messages', 'media', 'calls', 'reports']) if (!Array.isArray(r[k])) r[k] = [];
    if (!r.consent || typeof r.consent !== 'object') r.consent = {};
    return r;
  };
  const id = prefix => prefix + crypto.randomBytes(9).toString('hex');
  const pair = (a, b) => [a, b].sort().join('|');
  const context = (actor, input) => {
    const c = resolveContext(actor, input || {});
    if (!c || !c.counterpart || !c.scope) return null;
    if (isBlocked(actor, c.counterpart)) return null;
    return { counterpart: c.counterpart, scope: String(c.scope), pair: pair(actor, c.counterpart) };
  };
  const binding = (actor, counterpart, scope, capability) => ({ actor, counterpart,
    purpose: product + '.communication', capability, scope, version: 1 });
  const mutual = (r, actor, c, capability) => Consent.wederzijds(r.consent,
    binding(actor, c.counterpart, c.scope, capability),
    binding(c.counterpart, actor, c.scope, capability), now()) === Consent.MUTUAL_STATES.MUTUAL;
  const own = (r, actor, c, capability) => Consent.actief(r.consent,
    binding(actor, c.counterpart, c.scope, capability), now());

  function limit(actor, kind, maximum, ms) {
    const k = actor + ':' + kind, t = Date.now();
    const xs = (rates.get(k) || []).filter(x => x > t - ms);
    if (xs.length >= maximum) return false;
    xs.push(t); rates.set(k, xs); return true;
  }
  const mediaService = require('./connection-communication-media')({ product, root, media, crypto,
    ticketSecret, context, isBlocked, limit, save, id, now });
  const calls = require('./connection-communication-call')({ product, root, save, id, now, context, mutual,
    limit, isBlocked, schoon, ping, types:CALL_TYPES });
  function projectMessage(m, viewer) {
    const out = { id: m.id, kind: m.kind, mine: m.from === viewer, at: m.at };
    if (m.kind === 'text') out.text = m.text;
    if (m.mediaId) out.media = mediaService.project(m.mediaId, viewer, m.scope);
    return out;
  }
  function communicationStatus(actor, input) {
    const c = context(actor, input);
    if (!c) return { status: 404, code: 'CONNECTION_CONTEXT_NOT_FOUND', error: 'Dit gesprek bestaat niet.' };
    const r = root();
    const messages = r.messages.filter(x => x.product === product && x.scope === c.scope && x.pair === c.pair)
      .slice(-100).map(x => projectMessage(x, actor));
    const call = r.calls.slice().reverse().find(x => x.product === product && x.scope === c.scope &&
      x.pair === c.pair && ['RINGING', 'ACTIVE'].includes(x.state));
    return { status: 200, scope: c.scope, messages, ownConsent: {
      voice: own(r, actor, c, CALL_TYPES.voice), video: own(r, actor, c, CALL_TYPES.video)
    }, consent: {
      voice: mutual(r, actor, c, CALL_TYPES.voice), video: mutual(r, actor, c, CALL_TYPES.video)
    }, call: call ? { id: call.id, type: call.type, state: call.state, incoming: call.from !== actor,
      revision: call.revision } : null };
  }
  function consent(actor, input, capability, active) {
    if (!Object.values(CALL_TYPES).includes(capability))
      return { status: 400, error: 'Onbekende toestemming.' };
    const c = context(actor, input); if (!c) return { status: 404, error: 'Dit gesprek bestaat niet.' };
    const r = root(), b = binding(actor, c.counterpart, c.scope, capability);
    if (active === false) Consent.revoke(r.consent, b, { at: now() });
    else Consent.grant(r.consent, b, { at: now() });
    const gesloten = active === false
      ? calls.close(c, capability === CALL_TYPES.video ? 'video' : 'voice', 'CONSENT_REVOKED') : 0;
    save(); ping(c.counterpart, 'consent', c.scope);
    if (active === false) trustAuthority.propagated(b, now(), { activeSessionsClosed: gesloten,
      storageRevision: (Consent.record(r.consent, b) || {}).revision || null });
    return communicationStatus(actor, input);
  }
  function sendText(actor, input, value) {
    const c = context(actor, input); if (!c) return { status: 404, error: 'Dit gesprek bestaat niet.' };
    const text = schoon(value, 1200); if (!text) return { status: 400, error: 'Schrijf eerst een bericht.' };
    if (!limit(actor, 'message', 40, 60000)) return { status: 429, error: 'Wacht even voordat u opnieuw verstuurt.' };
    root().messages.push({ id: id('ccm'), product, scope: c.scope, pair: c.pair, from: actor,
      to: c.counterpart, kind: 'text', text, at: now() });
    root().messages = root().messages.slice(-10000); save(); ping(c.counterpart, 'message', c.scope);
    return { status: 200, ok: true };
  }
  const messageActions = require('./connection-communication-actions')({ product, root, context, media,
    schoon, save, ping, id, now, pair });
  async function sendMedia(actor, input, bytes, mime, kind, idem, transcript) {
    const c = context(actor, input); if (!c) return { status: 404, error: 'Dit gesprek bestaat niet.' };
    const out = await mediaService.upload(actor, c, bytes, mime, kind, idem, projectMessage, transcript);
    if (out.error) return out;
    ping(c.counterpart, 'message', c.scope);
    return out;
  }
  function ping(actor, kind, scope, callId) {
    try { if (signal) signal(actor, 'connection', { product, kind, scope, ...(callId ? { callId } : {}) }); } catch (e) {}
    try { if (notify && kind === 'call') notify(actor, { title: product === 'vonk' ? 'Vonk' : 'Rendez-vous', body: 'Er is een oproep voor u.', scope: 'lifestyle' }); } catch (e) {}
  }
  const deliver = token => mediaService.deliver(token);
  return { status:communicationStatus, consent, sendText, sendMedia, ...messageActions, startCall:calls.start, answer:calls.answer,
    sendSignal:calls.signal, poll:calls.poll, end:calls.end, deliver,
    hasMutual: (actor, input, capability) => { const c = context(actor, input); return !!(c && mutual(root(), actor, c, capability)); },
    CALL_TYPES, MEDIA_TYPES: mediaService.MEDIA_TYPES };
};
