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

function maakClips({ db, save, crypto, schoon, codenaamVan, sseToCustomer, sseToOffice, eigenTrack, nieuwWerk }) {
  const id = () => 'c' + crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  const aanwezigheid = new Map();     // clipId -> ts van de laatste hartslag

  const eigen = require('./eigencollectie')({ db, domein: 'kern/clips',
    bezit: { clips: 'lijst', clipsVolg: 'kaart', clipsReacties: 'kaart', clipsMeldingen: 'lijst' } });
  function lijsten() {
    eigen.bak('clips'); eigen.bak('clipsVolg'); eigen.bak('clipsReacties'); eigen.bak('clipsMeldingen');
  }
  const clipMet = cid => eigen.bak('clips').find(c => c.id === String(cid || '')) || null;
  const online = c => Date.now() - (aanwezigheid.get(c.id) || 0) < AANWEZIG_TTL_MS;
  // de studio: knippen, geluid en ondertitels (kern/clips-studio.js)
  const studio = require('./clips-studio')({ db, save, schoon, clipMet, eigenTrack });

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
    if (eigen.bak('clips').filter(c => c.key === key).length >= CLIPS_PER_MAKER)
      return { status: 409, error: 'U heeft het maximum van ' + CLIPS_PER_MAKER + ' clips; haal er eerst een weg.' };
    const c = { id: id(), key, titel, duurS, poster,
      mbGeschat: Math.min(200, Math.max(1, Math.round(Number(data.mbGeschat) || 1))), at: nu() };
    eigen.bak('clips').push(c);
    save();
    aanwezigheid.set(c.id, Date.now());
    if (nieuwWerk) { try { nieuwWerk(key, 'flow', c.titel); } catch (e) {} }
    return { status: 200, ok: true, id: c.id };
  }
  function weg(key, cid) {
    lijsten();
    const c = clipMet(cid);
    if (!c || c.key !== key) return { status: 404, error: 'Clip niet gevonden.' };
    eigen.zetBak('clips', eigen.bak('clips').filter(x => x.id !== c.id));
    delete eigen.bak('clipsReacties')[c.id];
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
    lijsten();
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
    return Object.assign({ id: c.id, titel: c.titel, duurS: c.duurS, poster: c.poster, mb: c.mbGeschat,
      codenaam: codenaamVan(c.key), online: online(c), mijn: c.key === key,
      volgIk: (eigen.bak('clipsVolg')[key] || []).includes(c.key),
      reacties: (eigen.bak('clipsReacties')[c.id] || []).length, at: c.at },
      studio.clipsStudioBeeld(c));
  }
  /* De dagselectie blijft eindig en chronologisch. `alleenOndertiteld` is de
     enige beperking die de kijker zelf kan zetten: geen smaakfilter maar een
     toegangsfilter, voor wie geluid niet kan of niet wil gebruiken. Hij staat
     uit tenzij de kijker hem aanzet -- wij kiezen dat niet voor hem. */
  function feed(key, opties) {
    lijsten();
    const o = opties || {};
    const volgSet = new Set(eigen.bak('clipsVolg')[key] || []);
    let rijen = [...eigen.bak('clips')].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const mijne = rijen.filter(c => c.key === key);
    if (o.alleenOndertiteld) rijen = rijen.filter(c => (c.ondertitels || []).length > 0);
    const eerst = rijen.filter(c => volgSet.has(c.key) && c.key !== key);
    const rest = rijen.filter(c => !volgSet.has(c.key) && c.key !== key);
    const selectie = [...eerst, ...rest].slice(0, DAGSELECTIE);
    return { status: 200, clips: selectie.map(c => beeld(c, key)),
      mijn: mijne.map(c => beeld(c, key)),
      alleenOndertiteld: !!o.alleenOndertiteld,
      einde: 'Dat was het voor nu.', maxS: CLIP_MAX_S };
  }
  /* Volgen gaat over een MAKER, niet over een clip -- de feed zet de maker in
     de volgerslijst, niet het stukje video. Daarom staat de handeling hier als
     volgMaker, en is volg(clip) er de tweede ingang van: de Media OS
     (kern/mediaos/) volgt dezelfde maker vanuit een muziekuitgave of een
     video, waar helemaal geen clip-id bij de hand is. Eén handeling, twee
     deuren -- geen tweede lijst (LAT.md regel 4). */
  function volgMaker(key, makerKey, aan) {
    lijsten();
    if (!makerKey) return { status: 404, error: 'Maker niet gevonden.' };
    if (makerKey === key) return { status: 400, error: 'Uzelf volgen hoeft niet.' };
    const volgBak = eigen.bak('clipsVolg');
    const rij = (volgBak[key] = volgBak[key] || []).filter(k => k !== makerKey);
    if (aan !== false) rij.push(makerKey);
    volgBak[key] = rij.slice(-500);
    save();
    return { status: 200, ok: true, volg: aan !== false };
  }
  function volg(key, cid, aan) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    return volgMaker(key, c.key, aan);
  }

  /* De lezers voor de Media OS (alles van één maker, welke clips een bepaald
     eigen muziekstuk als geluid dragen, hoeveel volgers een maker heeft)
     staan in ./clips-lezers.js -- een eigen onderwerp, en dit bestand blijft
     er onder de omvangregel van de keuring mee. */
  const lezers = require('./clips-lezers')({ db, lijsten, beeld });

  /* ---- reacties en melden (op codenaam, begrensd) ---- */
  function reactie(key, cid, tekst) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    tekst = schoon(tekst, 300); if (!tekst) return { status: 400, error: 'Lege reactie.' };
    const reactieBak = eigen.bak('clipsReacties');
    const rij = reactieBak[c.id] = reactieBak[c.id] || [];
    const r = { codenaam: codenaamVan(key), tekst, at: nu() };
    rij.push(r); if (rij.length > REACTIES_MAX) reactieBak[c.id] = rij.slice(-REACTIES_MAX);
    save();
    return { status: 200, ok: true, reactie: r };
  }
  const reacties = cid => { lijsten(); return { status: 200, reacties: (eigen.bak('clipsReacties')[String(cid || '')] || []).slice(-40) }; };
  function meld(key, cid, reden) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    eigen.bak('clipsMeldingen').push({ id: id(), clipId: c.id, titel: c.titel, maker: codenaamVan(c.key),
      van: codenaamVan(key), reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    eigen.zetBak('clipsMeldingen', eigen.bak('clipsMeldingen').slice(-200));
    save(); sseToOffice('sync', { scope: 'clips' });
    return { status: 200, ok: true };
  }
  function officeLijst() {
    lijsten();
    return { status: 200, meldingen: eigen.bak('clipsMeldingen').slice(-50).reverse(),
      totaal: eigen.bak('clips').length };
  }
  // kantoor haalt de kaart weg; het beeld zelf stond nooit bij RTG
  function officeVerwijder(cid) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    eigen.zetBak('clips', eigen.bak('clips').filter(x => x.id !== c.id));
    delete eigen.bak('clipsReacties')[c.id];
    eigen.zetBak('clipsMeldingen', eigen.bak('clipsMeldingen').filter(m => m.clipId !== c.id));
    aanwezigheid.delete(c.id);
    save();
    return { status: 200, ok: true };
  }

  return Object.assign(studio, { clipsMaak: maak, clipsWeg: weg, clipsAanwezig: aanwezig, clipsSignaal: signaal,
    clipsFeed: feed, clipsVolg: volg, clipsVolgMaker: volgMaker,
    clipsVan: lezers.clipsVan, clipsMetTrack: lezers.clipsMetTrack,
    clipsVolgersVan: lezers.clipsVolgersVan,
    clipsReactie: reactie, clipsReacties: reacties,
    clipsMeld: meld, clipsOfficeLijst: officeLijst, clipsOfficeVerwijder: officeVerwijder });
}

module.exports = { maakClips };
