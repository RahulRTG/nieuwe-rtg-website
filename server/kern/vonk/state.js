'use strict';

const ProductState = require('../connection-product-state');
const VonkState = require('../connection-state-vonk');

module.exports = ({ d, mag, nu, geblokkeerd, communication }) => {
  function edge(key, input) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, code: 'PRODUCT_GATE_DENY', error: poort.reden };
    const b = input && typeof input === 'object' ? input : {};
    let productState, ander = null;
    const versies = { likes: d().likes.filter(x => x.van === key || x.naar === key).length,
      matches: d().matches.filter(x => x.a === key || x.b === key).length };
    if (b.context === 'discovery') productState = VonkState.discovery(d().profielen[key], versies);
    else if (b.id) {
      const m = d().matches.find(x => x.id === String(b.id) && (x.a === key || x.b === key));
      ander = m && (m.a === key ? m.b : m.a);
      productState = VonkState.match({ match: m, key, now: nu(), communication: m && communication ? {
        voice: communication.hasMutual(key, { id: m.id }, 'connection.voice'),
        video: communication.hasMutual(key, { id: m.id }, 'connection.video')
      } : null });
    } else productState = VonkState.root(d().profielen[key], versies);
    return ProductState.resolve({ actor: 'member', product: 'vonk', productState,
      access: { pass: 'member', verified: true, adult: true, blocked: !!(ander && geblokkeerd(key, ander)) },
      subject: key, context: { kind: b.context || (b.id ? 'match' : 'root'), id: b.id || null } });
  }

  function guard(key, input, capability, event) {
    const e = edge(key, input);
    return ProductState.guard({ edge: e, expectedRevision: input && input.stateRevision, capability,
      transition: e && !e.error && event ? VonkState.transition(e.state, event) : null });
  }
  return { vonkEdge: edge, vonkStateGuard: guard };
};
