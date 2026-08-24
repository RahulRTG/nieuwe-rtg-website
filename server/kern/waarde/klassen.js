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
                     het veld waar de vergunningplicht aan hangt. `false` is
                     hier de regel en `true` de uitzondering, niet andersom --
                     en een `true` moet er BIJ ZEGGEN waarop hij rust, in
                     `uitbetaalVermogen` (zie onderaan dit bestand).
     overdraagbaar   'nee' | 'leden' | 'vrij'. Waarde die vrij overdraagbaar is
                     EN uitbetaalbaar, is geld uitgeven; die combinatie bestaat
                     hier niet zonder vergunning.
     plafondCenten   het maximum dat op EEN positie van deze klasse mag staan.
                     Bij PERSONAL_FUNDED is dit het laatste overgebleven stuk
                     van het oude besluit WALLET_SALDO; tot dit bestand bestond
                     werd het nergens afgedwongen.
     vervaltNaDagen  null = vervalt niet. Een tegoed dat nooit vervalt is een
                     eeuwige verplichting op de balans van de uitgever.

   `grond` zegt WAAROM deze klasse mag bestaan. Dat is geen toelichting maar de
   aanvechtbare kern: verandert de werkelijkheid, dan valt de grond weg en hoort
   de klasse te wijzigen. */
'use strict';

const KLASSEN = {
  /* Het gewone walletsaldo: het lid laadt zelf op met eigen geld, en haalt het
     er ook weer uit. Dit is de klasse waar WALLET_SALDO over gaat -- ooit een
     besluit, sinds de terugstorting een rail met een vergunning erachter. Ook de
     terugval voor elke lid-rekening die geen eigen registratie heeft. */
  PERSONAL_FUNDED: {
    naam: 'Persoonlijk saldo',
    uitgever: 'lid',
    bestedingsgebied: 'rtg',
    uitbetaalbaar: true,
    uitbetaalVermogen: 'LID_UITBETALING',
    overdraagbaar: 'leden',
    plafondCenten: 500000,      // 5.000 euro per wallet
    vervaltNaDagen: null,
    /* DEZE GROND IS OP 24 AUGUSTUS 2026 VERVANGEN. Er stond een gesloten
       circuit: alleen binnen RTG te besteden, niet uitbetaald aan het lid, met
       plafonds -- de grond waarop RTG saldo mocht aanhouden zonder vergunning.
       Sinds leden kunnen terugstorten is de tweede voorwaarde weg, en daarmee de
       grond: saldo dat tegen de nominale waarde inwisselbaar is voor de houder,
       IS elektronisch geld. Daar helpt geen formulering aan.

       De uitbetaalbaarheid hangt nu aan `uitbetaalVermogen` hierboven, dat over
       de eigen rails een vergunning vraagt. De volledige redenering staat in de
       kop van WALLET_SALDO in kern/bevoegdheid/lijst.js en in WAARDE.md par. 9;
       het plafond hieronder is het enige dat van de drie oude voorwaarden
       overeind is gebleven. */
    grond: 'Aangehouden klantgeld dat op verzoek wordt terugbetaald aan het lid. Dat is ' +
      'elektronisch geld en geen beperkt netwerk meer; de terugbetaling hangt daarom aan ' +
      'het vermogen LID_UITBETALING, dat over de eigen rails een vergunning als ' +
      'elektronischgeldinstelling vraagt en anders over de rail van een vergunninghoudende ' +
      'partner loopt. Het plafond per wallet blijft.'
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

  /* De tweede klasse die het huis mag verlaten (naast PERSONAL_FUNDED sinds de
     terugstorting bestaat): het saldo van een zaak gaat naar de bankrekening van
     die zaak. Dat is PARTNER_UITBETALING, en zonder die bevoegdheid gebeurt het
     niet.

     Let op het verschil in ZWAARTE met LID_UITBETALING. Deze vraagt over de
     eigen rails een betaalinstelling; die van het lid een
     elektronischgeldinstelling. Dat is geen slordigheid: hier gaat ontvangen
     omzet naar de ondernemer die hem verdiende, en daar gaat aangehouden
     consumentengeld terug naar de consument. De tweede is klantgeld, de eerste
     niet. */
  PARTNER_SETTLEMENT: {
    naam: 'Saldo van een zaak',
    uitgever: 'rtg',
    bestedingsgebied: 'rtg',
    uitbetaalbaar: true,
    uitbetaalVermogen: 'PARTNER_UITBETALING',
    overdraagbaar: 'nee',
    plafondCenten: null,        // een zaak int een dag lang door; een plafond zou de kassa stoppen
    vervaltNaDagen: null,
    grond: 'Ontvangen omzet van een ondernemer, geen aangehouden consumentengeld. ' +
      'Uitbetalen is hier de bedoeling en vraagt daarom de bevoegdheid ' +
      'PARTNER_UITBETALING; zonder die bevoegdheid blijft het staan.'
  }
};

/* TWEE TERUGVALLEN, EN DAT WAS ER EERST EEN.

   `STANDAARD` geldt voor een lid-rekening zonder eigen registratie, en dat hoort
   PERSONAL_FUNDED te zijn: de wallet van een lid IS persoonlijk saldo, daar valt
   niets aan te raden.

   `ONBEKEND` geldt voor een positie die wél geregistreerd hoort te zijn maar het
   niet is -- een `waarde:`-rekening zonder registratie. Dat is een fout, en de
   vraag is wat je dan aanneemt. Tot 24 augustus 2026 viel die terug op
   STANDAARD, en dat was toen ongevaarlijk omdat PERSONAL_FUNDED niet
   uitbetaalbaar was. Sinds hij dat wél is, zou diezelfde terugval een onbekende
   positie stilzwijgend uitbetaalbaar maken -- precies het omgekeerde van wat de
   regel bedoelde. Vandaar een eigen constante, met de strengste klasse erin:
   niet uitbetaalbaar, niet overdraagbaar, laagste plafond. Wat we niet kennen,
   kan niets. */
const STANDAARD = 'PERSONAL_FUNDED';
const ONBEKEND = 'LOYALTY';

const SOORTEN = Object.keys(KLASSEN);

/* ELKE UITBETAALBARE KLASSE NOEMT WAT HAAR TOESTAAT, en dat is met opzet een
   veld en geen afspraak. `uitbetaalbaar: true` is één woord; wie het zet zonder
   erbij na te denken, heeft in één aanslag de zwaarste grens van deze laag
   verlegd -- en niets zou hem tegenhouden. Door de bevoegdheid ernaast te eisen
   kan dat niet meer stil: een klasse die zegt dat ze uitbetaalbaar is zonder te
   zeggen waaróp, laat test/waarde.test.js zakken. */
const uitbetaalVermogenVan = klasse => (KLASSEN[klasse] && KLASSEN[klasse].uitbetaalbaar)
  ? (KLASSEN[klasse].uitbetaalVermogen || null) : null;

module.exports = { KLASSEN, SOORTEN, STANDAARD, ONBEKEND, uitbetaalVermogenVan };
