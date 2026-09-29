/* Vonk-orkestrator: identiteit, profiel, selectie, match, Meet en veiligheid. */
const { coord } = require('../util');
const { maakOntmoetpoort, MIN_LEEFTIJD } = require('../ontmoetpoort');
const W = require('./wensen');
const B = require('../beschikbaar');
const H = require('./halfweg');
const V = require('./vak');
const Projection = require('../connection-projection');
const ConnectionPartner = require('../connection-partner');

const DAG_MAX = 6;            // de eindige dagselectie
const PRIJS_CENTEN = 1000;    // EUR 10 p.p.
const RTG_CENTEN = 500;       // waarvan EUR 5 voor RTG; de rest is aanbetaling bij de zaak

function maakVonk({ db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan, keyVanCodenaam,
  haversine, etaMinutes, reserveerTafel, pay, notify, sseToCustomer, sseToOffice, connectionBlocking,
  media, connectionMediaTicketSecret }) {
  const id = () => 'vonk' + crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  function d() {
    if (!db.data.vonk || typeof db.data.vonk !== 'object')
      db.data.vonk = { profielen: {}, likes: [], matches: [], meldingen: [] };
    V.migreerEenmaal(db.data.vonk, save);   // een punt van voor N21 wordt een vak
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
    p.blokkade = p.blokkade || [];
    p.actief = data.actief === false ? false : true;
    V.vakBijOpslaan(p, coord(data.lat, 90), coord(data.lng, 180));   // een vak van 5 km, nooit het punt (N21)
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
  /* `zelf` is het eigen profiel en krijgt alles, INCLUSIEF de wensen -- die gaan
     alleen naar de eigenaar terug. `niveau` bepaalt wat een ander ziet:
     'kandidaten' in de dagselectie, 'match' na een wederzijdse like. */
  let profileMedia = null;
  const { publiek, niveauVan } = require('./projecties')({ accounts, codenaamVan, W, H, Projection,
    mediaVan: () => profileMedia });

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
  const geblokkeerd = (a, b) => !!(((d().profielen[a] || {}).blokkade || []).includes(b)
    || ((d().profielen[b] || {}).blokkade || []).includes(a)
    || (connectionBlocking && connectionBlocking.isGeblokkeerd(a, b)));

  profileMedia = require('../connection-profile-media')({ db, save, crypto, media, schoon, gate: mag,
    isBlocked: geblokkeerd, isMatch: (a, b) => !!matchTussen(a, b),
    profileActive: owner => !!(d().profielen[owner] && d().profielen[owner].actief !== false),
    ticketSecret: connectionMediaTicketSecret });

  const communication = require('../connection-communication')({ product: 'vonk', db, save, crypto, media, schoon,
    ticketSecret: connectionMediaTicketSecret, notify, signal: sseToCustomer,
    isBlocked: geblokkeerd,
    resolveContext: (actor, input) => {
      const m = d().matches.find(x => x.id === String(input && input.id || '') && (x.a === actor || x.b === actor));
      return m ? { counterpart: m.a === actor ? m.b : m.a, scope: m.id } : null;
    } });
  if (connectionBlocking && connectionBlocking.onBlock)
    connectionBlocking.onBlock((a, b) => communication.terminatePair(a, b, 'BLOCKED'));

  const ctx = { db, save, schoon, id, nu, d, mag, likeVan, matchTussen, publiek, DAG_MAX, niveauVan, geblokkeerd,
    Projection,
    profileMedia, communication,
    codenaamVan, keyVanCodenaam, haversine,
    reserveerTafel, pay, notify, sseToCustomer, sseToOffice, PRIJS_CENTEN, RTG_CENTEN, connectionBlocking,
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
    optiesVoor: (pa, pb, planning) => {
      const P = V.paar(pa, pb);   // middens van de vakken (N21)
      if (!P) return null;
      return H.drieOpties({ ...P, suppliers: db.data.suppliers,
        afstandM: (p, l) => haversine({ lat: p.lat, lng: p.lng }, { lat: l.lat, lng: l.lng }),
        reisMin: m => etaMinutes(m, 'driving'), date: planning && planning.date,
        time: planning && planning.time, bookings: db.data.reserveringen || [] });
    },
    partnerEligible: (supplierCode, context) => {
      const s = Object.values(db.data.suppliers || {}).find(x => x.code === supplierCode);
      return !!(s && ConnectionPartner.eligible(s, 'vonk', { ...context,
        bookings: db.data.reserveringen || [], activeBookings: ConnectionPartner.activeBookings(
          db.data.reserveringen || [], s.code, context && context.date, context && context.time) }).ok);
    },
    tafelkaart: H.tafelkaart };
  const api = { vonkProfielZet: profielZet,
    vonkFotoUpload: profileMedia.upload, vonkFotoPubliceer: profileMedia.publiceer,
    vonkFotoVerwijder: profileMedia.verwijder, vonkFotoOrden: profileMedia.orden, vonkFotoLever: profileMedia.lever,
    vonkCommStatus: communication.status, vonkCommConsent: communication.consent, vonkCommText: communication.sendText,
    vonkCommRemove: communication.removeMessage, vonkCommReport: communication.reportMessage,
    vonkCommMedia: communication.sendMedia, vonkCommCallStart: communication.startCall,
    vonkCommCallAnswer: communication.answer, vonkCommCallSignal: communication.sendSignal,
    vonkCommCallPoll: communication.poll, vonkCommCallEnd: communication.end,
    vonkCommMediaLever: communication.deliver };
  Object.assign(api, require('./state')({ d, mag, nu, geblokkeerd, communication }));
  Object.assign(api, require('./selectie')(ctx));
  Object.assign(api, require('./kiezen')(ctx));
  Object.assign(api, require('./match')(ctx));
  return api;
}

module.exports = { maakVonk };
