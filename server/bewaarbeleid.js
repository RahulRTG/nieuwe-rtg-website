/* HET BEWAARBELEID: welke tak, hoe lang, en waarom.

   Los van bewaartermijnen.js omdat dit een TABEL is en dat een motor. De
   motor (rapport, veeg, zonderBeleid) verandert bijna nooit; deze lijst groeit
   met elke nieuwe tak die een datum draagt. Ze in een bestand houden liet dat
   bestand over de 10 kB-grens groeien zodra er een tak bij kwam -- en dan is de
   verleiding om de REDEN korter te schrijven, terwijl juist die reden het punt
   van dit bestand is. De uitleg bij de drie regels die de rest verklaren staat
   in bewaartermijnen.js, waar de motor woont. */

const DAG = 86400000;
const JAAR = 365 * DAG;

/* vorm: hoe de tak in elkaar zit.
     lijst          -- een array van items
     mapVanLijsten  -- { sleutel: [ item, ... ] }, per lid
   datum: het veld met de tijdstempel (ISO of ms). */
const BELEID = [
  // --- wettelijk: NIET eerder weg, ook niet op verzoek ---
  { tak: 'invoices', label: 'facturen en bijdragen', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'lijst', datum: 'date', waarom: 'fiscale bewaarplicht (7 jaar, art. 52 AWR)' },
  { tak: 'klok', label: 'gewerkte uren (loonadministratie)', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'loonadministratie, fiscale bewaarplicht (7 jaar)' },
  /* HET GROOTBOEK VAN RTG PAY. Dezelfde grond als de facturen hierboven, en om
     dezelfde reden hier opgeschreven in plaats van in een test: een boeking is
     geld, en een grootboek waar met terugwerkende kracht regels uit verdwijnen
     bewijst niets meer -- ook niet ten gunste van het lid zelf.

     WAT ER BLIJFT STAAN IS EEN CODENAAM, en die leidt na een wisverzoek nergens
     meer naartoe: de gids is de laatste plek waar de sleutel aan de codenaam
     vastzit en die wordt geveegd (kern/vergeten.js, soort 3). Een pseudoniem
     zonder sleutel dus. Valt die afbeelding ooit ergens ANDERS te maken, dan
     vervalt deze grond -- test/vergeten.test.js zakt dan, want daar staat alleen
     de codenaam vrij en niet de sleutel of de echte naam.

     paySaldi staat hier met opzet NIET bij. Dat is geen gedateerde administratie
     maar de levende stand van een rekening; een veger heeft daar geen datum om
     op te werken, en een saldo met een termijn eronder is een boekhoudfout die
     wacht om te gebeuren. Hij verschijnt daarom op de eerlijke gatenlijst van
     zonderBeleid(), en dat is de juiste plek: een openstaand tegoed van een
     vertrokken lid is een vraag voor de eigenaar (afwikkelen of laten staan),
     geen vraag voor een opruimtaak. */
  { tak: 'payBoekingen', label: 'grootboek RTG Pay (boekingen)', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'lijst', datum: 'at', waarom: 'financiele administratie van het gesloten circuit; fiscale ' +
      'bewaarplicht (7 jaar, art. 52 AWR) gaat voor het wisrecht (AVG art. 17 lid 3 sub b). Wat blijft ' +
      'staan is een codenaam zonder sleutel: de gids die hem aan een mens verbond is geveegd' },
  /* De maandtermijnen van een lidmaatschap, met de 30%-split naar de
     RTFoundation. Dit is administratie: hij blijft staan als een lid zich laat
     verwijderen, want de fiscale bewaarplicht gaat voor het wisrecht (AVG art.
     17 lid 3 sub b). Dat het hier STAAT is het punt -- een uitzondering die
     alleen in een test als "mag blijven" is afgevinkt, is een uitzondering die
     niemand kan navertellen. */
  { tak: 'lidmaatschapBetalingen', label: 'lidmaatschapstermijnen', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'lijst', datum: 'at', waarom: 'fiscale bewaarplicht (7 jaar, art. 52 AWR); ook de foundation-split moet navolgbaar blijven' },

  // --- audit: lang genoeg om een incident te kunnen navertellen ---
  { tak: 'inzageLog', label: 'inzagejournaal identiteitskluis', dagen: 2 * JAAR / DAG, grond: 'audit',
    vorm: 'lijst', datum: 'at', waarom: 'een betrokkene moet kunnen navragen wie in zijn dossier keek' },
  { tak: 'securityLog', label: 'beveiligingslogboek', dagen: JAAR / DAG, grond: 'audit',
    vorm: 'lijst', datum: 'at', waarom: 'inbraakpogingen achteraf kunnen herleiden' },
  { tak: 'handelingLog', label: 'handelingsspoor (wie deed wat)', dagen: JAAR / DAG, grond: 'audit',
    vorm: 'lijst', datum: 'at', waarom: 'een incident moet na te vertellen zijn, en een betrokkene moet ' +
      'kunnen navragen wat er onder zijn sleutel is gedaan. Een jaar, net als het beveiligingslogboek: ' +
      'lang genoeg om iets te reconstrueren, kort genoeg om geen permanent dossier te worden. Het spoor ' +
      'bewaart de body NIET, alleen een hash ervan' },

  /* DE OPERATIONELE TAKKEN staan in ./bewaarbeleid-operationeel.js.

     Die knip is geen opmaak maar een echte naad, en hij loopt langs de reden
     waarom een tak er staat. Hierboven: wat de WET voorschrijft en wat een
     incident navertelbaar houdt -- twee groepen die zelden veranderen en die je
     niet aanpast zonder een jurist. Daaronder: wat een domein nodig heeft
     zolang het iets doet, en die lijst groeit met elk domein dat erbij komt.
     Precies die groei duwde dit bestand over de leesgrens toen de plaatslaag
     erbij kwam, en dat gebeurt bij het volgende domein weer. */
  ...require('./bewaarbeleid-operationeel')

];


module.exports = { BELEID, DAG, JAAR };
