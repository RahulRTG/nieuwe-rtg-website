/* HET STROOMTICKET: de live-kanalen van het gezin zonder sessie in de URL
   (CODECREDENTIALS.json: foundation.family_profile_access, besluit B18).

   EventSource kan geen header sturen. Daarom droegen /api/rtf/social/stream en
   /api/foundation/gezin/:code/kanaal de gezinssessie als queryparameter -- en
   een URL staat in de browsergeschiedenis, in proxy- en serverlogs en in een
   Referer. Een gezinssessie leeft dagen; een gelekte URL was dus een sleutel.

   Nu vraagt de client eerst met zijn sessie in de Authorization-header (POST
   /api/foundation/gezin/stroom/ticket) een TICKET aan:
   - 128 bits (GS.<32 hex>, kern/bearercode.js), alleen als hash, in de eigen
     collectie foundationGezinsStroom (gezinsadres -> tickets);
   - 60 seconden geldig en EENMALIG: de stroom wisselt hem in een
     collectietransactie in (in PostgreSQL advisory lock plus FOR UPDATE), dus
     twee verbindingen met hetzelfde ticket -- of een afgeluisterde URL die later
     wordt overgespeeld -- leveren precies EEN stroom;
   - gebonden aan een KANAAL ('gezin' of 'sociaal') en aan de SESSIE die hem
     vroeg (haar hash): een ticket voor het gezinskanaal opent de sociale stroom
     niet, en zodra die sessie ophoudt (afmelden, intrekken, verlopen, een
     nieuwe pincode) sluit de stroom bij de eerstvolgende hartslag.
   Wat in de URL overblijft is dus een ticket dat na een minuut, of na het
   eerste gebruik, niets meer opent. Verbindt de browser opnieuw met dezelfde
   URL, dan krijgt hij 401 en vraagt de client een nieuw ticket. */
'use strict';

const klok = require('../lib/klok');

const GELDIG_MS = 60000;
const MAX_OPEN = 4;
const KANALEN = Object.freeze(['gezin', 'sociaal']);
const VORM = /^GS\.[0-9A-F]{32}$/;
const COLLECTIE = 'foundationGezinsStroom';

function maak({ db, bewerkCollectie, crypto, gezinstoken, G, rtfHandle, productie = process.env.NODE_ENV === 'production',
  nu = () => klok.datum().toISOString() }) {
  const bearer = require('../kern/bearercode')({ crypto, namespace: 'foundation.gezinsstroom', nu });
  const eigen = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null;
  const levend = t => t && !t.ingetrokken_at && Date.parse(t.expires_at) > Date.parse(nu());
  const DOEL = 'gezin-stroom', SCOPE = ['foundation.gezin.stroom'];
  let bezit = null;
  /* Een EIGEN collectie, om dezelfde reden als ./gezinscode.js: een transactie
     vervangt haar collectie door een kopie, en `foundation` zelf mag dat niet
     overkomen terwijl een gezinsroute op een await staat. */
  function transactie(werk) {
    const ruim = kaart => {
      for (const [code, rij] of Object.entries(kaart)) {
        const over = (Array.isArray(rij) ? rij : []).filter(levend);
        if (over.length) kaart[code] = over; else delete kaart[code];
      }
      return werk(kaart);
    };
    if (typeof bewerkCollectie === 'function') return Promise.resolve(bewerkCollectie(COLLECTIE, ruim));
    if (productie) return Promise.reject(new Error('gezinsstroom: geen collectietransactie in productie'));
    if (!bezit) bezit = require('../kern/eigencollectie')({ db, domein: 'foundation/gezinsstroom', bezit: { [COLLECTIE]: 'kaart' } });
    return Promise.resolve(ruim(bezit.bak(COLLECTIE)));
  }

  /* Een ticket voor de houder van deze sessie; de kale waarde komt EEN keer terug. */
  async function geef(g, raw, kanaal) {
    if (!KANALEN.includes(kanaal)) return null;
    const h = gezinstoken.zoek(g, raw);
    if (!h || (kanaal === 'sociaal' && h.p.rol === 'gast')) return null;
    const m = bearer.maak({ prefix: 'GS', issuer: 'rtg.foundation', doel: DOEL, scope: SCOPE,
      onderwerp: { gezin: String(g.code), profiel: String(h.p.id), kanaal, sessie: h.t.code_hash },
      geldigMs: GELDIG_MS, maxGebruik: 1 });
    await transactie(kaart => {
      const rij = Array.isArray(eigen(kaart, g.code)) ? kaart[g.code] : [];
      rij.push(m.toegang);
      while (rij.filter(t => t.onderwerp.profiel === h.p.id).length > MAX_OPEN)
        rij.splice(rij.findIndex(t => t.onderwerp.profiel === h.p.id), 1);
      kaart[g.code] = rij;
    });
    return { ticket: m.code, geldigTot: m.toegang.expires_at };
  }

  /* De EENMALIGE inwisseling, in een collectietransactie. Elk ticket van het gezin
     wordt vergeleken (timingSafeEqual, geen vroege uitgang); het ticket verdwijnt
     in dezelfde transactie, ook als het daarna om een andere reden niet opent.
     Geeft { ok, profielId, sessie } of { status }. */
  function claim(code, raw, kanaal) {
    const kaal = String(raw == null ? '' : raw).trim().toUpperCase();
    const adres = String(code || '').toUpperCase();
    if (!VORM.test(kaal) || !KANALEN.includes(kanaal)) return Promise.resolve({ status: 401 });
    const gezocht = bearer.hash(kaal);
    return transactie(kaart => {
      const rij = eigen(kaart, adres);
      let hit = null;
      for (const t of Array.isArray(rij) ? rij : []) if (bearer.zelfdeHash(t && t.code_hash, gezocht)) hit = t;
      if (!hit) return { status: 401 };
      const over = rij.filter(t => t !== hit);
      if (over.length) kaart[adres] = over; else delete kaart[adres];
      const o = hit.onderwerp || {};
      const g = eigen(G(), adres);
      if (bearer.reden(hit, { doel: DOEL, scope: SCOPE }) || o.kanaal !== kanaal || o.gezin !== adres ||
          !g || !gezinstoken.leeft(g, o.profiel, o.sessie)) return { status: 401 };
      return { ok: true, profielId: o.profiel, sessie: o.sessie };
    });
  }

  /* Na de claim: het gezin en profiel uit de live stand, plus een functie die bij
     elke hartslag zegt of de sessie achter de stroom nog leeft. */
  async function open(code, raw, kanaal) {
    let uit;
    try { uit = await claim(code, raw, kanaal); } catch (e) { return { status: 503 }; }
    if (!uit || !uit.ok) return { status: (uit && uit.status) || 401 };
    const adres = String(code || '').toUpperCase();
    const g = eigen(G(), adres), p = g && eigen(g.profielen, uit.profielId);
    if (!p) return { status: 401 };
    return { ok: true, g, p, handle: typeof rtfHandle === 'function' ? rtfHandle(g.code, p.id) : null, leeft: () => { const gg = eigen(G(), adres); return !!gg && gezinstoken.leeft(gg, p.id, uit.sessie); } };
  }

  return { geef, claim, open, GELDIG_MS, KANALEN, COLLECTIE };
}

module.exports = { maak, GELDIG_MS, KANALEN, VORM, COLLECTIE };
