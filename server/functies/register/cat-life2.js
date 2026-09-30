/* DE CATALOGUS, LIFE-DEEL TWEE -- uit ./cat-life.js geknipt op de 10 kB-grens
   (keuringsregel 13).

   HIJ STAAT IN ./index.js DIRECT NA cat-life EN DAT IS GEEN NETHEID. Bij twee
   functies met hetzelfde pad wint de EERSTE in FUNCTIES, en dat gebeurt vier
   keer in deze catalogus -- een afsplitsing mag de uitkomst dus niet
   verschuiven, alleen de plek van de tekst. Dezelfde afweging staat in de kop
   van ./index.js bij cat-genres en cat-command.
   ========================================================================== */
'use strict';

const { LEDEN, LEDEN_RTF, LEDEN_GAST } = require('./doelgroepen');

module.exports = [
  /* RUST HOORT BIJ DE BODEM (SAMENLEVING.md par. 2 en 6). De routes wonen in
     routes/veiligheid/rust.js en vielen onder `dom-veiligheid`, dat alleen de
     betalende passen verklaart -- terwijl de deur elk account doorlaat. Een eigen
     functie voor elke doelgroep met een account: de langste prefix wint
     (functies/toegangpad.js), dus de rest van /api/veiligheid blijft waar hij was. */
  { id: 'rust', categorie: 'Eigen apps', naam: 'Rust (Thuisrust)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Stilte die vanzelf eindigt, terwijl je kring erdoor komt. Hoe lang iemand hem gebruikt, meet RTG niet.',
    paden: ['/api/veiligheid/rust'] },
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
     besluit en geen voorzichtigheid: de besluiten B1 tot en met B7 zijn op
     27 september genomen maar nog niet allemaal uitgevoerd, waaronder de
     duurzame opslag van certificaten en de 18+-grens per handeling. Een deur naar een laag die certificaten
     over mensen uitgeeft, gaat pas open als een mens hem bewust opent. Beide
     paden in EEN functie (de les van `social`): de kantoordeur die een leerhuis
     opent en de ledendeur gaan samen aan of samen uit. */
  { id: 'leerhuis', categorie: 'Eigen apps', naam: 'RTG Academy (leren, bewijzen, certificeren)', standaard: false, doelgroepen: LEDEN,
    uitleg: 'Het leerhuis: van rol en officiele kennis via oefenen, simulatie, werk onder toezicht en ' +
      'een onafhankelijke beoordeling naar een certificaat, en terug via verbetervoorstellen uit de praktijk. ' +
      'Staat uit tot de besluiten in ACADEMY.md par. 5 zijn uitgevoerd. Een certificaat ' +
      'verleent geen bevoegdheid; het maakt iemand hoogstens geschikt volgens een beleid dat twee mensen ' +
      'hebben vastgesteld.',
    paden: ['/api/leerhuis', '/api/office/leerhuis'] }
];
