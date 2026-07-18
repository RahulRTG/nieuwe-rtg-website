/* Kern-module "clips": RTG Clips, korte verticale video's van leden. Het
   origineel staat ALLEEN op het toestel van de maker, in het Origin Private
   File System (OPFS) van de browser; bij RTG landen enkel titel, duur, een
   kleine affiche en het signaal-doorgeefluik. Kijken is rechtstreeks (P2P,
   versleuteld datakanaal), precies zoals het Thuisarchief van het Theater.

   Bewust ZONDER verslavingsmechaniek (huisregel): de feed is een eindige
   dagselectie, chronologisch met gevolgde makers eerst, met een expliciet
   einde. Geen oneindige scroll, geen algoritmische lokkertjes.

   maakClips(state) volgt het vaste kern-patroon. */

const CLIP_MAX_S = 60;               // een clip is kort
const POSTER_MAX = 80000;            // kleine affiche (data-URI)
const AANWEZIG_TTL_MS = 90 * 1000;   // zo lang is een maker "online"
const SIGNALEN = ['vraag', 'offer', 'answer', 'ice', 'klaar', 'stop'];
const DAGSELECTIE = 25;              // de eindige dagselectie
const CLIPS_PER_MAKER = 100;
const REACTIES_MAX = 200;

function maakClips({ db, save, crypto, schoon, codenaamVan, sseToCustomer, sseToOffice }) {
  const id = () => 'c' + crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  const aanwezigheid = new Map();     // clipId -> ts van de laatste hartslag

  function lijsten() {
    if (!Array.isArray(db.data.clips)) db.data.clips = [];
    if (!db.data.clipsVolg || typeof db.data.clipsVolg !== 'object') db.data.clipsVolg = {};
    if (!db.data.clipsReacties || typeof db.data.clipsReacties !== 'object') db.data.clipsReacties = {};
    if (!Array.isArray(db.data.clipsMeldingen)) db.data.clipsMeldingen = [];
  }
  const clipMet = cid => db.data.clips.find(c => c.id === String(cid || '')) || null;
  const online = c => Date.now() - (aanwezigheid.get(c.id) || 0) < AANWEZIG_TTL_MS;

  /* ---- maken en weghalen: alleen metadata, het beeld blijft thuis ---- */
  function maak(key, data) {
    lijsten();
    const titel = schoon(data.titel, 80);
    if (!titel) return { status: 400, error: 'Geef de clip een titel.' };
    const duurS = Math.round(Number(data.duurS));
    if (!Number.isFinite(duurS) || duurS < 1 || duurS > CLIP_MAX_S)
      return { status: 400, error: 'Een clip duurt 1 tot ' + CLIP_MAX_S + ' seconden.' };
    const poster = typeof data.poster === 'string' && data.poster.startsWith('data:image/') && data.poster.length <= POSTER_MAX
      ? data.poster : null;
    if (db.data.clips.filter(c => c.key === key).length >= CLIPS_PER_MAKER)
      return { status: 409, error: 'U heeft het maximum van ' + CLIPS_PER_MAKER + ' clips; haal er eerst een weg.' };
    const c = { id: id(), key, titel, duurS, poster,
      mbGeschat: Math.min(200, Math.max(1, Math.round(Number(data.mbGeschat) || 1))), at: nu() };
    db.data.clips.push(c);
    save();
    aanwezigheid.set(c.id, Date.now());
    return { status: 200, ok: true, id: c.id };
  }
  function weg(key, cid) {
    lijsten();
    const c = clipMet(cid);
    if (!c || c.key !== key) return { status: 404, error: 'Clip niet gevonden.' };
    db.data.clips = db.data.clips.filter(x => x.id !== c.id);
    delete db.data.clipsReacties[c.id];
    aanwezigheid.delete(c.id);
    save();
    return { status: 200, ok: true };
  }

  /* ---- aanwezigheid en het signaal-doorgeefluik (P2P, buiten RTG om) ---- */
  function aanwezig(key, ids) {
    lijsten();
    const geaccepteerd = [];
    for (const cid of (Array.isArray(ids) ? ids.slice(0, CLIPS_PER_MAKER) : [])) {
      const c = clipMet(cid);
      if (c && c.key === key) { aanwezigheid.set(c.id, Date.now()); geaccepteerd.push(c.id); }
    }
    return { status: 200, ok: true, geaccepteerd, ttlS: AANWEZIG_TTL_MS / 1000 };
  }
  function signaal(key, cid, kind, doelKey, payload) {
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    if (!SIGNALEN.includes(kind)) return { status: 400, error: 'Onbekend signaal.' };
    const ikMaker = c.key === key;
    if (ikMaker && !doelKey) return { status: 400, error: 'De maker antwoordt gericht aan een kijker.' };
    if (!ikMaker && !online(c)) return { status: 409, error: 'De maker is nu niet online; deze clip staat alleen op diens eigen toestel.' };
    sseToCustomer(ikMaker ? String(doelKey) : c.key, 'clips', { kind, clipId: c.id, van: key, payload: payload || null });
    return { status: 200, ok: true };
  }

  /* ---- de feed: een eindige dagselectie met een expliciet einde ---- */
  function beeld(c, key) {
    return { id: c.id, titel: c.titel, duurS: c.duurS, poster: c.poster, mb: c.mbGeschat,
      codenaam: codenaamVan(c.key), online: online(c), mijn: c.key === key,
      volgIk: (db.data.clipsVolg[key] || []).includes(c.key),
      reacties: (db.data.clipsReacties[c.id] || []).length, at: c.at };
  }
  function feed(key) {
    lijsten();
    const volgSet = new Set(db.data.clipsVolg[key] || []);
    const rijen = [...db.data.clips].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const eerst = rijen.filter(c => volgSet.has(c.key) && c.key !== key);
    const rest = rijen.filter(c => !volgSet.has(c.key) && c.key !== key);
    const selectie = [...eerst, ...rest].slice(0, DAGSELECTIE);
    return { status: 200, clips: selectie.map(c => beeld(c, key)),
      mijn: rijen.filter(c => c.key === key).map(c => beeld(c, key)),
      einde: 'Dat was het voor nu.', maxS: CLIP_MAX_S };
  }
  function volg(key, cid, aan) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    if (c.key === key) return { status: 400, error: 'Uzelf volgen hoeft niet.' };
    const rij = (db.data.clipsVolg[key] = db.data.clipsVolg[key] || []).filter(k => k !== c.key);
    if (aan !== false) rij.push(c.key);
    db.data.clipsVolg[key] = rij.slice(-500);
    save();
    return { status: 200, ok: true, volg: aan !== false };
  }

  /* ---- reacties en melden (op codenaam, begrensd) ---- */
  function reactie(key, cid, tekst) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    tekst = schoon(tekst, 300); if (!tekst) return { status: 400, error: 'Lege reactie.' };
    const rij = db.data.clipsReacties[c.id] = db.data.clipsReacties[c.id] || [];
    const r = { codenaam: codenaamVan(key), tekst, at: nu() };
    rij.push(r); if (rij.length > REACTIES_MAX) db.data.clipsReacties[c.id] = rij.slice(-REACTIES_MAX);
    save();
    return { status: 200, ok: true, reactie: r };
  }
  const reacties = cid => ({ status: 200, reacties: (db.data.clipsReacties[String(cid || '')] || []).slice(-40) });
  function meld(key, cid, reden) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    db.data.clipsMeldingen.push({ id: id(), clipId: c.id, titel: c.titel, maker: codenaamVan(c.key),
      van: codenaamVan(key), reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    db.data.clipsMeldingen = db.data.clipsMeldingen.slice(-200);
    save(); sseToOffice('sync', { scope: 'clips' });
    return { status: 200, ok: true };
  }
  function officeLijst() {
    lijsten();
    return { status: 200, meldingen: db.data.clipsMeldingen.slice(-50).reverse(),
      totaal: db.data.clips.length };
  }
  // kantoor haalt de kaart weg; het beeld zelf stond nooit bij RTG
  function officeVerwijder(cid) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    db.data.clips = db.data.clips.filter(x => x.id !== c.id);
    delete db.data.clipsReacties[c.id];
    db.data.clipsMeldingen = db.data.clipsMeldingen.filter(m => m.clipId !== c.id);
    aanwezigheid.delete(c.id);
    save();
    return { status: 200, ok: true };
  }

  return { clipsMaak: maak, clipsWeg: weg, clipsAanwezig: aanwezig, clipsSignaal: signaal,
    clipsFeed: feed, clipsVolg: volg, clipsReactie: reactie, clipsReacties: reacties,
    clipsMeld: meld, clipsOfficeLijst: officeLijst, clipsOfficeVerwijder: officeVerwijder };
}

module.exports = { maakClips };
