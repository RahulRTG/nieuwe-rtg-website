/* DE GESLOTEN LIJST MENSGRONDEN, met de uitkomsten en de harde poorten.

   Hij staat apart van de indeling (./mensgrond.js) en van de vertaling
   (./mensgrond-vertaling.js) om dezelfde reden als kern/isolatie/effectwoorden.js:
   een woordenlijst hoort te bestaan los van wie hem gebruikt, anders wordt de eerste
   gebruiker stilzwijgend de eigenaar. Wat hier staat en waarom, staat in de kop van
   ./mensgrond.js en in AUTONOMIE.md par. 2.9. */
'use strict';

const GRONDEN = Object.freeze({
  'fysieke-aanwezigheid': {
    soort: 'blijvend',
    betekenis: 'iemand moet ergens lijfelijk zijn: een sleutel overhandigen, een ruimte bekijken, een mens ontvangen',
    bron: 'HORECA.md (het systeem vinkt niets zelf af); NAVIGATIE.md',
    nietGemeten: 'geen enkele route draagt vandaag een verklaring dat zij lijfelijke aanwezigheid vraagt; ' +
      'die grond is daarom per route niet vast te stellen en wordt nooit als afwezig gelezen'
  },
  oordeel: {
    soort: 'blijvend',
    betekenis: 'een afweging die niet uit regels volgt: toelaten, afkeuren, een grens losser zetten, een besluit over het platform',
    bron: 'CLAUDE.md (Lifestyle en Business uitsluitend na menselijke goedkeuring); kern/frictie/bodem.js; BESTUUR.md'
  },
  toestemming: {
    soort: 'blijvend',
    betekenis: 'de betrokkene of een bevoegde geeft toestemming: wie iemand is, hoe hij binnenkomt, wat er van hem gebruikt mag worden',
    bron: 'CLAUDE.md (privacy by design); kern/frictie/bodem.js sleutelbos en identiteit'
  },
  relatie: {
    soort: 'blijvend',
    betekenis: 'er ontstaat een blijvende koppeling tussen partijen: een integratie, een sleutel, een uitnodiging, een apparaat',
    bron: 'LIFE.md par. 4 (een relatie is geen trechter); kern/isolatie/effectwoorden.js VERTROUWENSRELATIE_AANGAAN'
  },
  'wettelijke-bevoegdheid': {
    soort: 'blijvend',
    betekenis: 'de wet legt de handeling bij een bevoegde mens: voorschrijven, verwijzen, indienen namens iemand',
    bron: 'CLAUDE.md (persoonseis, fiscale klasse voorbehouden); kern/persoonseis-lijst.js',
    nietGemeten: 'de persoonseis (kern/persoonseis-lijst.js) en de klasse voorbehouden (kern/fiscaal/zekerheid.js) ' +
      'zijn op HANDELING en genre ingedeeld en niet op route; per route is deze grond dus niet vast te stellen'
  },
  'tweede-persoon': {
    soort: 'blijvend',
    betekenis: 'het gevolg bereikt een ander mens: een bericht, een publicatie, een wijziging in andermans gegevens',
    bron: 'LIFE.md (alles wat een tweede persoon bereikt blijft maximaal klaarzetten); LAUNCH.md de mensrem'
  },
  geld: {
    soort: 'blijvend',
    betekenis: 'een bedrag wordt verplaatst, vastgelegd of uitbetaald',
    bron: 'GELD.md (geld verlaat het huis nooit vanzelf); kern/stuur/mandaat.js NOOIT_AUTONOOM'
  },
  onomkeerbaar: {
    soort: 'blijvend',
    betekenis: 'er is aantoonbaar of verklaard geen weg terug',
    bron: 'HERSTELBESLUIT.json (stand FINAL, door een mens verklaard); HERSTELPROEF.json (uitslag geen-herstel)'
  },
  'terugweg-onbewezen': {
    soort: 'totBewijs',
    betekenis: 'er bestaat misschien een weg terug, maar niemand heeft hem beproefd of verklaard',
    bron: 'AUTONOMIE.md par. 3 (de terugweg blijft het plafond); HERSTELPROEF.json; HERSTELBESLUIT.json'
  }
});
const NAMEN = Object.freeze(Object.keys(GRONDEN));

/* De vijf uitkomsten per handeling. Met opzet geen getal en geen rangorde: ze zeggen
   WAT er aan de hand is, en wie er een percentage van maakt verliest juist dat. */
const UITKOMSTEN = Object.freeze({
  geldig: 'een mens staat er, en er is een aantoonbare grond',
  automatiseringsschuld: 'een mens staat er, en er is geen enkele grond: het gevolg is gemeten, de terugweg bewezen en geen blijvende grond van toepassing',
  overtreding: 'de grammatica laat de machine hier zelfstandig gaan, terwijl een grond of een harde poort dat verbiedt',
  machinewerk: 'de machine mag het, en er is geen grond en geen gezakte poort',
  onbekend: 'onvoldoende bewijs om iets te zeggen; nooit gelezen als geldig of als schuld'
});

/* DE HARDE POORTEN. Geen stemmen: een handeling die zes van zeven haalt, haalt hem niet.
   `gevolg` is CAN_VERIFY, `terugweg` is CAN_RECOVER. */
const POORTEN = Object.freeze({
  gevolg: 'is gemeten wat de handeling aanraakt (kern/stuur/gevolg.js)',
  terugweg: 'is er een beproefde of verklaarde weg terug (HERSTELPROEF.json, HERSTELBESLUIT.json)',
  herhaling: 'is een tweede aanroep beschermd (IDEMPROEF.json)',
  bewijs: 'staat de vervalstaat op bewezen (VERTROUWEN.json)'
});

module.exports = { GRONDEN, NAMEN, UITKOMSTEN, POORTEN };
