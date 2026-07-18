/* Kern-module "podium": RTG Podium, het eigen live-kanaal van De Salon.
   Leden met een goedgekeurd kanaal zenden live video uit (WebRTC, de server is
   alleen doorgeefluik voor de signalering), kijkers praten mee in de
   kanaalchat, sturen cadeautjes via RTG Pay en nemen een maandabonnement.

   Spelregels, bewust streng:
   - Strikt 18+: makers EN kijkers hebben een actief RTG-geverifieerd paspoort
     en zijn minstens 18 (zelfde poort als Salon-ontmoetingen).
   - Een kanaal gaat pas open na menselijke goedkeuring door RTG-kantoor; het
     systeem of de AI keurt nooit zelf goed (zelfde regel als de passen).
   - Alles draait op codenamen; echte namen blijven in de kluis.
   - Melden en blokkeren zitten ingebouwd; een blokkade gooit de kijker er
     direct uit. Cadeaubedragen zijn vaste, bescheiden stappen (geen vrij veld,
     dus geen opjaagmechaniek).

   maakPodium(state) volgt het vaste kern-patroon: draagt state, praat niet
   rechtstreeks met de buitenwereld, en is los te testen. */

const MIN_LEEFTIJD = 18;
const CADEAUS = [
  { id: 'roos',     naam: 'Roos',     icoon: '\u{1F339}', centen: 500 },
  { id: 'toost',    naam: 'Toost',    icoon: '\u{1F942}', centen: 1500 },
  { id: 'kroon',    naam: 'Kroon',    icoon: '\u{1F451}', centen: 5000 },
  { id: 'vuurwerk', naam: 'Vuurwerk', icoon: '\u{1F386}', centen: 10000 }
];
const GENRES = ['salon', 'muziek', 'koken', 'reizen', 'lifestyle', 'nachtleven'];
const KIJKER_TTL_MS = 90 * 1000;   // wie zich 90s niet meldt is weg
const CHAT_MAX = 200;
const ABB_DAGEN = 30;
const SIGNALEN = ['offer', 'answer', 'ice', 'stop'];

function maakPodium({ db, save, crypto, accounts, leeftijdVan, codenaamVan, sseToCustomer, sseToOffice, notify, pay, schoon }) {
  const id = () => 'pk' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!Array.isArray(db.data.podiumKanalen)) db.data.podiumKanalen = [];
    if (!db.data.podiumChat) db.data.podiumChat = {};
    if (!Array.isArray(db.data.podiumMeldingen)) db.data.podiumMeldingen = [];
  }

  /* ---- de poort: 18+ met actief RTG-geverifieerd paspoort ---- */
  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }
  function mag(key) {
    const u = accountVanKey(key);
    if (!u) return { ok: false, reden: 'Alleen voor RTG-leden met een eigen account.' };
    if (u.verified !== 'verified') return { ok: false, reden: 'Activeer eerst uw RTG-geverifieerde paspoort.' };
    let md = {}; try { md = accounts.getMemberState(u.id) || {}; } catch (e) {}
    const lft = md.geboren ? leeftijdVan(md.geboren) : null;
    if (lft == null || lft < MIN_LEEFTIJD) return { ok: false, reden: 'Het Podium is vanaf ' + MIN_LEEFTIJD + ' jaar.' };
    return { ok: true };
  }

  const kanaalMet = kid => { lijsten(); return db.data.podiumKanalen.find(k => k.id === kid) || null; };
  const kanaalVan = key => { lijsten(); return db.data.podiumKanalen.find(k => k.key === key) || null; };
  function isAbonnee(k, key) { const tot = (k.abonnees || {})[key]; return !!tot && new Date(tot).getTime() > Date.now(); }
  function verseKijkers(k) {
    const grens = Date.now() - KIJKER_TTL_MS;
    for (const key of Object.keys(k.kijkers || {}))
      if (new Date(k.kijkers[key]).getTime() < grens) delete k.kijkers[key];
    return Object.keys(k.kijkers || {});
  }
  // een podium-signaal naar de maker en alle verse kijkers
  function stuurRond(k, data) {
    sseToCustomer(k.key, 'podium', data);
    for (const key of verseKijkers(k)) sseToCustomer(key, 'podium', data);
  }

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
      k.live = null; k.kijkers = {};
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
    k.kijkers[key] = nu(); save();
    if (nieuw) sseToCustomer(k.key, 'podium', { kind: 'kijker', kanaalId: k.id, van: key, codenaam: codenaamVan(key) });
    return { status: 200, ok: true, kanaal: kijkBeeld(k, key), chat: (db.data.podiumChat[k.id] || []).slice(-40) };
  }
  function weg(key, kid) {
    const k = kanaalMet(kid); if (!k) return { status: 200, ok: true };
    if ((k.kijkers || {})[key]) { delete k.kijkers[key]; save(); sseToCustomer(k.key, 'podium', { kind: 'weg', kanaalId: k.id, van: key }); }
    return { status: 200, ok: true };
  }
  // pure doorgeefluik voor WebRTC: maker <-> kijker, nooit iemand anders
  function signaal(key, kid, doelKey, kind, payload) {
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    if (!SIGNALEN.includes(kind)) return { status: 400, error: 'Onbekend signaal.' };
    const ikMaker = k.key === key;
    const doel = ikMaker ? String(doelKey || '') : k.key;
    if (ikMaker ? !(k.kijkers || {})[doel] : !(k.kijkers || {})[key]) return { status: 403, error: 'Geen kijker op dit kanaal.' };
    sseToCustomer(doel, 'podium', { kind, kanaalId: k.id, van: key, payload: payload || null });
    return { status: 200, ok: true };
  }

  /* ---- de kanaalchat, cadeautjes en het abonnement ---- */
  // RTG Pay is zelf al idempotent, maar de bijwerking hier (verdiend-teller,
  // chatregel, abonnee-verlenging) mag bij een dubbeltik ook niet dubbel.
  function metIdem(k, sleutel, doe) {
    if (!sleutel) return doe();
    k.idems = k.idems || {};
    if (k.idems[sleutel]) return Promise.resolve(k.idems[sleutel]);
    return Promise.resolve(doe()).then(uit => {
      if (uit && uit.ok) {
        const sleutels = Object.keys(k.idems);
        if (sleutels.length > 300) for (const s of sleutels.slice(0, 100)) delete k.idems[s];
        k.idems[sleutel] = uit; save();
      }
      return uit;
    });
  }
  function chat(key, kid, tekst) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    const k = kanaalMet(kid); if (!k || !k.live) return { status: 409, error: 'Dit kanaal is nu niet live.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    if (k.key !== key && !(k.kijkers || {})[key]) return { status: 403, error: 'Kijk eerst mee met dit kanaal.' };
    tekst = schoon(tekst, 300); if (!tekst) return { status: 400, error: 'Leeg bericht.' };
    const regel = { van: key, codenaam: codenaamVan(key), tekst, abonnee: isAbonnee(k, key), maker: k.key === key, at: nu() };
    const lijst = db.data.podiumChat[k.id] = db.data.podiumChat[k.id] || [];
    lijst.push(regel); if (lijst.length > CHAT_MAX) db.data.podiumChat[k.id] = lijst.slice(-CHAT_MAX);
    save(); stuurRond(k, { kind: 'chat', kanaalId: k.id, regel });
    return { status: 200, ok: true, regel };
  }
  async function cadeau(key, kid, cadeauId, idem) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    if (k.key === key) return { status: 400, error: 'Uzelf een cadeau geven kan niet.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    const c = CADEAUS.find(x => x.id === cadeauId); if (!c) return { status: 400, error: 'Onbekend cadeau.' };
    return metIdem(k, idem ? 'c:' + key + ':' + idem : null, async () => {
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(k.key), centen: c.centen,
        oms: 'Podium · ' + c.naam + ' voor ' + k.naam, idem: idem ? 'podium:' + idem : undefined, soort: 'podium' });
      if (r.error) return { status: r.status || 400, error: r.error };
      k.verdiend = Math.round((k.verdiend || 0) + c.centen);
      const regel = { van: key, codenaam: codenaamVan(key), cadeau: { id: c.id, naam: c.naam, icoon: c.icoon, centen: c.centen }, abonnee: isAbonnee(k, key), at: nu() };
      const lijst = db.data.podiumChat[k.id] = db.data.podiumChat[k.id] || [];
      lijst.push(regel); if (lijst.length > CHAT_MAX) db.data.podiumChat[k.id] = lijst.slice(-CHAT_MAX);
      save(); stuurRond(k, { kind: 'cadeau', kanaalId: k.id, regel });
      return { status: 200, ok: true, regel, saldo: r.saldo };
    });
  }
  async function abonneer(key, kid, idem) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    if (k.key === key) return { status: 400, error: 'Dit is uw eigen kanaal.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    if (!(k.abbCenten > 0)) return { status: 409, error: 'Dit kanaal heeft geen abonnement.' };
    return metIdem(k, idem ? 'a:' + key + ':' + idem : null, async () => {
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(k.key), centen: k.abbCenten,
        oms: 'Podium · abonnement ' + k.naam, idem: idem ? 'podiumabb:' + idem : undefined, soort: 'podium' });
      if (r.error) return { status: r.status || 400, error: r.error };
      const basis = isAbonnee(k, key) ? new Date(k.abonnees[key]).getTime() : Date.now();
      k.abonnees[key] = new Date(basis + ABB_DAGEN * 24 * 3600 * 1000).toISOString();
      k.verdiend = Math.round((k.verdiend || 0) + k.abbCenten);
      save(); sseToCustomer(k.key, 'podium', { kind: 'abonnee', kanaalId: k.id, codenaam: codenaamVan(key) });
      return { status: 200, ok: true, tot: k.abonnees[key], saldo: r.saldo };
    });
  }

  /* ---- veiligheid in de zaal: blokkeren en melden ---- */
  function blokkeer(key, kid, doelKey, aan) {
    const k = kanaalMet(kid); if (!k || k.key !== key) return { status: 403, error: 'Alleen de maker beheert het kanaal.' };
    doelKey = String(doelKey || ''); if (!doelKey || doelKey === key) return { status: 400, error: 'Kies een kijker.' };
    k.geblokkeerd = (k.geblokkeerd || []).filter(x => x !== doelKey);
    if (aan !== false) { k.geblokkeerd.push(doelKey); delete (k.kijkers || {})[doelKey]; sseToCustomer(doelKey, 'podium', { kind: 'einde', kanaalId: k.id }); }
    save(); return { status: 200, ok: true, geblokkeerd: k.geblokkeerd.length };
  }
  function meld(key, kid, reden) {
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    lijsten();
    db.data.podiumMeldingen.push({ id: id(), kanaalId: k.id, kanaal: k.naam, van: codenaamVan(key), reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    db.data.podiumMeldingen = db.data.podiumMeldingen.slice(-200);
    save(); sseToOffice('sync', { scope: 'podium' });
    return { status: 200, ok: true };
  }

  /* ---- de beelden: wat kijker, maker en kantoor zien ---- */
  function kijkBeeld(k, key) {
    return { id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, codenaam: codenaamVan(k.key), makerKey: k.key,
      live: k.live ? { sinds: k.live.sinds, titel: k.live.titel, alleenAbonnees: !!k.live.alleenAbonnees } : null,
      kijkers: verseKijkers(k).length, abbCenten: k.abbCenten || 0,
      ikAbonnee: key ? isAbonnee(k, key) : false, abonneeTot: key && isAbonnee(k, key) ? k.abonnees[key] : null };
  }
  function eigenBeeld(k) {
    const b = kijkBeeld(k, null);
    return { ...b, status: k.status, verdiend: k.verdiend || 0,
      abonnees: Object.keys(k.abonnees || {}).filter(x => isAbonnee(k, x)).length,
      kijkerLijst: verseKijkers(k).map(x => ({ key: x, codenaam: codenaamVan(x) })),
      geblokkeerd: (k.geblokkeerd || []).map(x => ({ key: x, codenaam: codenaamVan(x) })) };
  }
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
    PODIUM_CADEAUS: CADEAUS, PODIUM_GENRES: GENRES,
    podiumMag: mag, podiumKanaalMaak: kanaalMaak, podiumKanaalZet: kanaalZet,
    podiumKanalen: kanalen, podiumMijn: mijnPodium, podiumLiveZet: liveZet,
    podiumKijk: kijk, podiumWeg: weg, podiumSignaal: signaal, podiumChatStuur: chat,
    podiumCadeau: cadeau, podiumAbonneer: abonneer, podiumBlokkeer: blokkeer,
    podiumMeld: meld, podiumOfficeLijst: officeLijst, podiumOfficeBeslis: officeBeslis
  };
}

module.exports = { maakPodium };
