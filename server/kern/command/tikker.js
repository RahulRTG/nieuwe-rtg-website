/* DE ACHTERGRONDTIK, EEN KEER.

   Drie modules onder deze map lieten zichzelf op een vaste tik opnieuw wegen --
   alarm.js elke minuut, canary.js en uitrolregie.js op hun eigen STANDAARD.tikMs
   -- en alle drie schreven ze daarvoor dezelfde vijf regels op: een setInterval,
   een try/catch eromheen, unref, en de timer terug. Dat is LAT.md regel 4 op zijn
   kleinst: drie plekken die dezelfde waarheid vasthouden, en de eerste die er
   iets aan verandert (een tik overslaan als de vorige nog loopt, een fout melden
   in plaats van slikken) laat de andere twee stil achter.

   TWEE DINGEN ZITTEN ER MET OPZET IN, en het zijn precies de twee die je bij het
   overtypen vergeet:

     DE LUS BREEKT NOOIT. Een uitzondering uit `weeg` mag de tikker niet
     stilzetten -- dan zou een enkele storing de bewaking voorgoed uitzetten, en
     dat is de stilste manier waarop een wachter verdwijnt.

     HIJ HOUDT HET PROCES NIET WAKKER. Zonder unref() blijft een node-proces
     draaien om een timer die niemand nodig heeft; dan sluit een toets of een
     script niet meer af, en dat kost een suite haar looptijd voordat iemand
     doorheeft waarom.

   EN HIJ VRAAGT ./tikkerstand.js OF HIJ MAG LOPEN. Die derde regel kwam uit
   main, op dezelfde dag dat dit bestand werd geknipt, en hij hoort hier net zo
   hard als de twee hierboven: in een MEETserver is een klok die uit zichzelf
   schrijft gif. De staatproef vraagt "wat heeft DEZE aanroep veranderd", en een
   tikker die binnen dat venster afgaat laat zijn schrijfactie toerekenen aan een
   willekeurige route -- op 2 september 2026 gingen twee werkende routes daardoor
   op 503. Het waarom staat voluit in de kop van ./tikkerstand.js.

   Dat die regel nu op EEN plek staat in plaats van drie is precies waar dit
   bestand voor bestaat: main schreef hem drie keer over, en dat is de tweede
   keer dat deze vijf regels in drieën veranderden.

   Wat hij NIET doet: de tik overslaan als de vorige nog loopt. Alle drie de
   wegingen zijn vandaag synchroon, dus dat geval bestaat niet -- en een
   voorziening voor een geval dat niet bestaat is een belofte zonder toets. */
'use strict';

const { tikkersUit } = require('./tikkerstand');

function maakTikker(weeg, ms) {
  return function tikker() {
    /* Alleen de LUS gaat uit; een weeg() die een route zelf aanroept blijft
       gewoon schrijven. NULL en niet een nep-timer: wie een tikker start hoort
       te kunnen zien dat er geen loopt. */
    if (tikkersUit()) return null;
    const t = setInterval(() => { try { weeg(); } catch (e) { /* nooit de lus breken */ } }, ms);
    if (t.unref) t.unref();
    return t;
  };
}

module.exports = { maakTikker };
