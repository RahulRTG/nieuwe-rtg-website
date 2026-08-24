/* ============================================================================
   DE SOORTEN -- de tabel zelf, en verder niets.

   Staat los van ./register.js om dezelfde reden als bedrijf/rollen-register.js
   los staat van bedrijf/rollen.js: aan dit bestand komt iemand die een HANDELING
   bijzet, en dan wil je in een scherm zien wat er al staat en waarom. Aan
   register.js komt iemand die aan de werking sleutelt. Twee soorten bezoek, twee
   bestanden.

   De regels waar deze tabel aan moet voldoen -- elke soort noemt zijn deur, en
   geen veld blijft leeg zonder reden -- staan bij de lezer, in ./register.js.
   ========================================================================== */
'use strict';

/* De soorten. `eenheidEen` staat er los bij en wordt niet afgeleid: het
   Nederlands laat zich niet met een regel ontmeervoudigen (personen -> persoon,
   niet "personen" min een s), en "1 personen" op een bevestigingsscherm is
   precies het detail dat een product goedkoop laat lijken.

   DE VELDEN, en geen ervan blijft leeg zonder reden:

     eenheid              waarin we tellen. "personen" is geen "records": tien
                          records over een persoon zijn een persoon.
     omkeerbaar           kan RTG het gevolg ongedaan maken? Let op de
                          vangvraag: een EXPORT is niet omkeerbaar. De knop is
                          daarna misschien weg, maar de gegevens zijn het huis
                          uit. Wie hier "true" invult omdat het scherm een
                          ongedaan-knop heeft, liegt tegen de bon van laag 5.
     vast                 de absolute grens, zolang er nog geen eigen grondslag
                          is (zie blootstelling.js: koude start).
     gevoelig             bijzondere persoonsgegevens? Dan telt hetzelfde
                          aantal zwaarder: de schade per eenheid is groter.
     waar                 de route die de handeling UITVOERT, of null
     waaromGeenHandeling  waarom er geen is (verplicht als `waar` null is)
     poort                de route die hem TEGENHOUDT, of afwezig
     waaromGeenPoort      waarom er BEWUST nooit een komt (een besluit)
     waaromNogGeenPoort   waarom er nog geen is (een gat, en het telt mee)
     tempo                { budget, vensterUren }: hoeveel er in dat venster in
                          TOTAAL mag, over alle handelingen samen. Verklaard en
                          niet geleerd -- zie de kop van tempo.js voor waarom
                          dat bij een reeks omgekeerd werkt.
     waaromGeenTempo      waarom deze soort geen budget heeft

   DIE LAATSTE TWEE ZIJN NIET HETZELFDE, en het verschil is precies waar een
   veiligheidsdashboard aan doodgaat. "Hier komt nooit een poort want dit is het
   exit-recht van de klant" is een besluit dat af is. "Hier is nog geen poort
   want deze meter kan geen tempo meten" is werk dat nog moet gebeuren. Wie ze
   allebei als reden opschrijft, telt zijn openstaande punten naar nul en heeft
   een groen bord met een gat erin. */
const SOORTEN = [
  {
    id: 'tenant.uitvoer',
    naam: 'De volledige uitvoer van een werkruimte',
    eenheid: 'objecten', eenheidEen: 'object',
    omkeerbaar: false,
    waaromNiet: 'De gegevens verlaten het huis. Een uitvoer is niet in te trekken.',
    vast: 2000,
    gevoelig: true,
    waar: 'POST /api/tenant/export',
    /* WEL EEN BUDGET, EN HET HOUDT NIETS TEGEN. De vierde volledige uitvoer in
       een etmaal is het luidste exfiltratiesignaal dat er is, en dat hoort in
       de bon te staan. Blokkeren mag hier niet (zie hieronder), dus wat dit
       budget doet is de zwaarte en de zin verzwaren -- het antwoord en de
       Trust Receipt zeggen het, de deur gaat niet dicht. */
    tempo: { budget: 3, vensterUren: 24 },
    waaromGeenPoort: 'De uitvoer is het exit-recht van de klant en gaat open op zijn eigen beheer-token. Een exit-recht dat op een poort kan stuklopen is geen recht. Deze soort wordt gemeten en meegestuurd, niet tegengehouden.'
  },
  {
    id: 'mens.uitdienst',
    naam: 'Iemand uit dienst zetten',
    eenheid: 'personen', eenheidEen: 'persoon',
    omkeerbaar: true,
    vast: 5,
    gevoelig: false,
    waar: 'POST /api/bedrijf/lid/uit-dienst',
    /* HIER STOND DAT ER GEEN POORT KON KOMEN, en dat klopte zolang deze laag
       alleen volume per aanroep woog: deze route raakt EEN mens per keer, dus
       een drempel van vijf ging nooit af. De zuivering die dit huis vreest is
       geen grote handeling maar een REEKS -- vijf op een dag, elk voor zich
       licht. Dat is wat het tempobudget hieronder meet, en daarmee is dit geen
       openstaand punt meer maar een deur.

       VIJF PER ETMAAL. Ruim boven een gewone week (een vertrek is een
       gebeurtenis, geen dagtaak) en ver onder wat een reeks nodig heeft. De
       zesde vraagt een tweede bevestiging, en de zevende weer -- boven het
       budget is uitzonderlijk en niet zwaar, want anders maakt iemand zijn
       reeks af in het kwartier na de eerste bevestiging. */
    tempo: { budget: 5, vensterUren: 24 },
    poort: 'POST /api/bedrijf/lid/uit-dienst'
  },
  {
    id: 'mens.gevoelig.inzage',
    naam: 'Inzage in bijzondere persoonsgegevens',
    eenheid: 'personen', eenheidEen: 'persoon',
    omkeerbaar: false,
    waaromNiet: 'Gezien is gezien. Het journaal legt vast dat het gebeurde, niet dat het ongedaan is.',
    vast: 25,
    gevoelig: true,
    waar: null,
    waaromGeenTempo: 'Er is geen handeling om te tellen.',
    waaromGeenHandeling: 'Het recht `mens.gevoelig` staat in bedrijf/rollen-register.js en wordt door de HR-rol gedragen, maar GEEN ENKELE route vraagt erom -- werkPoort() wordt met `mens` aangeroepen en nooit met `mens.gevoelig`. Er is dus wel een recht en geen deur. Zolang dat zo is, is dit een besluit dat nog moet worden uitgevoerd en geen pad dat iemand kan lopen.'
  },
  {
    id: 'rol.geven',
    naam: 'Een rol toekennen',
    eenheid: 'rollen', eenheidEen: 'rol',
    omkeerbaar: true,
    vast: 3,
    gevoelig: false,
    waar: 'POST /api/bedrijf/lid/rollen',
    /* Vijfentwintig rollen per etmaal: een drukke instroomweek haalt dat niet
       (tien nieuwe collega's met elk twee rollen is twintig), en wie een hele
       organisatie herverdeelt zit er meteen overheen. */
    tempo: { budget: 25, vensterUren: 24 },
    poort: 'POST /api/bedrijf/lid/rollen'
  },
  {
    id: 'werkruimte.sluiten',
    naam: 'Een werkruimte sluiten',
    eenheid: 'werkruimtes', eenheidEen: 'werkruimte',
    omkeerbaar: true,
    vast: 1,
    gevoelig: false,
    waar: null,
    waaromGeenTempo: 'Er is geen handeling om te tellen.',
    waaromGeenHandeling: 'Er is geen route die een werkruimte sluit. Een werkruimte kan worden aangemaakt en gelezen; sluiten gebeurt vandaag op tenantniveau (kern/tenant/levensloop.js), en dat is een andere handeling met een eigen soort.'
  },
  {
    id: 'tenant.vernietig',
    naam: 'Een tenant vernietigen',
    eenheid: 'tenants', eenheidEen: 'tenant',
    omkeerbaar: false,
    waaromNiet: 'Vernietiging is het doel van de handeling; er is per definitie geen weg terug.',
    vast: 1,
    gevoelig: true,
    /* ZWAAR BIJ EEN. De meter meet volume, en dat is voor bijna alles de goede
       maat -- maar niet voor een handeling die al bij het eerste exemplaar
       onherstelbaar is. Zonder deze ondergrens komt een tenant vernietigen uit
       op "licht", want een is niet veel. Dat is precies de vorm van fout waar
       een risicometer aan doodgaat: hij rekent netjes en het antwoord klopt
       niet. Wie hier een soort bijzet met `minstens`, zegt: het aantal doet er
       niet toe, dit is altijd al erg. */
    minstens: 'uitzonderlijk',
    waaromMinstens: 'Vernietigen is onherstelbaar, en dat geldt al bij de eerste.',
    waaromGeenTempo: 'Deze soort staat al op `minstens: uitzonderlijk` en vraagt dus bij ELKE aanroep een eigen bevestiging. Een budget erbovenop verandert daar niets aan en zou alleen een tweede getal zijn dat hetzelfde zegt.',
    waar: 'POST /api/techniek/tenant/vernietig',
    poort: 'POST /api/techniek/tenant/vernietig'
  }
];

module.exports = { SOORTEN };
