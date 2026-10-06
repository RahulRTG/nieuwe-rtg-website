/* NA AFLOOP ZEGT NIEMAND STIL "GELUKT" (Fase 2, I5). Een timer of een losse
   belofte erft de context van het verzoek dat hem startte; schrijft hij na
   `finish`, dan leest niemand het meer (de meting, de effectkop, het
   AI-label zijn weg). Elke context die dat merkt, telt het HIER, en de eerste
   keer per soort ook in het log. afgelopen() is de enige vraag; de handeling
   (./handeling.js) is de levensduur van het verzoek, tot er een verzoekframe
   is. Apart van ./handeling.js voor keuringsregel 13; de exports staan daar
   nog steeds, dus geen aanroeper verandert. */
'use strict';

module.exports = function maakNaAfloop(huidige) {
  const teller = Object.create(null);
  function afgelopen() { const h = huidige(); return !!(h && h.gesloten); }
  function naAfloopMeld(laag, soort) {
    const k = laag + ':' + String(soort || 'onbekend').slice(0, 60);
    if (!teller[k]) {
      try { require('../log').log.warn('schrijven na afloop van het verzoek', { k, p: (huidige() || {}).pad }); } catch (e) {}
    }
    teller[k] = (teller[k] || 0) + 1;
  }
  const naAfloop = () => Object.assign({}, teller);
  return { afgelopen, naAfloopMeld, naAfloop };
};
