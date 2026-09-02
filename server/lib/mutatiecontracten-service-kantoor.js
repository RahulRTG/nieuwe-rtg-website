/* ============================================================================
   DE BEDOELING PER SCHRIJFROUTE VAN RTG SERVICE -- DE KANTOORKANT.

   Het vervolg van ./mutatiecontracten-service.js; daar staan de kop, de
   aftekening, de meetronde en de vier vormen die hier worden hergebruikt.
   Gesplitst omdat de eenentwintig samen over de omvangsgrens van keuringsregel
   13 gingen, met de naad op dezelfde plek als bij de routes zelf: het lid
   meldt, het kantoor werkt.

   EEN BEVINDING DIE HIER HOORT TE STAAN. scripts/mutatiecontract.js meldt bij
   deze twaalf een TEGENSPRAAK: hij ziet AUTHENTICATED waar hier
   CAPABILITY_GATED staat. Dat is geen fout aan een van beide kanten.
   scripts/lib/bewakers.js kent `balieAuth` als VERFIJNER binnen officeAuth en
   valt daarom terug op de basisrol; een zetel op naam is inhoudelijk wel
   degelijk een bevoegdheid die iemand kan hebben of niet. De meter ziet wat er
   STAAT, dit register zegt wat de BEDOELING was, en het verschil is precies
   waarvoor die kolom bestaat.
   ========================================================================== */
'use strict';

const { LEEST, TWEEDE, EENMALIG, BESCHERMD, AFGETEKEND, OP, zetel } = require('./mutatiecontracten-service');

const CONTRACTEN = Object.assign({},
  LEEST('POST /api/office/service/wachtrij', 'office.service.wachtrij',
    'serviceZaken.lijst() en tel(), plus de vaste keuzelijsten'),
  LEEST('POST /api/office/service/zaak', 'office.service.zaak',
    'dossier() plus twee lijsten; de machtigingenlijst leest alleen en telt niets af'),
  LEEST('POST /api/office/service/machtigingen', 'office.service.machtigingen',
    'machtiging.lijst() en tel(); stand() rekent uit de klok en schrijft niets terug'),

  TWEEDE('POST /api/office/service/bericht', 'office.service.bericht',
    'Een tweede antwoord aan de melder is een tweede antwoord, ook als het hetzelfde zegt.'),
  TWEEDE('POST /api/office/service/eigenaar', 'office.service.eigenaar',
    'Een zaak op je naam zetten is een regel in de tijdlijn met een mens erbij. De meting bevestigt ' +
    'dat de tweede aanroep die regel opnieuw schrijft.'),
  TWEEDE('POST /api/office/service/weeg', 'office.service.weeg',
    'Een prioriteit overschrijven eist een REDEN, en die hoort bij deze keer. Twee keer dezelfde ' +
    'prioriteit met een andere reden is twee besluiten, en allebei horen ze in de tijdlijn.'),

  BESCHERMD('POST /api/office/service/stand', 'office.service.stand',
    'kern/service/loop.js schrijft geen tweede regel als de zaak al in die stand staat en geeft ' +
    '"de zaak stond al zo" terug'),
  BESCHERMD('POST /api/office/service/koppel', 'office.service.koppel',
    'dezelfde soort en code geven "al gekoppeld" terug; de tijdlijn krijgt geen tweede regel'),
  BESCHERMD('POST /api/office/service/bevestiging/vraag', 'office.service.bevestiging.vraag',
    'een LOPEND verzoek van dezelfde mens, voor dezelfde zaak en dezelfde gevraagde toegang, wordt ' +
    'hergebruikt in plaats van opgestapeld -- anders staan er twee knoppen in de app van het lid'),
  BESCHERMD('POST /api/office/service/machtiging/intrek', 'office.service.machtiging.intrek',
    'ingetrokken blijft ingetrokken; de tweede aanroep laat de machtiging ongewijzigd'),

  /* ---- de patroon-, status- en foutlaag ---- */
  LEEST('POST /api/office/service/patronen', 'office.service.patronen',
    'patronen.vermoedens() en perIncident(); allebei groeperen ze over bestaande zaken'),
  LEEST('POST /api/office/service/foutsignalen', 'office.service.foutsignalen',
    'foutsignaal.lijst() en tel(); lezen uit de kaart, geen teller die oploopt'),

  BESCHERMD('POST /api/office/service/bundel', 'office.service.bundel',
    'een zaak die al aan dit incident hangt wordt overgeslagen en krijgt GEEN tweede bericht. ' +
    'Die bescherming zat er eerst niet: koppel() ving de dubbele koppeling wel af, maar het bericht ' +
    'eronder niet, dus een dubbelklik stuurde twintig melders twee keer dezelfde mededeling'),
  BESCHERMD('POST /api/office/service/incident/hersteld', 'office.service.incident.hersteld',
    'een herstelmelding gaat een keer uit; een tweede aanroep geeft terug wanneer het al gemeld was ' +
    'en verstuurt niets. Ook dit kwam uit de meetronde -- een tweede "de storing is verholpen" maakt ' +
    'de eerste ongeloofwaardig'),
  BESCHERMD('POST /api/office/service/foutsignaal/koppel', 'office.service.foutsignaal.koppel',
    'de zaak wordt alleen toegevoegd als hij er nog niet in staat'),

  EENMALIG('POST /api/office/service/bevestiging/code', 'office.service.bevestiging.code', null,
    'De terugvalcode komt uit op dezelfde eenmalige bevestiging als /api/service/bevestig. Een ' +
    'tweede poging met dezelfde code wordt geweigerd omdat de code op is -- dat is de hele functie ' +
    'van een terugval die niet doorverteld mag worden.', '404'),

  /* DE ENIGE DIE DE PROEFOPSTELLING NIET KON AFMAKEN, en dat wordt hier gezegd
     in plaats van weggeschreven als "geen effect". De aanroep zelf lukte (200,
     twee keer), maar de staatsopname kon het gevolg niet ZIEN: zij leest
     /api/office/service/machtigingen, en die toont alleen de machtigingen van
     de KIJKER. Een tweede handtekening staat per definitie onder de machtiging
     van een COLLEGA, en die is daar dus onzichtbaar. Het gedrag zelf is wel
     vastgelegd in test/servicemachtiging.test.js, op moduleniveau. */
  {
    'POST /api/office/service/machtiging/tekenbij': {
      mutatieId: 'office.service.machtiging.tekenbij',
      semantiek: { klasse: 'idempotent' },
      toegang: { klasse: 'CAPABILITY_GATED', bevoegdheid: zetel },
      stand: 'BLOCKED_BY_TEST_FIXTURE',
      herkomst: 'mens',
      afgetekend: AFGETEKEND,
      bewijs: { gemeten: 'kale ronde: beide aanroepen gaven 200, maar de staatsopname kon het ' +
        'gevolg niet waarnemen -- zie watErMoetKomen', op: OP },
      watErMoetKomen: 'een staatsopname die machtigingen van een ANDERE medewerker kan lezen. ' +
        '/api/office/service/machtigingen filtert op de kijker zelf, en een tweede handtekening ' +
        'staat altijd onder de machtiging van een collega. Ofwel een kantoorroute die alle ' +
        'machtigingen van een zaak toont (die bestaat: /api/office/service/zaak geeft ze mee, maar ' +
        'de proef las hem niet), ofwel de proef laten kijken met de sessie van de aanvrager.'
    }
  }
);

module.exports = { CONTRACTEN, AFGETEKEND };
