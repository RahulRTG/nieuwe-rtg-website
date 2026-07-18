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

   maakVonk(state) volgt het vaste kern-patroon. */

const MIN_LEEFTIJD = 18;
const DAG_MAX = 6;            // de eindige dagselectie
const PRIJS_CENTEN = 1000;    // EUR 10 p.p.
const RTG_CENTEN = 500;       // waarvan EUR 5 voor RTG; de rest is aanbetaling bij de zaak

function maakVonk({ db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan, keyVanCodenaam,
  haversine, findSupplier, reserveerTafel, pay, notify, sseToCustomer, sseToOffice }) {
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

  /* ---- like / voorbij; wederzijds = match + automatisch een tafel in het midden ---- */
  async function like(key, codenaam, aan) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    const doel = t && t.key;
    if (!doel || !d().profielen[doel]) return { status: 404, error: 'Geen Vonk-profiel met die codenaam.' };
    if (doel === key) return { status: 400, error: 'Uzelf liken hoeft niet.' };
    d().likes = d().likes.filter(l => !(l.van === key && l.naar === doel));
    if (aan === false) { d().likes.push({ van: key, naar: doel, nee: true, at: nu() }); save(); return { status: 200, ok: true }; }
    d().likes.push({ van: key, naar: doel, at: nu() });
    const terug = likeVan(doel, key);
    if (!terug || terug.nee) { save(); return { status: 200, ok: true, match: false }; }
    // wederzijds: de match, de chatlijn en de tafel in het midden
    const m = { id: id(), a: key, b: doel, at: nu(), berichten: [], betaald: {}, status: 'wacht-op-betaling' };
    m.tafel = tafelInHetMidden(d().profielen[key], d().profielen[doel]);
    d().matches.unshift(m);
    save();
    for (const wie of [key, doel]) {
      const ander = wie === key ? doel : key;
      try { notify(wie, { icon: '🔥', title: 'Een vonk!', body: 'U en ' + codenaamVan(ander) + ' liken elkaar. ' + (m.tafel ? 'Er staat een tafel klaar bij ' + m.tafel.supplierName + '; bevestig met EUR 10 p.p.' : 'De chatlijn is open.') }); } catch (e) {}
      try { sseToCustomer(wie, 'vonk', { kind: 'match', id: m.id }); } catch (e) {}
    }
    return { status: 200, ok: true, match: true, id: m.id, tafel: m.tafel };
  }
  // de partner met tafels het dichtst bij het geografische midden van de twee steden
  function tafelInHetMidden(pa, pb) {
    if (!pa || !pb || !isFinite(pa.lat) || !isFinite(pb.lat)) return null;
    const mid = { lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 };
    let beste = null, besteAf = Infinity;
    for (const s of Object.values(db.data.suppliers || {})) {
      if (!(s.tables || []).length || !s.loc || !isFinite(s.loc.lat)) continue;
      if (s.settings && s.settings.reservationsOpen === false) continue;
      const af = haversine(mid.lat, mid.lng, s.loc.lat, s.loc.lng);
      if (af < besteAf) { besteAf = af; beste = s; }
    }
    if (!beste) return null;
    const dag = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return { supplierCode: beste.code, supplierName: beste.name, plek: (beste.loc && beste.loc.label) || beste.city || '',
      datum: dag, tijd: '19:30', prijsPP: PRIJS_CENTEN / 100, rtgDeel: RTG_CENTEN / 100 };
  }

  /* ---- betalen (EUR 10 p.p.) en dan echt reserveren ---- */
  async function betaal(key, mid) {
    const m = d().matches.find(x => x.id === mid && (x.a === key || x.b === key));
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    if (!m.tafel) return { status: 409, error: 'Er is geen tafel om te bevestigen; spreek zelf iets af in de chat.' };
    if (m.betaald[key]) return { status: 200, ok: true, al: true, status2: m.status };
    const codenaam = codenaamVan(key);
    // EUR 5 naar RTG en EUR 5 als aanbetaling bij de zaak, in een keer uit de wallet
    const r1 = pay.boek({ van: 'lid:' + codenaam, naar: 'extern:vonk-rtg', centen: RTG_CENTEN, soort: 'vonk', oms: 'Vonk-date, deel RTG', ref: m.id });
    if (r1 && r1.error) return { status: 402, error: r1.error };
    const r2 = pay.boek({ van: 'lid:' + codenaam, naar: 'partner:' + m.tafel.supplierCode, centen: PRIJS_CENTEN - RTG_CENTEN, soort: 'vonk', oms: 'Vonk-date, aanbetaling zaak', ref: m.id });
    if (r2 && r2.error) return { status: 402, error: r2.error };
    m.betaald[key] = nu();
    const ander = m.a === key ? m.b : m.a;
    if (m.betaald[ander]) {
      // allebei betaald: nu pas de echte reservering (op beide codenamen)
      const res = reserveerTafel({ key, tier: 'rtg' }, codenaamVan(m.a) + ' & ' + codenaamVan(m.b),
        { supplierCode: m.tafel.supplierCode, datum: m.tafel.datum, tijd: m.tafel.tijd, personen: 2, notitie: 'Vonk-date (aanbetaling voldaan)' });
      m.status = res && res.ok ? 'bevestigd' : 'betaald';
      m.reserveringId = res && res.ok ? res.reservering.id : null;
      for (const wie of [m.a, m.b]) { try { notify(wie, { icon: '🥂', title: 'De date staat', body: m.tafel.supplierName + ', ' + m.tafel.datum + ' ' + m.tafel.tijd + '. Veel plezier!' }); } catch (e) {} }
    }
    save();
    return { status: 200, ok: true, status2: m.status };
  }

  /* ---- de chatlijn (pas na een match) + blokkeren en melden ---- */
  function bericht(key, mid, tekst) {
    const m = d().matches.find(x => x.id === mid && (x.a === key || x.b === key));
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Zeg iets liefs.' };
    m.berichten.push({ van: codenaamVan(key), tekst: t, at: nu() });
    m.berichten = m.berichten.slice(-200);
    save();
    const ander = m.a === key ? m.b : m.a;
    try { sseToCustomer(ander, 'vonk', { kind: 'bericht', id: m.id }); } catch (e) {}
    return { status: 200, ok: true };
  }
  function mijn(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const rijen = d().matches.filter(m => m.a === key || m.b === key).slice(0, 50).map(m => ({
      id: m.id, met: codenaamVan(m.a === key ? m.b : m.a), at: m.at, status: m.status,
      tafel: m.tafel, ikBetaalde: !!m.betaald[key], anderBetaalde: !!m.betaald[m.a === key ? m.b : m.a],
      berichten: m.berichten.slice(-30)
    }));
    return { status: 200, matches: rijen };
  }
  async function blokkeer(key, codenaam, meld) {
    const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    const doel = t && t.key;
    if (!doel) return { status: 404, error: 'Geen lid met die codenaam.' };
    const p = d().profielen[key];
    if (p && !p.blokkade.includes(doel)) p.blokkade.push(doel);
    d().matches = d().matches.filter(m => !((m.a === key && m.b === doel) || (m.a === doel && m.b === key)));
    if (meld) {
      d().meldingen.unshift({ id: id(), van: codenaamVan(key), over: codenaamVan(doel), reden: schoon(meld, 200), at: nu(), status: 'open' });
      d().meldingen = d().meldingen.slice(0, 500);
      try { sseToOffice('sync', { scope: 'vonk' }); } catch (e) {}
    }
    save();
    return { status: 200, ok: true };
  }

  return { vonkProfielZet: profielZet, vonkSelectie: selectie, vonkLike: like, vonkBetaal: betaal,
    vonkBericht: bericht, vonkMijn: mijn, vonkBlokkeer: blokkeer,
    vonkMeldingen: () => ({ status: 200, meldingen: d().meldingen.slice(0, 50) }) };
}

module.exports = { maakVonk };
