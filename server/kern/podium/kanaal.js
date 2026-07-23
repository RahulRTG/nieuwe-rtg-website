/* RTG Podium, deelbestand "kanaal": de levensloop van een kanaal. Aanmelden (pas
   open na een mens van RTG-kantoor), instellen, de kantoor-wachtrij en het besluit,
   live gaan en stoppen, meekijken en weggaan, het WebRTC-doorgeefluik voor de
   signalering, en de lijsten die kijker en maker zien. Krijgt de gedeelde ctx van
   kern/podium/index.js. */
module.exports = (ctx) => {
  const { db, save, schoon, id, nu, mag, lijsten, kanaalMet, kanaalVan, isAbonnee, verseKijkers,
    stuurRond, kijkBeeld, eigenBeeld, codenaamVan, sseToCustomer, sseToOffice, notify,
    koppel, herstelBoom, ouderKeyVan, GENRES, CADEAUS, SIGNALEN } = ctx;

  /* ---- het kanaal: aanmelden, en pas open na een mens van kantoor ---- */
  function kanaalMaak(key, data) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    lijsten();
    if (kanaalVan(key)) return { status: 409, error: 'U heeft al een kanaal.' };
    const naam = schoon(data.naam, 40); if (!naam) return { status: 400, error: 'Geef het kanaal een naam.' };
    const k = { id: id(), key, naam, genre: GENRES.includes(data.genre) ? data.genre : 'salon',
      bio: schoon(data.bio, 300), status: 'wacht', abbCenten: 0, verdiend: 0,
      live: null, kijkers: {}, abonnees: {}, geblokkeerd: [], at: nu() };
    db.data.podiumKanalen.push(k); save();
    sseToOffice('sync', { scope: 'podium' });
    return { status: 200, ok: true, kanaal: eigenBeeld(k) };
  }
  function kanaalZet(key, data) {
    const k = kanaalVan(key); if (!k) return { status: 404, error: 'U heeft nog geen kanaal.' };
    if (data.naam != null) { const n = schoon(data.naam, 40); if (n) k.naam = n; }
    if (data.bio != null) k.bio = schoon(data.bio, 300);
    if (data.genre != null && GENRES.includes(data.genre)) k.genre = data.genre;
    if (data.abbCenten != null) { const c = Math.round(Number(data.abbCenten)); k.abbCenten = Number.isFinite(c) ? Math.min(Math.max(c, 0), 50000) : 0; }
    save(); return { status: 200, ok: true, kanaal: eigenBeeld(k) };
  }
  function officeLijst() {
    lijsten();
    return { wacht: db.data.podiumKanalen.filter(k => k.status === 'wacht').map(k => ({ id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, codenaam: codenaamVan(k.key), at: k.at })),
      meldingen: db.data.podiumMeldingen.slice(-50).reverse() };
  }
  function officeBeslis(kid, besluit) {
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    if (!['goedgekeurd', 'geweigerd'].includes(besluit)) return { status: 400, error: 'Besluit is goedgekeurd of geweigerd.' };
    k.status = besluit; k.beslistAt = nu(); save();
    notify(k.key, { title: 'RTG Podium', body: besluit === 'goedgekeurd' ? 'Uw kanaal "' + k.naam + '" is goedgekeurd. U kunt live.' : 'Uw kanaal "' + k.naam + '" is niet goedgekeurd.', scope: 'podium' });
    return { status: 200, ok: true };
  }

  /* ---- live gaan en kijken ---- */
  function liveZet(key, aan, data) {
    const k = kanaalVan(key); if (!k) return { status: 404, error: 'U heeft nog geen kanaal.' };
    if (aan) {
      const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
      if (k.status !== 'goedgekeurd') return { status: 403, error: 'Uw kanaal wacht nog op goedkeuring door RTG-kantoor.' };
      k.live = { sinds: nu(), titel: schoon(data && data.titel, 80) || k.naam, alleenAbonnees: !!(data && data.alleenAbonnees) };
    } else {
      if (k.live) stuurRond(k, { kind: 'einde', kanaalId: k.id });
      k.live = null; k.kijkers = {}; k.boom = {};
    }
    save(); sseToOffice('sync', { scope: 'podium' });
    return { status: 200, ok: true, kanaal: eigenBeeld(k) };
  }
  function kijk(key, kid) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    if (k.key === key) return { status: 400, error: 'Dit is uw eigen kanaal.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    if (!k.live) return { status: 409, error: 'Dit kanaal is nu niet live.' };
    if (k.live.alleenAbonnees && !isAbonnee(k, key)) return { status: 403, error: 'Deze uitzending is alleen voor abonnees.' };
    const nieuw = !(k.kijkers || {})[key];
    k.kijkers[key] = nu();
    k.boom = k.boom || {};
    herstelBoom(k);                                  // wezen van vertrokken kijkers eerst herstellen
    if (nieuw || !k.boom[key]) koppel(k, key);       // hang deze kijker in de boom en laat zijn ouder aanbieden
    save();
    return { status: 200, ok: true, kanaal: kijkBeeld(k, key), chat: (db.data.podiumChat[k.id] || []).slice(-40), ouder: k.boom[key].ouder };
  }
  function weg(key, kid) {
    const k = kanaalMet(kid); if (!k) return { status: 200, ok: true };
    if ((k.kijkers || {})[key]) {
      delete k.kijkers[key];
      const ouder = ouderKeyVan(k, key);
      if (k.boom) delete k.boom[key];
      herstelBoom(k);                                // eventuele kinderen van de vertrokkene opnieuw koppelen
      save();
      sseToCustomer(ouder, 'podium', { kind: 'weg', kanaalId: k.id, van: key });   // de ouder ruimt zijn verbinding op
    }
    return { status: 200, ok: true };
  }
  /* Pure doorgeefluik voor WebRTC, nu langs de boom: een knoop mag alleen praten
     met zijn eigen ouder of een van zijn kinderen - nooit met een vreemde. Zonder
     doelKey gaat het naar de ouder (de kijker antwoordt zijn aanbieder). */
  function signaal(key, kid, doelKey, kind, payload) {
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    if (!SIGNALEN.includes(kind)) return { status: 400, error: 'Onbekend signaal.' };
    k.boom = k.boom || {};
    let doel;
    if (k.key === key) {                             // de bron: alleen naar een direct kind
      doel = String(doelKey || '');
      if (!(k.boom[doel] && k.boom[doel].ouder === 'bron')) return { status: 403, error: 'Geen kijker op dit kanaal.' };
    } else {
      if (!k.boom[key] && !(k.kijkers || {})[key]) return { status: 403, error: 'Geen kijker op dit kanaal.' };
      const mijnOuder = ouderKeyVan(k, key);
      doel = doelKey ? String(doelKey) : mijnOuder;
      const naarOuder = doel === mijnOuder;
      const naarKind = k.boom[doel] && k.boom[doel].ouder === key;
      if (!naarOuder && !naarKind) return { status: 403, error: 'Alleen naar je eigen ouder of kind.' };
    }
    sseToCustomer(doel, 'podium', { kind, kanaalId: k.id, van: key, payload: payload || null });
    return { status: 200, ok: true };
  }

  /* ---- de lijsten: wat kijker en maker zien ---- */
  function kanalen(key) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden, mag: false };
    lijsten();
    const rijen = db.data.podiumKanalen.filter(k => k.status === 'goedgekeurd').map(k => kijkBeeld(k, key))
      .sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.kijkers - a.kijkers);
    const eigen = kanaalVan(key);
    return { status: 200, mag: true, cadeaus: CADEAUS, genres: GENRES, kanalen: rijen, mijn: eigen ? eigenBeeld(eigen) : null };
  }
  function mijnPodium(key) {
    const k = kanaalVan(key);
    return { status: 200, mag: mag(key).ok, kanaal: k ? eigenBeeld(k) : null, chat: k ? (db.data.podiumChat[k.id] || []).slice(-40) : [] };
  }

  return {
    podiumKanaalMaak: kanaalMaak, podiumKanaalZet: kanaalZet,
    podiumKanalen: kanalen, podiumMijn: mijnPodium, podiumLiveZet: liveZet,
    podiumKijk: kijk, podiumWeg: weg, podiumSignaal: signaal,
    podiumOfficeLijst: officeLijst, podiumOfficeBeslis: officeBeslis
  };
};
