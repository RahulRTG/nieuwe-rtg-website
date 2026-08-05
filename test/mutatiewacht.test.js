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
