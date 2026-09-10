/* Huiseigen navigatie: lokaal stadsnet plus de dagelijkse CC0-import van alle
   Nederlandse NWB-wegvakken. Eigen A*, bestemmingen uit RTG/NWB, Flits als
   live laag en positie alleen voor de berekening, nooit als reisgeschiedenis. */

/* Middelpunt, grenzen, rasterinstellingen en de POI-lagen staan in
   ./navigatie/geografie.js -- gegevens die kern/plaats en het stadsweefsel
   meelezen, en die dit bestand alleen doorgeeft. */
const { REF, BOUNDS, GRID, ARTERIE, V_HOOFD, V_STAD, MODI, LANGS_M, POI } = require('./navigatie/geografie');
const intelligence = require('./navigatie/intelligentie');
const { maakNederlandNet, binnenNederland } = require('./navigatie/nederland');
const dekking = require('./navigatie/dekking');
let nederlandNetCache;

function maakNavigatie({ db, save, crypto, haversine, flitsRond, flitsMeld }) {
  /* De pure meetkunde en de A*-grafenzoeker (projectie, net, snap, route,
     bocht-voor-bocht) draaien als submodule op de constanten; zie
     navigatie/wegennet.js. */
  const { meters, snap, zoek, stappenVan } = require('./navigatie/wegennet')({ REF, BOUNDS, GRID, ARTERIE, V_HOOFD, V_STAD, haversine });
  const partners = require('./navigatie/partner-events')({ db, save, crypto, haversine });
  if (nederlandNetCache === undefined) nederlandNetCache = maakNederlandNet({ haversine });
  const nederland = nederlandNetCache;

  /* De koppeling van de eigen bronnen staat in ./navigatie/plekken.js: plekken
     ophalen is een andere taak dan routes rekenen. */
  const eigenPlekken = require('./navigatie/plekken')({ db, POI });

  function bestemmingen(query, hier) {
    const stuk = gebiedStuk(hier); if (stuk) return stuk;
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
    const stuk = gebiedStuk(hier); if (stuk) return stuk;
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
  /* Een pakketmotor komt uit EEN fabriek: Nederland stond hier uitgeschreven
     en de gebiedslaag heeft dezelfde regels nodig (LAT.md regel 4). */
  const maakRouteMotor = (net, netwerk) => require('./navigatie/route-engine')({ MODI, LANGS_M, GRID: null,
    POI, crypto, haversine, flitsRond, partners, meters, intelligence,
    snap: net.snap, zoek: net.zoek, stappenVan: net.stappenVan, netwerk });
  const nederlandRoute = nederland && maakRouteMotor(nederland,
    { bron: 'RTG Route Intelligence op het Rijkswaterstaat Nationaal Wegenbestand (NWB, CC0); geen externe kaartdienst' });
  /* De motoren per gebied; zonder gebiedsindex geeft hij niets en blijft
     alles zoals het was. De drie regels staan in gebiednetten.js. */
  const netten = require('./navigatie/gebiednetten').maakGebiedNetten({ haversine,
    eersteKeus: nederland, eersteKeusBinnen: binnenNederland,
    maakRouteMotor: (net) => maakRouteMotor(net, { bron: (net.info && net.info.bron) || 'OpenStreetMap (ODbL 1.0)' }) });

  // wat deze motor over zijn eigen dekking weet, staat in ./navigatie/dekking.js
  const inNLZonderNet = (hier) => dekking.inNLZonderNet(nederland, hier);
  /* DE ORDE VAN DE VIER GEVALLEN, en die is gemeten en niet bedacht:

       1. het eigen NWB-pakket voor Nederland;
       2. een GELADEN gebiedspakket -- ook binnen Nederland, want een echte
          kaart is beter dan een weigering. Hier stond de Nederlandse weigering
          eerst, en dan kreeg iemand die het OSM-pakket van Nederland wel had
          gebouwd en het NWB niet, "Geen kaartdata voor Nederland" terwijl er
          een bruikbare kaart klaarlag;
       3. binnen Nederland zonder enige import: de bestaande weigering;
       4. een AANGEBODEN gebied zonder geladen pakket: weigeren met de reden.

     Geen gebied blijft null en laat het demonstratieraster staan. */
  const gebiedStuk = (hier, post) => {
    const g = post === undefined ? netten.voorPunt(hier) : post;
    if (g && g.net) return null;
    if (inNLZonderNet(hier)) return dekking.geenNederlandsNet();
    return g ? dekking.geenGebiedsnet(g) : null;
  };

  function route(vraag) {
    const vanNL = binnenNederland(vraag && vraag.van), naarNL = binnenNederland(vraag && vraag.naar);
    if (vanNL || naarNL) {
      /* Geen NWB, maar wel een gebouwd gebiedspakket over dit punt? Dan rekent
         dat pakket. Zelfde orde als hierboven: een echte kaart gaat voor een
         weigering. */
      if (!nederlandRoute) {
        const g = netten.routeVoor(vraag && vraag.van, vraag && vraag.naar);
        if (g && g.motor) return g.motor(vraag);
        return dekking.geenNederlandsNet();
      }
      if (!vanNL || !naarNL) return { status: 422, error: 'Deze route kruist de huidige landsdekking.' };
      vraag.van.land = 'NL'; vraag.naar.land = 'NL';
      return nederlandRoute(vraag);
    }
    /* Buiten Nederland: rekent de motor van het gebouwde gebied, en anders
       blijft het demonstratieraster over -- zoals hiervoor. */
    const g = netten.routeVoor(vraag && vraag.van, vraag && vraag.naar);
    if (g && g.error) return g;
    if (g && g.motor) return g.motor(vraag);
    return lokaleRoute(vraag);
  }

  function status(hier) {
    const partnerEvents = partners.partnerEventsRond(hier, 40);
    const netwerk = flitsRond && hier ? (flitsRond(hier, hier.land).meldingen || []) : [];
    return { status: 200, motor: 'RTG Route Intelligence', versie: 3, eigenMotor: true,
      live: { netwerk: netwerk.length, partners: partnerEvents.length, bijgewerktAt: new Date().toISOString() },
      ...dekking.dekkingsbeeld(nederland, hier, netten.voorPunt(hier)),
      pakketten: netten.stand(),
      profielen: Object.entries(intelligence.PROFIELEN).map(([id, p]) => ({ id, naam: p.naam })),
      mogelijkheden: ['live-verkeer', 'alternatieve-routes', 'eta-confidence', 'ev-energie', 'partner-events', 'privacy-routing', 'nederland-nwb'] };
  }

  // ---- de kaart voor de 3D-app: net-definitie + koppelpunten ----
  function kaart(hier) {
    if (nederland && binnenNederland(hier)) return nederland.kaart(hier, eigenPlekken());
    /* Een aanroep en niet twee: `voorPunt` onthoudt zijn uitslag wel, maar wie
       hem twee keer vraagt suggereert dat het antwoord ertussen kan wijzigen. */
    const g = netten.voorPunt(hier);
    const stuk = gebiedStuk(hier, g); if (stuk) return stuk;
    if (g) return g.net.kaart(hier, eigenPlekken());
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

/* REF, BOUNDS en POI gaan mee naar buiten omdat het STADSWEEFSEL ze leest;
   de reden staat in ./navigatie/geografie.js. */
module.exports = { maakNavigatie, REF, BOUNDS, POI };
