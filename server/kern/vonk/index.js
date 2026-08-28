/* Kern-module "vonk": RTG Vonk, de datingkant van het ledenbestand. Leden
   (18+, met actief RTG-geverifieerd paspoort, net als het Podium) maken een
   profiel op CODENAAM met hun wensen; de app stelt elke dag een eindige,
   wederzijds passende selectie voor (geen oneindige swipe-stroom). Liken
   twee mensen elkaar, dan is het een match: de chatlijn gaat open en RTG
   zet automatisch een tafel voor twee klaar bij een partner rond het
   geografische MIDDEN van hun twee woonplaatsen. De date kost EUR 10 p.p.
   (vooraf, via RTG Pay): EUR 5 voor RTG en EUR 5 als aanbetaling bij de
   zaak. Veiligheid op Salon-niveau: alleen stad zichtbaar (nooit adres),
   chat pas na een match, blokkeren en melden met backoffice-opvolging.

   DE VOORKEURSTAAL (./wensen.js) is wat Vonk onderscheidt van matchen op
   afstand en interesses: per as kan een lid zeggen of iets VERPLICHT is, een
   STERKE VOORKEUR of LEUK MEEGENOMEN, en alleen het eerste filtert -- en dan nog
   alleen op een uitgesproken tegenstelling. Wat een lid van een ander vraagt
   (`wensen`) is voor niemand zichtbaar; wat een lid over zichzelf zegt
   (`kenmerken`) is per as zelf op zichtbaar/na-een-match/alleen-de-engine te
   zetten. De reden bij een kandidaat noemt daarom nooit een waarde die het lid
   verborgen houdt. Zie de kop van ./wensen.js voor het waarom.

   maakVonk(state) volgt het vaste kern-patroon. Dit is de orkestrator: de
   poort, het profiel/de wensen en de dagselectie wonen hier; de voorkeurstaal
   in ./wensen; de like/match, het betalen, de chat en het blokkeren/melden in
   ./match. */
const { coord } = require('../util');
const { maakOntmoetpoort, MIN_LEEFTIJD } = require('../ontmoetpoort');
const W = require('./wensen');
const B = require('../beschikbaar');
const H = require('./halfweg');

const DAG_MAX = 6;            // de eindige dagselectie
const PRIJS_CENTEN = 1000;    // EUR 10 p.p.
const RTG_CENTEN = 500;       // waarvan EUR 5 voor RTG; de rest is aanbetaling bij de zaak

const { maakLidstand } = require('../betrouwbaarheid');

function maakVonk({ db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan, keyVanCodenaam,
  haversine, etaMinutes, reserveerTafel, pay, notify, sseToCustomer, sseToOffice }) {
  const id = () => 'vonk' + crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  function d() {
    if (!db.data.vonk || typeof db.data.vonk !== 'object')
      db.data.vonk = { profielen: {}, likes: [], matches: [], meldingen: [] };
    return db.data.vonk;
  }

  /* ---- de poort: 18+ met actief geverifieerd paspoort (zelfde lat als Podium)
     Woont in kern/ontmoetpoort.js, samen met Rendez-vous. Stond hier ooit
     uitgeschreven, en juist daardoor had Rendez-vous hem niet -- zie de kop
     daar. De pas-eis blijft op de route: Vonk is er voor elke pas. ---- */
  const { ontmoetPoort } = maakOntmoetpoort({ accounts, leeftijdVan });
  const mag = key => ontmoetPoort(key, 'Vonk');

  function profielZet(key, data) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const p = d().profielen[key] || {};
    const g = v => ['v', 'm', 'x'].includes(v) ? v : null;
    p.over = schoon(data.over, 200) || p.over || '';
    p.geslacht = g(data.geslacht) || p.geslacht || 'x';
    p.zoekt = Array.isArray(data.zoekt) ? data.zoekt.filter(g).slice(0, 3) : (p.zoekt || ['v', 'm', 'x']);
    p.leeftijdMin = Math.max(MIN_LEEFTIJD, Math.min(99, parseInt(data.leeftijdMin, 10) || p.leeftijdMin || MIN_LEEFTIJD));
    p.leeftijdMax = Math.max(p.leeftijdMin, Math.min(99, parseInt(data.leeftijdMax, 10) || p.leeftijdMax || 99));
    p.maxKm = Math.max(5, Math.min(500, parseInt(data.maxKm, 10) || p.maxKm || 100));
    if (Array.isArray(data.interesses)) p.interesses = data.interesses.map(x => schoon(x, 24)).filter(Boolean).slice(0, 8);
    p.interesses = p.interesses || [];
    p.stad = schoon(data.stad, 40) || p.stad || '';
    if (isFinite(data.lat) && isFinite(data.lng)) { p.lat = coord(data.lat, 90); p.lng = coord(data.lng, 180); }
    p.blokkade = p.blokkade || [];
    p.actief = data.actief === false ? false : true;
    p.leeftijd = poort.leeftijd;
    /* De voorkeurstaal (./wensen.js). Drie gescheiden dingen, en die scheiding
       is het punt: kenmerken zijn wie u bent, wensen zijn wat u van een ander
       vraagt en zijn voor niemand zichtbaar, zicht bepaalt per as wie uw eigen
       antwoord ziet. */
    /* Blind Availability (../beschikbaar.js): een ritme in dagdelen, geen agenda.
       Gaat NOOIT mee in `publiek` -- alleen de doorsnede komt eruit, en pas na
       een wederzijdse match. */
    if (data.beschikbaar !== undefined) p.beschikbaar = B.schoonBeschikbaar(data.beschikbaar);
    /* Wat de PLEK moet kunnen (./halfweg.js). Engine-only: gaat nooit mee in
       `publiek`, en het budget al helemaal niet -- ONTMOETEN.md par. 3.6. */
    if (data.datewens !== undefined) p.datewens = H.zetDatewens(p.datewens, data.datewens);
    p.kenmerken = W.zetKenmerken(p.kenmerken, data.kenmerken);
    p.wensen = W.zetWensen(p.wensen, data.wensen);
    p.zicht = W.zetZicht(p.zicht, data.zicht);
    d().profielen[key] = p;
    save();
    return { status: 200, ok: true, profiel: publiek(key, p, true) };
  }
  /* HOE ZEKER RTG WEET DAT DIT DEZE MENS IS, en waarom dat hier hoort.

     De poort hierboven zegt tegen wie hem niet haalt: "Activeer eerst uw
     RTG-geverifieerde paspoort (KYC); zo weet iedereen op Vonk dat de ander
     echt is." Dat is een belofte aan de ANDER -- en die bereikte hem nooit. Op
     een kaartje stond een codenaam, een leeftijd en een stad, precies zoals op
     elk ander datingprofiel ter wereld.

     De poort garandeert al minstens A3, dus dit is geen zeef maar een
     onderscheid: A4 betekent dat RTG de selfie naast het document heeft gelegd
     en dus dat dit gezicht bij dat paspoort hoort. Dat is exact wat je wilt
     weten voordat je met een vreemde afspreekt, en het staat nergens anders in
     dit huis waar iemand het kan lezen. */
  const lidstandVan = maakLidstand({ accounts });
  const niveauVan = key => {
    try { const st = lidstandVan(key); return st && st.niveau ? { id: st.niveau.id, naam: st.niveau.naam } : null; }
    catch (e) { return null; }
  };

  /* `zelf` is het eigen profiel en krijgt alles, INCLUSIEF de wensen -- die gaan
     alleen naar de eigenaar terug. `niveau` bepaalt wat een ander ziet:
     'kandidaten' in de dagselectie, 'match' na een wederzijdse like. */
  const publiek = (key, p, zelf, niveau) => ({ codenaam: codenaamVan(key), over: p.over, leeftijd: p.leeftijd,
    stad: p.stad, interesses: p.interesses, betrouwbaarheid: niveauVan(key), kenmerken: W.toonKenmerken(p, zelf ? 'match' : (niveau || 'kandidaten')),
    ...(zelf ? { geslacht: p.geslacht, zoekt: p.zoekt, leeftijdMin: p.leeftijdMin, leeftijdMax: p.leeftijdMax,
      /* afstandActief komt uit de dating-premium-ronde op main: het scherm zegt
         ermee of de afstandsfilter iets kan meten (er is een eigen plek bekend)
         of dood staat. Alleen voor de eigenaar, net als de rest van dit blok. */
      maxKm: p.maxKm, actief: p.actief, afstandActief: isFinite(p.lat) && isFinite(p.lng),
      wensen: p.wensen || {}, zicht: p.zicht || {},
      beschikbaar: p.beschikbaar || [], datewens: p.datewens || H.zetDatewens(null, {}) } : {}) });

  /* ---- de dagselectie: eindig en wederzijds passend ----
     pastBij dekt de drie eisen die ALTIJD hard zijn en die daarom niet in de
     assentabel staan: geslacht, leeftijd en afstand. De verplichte eisen uit de
     voorkeurstaal komen er in hardePoort naast; samen zijn dat de twee filters,
     en ze werken allebei WEDERZIJDS -- uw eis telt, en die van de ander ook. */

  // de gedeelde ctx voor de deelbestanden
  /* likeVan en matchTussen staan hier en niet in ./selectie: ./match heeft ze
     ook nodig, en een waarheid die twee delen gebruiken hoort in de laag die ze
     allebei krijgen (LAT.md regel 4). */
  const likeVan = (van, naar) => d().likes.find(l => l.van === van && l.naar === naar);
  const matchTussen = (a, b) => d().matches.find(m => (m.a === a && m.b === b) || (m.a === b && m.b === a));

  const ctx = { db, save, schoon, id, nu, d, mag, likeVan, matchTussen, publiek, DAG_MAX, niveauVan,
    codenaamVan, keyVanCodenaam, haversine,
    reserveerTafel, pay, notify, sseToCustomer, sseToOffice, PRIJS_CENTEN, RTG_CENTEN,
    /* Pas na een wederzijdse like gaan de assen open die op 'match' staan. Dat
       is wat die zichtbaarheidskeuze BETEKENT; zonder deze regel was het een
       knop die niets doet (LAT.md regel 8). */
    kenmerkenVan: (k) => W.toonKenmerken(d().profielen[k] || {}, 'match'),
    /* De enige uitweg voor beschikbaarheid, en hij loopt via ./match omdat daar
       de wederzijdse match staat. Geeft een dagdeel of niets, nooit een lijst. */
    wanneerMet: (mij, ander) => B.zin((d().profielen[mij] || {}).beschikbaar,
      (d().profielen[ander] || {}).beschikbaar),
    rooster: B.rooster,
    /* De drie plekken rond het midden. De aardrijkskunde blijft hier -- halfweg
       rekent niet zelf aan afstanden maar krijgt ze aangeleverd. */
    optiesVoor: (pa, pb) => {
      if (!pa || !pb || !isFinite(pa.lat) || !isFinite(pa.lng) || !isFinite(pb.lat) || !isFinite(pb.lng)) return null;
      return H.drieOpties({ a: pa, b: pb, suppliers: db.data.suppliers,
        mid: { lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 },
        afstandM: (p, l) => haversine({ lat: p.lat, lng: p.lng }, { lat: l.lat, lng: l.lng }),
        reisMin: m => etaMinutes(m, 'driving') });
    },
    tafelkaart: H.tafelkaart };
  const api = { vonkProfielZet: profielZet };
  Object.assign(api, require('./selectie')(ctx));
  Object.assign(api, require('./kiezen')(ctx));
  Object.assign(api, require('./match')(ctx));
  return api;
}

module.exports = { maakVonk };
