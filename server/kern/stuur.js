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
     (dezelfde afspraak als bij De Butler).

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
// paden die over geld gaan: eerst een voorstel, dan pas doen (na bevestiging)
const GELD = /(betaal|\/pay(\/|$)|\/tik|giftcard|verreken|refund|terugbetaal)/i;

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
     Met een AI-sleutel verstaat Rahul een vrije vraag en voert hij hem ook
     uit, met twee gereedschappen: 'kaart' (welke paden kan ik) en 'doe'
     (voer uit via het stuur, dus met de inlog en de remmen van hierboven).
     Zonder sleutel geeft dit null terug en blijven de vaste antwoorden
     van de assistenten gewoon staan. */
  const LUS_REGELS = 'Je hebt het stuur van RTG: met de tool "doe" voer je acties uit op de API, ' +
    'altijd met de inlog van de gebruiker zelf (je kunt dus nooit meer dan zij). Gebruik "kaart" om te zien welke paden er zijn. ' +
    'Vaste regels: een geld-actie geeft eerst bevestigNodig terug; leg dan in je antwoord voor WAT je gaat doen en voer hem pas uit ' +
    'met bevestigd=true als het huidige bericht van de gebruiker die actie al expliciet bevestigt. ' +
    'Beloof nooit toegang tot de Lifestyle of Business Pass (dat beslist een mens), voer geen echte hotel- of luchtvaartmerken op als partner, ' +
    'en wees liever te hard dan een liegbeest: is een actie mislukt of onzeker, dan is dat je eerste zin, zonder verzachting; ' +
    'zeg nooit "gelukt" op basis van een aanname en verzin geen uitkomsten die de tools niet teruggaven. Antwoord kort, in de taal van de vraag.';

  async function stuurLus(req, opties) {
    if (!anthropic) return null;
    const vraag = String((opties && opties.vraag) || '').trim().slice(0, 600);
    if (!vraag) return null;
    const paden = () => stuurPaden(app, null).filter(opties.filter || (() => true));
    const tools = [
      { name: 'kaart', description: 'De lijst API-paden (POST) die je met "doe" kunt aanroepen.',
        input_schema: { type: 'object', properties: {} } },
      { name: 'doe', description: 'Voer een actie uit op een RTG API-pad (POST), met de inlog van de gebruiker.',
        input_schema: { type: 'object', properties: {
          pad: { type: 'string' }, body: { type: 'object' }, bevestigd: { type: 'boolean' } }, required: ['pad'] } }
    ];
    const messages = [{ role: 'user', content: vraag }];
    const acties = [];
    try {
      for (let stap = 0; stap < 6; stap++) {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 700,
          system: (opties.systeem || '') + '\n' + LUS_REGELS, tools, messages
        });
        const wilTools = resp.content.filter(c => c.type === 'tool_use');
        if (!wilTools.length || resp.stop_reason !== 'tool_use') {
          const tekst = resp.content.filter(c => c.type === 'text').map(c => c.text).join('').trim();
          return { tekst: tekst || 'Gedaan.', acties };
        }
        messages.push({ role: 'assistant', content: resp.content });
        const uitkomsten = [];
        for (const t of wilTools) {
          let uit;
          if (t.name === 'kaart') uit = { paden: paden() };
          else {
            uit = await stuurRoep(req, String((t.input || {}).pad || ''), (t.input || {}).body,
              { bevestigd: (t.input || {}).bevestigd === true });
            acties.push({ pad: (t.input || {}).pad, status: uit.status });
          }
          uitkomsten.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(uit).slice(0, 6000) });
        }
        messages.push({ role: 'user', content: uitkomsten });
      }
    } catch (e) {
      try { log && log.warn && log.warn('stuurlus', { fout: (e && e.message || '').slice(0, 120) }); } catch (e2) {}
      return null; // de vaste antwoorden vangen het op
    }
    return { tekst: 'Daar kwam ik binnen de tijd niet helemaal uit; zeg het iets specifieker en ik doe het alsnog.', acties };
  }

  return { stuurToets, stuurRoep, stuurPaden, stuurLus };
}

module.exports = { maakStuur };
