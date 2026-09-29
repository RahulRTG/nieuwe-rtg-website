/* Het tweede fysieke deel van de dwarse routerlijst. De oproep staat op de
   oorspronkelijke plek, zodat de volgorde over beide bestanden gedrag blijft. */
'use strict';

module.exports = function hangDwarseRoutersVervolgOp(grens) {
  /* De RTF-bieb-routes (de kern staat al bij de Mall-bibliotheken). */
  require('../routes/rtfbieb')(grens('rtfbieb'));
  /* Publieke FOUNDATION-aanmelding en het menselijke controlebesluit delen de
     Foundation-, mail- en Boardroomlaag en horen daarom bij de dwarse routes. */
  require('../routes/foundationregistratie')(grens('foundationregistratie'));
  /* Dezelfde leermotor als RTG School, achter de drie leerlingpassen. */
  require('../routes/rtfleerling')(grens('rtfleerling'));
  /* De Geloof & Wijsheid-Bibliotheek-routes (kern staat al hierboven). */
  require('../routes/geloofbieb')(grens('geloofbieb'));
  /* Het RTF-kantoor, Clubs & steden en het Onderzoekslab (kern staat al hierboven). */
  require('../routes/rtfkantoor')(grens('rtfkantoor'));
  /* Het RTF Living Lab: het onderzoeksplatform per stad. Eigen domein en niet
     bij rtfkantoor ingehangen, want de bewonerskant heeft publieke deuren met
     een eigen rem -- dat is een andere poort dan de kantoorinlog daar. */
  require('../routes/livinglab')(grens('livinglab'));
  /* De twee werkplekken RTG en RTF (kern staat al hierboven). */
  require('../routes/werkplek')(grens('werkplek'));
  /* Het RTG Werk OS: de werkplek van een hele organisatie (server/bedrijf/).
     Staat naast werkplek.js en niet erin: dat is het beeld van RTG en RTF zelf,
     dit is een werkruimte die ook aan een andere organisatie te geven is. */
  require('../routes/bedrijf')(grens('bedrijf'));
  /* De Tenant Control Plane (kern/tenant/): welke org IS de klant, welk merk
     draagt zij, en hoe komt een groep van haar identiteitsprovider terecht bij
     een rol in haar werkruimte. Staat NA bedrijf, want de runtime-routes
     hergebruiken de twee poorten die de werkruimte al had (beheer-token en
     lid-token) in plaats van er een derde bij te bedenken. */
  require('../routes/tenant')(grens('tenant'));
  require('../routes/labfonds')(grens('labfonds'));
  require('../routes/aanmeldingen')(grens('aanmeldingen'));
  require('../routes/ledenregister')(grens('ledenregister'));
  /* Het doorgeefjournaal: een leesbare regel per verzoek en per uitgaand
     bericht. Naast het ledenregister, want het staat achter dezelfde poort en
     om dezelfde reden -- meekijken met het verkeer hoort een naam te hebben. */
  require('../routes/journaal')(grens('journaal'));
  /* De ledenbalie: de afdeling die een lid mag helpen met zijn abo, zijn
     wachtwoord of een klacht. Achter een eigen zetel, niet achter de gedeelde
     kantoorcode -- iemands account aanraken hoort een naam te hebben. */
  require('../routes/ledenbalie')(grens('ledenbalie'));
  /* RTG Service: de gedeelde envelop over de vier bestaande hulplijnen. De kant
     van de melder en de kant van het kantoor staan in twee bestanden, met de
     naad op de LEZER -- een lid ziet zijn eigen zaken, het kantoor ziet de
     wachtrij en beslist. Zelfde domeingrens: een tweede lezer van dezelfde kern
     is geen tweede domein. Na de ledenbalie, want de kantoorkant hangt aan
     dezelfde zetel. */
  require('../routes/service')(grens('service'));
  require('../routes/service-kantoor')(grens('service'));
  /* En de kant van een ZAAK. Een leverancier, restaurant, vervoerder of gemeente
     kon RTG nergens een hulpvraag stellen -- er was wel een zin over een vaste
     contactpersoon, maar geen kanaal. Derde bestand om dezelfde reden als de
     tweede: de naad ligt op de LEZER, en dit is een derde poort (supplierAuth)
     en geen derde domein. */
  require('../routes/service-zaak')(grens('service'));
};
