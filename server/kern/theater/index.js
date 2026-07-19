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

function maakTheater({ db, save, crypto, schoon, codenaamVan, notify, sseToOffice, sseToCustomer, mediaDir }) {
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
  const kanaalVan = key => { lijsten(); return db.data.theaterKanalen.find(k => k.key === key) || null; };
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
      bewaring: v.bewaring || 'rtg', online: thuis ? thuisOnline(v) : true,
      codenaam: codenaamVan(v.key), reacties: (db.data.theaterReacties[v.id] || []).length, at: v.at };
  }
  function eigenBeeld(k) {
    return { id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, status: k.status,
      volgers: (k.volgers || []).length, gebruiktMb: mbVan(kanaalBytes(k)), maxMb: MAX_KANAAL_MB,
      videos: db.data.theaterVideos.filter(v => v.kanaalId === k.id).map(videoBeeld) };
  }
  function zaal(key) {
    lijsten();
    const rijen = db.data.theaterVideos.filter(v => {
      const k = kanaalMet(v.kanaalId);
      return v.klaar && k && k.status === 'goedgekeurd';
    }).map(videoBeeld).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const mijnAbb = new Set(db.data.theaterKanalen.filter(k => (k.volgers || []).includes(key)).map(k => k.id));
    const eigen = kanaalVan(key);
    return { status: 200, kwaliteit: 'Origineel beeld, tot 4K: wij hercomprimeren niets.',
      abonnementen: rijen.filter(v => mijnAbb.has(v.kanaalId)),
      nieuw: rijen.filter(v => !mijnAbb.has(v.kanaalId)).slice(0, 40),
      mijn: eigen ? eigenBeeld(eigen) : null, genres: GENRES, maxMb: MAX_VIDEO_MB };
  }
  function abonneer(key, kid, aan) {
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    k.volgers = (k.volgers || []).filter(x => x !== key);
    if (aan !== false) k.volgers.push(key);
    save();
    return { status: 200, ok: true, volg: aan !== false };
  }

  /* ---- reacties en melden (op codenaam, begrensd) ---- */
  function reactie(key, vid, tekst) {
    const v = videoMet(vid); if (!v || !v.klaar) return { status: 404, error: 'Video niet gevonden.' };
    tekst = schoon(tekst, 300); if (!tekst) return { status: 400, error: 'Lege reactie.' };
    const rij = db.data.theaterReacties[vid] = db.data.theaterReacties[vid] || [];
    const r = { codenaam: codenaamVan(key), tekst, at: nu() };
    rij.push(r); if (rij.length > REACTIES_MAX) db.data.theaterReacties[vid] = rij.slice(-REACTIES_MAX);
    save();
    return { status: 200, ok: true, reactie: r };
  }
  const reacties = vid => ({ status: 200, reacties: (db.data.theaterReacties[String(vid || '')] || []).slice(-40) });
  function meld(key, vid, reden) {
    const v = videoMet(vid); if (!v) return { status: 404, error: 'Video niet gevonden.' };
    lijsten();
    db.data.theaterMeldingen.push({ id: id(), videoId: v.id, titel: v.titel, van: codenaamVan(key),
      reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    db.data.theaterMeldingen = db.data.theaterMeldingen.slice(-200);
    save(); sseToOffice('sync', { scope: 'theater' });
    return { status: 200, ok: true };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, fs, path, mediaDir, schoon, nu, id, lijsten, kanaalVan, kanaalMet, videoMet,
    kanaalBytes, mbVan, sseToCustomer, thuisAanwezigheid, thuisOnline,
    THUIS_TTL_MS, THUIS_SIGNALEN, MAX_VIDEO_MB, MAX_KANAAL_MB
  };
  const v = require('./video')(ctx);
  return {
    theaterKanaalMaak: kanaalMaak, theaterOfficeLijst: officeLijst,
    theaterOfficeBeslis: officeBeslis, theaterVideoMaak: v.videoMaak, theaterVideoUpload: v.videoUpload,
    theaterVerwijder: v.verwijder, theaterStreamVan: v.streamVan, theaterZaal: zaal,
    theaterAbonneer: abonneer, theaterReactie: reactie, theaterReacties: reacties, theaterMeld: meld,
    theaterThuisAanwezig: v.thuisAanwezig, theaterSignaal: v.signaal
  };
}

module.exports = { maakTheater };
