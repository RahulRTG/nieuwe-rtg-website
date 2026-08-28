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
const { maakWereldNet } = require('./navigatie/wereld');
const { POI, maakPlekken } = require('./navigatie/plekken');
let nederlandNetCache, wereldNetCache;
const binnenIbiza = p => p && Number(p.lat) >= BOUNDS.lat0 && Number(p.lat) <= BOUNDS.lat1
  && Number(p.lng) >= BOUNDS.lng0 && Number(p.lng) <= BOUNDS.lng1;

function maakNavigatie({ db, save, crypto, haversine, flitsRond, flitsMeld }) {
  /* De pure meetkunde en de A*-grafenzoeker (projectie, net, snap, route,
     bocht-voor-bocht) draaien als submodule op de constanten; zie
     navigatie/wegennet.js. */
  const { meters, snap, zoek, stappenVan } = require('./navigatie/wegennet')({ REF, BOUNDS, GRID, ARTERIE, V_HOOFD, V_STAD, haversine });
  const partners = require('./navigatie/partner-events')({ db, save, crypto, haversine });
  if (nederlandNetCache === undefined) nederlandNetCache = maakNederlandNet({ haversine });
  if (wereldNetCache === undefined) wereldNetCache = maakWereldNet({ haversine });
  const nederland = nederlandNetCache;
  const wereld = wereldNetCache;
  const { eigenPlekken, bestemmingen, poiLagen } = maakPlekken({ db, meters, nederland, wereld, flitsRond });

  const lokaleRoute = require('./navigatie/route-engine')({ MODI, LANGS_M, GRID, POI, crypto, haversine,
    flitsRond, partners, meters, snap, zoek, stappenVan, intelligence });
  const nederlandRoute = nederland && require('./navigatie/route-engine')({ MODI, LANGS_M, GRID: null, POI, crypto, haversine,
    flitsRond, partners, meters, snap: nederland.snap, zoek: nederland.zoek, stappenVan: nederland.stappenVan,
    intelligence, netwerk: { bron: 'RTG Route Intelligence op het Rijkswaterstaat Nationaal Wegenbestand (NWB, CC0); geen externe kaartdienst' } });
  const wereldRoutes = new Map();
  function wereldRoute(net) {
    if (!net) return null;
    if (!wereldRoutes.has(net.id)) wereldRoutes.set(net.id, require('./navigatie/route-engine')({ MODI, LANGS_M, GRID: null, POI,
      crypto, haversine, flitsRond, partners, meters, snap: net.snap, zoek: net.zoek, stappenVan: net.stappenVan,
      intelligence, netwerk: { bron: 'RTG World Graph ' + net.def.naam + ' op OpenStreetMap (ODbL); lokaal berekend, geen externe routedienst' } }));
    return wereldRoutes.get(net.id);
  }

  function route(vraag) {
    const geldig = p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
    if (!vraag || !geldig(vraag.van) || !geldig(vraag.naar)) return { status: 400, error: 'Geef een geldig vertrek- en aankomstpunt.' };
    const vanNL = binnenNederland(vraag && vraag.van), naarNL = binnenNederland(vraag && vraag.naar);
    if (vanNL && naarNL) {
      if (!nederlandRoute) return { status: 503, error: 'Het Nederlandse wegennet is nog niet ingeladen.' };
      vraag.van.land = 'NL'; vraag.naar.land = 'NL';
      return nederlandRoute(vraag);
    }
    if (binnenIbiza(vraag && vraag.van) && binnenIbiza(vraag && vraag.naar)) return lokaleRoute(vraag);
    const regio = wereld && wereld.regioVoor(vraag && vraag.van, vraag && vraag.naar);
    const motor = wereldRoute(regio);
    if (motor) return motor(vraag);
    return { status: 503, error: vanNL || naarNL
      ? 'Voor deze grensoverschrijdende rit is het bijbehorende RTG World Graph-regiopakket nog niet geïnstalleerd.'
      : 'De wereldkaart is beschikbaar; installeer het routepakket voor deze regio om hier offline te navigeren.' };
  }

  function status(hier) {
    const partnerEvents = partners.partnerEventsRond(hier, 40);
    const netwerk = flitsRond && hier ? (flitsRond(hier, hier.land).meldingen || []) : [];
    const wereldStatus = wereld && wereld.status(hier);
    return { status: 200, motor: 'RTG Route Intelligence', versie: 4, eigenMotor: true,
      live: { netwerk: netwerk.length, partners: partnerEvents.length, bijgewerktAt: new Date().toISOString() },
      dekking: nederland ? { land: 'Nederland', actief: true, hierActief: binnenNederland(hier), wegvakken: Number(nederland.info.wegvakken || 0),
        bron: nederland.info.bron, licentie: nederland.info.licentie, gebouwdAt: nederland.info.gebouwd_at } : { land: 'Nederland', actief: false },
      wereld: wereldStatus,
      profielen: Object.entries(intelligence.PROFIELEN).map(([id, p]) => ({ id, naam: p.naam })),
      mogelijkheden: ['live-verkeer', 'alternatieve-routes', 'eta-confidence', 'ev-energie', 'partner-events', 'privacy-routing',
        'nederland-nwb', 'wereldatlas', 'regionale-world-graphs', 'offline-pakketten'] };
  }

  // ---- de kaart voor de 3D-app: net-definitie + koppelpunten ----
  function kaart(hier, opties = {}) {
    if (!opties.wereld && nederland && binnenNederland(hier)) return nederland.kaart(hier, eigenPlekken());
    if (opties.wereld || !binnenIbiza(hier)) return wereld.kaart(hier, eigenPlekken(), !!opties.wereld);
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
module.exports = { maakNavigatie, REF, BOUNDS, POI, binnenIbiza };
