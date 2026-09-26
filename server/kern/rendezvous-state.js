'use strict';

const ProductState = require('./connection-product-state');
const RendezvousState = require('./connection-state-rendezvous');

module.exports = ({ R, mag, nu, geblokkeerd, ontdek, samen, matchesVan, communication }) => {
  const paar = (a, b) => [a, b].sort().join('|');
  function edge(key, input) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, code: 'PRODUCT_GATE_DENY', error: poort.reden };
    const b = input && typeof input === 'object' ? input : {};
    const r = R();
    let productState = null, targetKey = null;
    if (b.kind === 'candidate') {
      targetKey = String(b.id || '');
      if (targetKey && geblokkeerd(r, key, targetKey))
        return { status: 403, code: 'BLOCKED', error: 'Dit contact is geblokkeerd.' };
      const rij = (ontdek.rvKandidaten(key).kandidaten || []).find(x => x.id === targetKey);
      if (rij && rij.status === 'match') productState = RendezvousState.match({
        proposal: (r.voorstellen || {})[paar(key, targetKey)], key, targetKey,
        together: samen.rvPartnerVan(key) === targetKey, now: nu(), communication: communication ? {
          voice: communication.hasMutual(key, { id: targetKey }, 'connection.voice'),
          video: communication.hasMutual(key, { id: targetKey }, 'connection.video') } : null
      });
      else if (rij) productState = RendezvousState.candidate(r.profielen[targetKey],
        { status: rij.status, likedMe: !!rij.likteMij });
    } else if (b.kind === 'match') {
      targetKey = String(b.id || '');
      const m = matchesVan(key).find(x => x.id === targetKey);
      if (m) productState = RendezvousState.match({ proposal: (r.voorstellen || {})[paar(key, targetKey)],
        key, targetKey, together: samen.rvPartnerVan(key) === targetKey, now: nu(), communication: communication ? {
          voice: communication.hasMutual(key, { id: targetKey }, 'connection.voice'),
          video: communication.hasMutual(key, { id: targetKey }, 'connection.video') } : null });
    } else if (b.kind === 'introduction') {
      const intro = (r.introducties || {})[String(b.id || '')];
      if (intro) {
        const delen = intro.id.split('|');
        if (delen.includes(key)) {
          targetKey = delen[0] === key ? delen[1] : delen[0];
          productState = RendezvousState.introduction(intro, key, communication ? {
            voice: communication.hasMutual(key, { id: intro.id }, 'connection.voice'),
            video: communication.hasMutual(key, { id: intro.id }, 'connection.video') } : null);
        }
      }
    } else if (b.kind === 'table') productState = RendezvousState.table((r.tafels || {})[String(b.id || '')], key);
    else if (b.kind === 'encounter') productState = RendezvousState.encounter(false);
    else if (b.kind === 'relationship') {
      targetKey = String(b.id || '');
      const p = r.profielen[targetKey];
      if (p && p.aan && targetKey !== key) productState = RendezvousState.relationship(p);
    } else if (b.kind === 'together') {
      const own = (r.samen || {})[key];
      targetKey = own && own.met;
      productState = own ? RendezvousState.together(own.met) : null;
    } else productState = RendezvousState.root(r.profielen[key]);
    return ProductState.resolve({ actor: 'member', product: 'rendezvous', productState,
      access: { pass: 'lifestyle', verified: true, adult: true,
        blocked: !!(targetKey && geblokkeerd(r, key, targetKey)) }, subject: key,
      context: { kind: b.kind || 'root', id: b.id || null } });
  }

  function guard(key, input, capability, event, facts) {
    const e = edge(key, input);
    return ProductState.guard({ edge: e, expectedRevision: input && input.stateRevision, capability,
      transition: e && !e.error && event ? RendezvousState.transition(e.state, event, facts) : null });
  }
  return { rvEdge: edge, rvStateGuard: guard };
};
