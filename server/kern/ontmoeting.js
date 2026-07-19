/* Kern-module "ontmoeting": Salon-ontmoetingen tussen wederzijdse connecties.

   Het idee: twee leden die al met elkaar verbonden zijn (vrienden in De Salon)
   en die deze functie allebei zelf hebben aangezet, krijgen een seintje als ze
   dicht bij elkaar in de buurt zijn. Ze kiezen dan elk een activiteit, of doen
   niets (niets doen telt als afwijzen). Kiezen ze hetzelfde, dan gaan ze dat
   doen. Kiezen ze verschillend, dan luistert het systeem naar de vrouw; is dat
   niet te bepalen, dan wint de rustigste keuze.

   Gaan ze akkoord, dan tekenen ze allebei een contract in de app. Daarmee geven
   ze RTG-kantoor toestemming om hun live-locatie te zien tot de afspraak klaar
   is, en om bij een SOS meteen mee te luisteren en te kijken via de camera en
   direct de hulpdiensten te bellen. De functie staat standaard uit; elk lid zet
   hem zelf aan en uit.

   Voorwaarden om mee te doen: een actief RTG-geverifieerd paspoort en minstens
   18 jaar. Het geslacht (voor de "naar de vrouw"-regel) komt uit dat paspoort.

   maakOntmoeting(state) volgt het vaste kern-patroon: draagt state, praat niet
   rechtstreeks met de buitenwereld, en is los te testen. */

const RADIUS_M = 250;                        // "in de buurt": binnen deze straal
const POS_TTL_MS = 6 * 60 * 1000;            // een positie is zo lang vers voor de radar
const VOORSTEL_TTL_MS = 12 * 60 * 1000;      // een voorstel verloopt vanzelf (niets doen = afwijzen)
const MIN_LEEFTIJD = 18;

// Rangorde "rustig" -> "uitbundig"; bij een gelijkspel zonder vrouw wint de rustigste.
const ACTIVITEITEN = [
  { id: 'wandelen', label: 'Wandelen', icon: '\u{1F6B6}', tekst: 'Een rustige wandeling', rust: 0 },
  { id: 'borrelen', label: 'Borrelen', icon: '\u{1F942}', tekst: 'Iets drinken op een terras', rust: 1 },
  { id: 'jetset',   label: 'Jetset',   icon: '✨',    tekst: 'Uitgaan in stijl', rust: 2 }
];
const ACT_IDS = ACTIVITEITEN.map(a => a.id);

function maakOntmoeting({ db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice, connectieTussen, verbActief, zijnVrienden, codenaamVan, haversine }) {
  const id = () => crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();
  const paar = (a, b) => [a, b].sort().join('|');

  function lijsten() {
    if (!db.data.ontmoetVoorkeur) db.data.ontmoetVoorkeur = {};   // key -> { aan, at }
    if (!db.data.ontmoetPosities) db.data.ontmoetPosities = {};   // key -> { lat, lng, at }
    if (!Array.isArray(db.data.ontmoetVoorstellen)) db.data.ontmoetVoorstellen = [];
    if (!Array.isArray(db.data.ontmoetDates)) db.data.ontmoetDates = [];
  }

  /* ---- wie mag meedoen: 18+ met actief RTG-geverifieerd paspoort ---- */
  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }
  function memberState(u) { try { return accounts.getMemberState(u.id) || {}; } catch (e) { return {}; } }
  function geslachtVan(key) {
    const u = accountVanKey(key);
    if (!u || u.verified !== 'verified') return null;      // alleen uit een geverifieerd paspoort
    const g = String(memberState(u).geslacht || '').toLowerCase();
    return (g === 'v' || g === 'm') ? g : null;            // 'x'/onbekend telt als onbepaald
  }
  function mag(key) {
    const u = accountVanKey(key);
    if (!u) return { ok: false, reden: 'Alleen voor RTG-leden met een eigen account.' };
    if (u.verified !== 'verified') return { ok: false, reden: 'Activeer eerst uw RTG-geverifieerde paspoort.' };
    const md = memberState(u);
    const lft = md.geboren ? leeftijdVan(md.geboren) : null;
    if (lft == null || lft < MIN_LEEFTIJD) return { ok: false, reden: 'Ontmoetingen zijn vanaf ' + MIN_LEEFTIJD + ' jaar.' };
    return { ok: true };
  }

  /* ---- de aan/uit-knop (elk lid zelf) ---- */
  function staatAan(key) { lijsten(); const v = db.data.ontmoetVoorkeur[key]; return !!(v && v.aan); }
  function zet(key, aan) {
    lijsten();
    if (aan) {
      const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
      db.data.ontmoetVoorkeur[key] = { aan: true, at: nu() };
    } else {
      db.data.ontmoetVoorkeur[key] = { aan: false, at: nu() };
      delete db.data.ontmoetPosities[key];
      // openstaande voorstellen van/aan dit lid vervallen
      for (const v of db.data.ontmoetVoorstellen) if (v.status === 'open' && (v.a === key || v.b === key)) v.status = 'afgewezen';
    }
    save();
    return { status: 200, ok: true, aan: !!aan };
  }

  /* ---- positie doorgeven en de radar laten lopen ----
     Terwijl de functie aanstaat stuurt de app af en toe de positie mee. We
     bewaren alleen de laatste positie (kort houdbaar) en kijken of een verbonden
     vriend die ook aanstaat vlakbij is. Zo ja, dan ontstaat er een voorstel. */
  function pos(key, lat, lng) {
    lijsten();
    if (!staatAan(key)) return { status: 409, error: 'Zet Ontmoetingen eerst aan.' };
    const m = mag(key); if (!m.ok) { zet(key, false); return { status: 403, error: m.reden }; }
    if (Number.isFinite(lat) && Number.isFinite(lng)) db.data.ontmoetPosities[key] = { lat, lng, at: nu() };
    const nieuwe = radar(key);
    save();
    return { status: 200, ok: true, nieuwe };
  }
  function versePositie(key) {
    const p = db.data.ontmoetPosities[key];
    if (!p || !Number.isFinite(p.lat)) return null;
    if (Date.now() - new Date(p.at).getTime() > POS_TTL_MS) return null;
    return p;
  }

  /* De radarlaag en de datelaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; beide komen de context
     in omdat ze elkaars functies per verzoek gebruiken. */
  const ctx = { db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice,
    connectieTussen, verbActief, zijnVrienden, codenaamVan, haversine,
    RADIUS_M, POS_TTL_MS, VOORSTEL_TTL_MS, MIN_LEEFTIJD, ACTIVITEITEN, ACT_IDS,
    lijsten, accountVanKey, memberState, geslachtVan, mag, staatAan, zet, pos, versePositie, id, nu, paar };
  const deelRadar = require('./ontmoeting/radar')(ctx);
  Object.assign(ctx, deelRadar);
  const deelDate = require('./ontmoeting/date')(ctx);
  Object.assign(ctx, deelDate);
  const { radar, lopendVoorstel, lopendeDate, verlopenVoorstel, kies, beslisActiviteit, contractTekst } = deelRadar;
  const { maakDate, dateVoor, teken, dateHier, stop, sos, sosAf, signaalNaarKantoor, signaalNaarLid, opschonen, publiekVoorstel, publiekeDate, mijnState, kantoorState } = deelDate;

  return {
    ontmoetZet: zet, ontmoetPos: pos,
    ontmoetKies: kies, ontmoetTeken: teken, ontmoetHier: dateHier, ontmoetStop: stop,
    ontmoetSos: sos, ontmoetSosAf: sosAf, ontmoetSignaalKantoor: signaalNaarKantoor,
    ontmoetSignaalLid: signaalNaarLid, ontmoetMijnState: mijnState, ontmoetKantoorState: kantoorState
  };
}

module.exports = { maakOntmoeting };
