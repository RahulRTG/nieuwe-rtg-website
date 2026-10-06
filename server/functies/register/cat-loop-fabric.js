/* De federatieve overdracht tussen brondomeinen. Dit is één schakelaar voor de
   vier generieke Loop Fabric-deuren; de WorkOS-bronmutatie blijft onder de
   bestaande `bedrijf`-schakelaar omdat WorkOS daar semantisch eigenaar van is.

   De doelgroepen zijn precies de actoren uit deze slice: een ingelogd lid kan
   vrijwillig melden en bevoegde WorkOS-actoren kunnen context terughalen. Een
   doelgroep geeft alleen bereik tot de route; bronbeleid, visibility, purpose
   en actuele WorkOS-bevoegdheid blijven daarna afzonderlijk beslissen. */
'use strict';

const { LEDEN, WERKOS } = require('./doelgroepen');

module.exports = [{
  id: 'loop-fabric',
  categorie: 'RTG-Backoffice',
  naam: 'Loop Fabric: overdracht en recall',
  standaard: true,
  doelgroepen: [...new Set([...LEDEN, ...WERKOS])],
  uitleg: 'Duurzame, beleidsgebonden overdracht van bronobservaties, wijzigingsbonnen en recall tussen RTG-domeinen. Uit = bronwaarheid blijft intact, maar nieuwe overdracht en recall pauzeren.',
  paden: ['/api/loop']
}];
