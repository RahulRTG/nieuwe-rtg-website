/* DE MUTATIEMOTOR SCHRIJFT NIET BUITEN ZIJN MUTATIE (scripts/mutatie.js).

   Op 25 september 2026 draaide de motor `===->!==` om in de programmawacht van
   scripts/margeschaal.js (`if (require.main === module) process.exit(main())`).
   De `require` in test/margeschaal.test.js startte daarna het omzetprogramma, en
   dat herschreef de marges van 144 bestanden in public/. De motor zette alleen
   zijn eigen mutatie terug, en elke toets die daarna gemeten werd, las een andere
   bron dan die op de stempel stond.

   Twee lagen, en allebei worden ze hier vastgehouden:
   1. DE OORZAAK: de programmawacht valt buiten het codemasker, in beide vormen
      (`===` en `!==`), en in beide volgordes (`require.main === module` en
      `module === require.main`).
   2. DE KLASSE: wat er toch buiten het gemuteerde bestand verandert, wordt
      gezien, teruggezet, en telt niet als meting. Beproefd in een EIGEN
      git-repo, want een toets die in deze werkboom schrijft om te bewijzen dat
      schrijven in de werkboom wordt gezien, is precies de fout zelf.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - de regel met WACHT in codemasker() weghalen             -> toets 1 en 2 zakken
   - in bijwerkingVan() de tweede lus (terug naar git) weg   -> toets 4 zakt
   - in herstelBron() een nieuw bestand laten staan          -> toets 5 zakt

   Draai los: node --test test/mutatiebijwerking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { muteer, OPERATOREN, bronStand, bijwerkingVan, herstelBron } = require('../scripts/mutatie');

const op = (naam) => OPERATOREN.find(o => o.naam === naam);

test('1. de programmawacht wordt niet omgedraaid, de code ernaast wel', () => {
  const bron = "if (require.main === module) process.exit(main());\nconst gelijk = a === b;\n";
  const uit = muteer(bron, op('===->!=='), 0);
  assert.ok(uit, 'er is een andere === om te muteren');
  assert.match(uit, /require\.main === module/, 'de wacht blijft staan');
  assert.match(uit, /a !== b/, 'de mutatie landt op de code ernaast');
  assert.equal(muteer(bron, op('===->!=='), 1), null, 'er is geen tweede plek: de wacht telt niet mee');
});

test('2. ook de omgekeerde vorm en de andere volgorde', () => {
  assert.equal(muteer("if (require.main !== module) module.exports = x;\n", op('!==->==='), 0), null);
  assert.equal(muteer("if (module === require.main) main();\n", op('===->!=='), 0), null);
});

/* Een wegwerprepo met een gevolgd bestand, een al gewijzigd bestand en het
   bestand dat "gemuteerd" wordt. */
function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bijwerking-'));
  const git = (...a) => cp.spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'proef@rtg.test'); git('config', 'user.name', 'proef');
  fs.writeFileSync(path.join(d, 'schoon.txt'), 'schoon\n');
  fs.writeFileSync(path.join(d, 'vuil.txt'), 'in git\n');
  fs.writeFileSync(path.join(d, 'doel.js'), 'module.exports = 1;\n');
  git('add', '.'); git('commit', '-qm', 'begin');
  fs.writeFileSync(path.join(d, 'vuil.txt'), 'lokaal gewijzigd\n');   // stond al open voor de ronde
  return d;
}

test('3. het gemuteerde bestand zelf is geen bijwerking', () => {
  const d = repo();
  const doel = path.join(d, 'doel.js');
  const voor = bronStand(doel, d);
  fs.writeFileSync(doel, 'module.exports = 2;\n');
  assert.deepEqual(bijwerkingVan(voor, bronStand(doel, d)), []);
});

test('4. een geschreven, een nieuw en een teruggezet bestand worden alle drie gezien', () => {
  const d = repo();
  const doel = path.join(d, 'doel.js');
  const voor = bronStand(doel, d);
  fs.writeFileSync(path.join(d, 'schoon.txt'), 'overschreven\n');
  fs.writeFileSync(path.join(d, 'nieuw.txt'), 'erbij\n');
  cp.spawnSync('git', ['checkout', '--', 'vuil.txt'], { cwd: d });   // de lokale wijziging weg
  assert.deepEqual(bijwerkingVan(voor, bronStand(doel, d)).sort(), ['nieuw.txt', 'schoon.txt', 'vuil.txt']);
});

test('5. herstellen zet de werkboom terug zoals hij voor de run was', () => {
  const d = repo();
  const doel = path.join(d, 'doel.js');
  const voor = bronStand(doel, d);
  fs.writeFileSync(path.join(d, 'schoon.txt'), 'overschreven\n');
  fs.writeFileSync(path.join(d, 'nieuw.txt'), 'erbij\n');
  fs.writeFileSync(path.join(d, 'vuil.txt'), 'nog eens anders\n');
  herstelBron(voor, bijwerkingVan(voor, bronStand(doel, d)), d);
  assert.equal(fs.readFileSync(path.join(d, 'schoon.txt'), 'utf8'), 'schoon\n', 'uit git');
  assert.equal(fs.readFileSync(path.join(d, 'vuil.txt'), 'utf8'), 'lokaal gewijzigd\n', 'de lokale wijziging van voor de run, niet die uit git');
  assert.equal(fs.existsSync(path.join(d, 'nieuw.txt')), false, 'een nieuw bestand gaat weg');
  assert.deepEqual(bijwerkingVan(voor, bronStand(doel, d)), [], 'daarna is er niets meer anders');
});

test('6. een gerichte bronmutatie is gebonden aan exacte toets- en bronbytes', t => {
  const { gerichteBron } = require('../scripts/mutatie');
  const crypto = require('node:crypto');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gerichte-bron-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  fs.mkdirSync(path.join(d, 'test')); fs.mkdirSync(path.join(d, 'server'));
  const source = 'module.exports = value => value === 3;\n';
  const toets = 'const assert = require("node:assert/strict");\n';
  fs.writeFileSync(path.join(d, 'server/demo.js'), source);
  fs.writeFileSync(path.join(d, 'test/demo.test.js'), toets);
  const hash = text => crypto.createHash('sha256').update(text).digest('hex');
  const proef = { test: 'test/demo.test.js', module: 'server/demo.js',
    testSha256: hash(toets), sourceSha256: hash(source), find: 'value === 3', replace: 'value !== 3',
    expectedFailure: 'the wrong value was accepted', rationale: 'waardegrens omgedraaid' };
  assert.deepEqual(gerichteBron(proef, d), { bron: source, mutant: source.replace('===', '!==') });
  for (const patch of [{ test: '../test/demo.test.js' }, { module: 'server/../server/demo.js' },
    { testSha256: '0'.repeat(64) }, { sourceSha256: '0'.repeat(64) }, { find: 'ontbreekt' },
    { find: '' }, { replace: proef.find }, { expectedFailure: '' }, { rationale: '' }]) {
    assert.throws(() => gerichteBron({ ...proef, ...patch }, d), JSON.stringify(patch));
  }
  fs.writeFileSync(path.join(d, 'server/demo.js'), source + source);
  assert.throws(() => gerichteBron({ ...proef, sourceSha256: hash(source + source) }, d), /één exacte vervanging/);
  fs.writeFileSync(path.join(d, 'server/demo.js'), source);
  fs.symlinkSync(path.join(d, 'server/demo.js'), path.join(d, 'server/link.js'));
  assert.throws(() => gerichteBron({ ...proef, module: 'server/link.js' }, d), /bronbinding/);
});

test('7. een PASS-naam, time-out of andere falende toets bewijst de gerichte assertie niet', () => {
  const { gerichteAssertie } = require('../scripts/mutatie');
  const claim = 'offline cache is empty';
  const failed = "not ok 1 - cache contract\n  ---\n  error: 'offline cache is empty'\n  code: 'ERR_ASSERTION'\n  ...\n";
  assert.equal(gerichteAssertie(failed + '# tests 1\n', claim), true);
  assert.equal(gerichteAssertie("ok 1 - offline cache is empty\n" + failed.replace(claim, 'another failure'), claim), false);
  assert.equal(gerichteAssertie(failed.replace('ERR_ASSERTION', 'ERR_TEST_FAILURE'), claim), false);
  assert.equal(gerichteAssertie(failed.replace('not ok', 'ok'), claim), false);
  assert.equal(gerichteAssertie('not ok 1 - offline cache is empty\n  error: Timeout\n', claim), false);
});
