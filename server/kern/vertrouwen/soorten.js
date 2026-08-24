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
    /* EEN GAT, EN GEEN BESLUIT. Een poort die nooit kan afgaan is een bewering
       zonder inhoud: deze route zet EEN mens per aanroep uit dienst en de meter
       meet volume per aanroep, dus een van de vijf komt nooit boven "licht"
       uit. De grens op een zetten is geen oplossing maar ruis -- dan kost elke
       gewone uitdiensttreding een bevestiging (VERTROUWEN.md par. 3.7).

       Wat een zuivering WEL verraadt is een TEMPO: vijf op een dag. Dat is een
       andere meting dan deze en hij bestaat hier nog niet. Vandaar
       `waaromNogGeenPoort` en niet `waaromGeenPoort`: dit telt mee als
       openstaand punt tot die meting er is. */
    waaromNogGeenPoort: 'De meter weegt volume per aanroep en deze route raakt een mens per keer, dus een drempel kan hier niet afgaan. Wat een zuivering verraadt is tempo over tijd, en die meting bestaat in deze laag nog niet.'
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
    waar: 'POST /api/techniek/tenant/vernietig',
    poort: 'POST /api/techniek/tenant/vernietig'
  }
];

module.exports = { SOORTEN };
