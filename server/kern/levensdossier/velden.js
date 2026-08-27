/* ============================================================================
   HET LEVENSDOSSIER -- een dossier per lid, met per VELD een eigenaar.

   WAT HIER WERD GEVONDEN, EN WAAROM HET IETS ANDERS BLEEK DAN GEDACHT.

   `db.data.lifestyle[key]` werd door vier domeinen aangeraakt, en dat zag eruit
   als een gedeelde zak zonder eigenaar -- zo staat het ook in TAKEN.md 6.18, en
   het was de reden om kern/bureau NIET te contracteren toen payroll, concern,
   veiligheid en mobiliteit dat wel werden.

   De meting zegt iets anders. Vijfentwintig velden, en er is er GEEN ENKELE die
   door twee domeinen wordt geschreven:

     lifestyle    (5)  verzoeken, bezittingen, afspraken, dossier, voorkeuren
     rechterhand (12)  attenties, cellier, cercle, entourage, garderobe, hangar,
                       maison, mecenaat, nalatenschap, onderhoud, reizen, tables
     bureau       (8)  beveiliging, cases, collectie, delegatie, dieren,
                       relatieContext, reputatie, twin
     levensgraaf  (0)  leest alles, schrijft niets

   Dit is dus geen betwiste zak maar een SAMENGESTELD DOSSIER: een persoonsmap
   met secties van verschillende afdelingen. Dat is een legitieme vorm, en het
   enige wat eraan ontbrak is dat de verdeling nergens stond.

   HIJ STOND WEL, MAAR IN EEN COMMENTAAR. In kern/rechterhand/index.js staat
   boven de accessor letterlijk:

       // hetzelfde dossier als De Rechterhand; wij zorgen alleen dat onze
       // lijsten bestaan

   Dat IS de afspraak. Hij werd door alle vier de domeinen nageleefd -- de
   meting bewijst het, want er is geen enkel betwist veld -- en hij werd door
   niets afgedwongen. Dit bestand maakt er een poort van: `veld()` weigert een
   veld dat niet van jou is. Wie de sectie van een ander nodig heeft, vraagt hem
   met `leesVeld()`, en dan staat in de code dat het een vreemde sectie is.

   WAAROM DIT EEN NEUTRAAL BESTAND IS EN NIET IN kern/lifestyle/ WOONT.
   kern/lifestyle maakte de basisvorm van het dossier en deelt zijn naam met de
   collectie, dus dat lag voor de hand. Maar dan zou de opslaglaag van EEN domein
   de velden van drie andere dragen, en dat is precies de eigendomsverwarring die
   dit bestand oplost. De container is gedeeld; de velden zijn dat niet. Vandaar
   een eigen module waar alle vier gelijk staan.

   DE ENIGE DEUR. Na dit bestand raakt geen van de vier domeinen db.data.lifestyle
   nog rechtstreeks aan; keuringsregel 53 houdt dat vast.
   ========================================================================== */
'use strict';
/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN.
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Per veld staat de VORM (lijst of kaart) en verder niets. Wat er in een `maison` of ' +
    'een `nalatenschap` hoort, is domeinkennis; die hier vastleggen zou dit bestand vijfentwintig ' +
    'domeinen laten kennen.',
  bevoegdheid: 'Dit contract bewaakt welk DOMEIN een veld schrijft, niet welk MENS. Of een ' +
    'medewerker het dossier van een lid mag zien, wordt bij de route bepaald en hoort bij de ' +
    'Authority Graph. De twee door elkaar halen zou een opslaglaag over mensen laten oordelen.',
  handhavingBinnenEenDomein: 'veld() weigert een veld van een ander domein, en dat is de poort. Maar '
    + 'wie via lees() het HELE dossier vasthoudt, houdt een levende verwijzing vast en kan er alles in '
    + 'schrijven. kern/rechterhand doet dat achtendertig keer via zijn eigen L(key)-hulpje, en dat is '
    + 'binnen dat domein ook redelijk. Dichtzetten vraagt een bevroren of doorgegeven kopie, en dat '
    + 'breekt elke schrijver die vandaag door die verwijzing gaat. Gemeten: geen enkel domein schrijft '
    + 'vandaag in het veld van een ander, dus dit is een ongebruikte opening en geen lek.',
  gebeurtenissen: 'server/bus.js vervoert wel maar spreekt geen taal (OS.md par. 4).',
  bewaartermijn: 'Een levensdossier is bij uitstek waar een bewaartermijn hoort, en de bewaarlaag ' +
    'kent hem nog niet. Dat is een echte tekortkoming en geen uitgesteld detail.'
};

/* ----------------------------------------------------------------------------
   DE VELDEN, MET HUN EIGENAAR. Afgeleid uit de code en niet gekozen: elk veld
   staat op het domein dat het vandaag als enige schrijft.

   Een veld toevoegen is een BESLUIT: je zegt ermee wie er voortaan over gaat.
   Daarom staat het hier en niet in het domein dat het toevallig nodig had.
   ------------------------------------------------------------------------- */
const VELDEN = {
  /* ---- kern/lifestyle: het concierge-bureau, en de basisvorm van het dossier -- */
  verzoeken:      { eigenaar: 'lifestyle',   soort: 'lijst', wat: 'concierge-verzoeken van het lid' },
  bezittingen:    { eigenaar: 'lifestyle',   soort: 'lijst', wat: 'wat het lid bezit en beheerd wil hebben' },
  afspraken:      { eigenaar: 'lifestyle',   soort: 'lijst', wat: 'gemaakte afspraken' },
  dossier:        { eigenaar: 'lifestyle',   soort: 'lijst', wat: 'de losse dossierregels' },
  voorkeuren:     { eigenaar: 'lifestyle',   soort: 'kaart', wat: 'voorkeuren die het hele bureau leest' },

  /* ---- kern/rechterhand: de persoonlijke staf ------------------------------- */
  reizen:         { eigenaar: 'rechterhand', soort: 'lijst', wat: 'reisdossiers en draaiboeken' },
  cellier:        { eigenaar: 'rechterhand', soort: 'lijst', wat: 'de wijnkelder' },
  tables:         { eigenaar: 'rechterhand', soort: 'lijst', wat: 'vaste tafels en restaurantvoorkeuren' },
  entourage:      { eigenaar: 'rechterhand', soort: 'lijst', wat: 'wie er om het lid heen staat' },
  cercle:         { eigenaar: 'rechterhand', soort: 'lijst', wat: 'de kring waarin het lid verkeert' },
  mecenaat:       { eigenaar: 'rechterhand', soort: 'lijst', wat: 'giften en beschermheerschap' },
  attenties:      { eigenaar: 'rechterhand', soort: 'kaart', wat: 'relaties en giften: wie krijgt wanneer wat' },
  maison:         { eigenaar: 'rechterhand', soort: 'kaart', wat: 'het huishouden: staf, taken, logboek' },
  hangar:         { eigenaar: 'rechterhand', soort: 'kaart', wat: 'toestellen en vluchten' },
  garderobe:      { eigenaar: 'rechterhand', soort: 'kaart', wat: 'kledingstukken en de vaklui eromheen' },
  onderhoud:      { eigenaar: 'rechterhand', soort: 'kaart', wat: 'objecten en onderhoudsregels' },
  nalatenschap:   { eigenaar: 'rechterhand', soort: 'kaart', wat: 'documenten, contacten en wensen' },

  /* ---- kern/bureau: het zakelijke bureau om het lid heen -------------------- */
  cases:          { eigenaar: 'bureau',      soort: 'lijst', wat: 'lopende zaken' },
  dieren:         { eigenaar: 'bureau',      soort: 'lijst', wat: 'de dieren van het lid' },
  beveiliging:    { eigenaar: 'bureau',      soort: 'kaart', wat: 'de beveiligingsstand' },
  collectie:      { eigenaar: 'bureau',      soort: 'kaart', wat: 'de kunst- en objectcollectie' },
  delegatie:      { eigenaar: 'bureau',      soort: 'kaart', wat: 'wie namens het lid mag handelen, met logboek' },
  relatieContext: { eigenaar: 'bureau',      soort: 'kaart', wat: 'de context van een relatie' },
  reputatie:      { eigenaar: 'bureau',      soort: 'kaart', wat: 'wat er over het lid rondgaat' },
  twin:           { eigenaar: 'bureau',      soort: 'kaart', wat: 'de digitale tweeling' }
};

/* De domeinen die een handvat mogen krijgen. Een gesloten lijst: een vijfde
   domein dat hier binnen wil, neemt een besluit en schrijft dat hier op. */
const DOMEINEN = ['lifestyle', 'rechterhand', 'bureau', 'levensgraaf'];

const COLLECTIE = 'lifestyle';
const LEEG = { lijst: () => [], kaart: () => ({}) };

module.exports = { VELDEN, DOMEINEN, NIET_GEBOUWD, COLLECTIE, LEEG };
