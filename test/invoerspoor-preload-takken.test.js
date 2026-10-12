'use strict';
/* ============================================================================
   INVOERSPOOR-PRELOAD -- WAT HET SPOOR NOTEERT, PER SOORT AANROEP

   invoerspoor.test.js laadt de preload in een proefgenerator in een eigen
   proces en kijkt naar het stempel. Dit bestand laadt hem in DIT proces (elk
   testbestand draait in een eigen proces, dus het omhullen blijft hier) met
   een tijdelijke wortel, en toetst per soort aanroep wat er in het spoor
   belandt: een pad als tekst, URL, Buffer of descriptor; paden buiten de
   wortel, in .git en in node_modules; open met een schrijfvlag; recursief
   opsommen; fs.promises; subprocessen die wel en niet over de commit gaan;
   en het lezen of kopieren van de omgeving.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PROEFMAP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-preload-')));
const OUD_WORTEL = process.env.RTG_INVOER_WORTEL;
process.env.RTG_INVOER_WORTEL = PROEFMAP;
require('../scripts/lib/invoerspoor-preload');
if (OUD_WORTEL === undefined) delete process.env.RTG_INVOER_WORTEL; else process.env.RTG_INVOER_WORTEL = OUD_WORTEL;
const spoor = global.__rtgInvoerspoor;
const pad = (p) => path.join(PROEFMAP, p);

test.before(() => {
  fs.mkdirSync(pad('d/sub'), { recursive: true });
  fs.mkdirSync(pad('.git'));
  fs.writeFileSync(pad('a.txt'), 'a');
  fs.writeFileSync(pad('d/sub/x.txt'), 'x');
  fs.writeFileSync(pad('kind.js'), 'process.exit(0)\n');
  /* het opzetten zelf telt niet mee in de toetsen hieronder */
  spoor.lees.clear(); spoor.bestaat.clear(); spoor.mappen.clear(); spoor.schrijf.clear(); spoor.onwaarneembaar.clear();
});
test.after(() => { fs.rmSync(PROEFMAP, { recursive: true, force: true }); });

test('het spoor kent zijn wortel uit RTG_INVOER_WORTEL en hangt aan global', () => {
  assert.equal(spoor.wortel, PROEFMAP);
  assert.equal(typeof spoor.blok, 'function');
});

test('een pad als tekst, URL of Buffer wordt relatief genoteerd; descriptor, null en buiten de wortel niet', () => {
  fs.existsSync(pad('a.txt'));
  fs.statSync(new URL('file://' + pad('d')));
  fs.lstatSync(Buffer.from(pad('d/sub')));
  fs.existsSync(null);
  fs.existsSync(os.tmpdir());
  fs.existsSync(PROEFMAP);
  const fd = fs.openSync(pad('a.txt'), 'r');
  try { assert.equal(fs.readFileSync(fd, 'utf8'), 'a'); } finally { fs.closeSync(fd); }
  assert.deepEqual([...spoor.bestaat].sort(), ['a.txt', 'd', 'd/sub']);
  assert.deepEqual([...spoor.lees], ['a.txt'], 'openSync met r is een lezing; de descriptor zelf telt niet');
});

test('.git telt niet, en node_modules wordt de pakketlijst', () => {
  spoor.bestaat.clear();
  fs.existsSync(pad('.git'));
  fs.existsSync(pad('.git/HEAD'));
  fs.existsSync(pad('node_modules/pakket/index.js'));
  assert.deepEqual([...spoor.bestaat], ['package-lock.json']);
});

test('een pad dat niet als tekst te lezen is breekt het spoor niet', () => {
  const vreemd = { toString() { throw new Error('geen tekst'); } };
  assert.equal(fs.existsSync(vreemd), false);
  assert.throws(() => fs.openSync(pad('a.txt'), vreemd));
});

test('open met een schrijf- of toevoegvlag is schrijven, schrijven en hernoemen tellen als schrijfactie', () => {
  spoor.lees.clear(); spoor.schrijf.clear();
  fs.closeSync(fs.openSync(pad('w.txt'), 'w'));
  fs.closeSync(fs.openSync(pad('w.txt'), 'a+'));
  fs.writeFileSync(pad('s.txt'), 's');
  fs.renameSync(pad('s.txt'), pad('t.txt'));
  fs.copyFileSync(pad('t.txt'), pad('u.txt'));
  assert.deepEqual([...spoor.schrijf].sort(), ['s.txt', 't.txt', 'u.txt', 'w.txt']);
  assert.deepEqual([...spoor.lees], [], 'geen van deze is een lezing');
});

test('opsommen noteert de map, en recursief blijft recursief', () => {
  spoor.mappen.clear();
  fs.readdirSync(pad('d'));
  assert.equal(spoor.mappen.get('d'), false);
  fs.readdirSync(pad('d'), { recursive: true });
  assert.equal(spoor.mappen.get('d'), true);
  fs.readdirSync(pad('d'), 'utf8');
  assert.equal(spoor.mappen.get('d'), true, 'een latere gewone opsomming maakt hem niet minder recursief');
  fs.readdirSync(os.tmpdir());
  assert.deepEqual([...spoor.mappen.keys()], ['d']);
});

test('fs.promises: lezen, opsommen, bestaan en schrijven worden ook genoteerd', async () => {
  spoor.lees.clear(); spoor.mappen.clear(); spoor.bestaat.clear(); spoor.schrijf.clear();
  assert.equal(await fs.promises.readFile(pad('a.txt'), 'utf8'), 'a');
  await fs.promises.readdir(pad('d'), { recursive: true });
  await fs.promises.readdir(pad('d/sub'));
  await fs.promises.stat(pad('d'));
  await fs.promises.access(pad('a.txt'));
  await fs.promises.writeFile(pad('p.txt'), 'p');
  assert.deepEqual([...spoor.lees], ['a.txt']);
  assert.deepEqual([...spoor.mappen.entries()].sort(), [['d', true], ['d/sub', false]]);
  assert.deepEqual([...spoor.bestaat].sort(), ['a.txt', 'd']);
  assert.deepEqual([...spoor.schrijf], ['p.txt']);
});

test('git over de commit zelf is geen invoer; elk ander subproces is onwaarneembaar, met korte paden', () => {
  spoor.onwaarneembaar.clear();
  cp.spawnSync('git', ['--no-pager', 'status'], { cwd: PROEFMAP, stdio: 'ignore' });
  cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: PROEFMAP, stdio: 'ignore' });
  assert.deepEqual([...spoor.onwaarneembaar], [], 'status en rev-parse zijn het stempel');
  cp.spawnSync('git', ['log', '-1'], { cwd: PROEFMAP, stdio: 'ignore' });
  cp.execFileSync(process.execPath, [pad('kind.js'), 'een', 'twee', 'drie'], { stdio: 'ignore' });
  cp.spawnSync('true');
  cp.spawnSync('git', ['--version'], { stdio: 'ignore' });
  cp.execSync('true  met   woorden', { stdio: 'ignore' });
  const node = path.basename(process.execPath);
  assert.deepEqual([...spoor.onwaarneembaar].sort(), ['git --version', 'git log -1', node + ' kind.js een twee', 'true', 'true met woorden'].sort());
});

test('fork wordt als node-subproces genoteerd, met en zonder argumenten', async () => {
  spoor.onwaarneembaar.clear();
  /* het wachten op 'exit' hangt meteen aan elk kind, anders kan het tweede
     al klaar zijn voordat er geluisterd wordt */
  const klaar = (k) => new Promise((r) => k.on('exit', r));
  const een = klaar(cp.fork(pad('kind.js'), ['x'], { stdio: 'ignore' }));
  const twee = klaar(cp.fork(pad('kind.js'), { stdio: 'ignore' }));
  await Promise.all([een, twee]);
  assert.deepEqual([...spoor.onwaarneembaar].sort(), ['node kind.js', 'node kind.js x']);
});

test('een subproces met een onbruikbaar bestand breekt het spoor niet, en de stilte wordt hersteld', () => {
  spoor.onwaarneembaar.clear();
  const vreemd = { toString() { throw new Error('geen tekst'); } };
  assert.throws(() => cp.spawnSync(vreemd));
  assert.throws(() => cp.execSync(undefined));
  assert.equal(spoor.stil, 0, 'na een fout is het spoor weer luisterend');
});

test('de omgeving: een gelezen naam telt met of hij gezet was, opsommen is een kopie', async () => {
  const sleutel = 'RTG_PRELOAD_TOETS_' + process.pid;
  spoor.omgeving.delete(sleutel); spoor.omgeving.delete(sleutel + '_LEEG');
  process.env[sleutel + '_LEEG'] = '';
  try {
    assert.equal(process.env[sleutel], undefined);
    assert.equal(spoor.omgeving.get(sleutel), false);
    process.env[sleutel] = 'waarde';
    assert.equal(process.env[sleutel], 'waarde');
    assert.equal(spoor.omgeving.get(sleutel), true, 'eenmaal gezet gezien blijft gezet');
    void process.env[sleutel + '_LEEG'];
    assert.equal(spoor.omgeving.get(sleutel + '_LEEG'), false, 'een lege waarde telt als niet gezet');

    spoor.omgevingGekopieerd = false;
    const kopie = { ...process.env };
    assert.equal(kopie[sleutel], 'waarde');
    assert.equal(spoor.omgevingGekopieerd, true);
    /* tot de volgende tick telt een lezing bij de kopie */
    spoor.omgeving.delete('RTG_NA_KOPIE');
    void process.env.RTG_NA_KOPIE;
    assert.equal(spoor.omgeving.has('RTG_NA_KOPIE'), false);
    await new Promise((r) => process.nextTick(r));
    void process.env.RTG_NA_KOPIE;
    assert.equal(spoor.omgeving.has('RTG_NA_KOPIE'), true);
  } finally { delete process.env[sleutel]; delete process.env[sleutel + '_LEEG']; }
});

test('het blok van het spoor laat uitvoer weg en sorteert de gelezen bestanden', () => {
  spoor.lees.clear(); spoor.schrijf.clear(); spoor.bestaat.clear(); spoor.mappen.clear();
  spoor.onwaarneembaar.clear(); spoor.omgeving.clear(); spoor.omgevingGekopieerd = false;
  fs.readFileSync(pad('d/sub/x.txt'));
  fs.readFileSync(pad('a.txt'));
  fs.readFileSync(pad('t.txt'));
  const b = spoor.blok(['t.txt']);
  assert.deepEqual(b.bestanden, ['a.txt', 'd/sub/x.txt']);
  assert.equal(b.meting, 'invoerspoor');
});
