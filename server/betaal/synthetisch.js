/* DE SIMULATIEBANK: de vierde rail achter de betaalnaad.

   WAAROM DIT BESTAAT. `MAGNAATLAB.md` par. 3 stelde de scherpste vraag van dat
   document: waarom kan Magnaat -- de testhal -- niet bij RTG Pay? Het antwoord
   stond in de code en was een compliment: `kern/pay/poort.js` kent geen enkele
   demo-, test-, spel- of simulatiestand. Geen vlag, geen omweg, geen `if (test)`.
   En een spelbank MOET geld uit niets maken; dat is het spel.

   > Het schoonste aan RTG Pay is vandaag precies de reden dat Magnaat er niet
   > bij kan.

   De verleiding is dan een schakelaar IN de poort. Dat is drie regels, en het is
   een vlag die op een dag in productie aan staat -- `LAT.md` regel 5 en 9 komen
   allebei uit gevallen waarin precies dat gebeurde. De regel die MAGNAATLAB.md
   daaruit trekt is algemeen:

   > Een simulatie-adapter vervangt de RAIL, nooit de POORT. Wat beslist of iets
   > mag, draait in de simulatie ongewijzigd mee -- anders test je een ander
   > systeem.

   Dit bestand is die adapter. `kern/pay/poort.js` is er niet voor veranderd en
   test/simulatiebank.test.js zakt zodra dat wel gebeurt.

   WAT DEZE BANK TOEVOEGT BOVEN DE DEMO-PROVIDER, want dat is de vraag die een
   lezer terecht stelt. De demo-provider bevestigt ALTIJD: hij bewijst dat de
   keten loopt als alles goed gaat. Een testhal heeft het tegenovergestelde
   nodig -- een rail die op commando en reproduceerbaar STUK gaat:

     betaald        de gewone afloop
     geweigerd      de bank zegt nee (te weinig dekking, fraudefilter)
     traag          blijft hangen; hij bevestigt nooit uit zichzelf
     terugboeking   eerst betaald, daarna teruggehaald door de betaler

   Zonder die vier bewijst een simulatie alleen dat de zonnige dag werkt, en dat
   is precies de dag waarop niemand een fout maakt.

   DE VERDELING IS EEN KEUZE EN GEEN METING. Zonder expliciet scenario kiest deze
   bank er een uit de idempotentiesleutel, zodat een run van duizend boekingen
   een spreiding oplevert en dezelfde sleutel altijd dezelfde afloop geeft. Die
   percentages hieronder zijn NIET gemeten aan echt betaalverkeer -- ze zijn
   gekozen zodat elk pad in een run van redelijke omvang voorkomt. Wie ze als
   voorspelling leest, leest ze verkeerd.

   DRIE GRENDELS, EN ZE ZIJN ALLE DRIE FAIL-CLOSED. Deze bank maakt geld uit
   niets. Dat is de bedoeling en precies daarom mag hij nooit per ongeluk aan
   staan:

     1. Hij draait alleen met RTG_SIMULATIEBANK=1. Geen sleutel is nooit
        stilzwijgend hetzelfde als "de betaling is gelukt" -- dezelfde regel die
        de demo-provider al draagt.
     2. Hij weigert zodra er een ECHTE provider geconfigureerd is. Een simulatie
        die een werkende rail overschaduwt, is erger dan geen simulatie.
     3. Hij weigert in productie, ook mét de vlag. Een vergeten omgevingsvariabele
        is de normaalste fout die er bestaat.

   Elke weigering zegt WELKE grendel dichtzit; "niet beschikbaar" laat iemand
   drie kwartier zoeken. */
'use strict';

/* De scenario's, met wat ze in de keten betekenen. Gesloten lijst: een vrij
   tekstveld levert scenario's op die geen enkele afhandeling kent. */
const SCENARIOS = {
  betaald: { status: 'betaald', deel: 85, wat: 'de gewone afloop' },
  geweigerd: { status: 'geweigerd', deel: 7, wat: 'de bank zegt nee' },
  traag: { status: 'open', deel: 5, wat: 'blijft hangen, bevestigt nooit uit zichzelf' },
  terugboeking: { status: 'teruggeboekt', deel: 3, wat: 'betaald en daarna teruggehaald' }
};

/* FNV-1a over de sleutel. Deterministisch en zonder afhankelijkheid: dezelfde
   boeking geeft in elke run dezelfde afloop, ook op een andere machine. */
function getal(s) {
  let h = 2166136261;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Het scenario van een boeking: expliciet als de aanroeper het zegt, anders uit
   de sleutel. De grens tussen de vakken volgt de volgorde van SCENARIOS, zodat
   een deel erbij of eraf de rest niet stil verschuift. */
function scenarioVan(opdracht) {
  const gevraagd = String((opdracht && opdracht.simulatie) || '').toLowerCase();
  if (gevraagd) {
    if (!SCENARIOS[gevraagd])
      throw new Error('Simulatiescenario "' + gevraagd + '" bestaat niet. Kies uit: ' +
        Object.keys(SCENARIOS).join(', ') + '.');
    return gevraagd;
  }
  const sleutel = (opdracht && (opdracht.idempotentieSleutel || opdracht.referentie)) || '';
  let punt = getal(sleutel) % 100;
  for (const [naam, s] of Object.entries(SCENARIOS)) {
    if (punt < s.deel) return naam;
    punt -= s.deel;
  }
  return 'betaald';
}

/* De drie grendels. Geeft null als de bank mag draaien, anders de reden -- als
   tekst, want de aanroeper zet hem in een fout die een mens leest. */
function waaromNiet({ env, echteRail }) {
  const e = env || {};
  if (e.RTG_SIMULATIEBANK !== '1')
    return 'De simulatiebank staat uit. Zet RTG_SIMULATIEBANK=1 in een omgeving die géén productie is.';
  if (e.NODE_ENV === 'production')
    return 'De simulatiebank draait nooit in productie, ook niet met RTG_SIMULATIEBANK=1. Deze rail maakt geld uit niets.';
  if (echteRail)
    return 'Er is een echte betaalprovider geconfigureerd (' + echteRail + '). ' +
      'De simulatiebank weigert die te overschaduwen; haal de sleutel weg of zet de simulatie uit.';
  return null;
}

module.exports = function simulatiebank({ crypto, env, echteRail }) {
  const belet = () => waaromNiet({ env, echteRail });
  const aan = () => belet() === null;

  function eis() {
    const reden = belet();
    if (reden) { const e = new Error(reden); e.code = 'SIMULATIEBANK_UIT'; throw e; }
  }

  /* Een boeking door de simulatiebank. Dezelfde vorm als de andere rails, zodat
     alles erboven -- de poort, de waarheidslaag, de webhook-afhandeling -- niet
     merkt met wie het praat. Dat is het hele punt: wat beslist of iets mag,
     draait ongewijzigd mee. */
  function maak(opdracht) {
    eis();
    const { bedrag, valuta = 'eur', referentie, idempotentieSleutel } = opdracht || {};
    const naam = scenarioVan(opdracht);
    const s = SCENARIOS[naam];
    return {
      id: 'sim_' + naam + '_' + crypto.randomBytes(6).toString('hex'),
      status: s.status,
      aanbieder: 'simulatie',
      simulatie: naam,
      /* Waarom deze afloop -- zonder dit regeltje is een rode simulatierun een
         raadsel in plaats van een bevinding. */
      waarom: s.wat + (opdracht && opdracht.simulatie ? ' (gevraagd)' : ' (uit de sleutel)'),
      bedrag: Math.round(bedrag),
      valuta,
      referentie: referentie || null,
      sleutel: idempotentieSleutel || null
    };
  }

  return { aan, belet, maak, scenarioVan, SCENARIOS };
};

module.exports.SCENARIOS = SCENARIOS;
module.exports.waaromNiet = waaromNiet;
module.exports.getal = getal;
