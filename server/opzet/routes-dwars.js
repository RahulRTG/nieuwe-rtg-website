/* ============================================================================
   DE DWARSE ROUTERS: alles wat aan meer dan een domein hangt.

   WAAROM DIT EEN EIGEN BESTAND IS

   Hetzelfde als bij ./aanbouw.js, en om dezelfde reden: routes.js ging met
   10859 byte over de eigen 10 kB-grens (scripts/keuring.js, regel 13). Niet
   omdat er iets ingewikkelds bij kwam, maar omdat de lijst met los opgehangen
   routers blijft groeien -- elk nieuw onderwerp dat niet in een domein past
   komt hier terecht.

   WAAROM PRECIES DIT BLOK. Van alles in routes.js is dit het enige stuk dat
   niets anders aanraakt dan `grens`. De regels erboven kiezen de domeinen en
   bouwen de doorkijk; de regels eronder (werving) schrijven terug IN de kern
   met Object.assign. Dit blok hangt alleen routers op achter de poort van hun
   eigen naam. Dat maakte het als geheel te verplaatsen, zonder een tweede
   lijst met doorgegeven namen -- de dubbele boekhouding waar dit huis zich
   vaker op heeft gebrand.

   Nagerekend en niet gegokt: het blok is door scripts/lib/bron.js gehaald en
   daarna op vrije namen bekeken. Wat overbleef was `require` en `grens`. Het
   woord "kern" staat er vijf keer in, alle vijf in een zin die uitlegt waar de
   kern al vandaan komt -- geen daarvan is een verwijzing.

   DE VOLGORDE IS GEDRAG, GEEN SMAAK -- net als in routes.js. De regels zijn
   letterlijk overgenomen, in dezelfde volgorde, met hun eigen uitleg erbij.
   ========================================================================== */
'use strict';

module.exports = function hangDwarseRoutersOp(grens) {
  require('../routes/sleutelwoorden')(grens('sleutelwoorden'));
  require('../routes/agenda')(grens('agenda'));
  require('../routes/notities')(grens('notities'));
  require('../routes/bestanden')(grens('bestanden'));
  require('../routes/meet')(grens('meet'));
  require('../routes/galerij')(grens('galerij'));
  require('../routes/klok')(grens('klok'));
  require('../routes/vertaal')(grens('vertaal'));
  require('../routes/memo')(grens('memo'));
  require('../routes/boeken')(grens('boeken'));
  require('../routes/onderwijs')(grens('onderwijs'));
  require('../routes/leerstof')(grens('leerstof'));
  require('../routes/bijles')(grens('bijles'));
  require('../routes/facturatie')(grens('facturatie'));
  /* RTG Kostprijs (kern/kosten/): wat kost elke gebruiker, en wie betaalt dat.
     Naast de facturatie, want het eindigt op dezelfde factuur en niet op een
     tweede geldstroom. */
  require('../routes/kosten')(grens('kosten'));
  /* De kantoorkant van dezelfde laag, in een eigen bestand omdat het samen door
     de omvangsgrens ging; de naad ligt op de LEZER (een gebruiker ziet zichzelf,
     het kantoor ziet iedereen en beslist). Zelfde domeingrens: een tweede lezer
     van dezelfde kern is geen tweede domein. */
  require('../routes/kosten-kantoor')(grens('kosten'));
  /* De economielaag eronder (kern/economie/, ECONOMIE.md): de vier werelden en
     de firewall ertussen. Na de kosten, want de werelden-route toont de
     verdeling van de nota's die daar wordt gerekend. */
  require('../routes/economie')(grens('economie'));
  require('../routes/rtmail')(grens('rtmail'));
  require('../routes/rtmail-vak')(grens('rtmail-vak'));
  require('../routes/rtmail-schrijf')(grens('rtmail-schrijf'));
  require('../routes/rtmail-bestuur')(grens('rtmail-bestuur'));
  require('../routes/rtmail-team')(grens('rtmail-team'));
  require('../routes/rtgone')(grens('rtgone'));
  require('../routes/werkmail')(grens('werkmail'));
  require('../routes/mailpost')(grens('mailpost'));
  require('../routes/payroll')(grens('payroll'));
  require('../routes/huis')(grens('huis'));
  require('../routes/muziek')(grens('muziek'));
  require('../routes/muziek-samen')(grens('muziek-samen'));
  require('../routes/atelierweb')(grens('atelierweb'));
  require('../routes/webmaker')(grens('webmaker'));
  require('../routes/webbrowser')(grens('webbrowser'));
  require('../routes/zaakweb')(grens('zaakweb'));
  require('../routes/webmeting')(grens('webmeting'));
  require('../routes/webmerk')(grens('webmerk'));
  require('../routes/journalistiek')(grens('journalistiek'));
  require('../routes/markt')(grens('markt'));
  require('../routes/borden')(grens('borden'));
  require('../routes/spellen')(grens('spellen'));
  require('../routes/magnaatwereld')(grens('magnaatwereld'));
  require('../routes/leren')(grens('leren'));
  /* Payroll OS: de routes van de nieuwe loonlaag (kern/payroll/), naast de
     oude payroll-routes en met dezelfde poorten. */
  require('../routes/payroll-os')(grens('payroll-os'));
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
};
