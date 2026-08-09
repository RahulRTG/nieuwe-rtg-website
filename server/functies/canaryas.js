/* DE CANARY-AS: wie valt er in een gefaseerde uitrol?

   De schakelkast kent aan en uit, en de assen daartussen (doelgroep, land,
   plaats, persoon, genre). Deze as is de fijnste: hij zegt niet OF een functie
   open is maar VOOR HOEVEEL van de mensen. De motor die een uitrol start,
   verbreedt en terugrolt staat in kern/command/canary.js; de verdeling staat
   HIER, bij de code die al beslist of een pad open is. Eén beslisser, geen
   tweede.

   DETERMINISTISCH OP DE PERSOON EN NIET PER VERZOEK GEDOBBELD. Zou je per
   verzoek gooien, dan wisselt dezelfde gebruiker binnen één scherm tussen de
   oude en de nieuwe stand -- en dan meet je bovendien niets, want elke fout
   valt in een andere groep dan de handeling ervoor.

   MET DE FUNCTIE-ID IN DE HASH, en dat is geen sier: zonder die id zit steeds
   DEZELFDE tien procent van de mensen in elke canary. Dan draagt een kleine
   groep alle risico van elke uitrol, en meet je bij de vierde canary vooral of
   die groep nog meedoet.

   EN ZONDER IDENTITEIT VALT NIEMAND ERIN. Anoniem verkeer heeft geen stabiele
   sleutel, dus zou het per verzoek wisselen. Dat betekent wel iets wat de
   bediener moet weten: een canary op een pad dat vooral anoniem wordt gebruikt
   bereikt bijna niemand, en meet dus ook bijna niets. Het scherm zegt dat. */
'use strict';

function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

function inCanary(id, canary, ctx) {
  const deel = Number(canary && canary.deel);
  if (!(deel > 0)) return false;
  if (deel >= 1) return true;
  const wie = ctx && ctx.persoon;
  if (!wie) return false;
  return hash32(id + ':' + wie) % 10000 < Math.round(deel * 10000);
}

module.exports = { inCanary, hash32 };
