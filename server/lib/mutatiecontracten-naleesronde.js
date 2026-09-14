/* ============================================================================
   MUTATIECONTRACTEN -- DE NALEESRONDE VAN 13 SEPTEMBER 2026.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Dit bestand draagt de LEZERS; ./mutatiecontracten-naleesronde-b.js de
   beschermde routes en ./mutatiecontracten-naleesronde-c.js die waar een tweede
   oproep met opzet een tweede handeling is.

   WAAROM ZE ER OPEENS ZIJN, want dat is het interessantste aan deze ronde.

   Deze 47 routes stonden op BLOCKED_BY_TEST_FIXTURE -- afgeleid, door een script,
   op grond van een hindernis die de proef terugkreeg. In IDEMPROEF is die
   hindernis verdwenen: de proefwereld kwam er wel bij, en de meting staat nu op
   `beschermd`. De afleidgang liet ze daarop terecht vallen ("de proef kwam er
   niet bij" was niet meer waar), en toen bleek dat er NOOIT een menselijk
   contract onder had gelegen.

   Het was dus VOORUITGANG die eruitzag als achteruitgang, en hij bleef vier
   dagen onzichtbaar omdat MUTATIECONTRACT.json niet was meegeregenereerd: de
   poort in test/mutatiecontract.test.js leest dat ingecheckte artefact, en een
   artefact kan een commit achterlopen. Dezelfde valkuil die EXECUTION_MAP.json
   al een keer heeft opgelost ("de autoriteit komt LIVE en nooit uit een
   bouwartefact").

   DE NALEESRONDE ZELF. Elke route hieronder is gelezen -- de handler, en waar de
   handler doorverwees ook de kernfunctie erachter. Dat was nodig ook: vier
   routes die er als lezers uitzien (personeel/status en de drie mailroutes)
   kennen bij de EERSTE oproep een mailadres toe, en staan daarom in bestand b
   en niet hier.
   ========================================================================== */
'use strict';

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZE IS -- zelfde vorm als
   ./mutatiecontracten-leest.js: gelezen door Claude, niet door een mens
   nagelezen. Wie er een naleest en zijn naam eronder wil zetten, vervangt hem. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), handler en kernfunctie gelezen op 13 september 2026; niet door een mens nagelezen',
  op: '2026-09-13'
};

const OP = '2026-09-12';   // de ronde in IDEMPROEF.json waar de meting vandaan komt

/* HETZELFDE BEWIJS, NEGENTIEN KEER -- dus EEN keer, met de gelezen plek als
   enige variabele. Zie ./mutatiecontracten-beschermd.js voor waarom dat meer is
   dan een besparing: een reeks bijna-gelijke zinnen is de vorm waarin een
   verschil onopgemerkt insluipt. */
const leest = (route, mutatieId, toegang, waar) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'IDEMPROEF-ronde van 12 september 2026: met sleutel `beschermd`, en de opslagmeter zag ' +
      'over beide oproepen geen enkele verandering in de gemeten collecties',
    op: OP
  },
  nagekeken: 'Claude, 2026-09-13: ' + waar + '. Dat is de tweede, onafhankelijke lijn die de ' +
    'opslagmeter niet dekt -- geen save(), geen bestand, geen bericht, geen teller buiten de ' +
    'gemeten collecties.',
  afgetekend: AFGETEKEND
}];

const AUTH = { klasse: 'AUTHENTICATED' };
const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode',
  uitleg: 'de school achter het personeelstoken; personeelVan() geeft nooit een andere school terug' };

const CONTRACTEN = Object.fromEntries([
  /* ---- de kostenlaag: vier vragen die tellers OPTELLEN en er geen zetten ---- */
  leest('POST /api/kosten/mij', 'kosten.mij', AUTH,
    'de handler roept kosten.drager() en eigenBeeld() aan; beide lezen uit de kostenmeter en geven ' +
    'een samenvatting terug. server/routes/kosten.js:36'),
  leest('POST /api/kosten/grens', 'kosten.grens', AUTH,
    'grensVoor() en grensStand() lezen de ingestelde grens; ZETTEN doet de aparte route /grens/zet, ' +
    'die zijn eigen contract heeft. server/routes/kosten.js:66'),
  leest('POST /api/supplier/kosten', 'supplier.kosten', AUTH,
    'dezelfde eigenBeeld() als /api/kosten/mij, met de zaakcode als drager. server/routes/kosten.js:94'),
  leest('POST /api/supplier/kosten/vooruitblik', 'supplier.kosten.vooruitblik', AUTH,
    'kosten.vooruitblik() rekent en bewaart niets. LET OP: scripts/schrijfanalyse.js meldt hier ' +
    '`schrijft: ja` op grond van een Object.assign -- dat is `Object.assign({ ok: true }, ...)`, het ' +
    'bouwen van het ANTWOORD, en precies de valse treffer waarvoor die meter te ruim is verklaard. ' +
    'server/routes/kosten.js:99'),
  leest('POST /api/foundation/kosten', 'foundation.kosten',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
      uitleg: 'het gezin uit gezinVan(), en daarbinnen alleen de beheerder' },
    'de handler leest kosten.voorDrager() voor de gezinsdrager en zet er de belofte bij; er wordt ' +
    'niets weggeschreven. server/foundation/kosten.js'),

  /* ---- RTFoundation: zeven routes die aan de LEESrem hangen ---- */
  leest('POST /api/rtfos/ruil/mijn', 'rtfos.ruil.mijn', AUTH,
    'rtfos.ruil.mijn() filtert de eigen advertenties uit de lijst. De route draagt `leesRem` waar ' +
    'haar buren `schrijfRem` dragen -- een scheiding die een mens in server/routes/rtfos/ruil.js ' +
    'heeft aangebracht, en die hier als tweede lijn meetelt'),
  leest('POST /api/rtfos/gift/stand', 'rtfos.gift.stand', AUTH,
    'rtfos.gift.stand() telt de lopende giften op. Zelfde leesRem-scheiding'),
  leest('POST /api/rtfos/gift/plan/mijn', 'rtfos.gift.plan.mijn', AUTH,
    'plan.mijn() zoekt het eigen periodieke plan op. Zelfde leesRem-scheiding'),
  leest('POST /api/rtfos/gift/projecten', 'rtfos.gift.projecten.lijst', AUTH,
    'projecten.lijst() geeft de vaste lijst uit kern/rtfos/gift-projecten.js. Zelfde leesRem-scheiding'),
  leest('POST /api/rtfos/gift/machtiging/mijn', 'rtfos.gift.machtiging.mijn', AUTH,
    'machtiging.mijn() leest de eigen SEPA-machtiging; TEKENEN doet /machtiging/teken achter ' +
    'schrijfRem. Zelfde leesRem-scheiding'),
  leest('POST /api/rtfos/winkel', 'rtfos.winkel.etalage', AUTH,
    'winkel.etalage() geeft het aanbod; KOPEN doet /winkel/koop achter schrijfRem. Zelfde ' +
    'leesRem-scheiding'),
  leest('POST /api/rtfos/winkel/mijn', 'rtfos.winkel.mijn', AUTH,
    'winkel.mijn() geeft de eigen bestellingen. Zelfde leesRem-scheiding'),

  /* ---- het LivingLab ---- */
  leest('POST /api/lab2/ledger/studie', 'lab2.ledger.studie', AUTH,
    'studieLedger() telt een bestaand grootboek op over een periode. server/routes/livinglab/index.js:124'),

  /* ---- de school: zes schermen die hun eigen stand opvragen ---- */
  leest('POST /api/foundation/school/personeel/start', 'school.personeel.start', SCHOOL,
    'de handler filtert de eigen klassen en roept stappenVan() aan -- een zuivere berekening over ' +
    'wat er al staat. server/school/instap.js:107'),
  leest('POST /api/foundation/school/belasting/mij', 'school.belasting.mij', SCHOOL,
    'telt het eigen werk op uit klassen en toetsen die er al zijn. server/school/belasting.js:67'),
  leest('POST /api/foundation/school/aanwezigheid/leerling', 'school.aanwezigheid.leerling', SCHOOL,
    'loopt de presentielijsten langs en telt per stand; REGISTREREN doet /aanwezigheid/zet. ' +
    'server/school/aanwezigheid.js:83'),
  leest('POST /api/foundation/school/leraar/overzicht', 'school.leraar.overzicht', SCHOOL,
    'filtert de eigen klassen en geeft per klas klasSamenvatting(). server/school/beheer.js:156'),
  leest('POST /api/foundation/school/peiling/mijn-personeel', 'school.peiling.mijnPersoneel', SCHOOL,
    'geeft de open peilingen voor personeel; ANTWOORDEN doet /peiling/antwoord-personeel. ' +
    'server/school/peiling-antwoord.js:75'),
  leest('POST /api/foundation/school/mijn-rechten', 'school.mijnRechten', SCHOOL,
    'rollenVan() en rechtenVan() lezen de rollen van het personeelslid. server/school/rollen.js:142')
]);

module.exports = { CONTRACTEN, AFGETEKEND, OP, AUTH, SCHOOL };
