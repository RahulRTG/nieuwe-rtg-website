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

   maakVonk(state) volgt het vaste kern-patroon. Dit is de orkestrator: de
   poort, het profiel/de wensen en de dagselectie wonen hier; de like/match,
   het betalen, de chat en het blokkeren/melden in ./match. */

const MIN_LEEFTIJD = 18;
const DAG_MAX = 6;            // de eindige dagselectie
const PRIJS_CENTEN = 1000;    // EUR 10 p.p.
const RTG_CENTEN = 500;       // waarvan EUR 5 voor RTG; de rest is aanbetaling bij de zaak

function maakVonk({ db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan, keyVanCodenaam,
  haversine, reserveerTafel, pay, notify, sseToCustomer, sseToOffice }) {
  const id = () => 'vonk' + crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  function d() {
    if (!db.data.vonk || typeof db.data.vonk !== 'object')
      db.data.vonk = { profielen: {}, likes: [], matches: [], meldingen: [] };
    return db.data.vonk;
  }

  /* ---- de poort: 18+ met actief geverifieerd paspoort (zelfde lat als Podium) ---- */
  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }
  function mag(key) {
    const u = accountVanKey(key);
    if (!u) return { ok: false, reden: 'Alleen voor RTG-leden met een eigen account.' };
    if (u.verified !== 'verified') return { ok: false, reden: 'Activeer eerst uw RTG-geverifieerde paspoort (KYC); zo weet iedereen op Vonk dat de ander echt is.' };
    let md = {}; try { md = accounts.getMemberState(u.id) || {}; } catch (e) {}
    const lft = md.geboren ? leeftijdVan(md.geboren) : null;
    if (lft == null || lft < MIN_LEEFTIJD) return { ok: false, reden: 'Vonk is vanaf ' + MIN_LEEFTIJD + ' jaar.' };
    return { ok: true, leeftijd: lft };
  }

  /* ---- profiel en wensen (alles op codenaam; alleen de stad is zichtbaar) ---- */
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
    if (isFinite(data.lat) && isFinite(data.lng)) { p.lat = Number(data.lat); p.lng = Number(data.lng); }
    p.blokkade = p.blokkade || [];
    p.actief = data.actief === false ? false : true;
    p.leeftijd = poort.leeftijd;
    d().profielen[key] = p;
    save();
    return { status: 200, ok: true, profiel: publiek(key, p, true) };
  }
  const publiek = (key, p, zelf) => ({ codenaam: codenaamVan(key), over: p.over, leeftijd: p.leeftijd,
    stad: p.stad, interesses: p.interesses, ...(zelf ? { geslacht: p.geslacht, zoekt: p.zoekt,
      leeftijdMin: p.leeftijdMin, leeftijdMax: p.leeftijdMax, maxKm: p.maxKm, actief: p.actief } : {}) });

  /* ---- de dagselectie: eindig en wederzijds passend ---- */
  function pastBij(a, b) { // valt b binnen de wensen van a?
    if (!a.zoekt.includes(b.geslacht)) return false;
    if (b.leeftijd < a.leeftijdMin || b.leeftijd > a.leeftijdMax) return false;
    if (isFinite(a.lat) && isFinite(b.lat)) {
      const km = haversine(a.lat, a.lng, b.lat, b.lng) / 1000;
      if (km > a.maxKm) return false;
    }
    return true;
  }
  const likeVan = (van, naar) => d().likes.find(l => l.van === van && l.naar === naar);
  const matchTussen = (a, b) => d().matches.find(m => (m.a === a && m.b === b) || (m.a === b && m.b === a));

  function selectie(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const ik = d().profielen[key];
    if (!ik) return { status: 200, profiel: null, mensen: [], uitleg: 'Maak eerst uw profiel; daarna stelt Vonk elke dag een kleine selectie voor.' };
    const mensen = Object.entries(d().profielen)
      .filter(([k, p]) => k !== key && p.actief !== false
        && !ik.blokkade.includes(k) && !(p.blokkade || []).includes(key)
        && pastBij(ik, p) && pastBij(p, ik)
        && !likeVan(key, k) && !matchTussen(key, k))
      .map(([k, p]) => ({ k, p, score: (p.interesses || []).filter(i => ik.interesses.includes(i)).length * 10
        - ((isFinite(ik.lat) && isFinite(p.lat)) ? haversine(ik.lat, ik.lng, p.lat, p.lng) / 10000 : 0) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, DAG_MAX)
      .map(({ k, p }) => ({ ...publiek(k, p), gemeen: (p.interesses || []).filter(i => ik.interesses.includes(i)) }));
    return { status: 200, profiel: publiek(key, ik, true), mensen,
      uitleg: 'Een kleine selectie per dag, wederzijds passend bij de wensen; morgen weer nieuwe mensen.' };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, schoon, id, nu, d, mag, likeVan, codenaamVan, keyVanCodenaam, haversine,
    reserveerTafel, pay, notify, sseToCustomer, sseToOffice, PRIJS_CENTEN, RTG_CENTEN };
  const api = { vonkProfielZet: profielZet, vonkSelectie: selectie };
  Object.assign(api, require('./match')(ctx));
  return api;
}

module.exports = { maakVonk };
