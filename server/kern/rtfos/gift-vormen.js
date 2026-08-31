/* De woordenlijsten van de giftstand, apart omdat ./gift.js en
   ./gift-voornemen.js ze allebei nodig hebben.

   WAAROM EEN EIGEN BESTAND EN GEEN KOPIE. Toen het voornemen werd afgesplitst,
   was de snelste weg om VORMEN daar opnieuw op te schrijven. Drie woorden, wat
   kan er misgaan -- precies de redenering waar SEMANTIEK.json 78 gevallen van
   telt. Ze staan hier een keer.

   En het zijn LIJSTEN en geen instellingen: de drie giftvormen verschillen
   juridisch, en `onbekend` is met opzet iets anders dan `nee`. */
'use strict';

const STANDEN = ['dicht', 'open'];
const VORMEN = ['eenmalig', 'geoormerkt', 'periodiek'];
/* VIER STANDEN EN NIET DRIE. `aangevraagd` is er bij gekomen omdat het de
   werkelijke stand van de RTFoundation is (31 augustus 2026): nog geen ANBI,
   aanvraag loopt. Dat leest anders dan `nee` en anders dan `onbekend`, en de
   zin die de gever te zien krijgt hoort mee te bewegen met de knop.

   WAT `aangevraagd` NIET BELOOFT: dat deze gift later alsnog aftrekbaar wordt.
   Dat hangt af van de beschikking en de datum ervan, en dat is niets wat dit
   systeem kan vaststellen. Het zegt dus wat het weet -- de aanvraag loopt -- en
   niet wat het hoopt. */
const ANBI_STANDEN = ['onbekend', 'nee', 'aangevraagd', 'ja'];

/* De ondergrens van een periodieke gift, in jaren. Hij stond in ./donateur.js
   als los getal in een if; ./gift-periodiek.js had er bijna een tweede van
   gemaakt. Een ondergrens die op twee plekken staat, gaat een keer uiteen -- en
   dan zegt het ene scherm vijf jaar terwijl het andere er vier accepteert. */
const JAREN_MIN = 5;

/* WAT DE ANBI-STAND BETEKENT VOOR DE GEVER, in een zin. Hij stond op DRIE
   plekken -- het voornemen, het meerjarige plan en het vastleggen in
   ./donateur.js -- en dat is precies hoeveel plekken er straks iets anders
   zeggen zodra de beschikking er is. Hier staat hij een keer.

   `soort` kleurt de zin: een losse gift, een periodieke, of het moment waarop
   het kantoor de overeenkomst vastlegt. De boodschap eronder blijft dezelfde,
   en geen van de vier standen belooft meer dan er is. */
function anbiZin(stand, rsin, soort) {
  const wat = soort === 'periodiek' ? 'Een periodieke gift is daarom nu niet aftrekbaar'
    : 'Deze gift is daarom nu niet aftrekbaar';
  if (stand === 'ja') {
    return soort === 'periodiek'
      ? 'De RTFoundation is een ANBI, dus een vastgelegde periodieke gift is aftrekbaar zonder drempel.'
      : 'Je krijgt een giftbewijs; de RTFoundation is een ANBI (RSIN ' + rsin + ').';
  }
  if (stand === 'aangevraagd') {
    return 'De RTFoundation is op dit moment geen ANBI; de aanvraag loopt. ' + wat +
      ', en of dat verandert hangt af van de beschikking \u2014 dat zeggen wij niet toe.';
  }
  if (stand === 'nee') {
    return soort === 'periodiek'
      ? 'De RTFoundation is geen ANBI, dus deze gift is niet aftrekbaar. De afspraak zelf blijft gewoon gelden.'
      : 'Je krijgt een ontvangstbevestiging. Deze gift is niet aftrekbaar.';
  }
  return soort === 'periodiek'
    ? 'Of deze gift aftrekbaar is, ligt niet vast; wij zeggen daar niets over dat wij niet weten.'
    : 'Je krijgt een ontvangstbevestiging. Of deze gift aftrekbaar is, ligt niet vast; wij zeggen daar niets over dat wij niet weten.';
}

module.exports = { STANDEN, VORMEN, ANBI_STANDEN, JAREN_MIN, anbiZin };
