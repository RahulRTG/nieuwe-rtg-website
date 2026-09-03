/* ============================================================================
   DE BEGRIPPEN VAN DE APPBRUG -- de vertaaltabel, en wat er niet overbrugd wordt.

   Afgesplitst van ./appbrug.js, dat over de 10 KB ging (keuringsregel 13). De
   snede loopt op dezelfde lijn als bij kern/horeca/correctie.js: hier de
   VOCABULAIRE (welke ritstand hoort bij welke opdrachtstand, en wat er bewust
   buiten blijft), daar de MOTOR (het pad door de keten, de terugval van het
   vertrekpunt, het opvangen van een weigering).

   Waarom deze brug bestaat en welk besluit eronder ligt, staat in de kop van
   ./appbrug.js en in MAATSTAF.md par. 7.5.
   ========================================================================== */
'use strict';

/* De vertaaltabel, van de zes standen van kern/vervoer.js naar de tien van
   ./keten.js. Uitgeschreven en niet afgeleid: twee ketens die toevallig
   dezelfde woorden gebruiken, betekenen daarmee nog niet hetzelfde. */
const STAND_NAAR_OPDRACHT = {
  aangevraagd: 'aangevraagd',
  geaccepteerd: 'geaccepteerd',
  onderweg: 'onderweg',
  aangekomen: 'aangekomen',
  /* `aan-boord` heet in de opdrachtketen `ingestapt`. Hetzelfde moment, twee
     namen -- en NIET te verwarren met de opdrachtstand `rijdt`, die daarna
     komt. In `rides` is `rijdt` juist een oude naam vóór aan-boord
     (RIT_LEGACY), dus dit woord betekent in de twee werelden iets anders. */
  'aan-boord': 'ingestapt',
  afgerond: 'voltooid'
};

/* Wat er van een rit niet naar een opdracht kan. Staat hier zodat wie de brug
   opent, weet waarom zijn geval er niet doorheen komt. */
const NIET_OVERBRUGD = {
  'bestemming-als-tekst': 'Een app-rit draagt vaak alleen een tekst ("Haven"). ./plekken.js lost een zaak, een halte, een favoriet, de live locatie of een punt op de kaart op -- geen vrije tekst. Zo\'n rit krijgt geen opdracht, en zegt dat.',
  'terug-naar-de-rit': 'De brug schrijft nooit van opdracht naar rit. Twee lijsten die elkaar bijwerken, hebben geen waarheid meer.',
  'bestaande-ritten': 'Ritten van vóór deze brug hebben geen opdracht. Ze met terugwerkende kracht aanmaken zou opdrachten opleveren die nooit door een dispatcher zijn gezien.'
};


module.exports = { STAND_NAAR_OPDRACHT, NIET_OVERBRUGD };
