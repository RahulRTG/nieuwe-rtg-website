/* DE METER: hoe een score uit bronnen komt, op één plek.

   Twee plekken in dit OS geven een cijfer over een bedrijf: de kansverkenning
   (./kans.js, vóór de start) en de gezondheid (./dagbeeld.js, erna). Ze meten
   iets anders, maar ze moeten op precies dezelfde manier met ONTBREKENDE data
   omgaan -- en dat is nou net het stuk dat je twee keer net iets anders
   opschrijft. Vandaar één implementatie (lat-regel 4).

   De drie regels die hier wonen, en waarom:

   1. NIET GEMETEN IS NIET NUL. Een bron zonder data levert geen punten én telt
      niet mee in de noemer. Zou hij als nul meetellen, dan zakt elk cijfer
      zodra een bron ontbreekt, en leest een gebrek aan MÉTING als een gebrek
      aan kans of gezondheid. Dat zijn twee verschillende dingen.
   2. ONDER DE DREMPEL GEEN CIJFER. Dan `score: null` met de reden, en niet een
      getal met een slag om de arm eronder. Een getal met een voorbehoud wordt
      een getal zodra iemand het overtypt in een plan of een rapport.
   3. DE GRONDSLAG GAAT MEE. Wie het cijfer wil wantrouwen, moet kunnen zien
      welke bronnen eraan bijdroegen en welke niet, en waarom.

   Een bron is: { id, label, gemeten, punten, max, waarde, uitleg } of
   { id, label, gemeten:false, reden }. */
'use strict';

/* Rekent de score uit de gemeten bronnen. Geeft altijd dezelfde vorm, ook als
   er geen cijfer uit komt -- een aanroeper die soms wel en soms geen
   grondslag terugkrijgt, gaat die vroeg of laat niet meer uitlezen. */
function scoreUit(bronnen, minBronnen) {
  const alle = Array.isArray(bronnen) ? bronnen : [];
  const gemeten = alle.filter(b => b && b.gemeten);
  const grondslag = {
    gemeten: gemeten.length, totaal: alle.length,
    ontbreekt: alle.filter(b => b && !b.gemeten).map(b => ({ id: b.id, reden: b.reden }))
  };

  if (gemeten.length < minBronnen) {
    return {
      score: null, grondslag,
      uitleg: 'Er zijn ' + gemeten.length + ' van de ' + alle.length +
        ' bronnen meetbaar, en we geven pas een cijfer vanaf ' + minBronnen +
        '. Een score op minder zou eerder een indruk zijn dan een meting.'
    };
  }

  const behaald = gemeten.reduce((s, b) => s + b.punten, 0);
  const mogelijk = gemeten.reduce((s, b) => s + b.max, 0);
  return {
    score: Math.round((behaald / mogelijk) * 100),
    grondslag,
    voorbehoud: 'Dit cijfer rust op ' + gemeten.length + ' van de ' + alle.length +
      ' bronnen, en alleen op data binnen RTG.'
  };
}

module.exports = { scoreUit };
