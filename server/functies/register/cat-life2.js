/* DE CATALOGUS, LIFE-DEEL TWEE -- uit ./cat-life.js geknipt op de 10 kB-grens
   (keuringsregel 13).

   HIJ STAAT IN ./index.js DIRECT NA cat-life EN DAT IS GEEN NETHEID. Bij twee
   functies met hetzelfde pad wint de EERSTE in FUNCTIES, en dat gebeurt vier
   keer in deze catalogus -- een afsplitsing mag de uitkomst dus niet
   verschuiven, alleen de plek van de tekst. Dezelfde afweging staat in de kop
   van ./index.js bij cat-genres en cat-command.
   ========================================================================== */
'use strict';

const { LEDEN, LEDEN_RTF } = require('./doelgroepen');

module.exports = [
  /* Foundation Connect (kern/connect/): de ontdeklus. LEDEN_RTF om dezelfde
     reden als `knelpunt` hierboven -- er is EEN motor met twee deuren, zodat een
     gezinsprofiel nooit een ander antwoord kan krijgen dan een lid.

     ALLE PADEN VAN DE FUNCTIE IN EEN REGEL, en dat is de les van de `social`-
     fout: staat de gezinsdeur niet in `paden`, dan valt hij onder een andere
     functie en zet het bord de ene helft uit en de andere niet. De voorvoegsels
     dekken alle tweeentwintig routes; de router registreert ze stuk voor stuk
     letterlijk (routes/connect.js). */
  { id: 'connect', categorie: 'Eigen apps', naam: 'Ontdekken (leren, doen, doorgeven)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'Een ontdeklijst die wordt samengesteld uit lagen die RTG al heeft: leerstof en wat er in de ' +
      'buurt gebeurt. Bezit zelf geen inhoud. Er wordt niets gerangschikt en er staat geen cijfer op iets ' +
      'of iemand; elke plek zegt welke motor hem koos en waarom. Wat u hebt gezien, begrepen, geoefend, ' +
      'gemaakt of doorgegeven blijft als lijst staan -- nooit als niveau, en nooit vergeleken met iemand ' +
      'anders. Uitzetten haalt uw leerdossier niet weg; het sluit alleen de ingang.',
    paden: ['/api/connect', '/api/rtf/connect'] },
  /* RTG Academy, het leerhuis (ACADEMY.md). STANDAARD UIT, en dat is hier een
     besluit en geen voorzichtigheid: zes besluiten (B1 tot en met B6) staan
     open, waaronder of een domeinpoort de geschiktheid als feit leest en of de
     18+-grens voor certificaten geldt. Een deur naar een laag die certificaten
     over mensen uitgeeft, gaat pas open als een mens hem bewust opent. Beide
     paden in EEN functie (de les van `social`): de kantoordeur die een leerhuis
     opent en de ledendeur gaan samen aan of samen uit. */
  { id: 'leerhuis', categorie: 'Eigen apps', naam: 'RTG Academy (leren, bewijzen, certificeren)', standaard: false, doelgroepen: LEDEN,
    uitleg: 'Het leerhuis: van rol en officiele kennis via oefenen, simulatie, werk onder toezicht en ' +
      'een onafhankelijke beoordeling naar een certificaat, en terug via verbetervoorstellen uit de praktijk. ' +
      'Staat uit tot de eigenaar de open besluiten in ACADEMY.md par. 5 heeft genomen. Een certificaat ' +
      'verleent geen bevoegdheid; het maakt iemand hoogstens geschikt volgens een beleid dat twee mensen ' +
      'hebben vastgesteld.',
    paden: ['/api/leerhuis', '/api/office/leerhuis'] }
];
