'use strict';

/* Het historische momentregister en de leesprojectie voor de fan-inbox. De
   levende naam blijft in aanwezigheid.js; hier staat alleen wat toen gebeurde. */
module.exports = function maakMomenten({ opslag, aanwezig, soortNaam }) {
  const MAX = 500;

  function lijst() {
    return opslag ? opslag.momenten() : [];
  }

  function leg(aanwezigheidId, soort, titel) {
    if (!opslag) return null;
    const momenten = lijst();
    const moment = {
      id: 'mo' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      aanwezigheid: String(aanwezigheidId),
      soort,
      titel: titel == null ? null : String(titel).slice(0, 120),
      at: new Date().toISOString()
    };
    momenten.push(moment);
    opslag.begrensMomenten(MAX);
    opslag.bewaar();
    return moment;
  }

  function voor(key, grens) {
    if (!aanwezig) return { momenten: [], volgt: 0 };
    const mijn = aanwezig.aanwezigMijn(key) || [];
    const opId = new Map(mijn.map(a => [a.id, a]));
    const n = Math.min(Math.max(Number(grens) || 50, 1), 100);
    const momenten = lijst().filter(m => opId.has(m.aanwezigheid)).slice(-n).reverse()
      .map(m => ({
        id: m.id,
        soort: m.soort,
        wat: soortNaam[m.soort] || m.soort,
        titel: m.titel,
        at: m.at,
        aanwezigheid: m.aanwezigheid,
        naam: (opId.get(m.aanwezigheid) || {}).naam || null
      }));
    return {
      momenten,
      volgt: mijn.length,
      watDitNietDoet: 'Dit is een venster op de tijdlijnen die u volgt, geen postbus: er wordt niet bijgehouden wat u al heeft gezien, en er staat geen volgorde op populariteit.'
    };
  }

  return { leg, momentenVoor: voor };
};
