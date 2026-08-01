/* DE SERVICEKOSTEN VOOR NIET-LEDEN, OP EEN PLEK.

   Een gratis account betaalt per etensbestelling een vast bedrag ex btw; leden
   betalen dit nooit. Dat is een prijsafspraak, en die hoorde nergens twee keer
   te staan. Hij stond op vier plekken:

   - kern/lidacties/bestellen.js  (afhalen en aan tafel)
   - routes/member/kopen/bezorg.js (thuisbezorgd)
   - in allebei nog eens het bedrag INCLUSIEF btw, met de hand uitgerekend
   - en als tekst in de app: "(incl. EUR 2,50 servicekosten ex btw)"

   Twee bestelwegen die hetzelfde tarief los van elkaar intikken lopen uiteen
   zodra iemand er een aanpast, en dan betaalt dezelfde gast een ander bedrag
   afhankelijk van of hij afhaalt of laat bezorgen. Dat is precies de klasse uit
   LAT.md regel 4.

   Hoe dit boven water kwam is het vermelden waard: niet door lezen, maar
   doordat een MUTATIE niet beet. Ik had het tarief in bestellen.js op 3,50 gezet
   en test/gastregels.test.js bleef groen -- want die toets loopt over
   /api/bezorg/bestel, en dat is de andere kopie. Zonder die controle had ik een
   reparatie ingeleverd voor code die de toets niet eens aanraakt.

   Het bedrag inclusief btw wordt hier GEREKEND en niet ingetikt: twee getallen
   die hetzelfde horen te zeggen zijn ook twee plekken. */
'use strict';

const EX_BTW = 2.5;     // euro, exclusief btw, per bestelling
const BTW_PCT = 21;

/* Geeft null voor iedereen die geen servicekosten betaalt. Null en niet 0: een
   lid krijgt geen regel van nul euro op zijn bon, hij krijgt er geen. De
   bestelroutes zetten het veld alleen als er echt iets te melden is. */
function servicekostenVoor(tier) {
  if (tier !== 'guest') return null;
  return { exBtw: EX_BTW, btwPct: BTW_PCT, inBtw: Math.round(EX_BTW * (1 + BTW_PCT / 100) * 100) / 100 };
}

module.exports = { servicekostenVoor, EX_BTW, BTW_PCT };
