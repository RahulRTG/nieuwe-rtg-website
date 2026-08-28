/* Functiecatalogus, deel "festival": RTG Festival, langs zijn drie kanten.

   Zelfde bedoeling en zelfde regels als ./cat-domeinen.js -- zie de kop daar.
   Apart van ./cat-domeinen4.js omdat dat bestand over boeken, geld en de losse
   diensten gaat, en omdat het er met deze drie over de 10 kB ging.

   DRIE SCHAKELAARS EN GEEN EEN, en dat is de hele reden dat dit bestand bestaat.
   FESTIVAL.md zegt het zo: het terrein en de passen zijn van de ZAAK, de mens
   bij het hek is personeel, en de gast draagt de pas. Wie die drie onder een
   knop zet, dooft met een kassastoring ook het programma van een bezoeker. */
'use strict';

/* Dezelfde vier als in ./cat-domeinen4.js, en uit dezelfde bron: de gast hoort
   erbij omdat een festivalpas ook zonder lidmaatschap werkt. */
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

module.exports = [
  /* RTG FESTIVAL, drie kanten (FESTIVAL.md). De ORGANISATIE (terrein, poort,
     diensten, verkoop) is werk van de zaak en haar personeel; de GAST ziet zijn
     eigen pas, programma en groep. Ze staan los omdat ze los uitgaan: een
     kassastoring hoort het programma van een bezoeker niet te doven. */
  { id: 'fs-terrein', categorie: 'Festival', naam: 'Festival: terrein en poort', standaard: true,
    doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'Het terrein draaien: de poort en de scans, plekken en ruimtes, de dag en het podiumbeeld, en de uitzonderingen die aandacht vragen.',
    paden: ['/api/festival/scan', '/api/festival/poort', '/api/festival/plek', '/api/festival/ruimte',
      '/api/festival/terrein', '/api/festival/dag', '/api/festival/podiumbeeld', '/api/festival/bezetting',
      '/api/festival/uitzonderingen', '/api/festival/stand', '/api/festival/tijdlijn', '/api/festival/vooruit',
      '/api/festival/control', '/api/festival/controls', '/api/festival/geheugen', '/api/festival/gereed',
      '/api/festival/editie', '/api/festival/nieuw', '/api/festival/mijn',
      '/api/festival/norm', '/api/festival/normen'] },
  { id: 'fs-werk', categorie: 'Festival', naam: 'Festival: diensten, artiesten en verkoop', standaard: true,
    doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De organisatie eromheen: roosters en diensten, de rider en het bewijs van een artiest, boekingen, producten en de verkoop.',
    paden: ['/api/festival/dienst', '/api/festival/diensten', '/api/festival/rider', '/api/festival/bewijs',
      '/api/festival/boeking', '/api/festival/boekingen', '/api/festival/product', '/api/festival/producten',
      '/api/festival/verkoop', '/api/festival/partner'] },
  { id: 'fs-gast', categorie: 'Festival', naam: 'Festival: uw pas, programma en groep', standaard: true,
    doelgroepen: LEDEN_GAST,
    uitleg: 'De kant van de bezoeker: de eigen pas en edities, het programma met wat er getekend is, en een groep waarvan u zelf de code deelt.',
    paden: ['/api/festival/gast', '/api/festival/pas', '/api/festival/groep'] },];
