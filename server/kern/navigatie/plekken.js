/* Bestemmingen en kaartlagen van TravelOS, los van de verschillende
   routegrafen. Zo delen lokaal, NWB en World Graph dezelfde plekken. */
'use strict';

const POI = {
  tank: [
    { naam: 'Repostar Vila', lat: 38.909, lng: 1.421 },
    { naam: 'Estacio Platja', lat: 38.884, lng: 1.406 },
    { naam: 'Benzina Nord', lat: 38.972, lng: 1.318 }
  ],
  laad: [
    { naam: 'RTG Laadplein Marina', lat: 38.918, lng: 1.449, kw: 150 },
    { naam: 'Laadpunt Aeroport', lat: 38.874, lng: 1.377, kw: 50 },
    { naam: 'Snellaad Sant Antoni', lat: 38.980, lng: 1.304, kw: 300 },
    { naam: 'Laadpunt Dalt Vila', lat: 38.906, lng: 1.436, kw: 22 }
  ],
  civic: [
    { naam: 'Gemeenteloket Ibiza', lat: 38.909, lng: 1.434, soort: 'gemeente' },
    { naam: 'Overheidsloket (Rijk)', lat: 38.911, lng: 1.428, soort: 'overheid' },
    { naam: 'Gemeenteloket Sant Antoni', lat: 38.981, lng: 1.301, soort: 'gemeente' }
  ]
};

const zonderTekens = v => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function scoreZoek(p, q) {
  const naam = zonderTekens(p.naam), extra = zonderTekens((p.extra || '') + ' ' + p.soort + ' ' + p.laag);
  if (naam === q) return 100;
  if (naam.startsWith(q)) return 82;
  if (naam.includes(q)) return 64;
  const woorden = q.split(/\s+/).filter(Boolean);
  return woorden.every(w => (naam + ' ' + extra).includes(w)) ? 42 + woorden.length : 0;
}

function maakPlekken({ db, meters, nederland, wereld, flitsRond }) {
  function eigenPlekken() {
    const uit = [];
    for (const s of (db.data.suppliers || [])) {
      if (s.type === 'ov') {
        for (const lijn of (s.lijnen || [])) for (const h of (lijn.haltes || []))
          if (h && h.lat != null) uit.push({ naam: h.naam, soort: 'halte', laag: 'ov', lat: h.lat, lng: h.lng, extra: lijn.naam });
        continue;
      }
      const loc = s.loc || (s.geo && { lat: s.geo.lat, lng: s.geo.lng });
      if (!loc || loc.lat == null) continue;
      /* De code is de stabiele identiteit; een leveranciersnaam kan wijzigen
         zonder dat lopende plaatswaarnemingen daardoor hun hek verliezen. */
      uit.push({ naam: s.name, code: s.code, soort: 'leverancier', laag: 'leverancier', lat: loc.lat, lng: loc.lng,
        extra: ((db.data.supplierTypes || {})[s.type] || {}).label || s.type });
    }
    for (const p of POI.tank) uit.push({ naam: p.naam, soort: 'tankstation', laag: 'tank', lat: p.lat, lng: p.lng });
    for (const p of POI.laad) uit.push({ naam: p.naam, soort: 'laadpaal', laag: 'laad', lat: p.lat, lng: p.lng, extra: p.kw + ' kW' });
    for (const p of POI.civic) uit.push({ naam: p.naam, soort: p.soort, laag: 'civic', lat: p.lat, lng: p.lng });
    return uit;
  }
  function bestemmingen(query, hier) {
    const q = zonderTekens(query);
    let rij = eigenPlekken();
    const laagZoek = ['laad', 'laadpaal', 'tank', 'tankstation', 'halte', 'ov', 'gemeente', 'overheid', 'leverancier'].includes(q);
    if (nederland && !laagZoek && (String(query || '').trim().length >= 2 || !query)) rij.push(...nederland.zoekPlekken(query));
    if (wereld && !laagZoek && String(query || '').trim().length >= 2) rij.push(...wereld.zoekPlekken(query));
    if (q) rij = rij.map(p => ({ ...p, zoekScore: scoreZoek(p, q) })).filter(p => p.zoekScore > 0);
    if (hier && hier.lat != null) rij.forEach(p => { p.afstandM = Math.round(meters(hier, p)); });
    rij.sort((a, b) => (b.zoekScore || 0) - (a.zoekScore || 0) || (a.afstandM ?? 9e9) - (b.afstandM ?? 9e9));
    return { status: 200, bestemmingen: rij.slice(0, 40) };
  }
  function poiLagen(lagen, hier) {
    const wens = Array.isArray(lagen) && lagen.length ? lagen : ['tank', 'laad', 'civic', 'ov', 'leverancier'];
    const uit = {}, alles = eigenPlekken();
    for (const laag of wens) {
      if (laag === 'flits') continue;
      let rij = alles.filter(p => p.laag === laag);
      if (hier && hier.lat != null) { rij.forEach(p => { p.afstandM = Math.round(meters(hier, p)); }); rij.sort((a, b) => a.afstandM - b.afstandM); }
      uit[laag] = rij.slice(0, 30);
    }
    if (wens.includes('flits') && flitsRond && hier && hier.lat != null) {
      const f = flitsRond({ lat: hier.lat, lng: hier.lng }, hier.land);
      uit.flits = (f.meldingen || []).map(m => ({ naam: m.naam, soort: m.soort, laag: 'flits', lat: m.lat, lng: m.lng,
        icoon: m.icoon, afstandM: Math.round((m.afstandKm || 0) * 1000) }));
    }
    return { status: 200, lagen: uit };
  }
  return { eigenPlekken, bestemmingen, poiLagen };
}

module.exports = { POI, maakPlekken, zonderTekens, scoreZoek };
