/* Punten, deel "plafond": de grens op het VERZILVERDE tegoed. Afgesplitst uit
   ./punten.js: dat bestand gaat over verdienen en verzilveren, dit over een
   getal dat de BOARDROOM kiest (kern/bankregie/instellingen.js) -- een
   bestuursinstelling met een eigen levensloop en een eigen fail-closed regel.
   Per verzilvering gelezen, nooit eenmalig. */
'use strict';

module.exports = () => {
  /* Het plafond op het VERZILVERDE tegoed. Bewust anders dan het walletplafond
     en niet dezelfde constante: dit is een andere pot met een ander verhaal.
     Bij 1 punt per 10 euro en 100 punten per 10 euro tegoed hoort hier 50.000
     euro aan besteding bij -- ruim buiten bereik van een gewoon lid, en toch
     een grens, zodat de aanspraak begrensd is in plaats van open. Het BEDRAG is
     een keuze en geen wet; zie TOKEN.md par. 7. */
  /* HET PLAFOND KOMT VAN DE BOARDROOM, met dit getal als standaard tot die
     koppeling er is (kern/bankregie/instellingen.js). Het stond hier als vaste
     constante, en daarmee was de grond onder het besluit in
     kern/bevoegdheid/lijst.js alleen te verzetten door een programmeur -- terwijl
     het WEL het soort getal is dat een bestuurder hoort te kunnen kiezen.

     Per verzilvering gelezen en niet eenmalig: een plafond dat pas na een
     herstart meetelt, is een scherm dat een ander getal toont dan de grendel. */
  const STANDAARD_TEGOED_MAX = 50000;   // 500 euro aan verzilverd tegoed
  let plafondBron = () => STANDAARD_TEGOED_MAX;
  const puntenKoppelPlafond = fn => { if (typeof fn === 'function') plafondBron = fn; };
  /* Fail-closed, net als bij het walletplafond: valt de koppeling weg of levert
     hij onzin, dan is er GEEN ruimte in plaats van oneindig ruimte. */
  const tegoedMax = () => { const v = Math.round(Number(plafondBron())); return Number.isFinite(v) && v >= 0 ? v : 0; };
  return { puntenKoppelPlafond, tegoedMax, STANDAARD_TEGOED_MAX };
};
