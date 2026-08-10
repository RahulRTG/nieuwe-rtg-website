/* Marktplaats, deelbestand "openbaar": mag deze advertentie aan een
   WILLEKEURIGE bezoeker worden getoond?

   Puur, en met opzet zonder kijker: dit zijn de twee regels die voor iedereen
   gelden. Weg is weg, en te veel meldingen betekent verborgen tot beoordeling.
   Wat daarbovenop per kijker geldt (blokkades, je eigen advertenties) blijft
   in zichtbaar() in ../markt.js, want dat kan een leeslaag zonder sessie niet
   weten.

   Waarom dit een eigen bestand is en geen regel in markt.js: de Mall-vindlaag
   (kern/mall/aanbod.js) toont marktplaats-advertenties tussen het gewone
   aanbod en moet dus dezelfde regels toepassen. Een tweede kopie zou betekenen
   dat een gemelde advertentie uit de Marktplaats verdwijnt maar in de Mall
   blijft staan, en precies dat soort verschil ziet niemand aankomen
   (LAT-regel 4). */

// drie of meer meldingen: automatisch verborgen tot een mens ernaar kijkt
const MELD_DREMPEL = 3;

function advertentieOpenbaar(ad) {
  if (!ad || ad.verwijderd) return false;
  if ((ad.melders || []).length >= MELD_DREMPEL) return false;
  return true;
}

module.exports = { advertentieOpenbaar, MELD_DREMPEL };
