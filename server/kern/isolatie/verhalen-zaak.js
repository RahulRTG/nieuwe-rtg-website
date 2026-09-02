/* DE KRITIEKE GEBRUIKERSVERHALEN -- de ZAAK-baan: een zaak, een gast, het kantoor.

   Los van ./verhalen.js langs dezelfde snede die er al ligt tussen de twee
   schermen: /apps/mijn-isolatie.html (het lid) en /apps/isolatie.html (het
   kantoor). Zonder die scheiding leest een lid op zijn EIGEN scherm dat
   "afrekenen aan de kassa" niet meer werkt -- een zin over iemand anders zijn
   werk, op de plek waar hij besluit of hij zichzelf beschermt.

   Het filteren gebeurt in de METER en niet in de client: twee filters zijn twee
   waarheden, en de client zou dan ook de rijen binnenkrijgen die hij niet mag
   tonen.

   TWEE VONDSTEN DIE HIER BINNENKWAMEN, en het zijn besluiten en geen bugs:

   1. Een horecazaak kan onder `beschermd` niet afrekenen. Elke /api/supplier/-route
      valt onder de functie `supplier` in de bevroren categorie "Partners
      (leveranciers)"; ook het HACCP-temperatuurlogboek en de clubdeur gaan dicht.
      De reden in beschermstand-lijst.js is "een leverancier schrijft hier in onze
      gegevens" -- maar een zaak die haar eigen tafelrekening bijwerkt is precies
      wat LOOPT_DOOR onder "Werk (zaken en personeel)" beschrijft als eigenaar en
      niet als derde. Dat is een tegenspraak in de indeling en een besluit van de
      eigenaar. LET OP: /api/supplier/pos/checkout BEWEEGT GELD via RTG Pay, dus
      die hoort er nooit zomaar uit, wat er ook met de categorie gebeurt.

   2. De uitgang van het kantoor stond dicht. De vijf ceremonieroutes hingen aan
      geen enkele functie en waren dus geen bewezen lezer; ze staan sinds deze
      ronde in openpaden.js EIGEN_UITGANG. Een stand zonder uitgang is een val,
      en dat geldt voor de eigenaar precies zo hard als voor een lid. Pas NA die
      reparatie dragen `kantoor-stand-zetten` en `kantoor-ontsluiten` een belofte. */
'use strict';

const ZAAK = [
  { id: 'zaak-afrekenen', wie: 'zaak', wat: 'een gast laten afrekenen', moetHeel: false,
    paden: ['/api/supplier/horeca/rekening', '/api/supplier/pos/checkout',
      '/api/supplier/tafelticket/afrekenen'],
    waarom: 'GEMETEN dicht onder `beschermd`: de hele partnercategorie is bevroren. Of een zaak die ' +
      'haar eigen rekening bijwerkt daar hoort, is een besluit van de eigenaar' },
  { id: 'zaak-bestelling-opnemen', wie: 'zaak', wat: 'een bestelling opnemen', moetHeel: false,
    paden: ['/api/supplier/horeca/rekening/open', '/api/supplier/horeca/rekening/regel',
      '/api/supplier/horeca/bon/maak'] },
  { id: 'zaak-voedselveiligheid', wie: 'zaak', wat: 'de koeltemperatuur vastleggen', moetHeel: false,
    paden: ['/api/supplier/horeca/haccp/meting', '/api/supplier/horeca/haccp/logboek'],
    waarom: 'een wettelijke registratieplicht die stilvalt door een beveiligingsstand van RTG, is ' +
      'een probleem van de zaak dat wij hebben veroorzaakt' },
  { id: 'zaak-deur-openen', wie: 'zaak', wat: 'de deur van de club openen', moetHeel: false,
    paden: ['/api/supplier/horeca/club/deur'] },
  { id: 'gast-afrekenen', wie: 'gast', wat: 'zelf afrekenen aan tafel', moetHeel: false,
    paden: ['/api/gast/rekening', '/api/gast/betaal'] }
];

const KANTOOR = [
  { id: 'kantoor-stand-zetten', wie: 'kantoor', wat: 'een klant dichtzetten bij een verdenking', moetHeel: true,
    paden: ['/api/techniek/isolatie/zet'],
    waarom: 'verstrengen kent geen ceremonie en mag dus nooit dichtvallen -- ook niet door de stand ' +
      'die er al staat. Dit is de hand die tijdens een incident moet kunnen ingrijpen' },
  { id: 'kantoor-ontsluiten', wie: 'kantoor', wat: 'een stand weer opheffen', moetHeel: true,
    paden: ['/api/techniek/isolatie/ontsluiting', '/api/techniek/isolatie/ontsluiting/stap/opties',
      '/api/techniek/isolatie/ontsluiting/stap', '/api/techniek/isolatie/ontsluiting/commit'],
    waarom: 'een stand zonder uitgang is een val, en een val zet niemand aan. Dit verhaal stond ' +
      'GEMETEN op "werkt niet" tot de vijf paden in EIGEN_UITGANG kwamen' },
  { id: 'kantoor-proefdraaien', wie: 'kantoor', wat: 'zien wat een stand een klant kost', moetHeel: false,
    paden: ['/api/techniek/isolatie/proef'],
    waarom: 'wie besluit een klant dicht te zetten, hoort eerst te zien wat dat die klant kost' }
];

module.exports = { ZAAK, KANTOOR, ZAAKBAAN: [].concat(ZAAK, KANTOOR) };
