/* OV: halte in plaats van punt (NAVIGATIE.md N17).

   Het tarief heeft een AFSTAND nodig en geen punt; wat na de rit blijft is in-
   en uitstaphalte, afstand en prijs -- een jaar (server/bewaarbeleid-vervoer.js).
   De halte komt uit de eigen haltelijst van de lijn: een openbare plek en geen
   spoor van een mens. Tijdens de rit mag alles wat het tarief vraagt (N11): het
   instappunt woont dan in `inPunten`, alleen in het geheugen, en gaat bij het
   uitchecken weg. Na een herstart is het er niet meer; dan rekent het tarief
   vanaf de instaphalte -- een iets andere som, geen verzonnen punt.

   Een eigen bestand omdat ./index.js vlak onder de omvanggrens zat. Deze module
   kent de opslag niet: ./index.js geeft de ritten mee en slaat zelf op. */
'use strict';

module.exports = ({ haversine }) => {
  const inPunten = new Map();           // rit.id -> { lat, lng }, alleen tijdens de rit

  function halteBij(lijn, punt) {
    let beste = null, m = Infinity;
    for (const h of (lijn && lijn.haltes) || []) {
      const d = haversine(punt, h);
      if (Number.isFinite(d) && d < m) { m = d; beste = h; }
    }
    return beste ? { halte: beste.naam, halteId: beste.id } : { halte: null, halteId: null };
  }

  function inPuntVan(rit, lijn) {
    const p = inPunten.get(rit.id);
    if (p) return p;
    const h = ((lijn && lijn.haltes) || []).find(x => x.id === rit.in.halteId);
    return h ? { lat: h.lat, lng: h.lng } : null;
  }

  /* Ritten van voor N17 droegen het instap- en uitstapPUNT. Die worden bij het
     opstarten omgezet naar halte (een lopende rit houdt zijn punt in het
     geheugen tot het uitchecken), zodat het besluit ook geldt voor wat er al
     stond en niet alleen voor wat er bijkomt. Geeft true als er iets veranderde. */
  function puntenWeg(ritten, lijnVan) {
    let raak = false;
    for (const r of ritten || []) {
      const lijn = lijnVan(r);
      for (const kant of ['in', 'uit']) {
        const p = r[kant];
        if (!p || !Number.isFinite(p.lat)) continue;
        if (kant === 'in' && r.status === 'in') inPunten.set(r.id, { lat: p.lat, lng: p.lng });
        r[kant] = { ...halteBij(lijn, p), at: p.at };
        raak = true;
      }
      if (!r.at && r.in) { r.at = r.in.at; raak = true; }
    }
    return raak;
  }

  return { inPunten, halteBij, inPuntVan, puntenWeg };
};
