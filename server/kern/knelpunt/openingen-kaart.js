/* ============================================================================
   DE KAART -- wat er per terrein in dit huis bestaat, gemeten en niet gehoopt.

   Afgesplitst van ./openingen.js op de naad die telt: daar staat de LOGICA (hoe
   een randvoorwaarde op een terrein belandt), hier de MEETUITSLAG. Twee dingen
   die op een andere klok lopen: de logica verandert als het denken verandert,
   de kaart als het HUIS verandert. Ze in een bestand houden betekent dat een
   nieuwe bron een aanpassing lijkt aan een redenering.

   ELKE REGEL HIERONDER IS NAGEZOCHT, met het bestand erbij zodat een volgende
   lezer hem kan tegenspreken in plaats van hem te moeten geloven. Wie een
   terrein verandert zonder in de code te kijken, maakt hier een wenslijst van,
   en dan is de hele laag waardeloos: haar enige waarde is dat zij zegt waar dit
   huis NIET kijkt.

   TWEE VRAGEN, EN ZE WAREN EEN DAG LANG IN ELKAAR GESCHOVEN. Dat is een echte
   fout van 2 september 2026 en hij staat hier omdat de reparatie anders niet te
   begrijpen is. Eerst stonden `wonen` en `vervoer` op respectievelijk
   `geen-ingang` en `geen-bron`, met als redenering dat een makelaarsaanbod geen
   woonvoorziening is en een betaalde rit geen structureel vervoer. Die
   redenering klopt -- maar het is een antwoord op de VERKEERDE vraag.
   `/api/vastgoed/aanbod` en `/api/ride/request` staan allebei achter `auth`: een
   lid KAN er wel degelijk bij. Ik had "dit lost uw probleem niet op" opgeschreven
   als "u kunt hier niet bij", en dat is precies de soort stille onwaarheid waar
   deze hele laag tegen bedoeld is.

   Dus: twee assen, en ze staan nu apart.

   AS 1, `stand` -- KAN DEZE MENS HIER IETS BEREIKEN?

     'bron'        -- ja. Er is aanbod en er is een ingang voor deze mens.
     'geen-ingang' -- nee, maar het bestaat: alleen de aanbieder kan erbij. Dat
                      is geen ontbrekende functie maar een BESLUIT dat nog
                      niemand genomen heeft.
     'geen-bron'   -- nee, en het bestaat hier niet. Een leegte, en geen nul.

   AS 2, `dektNiet` -- LOST WAT DAAR STAAT DE RANDVOORWAARDE OOK OP?

   VERPLICHT BIJ ELKE BRON, en dat is de les van de fout hierboven. De gevaarlijkste
   lezer van deze laag is niet degene die een leegte voor een gat aanziet, maar
   degene die `bron` leest als "dit is geregeld". Een vacature is geen inkomen,
   een leerpad is geen inschrijving, een koopwoning is geen dak boven het hoofd
   en een betaalde rit is geen dagelijkse reis naar school. Staat dat er niet bij,
   dan belooft deze kaart iets wat dit huis niet waarmaakt.

   `waarom` is om dezelfde reden verplicht bij de twee standen die geen bron
   zijn: een leegte zonder reden is een gat, een leegte met een reden is een
   besluit dat iemand kan nemen.
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
    dektNiet: 'Een vacature is nog geen inkomen. Deze lijst zegt niets over of u wordt aangenomen, ' +
      'wanneer, of wat het betaalt.',
    bron: 'kern/werk.js (openVacatures); ook open voor een gezin zonder pas via /api/rtf/vacatures.'
  },
  opleiding: {
    stand: 'bron', ingang: '/api/rtf/beroepen',
    wat: 'De Beroepen-Bibliotheek: 200 beroepen met een gratis leerpad per beroep.',
    dektNiet: 'Dit is leerSTOF en geen inschrijving, en het levert geen diploma op. Een opleiding ' +
      'waar u zich op kunt aanmelden bestaat in dit huis niet; de opleidingenlijst in server/school/ ' +
      'is van de schooladministratie en niet van u.',
    bron: 'kern/beroepenbieb/'
  },
  opvang: {
    stand: 'geen-ingang',
    wat: 'Kinderopvang bestaat hier wel: groepen met een capaciteit, en een nanny-dienst.',
    waarom: 'Alleen de opvangorganisatie kan erbij. Elke route ernaartoe is een partnerroute ' +
      '(/api/supplier/opvang); er is geen enkele ingang voor een ouder. kern/levenslijn/fasen.js ' +
      'zegt hetzelfde over zichzelf: de fase "opvang" heeft geen bron omdat er geen ' +
      'opvang-inschrijving bestaat die een mens zelf deed. Let op: kern/opvang.js gaat over de ' +
      'asielketen en is hier een valse treffer.',
    bron: 'kern/verzorging/opvang.js'
  },
  vervoer: {
    stand: 'bron', ingang: '/api/ride/request',
    wat: 'Een rit aanvragen bij een vervoerspartner.',
    dektNiet: 'Dit is een losse betaalde rit en geen structureel vervoer. Het lost een dagelijkse ' +
      'reis naar werk of school niet op, en er is geen regeling die hem betaalt. Reiskosten, een ' +
      'OV-abonnement, leerlingenvervoer of vervoer vanuit een gemeente bestaan in deze code niet.',
    bron: 'routes/member/onderweg.js'
  },
  wonen: {
    stand: 'bron', ingang: '/api/vastgoed/aanbod',
    wat: 'Het aanbod van een makelaarspartner: koop en huur.',
    dektNiet: 'Dit is commercieel aanbod en geen woonvoorziening. Sociale huur, een ' +
      'woningcorporatie, een urgentieverklaring en een wachtlijst voor een woning bestaan in deze ' +
      'code niet -- geen enkele treffer. Wie hier "wonen" leest als "wij kunnen u aan een woning ' +
      'helpen", leest iets wat er niet staat.',
    bron: 'routes/member/handel/vastgoed.js'
  }
};

module.exports = { TERREINEN, WOORDEN, KAART };
