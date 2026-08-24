/* DE WAARDEKLASSEN: welke soorten waarde dit huis kent, en wat elke soort
   MAG. Los van de motor die het oordeel velt (./policy), want dit is het stuk
   dat een bestuurder of jurist moet kunnen lezen zonder een regel code te
   begrijpen -- precies zoals kern/bevoegdheid/lijst.js dat doet voor de
   handelingen. Wijzigt hier iets, dan verandert wat RTG in omloop brengt. Dat
   is geen implementatiedetail maar een besluit; behandel het zo.

   WAAROM DIT ER IS. Het grootboek van RTG Pay kende tot nu toe EEN soort
   waarde: een getal op `lid:<codenaam>`. Dat getal wist niet wie het had
   uitgegeven, waarvoor het bedoeld was, of het het huis mocht verlaten en
   wanneer het verviel. Zolang er maar een soort is, gaat dat goed. Zodra er
   een werkgeversbudget, een gemeentetegoed of een cadeaubon bij komt, is het
   verschil tussen die soorten juist de hele inhoud -- en dan is een kaal
   saldo een fout die zich als eenvoud voordoet.

   DE VELDEN, en waarom ze er alle zes zijn:

     uitgever        wie de waarde in omloop bracht. Bepaalt bij wie de
                     verplichting op de balans staat.
     bestedingsgebied waar het heen mag. 'rtg' = alleen binnen het gesloten
                     circuit; een lijst genres = alleen daar.
     uitbetaalbaar   mag dit het huis verlaten als geld aan de houder? Dit is
                     het veld waar de vergunningplicht aan hangt (zie de grond
                     onder WALLET_SALDO in kern/bevoegdheid/lijst.js). `false`
                     is hier de regel en `true` de uitzondering, niet andersom.
     overdraagbaar   'nee' | 'leden' | 'vrij'. Waarde die vrij overdraagbaar is
                     EN uitbetaalbaar, is geld uitgeven; die combinatie bestaat
                     hier niet zonder vergunning.
     plafondCenten   het maximum dat op EEN positie van deze klasse mag staan.
                     Het besluit onder WALLET_SALDO belooft dit plafond; tot
                     dit bestand bestond werd het nergens afgedwongen.
     vervaltNaDagen  null = vervalt niet. Een tegoed dat nooit vervalt is een
                     eeuwige verplichting op de balans van de uitgever.

   `grond` zegt WAAROM deze klasse mag bestaan. Dat is geen toelichting maar de
   aanvechtbare kern: verandert de werkelijkheid, dan valt de grond weg en hoort
   de klasse te wijzigen. */
'use strict';

const KLASSEN = {
  /* Het gewone walletsaldo: het lid laadt zelf op met eigen geld. Dit is de
     klasse waar het besluit WALLET_SALDO over gaat, en de default voor elke
     lid-rekening die geen eigen registratie heeft. */
  PERSONAL_FUNDED: {
    naam: 'Persoonlijk saldo',
    uitgever: 'lid',
    bestedingsgebied: 'rtg',
    uitbetaalbaar: false,
    overdraagbaar: 'leden',
    plafondCenten: 500000,      // 5.000 euro per wallet
    vervaltNaDagen: null,
    grond: 'Een gesloten circuit met een hard plafond: alleen binnen RTG te besteden en ' +
      'niet uitbetaald aan het lid. RTG rekent dit tot een beperkt netwerk. Vervalt de ' +
      'geslotenheid of het plafond, dan vervalt deze grond.'
  },

  /* Geld van een werkgever aan een werknemer, met een doel. Nooit uitbetaalbaar
     en nooit overdraagbaar: op het moment dat het dat wel is, is het loon, en
     loon loopt via kern/payroll met loonheffing eromheen. */
  EMPLOYER_BUDGET: {
    naam: 'Werkgeversbudget',
    uitgever: 'werkgever',
    bestedingsgebied: 'genres',
    uitbetaalbaar: false,
    overdraagbaar: 'nee',
    plafondCenten: 200000,
    vervaltNaDagen: 365,
    grond: 'Een doelgebonden verstrekking in natura binnen een beperkt netwerk. Zou dit ' +
      'uitbetaalbaar of overdraagbaar worden, dan is het loon en hoort het via de ' +
      'loonaangifte te lopen, niet hierlangs.'
  },

  /* Een tegoed van een overheid aan een inwoner. Strengst van allemaal: alleen
     de rechthebbende zelf, met een einddatum, en met verantwoording achteraf. */
  MUNICIPAL: {
    naam: 'Overheidstegoed',
    uitgever: 'overheid',
    bestedingsgebied: 'genres',
    uitbetaalbaar: false,
    overdraagbaar: 'nee',
    plafondCenten: 500000,
    vervaltNaDagen: 365,
    grond: 'Publiek geld met een bestemming. Overdraagbaarheid zou de bestemming ' +
      'onbewijsbaar maken en de verantwoording aan de verstrekker onmogelijk.'
  },

  /* Door RTG toegekend, nooit gekocht. Dit is geen geld en mag zich ook nooit
     als geld voordoen: het verlaat het huis niet en gaat niet naar een ander. */
  LOYALTY: {
    naam: 'Door RTG toegekend voordeel',
    uitgever: 'rtg',
    bestedingsgebied: 'rtg',
    uitbetaalbaar: false,
    overdraagbaar: 'nee',
    plafondCenten: 100000,
    vervaltNaDagen: 730,
    grond: 'Een korting die RTG bijlegt, geen aangehouden klantgeld. Er staat geen ' +
      'inleg van het lid tegenover, dus er is niets om aan te houden of terug te geven.'
  },

  /* De cadeaukaart van een zaak. Meervoudig inwisselbaar, dus de btw hoort bij
     de INWISSELING en niet bij de verkoop -- die regel staat al in
     kern/fiscaal/index.js en deze klasse is dezelfde werkelijkheid. */
  GIFT: {
    naam: 'Cadeaukaart van een zaak',
    uitgever: 'zaak',
    bestedingsgebied: 'uitgever',
    uitbetaalbaar: false,
    overdraagbaar: 'vrij',
    plafondCenten: 100000,
    vervaltNaDagen: 730,
    grond: 'Een meervoudig inwisselbare voucher bij een genoemde uitgever. Vrij ' +
      'overdraagbaar mag hier juist wel: hij is niet uitbetaalbaar en alleen bij die ' +
      'ene zaak te besteden, dus hij is nooit een betaalmiddel geworden.'
  },

  /* De ENIGE klasse die het huis wel mag verlaten, en niet toevallig ook de
     enige die aan een vergunning hangt: het saldo van een zaak gaat naar de
     bankrekening van die zaak. Dat is PARTNER_UITBETALING in de
     bevoegdhedenlijst, en zonder die bevoegdheid gebeurt het niet. */
  PARTNER_SETTLEMENT: {
    naam: 'Saldo van een zaak',
    uitgever: 'rtg',
    bestedingsgebied: 'rtg',
    uitbetaalbaar: true,
    overdraagbaar: 'nee',
    plafondCenten: null,        // een zaak int een dag lang door; een plafond zou de kassa stoppen
    vervaltNaDagen: null,
    grond: 'Ontvangen omzet van een ondernemer, geen aangehouden consumentengeld. ' +
      'Uitbetalen is hier de bedoeling en vraagt daarom de bevoegdheid ' +
      'PARTNER_UITBETALING; zonder die bevoegdheid blijft het staan.'
  }
};

/* De klasse die geldt als een rekening geen eigen registratie heeft. Bewust
   de strengste van de twee die op een lid-rekening kunnen staan: een positie
   waarvan we het niet weten, krijgt niet stilzwijgend de ruimste rechten. */
const STANDAARD = 'PERSONAL_FUNDED';

const SOORTEN = Object.keys(KLASSEN);

module.exports = { KLASSEN, SOORTEN, STANDAARD };
