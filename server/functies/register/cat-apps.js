/* Functiecatalogus, deel "eigen apps" (server/functies/register): elke RTG-app
   als eigen schakelaar. De standaardindeling is bewust ALLES AAN voor IEDEREEN
   (premium, ook aan de onderkant); de boardroom stuurt per pas of doelgroep bij.
   Vaste veiligheidsregels (18+, verificatie, kinderbescherming) blijven altijd
   gelden, ook als een app aan staat. Verbatim afgesplitst uit register.js. */
const { LEDEN, LEDEN_RTF } = require('./doelgroepen');

module.exports = [
  { id: 'spellen', categorie: 'Eigen apps', naam: 'Spelen (spellen met vrienden)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.', paden: ['/api/member/spel', '/api/rtf/spel'] },
  { id: 'podium', categorie: 'Eigen apps', naam: 'RTG Podium (livestreams, 18+)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen livekanaal met chat, RTG Pay-cadeaus en abonnementen. De 18+/verificatie-eis blijft altijd gelden.', paden: ['/api/podium'] },
  { id: 'theater', categorie: 'Eigen apps', naam: 'RTG Theater (video)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De videobibliotheek op bioscoopniveau, inclusief het Thuisarchief (P2P).', paden: ['/api/theater'] },
  { id: 'flits', categorie: 'Eigen apps', naam: 'RTG Flits (rijscherm)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'personeel'],
    uitleg: 'Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik. Op de PDA standaard alleen voor rijdende genres.',
    paden: ['/api/flits', '/api/staff/flits'],
    // de PDA-kant: alleen genres die echt de weg op gaan (leden merken hier niets van)
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter', 'boerderij', 'groothandel'] },
  { id: 'ov', categorie: 'Eigen apps', naam: 'RTG OV (reizen)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier', 'personeel'],
    uitleg: 'Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar. De zaak-kant is alleen voor OV-zaken.',
    paden: ['/api/ov', '/api/staff/ov', '/api/supplier/ov'],
    alleenGenres: ['ov'] },
  { id: 'wbw', categorie: 'Eigen apps', naam: 'Wie betaalt wat', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Groepsuitgaven met een live balans en verrekenen via RTG Pay.', paden: ['/api/wbw'] },
  // Let op: NIET 'office' als id; die naam is al van de RTG-Backoffice hieronder.
  { id: 'kantoorpakket', categorie: 'Eigen apps', naam: 'RTG Office (kantoorpakket)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.', paden: ['/api/kantoorpakket'] },
  { id: 'vonk', categorie: 'Eigen apps', naam: 'RTG Vonk (dating)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).', paden: ['/api/vonk'] },
  { id: 'clips', categorie: 'Eigen apps', naam: 'RTG Clips (korte video’s)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P. De feed is een eindige dagselectie, bewust zonder oneindige scroll.', paden: ['/api/clips'] },
  { id: 'oog', categorie: 'Eigen apps', naam: 'RTG Eye (werkvloer-camera)', standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister. Standaard voor genres met voertuigen of voorraad; de boardroom kan per genre bijsturen.',
    paden: ['/api/staff/oog', '/api/supplier/oog'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter', 'boerderij', 'retail', 'groothandel', 'hotel', 'activiteit', 'beveiliging'] },
  { id: 'ghost', categorie: 'Eigen apps', naam: 'Ghost Driver (simulatie)', standaard: true, doelgroepen: ['leverancier', 'intern'],
    uitleg: 'De voorspellende verkeers- en logistieksimulatie. Standaard alleen voor vervoerders; de verkeersleiding (kantoor) ziet altijd alles.',
    paden: ['/api/supplier/ghost', '/api/office/ghost'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'charter'] }
];
