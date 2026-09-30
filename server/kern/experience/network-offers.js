/* Adapter op de bestaande universele Mall-vorm. Alleen openbare velden gaan
   over deze grens; geen inkoopprijzen, ledenregister of leveranciersgeheimen.
   Policy vóór indexeren, tellen en zoeken. Een graafrand verleent geen recht. */
'use strict';
const { hash } = require('./canon');
const { TYPEN } = require('../mall/aanbodvorm');
const leveranciersVoorAanbod = require('../../db/leveranciers-projectie');
const normal = v => String(v || '').normalize('NFKC').trim().toLowerCase();
const text = (v, max = 140) => typeof v === 'string' ? v.trim().slice(0, max) : '';
function plaats(p) {
  if (!p || !text(p.stad, 60)) return null;
  return { city: text(p.stad, 60), country: /^[A-Z]{2}$/.test(p.land) ? p.land : null };
}
function link(pad) {
  return typeof pad === 'string' && /^\/apps\/[a-zA-Z0-9_/-]+\.html(?:\?[a-zA-Z0-9_=&.%:-]*)?$/.test(pad)
    ? pad : null;
}
function collect({ kern, db, crypto, each, ids }) {
  if (!kern.mall || typeof kern.mall.aanbodAlles !== 'function')
    return { offers: [], missing: ['mall'], rejected: 0 };
  // Duplicaatcodes zijn ambigu; geen willekeurige winnaar als bron van gezag.
  const suppliers = new Map(), ambiguous = new Set();
  for (const s of leveranciersVoorAanbod(db)) {
    if (!s) continue;
    if (suppliers.has(s.code)) ambiguous.add(s.code);
    suppliers.set(s.code, s);
  }
  const offers = [], seen = new Set();
  let rejected = 0, ambiguousIds = false;
  function receive(a) {
    if (!a || !a.aanbieder) { rejected++; return; }
    const p = a.aanbieder;
    if (p.soort === 'zaak') {
      const s = suppliers.get(p.code);
      if (!s || ambiguous.has(p.code) || s.verborgen ||
          ['geschorst', 'beeindigd'].includes(s.status)) return;
    } else if (!['rtg', 'particulier'].includes(p.soort)) return;
    const destination = link(a.pagina);
    if (!text(a.id, 80) || !text(a.titel) || !Object.hasOwn(TYPEN, a.type) || !destination) {
      rejected++; return;
    }
    if (seen.has(a.id)) { ambiguousIds = true; rejected++; return; }
    seen.add(a.id);
    if (ids && !ids.has(a.id)) return;
    const locations = (a.vestigingen || [a.plek]).map(plaats).filter(Boolean).slice(0, 41);
    const price = a.prijs && Number.isFinite(a.prijs.bedrag) && a.prijs.bedrag >= 0 &&
      /^[A-Z]{3}$/.test(a.prijs.valuta) ? {
        amount: a.prijs.bedrag, currency: a.prijs.valuta,
        unit: text(a.prijs.eenheid, 60), from: !!a.prijs.vanaf, kind: a.prijsAard || null
      } : null;
    const offer = {
      id: text(a.id, 80), type: a.type, title: text(a.titel), source: text(a.bron, 30),
      provider: { kind: p.soort, id: p.soort === 'zaak' ? text(p.code, 80) : null, name: text(p.naam, 80) },
      locations, price, destination,
      availability: a.beschikbaar && a.beschikbaar.uit ? 'UNAVAILABLE' :
        a.beschikbaar && a.beschikbaar.hard === true ? 'SOURCE_REPORTED' : 'UNKNOWN',
      availabilityText: text(a.beschikbaar && a.beschikbaar.tekst, 160),
      reservation: 'NOT_RESERVED', dateAndCapacity: 'CHECK_IN_DOMAIN'
    };
    if (each) each(offer);
    else { offer.revision = hash(crypto, offer); offers.push(offer); }
  }
  let snapshot;
  try {
    if (typeof kern.mall.aanbodBezoek === 'function') snapshot = kern.mall.aanbodBezoek(receive);
    else {
      snapshot = kern.mall.aanbodAlles();
      if (!snapshot || !Array.isArray(snapshot.aanbod)) throw Error('Mall ontbreekt');
      for (const a of snapshot.aanbod) receive(a);
    }
  } catch (_) { return { offers: [], missing: ['mall'], rejected, discard: true }; }
  const missing = (snapshot.stuk || []).map(s => text(s.bron, 30)).filter(Boolean);
  if (ambiguousIds) missing.push('offer-identities');
  return { offers: ambiguousIds ? [] : offers, rejected: rejected + (snapshot.geweigerd || []).length,
    missing, discard: ambiguousIds };
}
module.exports = { collect, normal, link };
