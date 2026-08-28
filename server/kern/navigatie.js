/* Huiseigen navigatie: lokaal stadsnet plus de dagelijkse CC0-import van alle
   Nederlandse NWB-wegvakken. Eigen A*, bestemmingen uit RTG/NWB, Flits als
   live laag en positie alleen voor de berekening, nooit als reisgeschiedenis. */

const REF = { lat: 38.91, lng: 1.43 };                          // Ibiza-stad, het midden
const BOUNDS = { lat0: 38.855, lat1: 38.995, lng0: 1.28, lng1: 1.56 };
const GRID = 22;                                                 // rasterknopen per as
const ARTERIE = 3;                                               // elke 3e lijn is hoofdweg
const V_HOOFD = 22, V_STAD = 11;                                 // m/s (~80 / ~40 km/h)
const MODI = { auto: 13.9, ev: 13.9, fiets: 4.4, lopen: 1.4 };  // terugval-ETA per m/s
const LANGS_M = 450;                                             // "langs de route" straal
const intelligence = require('./navigatie/intelligentie');
const { maakNederlandNet, binnenNederland } = require('./navigatie/nederland');
let nederlandNetCache;

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
  const partners = require('./navigatie/partner-events')({ db, save, crypto, haversine });
  if (nederlandNetCache === undefined) nederlandNetCache = maakNederlandNet({ haversine });
  const nederland = nederlandNetCache;

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
  }

  function bestemmingen(query, hier) {
    const q = zonderTekens(query);
    let rij = eigenPlekken();
    const laagZoek = ['laad', 'laadpaal', 'tank', 'tankstation', 'halte', 'ov', 'gemeente', 'overheid', 'leverancier'].includes(q);
    if (nederland && !laagZoek && (String(query || '').trim().length >= 2 || !query)) rij.push(...nederland.zoekPlekken(query));
    if (q) rij = rij.map(p => ({ ...p, zoekScore: scoreZoek(p, q) })).filter(p => p.zoekScore > 0);
    if (hier && hier.lat != null) rij.forEach(p => { p.afstandM = Math.round(meters(hier, p)); });
    rij.sort((a, b) => (b.zoekScore || 0) - (a.zoekScore || 0) || (a.afstandM ?? 9e9) - (b.afstandM ?? 9e9));
    return { status: 200, bestemmingen: rij.slice(0, 40) };
  }

  function zonderTekens(v) {
    return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function scoreZoek(p, q) {
    const naam = zonderTekens(p.naam), extra = zonderTekens((p.extra || '') + ' ' + p.soort + ' ' + p.laag);
    if (naam === q) return 100;
    if (naam.startsWith(q)) return 82;
    if (naam.includes(q)) return 64;
    const woorden = q.split(/\s+/).filter(Boolean);
    return woorden.every(w => (naam + ' ' + extra).includes(w)) ? 42 + woorden.length : 0;
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

  const lokaleRoute = require('./navigatie/route-engine')({ MODI, LANGS_M, GRID, POI, crypto, haversine,
    flitsRond, partners, meters, snap, zoek, stappenVan, intelligence });
  const nederlandRoute = nederland && require('./navigatie/route-engine')({ MODI, LANGS_M, GRID: null, POI, crypto, haversine,
    flitsRond, partners, meters, snap: nederland.snap, zoek: nederland.zoek, stappenVan: nederland.stappenVan,
    intelligence, netwerk: { bron: 'RTG Route Intelligence op het Rijkswaterstaat Nationaal Wegenbestand (NWB, CC0); geen externe kaartdienst' } });

  function route(vraag) {
    const vanNL = binnenNederland(vraag && vraag.van), naarNL = binnenNederland(vraag && vraag.naar);
    if (vanNL || naarNL) {
      if (!nederlandRoute) return { status: 503, error: 'Het Nederlandse wegennet is nog niet ingeladen.' };
      if (!vanNL || !naarNL) return { status: 422, error: 'Deze route kruist de huidige landsdekking.' };
      vraag.van.land = 'NL'; vraag.naar.land = 'NL';
      return nederlandRoute(vraag);
    }
    return lokaleRoute(vraag);
  }

  function status(hier) {
    const partnerEvents = partners.partnerEventsRond(hier, 40);
    const netwerk = flitsRond && hier ? (flitsRond(hier, hier.land).meldingen || []) : [];
    return { status: 200, motor: 'RTG Route Intelligence', versie: 3, eigenMotor: true,
      live: { netwerk: netwerk.length, partners: partnerEvents.length, bijgewerktAt: new Date().toISOString() },
      dekking: nederland ? { land: 'Nederland', actief: true, hierActief: binnenNederland(hier), wegvakken: Number(nederland.info.wegvakken || 0),
        bron: nederland.info.bron, licentie: nederland.info.licentie, gebouwdAt: nederland.info.gebouwd_at } : { land: 'Nederland', actief: false },
      profielen: Object.entries(intelligence.PROFIELEN).map(([id, p]) => ({ id, naam: p.naam })),
      mogelijkheden: ['live-verkeer', 'alternatieve-routes', 'eta-confidence', 'ev-energie', 'partner-events', 'privacy-routing', 'nederland-nwb'] };
  }

  // ---- de kaart voor de 3D-app: net-definitie + koppelpunten ----
  function kaart(hier) {
    if (nederland && binnenNederland(hier)) return nederland.kaart(hier, eigenPlekken());
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
  return { navBestemmingen: bestemmingen, navRoute: route, navPoi: poiLagen, navKaart: kaart, navMeld: meld,
    navStatus: status, navPartnerEvent: partners.navPartnerEvent, navPartnerEvents: partners.navPartnerEvents };
}

/* REF, BOUNDS en POI gaan mee naar buiten omdat het STADSWEEFSEL ze leest: de
   geografie van de stad hangt op hetzelfde middelpunt en dezelfde grenzen als
   het wegennet, en de laadpunten in het objectregister zijn dezelfde laadpunten
   als die de navigatie aanwijst. Een tweede middelpunt zou betekenen dat de
   stad en haar wegen naast elkaar bestaan zonder elkaar te raken. */
module.exports = { maakNavigatie, REF, BOUNDS, POI };
