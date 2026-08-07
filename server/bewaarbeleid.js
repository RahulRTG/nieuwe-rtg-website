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

  // --- operationeel: weg zodra het zijn doel heeft gediend ---
  { tak: 'applications', label: 'sollicitaties', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'een jaar na indienen; daarna heeft niemand er nog iets aan' },
  { tak: 'guestChats', label: 'gastgesprekken met een zaak', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'servicegesprek over een bezoek van vorig jaar is voorbij' },
  { tak: 'memberChats', label: 'gesprekken tussen leden', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'persoonlijke berichten, maar niet eindeloos' },
  { tak: 'notifications', label: 'meldingen', dagen: 180, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'een melding van een half jaar oud is geen melding meer' },
  { tak: 'reports', label: 'misbruikmeldingen', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'herhaling moet zichtbaar blijven, maar niet voor altijd' },
  { tak: 'paspoortLog', label: 'paspoortcontroles', dagen: JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'aantonen dat een leeftijdscheck is gedaan' },
  /* Stadsweefsel: gebeurtenissen verlopen, het register (db.data.weefsel) niet --
     een lantaarnpaal verloopt niet en de tijdreeksen vegen zichzelf per laag. */
  { tak: 'weefselZaken', label: 'stadszaken (openbare ruimte)', dagen: 3 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'draagt codenaam en vrije tekst van een melder' },
  { tak: 'weefselWerk', label: 'werkorders openbare ruimte', dagen: 3 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'de uitvoering; wat er is gedaan blijft in de onderhoudshistorie' }
];


module.exports = { BELEID, DAG, JAAR };
