/* Kern-module "navigatie": RTG Navigatie, het huiseigen navigatiesysteem.
   Alles zelf, niets naar derden: geen Google, geen Mapbox, geen externe tegels.
   De route komt uit een eigen wegennet (een raster met hoofdwegen) waarover een
   A*-zoeker de snelste weg vindt; de bocht-voor-bocht-aanwijzingen en de ETA per
   vervoerwijze rekenen we er zelf uit.

   De kracht zit in de koppeling: bestemmingen komen uit onze eigen leveranciers,
   de OV-haltes, de overheids- en gemeenteloketten en de POI-lagen (tankstations,
   laadpalen). Onderweg schuift RTG Flits erin: flitsers, files en gevaren van het
   eigen netwerk liggen op de route. Een wegprobleem melden gaat via dezelfde
   Flits-laag terug het netwerk in.

   Privacy by design: plaatsen zijn plaatsen (zaken en loketten), nooit personen;
   een melding draagt een codenaam, nooit een echte naam. De positie van de rijder
   blijft op het toestel -- de server rekent met wat de app stuurt en bewaart die
   niet.

   maakNavigatie(state) volgt het vaste kern-patroon. Na flits gemount. */

const REF = { lat: 38.91, lng: 1.43 };                          // Ibiza-stad, het midden
const BOUNDS = { lat0: 38.855, lat1: 38.995, lng0: 1.28, lng1: 1.56 };
const GRID = 22;                                                 // rasterknopen per as
const ARTERIE = 3;                                               // elke 3e lijn is hoofdweg
const V_HOOFD = 22, V_STAD = 11;                                 // m/s (~80 / ~40 km/h)
const MODI = { auto: 13.9, ev: 13.9, fiets: 4.4, lopen: 1.4 };  // gemiddelde m/s
const LANGS_M = 450;                                             // "langs de route" straal

// de eigen POI-lagen: tankstations, laadpalen en civiele loketten rond Ibiza
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

function maakNavigatie({ db, save, crypto, haversine, flitsRond, flitsMeld }) {
  /* De pure meetkunde en de A*-grafenzoeker (projectie, net, snap, route,
     bocht-voor-bocht) draaien als submodule op de constanten; zie
     navigatie/wegennet.js. */
  const { meters, snap, zoek, stappenVan } = require('./navigatie/wegennet')({ REF, BOUNDS, GRID, ARTERIE, V_HOOFD, V_STAD, haversine });

  // ---- de koppeling: alle bronnen als bestemming ----
  function eigenPlekken() {
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
      uit.push({ naam: s.name, soort: 'leverancier', laag: 'leverancier', lat: loc.lat, lng: loc.lng, extra: ((db.data.supplierTypes || {})[s.type] || {}).label || s.type });
    }
    for (const p of POI.tank) uit.push({ naam: p.naam, soort: 'tankstation', laag: 'tank', lat: p.lat, lng: p.lng });
    for (const p of POI.laad) uit.push({ naam: p.naam, soort: 'laadpaal', laag: 'laad', lat: p.lat, lng: p.lng, extra: p.kw + ' kW' });
    for (const p of POI.civic) uit.push({ naam: p.naam, soort: p.soort, laag: 'civic', lat: p.lat, lng: p.lng });
    return uit;
  }

  function bestemmingen(query, hier) {
    const q = String(query || '').trim().toLowerCase();
    let rij = eigenPlekken();
    if (q) rij = rij.filter(p => (p.naam + ' ' + (p.extra || '') + ' ' + p.soort).toLowerCase().includes(q));
    if (hier && hier.lat != null) rij.forEach(p => { p.afstandM = Math.round(meters(hier, p)); });
    rij.sort((a, b) => (a.afstandM ?? 9e9) - (b.afstandM ?? 9e9));
    return { status: 200, bestemmingen: rij.slice(0, 40) };
  }

  function poiLagen(lagen, hier) {
    const wens = Array.isArray(lagen) && lagen.length ? lagen : ['tank', 'laad', 'civic', 'ov', 'leverancier'];
    const uit = {};
    const alles = eigenPlekken();
    for (const laag of wens) {
      if (laag === 'flits') continue;
      let rij = alles.filter(p => p.laag === laag);
      if (hier && hier.lat != null) { rij.forEach(p => { p.afstandM = Math.round(meters(hier, p)); }); rij.sort((a, b) => a.afstandM - b.afstandM); }
      uit[laag] = rij.slice(0, 30);
    }
    if (wens.includes('flits') && flitsRond && hier && hier.lat != null) {
      const f = flitsRond({ lat: hier.lat, lng: hier.lng }, hier.land);
      uit.flits = (f.meldingen || []).map(m => ({ naam: m.naam, soort: m.soort, laag: 'flits', lat: m.lat, lng: m.lng, icoon: m.icoon, afstandM: Math.round((m.afstandKm || 0) * 1000) }));
    }
    return { status: 200, lagen: uit };
  }

  // ---- de route zelf ----
  function langsRoute(poly, punten) {
    return punten.filter(p => poly.some(q => meters(p, q) <= LANGS_M));
  }
  function route({ van, naar, modus }) {
    const gv = van && Number.isFinite(Number(van.lat)) && Number.isFinite(Number(van.lng));
    const gn = naar && Number.isFinite(Number(naar.lat)) && Number.isFinite(Number(naar.lng));
    if (!gv || !gn) return { status: 400, error: 'Geef een geldig vertrek- en aankomstpunt.' };
    const m = MODI[modus] ? modus : 'auto';
    const vanN = snap({ lat: +van.lat, lng: +van.lng }), naarN = snap({ lat: +naar.lat, lng: +naar.lng });
    const kern = zoek(vanN, naarN);
    if (!kern) return { status: 422, error: 'Geen route gevonden binnen het netwerk.' };
    const poly = [{ lat: +van.lat, lng: +van.lng }, ...kern.map(k => ({ lat: k.lat, lng: k.lng })), { lat: +naar.lat, lng: +naar.lng }];
    // dubbele opeenvolgende punten eruit (snap kan samenvallen met van/naar)
    const schoon = poly.filter((p, i) => i === 0 || meters(p, poly[i - 1]) > 5);
    let afstandM = 0; for (let i = 1; i < schoon.length; i++) afstandM += meters(schoon[i - 1], schoon[i]);
    const eta = {}; for (const k of Object.keys(MODI)) eta[k] = Math.max(1, Math.round(afstandM / MODI[k] / 60));
    const langs = {
      laad: langsRoute(schoon, POI.laad.map(p => ({ ...p, laag: 'laad', afstandM: 0 }))),
      tank: langsRoute(schoon, POI.tank.map(p => ({ ...p, laag: 'tank' }))),
      flits: (flitsRond ? (flitsRond({ lat: schoon[Math.floor(schoon.length / 2)].lat, lng: schoon[Math.floor(schoon.length / 2)].lng }, (van.land || naar.land)).meldingen || []) : [])
        .filter(f => schoon.some(q => haversine(f, q) <= LANGS_M))
    };
    return {
      status: 200, modus: m, afstandM: Math.round(afstandM), afstandKm: Math.round(afstandM / 100) / 10,
      etaMin: eta, route: schoon, stappen: stappenVan(schoon), langs,
      bron: 'eigen wegennet (A*); geen externe kaartdienst'
    };
  }

  // ---- de kaart voor de 3D-app: net-definitie + koppelpunten ----
  function kaart(hier) {
    return {
      status: 200, ref: REF, bounds: BOUNDS, grid: GRID, arterie: ARTERIE,
      plekken: eigenPlekken().map(p => {
        if (hier && hier.lat != null) p.afstandM = Math.round(meters(hier, p));
        return p;
      })
    };
  }

  // ---- wegprobleem melden: terug het Flits-netwerk in ----
  function meld(key, codenaam, data) {
    if (!flitsMeld) return { status: 503, error: 'Meldlaag niet beschikbaar.' };
    const soort = ['ongeval', 'object', 'wegwerk', 'file'].includes(data.soort) ? data.soort : 'object';
    return flitsMeld(key, codenaam, { soort, lat: data.lat, lng: data.lng, land: data.land });
  }

  void crypto; void save;
  return { navBestemmingen: bestemmingen, navRoute: route, navPoi: poiLagen, navKaart: kaart, navMeld: meld };
}

module.exports = { maakNavigatie };
