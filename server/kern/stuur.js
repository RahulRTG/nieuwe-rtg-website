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


/* De verbodslijst, de licht/zwaar-classificatie en de deeltakenparser wonen in
   ./stuur/classificatie.js; ze worden hier nog steeds geexporteerd. */
const { VERBODEN, classificeer, parseSubs } = require('./stuur/classificatie');
const rail = require('./stuur/rail');

function maakStuur({ log, anthropic, app, crypto, isolatie }) {
  const goedkeuring = require('./stuur/goedkeuring')({ crypto, log });

  // Operationele noodrem, per verzoek gelezen: na een incident kan beheer het
  // hele AI-stuur met één omgevingsvlag dichtzetten zonder code te wijzigen.
  // De gewone handmatige schermen blijven dan beschikbaar.
  function stuurUit() { return process.env.RTG_AI_STUUR_UIT === '1'; }

  /* De poortwacht woont in ./stuur/toets.js: dat bestand BESLIST of een
     handeling mag (vier poorten, waaronder de mandaatpoort), dit bestand DOET de
     aanroep. Zie de kop daar voor de volgorde en waarom die gedrag is. */
  const { stuurToets } = require('./stuur/toets')({
    stuurUit, VERBODEN, MAX_BODY, INTERNE_GOEDKEURING
  });

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
     Met een rail verstaat Rahul een vrije vraag en voert hij hem ook uit
     (tools 'kaart' en 'doe'), met de inlog en de remmen van hierboven; zonder
     rail geeft de lus null terug. De lus zelf draait als submodule op deze
     context; zie stuur/lus.js.

     WELKE RAIL DAT IS, IS SINDS ./stuur/rail.js EEN KEUZE MET EEN NAAM. Tot dan
     kreeg de lus rechtstreeks de modelclient, en was de hele keten eronder --
     resolver, plan, gevolg, plafond, mandaat, capability -- in een omgeving
     zonder sleutel onbewijsbaar. Niet stuk, niet uit: niet te beproeven. De
     rail is vervangbaar, alles eronder is RTG.

     De deterministische rail zit achter drie fail-closed grendels en komt
     NOOIT vanzelf op als er geen sleutel is; zie de kop van rail.js voor
     waarom dat de belangrijkste van de drie is. */
  const gekozenRail = rail.kies({
    env: process.env, modelclient: anthropic,
    corpusRail: () => require('./stuur/rail-corpus').maakCorpusRail({})
  });
  if (log && gekozenRail.naam === 'DETERMINISTISCH')
    log.warn ? log.warn('stuur: deterministische intentierail actief (' + gekozenRail.reden + ')')
      : console.warn('stuur: deterministische intentierail actief');
  const stuurLus = require('./stuur/lus')({ anthropic: gekozenRail.client, app, log, stuurRoep,
    stuurPaden, classificeer, parseSubs, isolatie, railNaam: gekozenRail.naam });

  /* INTREKKEN GAAT NIET LANGS stuurRoep, en dat is geen omweg maar de kern van
     de zaak: er valt hier niets uit te voeren. De route roept deze functie
     rechtstreeks aan, zij raakt uitsluitend de eigen voorstellenlijst, en zij
     kan structureel geen enkel API-pad bereiken. Zie ./stuur/goedkeuring.js. */
  const stuurIntrek = (req, wereld) => goedkeuring.trekEnige(req, wereld);

  return { stuurToets, stuurRoep, stuurBevestig, stuurIntrek, stuurPaden, stuurLus, classificeer, parseSubs,
    /* De stand van de rail is uit te lezen: een keten die niet kan zeggen
       WELKE rail hem interpreteerde, is niet te beoordelen. */
    stuurRail: () => ({ naam: gekozenRail.naam, reden: gekozenRail.reden }) };
}

/* VERBODEN hoort bij het contract van het stuur (test/rahul-eerlijk.test.js
   leest hem hier: het pas-besluit blijft mensenwerk), ook nu de lijst zelf in
   ./stuur/classificatie.js woont. */
module.exports = { maakStuur, classificeer, parseSubs, VERBODEN };
