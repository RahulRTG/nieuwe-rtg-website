'use strict';

/* Kleine, pure invoergrens voor menselijke schermcontext. De contractlaag
   bepaalt de maxima; deze helper kent geen sessie, object of bevoegdheid. */
function maakMenscontextSaneerders(maxTekst, maxItems) {
  function contextTekst(x) {
    if (typeof x !== 'string') return '';
    return x.replace(/[^\S ]|[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxTekst);
  }
  function contextWoord(x) {
    return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  }
  function contextLijst(x) { return Array.isArray(x) ? x.slice(0, maxItems) : []; }
  function contextVerwijzing(v) {
    if (!v || typeof v !== 'object') return null;
    const soort = contextWoord(v.soort || v.type || v.kind);
    const id = contextTekst(String(v.id == null ? '' : v.id)).slice(0, 40);
    if (!soort && !id) return null;
    return { soort: soort || 'onbekend', id: id || '' };
  }
  return Object.freeze({ tekst: contextTekst, naarWoord: contextWoord,
    lijst: contextLijst, verwijzing: contextVerwijzing });
}

module.exports = maakMenscontextSaneerders;
