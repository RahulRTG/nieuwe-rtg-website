/* Magnaat Grootboek -- geld is een geheel aantal eurocenten, en het grootboek
   rondt nooit af.

   MAGNAAT.md, ronde A2.1: afronding is DOMEINBELEID. Wanneer en hoe een bedrag
   wordt afgerond kan economisch betekenis hebben (per regel, per maand, in wiens
   voordeel), en dat beslist de economie die boekt -- de motor van het
   Oefenkantoor of World. Het grootboek registreert uitsluitend bedragen die
   al bepaald zijn.

   Daarom weigert `eisCenten` alles wat geen geheel, niet-negatief aantal
   eurocenten is: een breuk, NaN, Infinity, een negatief getal, en ook een
   tekst als "1234" -- aan deze grens wordt niets omgezet. Een boekingsregel is
   debet OF credit en nooit negatief; een saldo mag wel onder nul. */
'use strict';

function eisCenten(n, wat) {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
    throw new Error('Het grootboek rondt niet af: ' + (wat || 'een bedrag') + ' is geen geheel, niet-negatief aantal eurocenten (' +
      typeof n + ' ' + String(n) + ').');
  }
  return n;
}

/* De som van bedragen die al door `eisCenten` zijn gegaan. */
function som(waarden) {
  let t = 0;
  for (const n of waarden) t += n;
  if (!Number.isSafeInteger(t)) throw new Error('Het grootboek telt niet boven ' + Number.MAX_SAFE_INTEGER + ' eurocent.');
  return t;
}

module.exports = { eisCenten, som };
