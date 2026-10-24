/* De twee lezingen van de opdrachtencollectie: schrijven initialiseert een
   verse lijst; een zuivere lezing weigert beschadigde opslag in plaats van die
   stil te vervangen. */
'use strict';
module.exports = d => ({
  schrijfRij() {
    if (!Array.isArray(d().betaalOpdrachten)) d().betaalOpdrachten = [];
    return d().betaalOpdrachten;
  },
  leesRij() {
    const r = d().betaalOpdrachten;
    if (r === undefined) return [];
    if (!Array.isArray(r)) throw new Error('betaalOpdrachten heeft geen geldige lijstvorm.');
    return r;
  }
});
