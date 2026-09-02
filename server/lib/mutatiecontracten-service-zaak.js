/* ============================================================================
   DE BEDOELING PER SCHRIJFROUTE VAN RTG SERVICE -- DE KANT VAN EEN ZAAK.

   Het derde deel naast ./mutatiecontracten-service.js (het lid) en
   ./mutatiecontracten-service-kantoor.js (het kantoor). Daar staan de kop, de
   aftekening, de meetronde en de vier vormen die hier worden hergebruikt.
   Gesplitst omdat ze samen over de omvangsgrens van keuringsregel 13 gaan, met
   de naad op dezelfde plek als bij de routes zelf: het lid meldt, de zaak meldt,
   het kantoor werkt.

   DEZE TIEN ZIJN DOOR DEZELFDE KALE RONDE GEHAALD als de andere zevenentwintig,
   en de uitslag is spiegelbeeldig aan de ledenkant -- wat klopt, want het is
   dezelfde kern met een andere poort ervoor. Dat is geen aanname geweest: het is
   gemeten, juist omdat "hij doet vast hetzelfde" precies de zin is waarmee een
   verschil onopgemerkt blijft.

   EEN TEGENSPRAAK DIE HIER HOORT TE STAAN, en het is er een van de andere kant
   dan bij het kantoor. scripts/mutatiecontract.js ziet AUTHENTICATED, en dat is
   hier ook precies goed: `supplierAuth` stelt de identiteit van een zaak vast,
   verder niets. Waar deze contracten OBJECT_SCOPED zeggen, gaat het om de
   controle IN de handler (de melder van de zaak moet deze zaak zijn), en die
   ziet de bewakerslezer niet.
   ========================================================================== */
'use strict';

const { LEEST, TWEEDE, EENMALIG } = require('./mutatiecontracten-service');

const CONTRACTEN = Object.assign({},
  LEEST('POST /api/supplier/service/keuzes', 'supplier.service.keuzes',
    'de vaste tabellen uit kern/service/klassen.js plus mens.overnameZaak(); geen opslag'),
  LEEST('POST /api/supplier/service/mijn', 'supplier.service.mijn',
    'serviceZaken.lijst() op de eigen meldersleutel, een filter over de collectie'),
  LEEST('POST /api/supplier/service/zaak', 'supplier.service.zaak',
    'dossier() plus de klokken, allemaal afgeleid uit de tijdlijn'),
  LEEST('POST /api/supplier/service/bevestigingen', 'supplier.service.bevestigingen',
    'bevestiging.voorLid() op de eigen meldersleutel, een filter'),
  LEEST('POST /api/supplier/service/stand', 'supplier.service.stand',
    'persoonlijk.stand(): een filter over de eigen zaken plus patronen.gemeldHersteld()'),

  TWEEDE('POST /api/supplier/service/open', 'supplier.service.open',
    'Twee keer melden is twee meldingen, ook voor een zaak. Samenvoegen is een OORDEEL en hoort bij ' +
    'een mens; een leverancier die hetzelfde nog eens instuurt kan een tweede storing hebben.'),
  TWEEDE('POST /api/supplier/service/bericht', 'supplier.service.bericht',
    'Een tweede bericht is een tweede bericht. Wie hetzelfde twee keer stuurt, heeft het twee keer ' +
    'gezegd, en dat mag een medewerker zien.', 'id'),
  TWEEDE('POST /api/supplier/service/mens', 'supplier.service.mens',
    'Elk verzoek om een mens telt mee; kern/service/mens.js gebruikt dat aantal om te bepalen of er ' +
    'nog mag worden afgeweerd. Idempotent maken zou die grens laten verdwijnen.', 'id'),

  EENMALIG('POST /api/supplier/service/bevestig', 'supplier.service.bevestig',
    'de bevestiging uit `id`; de kern weigert wanneer de melder niet die van het verzoek is',
    'Eenmalig zijn IS de functie: een bevestiging die twee keer werkt, is een machtiging die twee ' +
    'keer opengaat. De tweede aanroep loopt op de toestand stuk ("dit verzoek is gebruikt"), en dat ' +
    'is een toestandscontrole en geen idempotentie.', '400'),
  EENMALIG('POST /api/supplier/service/weiger', 'supplier.service.weiger',
    'de bevestiging uit `id`, en alleen die van deze zaak',
    'Spiegelbeeld van bevestigen: de tweede aanroep loopt op de toestand stuk ("dit verzoek is ' +
    'geweigerd") en niet op een duplicaatregel.', '400')
);

module.exports = { CONTRACTEN };
