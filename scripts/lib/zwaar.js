'use strict';

/* DE ZWARE TOETSEN: eigen job, en zonder dekking.

   Dit is NIET de isolatielijst. Die gaat over gedeelde staat -- bestanden die
   elkaar omgooien als ze naast elkaar draaien (scripts/lib/geisoleerd.js). Deze
   lijst gaat over KOSTEN, en dat is een andere reden die een andere lijst
   verdient. Een bestand hier mag gerust naast van alles draaien; hij is alleen
   zo duur dat hij in zijn eentje het kritieke pad van de hele keten bepaalt.

   HOE DUUR, GEMETEN. ast-grens.test.js doet onder dekking 1272 seconden: in zijn
   eentje 14% van al het toetswerk (9214s), tegen een p99 van 46s. In ronde
   33518796922 waren de scherven 1335 / 512 / 516 / 809 -- het kritieke pad stond
   op 1335s tegen een bodem van 1272s die door dit ene bestand werd gezet. Geen
   enkele verdeling komt daaronder; dat is geen scheduling-probleem.

   ZONDER DEKKING KOST HIJ 272 SECONDEN. Dat mag pas sinds het orakel
   (`heeftGrens_`) uit scripts/ast/regels.js naar de toets zelf is verhuisd:
   zolang die 46 regels in productiecode stonden, was deze toets de enige die ze
   kon dekken en moest hij dus onder dekking mee. Gemeten wat de verhuizing kost:
   regels.js stond zonder deze toets op 85,8% (279/325) en staat er nu op 96,7%
   (292/302) -- de noemer is kleiner en de dekking hoger.

   WAT EEN TOETS HIER NIET MAG WORDEN. Traag alleen is geen reden. Een bestand
   hoort hier pas als (1) hij aantoonbaar het kritieke pad zet en (2) zijn
   dekking ELDERS al gedekt is. Anders verplaats je geen kosten maar dekking, en
   dat is precies de ruil die deze keten niet mag maken.

   WAAROM DE LIJST HIER STAAT EN NIET IN DE RUNNER -- dezelfde reden als bij de
   ijkingen: hij wordt op twee plekken gebruikt (de runner slaat ze over met
   --zonder-zware, de keten geeft ze elk een job), en twee lijsten die hetzelfde
   horen te zeggen lopen uiteen. De ergste manier waarop: uit de scherven
   gehaald, geen eigen job gekregen, draait nergens meer, en niemand ziet het.
   test/delen.test.js legt de matrix in .github/workflows/ci.yml naast deze
   lijst. */

const ZWAAR = [
  'ast-grens.test.js'
];

/* Zoals de CI-matrix hem draagt: zonder .test.js, want dat leest in een jobnaam
   prettiger en het is de enige vorm die in twee bestanden hetzelfde moet zijn. */
const kort = (naam) => naam.replace(/\.test\.js$/, '');

function isZwaar(naam) {
  return ZWAAR.includes(String(naam || ''));
}

module.exports = { ZWAAR, KORT: ZWAAR.map(kort), kort, isZwaar };
