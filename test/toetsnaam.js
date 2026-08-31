/* ============================================================================
   WELKE TOETS IS ER AAN HET WOORD? -- de testidentiteit als runtime-context.

   WAAROM DIT ER IS

   Het routejournaal schrijft al `TOETS METHODE /pad <naam>` en het
   schermjournaal `SCHERM /pad <naam>`. Die naam kwam uit RTG_TOETS, en RTG_TOETS
   werd op EEN plek gezet: test/helper.js, op het moment dat die helper een
   kindserver startte. Dat dekt 868 van de 1433 toetsbestanden. De rest start
   zijn server op een andere manier (scripts/lib/proefserver.js, een eigen
   spawn) of draait helemaal in het proces -- en die schreven hun sporen weg
   als `onbekend`.

   Dat is precies het verschil tussen "deze toets raakt niets aan" en "niemand
   heeft gekeken", en die twee mogen nooit door elkaar lopen: een impactplan dat
   ze verwart, slaat een toets over omdat de meting ontbrak. De attributie hoort
   dus niet bij een helper te hangen maar bij de UITVOERING van een toets, en dat
   is deze module: hij wordt door scripts/test-runner.js en scripts/e2e.js
   voorgeladen in elk toetsproces, en van daaruit erft ELK kindproces -- welke
   helper het ook start -- de naam via de omgeving.

   EEN PLEK, EN DEZE. Zetten in helper.js blijft staan waar het staat; het is
   nu de terugval in plaats van de bron, en het levert dezelfde waarde. Twee
   plekken die hetzelfde zetten is LAT.md regel 4 -- maar hier zet de tweede
   plek niets wat de eerste niet al gezet heeft, en de volgorde is expliciet:
   wie RTG_TOETS al draagt, houdt hem.

   WAT DEZE MODULE NIET DOET. Hij verzint geen naam. Draait er iets dat geen
   toetsbestand is (de runner zelf, een kindserver), dan laat hij RTG_TOETS met
   rust -- een verzonnen dader is erger dan een lege.
   ========================================================================== */
'use strict';

const TOETSBESTAND = /(?:^|[\\/])([^\\/]+\.(?:test|e2e)\.js)$/;

/* argv[1] is in een toetsproces het toetsbestand zelf: `node --test` start elk
   bestand in een EIGEN proces. Daarom is dit ook meteen de juiste sleutel --
   niet de naam van de suite en niet de naam van de scherf. */
const m = TOETSBESTAND.exec(String(process.argv[1] || ''));
if (m && !process.env.RTG_TOETS) process.env.RTG_TOETS = m[1];

module.exports = { TOETSBESTAND };
