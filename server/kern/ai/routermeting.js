/* DE SCHADUWMETING VAN DE INTELLIGENTIEROUTER -- had een goedkopere techniek
   het ECHT gedekt? EXECUTIE.md blok 8.

   DRIE BESTANDEN EN DRIE VRAGEN, en ze veranderen om verschillende redenen:
   ./routeropslag.js weet WAAR de getallen blijven, ./routertellers.js WELKE
   getallen er zijn, en dit bestand WAT er is waargenomen. Het classificeren
   zelf blijft in ./router.js.

   EEN SPOOR IS GEEN DEKKING -- de reden dat deze laag bestaat. router.kies()
   herkent een techniek aan een REGEX OVER DE VRAAG. Dat is een vermoeden, en
   nagemeten iets heel anders dan wat er werkelijk uitkomt: over acht gewone
   vragen zei de router 6 keer "goedkoper mogelijk" terwijl de regellaag er 0
   beantwoordde, en de enige die zij wel beantwoordt ("wat moet ik inpakken")
   heette daar `ai`. Hij zit er dus in BEIDE richtingen naast.

   Dit getal bestaat om te besluiten of de goedkope laag vOOr het model mag
   komen; op het vermoeden zou dat betekenen dat een standaardzin goede
   modelantwoorden verdringt -- en dat merkt niemand, want er komt gewoon een
   antwoord. Daarom meet deze laag de UITKOMST: hij draait de goedkope motor
   echt.

   TWEE GETALLEN DIE NOOIT WORDEN OPGETELD: `spoor` (de regex wees een goedkopere
   techniek aan -- VERMOEDEN) en `bewezenGedekt` (de goedkope laag kon het echt
   -- GEMETEN). Het verschil staat in beide richtingen apart; zie
   ./routertellers.js.

   WAT DEZE METER NIET DEKT: `algoritme`, `optimalisatie` en `voorspelling`.
   kern/fiscaal/btwtelling.js is niet uit een kale zin aan te roepen -- hij wil
   een factuurregister en argumenten. Dat staat in `nietGemeten` van
   scripts/router.js met de reden, en niet als een nul. Zelfde vorm als
   HERSTELPROEF.json: wat de proef niet kon doen is een tekort van de proef en
   nooit een oordeel.

   DEZE LAAG BESLIST NIETS. Er is geen tak waarlangs zij een antwoord verandert.
   Zou die er zijn, dan is het geen schaduw meer. */
'use strict';

const router = require('./router');
const tellers = require('./routertellers');
const { cannedAnswer } = require('./demoantwoorden');

/* Een zin die met zekerheid GEEN antwoordbak raakt, zodat de standaardzin van
   de regellaag op te vragen is zonder hem over te typen. DIT IS DE ENE
   WAARHEID: de zes voorwaarden uit demoantwoorden.js hier herhalen zou twee
   lijsten maken die uit elkaar lopen. test/routermeting.test.js houdt vast dat
   deze zin niets raakt EN dat een gewone vraag er wel doorheen komt -- een
   instrument dat niet kan uitslaan is geen instrument. */
const RAAKT_NIETS = 'zzq-geen-enkele-antwoordbak-zzq';

/* Wat vanuit een KALE VRAAG te beproeven is. Alleen `regels`: cannedAnswer is
   een zuivere functie van (vraag, pas, reis). De rest wil een register, een lid
   of argumenten. */
const BEPROEFBAAR = Object.freeze({
  regels: (vraag, pas, reis) => cannedAnswer(vraag, pas, reis) !== cannedAnswer(RAAKT_NIETS, pas, reis)
});

/* EEN WEGING. Geeft terug wat er gemeten is; verandert niets.

   `pas` en `reis` gaan mee omdat cannedAnswer ervan afhangt -- zonder de pas
   meet je de u-vorm van een lid dat getutoyeerd wordt, en zonder de reis meet
   je dekking op een reis die dit lid niet heeft. Ze worden NIET bewaard. */
function meet(vraag, opties) {
  const o = opties || {};
  const keuze = router.kies(vraag);

  /* HEEFT DE GOEDKOPE LAAG HET GEDEKT? Twee wegen naar hetzelfde antwoord.

     De aanroeper mag het AANLEVEREN als hij het beter weet, en dat is geen gemak
     maar noodzaak: elke ingang heeft zijn eigen goedkope laag. /api/ai en
     /api/chat/send draaien op cannedAnswer, /api/fluister op kern/fluister --
     daar zou de proef hieronder een laag meten die in die route niet voorkomt.

     Levert hij niets, dan draait de proef -- ALTIJD, ook als de router `ai` zei,
     anders meet je je eigen aanname. "Wat moet ik inpakken" heet bij kies() `ai`
     terwijl de regellaag hem beantwoordt; gate je hierop, dan blijft juist die
     fout onzichtbaar. `gedekt` betekent langs beide wegen hetzelfde: de goedkope
     weg van DEZE ingang gaf het antwoord, dus er was geen model nodig. */
  let gedekt = typeof o.gedekt === 'boolean' ? o.gedekt : null;
  if (gedekt === null) {
    /* De proef mag het antwoord nooit in de weg lopen. Valt hij om, dan telt
       deze weging als niet-beproefd in plaats van als niet-gedekt: een tekort
       van de meter is geen oordeel over de motor. */
    try { gedekt = !!BEPROEFBAAR.regels(vraag, o.pas, o.reis || null); }
    catch (e) { gedekt = null; }
  }

  tellers.tel(o.ingang, { spoor: !!keuze.goedkoperMogelijk, gedekt,
    modelAntwoordde: o.modelAntwoordde });

  return { techniek: keuze.techniek, gevraagd: keuze.gevraagd, reden: keuze.reden,
    spoor: !!keuze.goedkoperMogelijk, bewezenGedekt: gedekt };
}

module.exports = { meet, RAAKT_NIETS,
  /* Doorgegeven zodat een aanroeper EEN ingang heeft en niet hoeft te weten dat
     de tellers een eigen bestand zijn. */
  stand: tellers.stand, onthoud: tellers.onthoud, nulstel: tellers.nulstel,
  INGANGEN: tellers.INGANGEN };
