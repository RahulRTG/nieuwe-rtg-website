/* EEN POORT DIE ZAKT, MOET NOG KUNNEN ZEGGEN WAAROM.

   WAAROM DEZE TOETS BESTAAT. In een volle suite (12.377 toetsen, de machine vol)
   zakte test/versheidspoort.test.js op regel 123: de exitcode was 1, maar de
   opgevangen uitvoer hield op na het laatste register -- de samenvatting en het
   hele blok "DE VERSHEIDSPOORT ZAKT" ontbraken. Los gedraaid haalde diezelfde
   toets het wel.

   Dat ziet eruit als een flake en het was een echte fout. scripts/versheid.js
   sloot af met `process.exit(1)` direct na een reeks console.log-regels. Zodra
   stdout een PIJP is -- execFileSync, de CI, elke `| tee` -- schrijft Node
   asynchroon, en process.exit() wacht daar niet op. Wat nog in de buffer stond,
   ging verloren: een poort die met 1 afsluit zonder te zeggen waarom.

   Draai los: node --test test/versheid-uitvoer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const SCRIPT = path.join(WORTEL, 'scripts', 'versheid.js');
const RUIM = 64 * 1024 * 1024;

test('ZELFIJKING: console.log gevolgd door process.exit kapt door een pijp WEL af', () => {
  /* Zonder deze ijking bewijzen de toetsen hieronder niets: als dit patroon op
     deze machine niet afkapt, dan zegt "versheid.js kapt niet af" alleen dat de
     omstandigheden mild waren. Eerst het gebrek aantoonbaar maken. */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afkap-'));
  const stuk = path.join(map, 'kapt-af.js');
  fs.writeFileSync(stuk,
    "for (let i = 0; i < 40000; i++) console.log('regel ' + i + ' ' + 'x'.repeat(80));\n" +
    "console.log('LAATSTE REGEL');\n" +
    "process.exit(1);\n");
  let uitvoer = '';
  try { uitvoer = execFileSync(process.execPath, [stuk], { encoding: 'utf8', maxBuffer: RUIM }); }
  catch (e) { uitvoer = String(e.stdout || ''); }
  fs.rmSync(map, { recursive: true, force: true });
  assert.ok(!uitvoer.includes('LAATSTE REGEL'),
    'de ijking kapte niet af; dan meet deze toets het gebrek niet en zegt hij niets over versheid.js');
});

test('versheid.js roept process.exit() nergens in de CODE aan', () => {
  const bron = fs.readFileSync(SCRIPT, 'utf8');
  /* Commentaar mag hem noemen -- de uitleg staat er juist in, en die uitleg is
     het halve doel van deze regel. Dus eerst de blokken en de regelcommentaren
     eruit, en pas dan zoeken. Een filter op "begint met een ster" is te grof:
     lopende tekst binnen een blok begint met een gewone letter. */
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!/process\.exit\s*\(/.test(code),
    'process.exit() na een console.log kapt de uitvoer af zodra stdout een pijp is; gebruik process.exitCode');
});

test('door een pijp komt het HELE rapport mee, en de exitcode klopt', () => {
  let uitvoer = '', code = 0;
  try { uitvoer = execFileSync(process.execPath, [SCRIPT], { cwd: WORTEL, encoding: 'utf8', maxBuffer: RUIM }); }
  catch (e) { code = e.status; uitvoer = String(e.stdout || ''); }

  /* Deze regel staat ALTIJD onderaan, of de poort nu zakt of niet. Ontbreekt
     hij, dan is de uitvoer afgekapt -- ongeacht wat er verder in staat. */
  assert.match(uitvoer, /vers \d+\s+verouderd \d+\s+ontbreekt \d+/,
    'de samenvattingsregel ontbreekt: de uitvoer is afgekapt');

  /* En als hij zakt, hoort de reden erbij. Dat is precies de bewering die in de
     volle suite sneuvelde. */
  if (code === 1) {
    assert.match(uitvoer, /DE VERSHEIDSPOORT ZAKT/,
      'de poort zakt (exitcode 1) zonder te zeggen waarom');
  }
});

test('--json levert geldige JSON en niet de helft ervan', () => {
  /* Dezelfde fout was hier het schadelijkst: een afgekapte JSON is geen
     foutmelding maar ongeldige invoer voor wie hem uitleest. */
  let uit = '';
  try { uit = execFileSync(process.execPath, [SCRIPT, '--json'], { cwd: WORTEL, encoding: 'utf8', maxBuffer: RUIM }); }
  catch (e) { uit = String(e.stdout || ''); }
  const ontleed = JSON.parse(uit);
  assert.ok(Array.isArray(ontleed.poort), 'het JSON-antwoord draagt geen poort-lijst');
});
