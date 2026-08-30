/* ============================================================================
   HET MUTATIECONTRACTREGISTER -- de poort en de lat.

   Twee dingen worden hier afgedwongen, en ze zijn allebei een grens en geen
   gewoonte:

   1. LEGACY_PENDING_CLASSIFICATION MAG ALLEEN KRIMPEN. Dezelfde vorm als
      IDEMSCHULD.json en BEWIJSSCHULD.json. Zonder die regel is een register van
      onbekenden een lijst die vanzelf meegroeit met de code, en dan is hij geen
      schuld maar een decor.

   2. EEN NIEUWE SCHRIJFROUTE HEEFT EEN CONTRACT. De 4653 die er al staan zijn
      een erfenis; wat er vanaf nu bijkomt is een keuze. Dit is de regel die van
      het register een poort maakt in plaats van een rapport -- en het is precies
      de vorm die kern/mutatie.js al gebruikt aan de rand van het platform:
      niet met terugwerkende kracht alles, wel alles wat nieuw is.

   En de derde, die geen poort is maar een lat: elke stand die TOESTEMMING geeft
   om niets te doen (INTENTIONALLY_NON_IDEMPOTENT, NOT_APPLICABLE) eist bewijs.
   Wie daar zonder meting mag landen, heeft een knop gevonden waarmee 4653 routes
   in een middag "geclassificeerd" zijn.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const contract = require('../server/kern/mutatiecontract');
const mutatie = require('../server/kern/mutatie');
const { CONTRACTEN } = require('../server/lib/mutatiecontracten');
/* De afgeleide helft is een REGISTER en geen broncode: 2722 gegenereerde
   regels JavaScript zijn 1,1 MB die niemand leest, en scripts/check.js hield ze
   terecht tegen op de bestandsgrens. Data hoort in een register. */
let AFGELEID = {};
try {
  AFGELEID = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'MUTATIECONTRACT-AFGELEID.json'), 'utf8')).contracten || {};
} catch (e) {}

const WORTEL = path.join(__dirname, '..');
const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIECONTRACT.json'), 'utf8'));

/* ---------------------------------------------------------------------------
   DE VOCABULAIRES
   ------------------------------------------------------------------------- */

test('de standen en de toegangsklassen zijn precies de zes die zijn afgesproken', () => {
  assert.deepStrictEqual(contract.STATUSNAMEN, ['PROTECTED', 'INTENTIONALLY_NON_IDEMPOTENT',
    'NOT_APPLICABLE', 'UNTESTABLE_WITH_JUSTIFIED_REASON', 'BLOCKED_BY_TEST_FIXTURE',
    'LEGACY_PENDING_CLASSIFICATION']);
  assert.deepStrictEqual(contract.TOEGANGNAMEN, ['PUBLIC', 'AUTHENTICATED', 'CAPABILITY_GATED',
    'OBJECT_SCOPED', 'SERVICE_TO_SERVICE', 'SYSTEM_INTERNAL']);
});

test('er is precies EEN stand die naar nul moet', () => {
  const naarNul = contract.STATUSNAMEN.filter(n => contract.STATUS[n].naarNul);
  assert.deepStrictEqual(naarNul, ['LEGACY_PENDING_CLASSIFICATION'],
    'zou een tweede stand naar nul moeten, dan wordt de architectuur verbogen om een percentage; ' +
    'een route die met opzet niet idempotent is, is KLAAR zodra dat vaststaat');
});

test('dit bestand definieert geen tweede semantiek-woordenlijst', () => {
  /* De duurste fout die SEMANTIEK.json in dit huis vond: twee bestanden met
     allebei een VERMOGENS en nul gedeelde leden. De semantiek woont in
     kern/mutatie.js, en hier hoort geen enkele klassenaam uit die lijst opnieuw
     te worden verzonnen. */
  const hier = new Set([...contract.STATUSNAMEN, ...contract.TOEGANGNAMEN].map(s => s.toLowerCase()));
  for (const naam of mutatie.NAMEN) {
    assert.ok(!hier.has(String(naam).toLowerCase()),
      'de klasse "' + naam + '" staat in kern/mutatie.js EN in kern/mutatiecontract.js -- ' +
      'twee huizen voor een begrip lopen uiteen, en dan zegt geen van beide nog iets');
  }
});

/* ---------------------------------------------------------------------------
   DE KEURING: standen die toestemming geven, eisen bewijs
   ------------------------------------------------------------------------- */

const basis = {
  mutatieId: 'proef.handeling', route: 'POST /api/proef', herkomst: 'mens',
  semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'AUTHENTICATED' },
  afgetekend: { door: 'de toets zelf, als vaste invulling', op: '2026-08-30' }
};

/* ---------------------------------------------------------------------------
   DE HERKOMST: wat een script mag zeggen, en wat niet
   ------------------------------------------------------------------------- */

test('een contract zonder herkomst wordt geweigerd', () => {
  const zonder = { ...basis, stand: 'PROTECTED', bewijs: { gemeten: 'x', op: 'y' } };
  delete zonder.herkomst;
  assert.ok(contract.keur(zonder).some(x => /geen herkomst/.test(x)));
});

test('alleen BLOCKED_BY_TEST_FIXTURE mag door een script zijn geschreven', () => {
  /* Dit is de grens tussen een register dat iets waard is en een dat vol staat.
     Vijf standen doen een uitspraak over GEDRAG, en geen meting leest de
     bedoeling van een handeling af. Zonder deze regel schrijft een script in een
     middag 4653 contracten en betekent "100% geclassificeerd" niets meer. */
  for (const stand of ['PROTECTED', 'INTENTIONALLY_NON_IDEMPOTENT', 'NOT_APPLICABLE',
    'UNTESTABLE_WITH_JUSTIFIED_REASON']) {
    const f = contract.keur({ ...basis, herkomst: 'afgeleid', stand,
      waarom: 'x', nagekeken: 'een methode met een naam en een datum', watErMoetKomen: 'x',
      bewijs: { gemeten: 'x', op: 'y' } });
    assert.ok(f.some(x => /herkomst "afgeleid"/.test(x)), stand + ' mag niet afgeleid zijn');
  }
  const blocked = contract.keur({ ...basis, herkomst: 'afgeleid', stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'een gezin met een geldige code' });
  assert.deepStrictEqual(blocked, [], 'BLOCKED zegt juist dat we het NIET weten, en dat mag een script zeggen');
});

test('elk afgeleid contract staat op BLOCKED en deugt', () => {
  const rijen = Object.entries(AFGELEID).map(([route, c]) => ({ route, ...c }));
  const fouten = rijen.flatMap(c => contract.keur(c));
  assert.deepStrictEqual(fouten.slice(0, 3), [], fouten.slice(0, 3).join('\n  '));
  for (const r of rijen) {
    assert.strictEqual(r.stand, 'BLOCKED_BY_TEST_FIXTURE', r.route + ' is afgeleid maar staat op ' + r.stand);
    assert.strictEqual(r.herkomst, 'afgeleid');
  }
});

test('geen enkele route staat in beide lijsten', () => {
  /* Een mens wint van een script, maar twee regels voor dezelfde route is een
     bron van verwarring die je niet wilt uitleggen. De afleidgang slaat alles
     over wat al een menselijk contract heeft; deze toets bewaakt dat. */
  const dubbel = Object.keys(AFGELEID).filter(r => CONTRACTEN[r]);
  assert.deepStrictEqual(dubbel, [], 'staat in beide: ' + dubbel.slice(0, 5).join(', '));
});

test('PROTECTED zonder meting wordt geweigerd', () => {
  const f = contract.keur({ ...basis, stand: 'PROTECTED' });
  assert.ok(f.some(x => /PROTECTED zonder meting/.test(x)), f.join(' | '));
});

test('INTENTIONALLY_NON_IDEMPOTENT eist EN een reden EN een meting', () => {
  const zonderBeide = contract.keur({ ...basis, stand: 'INTENTIONALLY_NON_IDEMPOTENT' });
  assert.ok(zonderBeide.some(x => /zonder waarom/.test(x)));
  assert.ok(zonderBeide.some(x => /zonder meting/.test(x)));
  const alleenReden = contract.keur({ ...basis, stand: 'INTENTIONALLY_NON_IDEMPOTENT', waarom: 'een worp is een worp' });
  assert.ok(alleenReden.some(x => /zonder meting/.test(x)),
    '"het hoort zo" en "het gebeurt ook zo" zijn twee beweringen; juist hier moeten ze allebei waar zijn');
});

test('NOT_APPLICABLE eist dat een MENS de handler heeft nagekeken', () => {
  const f = contract.keur({ ...basis, stand: 'NOT_APPLICABLE', bewijs: { gemeten: 'niets', op: '2026-08-29' } });
  assert.ok(f.some(x => /nagekeken/.test(x)),
    'de meter ziet alleen de collecties in de database; een bestand of een externe dienst ziet hij niet');
});

test('UNTESTABLE zonder reden is gewoon LEGACY met een net gezicht', () => {
  const f = contract.keur({ ...basis, stand: 'UNTESTABLE_WITH_JUSTIFIED_REASON' });
  assert.ok(f.some(x => /zonder reden/.test(x)));
});

test('BLOCKED_BY_TEST_FIXTURE zonder opdracht is een wachtkamer', () => {
  const f = contract.keur({ ...basis, stand: 'BLOCKED_BY_TEST_FIXTURE' });
  assert.ok(f.some(x => /watErMoetKomen/.test(x)));
});

test('CAPABILITY_GATED noemt de bevoegdheid, OBJECT_SCOPED het veld, PUBLIC de reden', () => {
  assert.ok(contract.keur({ ...basis, toegang: { klasse: 'CAPABILITY_GATED' }, stand: 'LEGACY_PENDING_CLASSIFICATION' })
    .some(x => /NAAM van de bevoegdheid/.test(x)));
  assert.ok(contract.keur({ ...basis, toegang: { klasse: 'OBJECT_SCOPED' }, stand: 'LEGACY_PENDING_CLASSIFICATION' })
    .some(x => /objectVeld/.test(x)));
  assert.ok(contract.keur({ ...basis, toegang: { klasse: 'PUBLIC' }, stand: 'LEGACY_PENDING_CLASSIFICATION' })
    .some(x => /PUBLIC zonder reden/.test(x)));
});

test('een volledig contract komt er zonder klachten door', () => {
  const f = contract.keur({ ...basis, stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde: de herhaling liet niets achter', op: '2026-08-29' } });
  assert.deepStrictEqual(f, []);
});

/* ---------------------------------------------------------------------------
   DE POORT OP HET REGISTER
   ------------------------------------------------------------------------- */

test('elk contract in server/lib/mutatiecontracten.js deugt', () => {
  /* De poort werpt; hier vangen we hem zodat de melding leesbaar is. */
  const rijen = Object.entries(CONTRACTEN).map(([route, c]) => ({ route, ...c }));
  const fouten = rijen.flatMap(c => contract.keur(c));
  assert.deepStrictEqual(fouten, [], fouten.join('\n  '));
});

test('LEGACY_PENDING_CLASSIFICATION mag alleen krimpen', () => {
  /* Het getal in het register is de bovengrens. Groeit hij, dan is er een
     schrijfroute bijgekomen zonder contract -- en dat is precies wat deze poort
     tegenhoudt. Wie het getal legitiem ziet stijgen (een heel domein erbij),
     verhoogt de grens BEWUST in dit bestand, met de reden in de commit.

     SINDS 30 AUGUSTUS 2026 STAAT HIJ OP NUL. Alle 4653 schrijfroutes dragen een
     contract, en dan is elke andere bovengrens een marge voor iets waarvan
     niemand kan zeggen wat het is. Vanaf hier is de poort niet meer "het mag
     niet groeien" maar "het mag niet BESTAAN": een nieuwe schrijfroute zonder
     contract laat deze toets meteen zakken, en dat is het besluit van de
     eigenaar over de releasepoort. */
  const GRENS = 0;
  const nu = register.gemeten.perStand.LEGACY_PENDING_CLASSIFICATION || 0;
  assert.ok(nu <= GRENS,
    'er staan ' + nu + ' onverklaarde schrijfroutes en de grens is ' + GRENS + '. ' +
    'Een nieuwe schrijfroute hoort een contract te krijgen in server/lib/mutatiecontracten.js ' +
    'VOORDAT hij bestaat -- zie de kop van dat bestand.');
});

test('het register telt hetzelfde als de mutatie-inventaris', () => {
  /* Twee meters die hetzelfde universum tellen en verschillende getallen geven,
     is hoe "het aantal routes" in dit huis vier verschillende waarden kreeg. */
  const inv = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIEINVENTARIS.json'), 'utf8'));
  assert.strictEqual(register.gemeten.totaal, inv.inventarissen.mutatieBuitenSchakel,
    'MUTATIECONTRACT telt ' + register.gemeten.totaal + ' schrijfroutes en MUTATIEINVENTARIS ' +
    inv.inventarissen.mutatieBuitenSchakel + '; een percentage tussen twee zulke noemers is fictie');
});

test('geen enkele UITSPRAAK OVER GEDRAG is door een script gezet', () => {
  /* De grens die het register eerlijk houdt. Een rij die beweert dat een route
     beschermd is, niets verandert, of met opzet een tweede handeling doet, moet
     in server/lib/mutatiecontracten.js staan -- door een mens. Alleen
     BLOCKED_BY_TEST_FIXTURE mag uit de afleidgang komen, want die zegt juist dat
     we het NIET weten.

     Zonder deze toets stond het register binnen een uur op 100% en wist niemand
     meer wat dat betekende. */
  const doorMens = new Set(Object.keys(CONTRACTEN));
  for (const r of register.rijen) {
    if (r.stand === 'LEGACY_PENDING_CLASSIFICATION') continue;
    if (r.stand === 'BLOCKED_BY_TEST_FIXTURE') {
      assert.ok(r.herkomst === 'afgeleid' || doorMens.has(r.route),
        r.route + ' staat op BLOCKED zonder herkomst');
      continue;
    }
    assert.ok(doorMens.has(r.route),
      r.route + ' staat op ' + r.stand + ' -- een uitspraak over gedrag -- zonder verklaring in ' +
      'server/lib/mutatiecontracten.js');
    assert.strictEqual(r.herkomst, 'mens', r.route + ' doet een uitspraak over gedrag met herkomst ' + r.herkomst);
  }
});

test('elke route in de inventaris is OF gemeten OF heeft een contract dat zegt waarom niet', () => {
  /* De bak "niet gemeten" hoort leeg te zijn. Een route die de proef nooit heeft
     aangeroepen EN geen contract draagt, is onzichtbaar: hij staat nergens als
     probleem en nergens als besluit. Tien routes met een pad-parameter zaten zo
     in het register -- de proef slaat die met opzet over, want een verzonnen id
     meet niets, en daarmee viel er ook nooit iets over te zeggen. */
  const zonderBeide = register.rijen.filter(r => !r.bewijs && r.stand === 'LEGACY_PENDING_CLASSIFICATION');
  assert.deepStrictEqual(zonderBeide.map(r => r.route), [],
    'deze routes zijn nooit gemeten en dragen geen contract: ze zijn onzichtbaar in beide richtingen');
});

/* ---------------------------------------------------------------------------
   DE AFTEKENING -- besluit van de eigenaar, 30 augustus 2026
   ------------------------------------------------------------------------- */

test('een contract zonder aftekening wordt geweigerd', () => {
  const zonder = { ...basis, stand: 'PROTECTED', bewijs: { gemeten: 'x', op: '2026-08-30' } };
  delete zonder.afgetekend;
  assert.ok(contract.keur(zonder).some(x => /geen aftekening/.test(x)));
});

test('een aftekening zonder datum, of met een initiaal, telt niet', () => {
  const met = (afgetekend) => contract.keur({ ...basis, stand: 'PROTECTED',
    bewijs: { gemeten: 'x', op: '2026-08-30' }, afgetekend });
  assert.ok(met({ door: 'Claude (Opus 5), gemeten', op: 'gisteren' }).some(x => /geen datum/.test(x)));
  assert.ok(met({ door: 'CI', op: '2026-08-30' }).some(x => /te weinig/.test(x)),
    'een initiaal is geen aftekening; het veld moet zeggen WIE of WAT');
});

test('elk contract in het register draagt een aftekening met een datum', () => {
  for (const [route, c] of Object.entries(CONTRACTEN)) {
    assert.ok(c.afgetekend && c.afgetekend.door, route + ' is niet afgetekend');
    assert.match(String(c.afgetekend.op), /^\d{4}-\d{2}-\d{2}$/, route + ' heeft geen datum');
  }
});

test('de aftekening liegt niet over wie er heeft gekeken', () => {
  /* De 106 die er staan zijn opgesteld door Claude op grond van een meting plus
     een bestaand besluit -- niet door een mens die ze een voor een las. Zou daar
     een menselijke naam onder staan, dan verdwijnt precies het onderscheid dat
     de rest van dit register overeind houdt. Wie er een naleest, vervangt hem. */
  for (const [route, c] of Object.entries(CONTRACTEN)) {
    const door = String(c.afgetekend.door);
    if (/Claude/.test(door)) continue;
    assert.ok(!/^[A-Z][a-z]+$/.test(door),
      route + ' is afgetekend met alleen een naam ("' + door + '"); zeg erbij waarop dat oordeel rust');
  }
});

test('de routes onder het bewijsbesluit deugen, en overschrijven niets', () => {
  /* Besluit van de eigenaar, 30 augustus 2026: twee onafhankelijke
     runtime-metingen die allebei nul lezen is voldoende grond voor
     NOT_APPLICABLE. Deze toets bewaakt de drie dingen die dat besluit eerlijk
     houden.

     MUTATIEPROEF: zet een van de drie asserts om -- geef een route een tweede
     stand, haal `nagekeken` weg, of laat effectroutes.json een route dragen die
     al in ./mutatiecontracten-leest.js staat -- en deze toets zakt. */
  const effect = require('../server/lib/mutatiecontracten-effect');
  const namen = Object.keys(effect);
  assert.ok(namen.length > 700, 'de lijst is niet leeggelopen: ' + namen.length);

  /* PUBLIC ZONDER REDEN IS EEN GAT. Dertien contracten uit dit script kwamen er
     zo uit toen de publieke lijst als toegangsbron werd toegevoegd; de keuring
     ving ze. Deze assert houdt dat vast op de plek waar het ontstaat. */
  for (const route of namen) {
    const t = effect[route].toegang;
    if (t.klasse === 'PUBLIC') assert.ok(t.waarom && t.waarom.length > 10,
      route + ': PUBLIC zonder reden -- de reden staat in scripts/lib/publiekeroutes.js en hoort mee te reizen');
  }

  // 1. elk contract komt door dezelfde keuring als alle andere
  const fouten = namen.flatMap(route => contract.keur({ route, ...effect[route] }));
  assert.deepStrictEqual(fouten.slice(0, 3), [], fouten.slice(0, 3).join('\n  '));

  // 2. ze staan allemaal op NOT_APPLICABLE en noemen wat de meter NIET ziet
  for (const route of namen) {
    const c = effect[route];
    assert.strictEqual(c.stand, 'NOT_APPLICABLE', route);
    assert.match(c.nagekeken, /effectmeter/, route + ': het bewijs noemt de meter niet');
    assert.match(c.nagekeken, /NIET ziet/, route + ': het contract zegt niet waarover de meter zwijgt');
    assert.match(c.afgetekend.door, /bewijsstandaard/,
      route + ': de aftekening verzwijgt dat dit een besluit over een standaard is');
  }

  // 3. geen van hen overschrijft een specifieker contract
  const eerder = Object.assign({},
    require('../server/lib/mutatiecontracten-beschermd').CONTRACTEN,
    require('../server/lib/mutatiecontracten-leest').CONTRACTEN,
    require('../server/lib/mutatiecontracten-tweedehandeling').CONTRACTEN,
    require('../server/lib/mutatiecontracten-padparameter').CONTRACTEN);
  const botsing = namen.filter(n => n in eerder);
  assert.deepStrictEqual(botsing, [], 'een besluit over een standaard mag nooit over een gelezen contract heen');
});
