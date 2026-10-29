/* De wire-vorm van een herhaald antwoord en de canonieke verzoekafdruk.
   Alleen JSON en hashing: geen cache, identiteit of routebeslissing. De afdruk
   houdt vrije tekst bewust vast, anders dan de specialistische idem-kast. */
'use strict';
const crypto = require('crypto');

/* Het bewaarde lijf, met de huismarkering erbij. Alleen een JSON-OBJECT krijgt
   het veld: een lijst of een kale waarde heeft geen plek om hem te dragen, en
   die verzinnen zou het antwoord veranderen in plaats van het te merken. Lukt
   het ontleden niet, dan gaat het lijf onveranderd terug -- liever het eerste
   antwoord precies zoals het was dan een half omgebouwd antwoord. */
function metHerhaald(lijf) {
  try {
    const d = JSON.parse(lijf);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return lijf;
    if (d.herhaald === true) return lijf;
    return JSON.stringify(Object.assign({}, d, { herhaald: true }));
  } catch (e) { return lijf; }
}

function vingerafdruk(b) {
  const rest = Object.assign({}, b); delete rest.idem; delete rest.idempotentieSleutel;
  const vast = (v) => Array.isArray(v) ? '[' + v.map(vast).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + vast(v[k])).join(',') + '}'
      : JSON.stringify(v === undefined ? null : v);
  return crypto.createHash('sha256').update(vast(rest)).digest('hex');
}

module.exports = { metHerhaald, vingerafdruk };
