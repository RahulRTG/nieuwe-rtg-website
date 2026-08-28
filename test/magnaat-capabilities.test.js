const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const functies = require('../server/functies');
const maakScanner = require('../server/kern/magnaat-capabilities');
const bronnen = require('../server/kern/magnaat-capabilities-bronnen');

const root = path.join(__dirname, '..');

test('de Capability Graph leest apps, routes, werkprocessen en kantoren rechtstreeks uit de RTG-code', () => {
  const graph = maakScanner({ root, functies }).scan();
  assert.ok(graph.cijfers.apps >= 150, 'alle echte app-pagina’s worden gevonden');
  assert.ok(graph.cijfers.apiActies >= 1500, 'de echte API-deuren worden gevonden');
  assert.ok(graph.cijfers.werkprocessen >= 500, 'routes worden tot procesfamilies gebundeld');
  assert.ok(graph.cijfers.kantoren >= 29, 'afdelingen en specialistische kamers worden gevonden');
  assert.ok(graph.cijfers.ongedekteApiActies > 0, 'de scanner toont wat het functieregister nog mist');
  assert.ok(graph.cijfers.controlepunten >= 2500, 'iedere API, app, functie en procesfamilie krijgt een controlepunt');
  assert.ok(graph.cijfers.dekkingspercentage > 0 && graph.cijfers.dekkingspercentage < 100,
    'gevonden code wordt niet meer ten onrechte als honderd procent gekoppeld gemeld');
  assert.equal(graph.dekkingsmatrix.dimensies.length, 11, 'alle bestuurlijke dekkingsassen staan in de matrix');
  assert.ok(graph.dekkingsmatrix.metGaten > 0, 'onbewezen koppelingen blijven zichtbaar als werk');
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'kantoor').percentage, 100,
    'ieder codepunt heeft een expliciete bestaande RTG-kantoorruimte');
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'economie').percentage, 100,
    'ieder economisch relevant punt is aan de spel-economie gekoppeld');
  assert.equal(graph.apps.some(a => a.pad === '/apps/kantoren.html'), true);
  assert.equal(graph.kantoren.some(k => k.id === 'klantenservice'), true);
  assert.equal(graph.workflows.some(w => w.familie === '/api/office/bank' && w.actieAantal >= 20), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/bank' && p.kantoor.id === 'bank'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/redactie' && p.kantoor.id === 'redactie'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/weefsel' && p.kantoor.id === 'stad'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/member/magnaat' && p.kantoor.id === 'controleregister'), true);
  const kantoorIds = new Set(graph.kantoren.map(k => k.id));
  assert.equal(graph.controlepunten.some(p => p.kantoor.toewijzing === 'regel' && !kantoorIds.has(p.kantoor.id)), false,
    'een expliciete regel mag nooit naar een niet-bestaande kamer wijzen');
  assert.equal(graph.controlepunten.some(p => p.kantoor.toewijzing === 'terugval'), false,
    'de kantoormatrix bevat geen stil vangnet meer');
  assert.equal(graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/health').dekking.waarden.economie, null,
    'een technische healthcheck krijgt geen verzonnen geld-effect');
  assert.equal(graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/techniek/controle/integriteit').dekking.waarden.economie, null,
    'de permanente herstelbediening blijft bestuurlijk, ook als een woorddeel economisch lijkt');
  assert.equal(graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/office/bank').dekking.waarden.economie, true,
    'een bankroute loopt wel door de spel-economie');
  assert.ok(graph.controlepunten.every(p => p.dekking && Array.isArray(p.dekking.ontbreekt)),
    'ieder codepunt krijgt automatisch een controleerbare dekkingskaart');
  assert.ok(graph.controlepunten.filter(p => p.soort === 'scherm').every(p =>
    p.dekking.waarden.gameplay === true && p.signalen.schermbrug === true),
  'ieder bestaand appscherm opent via de aantoonbaar geïsoleerde Magnaat-schermbrug');
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'gameplay').percentage, 100,
    'ook technische codepunten zijn interactief via de Controleregister-spelbrug');
  const health = graph.controlepunten.find(p => p.soort === 'api' && p.route === '/api/health');
  assert.equal(health.signalen.functiespel, false, 'een healthcheck wordt geen verzonnen eindgebruikersmissie');
  assert.equal(health.signalen.controleSpelbrug, true);
  assert.equal(health.dekking.waarden.gameplay, true, 'maar blijft wel veilig bestuurbare gameplay');
  assert.ok(graph.workflows.every(w => w.bronstand && w.dekking && w.dekking.waarden),
    'ieder gegroepeerd werkproces krijgt stand, rollen en dekkingsvelden');
});

test('een expliciete realistische werkroute maakt alleen de genoemde codefamilie groen', () => {
  const graph = maakScanner({ root, functies,
    volledigeWerkprocessen: [{ codeFamilies: ['/api/office/bank'] }]
  }).scan();
  const bank = graph.workflows.find(w => w.familie === '/api/office/bank');
  const ander = graph.workflows.find(w => w.familie !== '/api/office/bank');
  assert.equal(bank.dekking.waarden.werkroute, true);
  assert.equal(ander.dekking.waarden.werkroute, false, 'een generiek scenario is nog geen volledige werkroute');
});

test('dezelfde code levert een stabiele vingerafdruk en geen dynamische nepkamer op', () => {
  const scanner = maakScanner({ root, functies });
  const a = scanner.scan();
  const b = scanner.scan();
  assert.equal(a.vingerafdruk, b.vingerafdruk);
  assert.equal(a.kantoren.some(k => /esc\(|[+'$]/.test(k.naam)), false);
});

const nativeBin = process.env.RTG_CAPABILITY_RUST_BIN || path.join(root, 'motor/target/release/rtg-motor');
function metEnv(waarden, werk) {
  const oud = {};
  for (const [naam, waarde] of Object.entries(waarden)) {
    oud[naam] = process.env[naam];
    if (waarde === undefined) delete process.env[naam];
    else process.env[naam] = String(waarde);
  }
  try {
    return werk();
  } finally {
    for (const [naam, waarde] of Object.entries(oud)) {
      if (waarde === undefined) delete process.env[naam];
      else process.env[naam] = waarde;
    }
  }
}

test('de native broncodescan is byte-voor-byte gelijk en doorloopt schaduw en canary veilig', () => {
  const javascript = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'uit', RTG_CAPABILITY_RUST_BIN: nativeBin
  });
  const schaduw = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'schaduw', RTG_CAPABILITY_RUST_BIN: nativeBin
  });
  const canary = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'canary', RTG_CAPABILITY_RUST_BIN: nativeBin,
    RTG_CAPABILITY_RUST_CANARY_PCT: '100', RTG_CAPABILITY_RUST_CANARY_KEY: 'toets'
  });
  assert.deepEqual(schaduw.apps, javascript.apps);
  assert.deepEqual(schaduw.endpoints, javascript.endpoints);
  assert.equal(schaduw.motor.bron, 'javascript');
  assert.equal(schaduw.motor.pariteit, true);
  assert.equal(canary.motor.bron, 'rust');
  assert.equal(canary.motor.pariteit, true);
  assert.equal(canary.motor.canaryGekozen, true);
});

test('capability-noodstop en een kapotte binary vallen aantoonbaar terug naar JavaScript', () => {
  const nood = bronnen.scan(root, {
    RTG_RUST_ALLES_UIT: '1', RTG_CAPABILITY_RUST_MODE: 'motor',
    RTG_CAPABILITY_RUST_BIN: '/bestaat/bewust/niet'
  });
  const kapot = bronnen.scan(root, {
    RTG_CAPABILITY_RUST_MODE: 'motor', RTG_CAPABILITY_RUST_BIN: '/bestaat/bewust/niet'
  });
  assert.equal(nood.motor.globaleNoodstop, true);
  assert.equal(nood.motor.reden, 'globale-noodstop');
  assert.equal(nood.motor.bron, 'javascript');
  assert.equal(kapot.motor.terugval, true);
  assert.equal(kapot.motor.reden, 'native-fout');
});

test('de Capability Graph maakt de gekozen motorstand zichtbaar', () => {
  metEnv({
    RTG_RUST_ALLES_UIT: undefined, RTG_CAPABILITY_RUST_MODE: 'canary',
    RTG_CAPABILITY_RUST_BIN: nativeBin, RTG_CAPABILITY_RUST_CANARY_PCT: '100',
    RTG_CAPABILITY_RUST_CANARY_KEY: 'graph-toets'
  }, () => {
    const graph = maakScanner({ root, functies }).scan();
    assert.equal(graph.motor.bron, 'rust');
    assert.equal(graph.motor.pariteit, true);
  });
});

/* ============================================================================
   DE ACHTERSTAND VAN DE BRONSCANNER OP DE ROUTER -- vastgezet, niet weggepoetst.

   WAAROM DEZE TOETS ER IS. De Capability Graph leest zijn API-deuren met een
   regex over server/**.js (magnaat-capabilities-bronnen.js, API_RE). Zo'n regex
   ziet niet wat via `app.use('/api/foundation', router)` of een
   voorvoegsel-hulpje hangt. Gemeten op 17 augustus 2026: de graph kende 3679
   routes waar de router er 4191 heeft -- 510 /api/-routes gemist, waaronder alle 281 van de
   RTFoundation, en 6 die hij WEL noemt en die niet bestaan (`POST /api/geld/`,
   `POST /api/member/spel/` en de twee opzettelijke testbugs).

   Dat is dezelfde fout die in scripts/lib/routes.js is gerepareerd door de
   levende router te vragen (scripts/routekaart.js). Hier is die reparatie NIET
   gedaan, en dat is een bewuste grens: deze scanner heeft een tweelingbroer in
   Rust en scan() vergelijkt de twee op PARITEIT. De JS-kant op de router zetten
   laat die pariteit permanent driften, en dan valt de Rust-migratie stil met een
   waarschuwing. Welke kant daar wint is een besluit over die migratie en niet
   iets om in een dekkingsronde te beslissen.

   Dus zolang dat besluit niet is genomen: de achterstand mag niet GROEIEN. Wie
   een route toevoegt die de bronscanner niet ziet, ziet deze toets zakken. Zo
   staat het gat als getal in de suite in plaats van als stilte -- en wordt het
   kleiner in plaats van vergeten (dezelfde afspraak als BEREIK.json).

   MUTATIE (RAAK): de grens op 0 zetten -> zakt met de volle 512 in de melding.

   VERZET VAN 510 NAAR 546 OP 21 AUGUSTUS 2026, en met de oorzaak erbij zodat
   het geen getal blijft dat niemand meer kan plaatsen. Het gat is niet nieuw en
   niet breder geworden: het is dezelfde blinde vlek, evenredig meegegroeid met
   het huis. De samenvoeging van 24 takken bracht 36 foundation-routes mee.

   WAT DE SCANNER NIET ZIET, EN WAAROM. Hij eist dat het pad in de bron met
   `/api/` begint. De foundation- en schoolrouters registreren RELATIEF
   (`router.post('/gezin/maak')`) en worden gemount op /api/foundation; in de
   bron staat dus nergens het volledige adres. Alle 546 gemiste routes zijn van
   die vorm. Dat is te repareren -- de mount-prefix per router afleiden -- maar
   het raakt de pariteit met de Rust-tweelingbroer hierboven, en dat is het
   besluit dat hier expres niet wordt genomen.

   EN VAN 546 NAAR 576 OP 25 AUGUSTUS 2026, bij het samenvoegen van main (+50
   commits: de App Store, SCIM, de tenant- en beschermstandrondes). Weer dezelfde
   blinde vlek en geen nieuwe: ik heb de 576 geteld en gegroepeerd, en ze vallen
   in zeven families die ALLEMAAL relatief registreren op een gemounte router --
   foundation 341, supplier 85, member 80, rtf 43, scim 15, office 6, techniek 6.
   Geen enkele daarvan schrijft zijn volledige adres in de bron, dus geen enkele
   is voor deze scanner te zien. Wie dit getal ooit weer ziet stijgen zonder dat
   die groepering klopt, kijkt naar iets anders en hoort niet dit getal te
   verzetten maar de oorzaak te zoeken.

   EN VAN 576 NAAR 577 OP 28 AUGUSTUS 2026 -- een route, en de groepering klopt.
   Nagegaan welke: `POST /api/foundation/kosten`, wat een gezin zijn eigen
   kostenbeeld geeft. Hij staat in server/foundation/kosten.js als
   `router.post('/kosten')` op de router die op /api/foundation gemount is, dus
   hij is de 342e van de foundation-familie hierboven en precies dezelfde blinde
   vlek. Geen nieuwe vorm, geen tweede oorzaak: de andere 33 routes van deze tak
   schrijven hun volle adres wel op en worden alle 33 gewoon gezien.
   ========================================================================== */
const GEMIST_MAX = 577;   // routes die de router heeft en de bronscanner niet
const SPOOK_MAX = 6;      // routes die de bronscanner noemt en de router niet

test('de bronscanner loopt niet verder achter op de router dan is vastgelegd', () => {
  const routedekking = require('../server/kern/routedekking');
  const { execFileSync } = require('child_process');
  const kaart = JSON.parse(execFileSync(process.execPath,
    [path.join(root, 'scripts', 'routekaart.js'), '--json'],
    { cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } }));
  const echt = new Set(routedekking.inventaris(kaart.routes).routes
    .filter(r => r.pad.startsWith('/api/'))
    .map(r => r.methode + ' ' + r.pad));
  assert.ok(echt.size > 1000, 'de router geeft zijn routes (' + echt.size + ')');

  const gescand = new Set(bronnen.scanEndpoints(root).map(e => e.sleutel));
  assert.ok(gescand.size > 1000, 'de bronscanner geeft routes (' + gescand.size + ')');

  const gemist = [...echt].filter(s => !gescand.has(s));
  const spook = [...gescand].filter(s => !echt.has(s) && !s.includes('/api/test/'));

  /* De bewering staat op de TELLING en niet op een lus over de lijst: een lus
     over een lege verzameling controleert niets (LAT.md regel 9). De namen staan
     alleen in de melding. */
  assert.ok(gemist.length <= GEMIST_MAX,
    gemist.length + ' routes ziet de bronscanner niet (vastgelegd: ' + GEMIST_MAX + '). ' +
    'De eerste tien:\n  ' + gemist.slice(0, 10).join('\n  ') +
    '\n\nOfwel de route staat op een vorm die de regex niet leest (een mount of een ' +
    'voorvoegsel-hulpje), ofwel de bronscanner hoort op scripts/routekaart.js te ' +
    'gaan zoals scripts/lib/routes.js dat al doet.');
  assert.ok(spook.length <= SPOOK_MAX,
    spook.length + ' routes noemt de bronscanner die de router niet heeft (vastgelegd: ' +
    SPOOK_MAX + '): ' + spook.slice(0, 10).join(', '));
});
