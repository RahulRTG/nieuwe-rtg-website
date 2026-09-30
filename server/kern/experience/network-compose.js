/* Begrensde, deterministische compositie. Geen combinatorische bundelzoeker:
   één doorgang over aanbod, maximaal acht behoeften en drie opties per behoefte.
   Geen prijsoptelling van onvergelijkbare nachten, personen en losse producten. */
'use strict';
const contract = require('./network-contract');
const { normal } = require('./network-offers');
const types = new Set(contract.offerTypes.map(t => t.id));
const invalid = error => ({ status: 400, error, code: 'INVALID_NETWORK_INTENT' });
function validate(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return invalid('Geef uw bedoeling op.');
  if (typeof b.goal !== 'string' || !b.goal.trim() || b.goal.length > 120)
    return invalid('Geef uw plan een naam van maximaal 120 tekens.');
  if (!Array.isArray(b.needs) || !b.needs.length || b.needs.length > contract.limits.needs ||
      b.needs.some(t => !types.has(t)) || new Set(b.needs).size !== b.needs.length)
    return invalid('Kies één tot acht verschillende onderdelen.');
  if (b.city != null && (typeof b.city !== 'string' || b.city.length > 60)) return invalid('Ongeldige plaats.');
  if (b.country != null && (typeof b.country !== 'string' || (b.country && !/^[A-Z]{2}$/.test(b.country))))
    return invalid('Gebruik de tweeletterige landcode, bijvoorbeeld NL of IT.');
  return { goal: b.goal.trim(), needs: b.needs.slice(), city: (b.city || '').trim(), country: b.country || '' };
}
function collector(intent) {
  const buckets = new Map(intent.needs.map(type => [type, { type, matches: 0, unavailable: 0, options: [] }]));
  const compare = (a, b) => a.title.localeCompare(b.title, 'und') || a.id.localeCompare(b.id, 'und');
  let examined = 0;
  const city = normal(intent.city);
  function add(offer) {
    examined++;
    const bucket = buckets.get(offer.type);
    if (!bucket) return;
    if ((intent.city || intent.country) && !offer.locations.some(p =>
      (!city || normal(p.city) === city) && (!intent.country || p.country === intent.country))) return;
    if (offer.availability === 'UNAVAILABLE') { bucket.unavailable++; return; }
    bucket.matches++;
    bucket.options.push(offer);
    bucket.options.sort(compare);
    if (bucket.options.length > contract.limits.alternativesPerNeed) bucket.options.pop();
  }
  function finish(snapshot) {
    const needs = [...buckets.values()].map(b => ({ ...b,
      status: b.matches ? 'OPTIONS_FOUND' : snapshot.missing.length ? 'SOURCE_UNAVAILABLE' : 'NO_MATCH' }));
    return { intent, needs, status: needs.every(n => n.matches) ? 'PROPOSAL' : 'INCOMPLETE',
    bookingStatus: 'NOT_BOOKED', totalPrice: null,
    measurements: { examinedOffers: examined, needs: needs.length,
      returnedOptions: needs.reduce((n, b) => n + b.options.length, 0) } };
  }
  return { add, finish };
}
function compose(intent, snapshot) {
  const stream = collector(intent); for (const o of snapshot.offers) stream.add(o);
  return stream.finish(snapshot);
}
module.exports = { validate, compose, collector };
