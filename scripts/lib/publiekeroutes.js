/* ============================================================================
   PUBLIEK MET REDEN -- dit bestand is de DOORGANG, niet de lijst.

   Er liepen twee lijsten van "welke route mag zonder poort, en waarom": deze,
   die uit scripts/check.js kwam omdat het mutatiecontractregister hem ook nodig
   had, en ./publiek.js, die uit dezelfde regel kwam omdat keuringsregel 28 en
   scripts/handlerwacht.js dezelfde vraag stelden. Twee lijsten van wat openbaar
   mag zijn lopen uiteen (LAT.md regel 4), en dan noemt de ene lijst een route
   publiek die op de andere een poort heeft -- precies wat beide kopjes
   voorspelden.

   De lijst woont daarom in ./publiek.js, en daar alleen. Deze naam blijft
   bestaan omdat het contractregister, de effectgenerator en MUTATIECONTRACT.md
   hem noemen; hij geeft door en houdt niets vast.
   ========================================================================== */
'use strict';

const { PUBLIEK } = require('./publiek');

module.exports = { PUBLIEK };
