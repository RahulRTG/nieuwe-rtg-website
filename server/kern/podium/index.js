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
   rechtstreeks met de buitenwereld, en is los te testen. Dit is de
   orkestrator: de poort, de state-helpers en de beelden wonen hier; de
   levensloop van een kanaal in ./kanaal, de zaal (chat/cadeau/abonnement/
   veiligheid) in ./interactie. */

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

  /* RTG Pay is zelf al idempotent, maar de bijwerking hier (verdiend-teller,
     chatregel, abonnee-verlenging) mag bij een dubbeltik ook niet dubbel. */
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

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, schoon, id, nu, mag, lijsten, kanaalMet, kanaalVan, isAbonnee, verseKijkers,
    stuurRond, kijkBeeld, eigenBeeld, metIdem, codenaamVan, sseToCustomer, sseToOffice, notify, pay,
    GENRES, CADEAUS, CHAT_MAX, ABB_DAGEN, SIGNALEN
  };
  return Object.assign({}, require('./kanaal')(ctx), require('./interactie')(ctx));
}

module.exports = { maakPodium };
