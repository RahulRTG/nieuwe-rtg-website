/* Kern-module "stuur": het universele stuur van de AI. Rahul kan hiermee
   ALLES doen wat de gebruiker zelf via de app-knoppen kan, want elke actie
   loopt als interne aanroep over de gewone API, met de eigen inlog van de
   gebruiker. Er is dus maar een codepad: dezelfde auth, dezelfde
   functie-schakelkast, dezelfde limieten en dezelfde regels reizen mee, en
   de AI kan nooit MEER dan de persoon die hem iets vraagt.

   Twee vaste remmen bovenop de bestaande middleware:
   - een korte verbodslijst voor infrastructuur (inloggen/accounts, het
     techniekbord, de zaakdoos en het stuur zelf, tegen rondzingen);
   - de geld-drempel: paden die over geld gaan komen eerst terug als een
     voorstel dat de gebruiker met een bevestiging moet goedkeuren
     (dezelfde afspraak als bij Rahul).

   maakStuur(state) volgt het vaste kern-patroon. */

const MAX_BODY = 30000;   // een actie-body hoeft nooit groter dan dit
const TIMEOUT_MS = 15000; // een interne aanroep die langer duurt is stuk

// infrastructuur waar het stuur nooit aan zit, wie er ook vraagt
const VERBODEN = [
  /^\/api\/auth\//,        // accounts en wachtwoorden: geen AI-terrein
  /^\/api\/login$/,        // (gast)sessies aanmaken evenmin
  /^\/api\/account\//,     // de sleutelbos (rollen koppelen/starten): mensenwerk
  /^\/api\/techniek\//,    // het beveiligde techniekbord is van de eigenaar
  /^\/api\/boardroom\//,   // idem: de eigenaarskast
  /^\/api\/doos\//,        // de zaakdoos (lokale sleutels)
  /^\/api\/office\/login$/,
  /\/doe$/                 // het stuur zelf: geen rondzingen
];
// paden die over geld gaan: eerst een voorstel, dan pas doen (na bevestiging).
// De RTG Bank-paden die geld bewegen (storten, overboeken, SEPA, de wallet-brug,
// bulk/salaris, krediet, vaste betalingen, pasacties) horen daar nadrukkelijk bij.
const GELD = /(betaal|\/pay(\/|$)|\/tik|giftcard|verreken|refund|terugbetaal|\/bank\/(storten|overboek|sepa|naar-wallet|van-wallet|bulk|salaris|krediet|terugkerend|pas\/))/i;

/* ---- lichte vs. zware taak: bepaalt het stappen-budget ----
   Een pure functie (los getoetst): "zet een timer" of "zoek een lid" is licht
   (4 stappen); "plan een complete reis voor 4 personen" is zwaar (24). We tellen
   een paar signalen: lengte, koppelwoorden (en/daarna/ook), plan-/reiswoorden en
   een groepsgrootte. Vanaf een drempel is het zwaar. */
function classificeer(vraag) {
  const t = String(vraag || '').toLowerCase();
  let score = 0;
  if (t.length > 90) score++;
  if (t.length > 180) score++;
  const koppels = (t.match(/\b(en|daarna|vervolgens|ook|plus|met)\b/g) || []).length;
  if (koppels >= 3) score++;
  if (koppels >= 6) score++;
  if (/\b(plan|regel alles|hele dag|dagplanning|weekend|reis|trip|meerdere|allemaal|compleet|complete|organiseer|verzorg)\b/.test(t)) score += 2;
  if (/\bvoor \d+ (personen|persoon|mensen|man|gasten|pax)\b/.test(t)) score++;
  // meerdere concrete boekacties in één zin = meer werk (een ketting van dingen)
  const boekwoorden = (t.match(/\b(boek|reserveer|bestel|regel|taxi'?s?|hotels?|tafels?|tickets?|vluchten?|vlucht|bloem(?:en)?|cadeaus?|restaurants?|diners?|verhuur)\b/g) || []).length;
  if (boekwoorden >= 3) score++;
  if (boekwoorden >= 5) score++;
  const zwaar = score >= 3;
  return { zwaar, maxStappen: zwaar ? 24 : 4, score };
}

/* ---- de deeltaken van een zware taak uit de model-uitvoer halen ----
   We vragen de hoofd-agent om maximaal 3 korte deeltaken als JSON-array; deze
   pure parser is soepel (JSON of een genummerde/gestreepte lijst) en los getoetst. */
function parseSubs(tekst) {
  let arr = null;
  const m = String(tekst || '').match(/\[[\s\S]*\]/);
  if (m) { try { arr = JSON.parse(m[0]); } catch (e) {} }
  if (!Array.isArray(arr)) {
    arr = String(tekst || '').split('\n').map(s => s.replace(/^[\s\-*\d.)]+/, '').trim()).filter(Boolean);
  }
  return arr.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim().slice(0, 140)).slice(0, 3);
}

function maakStuur({ log, anthropic, app }) {

  /* ---- de poortwachter: mag dit pad überhaupt via het stuur? ---- */
  function stuurToets(pad, body, bevestigd) {
    if (typeof pad !== 'string' || !pad.startsWith('/api/') || pad.includes('..') || /[?#\s]/.test(pad))
      return { status: 400, error: 'Geef een geldig API-pad (begint met /api/, zonder query).' };
    if (VERBODEN.some(re => re.test(pad)))
      return { status: 403, error: 'Dit pad bedient het stuur bewust niet (accounts, techniek of het stuur zelf).' };
    let tekst;
    try { tekst = JSON.stringify(body == null ? {} : body); } catch (e) { return { status: 400, error: 'De body moet JSON zijn.' }; }
    if (tekst.length > MAX_BODY) return { status: 413, error: 'De actie-body is te groot.' };
    if (GELD.test(pad) && bevestigd !== true)
      return { status: 428, bevestigNodig: true, pad,
        vraag: 'Dit gaat over geld. Zal ik het doen? Bevestig en ik voer het direct uit.' };
    return null;
  }

  /* ---- de eigenlijke aanroep: intern, met de inlog van de gebruiker ----
     req levert de poort (waar dit proces echt op luistert) en de
     Authorization-header; meer heeft een actie niet nodig. */
  async function stuurRoep(req, pad, body, opties) {
    const fout = stuurToets(pad, body, opties && opties.bevestigd);
    if (fout) return fout;
    const poort = req.socket && req.socket.localPort;
    if (!poort) return { status: 500, error: 'Geen interne poort gevonden.' };
    const koppen = { 'Content-Type': 'application/json' };
    const auth = req.get && req.get('authorization');
    if (auth) koppen.Authorization = auth;
    try {
      const r = await fetch('http://127.0.0.1:' + poort + pad, {
        method: 'POST', headers: koppen, body: JSON.stringify(body == null ? {} : body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      const antwoord = await r.json().catch(() => ({}));
      try { log && log.info && log.info('stuur', { pad, s: r.status }); } catch (e) {}
      return { status: r.status, antwoord };
    } catch (e) {
      return { status: 502, error: 'De actie kwam niet aan: ' + (e && e.name === 'TimeoutError' ? 'tijd verstreken.' : 'interne fout.') };
    }
  }

  /* ---- de kaart van het stuur: alle POST-paden die dit proces kent ----
     Rechtstreeks uit de router gelezen (dus nooit een verouderde lijst),
     gefilterd op de verbodslijst en desgewenst op een prefix per rol. */
  function stuurPaden(app, prefixes) {
    const uit = [];
    const stack = (app && app._router && app._router.stack) || [];
    for (const laag of stack) {
      const r = laag.route;
      if (!r || !r.methods || !r.methods.post) continue;
      const pad = r.path;
      if (typeof pad !== 'string' || !pad.startsWith('/api/')) continue;
      if (VERBODEN.some(re => re.test(pad))) continue;
      if (prefixes && prefixes.length && !prefixes.some(p => pad === p || pad.startsWith(p + '/') || pad.startsWith(p))) continue;
      uit.push(pad);
    }
    return [...new Set(uit)].sort();
  }

  /* ---- de tool-lus: Rahul aan het stuur ----
     Met een AI-sleutel verstaat Rahul een vrije vraag en voert hij hem ook uit
     (tools 'kaart' en 'doe'), met de inlog en de remmen van hierboven; zonder
     sleutel geeft de lus null terug. De lus zelf draait als submodule op deze
     context; zie stuur/lus.js. */
  const stuurLus = require('./stuur/lus')({ anthropic, app, log, stuurRoep, stuurPaden, classificeer, parseSubs });

  return { stuurToets, stuurRoep, stuurPaden, stuurLus, classificeer, parseSubs };
}

module.exports = { maakStuur, classificeer, parseSubs };
