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
const { execFileSync } = require('child_process');

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

/* ---------------------------------------------------------------------------
   DE LOGICA WAAR HET REGISTER OP RUST -- en waarom deze toetsen er zijn.

   De mutatiemotor liet dit bestand een keer OVERLEVEN: drieendertig mutaties in
   acht modules, en geen ervan viel op. Dat kwam doordat zes van die acht modules
   VERKLARINGEN zijn (objecten met contracten), en een gewijzigde reden in een
   contract hoort geen toets te laten zakken. De twee die wel logica dragen --
   kern/mutatie.js en kern/mutatiecontract/index.js -- werden nauwelijks geraakt,
   want dit bestand keek er niet naar.

   Dat is precies de vorm waar dit huis een meter voor heeft: `toetsenOngevoeligPct`
   liep van 1,0 naar 1,1 en de normratel hield hem tegen. De reparatie is niet de
   norm verlagen maar de toets grip geven op wat hij bewaakt.

   magHerhalen() is die logica. Het hele contractregister rust erop: `sleutelVereist`
   betekent "herhalen mag, maar alleen met dezelfde sleutel", en `hooguitEens`
   betekent "nooit automatisch". Draait iemand een van die twee om, dan verandert
   de betekenis van honderden contracten in stilte.
   ------------------------------------------------------------------------- */

test('magHerhalen doet precies wat de klassen beloven', () => {
  const { magHerhalen, KLASSEN } = mutatie;

  // idempotent: herhalen mag, met of zonder sleutel
  assert.equal(magHerhalen('idempotent', false), true);
  assert.equal(magHerhalen('idempotent', true), true);

  // sleutelVereist: ALLEEN met sleutel -- dit is de kern van de geldgrens
  assert.equal(magHerhalen('sleutelVereist', false), false,
    'zonder sleutel is een sleutelVereiste handeling een TWEEDE handeling');
  assert.equal(magHerhalen('sleutelVereist', true), true);

  // de drie die nooit automatisch herhaald mogen worden, ook niet met sleutel
  for (const k of ['hooguitEens', 'compenseerbaar', 'nietHerhaalbaar', 'onbekend']) {
    assert.equal(magHerhalen(k, false), false, k + ' mag niet herhalen zonder sleutel');
    assert.equal(magHerhalen(k, true), false, k + ' mag ook MET een sleutel niet automatisch herhalen');
  }

  // een klasse die niet bestaat is geen vrijbrief
  assert.equal(magHerhalen('verzonnen', true), false, 'een onbekende klasse geeft nooit toestemming');
  assert.equal(magHerhalen(null, true), false);

  /* En de tabel zelf: elke klasse noemt allebei de vlaggen expliciet. Een
     ontbrekende vlag leest als `undefined` en dus als "nee", en dat is een
     stilzwijgend besluit op de verkeerde plek. */
  for (const [naam, d] of Object.entries(KLASSEN)) {
    assert.equal(typeof d.herhaalbaar, 'boolean', naam + ' noemt `herhaalbaar` niet');
    assert.equal(typeof d.sleutelNodig, 'boolean', naam + ' noemt `sleutelNodig` niet');
    assert.ok(d.uitleg && d.uitleg.length > 20, naam + ' heeft geen uitleg die een mens verder helpt');
  }
});

test('de poort weigert een opdracht zonder bruikbare mutatieklasse', () => {
  const { poort } = mutatie;
  /* De poort GOOIT bij een fout en geeft anders `true` -- met opzet, want hij
     draait bij het opbouwen van een publieke laag en niet bij een verzoek: een
     opdracht zonder klasse hoort de server niet te laten starten. Dat maakt de
     naam van de plek ook belangrijk, en die staat in de melding. */
  assert.equal(poort({ goed: { mutatie: 'idempotent' } }, 'proef'), true,
    'een opdracht met een geldige klasse komt er gewoon door');

  assert.throws(() => poort({ stil: {} }, 'proefplek'),
    /noemt geen mutatieklasse/, 'een opdracht zonder klasse hoort de bouw te stoppen');
  assert.throws(() => poort({ raar: { mutatie: 'bestaatniet' } }, 'proefplek'),
    /bestaat niet/, 'een verzonnen klasse is geen klasse');

  /* `onbekend` is met opzet GEEN vrijbrief aan de rand van het platform: hij
     bestaat wel als klasse, maar een publieke opdracht mag er niet op staan. */
  assert.throws(() => poort({ ongemeten: { mutatie: 'onbekend' } }, 'proefplek'),
    /onbekend/, 'ongemeten is aan de rand een weigering en geen waarde');

  /* En de melding noemt WELKE plek het betreft -- zonder dat weet niemand waar
     hij moet zoeken. */
  assert.throws(() => poort({ stil: {} }, 'de-derde-verdieping'), /de-derde-verdieping/);
});

test('elk contract in server/lib/mutatiecontracten.js deugt', () => {
  /* De poort werpt; hier vangen we hem zodat de melding leesbaar is. */
  const rijen = Object.entries(CONTRACTEN).map(([route, c]) => ({ route, ...c }));
  const fouten = rijen.flatMap(c => contract.keur(c));
  assert.deepStrictEqual(fouten, [], fouten.join('\n  '));
});

/* DE ZEVENENVEERTIG DIE BEKEND EN ONVERKLAARD ZIJN -- een besluit van de
   eigenaar op 13 september 2026, met de reden en het adres van wat hen weghaalt.

   WAAROM DIT GEEN LOSSE BOVENGRENS IS. Een getal verhogen laat een RUILING door:
   wie een van deze routes indeelt en tegelijk een nieuwe onverklaarde toevoegt,
   houdt het aantal gelijk en de poort groen. Daarom staan ze bij NAAM. Een route
   die hier niet in staat, laat de toets meteen zakken -- voor nieuwe schrijfroutes
   is de eis dus onveranderd nul, precies zoals op 30 augustus is besloten.

   HOE ZE HIER KWAMEN, want dat is geen verslapping. Tot 12 september meldde het
   register nul, en dat was een ARTEFACT: een ronde met `--afleiden --vastleggen`
   samen schreef een register dat de afgeleide set beschreef die het net had
   vervangen (3189 tegen 3142, verschil precies 47). Die oorzaak is gerepareerd in
   scripts/mutatiecontract.js; deze 47 zijn wat er daarna zichtbaar werd. Ze zijn
   hun afgeleide regel kwijtgeraakt doordat de verse idempotentieproef geen
   hindernis meer vond, en BLOCKED_BY_TEST_FIXTURE zegt juist "de proef kwam er
   niet bij".

   WAT HEN WEGHAALT, en het is handwerk en geen ronde: van de 47 stelt de meter
   er 37 voor als NOT_APPLICABLE (een POST die leest -- twee meters, twee keer
   nul), 2 als PROTECTED met "na te kijken", en 8 dragen geen voorstel omdat de
   herhaling het werk opnieuw deed. Die laatste tien vragen een oordeel over de
   BEDOELING, en dat leest niemand uit een meting af (zie de kop van
   server/lib/mutatiecontracten.js). Deze lijst mag daarom alleen KRIMPEN. */
const BEKEND_OPEN = Object.freeze([
  /* LEEG SINDS 13 SEPTEMBER 2026, en dat is de bedoeling van deze lijst.

     De 47 hierboven zijn met de hand geclassificeerd in PR #252 en staan nu in
     server/lib/mutatiecontracten-afleidrest*.js. Een verse ronde meldt over 4933
     schrijfroutes nul LEGACY_PENDING_CLASSIFICATION, dus er is niets meer om uit
     te zonderen -- en de toets hieronder zegt het zelf: een uitzondering die niet
     meer geldt, is een alibi.

     DE LIJST BLIJFT STAAN, leeg. Hij is de vorm waarin een volgende schuld bij
     NAAM wordt opgeschreven in plaats van als opgehoogd getal; die keuze staat
     hierboven uitgeschreven en is niet ingetrokken, alleen afbetaald. */
]);

test('LEGACY_PENDING_CLASSIFICATION mag alleen krimpen', () => {
  /* Twee beweringen, en ze missen verschillende dingen. De eerste is de poort:
     staat er een onverklaarde route die NIET in de lijst hierboven staat, dan is
     er een schrijfroute bijgekomen zonder contract. De tweede houdt de lijst
     eerlijk: een route die inmiddels wel is ingedeeld, hoort eruit -- een
     verklaarde uitzondering die niet meer geldt, is een alibi. */
  const open = register.rijen.filter(r => r.stand === 'LEGACY_PENDING_CLASSIFICATION')
    .map(r => r.route).sort();
  const nieuw = open.filter(r => !BEKEND_OPEN.includes(r));
  assert.deepStrictEqual(nieuw, [],
    'deze schrijfroute(s) staan onverklaard EN niet op de bekende lijst: ' + nieuw.join(', ') +
    '. Een nieuwe schrijfroute hoort een contract te krijgen in ' +
    'server/lib/mutatiecontracten.js VOORDAT hij bestaat -- zie de kop van dat bestand.');

  const verdwenen = BEKEND_OPEN.filter(r => !open.includes(r));
  assert.deepStrictEqual(verdwenen, [],
    'deze route(s) staan op de bekende-open lijst maar zijn niet meer onverklaard: ' +
    verdwenen.join(', ') + '. Haal ze uit BEKEND_OPEN in dit bestand; een uitzondering ' +
    'die niet meer geldt, is een alibi.');
});

test('het register claimt nooit meer afgeleide regels dan er afgeleid zijn', () => {
  /* DE TOETS DIE 47 ONZICHTBARE SCHRIJFROUTES HAD GEVONDEN.

     Op 12 september 2026 schreef een ronde met `--afleiden --vastleggen` twee
     bestanden achtendertig milliseconden na elkaar: eerst een afgeleide set van
     3142 regels, daarna een register dat `afgeleidDoorScript: 3189` meldde en
     `LEGACY_PENDING_CLASSIFICATION: 0`. Het register beschreef de set die net
     VERVANGEN was. Precies 47 routes waren hun afgeleide regel kwijt -- de verse
     idempotentieproef vond geen hindernis meer, dus BLOCKED_BY_TEST_FIXTURE gold
     niet langer -- en die 47 hadden op LEGACY moeten staan. De releasepoort stond
     op groen omdat de meter over een oudere werkelijkheid rapporteerde.

     scripts/mutatiecontract.js weigert die combinatie sindsdien. Deze toets hangt
     niet aan die vlaggen maar aan de EIGENSCHAP, want de volgende manier om twee
     artefacten uit elkaar te laten lopen ziet er anders uit: het register kan
     nooit meer regels aan een script toeschrijven dan het afgeleide bestand er
     heeft.

     HET IS EEN ONGELIJKHEID EN GEEN GELIJKHEID, en dat is geen slordigheid: een
     mens die een afgeleide route alsnog indeelt, wint van het script
     (`alleBedoelingen` in de meter), en dan hoort de teller juist te ZAKKEN
     terwijl het afgeleide bestand zijn regel nog draagt. */
  const geclaimd = register.gemeten.afgeleidDoorScript || 0;
  const aanwezig = Object.keys(AFGELEID).length;
  assert.ok(geclaimd <= aanwezig,
    'het register schrijft ' + geclaimd + ' regels aan een script toe, maar ' +
    'MUTATIECONTRACT-AFGELEID.json draagt er ' + aanwezig + '. Het verschil (' +
    (geclaimd - aanwezig) + ') zijn routes die het register als ingedeeld telt terwijl er geen ' +
    'afgeleide regel meer voor bestaat -- leg het register opnieuw vast met een APARTE ronde ' +
    '(node scripts/mutatiecontract.js --vastleggen), zonder --afleiden.');
});

test('de afdruk loopt niet achter op de code', () => {
  /* DE POORT DIE HIER ONTBRAK, EN DAT KOSTTE VIER DAGEN.

     De twee toetsen hierboven lezen het INGECHECKTE MUTATIECONTRACT.json. Dat is
     een bouwartefact, en een bouwartefact kan een commit achterlopen -- precies
     wat EXECUTION_MAP.json al een keer heeft opgelost met "de autoriteit komt
     LIVE en nooit uit een bouwartefact".

     Op 9 september kromp MUTATIECONTRACT-AFGELEID.json van 3192 naar 3142 regels
     (de proef kwam er wel bij, dus de afgeleide stand viel terecht weg) zonder
     dat dit register werd meegeregenereerd. De poort op
     LEGACY_PENDING_CLASSIFICATION stond daarna vier dagen groen op NUL terwijl er
     47 schrijfroutes zonder contract waren -- en zij kwamen pas boven toen een
     andere tak het register toevallig vers schreef.

     Deze toets HERBEREKENT de telling in plaats van haar te geloven. Hij draait
     hetzelfde instrument (scripts/mutatiecontract.js --telling, een eigen uitgang
     die alleen de tellingen als JSON geeft), zodat er geen tweede lezer van
     dezelfde waarheid ontstaat -- LAT.md regel 4.

     DE MUTATIE: verwijder een regel uit server/lib/mutatiecontracten-naleesronde.js
     zonder het register opnieuw te schrijven -> deze toets zakt met het verschil
     erbij, en de twee toetsen hierboven blijven groen. Dat is het gat, en dit is
     de dekking. */
  const uit = execFileSync(process.execPath,
    [path.join(WORTEL, 'scripts', 'mutatiecontract.js'), '--telling'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const vers = JSON.parse(uit.trim().split('\n').pop());

  assert.strictEqual(vers.totaal, register.gemeten.totaal,
    'MUTATIECONTRACT.json telt ' + register.gemeten.totaal + ' schrijfroutes en de code ' +
    vers.totaal + ' -- de afdruk loopt achter; draai: node scripts/mutatiecontract.js --vastleggen');

  /* ELKE STAND, en niet alleen LEGACY. Een afdruk die maar half wordt vergeleken
     is een afdruk die half achterloopt (zelfde les als test/capabilities.test.js
     toets 8). Een stand die in de ene en niet in de andere staat, telt als nul. */
  const standen = new Set([...Object.keys(vers.perStand), ...Object.keys(register.gemeten.perStand)]);
  for (const stand of standen) {
    assert.strictEqual(vers.perStand[stand] || 0, register.gemeten.perStand[stand] || 0,
      'MUTATIECONTRACT.json loopt achter op "' + stand + '" (' +
      (register.gemeten.perStand[stand] || 0) + ' vastgelegd, ' + (vers.perStand[stand] || 0) +
      ' gemeten) -- draai: node scripts/mutatiecontract.js --vastleggen');
  }
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
