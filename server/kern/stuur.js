/* Kern-module "stuur": het universele stuur van de AI. Rahul kan hiermee
   ALLES doen wat de gebruiker zelf via de app-knoppen kan, want elke actie
   loopt als interne aanroep over de gewone API, met de eigen inlog van de
   gebruiker. Er is dus maar een codepad: dezelfde auth, dezelfde
   functie-schakelkast, dezelfde limieten en dezelfde regels reizen mee, en
   de AI kan nooit MEER dan de persoon die hem iets vraagt.

   Drie vaste remmen bovenop de bestaande middleware:
   - een korte verbodslijst voor infrastructuur (inloggen/accounts, het
     techniekbord, de zaakdoos en het stuur zelf, tegen rondzingen);
   - een expliciete allowlist per rol: een nieuwe route is nooit automatisch
     AI-bedienbaar;
   - mutaties komen eerst terug als een exact servervoorstel. Alleen een apart
     menselijk bevestigingsendpoint kan dat eenmalige voorstel uitvoeren.

   maakStuur(state) volgt het vaste kern-patroon. */

const MAX_BODY = 30000;   // een actie-body hoeft nooit groter dan dit
const TIMEOUT_MS = 15000; // een interne aanroep die langer duurt is stuk
const INTERNE_GOEDKEURING = Symbol('stuur-goedgekeurd');
const { beleidVoor, toegestanePaden, NIVEAUS } = require('./stuur/beleid');


/* De verbodslijst, de licht/zwaar-classificatie en de deeltakenparser wonen in
   ./stuur/classificatie.js; ze worden hier nog steeds geexporteerd. */
const { VERBODEN, classificeer, parseSubs } = require('./stuur/classificatie');

function maakStuur({ log, anthropic, app, crypto, isolatie }) {
  const goedkeuring = require('./stuur/goedkeuring')({ crypto, log });

  // Operationele noodrem, per verzoek gelezen: na een incident kan beheer het
  // hele AI-stuur met één omgevingsvlag dichtzetten zonder code te wijzigen.
  // De gewone handmatige schermen blijven dan beschikbaar.
  function stuurUit() { return process.env.RTG_AI_STUUR_UIT === '1'; }

  /* DE SCHADUW LAADT LUI, en dat is een gemeten keuze: zie de kop van
     ./stuur/frictieschaduw.js. Kort: hij wordt alleen binnen stuurToets
     gebruikt, en een require bovenaan dit bestand trok kern/frictie/ het
     bedraden in. */
  let WEGER = null;
  let SCHADUW = null;
  function schaduw() { return (SCHADUW = SCHADUW || require('./stuur/frictieschaduw')); }
  function weger() { return (WEGER = WEGER || schaduw().maakSchaduw({})); }

  /* ---- de poortwachter: mag dit pad überhaupt via het stuur? ---- */
  function stuurToets(pad, body, opties) {
    const o = opties || {};
    if (stuurUit())
      return { status: 503, error: 'Het AI-stuur staat tijdelijk uit via de centrale noodrem.' };
    if (typeof pad !== 'string' || !pad.startsWith('/api/') || pad.includes('..') || /[?#\s]/.test(pad))
      return { status: 400, error: 'Geef een geldig API-pad (begint met /api/, zonder query).' };
    if (VERBODEN.some(re => re.test(pad)))
      return { status: 403, error: 'Dit pad bedient het stuur bewust niet (accounts, techniek of het stuur zelf).' };
    let tekst;
    try { tekst = JSON.stringify(body == null ? {} : body); } catch (e) { return { status: 400, error: 'De body moet JSON zijn.' }; }
    if (tekst.length > MAX_BODY) return { status: 413, error: 'De actie-body is te groot.' };
    const beleid = beleidVoor(pad, o.wereld);
    if (beleid.niveau === NIVEAUS.verboden)
      return { status: 403, error: beleid.reden || 'Deze actie is niet beschikbaar voor het AI-stuur.' };
    /* DE FRICTIESCHADUW -- wat zou de motor van dit GEVAL zeggen?

       ./beleid.js antwoordt uit een statische lijst plus de bodem; de
       frictiemotor rekent met bedrag en aantal, en die staan hier in de body.
       CONTROLPLANE.md: eerst meelopen, dan pas afdwingen. Deze regel BESLIST
       DUS NIETS -- `beleid.niveau` hieronder is onaangeraakt.

       Alles achter een vangnet: een schaduw die de aanroeper kan laten klappen
       is erger dan geen schaduw, en de levering gaat voor (kern/envelop.js). */
    try { schaduw().noteer(o.wereld, pad, weger().weeg(beleid.niveau, body)); }
    catch (e) { /* een gemiste tel is geen geweigerde actie */ }

    if (beleid.niveau === NIVEAUS.voorstel && o.goedgekeurd !== INTERNE_GOEDKEURING)
      return { status: 428, bevestigNodig: true, menselijkAkkoord: true, pad,
        vraag: 'Deze actie verandert gegevens of heeft externe gevolgen. Controleer het voorstel en bevestig het zelf.' };
    return null;
  }

  /* ---- de eigenlijke aanroep: intern, met de inlog van de gebruiker ----
     req levert de poort (waar dit proces echt op luistert) en de
     Authorization-header; meer heeft een actie niet nodig. */
  async function stuurRoep(req, pad, body, opties) {
    const o = opties || {};
    const fout = stuurToets(pad, body, o);
    if (fout && fout.bevestigNodig) {
      const voorstel = goedkeuring.maak(req, pad, body, o.wereld);
      if (voorstel.error) return voorstel;
      return Object.assign({}, fout, { goedkeuring: voorstel });
    }
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

  const stuurBevestig = require('./stuur/bevestiging')({
    goedkeuring, stuurRoep, interneGoedkeuring: INTERNE_GOEDKEURING
  });

  /* De kaart staat in ./stuur/paden.js: dit bestand doet de AANROEP, dat bepaalt
     de LIJST waaruit gekozen mag worden. */
  const { stuurPaden } = require('./stuur/paden')({ VERBODEN, stuurUit, isolatie });

  /* ---- de tool-lus: Rahul aan het stuur ----
     Met een AI-sleutel verstaat Rahul een vrije vraag en voert hij hem ook uit
     (tools 'kaart' en 'doe'), met de inlog en de remmen van hierboven; zonder
     sleutel geeft de lus null terug. De lus zelf draait als submodule op deze
     context; zie stuur/lus.js. */
  const stuurLus = require('./stuur/lus')({ anthropic, app, log, stuurRoep, stuurPaden, classificeer, parseSubs, isolatie });

  return { stuurToets, stuurRoep, stuurBevestig, stuurPaden, stuurLus, classificeer, parseSubs };
}

module.exports = { maakStuur, classificeer, parseSubs };
