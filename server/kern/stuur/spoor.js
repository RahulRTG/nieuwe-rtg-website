/* HET STUURSPOOR -- welke fasen een menselijke vraag werkelijk doorliep.

   WAAROM DIT NIET DE ENVELOP IS, en dat is de eerste vraag die beantwoord moet
   worden. `kern/envelop.js` is gesloten op acht velden en zegt met opzet NOOIT
   WAT: wie, wanneer, waardoor, hoe gevoelig. Een fase-spoor zegt juist wél wat
   er gebeurde -- de resolver draaide, het plan is gewogen, er is niets
   uitgevoerd. Dat als negende veld in de envelop duwen is precies de botsing
   waar AFSPRAAK.md voor waarschuwt op de centrale naam van een laag. Dit spoor
   gaat dus ook nooit over de bus.

   HET OBSERVEERT EN BESLIST NIETS. Geen enkele functie hier geeft een oordeel
   terug waar de keten op kan afslaan, en `mark()` kan niet gooien -- de levering
   gaat voor (kern/envelop.js). Wie hier ooit een `return false` inbouwt waarmee
   een stap wordt tegengehouden, heeft van een meter een poort gemaakt en van de
   bewijslaag een tweede besluitlaag.

   VERZOEKGEBONDEN EN GEEN MODULETOESTAND. Twee gesprekken tegelijk zouden
   elkaars fasen opschrijven; dezelfde reden waarom de corpusrail zijn stapindex
   uit `messages` haalt. Elk spoor hoort bij één aanroep en gaat daarna weg.

   `NOT_RUN` IS EEN UITSLAG EN GEEN GAT. Staat het plafond op `tonen`, dan HOORT
   er niets uitgevoerd te worden -- dan is `uitvoering: NOT_RUN` de juiste
   uitkomst en geen halve proef. Dat onderscheid is de hele reden dat de fasen
   een eigen stand dragen in plaats van alleen aanwezig of afwezig te zijn.

   WAAR DE FASEN VALLEN, en dat is geen willekeur. INPUT_RECEIVED valt bij het
   MAKEN van het spoor: wie er een begint heeft per definitie invoer ontvangen,
   en een fase die de aanroeper zelf moet zetten kan hij vergeten. De rest valt
   waar hij ECHT gebeurt. MANDATE_EVALUATED bijvoorbeeld niet waar de trede
   wordt GEKOZEN maar waar de grendel van ./plafond.js de padenlijst WEEGT
   (./lus.js). Op de keuze markeren zou zeggen "er is een plafond gekozen", en
   dat is iets anders dan "het plafond heeft gewogen" -- precies het verschil
   dat een bewijsmerk moet dragen.

   CONTEXT_SANITIZED DRAAGT ALLE DRIE DE STANDEN, en dat is geen toeval maar
   precies waar ./menscontext.js voor gemaakt is: geen context meegestuurd ->
   OVERGESLAGEN, wel context maar er blijft niets bruikbaars over -> NOT_RUN,
   iets gesaneerd -> PASS. En PASS zegt alleen dat er GESANEERD is; of de
   resolver de context ook heeft GEBRUIKT staat apart op INTENT_RESOLVED
   (`contextGebruikt`). Die twee bij elkaar optellen zou een aangeboden context
   laten lezen als een gewogen context.

   HET SPOOR WORDT IN ./lus.js GEMAAKT en niet door de route. Een route hoort
   niets van sporen te weten: zij levert een vraag, wij weten welke fasen er
   bestaan. Een aanroeper die zijn eigen spoor meegeeft -- een proef die de id
   wil kennen -- wint.

   WAT HIJ MOGELIJK MAAKT. Zonder dit is niet te bewijzen DAT plan.js, gevolg.js
   en de mandaatlaag geraakt zijn -- alleen dat er een antwoord uitkwam. Zes van
   de tien mutatieproeven uit de opdracht luiden "stap weggehaald -> spoor
   incompleet"; zonder spoor is er niets om incompleet te zijn, en hebben die
   mutaties geen bewering om te laten zakken. */
'use strict';

const crypto = require('crypto');

/* De gesloten lijst fasen, in de volgorde waarin ze horen te vallen. Een vrij
   tekstveld levert fasenamen op die geen enkele afhandeling kent. */
const FASEN = Object.freeze([
  'INPUT_RECEIVED',
  'CONTEXT_SANITIZED',
  'INTENT_RESOLVED',
  'PLAN_COMPILED',
  'CONSEQUENCE_EVALUATED',
  'MANDATE_EVALUATED',
  'CAPABILITY_SELECTED',
  'PROJECTED',
  'EXECUTED'
]);

/* Drie standen, en `NOT_RUN` is er een volwaardige van. `OVERGESLAGEN` is
   bewust iets anders: die zegt dat de fase niet AAN DE BEURT kwam, terwijl
   NOT_RUN zegt dat hij aan de beurt was en terecht niets deed. */
const STANDEN = Object.freeze(['PASS', 'NOT_RUN', 'OVERGESLAGEN']);

function maakSpoor(opties) {
  const o = opties || {};
  const id = o.id || crypto.randomUUID();
  const begon = Date.now();
  const merken = [];

  /* INPUT_RECEIVED valt bij het MAKEN en niet bij de aanroeper: wie een spoor
     begint heeft per definitie invoer ontvangen. Een fase die de aanroeper zelf
     moet markeren, kan hij vergeten. De andere fasen vallen daar waar ze echt
     gebeuren -- MANDATE_EVALUATED bijvoorbeeld niet waar de trede wordt
     GEKOZEN maar waar de grendel de padenlijst WEEGT (./lus.js). */

  /* Kan niet gooien. Een onbekende fase wordt GEMELD en niet stil weggegooid:
     stilte hier zou betekenen dat een verkeerd gespelde fase als "niet
     doorlopen" leest, en dat is precies de valse nul waar dit huis op let. */
  function spoorMerk(fase, stand, detail) {
    try {
      const f = String(fase || '');
      const s = STANDEN.includes(stand) ? stand : 'PASS';
      merken.push({
        fase: FASEN.includes(f) ? f : ('ONBEKEND:' + f),
        stand: s, na: Date.now() - begon,
        detail: detail && typeof detail === 'object' ? detail : undefined
      });
    } catch (e) { /* een gemist merk is nooit een geweigerde stap */ }
    return undefined;   /* met opzet: er valt hier niets op af te slaan */
  }

  /* De uitslag. Elke fase uit de gesloten lijst komt erin voor -- ook de fasen
     die NIET gehaald zijn, want een ontbrekende regel leest als een fase die
     niemand heeft gemeten, en dat is iets anders dan een fase die niet liep. */
  function spoorstand() {
    const perFase = {};
    for (const f of FASEN) {
      const gevonden = merken.filter((m) => m.fase === f);
      perFase[f] = gevonden.length
        ? { stand: gevonden[gevonden.length - 1].stand, keer: gevonden.length }
        : { stand: 'OVERGESLAGEN', keer: 0 };
    }
    const onbekend = merken.filter((m) => m.fase.startsWith('ONBEKEND:'));
    return {
      id, duur: Date.now() - begon, perFase, merken: merken.slice(),
      onbekendeFasen: onbekend.map((m) => m.fase),
      /* Een korte samenvatting voor wie hem in een proef leest. `gehaald` telt
         alleen PASS: NOT_RUN is een goede uitkomst maar geen doorlopen fase, en
         die twee optellen zou een keten die niets deed even ver laten lijken
         als een die alles deed. */
      gehaald: FASEN.filter((f) => perFase[f].stand === 'PASS').length,
      nietGelopen: FASEN.filter((f) => perFase[f].stand === 'NOT_RUN').length,
      overgeslagen: FASEN.filter((f) => perFase[f].stand === 'OVERGESLAGEN').length
    };
  }

  spoorMerk('INPUT_RECEIVED', 'PASS', { tekens: String(o.vraag || '').length });
  return { id, mark: spoorMerk, uitslag: spoorstand, FASEN };
}

module.exports = { maakSpoor, FASEN, STANDEN };
