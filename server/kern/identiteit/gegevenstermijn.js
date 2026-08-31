/* ============================================================================
   DE BEWAARTERMIJN OP DE GEGEVENSKAART -- hoe lang blijft dit staan?

   Geknipt uit ./gegevenskaart.js op de 10 kB-grens. De naad is echt: dit is het
   enige stuk van de kaart dat een ANDER register leest (server/bewaartermijnen.js)
   in plaats van het eigen register samen te stellen.

   DE TERMIJN KOMT UIT HET BELEID EN NIET UIT EEN ZIN. Hij stond eerst als
   "zeven jaar" in het register, en dat is precies de vorm waarin een document
   van de code wegdrijft: bij het narekenen bleek het inzagejournaal niet
   "altijd" te blijven maar 730 dagen. Wie een bewaartermijn overtypt, heeft
   hem binnen een jaar mis.
   ========================================================================== */
'use strict';

const { BELEID } = require('../../bewaartermijnen');

function termijnVan(tak) {
  if (!tak) return null;
  const r = (BELEID || []).find(x => x.tak === tak);
  /* Een tak die niet meer bestaat levert GEEN stilte op: dan staat er op de
     kaart dat de termijn niet is vast te stellen, en dat is de eerlijke stand.
     Een verdwenen regel als "geen termijn" tonen zou zeggen dat het eeuwig
     blijft staan, en dat is de gevaarlijke kant van de fout. */
  if (!r) return { bekend: false, waarom: 'De bewaarregel voor dit gegeven is niet gevonden; hoe lang het blijft staan is hier niet vast te stellen.' };
  return {
    bekend: true, dagen: r.dagen, grond: r.grond,
    inWoorden: r.dagen >= 365 ? Math.round(r.dagen / 365) + ' jaar' : r.dagen + ' dagen',
    waarom: r.waarom
  };
}

module.exports = { termijnVan };
