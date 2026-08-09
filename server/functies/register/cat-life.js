/* Functiecatalogus, deel "RTG Life" (server/functies/register): de lagen die
   over het leven van het lid zelf gaan. Afgesplitst van ./cat-apps.js toen die
   in de waarschuwingsband onder de 10 kB kwam; zie docs/life.md voor de
   samenhang tussen deze lagen.

   Los schakelbaar en niet als een blok, want ze doen echt verschillende dingen:
   iemand die zijn medicatieschema wil en zijn stemming niet, hoort dat te kunnen
   kiezen. Alles staat standaard AAN -- deze lagen delen niets, ze staan hier om
   uit te KUNNEN, niet omdat ze riskant zijn.

   Twee deuren uit deze stapel staan met REDEN buiten de kast (zie de lijst in
   scripts/schakelbaar.js): /api/toestemming, omdat een knop die het intrekscherm
   dichtzet niet hoort te bestaan, en /api/toestel/meting, omdat die op een
   toestelsleutel binnenkomt en niet op een ledensessie. */
const { LEDEN } = require('./doelgroepen');

module.exports = [
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
  { id: 'tijdlijn', categorie: 'Eigen apps', naam: 'Tijdlijn (terugkijken)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Wat er in de tijd met u gebeurd is, gelezen uit de lagen die u al had. Legt zelf niets vast, dus uitzetten haalt geen gegevens weg.', paden: ['/api/tijdlijn'] },
  { id: 'voeding', categorie: 'Eigen apps', naam: 'Voeding (weekplan)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een weekplan voor wat u wilt eten. Er wordt niets geteld en er komt geen oordeel over wat u eet.', paden: ['/api/voeding'] },
  { id: 'noodkaart', categorie: 'Eigen apps', naam: 'Noodkaart', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een noodcontact en, als u dat wilt, uw allergenen en middelen. U toont hem zelf; niemand kan hem opvragen.', paden: ['/api/noodkaart'] },
  { id: 'verzorging', categorie: 'Eigen apps', naam: 'Verzorging (kapper, barbier, nagels)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De salonagenda vanaf de kant van het lid, op codenaam. Zorg en verzorging staan naast elkaar maar niet door elkaar: hier reist geen zorgprofiel mee.',
    paden: ['/api/verzorging'] }
];
