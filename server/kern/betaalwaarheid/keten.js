/* De opslag en de hashketen onder de RTG Payment Truth (./index.js): de doos
   met betalingen en meldingen, het afgeleide betaal-id en elke gebeurtenis
   met een zegel over de vorige. Afgesplitst omdat index.js tegen de
   omvanggrens aan zat; de overgangsregels blijven daar. */
'use strict';

module.exports = function maakBetaalKeten({ d, crypto, nuIso }) {
  function doos() {
    const data = d();
    if (!data.betaalWaarheid || typeof data.betaalWaarheid !== 'object') data.betaalWaarheid = {};
    if (!data.betaalWaarheidMeldingen || typeof data.betaalWaarheidMeldingen !== 'object') data.betaalWaarheidMeldingen = {};
    return data.betaalWaarheid;
  }
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
  const idVan = (actor, idem) => 'BW-' + hash(String(actor) + '|' + String(idem)).slice(0, 20).toUpperCase();

  function gebeurtenis(r, soort, extra) {
    if (!Array.isArray(r.gebeurtenissen)) r.gebeurtenissen = [];
    const vorig = r.gebeurtenissen.length ? r.gebeurtenissen[r.gebeurtenissen.length - 1].zegel : 'BEGIN';
    const basis = Object.assign({ nr: r.gebeurtenissen.length + 1, at: nuIso(), soort,
      status: r.status, vorig }, extra || {});
    basis.zegel = hash(JSON.stringify(basis));
    r.gebeurtenissen.push(basis);
    r.bijgewerktAt = basis.at;
    return basis;
  }

  return { doos, hash, idVan, gebeurtenis };
};
