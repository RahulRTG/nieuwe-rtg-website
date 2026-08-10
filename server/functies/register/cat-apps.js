/* Functiecatalogus, deel "eigen apps" (server/functies/register): elke RTG-app
   als eigen schakelaar. De standaardindeling is bewust ALLES AAN voor IEDEREEN
   (premium, ook aan de onderkant); de boardroom stuurt per pas of doelgroep bij.
   Vaste veiligheidsregels (18+, verificatie, kinderbescherming) blijven altijd
   gelden, ook als een app aan staat. Verbatim afgesplitst uit register.js. */
const { LEDEN, LEDEN_RTF } = require('./doelgroepen');

module.exports = [
  { id: 'spellen', categorie: 'Eigen apps', naam: 'Spelen (spellen met vrienden)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.', paden: ['/api/member/spel', '/api/rtf/spel'] },
  { id: 'podium', categorie: 'Eigen apps', naam: 'RTG Podium (live, in zones)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Live uitzenden op één motor, in gescheiden werelden: Live (open voor leden), Creator (abonnement en cadeaus), ' +
      'Events (op een kaartje), Besloten (op uitnodiging) en 18+ (geverifieerd paspoort, eigen lijst en eigen wachtrij bij het kantoor). ' +
      'De 18+-eis geldt onverkort in die zone, en die zone heeft een eigen index: hij komt nergens anders voorbij.',
    paden: ['/api/podium'] },
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
  { id: 'mobiliteit', categorie: 'Eigen apps', naam: 'RTG Vervoer (Mobility OS)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier', 'personeel'],
    uitleg: 'De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel. WELK vervoer er in een stad bestaat staat los hiervan, in het vervoersmoduleregister (backoffice); deze schakelaar zet de hele app aan of uit.',
    paden: ['/api/mob', '/api/staff/mob', '/api/supplier/mob', '/api/office/mob'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter'] },
  { id: 'wbw', categorie: 'Eigen apps', naam: 'Wie betaalt wat', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Groepsuitgaven met een live balans en verrekenen via RTG Pay.', paden: ['/api/wbw'] },
  // Let op: NIET 'office' als id; die naam is al van de RTG-Backoffice hieronder.
  { id: 'kantoorpakket', categorie: 'Eigen apps', naam: 'RTG Office (kantoorpakket)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.', paden: ['/api/kantoorpakket'] },
  /* Het Ondernemers-OS. Stond met al zijn routes BUITEN de schakelkast -- niet
     door een besluit maar door optelling: de app groeide en stap twee (deze
     catalogus) bleef liggen. Vanuit de boardroom was hij daardoor niet uit te
     zetten en greep de storingswachter er nooit op in. Een pad volstaat: alles
     onder /api/onderneming hoort bij deze ene app, en dat is precies de reden
     dat het OS een OS heet en geen verzameling modules. */
  { id: 'ondernemersos', categorie: 'Eigen apps', naam: 'RTG Ondernemers-OS', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Van "ik denk erover na" tot een draaiend bedrijf in een scherm: de verkenning en de stress test, de rechtsvorm en het oprichtingsproject, het dagbeeld met debiteuren, btw, kas en capaciteit, de verkooppijplijn en het bestuur met de UBO-afleiding.',
    paden: ['/api/onderneming'] },
  { id: 'vonk', categorie: 'Eigen apps', naam: 'RTG Vonk (dating)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).', paden: ['/api/vonk'] },
  { id: 'mediaos', categorie: 'Eigen apps', naam: 'RTG Media (één mediawereld)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De laag die Klankwerk, Theater, Clips en Podium tot één wereld maakt: drie standen (muziek, kijk, flow) op dezelfde catalogus, één makersprofiel, één volgrelatie, één bibliotheek en de eigen smaakregelaars. Zet u hem uit, dan blijven de vier apps eronder gewoon werken.',
    paden: ['/api/mediaos'] },
  { id: 'clips', categorie: 'Eigen apps', naam: 'RTG Clips (korte video’s)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P. De feed is een eindige dagselectie, bewust zonder oneindige scroll.', paden: ['/api/clips'] },
  { id: 'oog', categorie: 'Eigen apps', naam: 'RTG Eye (werkvloer-camera)', standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister. Standaard voor genres met voertuigen of voorraad; de boardroom kan per genre bijsturen.',
    paden: ['/api/staff/oog', '/api/supplier/oog'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter', 'boerderij', 'retail', 'groothandel', 'hotel', 'activiteit', 'beveiliging'] },
  { id: 'ghost', categorie: 'Eigen apps', naam: 'Ghost Driver (simulatie)', standaard: true, doelgroepen: ['leverancier', 'intern'],
    uitleg: 'De voorspellende verkeers- en logistieksimulatie. Standaard alleen voor vervoerders; de verkeersleiding (kantoor) ziet altijd alles.',
    paden: ['/api/supplier/ghost', '/api/office/ghost'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'charter'] },

];
