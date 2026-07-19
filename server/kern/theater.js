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
   - Eerlijk over data: elke video toont vooraf zijn grootte in MB.
   - Videobestanden staan als bestanden in de datamap (nooit in git); de
     metadata staat in de database. In productie schuift hier een CDN in
     via dezelfde leesfunctie.

   maakTheater(state) volgt het vaste kern-patroon. */

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

  /* ---- de video: eerst de kaart, dan de bytes (originele kwaliteit) ---- */
  function videoMaak(key, data) {
    const k = kanaalVan(key);
    if (!k) return { status: 404, error: 'Meld eerst een kanaal aan.' };
    if (k.status !== 'goedgekeurd') return { status: 403, error: 'Uw kanaal wacht nog op goedkeuring door RTG-kantoor.' };
    const titel = schoon(data.titel, 80); if (!titel) return { status: 400, error: 'Geef de video een titel.' };
    let poster = null;
    if (typeof data.poster === 'string' && /^data:image\/(jpeg|webp);base64,/.test(data.poster) && data.poster.length < 120000) poster = data.poster;
    const thuis = data.bewaring === 'thuis';
    const v = { id: id(), kanaalId: k.id, key, titel, omschrijving: schoon(data.omschrijving, 400),
      duurS: Math.min(Math.max(Math.round(Number(data.duurS) || 0), 0), 6 * 3600), poster,
      bewaring: thuis ? 'thuis' : 'rtg',
      // een thuis-video is meteen 'klaar': de bytes blijven bij de maker,
      // wij noteren alleen de (door de maker gemelde) omvang voor de kijker
      klaar: thuis, mbGeschat: thuis ? Math.min(Math.max(Math.round(Number(data.mbGeschat) || 0), 0), 100000) : 0,
      bytes: 0, ext: null, at: nu() };
    db.data.theaterVideos.push(v); save();
    return { status: 200, ok: true, id: v.id, maxMb: MAX_VIDEO_MB, bewaring: v.bewaring };
  }
  // de bytes zelf: exact bewaren wat binnenkomt; alleen echt beeldmateriaal
  function videoUpload(key, vid, buffer) {
    const v = videoMet(vid); if (!v || v.key !== key) return { status: 404, error: 'Video niet gevonden.' };
    if (v.bewaring === 'thuis') return { status: 409, error: 'Deze video blijft bij u thuis; er wordt niets bij RTG bewaard.' };
    if (v.klaar) return { status: 409, error: 'Deze video is al geupload.' };
    if (!Buffer.isBuffer(buffer) || buffer.length < 100) return { status: 400, error: 'Geen videobestand ontvangen.' };
    if (buffer.length > MAX_VIDEO_MB * 1048576) return { status: 413, error: 'Tot ' + MAX_VIDEO_MB + ' MB per video in deze demo.' };
    const k = kanaalMet(v.kanaalId);
    if (kanaalBytes(k) + buffer.length > MAX_KANAAL_MB * 1048576)
      return { status: 413, error: 'Het kanaalquotum (' + MAX_KANAAL_MB + ' MB) is vol; verwijder eerst iets.' };
    const webm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    const mp4 = buffer.slice(4, 8).toString('latin1') === 'ftyp';
    if (!webm && !mp4) return { status: 415, error: 'Alleen webm of mp4; het bestand komt ongewijzigd bij de kijker.' };
    v.ext = webm ? 'webm' : 'mp4';
    try { fs.writeFileSync(path.join(mediaDir, v.id + '.' + v.ext), buffer); }
    catch (e) { return { status: 500, error: 'Opslaan mislukte: ' + e.message }; }
    v.bytes = buffer.length; v.klaar = true; save();
    return { status: 200, ok: true, mb: mbVan(v.bytes) };
  }
  function videoWeg(vid) {
    const v = videoMet(vid); if (!v) return;
    try { if (v.ext) fs.unlinkSync(path.join(mediaDir, v.id + '.' + v.ext)); } catch (e) {}
    db.data.theaterVideos = db.data.theaterVideos.filter(x => x.id !== vid);
    delete db.data.theaterReacties[vid];
    save();
  }
  function verwijder(key, vid, kantoor) {
    const v = videoMet(vid); if (!v) return { status: 404, error: 'Video niet gevonden.' };
    if (!kantoor && v.key !== key) return { status: 403, error: 'Alleen de maker of kantoor verwijdert een video.' };
    videoWeg(vid);
    return { status: 200, ok: true };
  }
  // voor de kijk-route: waar de bytes staan (in productie: de CDN-verwijzing)
  function streamVan(vid) {
    const v = videoMet(vid); if (!v || !v.klaar || !v.ext) return null;   // thuis-video: wij hebben de bytes niet
    return { pad: path.join(mediaDir, v.id + '.' + v.ext), bytes: v.bytes,
      type: v.ext === 'webm' ? 'video/webm' : 'video/mp4', titel: v.titel };
  }

  /* ---- het Thuisarchief: aanwezigheid en het signaal-doorgeefluik ---- */
  function thuisAanwezig(key, ids) {
    lijsten();
    const geaccepteerd = [];
    for (const vid of (Array.isArray(ids) ? ids.slice(0, 100) : [])) {
      const v = videoMet(String(vid));
      if (v && v.key === key && v.bewaring === 'thuis') { thuisAanwezigheid.set(v.id, Date.now()); geaccepteerd.push(v.id); }
    }
    return { status: 200, ok: true, geaccepteerd, ttlS: THUIS_TTL_MS / 1000 };
  }
  const thuisOnline = v => v.bewaring === 'thuis' && Date.now() - (thuisAanwezigheid.get(v.id) || 0) < THUIS_TTL_MS;
  function signaal(key, vid, kind, doelKey, payload) {
    const v = videoMet(vid); if (!v || v.bewaring !== 'thuis') return { status: 404, error: 'Video niet gevonden.' };
    if (!THUIS_SIGNALEN.includes(kind)) return { status: 400, error: 'Onbekend signaal.' };
    const ikMaker = v.key === key;
    if (ikMaker && !doelKey) return { status: 400, error: 'De maker antwoordt gericht aan een kijker.' };
    if (!ikMaker && !thuisOnline(v)) return { status: 409, error: 'De maker is nu niet online; dit werk staat alleen op diens eigen apparaat.' };
    const doel = ikMaker ? String(doelKey) : v.key;
    sseToCustomer(doel, 'theater', { kind, videoId: v.id, van: key, payload: payload || null });
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
  function eigenBeeld(k) {
    return { id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, status: k.status,
      volgers: (k.volgers || []).length, gebruiktMb: mbVan(kanaalBytes(k)), maxMb: MAX_KANAAL_MB,
      videos: db.data.theaterVideos.filter(v => v.kanaalId === k.id).map(videoBeeld) };
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

  return { theaterKanaalMaak: kanaalMaak, theaterOfficeLijst: officeLijst,
    theaterOfficeBeslis: officeBeslis, theaterVideoMaak: videoMaak, theaterVideoUpload: videoUpload,
    theaterVerwijder: verwijder, theaterStreamVan: streamVan, theaterZaal: zaal,
    theaterAbonneer: abonneer, theaterReactie: reactie, theaterReacties: reacties, theaterMeld: meld,
    theaterThuisAanwezig: thuisAanwezig, theaterSignaal: signaal };
}

module.exports = { maakTheater };
