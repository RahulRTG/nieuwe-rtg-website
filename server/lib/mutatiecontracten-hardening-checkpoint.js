/* Mutatiecontracten voor de routes die tijdens het B2B2C-hardeningcheckpoint
   zichtbaar werden. Een BLOCKED-contract is hier bewust geen vrijgave: het
   benoemt precies welke herhaal-/volgordeproef nog ontbreekt. Vooral de zes
   Foundation-codehandelingen mogen pas PROTECTED heten nadat een vertraagde
   oude intrekking of rotatie een nieuwere credential aantoonbaar niet raakt. */
'use strict';

const AFGETEKEND = {
  door: 'Codex, handler en actuele hardeningbevinding gelezen; open proef niet als succes aangemerkt',
  op: '2026-09-05'
};

const geblokkeerd = (route, mutatieId, toegang, watErMoetKomen) => [route, {
  mutatieId,
  herkomst: 'mens',
  semantiek: { klasse: 'onbekend' },
  toegang,
  stand: 'BLOCKED_BY_TEST_FIXTURE',
  watErMoetKomen,
  afgetekend: AFGETEKEND
}];

const AUTH = { klasse: 'AUTHENTICATED' };
const OPENBARE_PROJECTIE = {
  klasse: 'PUBLIC',
  waarom: 'het gedeelde scherm heeft nog geen accountsessie; een begrensde eenmalige code of schermtoken is de deur'
};

const foundationCode = (route, mutatieId, onderwerp, handeling) => geblokkeerd(
  route, mutatieId, AUTH,
  'breid het domeincontract uit met de verwachte credential-/rotatie-id en bewijs met een routeproef dat dezelfde ' +
  handeling + ' veilig herhaalt, een afwijkende payload botst en een vertraagde oude ' + handeling +
  ' de later uitgegeven code van ' + onderwerp + ' niet kan raken'
);

const CONTRACTEN = Object.fromEntries([
  geblokkeerd('POST /api/bank/bevries', 'bank.bevries', AUTH,
    'maak een rekeningfixture, voer dezelfde bevriesstand tweemaal uit en bewijs dat status, journaal en saldo na de tweede oproep gelijk blijven'),
  geblokkeerd('POST /api/bedrijf/lid/koppel', 'bedrijf.lid.koppel', AUTH,
    'meet dezelfde accountgebonden koppeling in ontwikkel- en productiestand; bewijs dat herhaling geen andere medewerker koppelt en geen nieuw tijdstip of neveneffect schrijft'),
  geblokkeerd('POST /api/member/vluchten/pass/intrek', 'member.vluchten.pass.intrek', AUTH,
    'herhaal intrekken met dezelfde verwachte rotatie en speel daarna een vertraagde intrekking af na een nieuwe uitgifte; de nieuwe boardingpass moet geldig blijven'),
  geblokkeerd('POST /api/member/vluchten/pass/roteer', 'member.vluchten.pass.roteer', AUTH,
    'bewijs via de echte route dat een retry geen tweede credential uitgeeft of heronthult, dat payloaddrift botst en dat de vorige rotatie een latere pass niet kan wijzigen'),
  geblokkeerd('POST /api/office/hardware/verwijder', 'office.hardware.verwijder', AUTH,
    'maak een hardwareontwerp, verwijder het tweemaal via de route en bewijs de afgesproken tweede status plus exact een verwijder-/auditgevolg'),
  geblokkeerd('POST /api/projectie/kijk', 'projectie.kijk', OPENBARE_PROJECTIE,
    'meet tweemaal kijken met een geldige en een verlopen schermsessie; eventuele migratie, opruiming en intrekking moeten na de eerste oproep stabiel blijven'),
  geblokkeerd('POST /api/projectie/koppel', 'projectie.koppel', OPENBARE_PROJECTIE,
    'meet een echte eenmalige koppelcode tweemaal en bewijs dat hoogstens een schermsessie ontstaat, de code niet herleeft en geen token opnieuw wordt onthuld'),
  geblokkeerd('POST /api/residentie/suite/zet', 'residentie.suite.zet', AUTH,
    'zet een bestaande suite tweemaal op dezelfde toestand en bewijs dat reservering, audit en externe gevolgen niet verdubbelen; test ook een afwijkende tweede payload'),
  foundationCode('POST /api/rtfos/casus/code/intrekken', 'rtfos.casus.code.intrekken', 'de casus', 'intrekking'),
  foundationCode('POST /api/rtfos/casus/code/roteren', 'rtfos.casus.code.roteren', 'de casus', 'rotatie'),
  foundationCode('POST /api/rtfos/donateur/code/intrekken', 'rtfos.donateur.code.intrekken', 'de donateur', 'intrekking'),
  foundationCode('POST /api/rtfos/donateur/code/roteren', 'rtfos.donateur.code.roteren', 'de donateur', 'rotatie'),
  foundationCode('POST /api/rtfos/vrijwilliger/code/intrekken', 'rtfos.vrijwilliger.code.intrekken', 'de vrijwilliger', 'intrekking'),
  foundationCode('POST /api/rtfos/vrijwilliger/code/roteren', 'rtfos.vrijwilliger.code.roteren', 'de vrijwilliger', 'rotatie'),
  geblokkeerd('POST /api/supplier/roster', 'supplier.roster', AUTH,
    'meet de expliciete Magnaat-Test-ingang met een geldige zaak en bewijs dat twee opvragingen uitsluitend lezen; productie moet beide keren gesloten blijven zonder personeelsgegevens'),
  geblokkeerd('POST /api/werkplek/bureau/redactie/artikel/verwijder', 'werkplek.bureau.redactie.artikel.verwijder', AUTH,
    'maak een eigen artikel, verwijder het tweemaal via dezelfde werkruimte en bewijs de afgesproken tweede status, objectgrens en exact een audit-/verwijdergevolg')
]);

module.exports = { CONTRACTEN };
