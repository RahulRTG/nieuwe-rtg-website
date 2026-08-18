/* BRONTEKST ONTDOEN VAN COMMENTAAR.

   Stond als losse functie in scripts/check.js en werd daar dertien keer
   gebruikt. Toen scripts/keuring.js hem ook nodig had, was de keuze: een kopie,
   of een plek. Een kopie is LAT.md regel 4 -- twee plekken die dezelfde waarheid
   vasthouden lopen uiteen, zeker als de tweede zich later "even" aanpast aan een
   nieuw geval.

   WAT HIJ WEL EN NIET DOET. Commentaar eruit, strings ERIN. Dat is bewust: elke
   keuring die hierop leunt zoekt naar wat de code aanroept, en dat staat in
   strings ('/api/bank/overzicht'). Wie strings ook weg wil hebben, heeft
   scripts/kruisscan.js nodig; wie de REGELNUMMERS heel wil houden heeft een
   derde vorm nodig (blokcommentaar wordt hier tot een spatie geplet). Die drie
   staan met reden uit elkaar; zie de kop van regel 29 in check.js.
*/
'use strict';

function zonderCommentaar(bron) {
  return String(bron).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/* EN DE TEKENREEKSEN, met de regelnummers heel.

   Dit stond als losse const in scripts/norm.js, waar hij drie keer nodig bleek
   te zijn: een skip-teller telde eerst commentaar mee, toen een tekenreeks, en
   toen zijn eigen ijking. De vierde keer kwam van de andere kant -- keuring
   25 in check.js las de regel `test('a', { skip: !process.env.DATABASE_URL })`
   uit een IJKSTRING van test/deltapoort.test.js en meldde dat bestand als een
   toets die zichzelf op Postgres poort. Dat is dezelfde fout in een andere
   teller, en de vierde keer is het geen incident meer maar een ontbrekende
   plek. Vandaar hier, naast zijn broer.

   HIJ VERVANGT MET SPATIES EN NIET MET NIETS, zodat regelnummers en
   regelindeling blijven kloppen. Keuringen die per REGEL oordelen (zoals 25)
   zouden anders regels aan elkaar plakken en over een grens heen lezen. */
function zonderTekst(bron) {
  return String(bron).replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g,
    m => m.replace(/[^\n]/g, ' '));
}

module.exports = { zonderCommentaar, zonderTekst };
