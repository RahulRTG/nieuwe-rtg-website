'use strict';
/* ============================================================================
   INVOERSPOOR -- blok() MET EEN GEGEVEN SPOOR, EN ELKE REDEN VAN invoerVersheid

   invoerspoor.test.js draait een proefgenerator met de preload in een eigen
   proces. Dit bestand toetst de twee functies van scripts/lib/invoerspoor.js
   rechtstreeks: blok() met een met de hand gezet spoor (wat telt als invoer,
   wat als uitvoer, wat uit require.cache komt, wat ongecommit was) en
   invoerVersheid() met stempels die elk precies een reden van `onbekend`
   raken, plus de vergelijking met de werkboom, een hernoemde map en een
   andere Node-hoofdversie.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { blok, invoerVersheid, wijzigingen } = require('../scripts/lib/invoerspoor');

const NODE = Number(process.versions.node.split('.')[0]);

function repo(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-invoer-t-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const git = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q');
  git('config', 'user.email', 'toets@rtg.invalid');
  git('config', 'user.name', 'toets');
  git('config', 'commit.gpgsign', 'false');
  const schrijf = (p, inhoud) => { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), inhoud); };
  schrijf('a.txt', 'a\n');
  schrijf('d/x.txt', 'x\n');
  schrijf('diep/een/y.txt', 'y\n');
  schrijf('server/code.js', 'module.exports = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'begin');
  const commit = (m) => { git('add', '-A'); git('commit', '-q', '-m', m); return git('rev-parse', 'HEAD'); };
  return { d, git, schrijf, commit, basis: git('rev-parse', 'HEAD') };
}

function spoor(wortel, over = {}) {
  return { wortel, lees: new Set(), bestaat: new Set(), mappen: new Map(), schrijf: new Set(),
    omgeving: new Map(), onwaarneembaar: new Set(), ...over };
}
function metSpoor(s, fn) {
  const oud = global.__rtgInvoerspoor;
  global.__rtgInvoerspoor = s;
  try { return fn(); } finally { if (oud === undefined) delete global.__rtgInvoerspoor; else global.__rtgInvoerspoor = oud; }
}
/* Een stempel dat alle poorten van `onbekend` passeert. */
const schoon = (commit, invoer = {}) => ({ commit, invoer: { meting: 'invoerspoor', versie: 1, boomVuil: false,
  ongecommitteInvoer: [], bestanden: [], bestaat: [], mappen: [], omgevingGekopieerd: false, omgeving: [],
  onwaarneembaar: [], nodeHoofdversie: NODE, ...invoer } });

test('blok zonder spoor geeft undefined, zodat het veld uit het stempel valt', () => {
  assert.equal(metSpoor(undefined, () => blok(['x'])), undefined);
});

test('blok: uitvoer, schrijfacties en het meetinstrument zelf tellen niet als invoer', (t) => {
  const r = repo(t);
  const s = spoor(r.d, {
    lees: new Set(['a.txt', 'uit.json', 'geschreven.json', 'scripts/lib/invoerspoor.js']),
    bestaat: new Set(['a.txt', 'c.txt', 'geschreven.json']),
    mappen: new Map([['d', false], ['diep', true], ['uit.json', false]]),
    schrijf: new Set(['geschreven.json']),
    omgeving: new Map([['GEZET', true], ['LEEG', false], ['AA', true]]),
    onwaarneembaar: new Set(['git log', 'curl x']),
    omgevingGekopieerd: 1,
  });
  const b = metSpoor(s, () => blok(['uit.json']));
  assert.equal(b.meting, 'invoerspoor');
  assert.equal(b.versie, 1);
  assert.deepEqual(b.bestanden, ['a.txt']);
  assert.deepEqual(b.bestaat, ['c.txt'], 'wat al gelezen is, is geen losse bestaansvraag');
  assert.deepEqual(b.mappen, [{ pad: 'd' }, { pad: 'diep', recursief: true }]);
  assert.deepEqual(b.omgeving, ['AA', 'GEZET'], 'alleen gezette namen, gesorteerd');
  assert.deepEqual(b.onwaarneembaar, ['curl x', 'git log']);
  assert.equal(b.omgevingGekopieerd, true);
  assert.equal(b.boomVuil, false, 'een schone repository');
  assert.deepEqual(b.ongecommitteInvoer, []);
  assert.equal(b.nodeHoofdversie, NODE);
});

test('blok zonder uitvoerlijst, met modules uit require.cache binnen de wortel en uit node_modules', (t) => {
  const r = repo(t);
  r.schrijf('gen.js', 'module.exports = 2;\n');
  const gen = path.join(r.d, 'gen.js');
  const nep = path.join(r.d, 'node_modules', 'pakket', 'index.js');
  require(gen);
  require.cache[nep] = { id: nep, filename: nep, loaded: true, exports: {} };
  try {
    const b = metSpoor(spoor(r.d), () => blok());
    assert.deepEqual(b.bestanden, ['gen.js', 'package-lock.json'], 'node_modules wordt de pakketlijst');
    /* gen.js is nog niet gecommit, maar valt buiten de code: boomVuil nee, wel ongecommitte invoer */
    assert.equal(b.boomVuil, false);
    assert.deepEqual(b.ongecommitteInvoer, ['gen.js']);
  } finally { delete require.cache[gen]; delete require.cache[nep]; }
});

test('blok ziet ongecommitte code en een hernoeming als ongecommitte invoer', (t) => {
  const r = repo(t);
  fs.appendFileSync(path.join(r.d, 'server/code.js'), '// gewijzigd\n');
  r.git('mv', 'a.txt', 'b.txt');
  const s = spoor(r.d, { lees: new Set(['server/code.js', 'b.txt']), bestaat: new Set(['d/x.txt']) });
  const b = metSpoor(s, () => blok([]));
  assert.equal(b.boomVuil, true);
  assert.deepEqual(b.ongecommitteInvoer, ['b.txt', 'server/code.js']);
});

test('blok buiten een git-repository: boomVuil en ongecommitteInvoer zijn null, niet nee', (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-invoer-geen-git-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const oud = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = path.dirname(d);
  try {
    const b = metSpoor(spoor(d, { lees: new Set(['a.txt']) }), () => blok([]));
    assert.equal(b.boomVuil, null);
    assert.equal(b.ongecommitteInvoer, null);
    assert.deepEqual(b.bestanden, ['a.txt']);
  } finally { if (oud === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = oud; }
});

test('invoerVersheid: elke poort van onbekend heeft zijn eigen reden', () => {
  const c = 'abc123';
  const reden = (s) => invoerVersheid(s, { wortel: os.tmpdir() });
  const geval = [
    [{ commit: c, invoer: { meting: 'iets-anders' } }, /zonder invoerspoor/],
    [{ invoer: schoon(c).invoer }, /zonder commit/],
    [schoon(c, { boomVuil: null }), /ongecommit werk stond/],
    [schoon(c, { ongecommitteInvoer: null }), /invoer gecommit was/],
    [schoon(c, { ongecommitteInvoer: ['1', '2', '3', '4', '5', '6'] }), /nog niet gecommit was: 1, 2, 3, 4, 5$/],
    [{ ...schoon(c), boomVuil: true }, /ongecommit werk in de boom/],
    [schoon(c, { boomVuil: true }), /ongecommit werk in de boom/],
    [schoon(c, { onwaarneembaar: ['git log', 'curl'] }), /buiten het spoor om: git log, curl/],
    [schoon(c, { omgevingGekopieerd: true }), /kopieerde de hele omgeving/],
    [schoon(c, { omgeving: ['A', 'B'] }), /omgevingsvariabelen \(A, B\)/],
  ];
  for (const [s, re] of geval) {
    const u = reden(s);
    assert.equal(u.stand, 'onbekend', JSON.stringify(s));
    assert.match(u.reden, re);
  }
});

test('invoerVersheid zonder opties gebruikt de repository zelf, en een onbekende commit is onbekend', () => {
  const u = invoerVersheid(schoon('0'.repeat(40)));
  assert.equal(u.stand, 'onbekend');
  assert.match(u.reden, /meetcommit 0{40} is hier niet te vergelijken/);
});

test('invoerVersheid: zonder lijsten in het stempel is een schone meting actueel met nultellingen', (t) => {
  const r = repo(t);
  const s = schoon(r.basis);
  delete s.invoer.bestanden; delete s.invoer.bestaat; delete s.invoer.mappen; delete s.invoer.nodeHoofdversie;
  r.schrijf('nieuw.txt', 'n\n');
  r.commit('nieuw');
  const u = invoerVersheid(s, { wortel: r.d });
  assert.equal(u.stand, 'actueel');
  assert.equal(u.reden, 'alle 0 gelezen bestanden, 0 bestaansvragen en 0 opgesomde mappen zijn gelijk sinds ' + r.basis);
});

test('invoerVersheid: een nieuw bestand diep in een recursieve map, of in de wortel bij een recursieve wortelmap', (t) => {
  const r = repo(t);
  r.schrijf('diep/een/twee/z.txt', 'z\n');
  r.commit('diep');
  const recursief = invoerVersheid(schoon(r.basis, { mappen: [{ pad: 'diep', recursief: true }] }), { wortel: r.d });
  assert.equal(recursief.stand, 'mogelijk-verouderd');
  assert.deepEqual(recursief.geraakt, ['diep/een/twee/z.txt (in opgesomde map diep)']);
  const nietRecursief = invoerVersheid(schoon(r.basis, { mappen: [{ pad: 'diep' }] }), { wortel: r.d });
  assert.equal(nietRecursief.stand, 'actueel', 'een niet-recursieve map ziet alleen zijn directe kinderen');
  const wortelmap = invoerVersheid(schoon(r.basis, { mappen: [{ pad: '', recursief: true }] }), { wortel: r.d });
  assert.equal(wortelmap.stand, 'mogelijk-verouderd');
});

test('invoerVersheid: alleen inhoud gewijzigd raakt geen bestaansvraag; verwijderen wel', (t) => {
  const r = repo(t);
  fs.appendFileSync(path.join(r.d, 'a.txt'), 'meer\n');
  r.commit('inhoud');
  assert.equal(invoerVersheid(schoon(r.basis, { bestaat: ['a.txt'], mappen: [{ pad: '.' }] }), { wortel: r.d }).stand, 'actueel');
  fs.rmSync(path.join(r.d, 'a.txt'));
  r.commit('weg');
  const u = invoerVersheid(schoon(r.basis, { bestaat: ['a.txt'] }), { wortel: r.d });
  assert.equal(u.stand, 'mogelijk-verouderd');
  assert.deepEqual(u.geraakt, ['a.txt (bestaat)']);
});

test('invoerVersheid tegen de werkboom ziet een ongecommitte wijziging van een gelezen bestand', (t) => {
  const r = repo(t);
  fs.appendFileSync(path.join(r.d, 'a.txt'), 'werk\n');
  const s = schoon(r.basis, { bestanden: ['a.txt'] });
  assert.equal(invoerVersheid(s, { wortel: r.d }).stand, 'actueel', 'tegen HEAD is er niets veranderd');
  const u = invoerVersheid(s, { wortel: r.d, tegen: 'werkboom' });
  assert.equal(u.stand, 'mogelijk-verouderd');
  assert.deepEqual(u.geraakt, ['a.txt']);
  assert.deepEqual(wijzigingen(r.basis, 'werkboom', r.d), [{ status: 'M', pad: 'a.txt' }]);
});

test('invoerVersheid: een andere Node-hoofdversie is een veranderde invoer', (t) => {
  const r = repo(t);
  const u = invoerVersheid(schoon(r.basis, { nodeHoofdversie: NODE - 1 }), { wortel: r.d });
  assert.equal(u.stand, 'mogelijk-verouderd');
  assert.deepEqual(u.geraakt, ['Node ' + (NODE - 1) + ' -> ' + NODE]);
  assert.match(u.reden, /^1 invoer\(en\) veranderd sinds /);
});
