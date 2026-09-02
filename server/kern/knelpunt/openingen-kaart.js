/* ============================================================================
   DE KAART -- wat er per terrein in dit huis bestaat, gemeten en niet gehoopt.

   Afgesplitst van ./openingen.js op de naad die telt: daar staat de LOGICA (hoe
   een randvoorwaarde op een terrein belandt), hier de MEETUITSLAG. Twee dingen
   die op een andere klok lopen: de logica verandert als het denken verandert,
   de kaart als het HUIS verandert. Ze in een bestand houden betekent dat een
   nieuwe bron een aanpassing lijkt aan een redenering.

   ELKE REGEL HIERONDER IS OP 2 SEPTEMBER 2026 NAGEZOCHT, met het bestand erbij
   zodat een volgende lezer hem kan tegenspreken in plaats van hem te moeten
   geloven. Wie een terrein verandert zonder in de code te kijken, maakt hier
   een wenslijst van, en dan is de hele laag waardeloos: haar enige waarde is
   dat zij zegt waar dit huis NIET kijkt.

   DRIE STANDEN, EN ZE MOGEN NOOIT DOOR ELKAAR LOPEN:

     'bron'        -- er is aanbod EN een ingang voor deze mens.
     'geen-ingang' -- het aanbod bestaat, maar alleen aan de kant van de
                      aanbieder. Dat is geen ontbrekende functie maar een
                      BESLUIT dat nog niemand genomen heeft.
     'geen-bron'   -- er is hier niets. Een leegte, en geen nul.

   Wie die drie samenvat tot "geen aanbod gevonden", vertelt een moeder dat er
   geen kinderopvang is terwijl er een register vol groepen staat waar zij niet
   bij mag. `waarom` is daarom verplicht bij de twee die geen bron zijn.
   ========================================================================== */
'use strict';

/* De terreinen waarop een randvoorwaarde kan liggen. `TERREINEN` en niet
   `SOORTEN`: dat woord draagt in deze code al 45 betekenissen over 47 domeinen
   (SEMANTIEK.json, de ergste botsing van het huis), en er komt er geen 46e bij
   voor iets wat prima een eigen naam kan hebben. */
const TERREINEN = ['werk', 'opleiding', 'opvang', 'vervoer', 'wonen'];

/* De woorden waarmee een randvoorwaarde op een terrein wordt gelegd. BEWUST
   DOM, en dat is dezelfde keuze als in kern/stadsweefsel/kansen.js: *"BEWUST
   GEEN SLIMME MATCHING. Een woordvergelijking (...) is uitlegbaar; een AI die
   functietitels interpreteert, geeft een lijst die niemand kan narekenen."*
   Wat niet matcht wordt apart gemeld en niet weggewerkt. */
const WOORDEN = {
  werk: ['werk', 'baan', 'vacature', 'inkomen', 'salaris', 'loon', 'dienstverband'],
  opleiding: ['opleiding', 'diploma', 'cursus', 'leren', 'studie', 'school', 'bevoegdheid', 'certificaat'],
  opvang: ['opvang', 'kinderopvang', 'kind', 'kinderen', 'oppas', 'bso'],
  vervoer: ['vervoer', 'reizen', 'auto', 'ov', 'fiets', 'rijbewijs', 'afstand'],
  wonen: ['wonen', 'woning', 'huis', 'huur', 'woonruimte', 'adres', 'onderdak']
};

const KAART = {
  werk: {
    stand: 'bron', ingang: '/api/rtf/vacatures',
    wat: 'De openstaande vacatures van alle partners, dezelfde lijst die de app toont.',
    bron: 'kern/werk.js (openVacatures); ook open voor een gezin zonder pas via /api/rtf/vacatures.'
  },
  opleiding: {
    stand: 'bron', ingang: '/api/rtf/beroepen',
    wat: 'De Beroepen-Bibliotheek: 200 beroepen met een gratis leerpad per beroep.',
    bron: 'kern/beroepenbieb/. LET OP: dit is leerSTOF en geen inschrijving. Een opleiding waar u ' +
      'zich op kunt aanmelden bestaat in dit huis niet; de opleidingenlijst in server/school/ is ' +
      'van de schooladministratie en niet van u.'
  },
  opvang: {
    stand: 'geen-ingang',
    wat: 'Kinderopvang bestaat hier wel: groepen met een capaciteit, en een nanny-dienst.',
    waarom: 'Alleen de opvangorganisatie kan erbij. Elke route ernaartoe is een partnerroute ' +
      '(/api/supplier/opvang); er is geen enkele ingang voor een ouder. kern/levenslijn/fasen.js ' +
      'zegt hetzelfde over zichzelf: de fase "opvang" heeft geen bron omdat er geen ' +
      'opvang-inschrijving bestaat die een mens zelf deed.',
    bron: 'kern/verzorging/opvang.js'
  },
  vervoer: {
    stand: 'geen-bron',
    waarom: 'Er is in dit huis geen aanbod van vervoer naar een opleiding of naar werk. Rijden en ' +
      'verhuur bestaan als dienst, maar niet als iets dat een randvoorwaarde opheft.'
  },
  wonen: {
    stand: 'geen-ingang',
    wat: 'Woningen bestaan hier: het aanbod van een makelaarspartner, koop en huur.',
    waarom: 'Dat is commercieel aanbod en geen woonvoorziening. Sociale huur, een corporatie, een ' +
      'urgentieverklaring of een wachtlijst voor een woning bestaan in deze code niet -- geen ' +
      'enkele treffer. Wie hier "wonen" leest als "wij kunnen u aan een woning helpen", leest iets ' +
      'wat er niet staat.',
    bron: 'routes/member/handel/vastgoed.js (/api/vastgoed/aanbod)'
  }
};

module.exports = { TERREINEN, WOORDEN, KAART };
