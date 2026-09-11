/* DE UITVOER-SCHAKEL: LEKT HET ANTWOORD VAN EEN DOORLAAT?

   WAT ER MIS WAS. weegAntwoord() in scripts/lib/rolproef.js geeft bij een 2xx
   meteen `lek: null` terug -- de lekmerkers draaien dus alleen over
   WEIGERINGEN. In BEWIJSMATRIX.json was OUTPUT daardoor 0 van 3987 routes
   bewezen: van geen enkele route lag vast dat het antwoord geen gegevens van
   iemand anders bevat.

   WAT DEZE TOETS BEWAAKT, en de tweede helft is hier het echte werk:

     1. een kanarie van een ANDER account in een 2xx-antwoord is een lek;
     2. je EIGEN gegevens in je eigen antwoord zijn dat NIET -- anders slaat de
        proef af op /api/auth/mij en zet iemand hem binnen een week uit;
     3. een geheim veld (wachtwoordhash, sessietoken) is altijd een lek, ook van
        jezelf;
     4. alles wat geen 2xx is, is hier ONGEMETEN en niet groen: weigeringen zijn
        het werk van ACL en INPUT, en een tweede oordeel daarover zou een tweede
        waarheid zijn.

   Draai los: node --test test/uitvoerproef.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const u = require('../scripts/lib/uitvoerproef');

const kanaries = u.maakKanaries('77');

test('maakKanaries levert waarden die door validatie komen en toch uniek zijn', () => {
  assert.match(kanaries.email, /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, 'moet een geldig e-mailadres zijn');
  assert.match(kanaries.telefoon, /^06\d{8}$/, 'moet een geldig 06-nummer zijn');
  assert.ok(kanaries.naam.length >= 6, 'een te korte naam zou toevallig ergens in een antwoord staan');
});

test('een kanarie van een ander in een 2xx-antwoord is een lek', () => {
  for (const veld of ['naam', 'email', 'telefoon']) {
    const uit = u.weegUitvoer(200, { lijst: [{ iets: kanaries[veld] }] }, kanaries);
    assert.equal(uit.gemeten, true);
    assert.ok(uit.lek, 'de kanarie in het veld ' + veld + ' hoort een lek te zijn');
  }
  // ook door een tekstantwoord heen, niet alleen JSON
  assert.ok(u.weegUitvoer(200, 'Beste ' + kanaries.naam + ', ...', kanaries).lek);
  // en ongeacht hoofdletters, want een naam komt vaak anders gespeld terug
  assert.ok(u.weegUitvoer(200, { a: kanaries.email.toUpperCase() }, kanaries).lek);
});

test('je eigen gegevens zijn geen lek: geen vals alarm op /api/auth/mij', () => {
  /* Precies het antwoord dat de proef onbruikbaar zou maken als de lekmerkers
     blind over een doorlaat gingen: een eigen profiel met een eigen naam,
     e-mailadres en telefoonnummer erin. */
  const eigen = { naam: 'Rahul Ramdas', email: 'ikzelf@voorbeeld.nl', telefoon: '0612345678', codenaam: 'PAARSE-VOS' };
  const uit = u.weegUitvoer(200, eigen, kanaries);
  assert.equal(uit.gemeten, true, 'het is wel gemeten');
  assert.equal(uit.lek, null, 'maar eigen gegevens zijn geen lek');
});

test('een geheim veld is een lek zonder kanarie, maar naam EN waarde moeten kloppen', () => {
  assert.ok(u.weegUitvoer(200, { password_hash: 'scrypt$16384$8$1$abcdefghijklmnop' }, kanaries).lek,
    'de veldnaam die dit huis echt gebruikt');
  assert.ok(u.weegUitvoer(200, { token: 'a1b2c3d4e5f60718293a4b5c' }, kanaries).lek, 'een hex-token');
  assert.ok(u.weegUitvoer(200, { api_key: 'AbC123dEf456GhI789jKl012' }, kanaries).lek, 'een base64-sleutel');
  assert.equal(u.weegUitvoer(200, { ok: true, aantal: 3 }, kanaries).lek, null, 'een gewoon antwoord blijft schoon');
});

/* DE ZEVEN VALSE ALARMEN, ALS VASTE TOETS. De eerste volledige ronde over 3074
   routes gaf acht bevindingen en zeven waren vals: `sleutel` staat in de
   gedeelde merkerlijst omdat het "geheime sleutel" kan betekenen, maar in dit
   huis is het net zo vaak de key van een datastructuur. Deze toets houdt vast
   dat die niet terugkomen -- een proef met zeven op acht vals wordt uitgezet. */
test('geen vals alarm op een veldnaam met een gewone waarde', () => {
  for (const lijf of [{ sleutel: 'sociaal' }, { sleutel: 'week' }, { sleutel: 'basissalaris' },
    { pin: '1234' }, { token: 'kort' }, { hash: 'abc' }]) {
    assert.equal(u.weegUitvoer(200, lijf, kanaries).lek, null,
      JSON.stringify(lijf) + ' is geen geheim maar een gewone waarde');
  }
});

test('lijktGeheim: lang en niet-talig wel, een woord niet', () => {
  assert.equal(u.lijktGeheim('sociaal'), false, 'te kort');
  assert.equal(u.lijktGeheim('basissalarisregeling'), false, 'lang maar gewoon een woord');
  assert.equal(u.lijktGeheim('a1b2c3d4e5f60718'), true, 'hex van 16');
  assert.equal(u.lijktGeheim('scrypt$16384$8$1$zoutenhash'), true, 'scrypt-vorm');
  assert.equal(u.lijktGeheim('AbC123dEf456GhI789jKl012'), true, 'base64 met cijfers en letters');
});

/* De woordenlijst hoort op EEN plek te staan. Loopt de gedeelde merker uit
   rolproef.js uit de pas met de lijst hier, dan meet OUTPUT iets anders dan ACL
   en is er stilletjes een tweede waarheid ontstaan. */
test('de veldnamenlijst blijft dezelfde als de gedeelde lekmerker', () => {
  assert.ok(u.GEHEIMMERKER, 'de gedeelde geheim-veld-merker bestaat nog');
  for (const woord of ['password', 'secret', 'token', 'sleutel', 'hash', 'pin', 'wachtwoord']) {
    assert.ok(u.GEHEIMWOORDEN.test(woord), woord + ' hoort in beide lijsten te staan');
    assert.ok(u.GEHEIMMERKER.re.test('{"' + woord + '":"eenlangewaardehier"}'),
      woord + ' hoort ook de gedeelde merker te raken');
  }
});

test('alles wat geen 2xx is, is ONGEMETEN en niet groen', () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500, 0]) {
    const uit = u.weegUitvoer(status, { error: 'nee' }, kanaries);
    assert.equal(uit.gemeten, false, status + ' hoort ongemeten te zijn (dat is ACL/INPUT hun werk)');
  }
  /* En een weigering die WEL een kanarie bevat blijft hier ongemeten -- niet
     omdat het geen lek is, maar omdat rolproef dat al weegt. Twee oordelen over
     hetzelfde antwoord is een tweede waarheid. */
  assert.equal(u.weegUitvoer(403, { naam: kanaries.naam }, kanaries).gemeten, false);
});

test('draaiUitvoerproef: schoon, lek en ongemeten komen elk in het register', async () => {
  const routes = [
    { method: 'POST', pad: '/api/schoon', rol: 'member' },
    { method: 'POST', pad: '/api/lek', rol: 'member' },
    { method: 'POST', pad: '/api/dicht', rol: 'member' }
  ];
  const post = async (pad) => {
    if (pad === '/api/schoon') return { status: 200, data: { ok: true } };
    if (pad === '/api/lek') return { status: 200, data: { wie: kanaries.email } };
    return { status: 403, data: { error: 'nee' } };
  };
  const uit = await u.draaiUitvoerproef({ post, routes, tokenVoor: () => 'tok',
    lijfVoor: () => ({}), kanaries });

  assert.equal(uit.perRoute['POST /api/schoon'].uitvoer, 'schoon');
  assert.equal(uit.perRoute['POST /api/lek'].uitvoer, 'GEZAKT');
  assert.equal(uit.perRoute['POST /api/dicht'].uitvoer, 'poort', 'nooit een 2xx = ongemeten, geen groen');
  assert.equal(uit.gemeten, 2, 'twee routes gaven werkelijk een antwoord om te wegen');
  assert.equal(uit.bevindingen.lekken.length, 1);
  assert.match(uit.bevindingen.lekken[0], /e-mailadres van een ander/);
});

/* ============================================================================
   DE VERKLAARDE GEHEIMEN.

   Twee soorten routes tonen met opzet iets dat er als een geheim uitziet: een
   route die een sleutel MINT (die moet hem een keer laten zien, anders bestaat
   hij nergens) en een route die een KETENHASH toont (die hash is het
   bewijsmiddel van de auditketen, niet het geheim).

   Ze staan bij naam in VERKLAARD met een reden. Deze toetsen bewaken dat die
   lijst niet stilletjes breder wordt dan hij is: hij geldt per route EN per
   veldnaam, en 'verklaard' is een eigen stand en geen synoniem van 'schoon'.

   DE MUTATIE: laat verklaringVoor() de veldnaam niet vergelijken -> "een
   verklaring geldt alleen voor het veld waarvoor hij is gegeven" zakt.
   ========================================================================== */
test('een verklaring geldt alleen voor de route EN het veld waarvoor hij is gegeven', () => {
  const { VERKLAARD, verklaringVoor } = require('../scripts/lib/uitvoerproef');
  const sleutel = 'POST /api/office/anker';
  assert.ok(VERKLAARD[sleutel], 'de proefroute hoort in de lijst te staan');
  assert.match(verklaringVoor(sleutel, 'geheim veld (hash)'), /bewijsmiddel/);
  assert.equal(verklaringVoor(sleutel, 'geheim veld (wachtwoord)'), null,
    'een route die zijn ketenhash mag tonen, mag daarmee nog geen wachtwoord tonen');
  assert.equal(verklaringVoor('POST /api/iets/anders', 'geheim veld (hash)'), null,
    'de verklaring is van EEN route en geldt nergens anders');
  assert.equal(verklaringVoor(sleutel, 'echte naam van een ander'), null,
    'een kanarie van een ander is nooit verklaard: dat is data van iemand anders');
});

test('elke verklaring draagt een uitgeschreven reden en een veldnaam', () => {
  const { VERKLAARD } = require('../scripts/lib/uitvoerproef');
  for (const [route, v] of Object.entries(VERKLAARD)) {
    assert.ok(v.veld, route + ' mist de veldnaam waarvoor de verklaring geldt');
    assert.ok(v.reden && v.reden.length > 30, route + ' mist een uitgeschreven reden');
    assert.match(route, /^(POST|PUT|PATCH|DELETE|GET) \/api\//, route + ' is geen routesleutel');
  }
});

test('verklaard telt apart van schoon, zodat een bevinding niet kan verdwijnen', async () => {
  const { draaiUitvoerproef, maakKanaries } = require('../scripts/lib/uitvoerproef');
  const kan = maakKanaries('99');
  const uit = await draaiUitvoerproef({
    post: async (pad) => pad === '/api/office/anker'
      ? { status: 200, data: { ok: true, blok: { hash: 'a'.repeat(32) } } }
      : { status: 200, data: { ok: true } },
    routes: [{ method: 'POST', pad: '/api/office/anker', rol: 'office' },
      { method: 'POST', pad: '/api/gewoon', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({}), kanaries: kan
  });
  assert.equal(uit.perRoute['POST /api/office/anker'].uitvoer, 'verklaard');
  assert.equal(uit.perRoute['POST /api/gewoon'].uitvoer, 'schoon');
  assert.equal(uit.bevindingen.lekken.length, 0, 'een verklaarde route is geen lek');
  assert.equal(uit.bevindingen.verklaard.length, 1, 'maar hij blijft wel zichtbaar');
});

test('draaiUitvoerproef: een verlopen token wordt eenmaal opnieuw gehaald', async () => {
  let ingelogd = false;
  const post = async () => (ingelogd ? { status: 200, data: { ok: true } } : { status: 401, data: {} });
  const uit = await u.draaiUitvoerproef({
    post, routes: [{ method: 'POST', pad: '/api/x', rol: 'member' }],
    tokenVoor: () => 'tok', lijfVoor: () => ({}), kanaries,
    hernieuw: async () => { ingelogd = true; return true; }
  });
  assert.equal(uit.hernieuwd, 1);
  assert.equal(uit.perRoute['POST /api/x'].uitvoer, 'schoon',
    'zonder de tweede poging zou een verlopen token als ongemeten wegvallen');
});

/* ============================================================================
   DE TWEE HELFTEN VAN EEN AANVAARDE UITZONDERING: EEN NATREKBARE GROND, EN EEN
   HANDTEKENING.

   WAAROM DEZE TOETSEN ER ZIJN. De lijst VERKLAARD bestond al en deed zijn werk,
   maar de kop erboven beweerde iets dat de lijst niet kon waarmaken: "een mens
   heeft opgeschreven waarom dat hier hoort". Van de acht regels was dat voor
   drie onwaar -- die heeft een auditronde erbij gezet -- en er stond nergens in
   de data dat ze van niemand kwamen. Een uitzonderingenlijst waarvan je niet
   kunt zien wie hem aanvaardde, is precies de plek waar een bevinding alsnog
   verdwijnt. Dat is dezelfde klasse als de bevinding waar deze lijst uit
   voortkwam: een verdict zonder mogelijkheid om te kloppen.

   1. `bron` + `citaat` maken de grond FALSIFIEERBAAR. Een reden is anders een
      zin die iemand typte; nu loopt er een draad naar de code die kan BREKEN.
   2. `afgetekend` is de handtekening. Alle acht staan op null, dus op
      `voorgedragen`, en dat is geen omissie maar de waarheid: wie deze code
      schrijft mag geen uitzondering op een privacyregel aanvaarden.

   DE MUTATIES, alle vier gedraaid en alle vier zien zakken:
     - een citaat dat niet (meer) in zijn bron staat        -> 1 zakt
     - een verklaring voor een route die niet bestaat       -> 2 en 4 zakken
     - verklaringStand() geeft altijd 'afgetekend'          -> 4 zakt
     - voorgedragen en afgetekend in EEN bak                -> 4 zakt, plus de
       bestaande toets "verklaard telt apart van schoon"

   EN EEN EERLIJKHEID OVER DE RATEL (toets 3): op die derde mutatie zakt hij
   NIET. Een plafond vangt alleen groei, en een leugen die minder schuld meldt
   dan er is glijdt eronderdoor. Wat die leugen wel vangt is toets 4, die de
   twee bakken naast elkaar legt. Een ratel zonder zo'n toets ernaast is dus
   geen bewaker van de handtekening -- alleen van het aantal.
   ========================================================================== */
test('elke verklaring wijst een bron aan waarin haar grond letterlijk staat', () => {
  const fs = require('fs');
  const path = require('path');
  const { VERKLAARD } = require('../scripts/lib/uitvoerproef');
  const wortel = path.join(__dirname, '..');
  let gekeurd = 0;
  for (const [route, v] of Object.entries(VERKLAARD)) {
    assert.ok(v.bron, route + ' mist de bron waarin zijn grond na te trekken is');
    assert.ok(v.citaat && v.citaat.length > 15, route + ' mist een citaat uit die bron');
    const pad = path.join(wortel, v.bron);
    assert.ok(fs.existsSync(pad), route + ' wijst naar ' + v.bron + ', en dat bestand bestaat niet');
    /* LETTERLIJK, en dat is het hele punt: verdwijnt de zin uit de bron -- de
       sleutel wordt toch bewaard, de ketenstand gaat er niet meer mee -- dan
       zakt deze toets in plaats van dat de uitzondering stil blijft gelden. */
    assert.ok(fs.readFileSync(pad, 'utf8').includes(v.citaat),
      route + ': het citaat staat niet (meer) in ' + v.bron + ', dus de grond is niet na te trekken');
    gekeurd++;
  }
  assert.ok(gekeurd >= 8, 'er horen minstens acht verklaringen gekeurd te zijn, niet ' + gekeurd);
});

test('elke verklaring noemt een route die werkelijk bestaat', () => {
  const { alleRoutes } = require('../scripts/lib/routes');
  const { VERKLAARD } = require('../scripts/lib/uitvoerproef');
  /* Uit de ROUTER en niet uit de bron: zie de kop van scripts/lib/routes.js.
     Een uitzondering voor een route die niet bestaat onderdrukt niets en valt
     ook nooit meer op -- hij houdt alleen een verklaring in de lucht voor een
     pad dat iemand hernoemd heeft. */
  const bestaat = new Set(alleRoutes().map(r => r.methode + ' ' + r.pad));
  for (const route of Object.keys(VERKLAARD)) {
    assert.ok(bestaat.has(route), route + ' staat verklaard maar bestaat niet in de router');
  }
});

test('een uitzondering zonder handtekening is schuld, en die schuld is begrensd', () => {
  const { VERKLAARD, verklaringStand, VOORGEDRAGEN_MAX } = require('../scripts/lib/uitvoerproef');
  const standen = Object.keys(VERKLAARD).map(verklaringStand);
  for (const st of standen) assert.ok(st === 'afgetekend' || st === 'voorgedragen', 'onbekende stand: ' + st);
  /* GEEN VERKLARING IS EEN DERDE UITKOMST en geen synoniem van voorgedragen:
     een route die niet in de lijst staat, is een lek. */
  assert.equal(verklaringStand('POST /api/nergens/heen'), null);

  const voorgedragen = standen.filter(s => s === 'voorgedragen').length;
  /* DE RATEL. Gaat alleen omlaag, en de weg omlaag is een mens die aftekent --
     niet een regel die verdwijnt. Wie dit getal omhoog zet zonder het in
     scripts/lib/uitvoerproef.js uit te schrijven, sloopt de ratel zelf. */
  assert.ok(voorgedragen <= VOORGEDRAGEN_MAX,
    voorgedragen + ' voorgedragen uitzonderingen, ratel staat op ' + VOORGEDRAGEN_MAX);
});

test('de ronde meldt afgetekend en voorgedragen apart, nooit als een getal', async () => {
  const mod = require('../scripts/lib/uitvoerproef');
  const { draaiUitvoerproef, maakKanaries, VERKLAARD } = mod;
  const kan = maakKanaries('98');
  /* Er is vandaag geen enkele AFGETEKENDE uitzondering, dus die tak zou
     ongetoetst blijven. Hier komt er tijdelijk een bij, zodat bewezen is dat de
     twee bakken werkelijk uit elkaar lopen en niet allebei hetzelfde vullen. */
  VERKLAARD['POST /api/proef/afgetekend'] = { veld: 'sleutel', reden: 'alleen voor deze toets',
    bron: 'test/uitvoerproef.test.js', citaat: 'alleen voor deze toets', afgetekend: 'toets' };
  try {
    const uit = await draaiUitvoerproef({
      /* HEX en geen 'zzz...': de lekmerker vraagt een sleutelvorm, en met een
         reeks z'en zag hij niets -- dan staan beide routes op `schoon` en meet
         deze toets niets. Zo gebeurde het ook echt, en de toets viel er terecht
         over. */
      post: async () => ({ status: 200, data: { ok: true, sleutel: 'a'.repeat(40) } }),
      routes: [{ method: 'POST', pad: '/api/proef/afgetekend', rol: 'member' },
        { method: 'POST', pad: '/api/toestellen/koppel', rol: 'member' }],
      tokenVoor: () => 't', lijfVoor: () => ({}), kanaries: kan
    });
    assert.deepEqual(uit.bevindingen.afgetekend.map(x => x.split(' ')[1]), ['/api/proef/afgetekend']);
    assert.deepEqual(uit.bevindingen.voorgedragen.map(x => x.split(' ')[1]), ['/api/toestellen/koppel']);
    assert.equal(uit.perRoute['POST /api/proef/afgetekend'].grond, 'afgetekend');
    assert.equal(uit.perRoute['POST /api/toestellen/koppel'].grond, 'voorgedragen');
    assert.equal(uit.bevindingen.lekken.length, 0, 'beide zijn verklaard, dus geen lek');
  } finally { delete VERKLAARD['POST /api/proef/afgetekend']; }
});
