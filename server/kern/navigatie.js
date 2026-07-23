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
  // ---- projectie: lat/lng -> lokale meters (x oost, z zuid) ----
  const cosRef = Math.cos(REF.lat * Math.PI / 180);
  const naarXZ = (lat, lng) => ({ x: (lng - REF.lng) * 111320 * cosRef, z: (REF.lat - lat) * 110540 });
  const meters = (a, b) => haversine({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });

  // ---- het wegennet: een raster met hoofdwegen, eenmalig gebouwd ----
  let net = null;
  function knoopLatLng(r, c) {
    return {
      lat: BOUNDS.lat1 - (BOUNDS.lat1 - BOUNDS.lat0) * r / (GRID - 1),
      lng: BOUNDS.lng0 + (BOUNDS.lng1 - BOUNDS.lng0) * c / (GRID - 1)
    };
  }
  const arterie = (r, c) => (r % ARTERIE === 0 || c % ARTERIE === 0);
  function bouwNet() {
    if (net) return net;
    const knopen = [];
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      const p = knoopLatLng(r, c);
      knopen.push({ i: r * GRID + c, r, c, lat: p.lat, lng: p.lng, art: arterie(r, c) });
    }
    const buren = knopen.map(() => []);
    const stappen = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const k of knopen) {
      for (const [dr, dc] of stappen) {
        const r2 = k.r + dr, c2 = k.c + dc;
        if (r2 < 0 || r2 >= GRID || c2 < 0 || c2 >= GRID) continue;
        const b = knopen[r2 * GRID + c2];
        const hoofd = k.art && b.art;                 // hoofdweg als beide knopen op een hoofdlijn liggen
        const v = hoofd ? V_HOOFD : V_STAD;
        buren[k.i].push({ i: b.i, kost: meters(k, b) / v, m: meters(k, b) });
      }
    }
    net = { knopen, buren };
    return net;
  }
  function snap(pt) {
    const n = bouwNet();
    let best = null, bd = Infinity;
    for (const k of n.knopen) { const d = meters(k, pt); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // ---- A*: de snelste weg over het net ----
  function zoek(vanN, naarN) {
    const n = bouwNet();
    const g = new Map([[vanN.i, 0]]);
    const via = new Map();
    const h = k => meters(k, naarN) / V_HOOFD;
    const open = [{ i: vanN.i, f: h(vanN) }];
    const dicht = new Set();
    while (open.length) {
      let bi = 0; for (let j = 1; j < open.length; j++) if (open[j].f < open[bi].f) bi = j;
      const cur = open.splice(bi, 1)[0];
      if (cur.i === naarN.i) break;
      if (dicht.has(cur.i)) continue;
      dicht.add(cur.i);
      for (const e of n.buren[cur.i]) {
        const ng = (g.get(cur.i) ?? Infinity) + e.kost;
        if (ng < (g.get(e.i) ?? Infinity)) {
          g.set(e.i, ng); via.set(e.i, cur.i);
          open.push({ i: e.i, f: ng + h(n.knopen[e.i]) });
        }
      }
    }
    if (!via.has(naarN.i) && vanN.i !== naarN.i) return null;
    const pad = [naarN.i]; let c = naarN.i;
    while (c !== vanN.i) { c = via.get(c); if (c == null) break; pad.push(c); }
    pad.reverse();
    return pad.map(i => n.knopen[i]);
  }

  // ---- bocht-voor-bocht uit de polylijn ----
  const kompas = ['noord', 'noordoost', 'oost', 'zuidoost', 'zuid', 'zuidwest', 'west', 'noordwest'];
  function richtingVan(a, b) {
    const p = naarXZ(a.lat, a.lng), q = naarXZ(b.lat, b.lng);
    let hoek = Math.atan2(q.x - p.x, -(q.z - p.z)) * 180 / Math.PI;   // 0 = noord, met de klok mee
    if (hoek < 0) hoek += 360;
    return kompas[Math.round(hoek / 45) % 8];
  }
  function stappenVan(poly) {
    if (poly.length < 2) return [];
    const st = [{ instructie: 'Vertrek richting ' + richtingVan(poly[0], poly[1]), afstandM: 0, bocht: 'start' }];
    let sinds = 0;
    for (let i = 1; i < poly.length; i++) {
      sinds += meters(poly[i - 1], poly[i]);
      if (i >= poly.length - 1) break;
      const a = naarXZ(poly[i - 1].lat, poly[i - 1].lng), b = naarXZ(poly[i].lat, poly[i].lng), c = naarXZ(poly[i + 1].lat, poly[i + 1].lng);
      const v1x = b.x - a.x, v1z = b.z - a.z, v2x = c.x - b.x, v2z = c.z - b.z;
      const kruis = v1x * v2z - v1z * v2x, dotp = v1x * v2x + v1z * v2z;
      const hoek = Math.atan2(kruis, dotp) * 180 / Math.PI;
      if (Math.abs(hoek) < 22) continue;                              // rechtdoor: geen aanwijzing
      st[st.length - 1].afstandM = Math.round(sinds);
      const bocht = hoek > 0 ? 'rechts' : 'links';                    // z wijst zuid: +kruis = naar rechts
      st.push({ instructie: 'Sla ' + (Math.abs(hoek) > 55 ? '' : 'flauw ') + bocht + 'af richting ' + richtingVan(poly[i], poly[i + 1]), afstandM: 0, bocht });
      sinds = 0;
    }
    st[st.length - 1].afstandM = Math.round(sinds);
    st.push({ instructie: 'Bestemming bereikt', afstandM: 0, bocht: 'eind' });
    return st;
  }

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
