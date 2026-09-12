/* DE INTERPRETATIERAIL -- welke laag menselijke taal omzet in tool-aanroepen.

   WAAROM DIT BESTAAT. `stuur/lus.js` kreeg tot nu toe rechtstreeks de
   modelclient, en deed er één ding mee: `if (!anthropic) return null`. Zonder
   sleutel bestond de lus niet, en daarmee was de hele keten eronder --
   resolver, plan, gevolg, plafond, mandaat, capability -- in een omgeving
   zonder sleutel NIET TE BEPROEVEN. Niet stuk, niet uit: onbewijsbaar.

   Dat is de verkeerde afhankelijkheid. Een model hoort het BEGRIP te
   verbeteren, niet de voorwaarde te zijn waaronder RTG überhaupt te toetsen
   is. Vandaar deze laag: de rail is vervangbaar, alles eronder is RTG.

       menselijke invoer
             |
       INTERPRETATIERAIL   <- vervangbaar (dit bestand)
             |
       tool-aanroepen: kaart / plan / doe
             |
       resolver -> plan -> gevolg -> plafond/mandaat -> capability   <- RTG

   DE NAAD IS ÉÉN FUNCTIE, en dat is geen toeval maar de reden dat dit klein
   kan blijven: `anthropic.messages.create(...)`. Wat eronder hangt
   (`lusstap.voerUit`) voert de tools ECHT uit -- `kaart` roept de echte
   resolver aan, `plan` de echte compileer() en voorspel(), `doe` de echte
   twijfelpoort, herkomstpoort en stuurRoep. Een vervangende rail raakt
   daar niets van aan.

   MAGNAATLAB.md: *een simulatie-adapter vervangt de rail, nooit de poort.*
   Die regel geldt hier letterlijk, en `test/stuurrail.test.js` houdt hem
   vast: zodra de deterministische rail iets uit kern/stuur/ importeert dat
   een POORT is, zakt de toets. Wie de motor namaakt in plaats van de rail,
   bewijst niets.

   DRIE GRENDELS OP DE DETERMINISTISCHE RAIL, ALLE DRIE FAIL-CLOSED. De vorm
   komt van `server/betaal/synthetisch.js`, en de reden staat op
   `server/server.js` r. 241: daar stond ooit `NODE_ENV !== 'production' ||
   RTG_DEMO === '1'` met de belofte dat de demo nooit per ongeluk openstond --
   en die belofte was precies verkeerd om. Een slot dat opengaat als iemand
   iets vergeet, is geen slot.

     1. Alleen met RTG_INTENT_RAIL=deterministisch. GEEN SLEUTEL IS NOOIT
        STILZWIJGEND HETZELFDE ALS DETERMINISTISCH. Dit is de belangrijkste
        van de drie: `if (!key) gebruik corpus` zou betekenen dat elke
        productieomgeving die zijn sleutel kwijtraakt stilletjes op een
        corpus van een handvol zinnen gaat draaien.
     2. Nooit in productie, ook mét de vlag.
     3. Nooit naast een echte modelclient. Een rail die een werkende rail
        overschaduwt is erger dan geen rail.

   Elke weigering zegt WELKE grendel dichtzit. "Niet beschikbaar" laat iemand
   drie kwartier zoeken.

   DE NAAM VAN DE MODELRAIL WORDT AFGELEID EN NIET OVERGETYPT. `server/ai.js`
   kent de ketting al (lokaal, claude, openai, gemini) en geeft hem uit als
   `client.aanbieders`. Een tweede lijst hier zou de 22e capabilitylijst zijn
   waar OS.md voor waarschuwt: twee plekken die hetzelfde bedoelen en na een
   jaar iets anders zeggen. */
'use strict';

/* De gesloten lijst rails. `GEEN` staat erin als eersteklas uitkomst en niet
   als leegte: "er is geen rail" is iets anders dan "de rail zei niets". */
const RAILS = Object.freeze(['DETERMINISTISCH', 'LOKAAL', 'CLAUDE', 'OPENAI', 'GEMINI', 'GEEN']);

/* De aanbiedersnaam van ai.js naar een railnaam. Onbekend blijft onbekend --
   raden zou een rail verzinnen die niemand heeft ingesteld. */
const VAN_AANBIEDER = Object.freeze({
  local: 'LOKAAL', lokaal: 'LOKAAL', claude: 'CLAUDE', anthropic: 'CLAUDE',
  openai: 'OPENAI', gemini: 'GEMINI'
});

function modelrailNaam(client) {
  if (!client) return 'GEEN';
  const lijst = Array.isArray(client.aanbieders) ? client.aanbieders : [];
  for (const naam of lijst) {
    const r = VAN_AANBIEDER[String(naam || '').toLowerCase()];
    if (r) return r;
  }
  /* Een client die wel bestaat maar geen herkenbare aanbieder noemt, is nog
     steeds een MODELrail -- alleen weten we niet welke. Dat is een andere
     uitslag dan GEEN, en het wordt er niet een gemaakt. */
  return lijst.length ? 'ONBEKEND_MODEL' : 'GEEN';
}

/* De drie grendels. Geeft null als de deterministische rail mag draaien,
   anders de reden als tekst -- de aanroeper zet hem in een melding die een
   mens leest. */
function waaromNietDeterministisch({ env, modelclient }) {
  const e = env || {};
  if (e.RTG_INTENT_RAIL !== 'deterministisch')
    return 'De deterministische intentierail staat uit. Zet RTG_INTENT_RAIL=deterministisch ' +
      'in een omgeving die géén productie is. Zonder die vlag is een ontbrekende modelsleutel ' +
      'gewoon "geen rail" en nooit stilzwijgend "corpus".';
  if (e.NODE_ENV === 'production')
    return 'De deterministische intentierail draait nooit in productie, ook niet met ' +
      'RTG_INTENT_RAIL=deterministisch. Hij verstaat alleen een vastgelegd corpus en ' +
      'zegt NIET_HERKEND tegen al het andere.';
  if (modelclient)
    return 'Er is een echte modelclient geconfigureerd (' + modelrailNaam(modelclient) + '). ' +
      'De deterministische rail weigert die te overschaduwen; haal de sleutel weg of zet ' +
      'RTG_INTENT_RAIL uit.';
  return null;
}

/* Welke rail draait er, en waarom die. Geeft altijd alle drie terug: de naam
   (uit de gesloten lijst), de client die lus.js krijgt, en de reden -- ook als
   het antwoord GEEN is. Een stille null was precies het probleem. */
function kies({ env, modelclient, corpusRail }) {
  const belet = waaromNietDeterministisch({ env, modelclient });
  if (!belet) {
    const rail = typeof corpusRail === 'function' ? corpusRail() : corpusRail;
    if (rail) return { naam: 'DETERMINISTISCH', client: rail, reden: 'RTG_INTENT_RAIL=deterministisch' };
    /* De vlag staat aan en er is geen corpusrail meegegeven. Dat is een
       bouwfout en geen stand van de wereld; hij valt daarom niet stilletjes
       terug op het model. */
    return { naam: 'GEEN', client: null,
      reden: 'RTG_INTENT_RAIL=deterministisch, maar er is geen corpusrail aangeleverd' };
  }
  if (modelclient) return { naam: modelrailNaam(modelclient), client: modelclient, reden: 'modelclient uit server/ai.js' };
  return { naam: 'GEEN', client: null, reden: belet };
}

module.exports = { kies, waaromNietDeterministisch, modelrailNaam, RAILS };
