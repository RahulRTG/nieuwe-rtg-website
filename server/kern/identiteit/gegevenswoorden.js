/* ============================================================================
   DE DRIE WOORDENLIJSTEN VAN DE GEGEVENSKAART.

   Geknipt uit ./gegevenssoorten.js op de 10 kB-grens, en op een naad die er
   ook een is: dit zijn gesloten woordenlijsten die zelden veranderen, terwijl
   het register ernaast groeit met elk gegeven dat dit huis erbij krijgt.
   Dezelfde scheiding als sessievelden/sessiecontext, en om dezelfde reden.

   WAAR, HERKOMST en GROND betekenen met opzet niet hetzelfde: waar iets staat,
   hoe het bij ons kwam, en waarom het niet weg kan. Ze lopen uit elkaar -- uw
   geboortedatum staat in de kluis, is door u opgegeven, en kan later zijn
   overgenomen van een document dat een mens aftekende.
   ========================================================================== */
'use strict';

/* De vier plaatsen waar iets van u kan staan. `afgeleid` is er een: het staat
   NERGENS en wordt bij elke vraag opnieuw berekend, en dat is een geruststelling
   die je alleen kunt geven als je hem apart benoemt. */
const WAAR = {
  kluis: 'In de identiteitskluis: versleuteld, gebonden aan uw rij, en gescheiden van de rest van RTG.',
  dossier: 'In uw ledendossier: versleuteld, en alleen leesbaar met uw eigen sleutel.',
  operationeel: 'In de gewone gegevens van RTG, onder uw codenaam en niet onder uw naam.',
  afgeleid: 'Nergens. Dit wordt bij elke vraag opnieuw uitgerekend en niet bewaard.'
};

const HERKOMST = {
  opgegeven: 'U heeft dit zelf opgegeven.',
  gemeten: 'RTG heeft dit waargenomen terwijl u de app gebruikte.',
  overgenomen: 'Overgenomen van een document dat een medewerker van RTG heeft gezien.',
  afgeleid: 'Uitgerekend uit iets anders dat RTG al van u wist.'
};

/* DRIE REDENEN WAAROM IETS NIET WEG KAN, en ze zijn niet inwisselbaar. Ze
   stonden eerst alle drie als een kale `kan: false`, en dan komt uw naam op
   dezelfde lijst als uw facturen -- terwijl het ene meegaat als u uw account
   opheft en het andere zeven jaar blijft staan. Dat is het verschil waar deze
   kaart voor bestaat, dus het is een veld en geen zinsnede.

     account-nodig  het account kan niet zonder; het gaat mee als u opheft
     wettelijk      het blijft ook NA het opheffen staan, en dat is geen keuze
     beschermt-u    wissen zou het onbruikbaar maken als bescherming */
const GRONDEN = {
  'account-nodig': 'Dit kan niet los weg, maar het verdwijnt wel als u uw account opheft.',
  wettelijk: 'Dit blijft ook na het opheffen van uw account staan. Dat is een wettelijke plicht en geen keuze van RTG.',
  'beschermt-u': 'Dit kan niet weg omdat het er voor u is: kon u het wissen, dan kon iemand anders dat ook.'
};

module.exports = { WAAR, HERKOMST, GRONDEN };
