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
