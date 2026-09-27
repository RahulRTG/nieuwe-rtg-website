/* ============================================================================
   DE MUTATIECONTRACTEN VAN RTG VRIJHEID EN RTG ZELF ALS WERKGEVER
   (routes/vrijheid/tijd.js, routes/vrijheid/rtghuis.js; VRIJHEID.md).

   EERST HET BEWIJS, DAN HET CONTRACT. test/vrijheid-routes.test.js draait een
   dubbeltik-ronde op een echte server: elke schrijfweg twee keer met hetzelfde
   lijf, en kijken wat er bleef staan. Wat die ronde NIET kon bereiken, staat
   hier als BLOCKED_BY_TEST_FIXTURE met wat er moet komen -- niet als een
   bewering die niemand heeft gemeten.

   Toegang: de router ziet supplierAuth, officeAuth of boardroomAuth; de
   manager-eis (managerOnly) staat IN de handler, en de persoon komt uit de
   sessie en nooit uit het lichaam. Een klasse die de router niet ziet, is een
   bewering en geen grens -- dus AUTHENTICATED, met het verschil uitgeschreven. */
'use strict';

const OP = '2026-09-27';
const AFGETEKEND = { door: 'Claude (Opus 5), op grond van de dubbeltik-ronde in test/vrijheid-routes.test.js; ' +
  'niet door een mens nagelezen', op: OP };
const ZAAK = { klasse: 'AUTHENTICATED', deur: 'supplierAuth',
  let: 'De persoon komt uit de sessie (req.actor.staffId) en de zaak ook (req.supplier.code); het lichaam kan ' +
    'geen ander aanwijzen. Een managerroute toetst managerOnly in de handler.' };
const KANTOOR = { klasse: 'AUTHENTICATED', deur: 'officeAuth' };
const BOARDROOM = { klasse: 'AUTHENTICATED', deur: 'boardroomAuth' };

const leest = (route, mutatieId, toegang, wat) => [route, {
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': de route gaf bij herhaling hetzelfde antwoord. ' + wat, op: OP },
  nagekeken: 'Claude, ' + OP + ': de handler leest via eigencollectie.kijk() (instellingen.lees, motor.orgLees, ' +
    'rtghuis.afdelingenVan) en roept geen vastleggen(), save() of bak() aan; een ontbrekende collectie wordt ' +
    'niet aangemaakt.',
  afgetekend: AFGETEKEND
}];

const toewijzing = (route, mutatieId, toegang, wat) => [route, {
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang, stand: 'PROTECTED',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': twee keer hetzelfde lijf gaf twee keer 200 en een toestand. ' +
    'De route ZET een waarde (een toewijzing, geen toevoeging). ' + wat, op: OP },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/staff/tijd', 'vrijheid.mijntijd', ZAAK, 'Mijn tijd van de medewerker uit de sessie.'),
  leest('POST /api/staff/tijd/uitleg', 'vrijheid.uitleg', ZAAK, 'De opgeslagen stappen van een eigen verzoek; een ander krijgt 404.'),
  leest('POST /api/supplier/tijd/overzicht', 'vrijheid.overzicht', ZAAK, 'Wat op een mens wacht, de bezetting en wat ontbreekt.'),
  leest('POST /api/supplier/rtg/afdelingen', 'rtghuis.afdelingen', ZAAK, 'De kamers en wie erin zit; een andere zaak krijgt 404.'),
  leest('POST /api/office/rtghuis', 'rtghuis.stand', KANTOOR, 'Of RTG een eigen zaak heeft, en de kamers.'),

  toewijzing('POST /api/staff/tijd/verjaardag', 'vrijheid.verjaardag', ZAAK, 'Twee keer 11-11 liet 11-11 staan.'),
  toewijzing('POST /api/supplier/tijd/bezetting', 'vrijheid.bezetting', ZAAK, 'Twee keer dezelfde eis liet een eis staan.'),
  toewijzing('POST /api/supplier/tijd/feestdagen', 'vrijheid.feestdagen', ZAAK, 'Twee keer 2026-12-25 liet een datum staan.'),

  ['POST /api/office/rtghuis/maak', {
    mutatieId: 'rtghuis.maak', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: BOARDROOM,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': de tweede oproep kwam terug met 409 ("RTG heeft al een ' +
      'eigen zaak") en er bleef precies een zaak met genre rtg. Een toestandscontrole en geen duplicaatlaag ' +
      '(MUTATIECONTRACT.md par. 5o): er KAN geen tweede ontstaan.', op: OP },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/staff/tijd/verzoek', {
    mutatieId: 'vrijheid.verzoek', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: ZAAK,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een verzoek dat is afgewezen, opnieuw indienen is een NIEUWE vraag: de dekking, het rooster of ' +
      'het beleid kan intussen anders zijn, en de medewerker hoort een eigen antwoord te krijgen. Een verzoek ' +
      'dat nog LOOPT, wordt niet dubbel (409 "U heeft dit verzoek al lopen"), en met een sleutel komt hetzelfde ' +
      'verzoek terug -- de client die een dubbeltik wil uitsluiten, geeft er een mee.',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': met sleutel gaven twee oproepen hetzelfde verzoek-id en ' +
      'herhaling: true; zonder sleutel en na een weigering (BLOCKED_BY_LAW_OR_POLICY) gaven ze twee ' +
      'verschillende ids, allebei DECLINED. Het lopende geval (409) is bewezen in test/vrijheid.test.js ' +
      '("idempotent en geen dubbele aanvraag").', op: OP },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/staff/tijd/intrekken', {
    mutatieId: 'vrijheid.intrekken', herkomst: 'mens', semantiek: { klasse: 'hooguitEens' }, toegang: ZAAK,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'Een zaak aan een vestiging van een entiteit met een lopend dienstverband voor de ' +
      'aanvrager, zodat een verzoek niet op BLOCKED eindigt maar LOOPT en er iets in te trekken valt. De ' +
      'proef bereikte alleen een afgewezen verzoek (409, "kan niet meer worden ingetrokken").',
    nagekeken: 'Claude, ' + OP + ': motor.trekIn gaat langs standen.js; CANCELLED is een eindstand, dus een ' +
      'tweede intrekking is 409 (test/vrijheid.test.js dekt de standmachine).',
    afgetekend: AFGETEKEND
  }],

  ['POST /api/supplier/tijd/beoordeel', {
    mutatieId: 'vrijheid.beoordeel', herkomst: 'mens', semantiek: { klasse: 'hooguitEens' }, toegang: ZAAK,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'Een verzoek in HUMAN_REVIEW: een aanvrager met een lopend dienstverband bij de entiteit ' +
      'van de zaak, en een verzoek dat een mens vraagt (bijzonder of onbetaald verlof). De proef kwam tot een ' +
      'onbekend id (404).',
    nagekeken: 'Claude, ' + OP + ': beoordeelMens weigert alles buiten HUMAN_REVIEW met 409, dus een tweede ' +
      'besluit op hetzelfde verzoek kan niet (test/vrijheid.test.js, "twee managers").',
    afgetekend: AFGETEKEND
  }],

  ['POST /api/supplier/rtg/afdeling', {
    mutatieId: 'rtghuis.afdeling', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: ZAAK,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'Een ingelogde leidinggevende VAN DE RTG-ZAAK. Die logt in met zijn persoonlijke ' +
      'RTG-account (createAccountStaff) en de proef kent alleen de pinlogin van de zaaiset; zij bereikte ' +
      'deze route alleen als KIKUNOI (404, geen kamers).',
    nagekeken: 'Claude, ' + OP + ': afdelingZet ZET de kamers van een medewerker (toewijzing); test/rtghuis.test.js ' +
      'bewijst dat dubbele kamers samenvallen en een lege lijst de medewerker eruit haalt.',
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
