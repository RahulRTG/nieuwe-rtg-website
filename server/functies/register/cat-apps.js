/* Functiecatalogus, deel "eigen apps" (server/functies/register): elke RTG-app
   als eigen schakelaar. De standaardindeling is bewust ALLES AAN voor IEDEREEN
   (premium, ook aan de onderkant); de boardroom stuurt per pas of doelgroep bij.
   Vaste veiligheidsregels (18+, verificatie, kinderbescherming) blijven altijd
   gelden, ook als een app aan staat. Verbatim afgesplitst uit register.js. */
const { LEDEN, LEDEN_RTF, LEDEN_GAST } = require('./doelgroepen');

module.exports = [
  { id: 'spellen', categorie: 'Eigen apps', naam: 'Spelen (spellen met vrienden)', standaard: true, doelgroepen: LEDEN_RTF,
    // /api/projectie is het tv-scherm van een potje: knop dicht = scherm mee dicht
    uitleg: 'Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.', paden: ['/api/member/spel', '/api/rtf/spel', '/api/projectie'] },
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
  /* De drie werelden die dit jaar hun eigen laag kregen. Ze staan hier als
     EEN schakelaar per wereld en niet per stand: de standen delen een kern en
     een scherm, dus half uitzetten laat een app achter die niet weet wat hij
     nog kan. Wat eronder ligt (pay, wbw, mecenaat, de levensgraaf) heeft zijn
     eigen schakelaars en blijft die houden -- dit zet de WERELD uit, niet de
     domeinen. */
  { id: 'geldwereld', categorie: 'Eigen apps', naam: 'RTG Geld (financieel besturingssysteem)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het command center over alle gelddomeinen: hoe u ervoor staat, wat eraan komt, uw eigen beleidsregels met reserveringspotten, ' +
      'het actielog en de gegronde Rahul. Uit = het overzicht en de regels verdwijnen; betalen en verrekenen blijven werken via hun eigen schakelaars.',
    paden: ['/api/geld'] },
  { id: 'levenos', categorie: 'Eigen apps', naam: 'RTFoundation (levenslijn, mentor en levenspas)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De levenslijn met wat er speelt en wat eraan komt, de mentor die opent en nooit stuurt, en de levenspas: wie mag wat van u zien. ' +
      'De eerste twee lezen alleen; uitzetten verwijdert daar geen enkel gegeven. De levenspas beheert wel iets, namelijk uw TOESTEMMING -- ' +
      'uitzetten bevriest die dus: bestaande banden blijven staan zoals ze zijn, maar niemand kan er meer een leggen, verbreken of intrekken.',
    /* BEIDE INGANGEN, en dat is geen dubbeling. De levenspas werkt over twee
       sessiewerelden: /api/leven voor het lid en /api/rtf/leven voor het
       gezinsprofiel. Zonder de tweede zou uitzetten de ledenkant sluiten en de
       gezinskant open laten staan -- want dan valt die onder rtf-contacten, en
       de langste prefix wint. Half uit is erger dan aan: dan denkt de ene kant
       dat een band niet gelegd kan worden en legt de andere kant hem gewoon. */
    paden: ['/api/leven', '/api/rtf/leven'] },
];
