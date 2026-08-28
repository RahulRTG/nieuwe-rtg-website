/* ============================================================================
   HET ROUTEJOURNAAL (server/routelog.js) -- de bron onder de waargenomen dekking.

   Waarom dit er is: de dekkingsteller in de keuring zoekt routenamen in de
   TEKST van de tests. Dat cijfer is op te poetsen met een zoek-en-vervang, en
   het telt tegelijk hele suites niet mee die hun routes via een hulpje
   aanroepen. Het journaal vervangt die tekstzoektocht door waarneming: de
   server schrijft zelf op wat hij heeft afgehandeld.

   Een meting die je vertrouwt, hoort zelf ook getoetst te zijn. Deze test
   bewijst de eigenschappen waar scripts/dekking.js op leunt:

     1. uit tenzij RTG_ROUTELOG staat (het hoort in de testrun, niet in productie)
     2. het schrijft het PATROON, niet het pad met waarden erin
     3. het overleeft een SIGKILL -- de tests stoppen hun servers zo
     4. een 4xx telt mee: "aangeraakt" is niet hetzelfde als "ging goed"
     5. er wordt genoteerd op het MATCHMOMENT, niet als het antwoord klaar is.
        Dat laatste kwam er namelijk niet altijd: fetch() geeft zijn Response
        zodra de KOPPEN binnen zijn, dus een test kon zijn server al met
        SIGKILL stoppen voordat de server 'finish' had uitgezonden -- en dan
        miste het journaal een route die wel degelijk was aangeroepen. Onder
        belasting viel toets 4 daardoor af en toe om. Toets 6 pint de nieuwe
        garantie vast op de router zelf: een handler die nooit antwoordt, en
        het patroon staat er toch.
     6. en de haak raakt het verzoek nooit, ook niet als hij stukgaat. Een
        meetinstrument dat het gemetene kan slopen is erger dan geen
        meetinstrument (toets 7).
     7. een scherm dat alleen wordt VOOROPGEHAALD telt niet als een bezoek
        (toets 8). Zonder dat onderscheid leverde een enkele bezoeker van
        /apps/foundation/rust.html 45 "geopende" schermen op, want de service
        worker daar haalt zijn hele schil op.

   Draai los: node --test test/routelog.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-routelog-'));
const routelog = require('../server/routelog');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. zonder RTG_ROUTELOG schrijft het journaal niets', () => {
  routelog.begin(null);
  assert.equal(routelog.aan(), false);
  routelog.noteer('POST', '/api/iets');   // mag geen fout geven en nergens landen
  assert.equal(routelog.lees(path.join(TMP, 'bestaat-niet.log')).size, 0,
    'een ontbrekend journaal leest als leeg, niet als een crash');
});

test('2. elk patroon staat er precies een keer in, ook na duizend aanroepen', () => {
  const f = path.join(TMP, 'dedup.log');
  routelog.begin(f);
  for (let i = 0; i < 1000; i++) routelog.noteer('POST', '/api/leden/:id');
  routelog.noteer('GET', '/api/leden/:id');           // andere methode = eigen regel
  const regels = fs.readFileSync(f, 'utf8').trim().split('\n');
  assert.equal(regels.length, 2, 'duizend aanroepen, twee regels: ' + regels.join(' | '));
  assert.deepEqual([...routelog.lees(f)].sort(), ['GET /api/leden/:id', 'POST /api/leden/:id']);
  routelog.begin(null);
});

test('3. een kapot journaal legt de server nooit stil', () => {
  /* Een map bestaat wel maar is niet te beschrijven als bestand. De append
     faalt dus, en dat mag hooguit het journaal kosten -- nooit het verzoek. */
  routelog.begin(TMP);
  assert.doesNotThrow(() => routelog.noteer('POST', '/api/iets'));
  routelog.begin(null);
});

test('4. een echte server schrijft patronen weg en overleeft een SIGKILL', async () => {
  const f = path.join(TMP, 'server.log');
  fs.writeFileSync(f, '');
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: path.join(TMP, 'data'), RTG_ROUTELOG: f } });
  try {
    /* De antwoorden ook UITLEZEN, niet alleen de status bekijken. fetch() geeft
       zijn Response al zodra de koppen binnen zijn; het lichaam kan dan nog
       onderweg zijn. Zonder dit is deze toets een wedloop met zijn eigen
       server -- en dat was hij ook: onder belasting viel hij af en toe om. */
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Journaal Lid', email: 'rl' + Date.now() + '@x.nl',
        phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })
    });
    assert.equal(reg.status, 200);
    await reg.text();
    // en een geweigerd verzoek: dat endpoint is even goed aangeraakt
    const dicht = await fetch(srv.base + '/api/member/rechterhand/cellier', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer onzin' }, body: '{}'
    });
    assert.equal(dicht.status, 401);
    await dicht.text();
  } finally { stop(srv && srv.child); }

  /* Met opzet NA de SIGKILL lezen. Een journaal dat pas bij het afsluiten zou
     wegschrijven, zou hier leeg zijn -- en dan zou de hele dekkingsmeting op
     een lege verzameling draaien zonder dat iemand het merkt. */
  const gezien = routelog.lees(f);
  assert.ok(gezien.has('POST /api/auth/register'), 'geslaagd verzoek genoteerd: ' + [...gezien].join(', '));
  assert.ok(gezien.has('POST /api/member/rechterhand/cellier'), 'een 401 telt ook als aangeraakt');
  assert.ok(!/[?]/.test([...gezien].join(' ')), 'geen querystrings in het journaal');
});

test('5. het journaal noteert het patroon, niet de ingevulde waarde', async () => {
  /* Dit is dezelfde regel als bij de meting: op het pad zou elk lid-id een
     eigen regel worden. Voor de dekking is dat bovendien onbruikbaar, want de
     routekaart kent alleen het patroon. */
  const f = path.join(TMP, 'patroon.log');
  fs.writeFileSync(f, '');
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: path.join(TMP, 'data2'), RTG_ROUTELOG: f } });
  try {
    await fetch(srv.base + '/api/foundation/bord/ZZ99');
    await fetch(srv.base + '/api/foundation/bord/YY11');
  } finally { stop(srv && srv.child); }

  const gezien = [...routelog.lees(f)];
  assert.ok(gezien.includes('GET /api/foundation/bord/:code'),
    'het patroon met :code, met het mount-voorvoegsel erbij: ' + gezien.join(', '));
  assert.equal(gezien.some(r => /ZZ99|YY11/.test(r)), false, 'geen ingevulde waarden');
});

test('6. er wordt genoteerd zodra de route MATCHT, niet als het antwoord klaar is', () => {
  /* Dit is de eigenschap waar toets 4 stilzwijgend op leunde en die er niet
     was. Het journaal hing op 'finish' van het antwoord; kwam dat er niet
     (verbinding weg, proces gestopt met SIGKILL), dan miste het patroon --
     terwijl de route wel degelijk was aangeroepen. fetch() geeft zijn Response
     al zodra de KOPPEN binnen zijn, dus dat venster was echt, en onder
     belasting groot genoeg om toets 4 af en toe te laten omvallen.

     We toetsen het op de router zelf, niet met een echte server: dan hangt het
     bewijs niet op timing maar op de volgorde in de code. De handler doet met
     opzet NIETS met het antwoord -- geen res.end(), dus nooit een 'finish' --
     en toch hoort het patroon dan al genoteerd te zijn. */
  const { maakRouter, opPatroon } = require('../server/web/routing');
  const gezien = [];
  opPatroon((m, p2) => gezien.push(m + ' ' + p2));
  try {
    const r = maakRouter();
    let handlerLiep = false;
    r.post('/api/leden/:id', (req, res, next) => { handlerLiep = true; /* geen antwoord */ });
    r({ method: 'POST', url: '/api/leden/A7?x=1', params: {} }, {}, () => {});
    assert.equal(handlerLiep, true, 'de handler is aangeroepen');
    assert.deepEqual(gezien, ['POST /api/leden/:id'],
      'het patroon staat genoteerd terwijl er nog geen antwoord is gestuurd');
  } finally { opPatroon(null); }
});

test('7. de haak raakt het verzoek nooit, ook niet als hij stukgaat', () => {
  /* Het journaal is een meetinstrument. Een meetinstrument dat het gemetene
     kan slopen, is erger dan geen meetinstrument. */
  const { maakRouter, opPatroon } = require('../server/web/routing');
  opPatroon(() => { throw new Error('journaal stuk'); });
  try {
    const r = maakRouter();
    let geland = false;
    r.get('/api/iets', (req, res, next) => { geland = true; });
    assert.doesNotThrow(() => r({ method: 'GET', url: '/api/iets', params: {} }, {}, () => {}));
    assert.equal(geland, true, 'de route draait gewoon door');
  } finally { opPatroon(null); }
});

test('8. een scherm dat wordt VOOROPGEHAALD telt niet als een bezoek', async () => {
  /* DE VIJFENVEERTIG GRATIS SCHERMEN. Een service worker haalt bij zijn install
     zijn hele schil op (cache.addAll). Dat zijn echte GET's op echte .html-
     paden, en zonder onderscheid staan ze hier alsof de toets die pagina's had
     geopend: eenmaal /apps/foundation/rust.html bezoeken leverde 45 SCHERM-
     regels op, en scripts/schermen.js rekende er 44 als afgelegd. Een meter
     die je met een cache kunt opblazen telt niet wat hij belooft.

     De browser zegt zelf wat voor verzoek het is, dus toetsen we precies dat:
     dezelfde server, twee GET's, alleen de Sec-Fetch-Mode verschilt.

     EN NIET ALLEBEI MET fetch(). Die eerste poging zakte, en leerzaam: Node
     zet Sec-Fetch-Mode zelf op cors en laat hem niet overschrijven, dus beide
     verzoeken kwamen als nevenverzoek binnen. Het bezoek gaat daarom over de
     kale http-module, en de voorophaling juist met fetch() -- want zo staat
     het aan beide kanten dicht bij wat er in het echt gebeurt. */
  const f = path.join(TMP, 'schermsoort.log');
  fs.writeFileSync(f, '');
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: path.join(TMP, 'data3'), RTG_ROUTELOG: f } });
  try {
    await new Promise((klaar, mis) => {
      const v = require('http').get(srv.base + '/apps/app.html',
        { headers: { 'Sec-Fetch-Mode': 'navigate' } }, (res) => { res.resume(); res.on('end', klaar); });
      v.on('error', mis);
    });
    const voorop = await fetch(srv.base + '/apps/foundation/leren.html');   // Node stuurt hier cors
    await voorop.text();
  } finally { stop(srv && srv.child); }

  const regels = [...routelog.lees(f)].filter(r => r.startsWith('SCHERM '));
  const soortVan = (scherm) => {
    const r = regels.find(x => x.split(' ')[1] === scherm);
    return r ? r.split(' ').pop() : 'niet genoteerd';
  };
  assert.equal(soortVan('/apps/app.html'), 'navigatie', 'een navigatie is een bezoek: ' + regels.join(' | '));
  assert.equal(soortVan('/apps/foundation/leren.html'), 'nevenverzoek',
    'een fetch uit een service worker is geen bezoek: ' + regels.join(' | '));
});

test('de testdraaier gooit een meegegeven RTG_ROUTELOG niet weg', () => {
  /* DE KEURING ZET DIT PAD ZELF, en een latere stap leest het.

     scripts/test-runner.js zette onvoorwaardelijk zijn eigen `.routejournaal`
     in de omgeving van elk kindproces -- ook als de aanroeper er al een had
     gekozen. Zolang test:gate een kaal `node --test` was, viel dat niet op:
     die gaf de variabele gewoon door. Sinds test:gate via de draaier loopt,
     schreef de suite naar het ene pad terwijl `scripts/dekking.js --lees` het
     andere las, en zakte de keuring met "Het routejournaal bestaat niet.
     Draaide de suite met RTG_ROUTELOG gezet?" -- terwijl het antwoord ja was.

     Een melding die een goede vraag stelt en een fout antwoord suggereert,
     kost meer tijd dan geen melding. Vandaar deze twee beweringen: het
     meegegeven pad WINT, en zonder pad blijft er een eigen terugval. */
  const { execFileSync } = require('child_process');
  const draaier = path.join(__dirname, '..', 'scripts', 'test-runner.js');
  const vraag = (extra) => JSON.parse(execFileSync(process.execPath,
    [draaier, '--toon', '--bestanden=kappen.test.js'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8',
      env: { ...process.env, RTG_AFBOUW_SLOT_ACTIEF: '1', ...extra } }));

  const eigen = path.join(TMP, 'meegegeven-journaal.log');
  assert.equal(vraag({ RTG_ROUTELOG: eigen }).journaal, eigen,
    'de draaier vervangt een meegegeven RTG_ROUTELOG door zijn eigen pad; dan schrijft de suite ergens ' +
    'anders dan waar de volgende stap leest');

  const zonder = { ...process.env };
  delete zonder.RTG_ROUTELOG;
  /* EN --toon RAAKT HET JOURNAAL NIET AAN. Deze toets vraagt de draaier wat hij
     zou doen, en dat gebeurt MIDDEN IN DE SUITE -- deze toets draait zelf mee.
     Wiste die aanroep het journaal, dan gooide hij het bewijs weg van alles wat
     de suite tot dan toe had aangeroepen, en meldde `scripts/dekking.js --lees`
     daarna endpoints als "nooit aangeraakt" die wel degelijk geraakt waren.

     Zo is het ook echt gegaan: CI telde er 493 tegen een norm van 0, terwijl
     main op 4292 van 4292 stond. Niet omdat er minder werd aangeroepen, maar
     omdat het logboek halverwege leeg was gemaakt. */
  const bestaand = path.join(TMP, 'journaal-blijft-staan.log');
  fs.writeFileSync(bestaand, 'GET /api/vooraf\n');
  execFileSync(process.execPath, [draaier, '--toon', '--bestanden=kappen.test.js'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8',
      env: { ...process.env, RTG_AFBOUW_SLOT_ACTIEF: '1', RTG_ROUTELOG: bestaand } });
  assert.equal(fs.existsSync(bestaand), true,
    'de draaier gooit het journaal weg terwijl hij alleen zijn plan afdrukt; midden in de suite ' +
    'wist dat het bewijs van alles wat er tot dan toe is aangeroepen');
  assert.match(fs.readFileSync(bestaand, 'utf8'), /vooraf/,
    'het journaal is leeggemaakt in plaats van met rust gelaten');

  const terugval = JSON.parse(execFileSync(process.execPath,
    [draaier, '--toon', '--bestanden=kappen.test.js'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8',
      env: { ...zonder, RTG_AFBOUW_SLOT_ACTIEF: '1' } })).journaal;
  assert.match(terugval, /\.routejournaal$/,
    'zonder RTG_ROUTELOG hoort de draaier zijn eigen journaal te kiezen en niet niets');
});
