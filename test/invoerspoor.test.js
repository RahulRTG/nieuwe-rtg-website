/* ============================================================================
   HET INVOERSPOOR EN DE VERSHEID PER REGISTER (ARCHITECTOPDRACHT.md, fase 2)

   Elke regel van de versheid wordt hier beproefd met een kleine generator in
   een eigen, tijdelijke git-repository: hij leest a.txt, somt d/ op, vraagt of
   c.txt bestaat, en schrijft uit.json met de gemeten invoer in zijn stempel.
   De echte generators zijn te groot voor een toets; dit bewijst het mechanisme
   en de ijking op de echte generators staat in de PR.

   Toets 8 is de zelfijking: met een te smalle invoerlijst moet de versheid
   ten onrechte "actueel" zeggen -- anders hangt de uitslag niet aan de lijst
   en bewijst deze toets niets.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { invoerVersheid } = require('../scripts/lib/invoerspoor');

const PRELOAD = path.join(__dirname, '..', 'scripts', 'lib', 'invoerspoor-preload.js');

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-invoer-'));
  const git = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q');
  git('config', 'user.email', 'toets@rtg.invalid');
  git('config', 'user.name', 'toets');
  git('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(d, 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(d, 'b.txt'), 'b\n');
  fs.mkdirSync(path.join(d, 'd'));
  fs.writeFileSync(path.join(d, 'd', 'x.txt'), 'x\n');
  fs.writeFileSync(path.join(d, 'gen.js'), [
    "'use strict';",
    "const fs = require('fs');",
    "const { execSync } = require('child_process');",
    "const blok = (u) => (global.__rtgInvoerspoor ? global.__rtgInvoerspoor.blok(u) : undefined);",
    "const a = fs.readFileSync('a.txt', 'utf8');",
    "const lijst = fs.readdirSync('d');",
    "const c = fs.existsSync('c.txt');",
    "const vlag = process.env.RTG_FIXTURE_VLAG || '';",
    "if (process.argv.includes('--git-log')) execSync('git log -1 --format=%H');",
    "if (process.argv.includes('--kopie')) execSync('git log -1', { env: { ...process.env, X: '1' } });",
    "const commit = execSync('git rev-parse --short HEAD').toString().trim();",
    "fs.writeFileSync('uit.json', JSON.stringify({ stempel: { commit, invoer: blok(['uit.json']) }, a, lijst, c, vlag }));",
  ].join('\n'));
  git('add', '-A');
  git('commit', '-q', '-m', 'begin');
  const draai = (opties) => {
    const o = opties || {};
    const env = Object.assign({}, process.env, { RTG_INVOER_WORTEL: d });
    delete env.RTG_FIXTURE_VLAG;
    if (o.vlag) env.RTG_FIXTURE_VLAG = '1';
    const args = (o.zonderSpoor ? [] : ['-r', PRELOAD]).concat(['gen.js'], o.gitLog ? ['--git-log'] : [], o.kopie ? ['--kopie'] : []);
    const r = spawnSync(process.execPath, args, { cwd: d, env, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    return JSON.parse(fs.readFileSync(path.join(d, 'uit.json'), 'utf8')).stempel;
  };
  const commit = (bericht) => { git('add', '-A'); git('commit', '-q', '-m', bericht); };
  const schrijf = (p, t) => { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), t); };
  const versheid = (s) => invoerVersheid(s, { wortel: d });
  return { d, git, draai, commit, schrijf, versheid };
}

/* Meet op een schone boom en commit de uitvoer, zoals een generator hoort te
   draaien. */
function gemeten() {
  const r = repo();
  const s = r.draai();
  r.commit('meting');
  return Object.assign(r, { s });
}

test('1. het spoor ziet wat de generator las, en niet wat hij schreef', () => {
  const { s } = gemeten();
  assert.ok(s.invoer.bestanden.includes('a.txt'), JSON.stringify(s.invoer));
  assert.ok(s.invoer.bestanden.includes('gen.js'));
  assert.ok(!s.invoer.bestanden.includes('b.txt'));
  assert.ok(!s.invoer.bestanden.includes('uit.json'));
  assert.deepStrictEqual(s.invoer.mappen, [{ pad: 'd' }]);
  assert.ok(s.invoer.bestaat.includes('c.txt'));
  assert.deepStrictEqual(s.invoer.onwaarneembaar, [], 'git rev-parse hoort bij het stempel en niet bij de invoer');
  assert.strictEqual(s.invoer.boomVuil, false);
  assert.deepStrictEqual(s.invoer.ongecommitteInvoer, []);
});

test('2. na het committen van de uitvoer is de meting actueel', () => {
  const r = gemeten();
  assert.strictEqual(r.versheid(r.s).stand, 'actueel');
});

test('3. een bestand dat niet gelezen werd, maakt niets verouderd', () => {
  const r = gemeten();
  r.schrijf('b.txt', 'b2\n');
  r.commit('b');
  assert.strictEqual(r.versheid(r.s).stand, 'actueel');
});

test('4. een gelezen bestand, een nieuw bestand in een opgesomde map, en een nieuw bestaand pad: elk mogelijk-verouderd', () => {
  for (const [wat, p] of [['gelezen', 'a.txt'], ['map', 'd/y.txt'], ['bestaat', 'c.txt']]) {
    const r = gemeten();
    r.schrijf(p, 'nieuw\n');
    r.commit(wat);
    const v = r.versheid(r.s);
    assert.strictEqual(v.stand, 'mogelijk-verouderd', wat + ': ' + JSON.stringify(v));
    assert.ok(v.geraakt.some((g) => g.startsWith(p)), wat + ': ' + JSON.stringify(v.geraakt));
  }
});

test('5. een subproces dat buiten het spoor leest, maakt de versheid onbekend', () => {
  const r = repo();
  const s = r.draai({ gitLog: true });
  r.commit('meting');
  const v = r.versheid(s);
  assert.strictEqual(v.stand, 'onbekend');
  assert.match(v.reden, /git log/);
});

test('6. een gezette omgevingsvariabele is achteraf niet na te lopen: onbekend, en de waarde staat nergens', () => {
  const r = repo();
  const s = r.draai({ vlag: true });
  r.commit('meting');
  assert.ok(s.invoer.omgeving.includes('RTG_FIXTURE_VLAG'));
  assert.ok(!JSON.stringify(s.invoer).includes('"1"'), 'alleen de naam hoort in het stempel');
  assert.strictEqual(r.versheid(s).stand, 'onbekend');
  /* Gelezen maar niet gezet telt niet: dan draaide de generator op zijn standaard. */
  const r2 = gemeten();
  assert.deepStrictEqual(r2.s.invoer.omgeving, []);
});

test('7. ongecommitte invoer, geen spoor of geen stempel: onbekend, met de reden', () => {
  const r = repo();
  r.schrijf('a.txt', 'nog niet gecommit\n');
  const s = r.draai();
  assert.deepStrictEqual(s.invoer.ongecommitteInvoer, ['a.txt']);
  assert.strictEqual(r.versheid(s).stand, 'onbekend');

  const r2 = repo();
  const zonder = r2.draai({ zonderSpoor: true });
  assert.strictEqual(zonder.invoer, undefined, 'zonder preload verandert het stempel niet');
  assert.strictEqual(r2.versheid(zonder).stand, 'onbekend');
  assert.strictEqual(r2.versheid(null).stand, 'onbekend');
});

test('8. zelfijking: met een te smalle invoerlijst zegt de versheid ten onrechte actueel', () => {
  const r = gemeten();
  r.schrijf('a.txt', 'a2\n');
  r.commit('a');
  assert.strictEqual(r.versheid(r.s).stand, 'mogelijk-verouderd');
  const smal = JSON.parse(JSON.stringify(r.s));
  smal.invoer.bestanden = smal.invoer.bestanden.filter((p) => p !== 'a.txt');
  assert.strictEqual(r.versheid(smal).stand, 'actueel',
    'de uitslag moet aan de gemeten lijst hangen; anders bewijst deze toets niets');
});

test('9. wie de hele omgeving kopieert, krijgt een feit in het stempel en geen lijst namen', () => {
  const r = repo();
  const s = r.draai({ kopie: true });
  r.commit('meting');
  assert.strictEqual(s.invoer.omgevingGekopieerd, true);
  assert.ok(!s.invoer.omgeving.includes('PATH'), 'de namen van de machine horen niet in het stempel: ' + s.invoer.omgeving.slice(0, 5));
  assert.match(r.versheid(s).reden, /subproces|buiten het spoor|kopieerde/);
  assert.strictEqual(r.versheid(s).stand, 'onbekend');
});
