/* DE RECENTE LAGEN VAN DE IDEMPOTENTIEVERKLARINGEN, voor ./idemsleutels.js.

   Afgesplitst omdat ./idemsleutels.js na de samenvoeging van oktober 2026 over de
   omvanggrens van keuringsregel 13 ging. Dezelfde volgorde als daar stond: deze
   lijst komt als laatste, en Object.assign laat de laatste winnen. */
'use strict';

const SLEUTELS = Object.assign({},
  require('./idemsleutels-connection-final').SLEUTELS,
  require('./idemsleutels-leerhuis').SLEUTELS,
  require('./idemsleutels-loop-fabric').SLEUTELS,
  require('./idemsleutels-conciergelus').SLEUTELS,
  require('./idemsleutels-reisconcept').SLEUTELS,
  require('./idemsleutels-eigengezin').SLEUTELS,
  require('./idemsleutels-toestemming').SLEUTELS,
  require('./idemsleutels-reisteruggave').SLEUTELS,
  require('./idemsleutels-vrijgave').SLEUTELS,
  require('./idemsleutels-horecateruggave').SLEUTELS,
  require('./idemsleutels-leidingtermijn').SLEUTELS,
  require('./idemsleutels-reisgezelschap').SLEUTELS,
  // RTG Office in en uit: exporteer en importeer zijn met opzet een tweede handeling
  require('./idemsleutels-officeformaten').SLEUTELS,
  /* De TURN-uitgifte: elk antwoord is een vers geheim. Zie de kop daar. */
  require('./idemsleutels-rtc').SLEUTELS,
  /* Vier routes uit de samenvoeging van #542. Zie de kop daar. */
  require('./idemsleutels-samenvoeging').SLEUTELS,
  /* De Living Mall is een POST-projectie zonder mutatie. */
  require('./idemsleutels-mall-living').SLEUTELS,
  /* De apps van de Lifestyle Pass: gevonden door de voltooiproef van Reisboek. */
  require('./idemsleutels-rechterhand').SLEUTELS,
  /* RTG Veilig: een dubbeltik op de alarmknop gaf de kring twee alarmen. */
  require('./idemsleutels-veilig').SLEUTELS,
  /* De kluis: een dubbeltik op "document toevoegen" gaf twee documenten. */
  require('./idemsleutels-bestanden').SLEUTELS,
  /* Pulse, De Salon en RTMail: een dubbeltik gaf de ander alles twee keer. */
  require('./idemsleutels-tweedelid').SLEUTELS,
  /* WorkOS-zaakregie projecteert een bestaande eigen zaak en schrijft niet. */
  require('./idemsleutels-zaakregie').SLEUTELS,
  /* De expliciet bewuste tweede handelingen uit Deep Green ronde 3. */
  require('./idemsleutels-deepgreen-r3').SLEUTELS);

module.exports = { SLEUTELS };
