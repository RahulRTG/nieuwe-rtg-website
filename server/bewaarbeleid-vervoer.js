/* BEWAARTERMIJNEN, deel "vervoer": wat er na een reis van een mens overblijft.

   Afgesplitst van ./bewaarbeleid-operationeel.js omdat dat bestand op 48 bytes
   van de 10 kB van keuringsregel 13 stond, en de naad is echt: dit zijn de
   takken waarin een VERPLAATSING van een lid staat. NAVIGATIE.md par. 15.0
   beslist die per stroom, en een besluit over een stroom hoort op een plek
   waar de volgende stroom ernaast kan komen zonder de reden korter te
   schrijven.

   De motor en de drie regels die de rest verklaren staan in
   ./bewaartermijnen.js en gelden hier onverkort -- ook regel 2: de veger
   wist pas als de eigenaar hem op echt zet. */
'use strict';

module.exports = [
  /* Het OV (NAVIGATIE.md N17): het tarief heeft een afstand nodig en geen punt,
     dus na het rekenen staat er alleen halte naar halte, afstand en prijs
     (kern/ov/index.js). Die ritoverzichten blijven een jaar; de vergeetroute
     haalt ze eerder weg (kern/vergeten/eigen.js). `at` is het incheckmoment. */
  { tak: 'ovRitten', label: 'OV-ritten (halte naar halte, afstand, prijs)', dagen: 365, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'een jaar om een rit en zijn prijs na te kunnen gaan; geen punt, alleen haltes (N17)' }
];
