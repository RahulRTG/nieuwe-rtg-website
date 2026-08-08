/* Kern-module "theater": RTG Theater, de videobibliotheek van het huis, op
   bioscoopniveau. Het uitgangspunt is omgekeerd aan het grote platform: wij
   hercomprimeren NIETS. Wat de maker uploadt (tot 4K) is exact wat de kijker
   ziet; de server geeft het beeld byte voor byte door (range-streaming is er
   voor soepel spoelen, nooit om kwaliteit af te knijpen).

   Spelregels:
   - Een kanaal gaat pas open na menselijke goedkeuring door RTG-kantoor
     (zelfde regel als overal: het systeem keurt nooit zelf goed).
   - Chronologisch en gecureerd: geen algoritmische aanbevelingen, geen
     autoplay, geen oneindige feed. Abonnementen staan bovenaan, dat is alles.
   - Alles op codenaam; melden ingebouwd; kantoor kan verwijderen.

   maakTheater(state) volgt het vaste kern-patroon. Dit is de orkestrator: het
   kanaal, de zaal (chronologisch, abonnementen eerst), de reacties en het melden
   wonen hier; de bytes, de upload/stream en het Thuisarchief in ./video. */

const fs = require('fs');
const path = require('path');

const MAX_VIDEO_MB = 400;          // bioscoopkwaliteit mag wegen; dit is de demo-grens
const MAX_KANAAL_MB = 1500;        // quotum per kanaal in de demo
const REACTIES_MAX = 200;
const GENRES = ['film', 'reizen', 'muziek', 'tafel', 'ambacht', 'salon'];

function maakTheater({ db, save, crypto, schoon, codenaamVan, notify, sseToOffice, sseToCustomer, mediaDir, accounts, findSupplier }) {
  const id = () => 'tv' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  try { fs.mkdirSync(mediaDir, { recursive: true }); } catch (e) {}
  /* Het Thuisarchief: de maker bewaart de video op het EIGEN apparaat; wij
     kennen alleen titel en affiche. Kijken loopt rechtstreeks (WebRTC-
     datakanaal) van maker naar kijker; hier staat alleen wie er nu 'thuis
     geeft' (aanwezigheid, kort houdbaar, alleen in RAM). */
  const THUIS_TTL_MS = 90 * 1000;
  const THUIS_SIGNALEN = ['vraag', 'offer', 'answer', 'ice', 'klaar', 'stop'];
  const thuisAanwezigheid = new Map();   // videoId -> ts van de laatste hartslag van de maker

  function lijsten() {
    if (!Array.isArray(db.data.theaterKanalen)) db.data.theaterKanalen = [];
    if (!Array.isArray(db.data.theaterVideos)) db.data.theaterVideos = [];
    if (!db.data.theaterReacties) db.data.theaterReacties = {};
    if (!Array.isArray(db.data.theaterMeldingen)) db.data.theaterMeldingen = [];
  }
  /* HET PERSOONLIJKE kanaal van dit lid. Een INTERN kanaal (van een zaak, zie
     ./zaak.js) draagt een zaakCode en telt hier niet mee: het hoort bij een
     organisatie en niet bij een mens, en wie de bibliotheek van zijn werk
     beheert mag daarnaast gewoon een eigen kanaal hebben. */
  const kanaalVan = key => { lijsten(); return db.data.theaterKanalen.find(k => k.key === key && !k.zaakCode) || null; };
  /* Bij welke organisaties hoort dit lid? Zelfde bron als het Podium
     (kern/werkplekken.js) -- een tweede antwoord op een toegangsvraag is er
     een te veel (LAT.md regel 4). */
  const { zakenVan, personeelVan } = require('../werkplekken').maakWerkplekken({ accounts, findSupplier });
  const kanaalMet = kid => { lijsten(); return db.data.theaterKanalen.find(k => k.id === kid) || null; };
  const videoMet = vid => { lijsten(); return db.data.theaterVideos.find(v => v.id === vid) || null; };
  const mbVan = bytes => bytes ? Math.max(0.1, Math.round(bytes / 1048576 * 10) / 10) : 0;
  const kanaalBytes = k => db.data.theaterVideos.filter(v => v.kanaalId === k.id && v.klaar).reduce((n, v) => n + (v.bytes || 0), 0);
  const thuisOnline = v => v.bewaring === 'thuis' && Date.now() - (thuisAanwezigheid.get(v.id) || 0) < THUIS_TTL_MS;

  /* ---- het kanaal: aanmelden, en pas open na een mens van kantoor ---- */
  function kanaalMaak(key, data) {
    lijsten();
    if (kanaalVan(key)) return { status: 409, error: 'U heeft al een kanaal.' };
    const naam = schoon(data.naam, 40); if (!naam) return { status: 400, error: 'Geef het kanaal een naam.' };
    const k = { id: id(), key, naam, genre: GENRES.includes(data.genre) ? data.genre : 'salon',
      bio: schoon(data.bio, 300), status: 'wacht', volgers: [], at: nu() };
    db.data.theaterKanalen.push(k); save();
    sseToOffice('sync', { scope: 'theater' });
    return { status: 200, ok: true, kanaal: eigenBeeld(k) };
  }
  function officeLijst() {
    lijsten();
    return { wacht: db.data.theaterKanalen.filter(k => k.status === 'wacht').map(k => ({ id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, codenaam: codenaamVan(k.key), at: k.at })),
      meldingen: db.data.theaterMeldingen.slice(-50).reverse() };
  }
  function officeBeslis(kid, besluit) {
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    if (!['goedgekeurd', 'geweigerd'].includes(besluit)) return { status: 400, error: 'Besluit is goedgekeurd of geweigerd.' };
    k.status = besluit; save();
    notify(k.key, { title: 'RTG Theater', body: besluit === 'goedgekeurd' ? 'Uw kanaal "' + k.naam + '" is goedgekeurd.' : 'Uw kanaal "' + k.naam + '" is niet goedgekeurd.', scope: 'theater' });
    return { status: 200, ok: true };
  }

  /* ---- de zaal: chronologisch, abonnementen eerst, geen algoritme ---- */
  function videoBeeld(v) {
    const k = kanaalMet(v.kanaalId);
    const thuis = v.bewaring === 'thuis';
    return { id: v.id, titel: v.titel, omschrijving: v.omschrijving, poster: v.poster,
      duurS: v.duurS, mb: thuis ? (v.mbGeschat || 0) : mbVan(v.bytes), kanaal: k ? k.naam : '?', kanaalId: v.kanaalId,
      /* Twee velden voor de laag erboven (kern/mediaos/): het GENRE van het
         kanaal is het enige onderwerp dat hier bekend is en waarop een lid zijn
         wereld kan bijsturen, en KLAAR zegt of de bytes er al op staan -- het
         eigen kanaal toont ook lege kaarten, en zonder dit veld stond daar een
         filter op dat nooit iets kon uitsluiten (LAT.md regel 9). */
      genre: k ? k.genre : null, klaar: !!v.klaar,
      // draagt deze video bij een INTERNE bibliotheek? (leeg = openbaar)
      zaakCode: k && k.zaakCode ? k.zaakCode : null,
      bewaring: v.bewaring || 'rtg', online: thuis ? thuisOnline(v) : true,
      codenaam: codenaamVan(v.key), reacties: (db.data.theaterReacties[v.id] || []).length, at: v.at };
  }
  function eigenBeeld(k) {
    return { id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, status: k.status,
      volgers: (k.volgers || []).length, gebruiktMb: mbVan(kanaalBytes(k)), maxMb: MAX_KANAAL_MB,
      videos: db.data.theaterVideos.filter(v => v.kanaalId === k.id).map(videoBeeld) };
  }
  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, fs, path, mediaDir, schoon, nu, id, lijsten, kanaalVan, kanaalMet, videoMet,
    kanaalBytes, mbVan, sseToCustomer, sseToOffice, thuisAanwezigheid, thuisOnline,
    zakenVan, personeelVan, videoBeeld, eigenBeeld, codenaamVan, GENRES, REACTIES_MAX,
    THUIS_TTL_MS, THUIS_SIGNALEN, MAX_VIDEO_MB, MAX_KANAAL_MB
  };
  /* De interne bibliotheek van een organisatie (Media for Business, opgenomen
     kant) staat in ./zaak.js. Hij hoort HIER en niet in een laag erboven: een
     laag erboven kan alleen filteren wat er al is, en alles wat er al is, is
     openbaar. "Intern" moet bij het publiceren vastliggen. */
  const zaak = require('./zaak')(ctx);
  ctx.zaakMagVideo = zaak.zaakMagVideo;
  ctx.zaak = zaak;
  const v = require('./video')(ctx);
  /* De zaal (chronologisch, abonnementen eerst), abonneren, reageren en melden
     staan in ./zaal.js: dat is WAT DE KIJKER ZIET EN DOET, een ander onderwerp
     dan het beheren van een kanaal en zijn bytes. */
  const z = require('./zaal')(ctx);
  /* Wat uw werk u vraagt te bekijken (./kijkplicht.js). Bewust een eigen
     bestand, want het draagt een eigen belofte: de medewerker tekent zelf af en
     er wordt GEEN kijkgedrag gemeten. Die belofte hoort op een plek te staan
     waar je hem kunt lezen. */
  const kp = require('./kijkplicht')(ctx);
  /* Lezers voor de Media OS: vragen die het Theater over ZICHZELF beantwoordt,
     zodat de laag erboven geen tweede administratie aanlegt (regel 4). */
  const kanaalVanMaker = (makerKey) => {
    const k = kanaalVan(makerKey);
    return k && k.status === 'goedgekeurd' ? eigenBeeld(k) : null;
  };
  const videosVanMaker = (makerKey) => {
    const k = kanaalVan(makerKey);
    if (!k || k.status !== 'goedgekeurd') return [];
    return db.data.theaterVideos.filter(x => x.kanaalId === k.id && x.klaar).map(videoBeeld);
  };
  const volgtMaker = (key, makerKey) => {
    const k = kanaalVan(makerKey);
    return !!(k && (k.volgers || []).includes(key));
  };
  // de sleutels van de abonnees, voor wie ze een voor een wil wekken
  const volgersVanMaker = (makerKey) => {
    const k = kanaalVan(makerKey);
    return k && k.status === 'goedgekeurd' ? (k.volgers || []).slice() : [];
  };
  return {
    theaterKanaalVan: kanaalVanMaker, theaterVideosVan: videosVanMaker, theaterVolgt: volgtMaker,
    theaterVolgersVan: volgersVanMaker,
    theaterKanaalMaak: kanaalMaak, theaterOfficeLijst: officeLijst,
    theaterOfficeBeslis: officeBeslis, theaterVideoMaak: v.videoMaak, theaterVideoUpload: v.videoUpload,
    theaterVerwijder: v.verwijder, theaterStreamVan: v.streamVan, theaterZaal: z.zaal,
    theaterAbonneer: z.abonneer, theaterReactie: z.reactie, theaterReacties: z.reacties, theaterMeld: z.meld,
    theaterThuisAanwezig: v.thuisAanwezig, theaterSignaal: v.signaal,
    // Media for Business, opgenomen kant (./zaak.js)
    theaterZaakMaak: zaak.zaakKanaalMaak, theaterZaakZaal: zaak.zaakZaal,
    theaterZaakVideos: zaak.zaakVideosVoor,
    theaterKijkplichtZet: kp.kijkplichtZet, theaterKijkplichtGedaan: kp.kijkplichtGedaan,
    theaterKijkplichtMijn: kp.kijkplichtMijn, theaterKijkplichtStand: kp.kijkplichtStand
  };
}

module.exports = { maakTheater };
