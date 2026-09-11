/* DE KOPPELING: alle eigen bronnen als bestemming -- leveranciers, OV-haltes,
   tankstations, laadpalen en civiele loketten.

   Afgesplitst van ../navigatie.js omdat het een ANDERE taak is: dit haalt
   plekken op uit de eigen gegevens, de router rekent er routes over. De router
   zat bovendien vlak onder de 10 kB-grens, en dit is het grootste stuk dat er
   niets met routeren te maken heeft. */
'use strict';

module.exports = function maakEigenPlekken({ db, POI }) {
  return function eigenPlekken() {
    const uit = [];
    for (const s of (db.data.suppliers || [])) {
      // een OV-zaak heeft geen eigen loc: haar plek zijn de haltes
      if (s.type === 'ov') {
        for (const lijn of (s.lijnen || [])) for (const h of (lijn.haltes || []))
          if (h && h.lat != null) uit.push({ naam: h.naam, soort: 'halte', laag: 'ov', lat: h.lat, lng: h.lng, extra: lijn.naam });
        continue;
      }
      const loc = s.loc || (s.geo && { lat: s.geo.lat, lng: s.geo.lng });
      if (!loc || loc.lat == null) continue;
      /* De CODE gaat mee, niet alleen de naam. Een naam is wat een zaak zichzelf
         vandaag noemt; de code is waar de rest van het huis haar aan kent. De
         plaatslaag maakt hier hek-id's van (kern/plaats/hekken.js), en een hek
         dat van id verandert omdat iemand zijn zaak hernoemt, laat elke lopende
         waarneming in het niets wijzen. */
      uit.push({ naam: s.name, code: s.code, soort: 'leverancier', laag: 'leverancier', lat: loc.lat, lng: loc.lng, extra: ((db.data.supplierTypes || {})[s.type] || {}).label || s.type });
    }
    for (const p of POI.tank) uit.push({ naam: p.naam, soort: 'tankstation', laag: 'tank', lat: p.lat, lng: p.lng });
    for (const p of POI.laad) uit.push({ naam: p.naam, soort: 'laadpaal', laag: 'laad', lat: p.lat, lng: p.lng, extra: p.kw + ' kW' });
    for (const p of POI.civic) uit.push({ naam: p.naam, soort: p.soort, laag: 'civic', lat: p.lat, lng: p.lng });
    return uit;
  };
};
