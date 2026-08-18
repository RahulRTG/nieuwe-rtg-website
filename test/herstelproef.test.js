/* HERSTELPROEF -- werkt de backup echt, of nemen we dat aan?

   Een backup die je nooit hebt teruggezet is geen backup maar een aanname.
   Deze proef doet daarom de hele ronde die je op een slechte dag zou moeten
   doen, en doet het echt: server starten, een lid aanmaken, backup laten
   maken, de datamap WISSEN, terugzetten, opstarten, en controleren of alles
   er nog is -- inclusief of de echte naam achter de codenaam nog leesbaar is.

   Het laatste stuk is waar het om draait. De backup bevat db.json, rtg.db en
   store.db, maar NIET vault.key en secret.key. Dat is met opzet: zou de
   sleutel in dezelfde backup zitten, dan opent een gestolen backup zichzelf
   en is de hele kluis theater. Maar het betekent wel dat de backup in zijn
   eentje niets waard is: zonder de sleutel uit de secrets manager krijg je
   rtg.db terug als onleesbare brij, en zijn alle namen voorgoed weg.

   Test 3 bewijst precies dat. Hij hoort te slagen -- niet omdat het goed
   nieuws is, maar omdat het de eigenschap is die je moet kennen VOOR je hem
   op een slechte dag ontdekt.

   Draai los: node --test test/herstelproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
// de strenge poort mag de stderr van onze eigen server meelezen
const { bewaakKind } = require('./helper');

/* ELKE FETCH MET EEN DEADLINE -- EEN TWEEDE SLOT, EN NIET DE OORZAAK.

   Eerlijk over de volgorde: ik heb dit als eerste gedaan met de gedachte dat het
   DE reparatie was voor de vastloper waar dit bestand voor in MUTATIES.json
   stond. Dat was fout -- na deze wijziging liep hij nog steeds vast. De echte
   oorzaak stond in het opruimen (zie de finally verderop) en kwam pas boven door
   de proef met de hand te draaien en naar de UITVOER te kijken.

   Dit blok blijft staan omdat het op zichzelf een echt gat dicht: een fetch zonder
   time-out in een toets kan blijven staan, en dan telt een begrensde wachtlus niet
   verder -- begrensde lus, onbegrensde stap. Het is een tweede slot op een deur
   die nu ook echt op slot zit, geen reparatie die ik als de oorzaak mag opvoeren.

   Wat er misging: onder de liegpoort (de motor laat de server op elk /api-pad
   liegen) kwam een van deze verzoeken nooit terug. De wachtlussen hieronder zijn
   WEL begrensd -- honderd of honderdvijftig pogingen van 200 ms -- maar een lus
   telt niet verder zolang een stap niet klaar is. Begrensde lus, onbegrensde stap.
   Gevolg: het proces sluit niet af, de motor noteert `vastgelopen`, en dat telt
   niet als gezakt: het gedrag was echt veranderd en geen assertie heeft het
   gemeld. Een toets die hangt is erger dan een toets die zakt.

   fetch wordt hier op MODULENIVEAU geschaduwd. Dat dekt alle aanroepen in dit
   bestand -- ook de geneste `await (await fetch(...)).json()` -- zonder ze een
   voor een aan te raken, en het verandert niets buiten dit bestand. Een
   meegegeven signal wint, dus wie zelf een AbortController gebruikt houdt zijn
   eigen gedrag. */
const _fetch = globalThis.fetch;
const fetch = (u, o) => _fetch(u, Object.assign({ signal: AbortSignal.timeout(10000) }, o));


const BASIS = 4900 + Math.floor(Math.random() * 60);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstel-'));
const KLUIS = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kluis-')); // "secrets manager"
const SERVER = path.join(__dirname, '..', 'server', 'server.js');

// de sleutels horen ELDERS te staan; hier doen we alsof dat een kluis is
const VAULT = 'a'.repeat(64), SECRET = 'b'.repeat(64);
const NAAM = 'Herman Herstel', MAIL = 'herman@herstelproef.test';

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

/* Start een server op de gegeven datamap en wacht tot hij antwoordt. */
async function start(poort, extra) {
  const kind = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env, NODE_ENV: 'test', PORT: String(poort), RTG_DATA_DIR: TMP,
      SMTP_URL: '', RTG_DEMO: '0', RTG_VAULT_KEY: VAULT, RTG_SECRET_KEY: SECRET, ...extra
    },
    // stderr naar 'pipe' zodat de strenge poort meeleest (zie helper.bewaakKind)
    stdio: ['ignore', 'ignore', 'pipe']
  });
  bewaakKind(kind);
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch('http://127.0.0.1:' + poort + '/api/health')).ok) return kind; } catch (e) {}
    await wacht(200);
  }
  kind.kill();
  throw new Error('server op poort ' + poort + ' kwam niet op');
}
async function stop(kind) { if (kind) { kind.kill(); await wacht(600); } }
function post(poort, pad, body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch('http://127.0.0.1:' + poort + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}

let codenaam = null;

test('1. een lid aanmaken en de backup laten draaien', async () => {
  /* DE SERVER IN EEN FINALLY, en deze toets had er helemaal geen. Hij stopte het
     kind als LAATSTE regel van de body; zakt een assertie ervoor -- en onder de
     liegpoort zakken er drie, gemeten -- dan blijft het serverproces staan en kan
     node niet afsluiten. Het proces liep tot de time-out (exit 124), en dan telt
     de motor het NIET als gezakt terwijl er wel asserties zakten: de stilste vorm
     van stuk. De twee andere toetsen in dit bestand hadden hun finally al. */
  let kind = null;
  try {
  kind = await start(BASIS);
  const reg = await post(BASIS, '/api/auth/register', {
    name: NAAM, email: MAIL, phone: '0622222222', password: 'geheim12345',
    geboortedatum: '1985-03-03', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(reg.status, 200, 'registreren lukt');
  const tok = (await reg.json()).token;
  const st = await (await post(BASIS, '/api/state', {}, tok)).json();
  codenaam = (st.state || st).user.codename;
  assert.ok(codenaam, 'het lid heeft een codenaam');
  await stop(kind);

  /* Drie dingen die NIET in de backup zaten en er alle drie in horen. Zonder
     ze hier neer te zetten bewijst de assertie hieronder niets:
     - grootboek.db is een EIGEN sqlite-bestand (db/tx/sqliteachter.js), niet
       store.db; daar liggen in de standaardopslag de bestellingen en boekingen;
     - archief/ is alles wat buiten het RAM-venster is geveegd -- juist de
       oudste gegevens, die je nergens anders meer vandaan haalt;
     - papieren.json is het datalek-belschema en de AVG-antwoorden. Dat staat
       bewust buiten de database EN in .gitignore, dus een backup was de enige
       plek waar het kon overleven. Sinds de eigenaar het in de boardroom
       invult, is dat geen theorie meer. */
  fs.mkdirSync(path.join(TMP, 'archief'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'archief', '2026-01.jsonl'), '{"ref":"OUD-1","soort":"order"}\n');
  fs.writeFileSync(path.join(TMP, 'papieren.json'),
    JSON.stringify({ antwoorden: { privacycontact: { waarde: 'Iemand, privacy@rtg.example', at: new Date().toISOString() } } }, null, 2));

  /* De backup draait bij het opstarten. Door nu opnieuw te starten maken we
     er een MET dit lid erin -- precies zoals de dagelijkse backup dat 's
     nachts zou doen. */
  kind = await start(BASIS);
  await stop(kind);

  const bdir = path.join(TMP, 'backups');
  assert.ok(fs.existsSync(bdir), 'er is een backupmap');
  const dagen = fs.readdirSync(bdir).sort();
  assert.ok(dagen.length >= 1, 'er staat minstens een dagbackup');
  const inhoud = fs.readdirSync(path.join(bdir, dagen[dagen.length - 1]));
  assert.ok(inhoud.includes('rtg.db'), 'de identiteitskluis zit in de backup');
  assert.ok(inhoud.includes('grootboek.db'), 'en het transactiegrootboek, dat een eigen bestand is');
  assert.ok(inhoud.includes('papieren.json'), 'en het papierwerk, dat nergens anders staat');
  assert.ok(inhoud.includes('archief'), 'en de archiefmap');
  assert.ok(fs.existsSync(path.join(bdir, dagen[dagen.length - 1], 'archief', '2026-01.jsonl')),
    'met de inhoud van het archief erin, niet alleen een lege map');
  // en de sleutel juist NIET -- sleutel en slot horen niet in dezelfde doos
  assert.ok(!inhoud.includes('vault.key'), 'de kluissleutel zit NIET in de backup, en dat hoort zo');
  assert.ok(!inhoud.includes('secret.key'), 'de tokensleutel ook niet');
  } finally { try { await stop(kind); } catch (e) { /* al weg: prima */ } }
});

test('2. datamap wissen, terugzetten uit de backup, en alles is er nog', async () => {
  const bdir = path.join(TMP, 'backups');
  const laatste = path.join(bdir, fs.readdirSync(bdir).sort().pop());
  /* Een echt herstel kopieert een MAP terug, geen platte lijst bestanden. Deze
     proef las alles met readFileSync, en dat viel om zodra er een submap in de
     backup zat -- precies wat er nu in hoort te zitten (archief/). Een
     herstelproef die alleen platte bestanden aankan, beproeft niet het herstel
     dat je op een slechte dag doet. */
  const lees = (map) => fs.readdirSync(map, { withFileTypes: true }).map(d =>
    d.isDirectory() ? [d.name, lees(path.join(map, d.name))] : [d.name, fs.readFileSync(path.join(map, d.name))]);
  const schrijf = (map, rijen) => {
    fs.mkdirSync(map, { recursive: true });
    for (const [naam, inhoud] of rijen) {
      if (Array.isArray(inhoud)) schrijf(path.join(map, naam), inhoud);
      else fs.writeFileSync(path.join(map, naam), inhoud);
    }
  };
  const bewaard = lees(laatste);

  /* De ramp: de hele datamap weg. Zo ziet het eruit als de schijf sneuvelt of
     als iemand de verkeerde map verwijdert. */
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  // Het herstel, precies zoals een beheerder het zou doen: de bestanden terug,
  // en de sleutels uit de kluis (hier: de omgevingsvariabelen).
  schrijf(TMP, bewaard);
  fs.writeFileSync(path.join(KLUIS, 'bewijs'), 'sleutels komen hiervandaan, niet uit de backup');

  /* En dan de drie die er tot vandaag niet in zaten. Deze assertie is het punt
     van de hele wijziging: niet DAT de backup ze noemt, maar dat ze de ronde
     overleven en er na het terugzetten weer staan. */
  assert.ok(fs.existsSync(path.join(TMP, 'grootboek.db')), 'het transactiegrootboek is terug');
  assert.ok(fs.existsSync(path.join(TMP, 'papieren.json')), 'het papierwerk is terug');
  const pap = JSON.parse(fs.readFileSync(path.join(TMP, 'papieren.json'), 'utf8'));
  assert.match(pap.antwoorden.privacycontact.waarde, /privacy@rtg\.example/, 'met het antwoord er nog in');
  const oudBestand = path.join(TMP, 'archief', '2026-01.jsonl');
  assert.ok(fs.existsSync(oudBestand), 'en het archief, met zijn inhoud');
  assert.match(fs.readFileSync(oudBestand, 'utf8'), /OUD-1/, 'de weggeveegde boeking staat er nog in');

  const kind = await start(BASIS + 1);
  try {
    // het lid kan gewoon weer inloggen: het accountdossier overleefde
    const inlog = await post(BASIS + 1, '/api/auth/login', { login: MAIL, password: 'geheim12345', pasApp: 'rtg' });
    assert.equal(inlog.status, 200, 'het herstelde account kan inloggen (kreeg ' + inlog.status + ')');
    const tok = (await inlog.json()).token;

    const st = (await (await post(BASIS + 1, '/api/state', {}, tok)).json());
    const user = (st.state || st).user;
    assert.equal(user.codename, codenaam, 'dezelfde codenaam als voor de ramp');
    // en de kluis doet het weer: de echte naam is leesbaar
    assert.equal(user.full, NAAM, 'de echte naam achter de codenaam is terug uit de kluis');
    assert.equal(user.email, MAIL, 'en het e-mailadres ook');
  } finally { await stop(kind); }
});

test('3. zonder de sleutel is de backup onleesbaar -- dus bewaar hem apart', async () => {
  /* Dezelfde herstelde bestanden, maar nu start de server met een ANDERE
     kluissleutel: dat is wat er gebeurt als je de backup wel hebt en de
     secrets manager niet. De data staat er, maar de namen komen er niet meer
     uit. Dat is geen bug -- het is waarom versleuteling werkt -- maar het is
     wel de reden dat "we hebben backups" een half antwoord is. */
  const kind = await start(BASIS + 2, { RTG_VAULT_KEY: 'c'.repeat(64) });
  try {
    const inlog = await post(BASIS + 2, '/api/auth/login', { login: MAIL, password: 'geheim12345', pasApp: 'rtg' });
    if (inlog.status === 200) {
      const st = await (await post(BASIS + 2, '/api/state', {}, (await inlog.json()).token)).json();
      const user = (st.state || st).user;
      assert.notEqual(user.full, NAAM, 'met de verkeerde sleutel komt de echte naam er NIET uit');
    } else {
      // ook goed: met een andere sleutel klopt de e-mail-hash niet meer, dus
      // het account is niet eens vindbaar. Ook dan is de naam onbereikbaar.
      assert.ok(inlog.status >= 400, 'zonder de juiste sleutel is het dossier onbereikbaar');
    }
  } finally { await stop(kind); }
});

test.after(() => {
  for (const d of [TMP, KLUIS]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
});
