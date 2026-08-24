/* De Residence, deelbestand "rahul": de directeur van het huis mengt zich
   af en toe in het gesprek met de vragen die niemand zelf durft te stellen.
   Twee dekken: "eerlijk" (de ongemakkelijke waarheid: exen, rode vlaggen,
   leugentjes) en "gewaagd" (intiemer; alleen voor een gekoppeld paar dat
   prive in de eigen suite zit -- samen wandelen is daar de toestemming).
   Smaakvol geformuleerd, nooit expliciet; en altijd een vraag, nooit een
   opdracht: wie niet wil antwoorden, schenkt gewoon nog eens in. */

const toeval = require('../../lib/toeval');   // keuzes op toeval: herhaalbaar met RTG_ZAAD
const EERLIJK = [
  'Waarom is uw laatste relatie echt uitgegaan? Het echte verhaal graag.',
  'Hoeveel relaties heeft u gehad, en welke telt u stiekem niet mee?',
  'Wat is uw grootste rode vlag, volgens uzelf?',
  'Waar liegt u weleens over op een eerste date?',
  'Wat zou uw ex over u zeggen als ik het morgen zou vragen?',
  'Op wie bent u het langst stiekem verliefd geweest?',
  'Wat is uw meest genante date-moment ooit?',
  'Welke gewoonte van u zou een partner langzaam gek maken?',
  'Wat mist u aan uw ex, en wat absoluut niet?',
  'Wat vond u echt van elkaars eerste indruk?',
  'Welke afknapper vergeeft u nooit, bij niemand?',
  'Wat is het eerste waar u naar kijkt bij een ander, eerlijk gezegd?'
];

const GEWAAGD = [
  'Wat is uw favoriete standje, en durft u dat hier hardop te zeggen?',
  'Wat is het spannendste dat u ooit met een date heeft gedaan?',
  'Wat zou u in de slaapkamer nog eens willen proberen?',
  'Waar bent u in de liefde het meest onzeker over?',
  'Wanneer voelde u zich voor het laatst echt begeerd?',
  'Wat is een compliment dat u nooit vergeten bent?',
  'Welke plek staat op uw lijstje die niet de slaapkamer is?',
  'Wat vindt u aantrekkelijker: iemand die neemt, of iemand die vraagt?',
  'Welk geheim over uzelf heeft u nog nooit op een date verteld?',
  'Wat maakt voor u het verschil tussen leuk en onweerstaanbaar?'
];

const INTRO = [
  'De directeur schuift even aan:',
  'De directeur, met een blik over zijn bril:',
  'Rahul komt langs, schenkt bij en vraagt:',
  'De directeur, alsof het niets is:'
];

function kies(niveau) {
  const dek = niveau === 'gewaagd' ? GEWAAGD : EERLIJK;
  return { intro: toeval.kies(INTRO), tekst: toeval.kies(dek) };
}

module.exports = { kies };
