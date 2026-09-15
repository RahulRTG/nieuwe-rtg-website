/* ============================================================================
   DE ZEVEN TREDEN -- de tabel, apart van de motor die hem afdwingt.

   Uit ./leerdossier.js geknipt toen die over de 10 kB-grens ging
   (keuringsregel 13), en op dezelfde naad als ./werkwoordlijst.js tegenover
   ./lus.js: hier staat WAT een trede is, daar staat wat ermee gebeurt. Die
   knip is hier meer dan een maatregel. De grond en de graad van een trede zijn
   het inhoudelijke deel -- wie iets aan dit dossier wil veranderen, verandert
   bijna altijd deze tabel en nooit de motor.

   DRIE EIGENSCHAPPEN DIE GEEN COMMENTAAR ZIJN MAAR CODE:

     wieSchrijft  `zelf`, `hetSysteem` of `eenAnder`. `noteer()` WEIGERT een
                  regel die door de verkeerde partij wordt aangeboden. Zonder
                  die grendel vult iedereen zijn eigen dossier met `onderwezen`
                  -- de enige trede die buiten Foundation iets betekent.
     graad        volgt uit `wieSchrijft` en is niet te kiezen. Wat de mens over
                  zichzelf zegt is `vermoed`, wat het systeem zag `gemeten`, wat
                  een ander bevestigde `bewezen`. Deze drie woorden zijn de
                  huisgraden uit BESTUUR.md en geen eigen schaal.
     eenmalig     staat op `gezien` en `begrepen`. Een tweede keer kijken is
                  geen tweede feit, en een dossier dat per opening een regel
                  bijschrijft is een kijklog geworden -- precies waar de eerste
                  trede voor waarschuwt.

   DE VOLGORDE IS EEN TRAP EN DE MENS STAAT ER NIET OP. `trap` dient om per
   ONDERWERP de hoogste te kunnen afleiden, en voor niets anders. Er wordt
   nergens over onderwerpen heen opgeteld, gemiddeld of gesorteerd: een getal
   over alle onderwerpen IS een niveau, hoe je het ook noemt (CARRIERE.md
   CAR-05, HDI.md, INT-04).
   ========================================================================== */
'use strict';

/* De zeven treden. `graad` volgt uit `wieSchrijft` en niet uit hoe belangrijk
   iets voelt: wie het opschrijft, bepaalt wat het waard is. */
const TREDEN = [
  { id: 'gezien',     trap: 1, naam: 'Gezien',     wieSchrijft: 'hetSysteem', graad: 'gemeten', eenmalig: true,
    grond: 'Deze mens heeft dit geopend. Meer niet -- en dat staat er zo bij, want een kijkcijfer als leerbewijs is de fout die dit dossier moet voorkomen.' },
  { id: 'gelezen',    trap: 2, naam: 'Uitgelezen', wieSchrijft: 'hetSysteem', graad: 'gemeten',
    grond: 'Tot het einde gekomen. Zegt iets over aandacht en niets over begrip.' },
  { id: 'begrepen',   trap: 3, naam: 'Begrepen',   wieSchrijft: 'zelf',       graad: 'vermoed', eenmalig: true,
    grond: 'Deze mens zegt dat hij het snapt. Met een teruguitleg erbij wordt de regel sterker, maar hij blijft van hemzelf.' },
  { id: 'geoefend',   trap: 4, naam: 'Geoefend',   wieSchrijft: 'hetSysteem', graad: 'gemeten',
    grond: 'Er is een oefening gedaan. Of hij goed ging staat er NIET bij: dat zou een cijfer op een mens zijn.' },
  { id: 'toegepast',  trap: 5, naam: 'Toegepast',  wieSchrijft: 'zelf',       graad: 'vermoed',
    grond: 'Deze mens zegt het buiten de app te hebben gebruikt. Niet na te gaan, en dat hoort het antwoord ook te zeggen.' },
  { id: 'gemaakt',    trap: 6, naam: 'Gemaakt',    wieSchrijft: 'hetSysteem', graad: 'gemeten',
    grond: 'Er is iets ontstaan dat er nog is. De regel verwijst ernaar; zonder verwijzing wordt hij geweigerd.' },
  { id: 'onderwezen', trap: 7, naam: 'Doorgegeven', wieSchrijft: 'eenAnder',  graad: 'bewezen',
    grond: 'Een ANDER heeft gezegd dat hij hierdoor geholpen is. De enige trede die deze mens niet zelf kan zetten, en daarmee de enige die buiten Foundation iets betekent.' }
];

module.exports = { TREDEN };
