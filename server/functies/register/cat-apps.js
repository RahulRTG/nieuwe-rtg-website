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

  /* ---- de RTG Life-stapel (docs/life.md) ----
     Los schakelbaar en niet als een blok, want ze doen echt verschillende
     dingen: iemand die zijn medicatieschema wil en zijn stemming niet, hoort
     dat te kunnen kiezen. Alles staat standaard AAN.

     Twee deuren uit deze stapel staan met REDEN buiten de kast (zie de lijst in
     scripts/schakelbaar.js): /api/toestemming, omdat een knop die het
     intrekscherm dichtzet niet hoort te bestaan, en /api/toestel/meting, omdat
     die op een toestelsleutel binnenkomt en niet op een ledensessie. */
  { id: 'life', categorie: 'Eigen apps', naam: 'RTG Life (het ene scherm)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het overzichtsscherm en de dagcoach: ze lezen de lagen hieronder en leggen ze naast elkaar. Ze meten zelf niets en bezitten niets, dus uitzetten haalt geen gegevens weg.',
    paden: ['/api/life', '/api/dag'] },
  { id: 'doelen', categorie: 'Eigen apps', naam: 'Doelen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Waar u begon, waar u heen wilt en waarom; de mijlpalen worden afgeleid en niet bewaard.', paden: ['/api/doelen'] },
  { id: 'dagmetingen', categorie: 'Eigen apps', naam: 'Dagmetingen en toestellen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Slaap, beweging, water en gewicht, zelf ingevuld of door een gekoppeld toestel weggeschreven. Zet u dit uit, dan kunt u ook geen nieuw toestel meer koppelen.',
    paden: ['/api/metingen', '/api/toestellen'] },
  { id: 'gemoed', categorie: 'Eigen apps', naam: 'Dagcheck-in (hoe zit u erbij)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een tik per dag, met de keuze om er iets bij te schrijven. Wat u schrijft gaat door de grens uit kern/zorgniveau.js.', paden: ['/api/gemoed'] },
  { id: 'gewoonten', categorie: 'Eigen apps', naam: 'Gewoonten', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem zelf aanzet.', paden: ['/api/gewoonten'] },
  { id: 'gedachten', categorie: 'Eigen apps', naam: 'Gedachtenboek', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Opschrijven voor uzelf. Er leest geen model mee en er wordt niets samengevat.', paden: ['/api/gedachten'] },
  { id: 'medicijnen', categorie: 'Eigen apps', naam: 'Medicijnen (eigen schema)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Uw eigen medicatieschema en voorraad. RTG bepaalt nooit een dosering en controleert geen combinaties.', paden: ['/api/medicatie'] },
  { id: 'training', categorie: 'Eigen apps', naam: 'Training (eigen schema)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Uw eigen trainingsschema en wat u ervan deed. RTG schrijft geen training voor en rekent geen belasting uit.', paden: ['/api/training'] },
  { id: 'voeding', categorie: 'Eigen apps', naam: 'Voeding (weekplan)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een weekplan voor wat u wilt eten. Er wordt niets geteld en er komt geen oordeel over wat u eet.', paden: ['/api/voeding'] },
  { id: 'noodkaart', categorie: 'Eigen apps', naam: 'Noodkaart', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een noodcontact en, als u dat wilt, uw allergenen en middelen. U toont hem zelf; niemand kan hem opvragen.', paden: ['/api/noodkaart'] },
  { id: 'verzorging', categorie: 'Eigen apps', naam: 'Verzorging (kapper, barbier, nagels)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De salonagenda vanaf de kant van het lid, op codenaam. Zorg en verzorging staan naast elkaar maar niet door elkaar: hier reist geen zorgprofiel mee.',
    paden: ['/api/verzorging'] }
];
