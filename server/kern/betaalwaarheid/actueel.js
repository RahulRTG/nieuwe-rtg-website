/* Een collectietransactie mag de volledige BW-map publiceren. Objectidentiteit
   over een await is daarom geen eigenaarsbewijs. Houd een inhoudelijk anker en
   lees de huidige rij: dezelfde economische opdracht, geen teruggedraaide
   geschiedenis. Een conflict wordt niet met een oud object overschreven. */
'use strict';
const { OVERGANGEN } = require('./staten');
const canon = x => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v);
const identiteit = r => canon(['id', 'actor', 'idemHash', 'soort', 'bronRef', 'supplierCode',
  'centen', 'valuta', 'context', 'aangemaaktAt'].map(k => r[k]));
function bereikt(van, naar) {
  const gezien = new Set(), rij = [van];
  while (rij.length) {
    const s = rij.shift(); if (s === naar) return true;
    if (!gezien.has(s)) { gezien.add(s); rij.push(...(OVERGANGEN[s] || [])); }
  }
  return false;
}
function conflict() {
  return Object.assign(new Error('De actuele betaalwaarheid wijkt af van de lopende opdracht; herstel is nodig.'),
    { code: 'BETAALWAARHEID_PUBLICATIE_CONFLICT' });
}
module.exports = doos => function anker(r) {
  const id = r.id, vast = identiteit(r), status = r.status, start = r.start && canon(r.start);
  const history = (r.gebeurtenissen || []).map(canon);
  const provider = r.provider, providerId = r.providerId, paymentId = r.providerPaymentId;
  const klaar = r.afgehandeldAt;
  return () => {
    const map = doos(), nu = Object.hasOwn(map, id) && map[id], events = nu && nu.gebeurtenissen;
    if (!nu || identiteit(nu) !== vast || !bereikt(status, nu.status) ||
        start && canon(nu.start) !== start || provider && nu.provider !== provider ||
        providerId && nu.providerId !== providerId || paymentId && nu.providerPaymentId !== paymentId ||
        klaar && nu.afgehandeldAt !== klaar || !Array.isArray(events) || events.length < history.length ||
        history.some((e, i) => canon(events[i]) !== e)) throw conflict();
    return nu;
  };
};
module.exports.conflict = conflict;
