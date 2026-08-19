/* ============================================================================
   DE OPRUIMWACHT VAN DE MUTATIEMOTOR: zet hij de bron ook terug bij een KILL?

   WAAR DIT UIT KOMT. scripts/mutatie.js verandert echte bronbestanden -- dat moet
   ook, want een mutatieproef die de bron niet aanraakt bewijst niets -- en zet ze
   in een `finally` terug. Dat werkt bij een normale afloop en NIET als het proces
   wordt afgebroken. Op 2026-08-05 heb ik de motor met een kill gestopt terwijl hij
   `server/lokaal-tls.js` gemuteerd had staan (`return true` -> `false` in het
   loket dat het CA-certificaat uitgeeft), en die mutatie bleef in de werkboom
   achter. Regel 36 van scripts/check.js vangt zo'n restant in een COMMIT; deze
   wacht hoort te voorkomen dat hij er ooit komt.

   EN EEN WACHT DIE JE NIET HEBT ZIEN WERKEN IS EEN BELOFTE. Vandaar deze toets, en
   vandaar dat de motor `aanmelden`/`zetTerug` naar buiten geeft: een wacht die je
   niet kunt aanroepen kun je ook niet toetsen. De eerste poging bewees niets
   (het proefje crashte VOOR de mutatie en meldde toen "OK" -- precies LAT.md
   regel 9 in het klein).

   Er wordt met opzet een ONBELANGRIJK bestand gemuteerd in een tijdelijke map, en
   niet iets uit server/: een toets die de echte bron aanraakt en zelf omvalt,
   laat precies de rommel achter waar hij over gaat.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MOTOR = path.join(__dirname, '..', 'scripts', 'mutatie.js');

function wachtOp(kind) {
  return new Promise((klaar) => kind.on('exit', (code, sein) => klaar({ code, sein })));
}

async function proef(sein) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht-'));
  const doel = path.join(map, 'bron.js');
  const origineel = 'module.exports = () => true;\n';
  fs.writeFileSync(doel, origineel);
  try {
    /* Een kind dat de motor laadt, het bestand AANMELDT, muteert en dan blijft
       hangen. Daarna sturen we het sein. De wacht van de motor moet opruimen; het
       kind zelf doet niets. */
    const kind = spawn(process.execPath, ['-e', `
      const fs = require('fs');
      const m = require(${JSON.stringify(MOTOR)});
      const doel = ${JSON.stringify(doel)};
      const orig = fs.readFileSync(doel, 'utf8');
      m.aanmelden(doel, orig);
      fs.writeFileSync(doel, orig + '// GEMUTEERD\\n');
      process.stdout.write('gemuteerd\\n');
      setInterval(() => {}, 50);
    `], { stdio: ['ignore', 'pipe', 'inherit'] });

    // wachten tot het kind ZEGT dat het gemuteerd heeft -- niet op een klok
    await new Promise((klaar, breek) => {
      let uit = '';
      const t = setTimeout(() => breek(new Error('het kind meldde nooit dat het gemuteerd had')), 15000);
      kind.stdout.on('data', (d) => {
        uit += String(d);
        if (uit.includes('gemuteerd')) { clearTimeout(t); klaar(); }
      });
    });
    // eerst vaststellen dat de mutatie er ECHT staat; anders bewijst de rest niets
    assert.notEqual(fs.readFileSync(doel, 'utf8'), origineel,
      'de mutatie staat in het bestand voordat we het sein sturen');

    kind.kill(sein);
    await wachtOp(kind);
    return fs.readFileSync(doel, 'utf8');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
}

test('SIGTERM middenin een mutatie: de bron staat terug', async () => {
  const na = await proef('SIGTERM');
  assert.equal(na, 'module.exports = () => true;\n',
    'na SIGTERM hoort de bron weer origineel te zijn, maar er staat: ' + JSON.stringify(na));
});

test('SIGINT (ctrl-C) middenin een mutatie: de bron staat terug', async () => {
  const na = await proef('SIGINT');
  assert.equal(na, 'module.exports = () => true;\n',
    'na SIGINT hoort de bron weer origineel te zijn, maar er staat: ' + JSON.stringify(na));
});

/* DE HARDE PROEF, en de reden dat de wacht is herbouwd. De eerste versie leunde op
   signaalhandlers, en die zijn hier grotendeels nutteloos: de motor draait zijn
   toetsen met spawnSync en dat blokkeert de event-loop, dus komt een SIGTERM
   tijdens een proef nooit aan. Nagemeten: de motor bleef staan met server/redis.js
   gemuteerd en reageerde op geen enkele SIGTERM -- alleen kill -9 hielp, en dan
   ruimt niemand meer op. Dat de wacht eerder wel werkte was geluk (die kill landde
   tussen twee spawnSync-aanroepen).

   Deze toets gebruikt daarom SIGKILL: niet te vangen, dus als de bron daarna
   terugstaat kan dat alleen uit het spoor op schijf komen. */
test('kill -9 middenin een mutatie: de volgende ronde zet de bron terug uit het spoor', async () => {
  const m = require('../scripts/mutatie.js');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spoor-'));
  const doel = path.join(map, 'bron.js');
  const origineel = 'module.exports = () => true;\n';
  fs.writeFileSync(doel, origineel);
  try {
    const kind = spawn(process.execPath, ['-e', `
      const fs = require('fs');
      const m = require(${JSON.stringify(MOTOR)});
      const doel = ${JSON.stringify(doel)};
      const orig = fs.readFileSync(doel, 'utf8');
      m.aanmelden(doel, orig);
      m.schrijfSpoor();                       // het spoor op schijf, zoals de motor doet
      fs.writeFileSync(doel, orig + '// GEMUTEERD\\n');
      process.stdout.write('gemuteerd\\n');
      setInterval(() => {}, 50);
    `], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((klaar, breek) => {
      let uit = '';
      const t = setTimeout(() => breek(new Error('het kind meldde nooit dat het gemuteerd had')), 15000);
      kind.stdout.on('data', (d) => { uit += String(d); if (uit.includes('gemuteerd')) { clearTimeout(t); klaar(); } });
    });
    assert.notEqual(fs.readFileSync(doel, 'utf8'), origineel, 'de mutatie staat er');

    kind.kill('SIGKILL');                     // niet te vangen: geen handler haalt dit
    await wachtOp(kind);
    assert.notEqual(fs.readFileSync(doel, 'utf8'), origineel,
      'na kill -9 staat de mutatie er NOG -- anders bewijst de opruiming hieronder niets');

    const terug = m.ruimEerderOp();           // wat een volgende ronde als eerste doet
    assert.deepEqual(terug, [doel], 'de opruiming noemt het bestand dat hij heeft teruggezet');
    assert.equal(fs.readFileSync(doel, 'utf8'), origineel, 'en de bron staat terug');
    assert.equal(fs.existsSync(m.SPOOR), false, 'het spoor is opgeruimd, dus een tweede ronde doet niets meer');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
    try { fs.unlinkSync(m.SPOOR); } catch (e) {}
  }
});

/* DE BEDRADING, en niet alleen de twee helften. De eerste versie van de
   spoor-toets riep schrijfSpoor() zelf aan; toen ik die aanroep UIT de motor
   haalde bleef hij groen. Hij bewees dat de helften samenwerken en niet dat de
   motor ze gebruikt -- LAT.md regel 9 in het klein, in mijn eigen toets.

   Nu bezit metMutatie() alles wat met een mutatie op schijf te maken heeft, en
   toetst dit de functie zelf: staat het spoor er TIJDENS de mutatie, en is alles
   erna weer weg? Haal je een van de vier regels uit metMutatie, dan zakt dit. */
test('metMutatie zet het spoor neer TIJDENS de mutatie en ruimt het erna op', () => {
  const m = require('../scripts/mutatie.js');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrading-'));
  const doel = path.join(map, 'bron.js');
  fs.writeFileSync(doel, 'A\n');
  try {
    let tijdens = null;
    const uit = m.metMutatie(doel, 'B\n', () => {
      tijdens = {
        inhoud: fs.readFileSync(doel, 'utf8'),
        spoor: fs.existsSync(m.SPOOR) ? JSON.parse(fs.readFileSync(m.SPOOR, 'utf8')) : null
      };
      return 'antwoord';
    });
    assert.equal(uit, 'antwoord', 'de uitkomst van het werk komt terug');
    assert.equal(tijdens.inhoud, 'B\n', 'tijdens het werk staat de MUTATIE in het bestand');
    assert.ok(tijdens.spoor, 'en er staat een spoor op schijf -- zonder dat overleeft niets een kill -9');
    assert.deepEqual(tijdens.spoor.map(x => x.pad), [doel], 'het spoor noemt precies dit bestand');
    assert.equal(tijdens.spoor[0].bron, 'A\n', 'met de ORIGINELE inhoud, want daarmee wordt teruggezet');
    assert.equal(fs.readFileSync(doel, 'utf8'), 'A\n', 'erna staat het origineel terug');
    assert.equal(fs.existsSync(m.SPOOR), false, 'en het spoor is opgeruimd');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
    try { fs.unlinkSync(m.SPOOR); } catch (e) {}
  }
});

test('metMutatie zet ook terug als het werk een fout gooit', () => {
  const m = require('../scripts/mutatie.js');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrading2-'));
  const doel = path.join(map, 'bron.js');
  fs.writeFileSync(doel, 'A\n');
  try {
    assert.throws(() => m.metMutatie(doel, 'B\n', () => { throw new Error('boem'); }), /boem/);
    assert.equal(fs.readFileSync(doel, 'utf8'), 'A\n',
      'een fout in het werk mag de mutatie niet laten staan');
    assert.equal(fs.existsSync(m.SPOOR), false, 'en het spoor ook niet');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
    try { fs.unlinkSync(m.SPOOR); } catch (e) {}
  }
});

test('zetTerug ruimt alles op en laat niets in de lijst staan', () => {
  const m = require('../scripts/mutatie.js');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht2-'));
  const a = path.join(map, 'a.js'), b = path.join(map, 'b.js');
  try {
    fs.writeFileSync(a, 'A\n'); fs.writeFileSync(b, 'B\n');
    m.aanmelden(a, 'A\n'); m.aanmelden(b, 'B\n');
    fs.writeFileSync(a, 'stuk'); fs.writeFileSync(b, 'stuk');
    m.zetTerug();
    assert.equal(fs.readFileSync(a, 'utf8'), 'A\n', 'a staat terug');
    assert.equal(fs.readFileSync(b, 'utf8'), 'B\n', 'b staat terug');
    /* En de lijst is leeg: zou hij vol blijven, dan zet een tweede zetTerug()
       later een bestand terug naar een stand van uren eerder -- en dan draait de
       wacht zelf de rol van de fout die hij moet voorkomen. */
    fs.writeFileSync(a, 'nieuw werk\n');
    m.zetTerug();
    assert.equal(fs.readFileSync(a, 'utf8'), 'nieuw werk\n',
      'een tweede zetTerug() raakt een afgemeld bestand niet meer aan');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});

/* ============================================================================
   EN: WACHT HIJ OP EEN ANDERE BRONMUTERENDE RONDE?

   De opruimwacht hierboven gaat over een CRASH. Dit gaat over
   GELIJKTIJDIGHEID, en dat is een andere storing met dezelfde oorzaak: deze
   motor verandert echte bestanden in server/.

   scripts/afbouw-slot.js bestaat daarvoor ("een tijdelijk ijkbestand mag nooit
   een geldige scan vervuilen"), maar werd alleen gepakt door test-runner.js,
   release-gate.js en staging-repetitie.js. Draaide iemand `npm run mutatie`
   naast `npm test`, dan las de suite gemuteerde bron en zakten er toetsen op
   code die niemand had geschreven -- en erger: ruimEerderOp() in de motor zet
   de LEVENDE mutaties van een tweede ronde terug, waarna beide uitslagen onzin
   zijn.
   ========================================================================== */
test('de motor weigert zolang een andere bronmuterende ronde het slot heeft', async () => {
  const WORTEL = path.join(__dirname, '..');
  const SLOT = path.join(WORTEL, '.release', 'afbouw-slot');
  /* Draait deze toets ONDER de volledige suite, dan houdt test-runner.js het
     slot al vast -- dat is precies de stand die we willen beproeven, en we
     blijven er dan vanaf. Draait hij los, dan zetten we zelf een slot op naam
     van dit proces (dat leeft, dus de motor mag het niet als verweesd opruimen)
     en halen het daarna weg. */
  const alGehouden = fs.existsSync(SLOT);
  if (!alGehouden) {
    fs.mkdirSync(SLOT, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(SLOT, 'eigenaar.json'),
      JSON.stringify({ pid: process.pid, taak: 'toets-gelijktijdigheid', gestart: new Date().toISOString() }));
  }
  try {
    const uit = await new Promise((klaar) => {
      const kind = spawn(process.execPath, [MOTOR, 'mutatiewacht.test.js'], { cwd: WORTEL });
      let tekst = '';
      kind.stdout.on('data', d => tekst += d);
      kind.stderr.on('data', d => tekst += d);
      kind.on('close', (code) => klaar({ code, tekst }));
    });
    assert.notEqual(uit.code, 0, 'de motor hoort te weigeren zolang het slot bezet is');
    assert.match(uit.tekst, /Afbouw is al actief/,
      'en te zeggen WIE het slot heeft, anders staat iemand te zoeken naar een proces dat hij niet ziet');
  } finally {
    if (!alGehouden) fs.rmSync(SLOT, { recursive: true, force: true });
  }
});
