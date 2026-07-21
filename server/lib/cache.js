/* Kleine eigen in-memory cache (TTL + LRU) en een response-cache-middleware,
   i.p.v. een extern cache-pakket. Voor HETE, NIET-persoonlijke antwoorden die
   voor iedereen gelijk zijn (bijv. de actieve-talenlijst): éénmaal rekenen en
   serialiseren, daarna een korte tijd uit het geheugen serveren. Dat haalt zulke
   endpoints uit de staart (p95/p99) zonder het datamodel te raken.

   Bewust conservatief: een KORTE TTL (seconden) begrenst de veroudering, zodat
   een wijziging in de Boardroom vanzelf doorkomt zonder overal invalidatie-haken
   te hoeven leggen. Alleen inzetten waar het antwoord echt publiek is. */
'use strict';
const rtgjson = require('./rtgjson');

class Cache {
  constructor({ ttl = 10000, max = 500 } = {}) {
    this.ttl = ttl;
    this.max = max;
    this.map = new Map();   // sleutel -> { waarde, tot }  (Map bewaart invoegvolgorde => LRU)
    this.treffers = 0;
    this.missers = 0;
  }
  haal(sleutel) {
    const e = this.map.get(sleutel);
    if (!e) { this.missers++; return undefined; }
    if (e.tot <= Date.now()) { this.map.delete(sleutel); this.missers++; return undefined; }
    // meest recent gebruikt: achteraan zetten zodat de oudste vooraan blijft
    this.map.delete(sleutel); this.map.set(sleutel, e);
    this.treffers++;
    return e.waarde;
  }
  zet(sleutel, waarde, ttl) {
    if (this.map.has(sleutel)) this.map.delete(sleutel);
    this.map.set(sleutel, { waarde, tot: Date.now() + (ttl || this.ttl) });
    while (this.map.size > this.max) { const oudste = this.map.keys().next().value; this.map.delete(oudste); }
    return waarde;
  }
  wis(sleutel) { return this.map.delete(sleutel); }
  wisAlles() { this.map.clear(); }
  get grootte() { return this.map.size; }
  stats() {
    const totaal = this.treffers + this.missers;
    return { grootte: this.map.size, treffers: this.treffers, missers: this.missers, ratio: totaal ? this.treffers / totaal : 0 };
  }
}

// Bereken-eenmaal met TTL: geef de gecachte waarde terug, of maak hem met maker().
function memo(cache, sleutel, maker, ttl) {
  const bestaand = cache.haal(sleutel);
  if (bestaand !== undefined) return bestaand;
  return cache.zet(sleutel, maker(), ttl);
}

/* Response-cache-middleware: memoiseer het JSON-antwoord (als string) van een
   handler. Alleen inzetten op PUBLIEKE endpoints waar het antwoord voor iedereen
   gelijk is. Keyed op methode+url, of een eigen sleutel-functie. Cachet alleen
   een 200-antwoord. Zet X-RTG-Cache: hit/miss zodat je het kunt meten. */
function antwoordCache(opties = {}) {
  const cache = opties.cache || new Cache({ ttl: opties.ttl || 10000, max: opties.max || 200 });
  const sleutelVan = opties.sleutel || ((req) => req.method + ' ' + (req.originalUrl || req.url));
  const mw = (req, res, next) => {
    const sleutel = sleutelVan(req);
    const klaar = cache.haal(sleutel);
    if (klaar !== undefined) {
      res.setHeader('X-RTG-Cache', 'hit');
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(klaar);
    }
    res.setHeader('X-RTG-Cache', 'miss');
    const origJson = res.json.bind(res);
    res.json = (obj) => {
      if ((res.statusCode || 200) === 200) { try { cache.zet(sleutel, rtgjson.stringify(obj)); } catch (e) {} }
      return origJson(obj);
    };
    next();
  };
  mw.cache = cache;
  return mw;
}

module.exports = { Cache, memo, antwoordCache };
