/* ============================================================================
   DE TOETS-ROUTEKAART OVER RONDES (ARCHITECTOPDRACHT.md, fase 3)

   scripts/toetsroutes.js voegt de journalen van een ronde samen met het vorige
   register. Deze toets houdt vast wat het stop/go-bewijs van fase 3 eist:

     - een bekende toets die een bekende route raakt, staat in de samenvatting;
     - een relatie is een WAARNEMING per ronde, en een ronde waarin hij
       ontbrak telt mee in plaats van hem te wissen;
     - de mutatie: laat het journaal de naam van een toets weglaten, en die
       toets wordt ongemeten met volleRing en nooit waargenomen;
     - een register van een vorige ronde is mogelijk-verouderd, nooit actueel.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { voegToe, maak, versheid, VENSTER } = require('../scripts/toetsroutes');

/* Een ronde zoals rondeVan() hem levert, zonder schijf. */
function ronde(commit, gezien, gedraaid, zonderEigenaar) {
  const perToets = new Map(Object.entries(gezien).map(([t, k]) => [t, new Set(k)]));
  const toetsen = [...new Set(Object.keys(gezien).concat(gedraaid || []))].sort();
  return { perToets, gedraaid: gedraaid ? new Set(gedraaid) : null, toetsen,
    meta: { commit, kantenZonderEigenaar: zonderEigenaar || 0 } };
}

test('1. een bekende toets met een bekende route staat in de samenvatting, als waargenomen', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toetsroutes-'));
  fs.writeFileSync(path.join(d, 'j.log'), 'TOETS POST /api/supplier/roster rekening.test.js\nTOETS GET /api/health rekening.test.js\n');
  fs.writeFileSync(path.join(d, 'duur'), 'rekening.test.js\t100\tnormaal\n');
  const r = maak({ journalen: [path.join(d, 'j.log')], duur: [path.join(d, 'duur')], commit: 'abc1234' });
  const t = r.per['rekening.test.js'];
  assert.strictEqual(t.stand, 'waargenomen');
  assert.strictEqual(t.volleRing, false);
  assert.strictEqual(t.kanten['POST /api/supplier/roster'], '1');
  assert.strictEqual(r.rondes[0].commit, 'abc1234');
  assert.ok(r.per['agenda.e2e.js'], 'elke toets uit test/ staat erin, ook als hij niet draaide');
  assert.strictEqual(r.per['agenda.e2e.js'].stand, 'ongemeten');
});

test('2. een relatie is een waarneming per ronde: ontbreken wist hem niet', () => {
  let reg = voegToe(null, ronde('r1', { 'a.test.js': ['GET /x', 'GET /y'] }, ['a.test.js']));
  reg = voegToe(reg, ronde('r2', { 'a.test.js': ['GET /x'] }, ['a.test.js']));
  assert.strictEqual(reg.per['a.test.js'].kanten['GET /x'], '11');
  assert.strictEqual(reg.per['a.test.js'].kanten['GET /y'], '10', 'een keer niet gezien is geen nooit');
  assert.strictEqual(reg.per['a.test.js'].draaide, '11');
  /* Draaide de toets niet, dan zegt die ronde niets over zijn relaties. */
  reg = voegToe(reg, ronde('r3', {}, ['b.test.js']));
  assert.strictEqual(reg.per['a.test.js'].kanten['GET /x'], '11-');
  assert.strictEqual(reg.per['a.test.js'].stand, 'ongemeten');
});

test('3. het venster schuift: oudste ronde valt af, en een relatie die er dan niet meer in staat ook', () => {
  let reg = voegToe(null, ronde('r0', { 'a.test.js': ['GET /oud', 'GET /x'] }, ['a.test.js']));
  for (let i = 1; i <= VENSTER; i++) reg = voegToe(reg, ronde('r' + i, { 'a.test.js': ['GET /x'] }, ['a.test.js']));
  assert.strictEqual(reg.rondes.length, VENSTER);
  assert.strictEqual(reg.rondes[0].commit, 'r1');
  assert.strictEqual(reg.per['a.test.js'].kanten['GET /x'], '1'.repeat(VENSTER));
  assert.ok(!('GET /oud' in reg.per['a.test.js'].kanten), 'buiten het venster gezien is geen waarneming meer');
});

test('4. de mutatie: een journaal dat de naam weglaat, maakt de toets ongemeten en nooit waargenomen', () => {
  /* Zelfde ronde, een keer met naam en een keer met `onbekend` -- precies wat
     er gebeurt als RTG_TOETS niet in het kindproces aankomt. */
  const met = voegToe(null, ronde('r1', { 'a.test.js': ['GET /x'] }, ['a.test.js', 'b.test.js']));
  assert.strictEqual(met.per['a.test.js'].stand, 'waargenomen');
  assert.strictEqual(met.per['b.test.js'].stand, 'draaideZonderRoute', 'zonder kanten zonder eigenaar is dat een eigenschap');

  const zonder = voegToe(null, ronde('r1', {}, ['a.test.js', 'b.test.js'], 1));
  for (const t of ['a.test.js', 'b.test.js']) {
    assert.strictEqual(zonder.per[t].stand, 'ongemeten', t + ': een kant zonder eigenaar kan van deze toets zijn');
    assert.strictEqual(zonder.per[t].volleRing, true);
  }
});

test('5. zonder duurregister is "draaide niet" niet te onderscheiden, en wordt het nooit een nul', () => {
  const reg = voegToe(null, ronde('r1', { 'a.test.js': ['GET /x'] }, null));
  assert.strictEqual(reg.per['a.test.js'].stand, 'waargenomen');
  const leeg = voegToe(null, { perToets: new Map(), gedraaid: null, toetsen: ['b.test.js'], meta: { commit: 'r1', kantenZonderEigenaar: 0 } });
  assert.strictEqual(leeg.per['b.test.js'].draaide, '-');
  assert.strictEqual(leeg.per['b.test.js'].stand, 'ongemeten');
});

test('6. versheid: actueel op de rondecommit, mogelijk-verouderd na een toetswijziging, onbekend zonder ronde', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toetsroutes-git-'));
  const git = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q'); git('config', 'user.email', 'toets@rtg.invalid'); git('config', 'user.name', 'toets'); git('config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(d, 'test'));
  fs.writeFileSync(path.join(d, 'test', 'a.test.js'), '1\n');
  fs.writeFileSync(path.join(d, 'LEESMIJ.md'), 'x\n');
  git('add', '-A'); git('commit', '-q', '-m', 'begin');
  const reg = { rondes: [{ commit: git('rev-parse', '--short', 'HEAD') }] };
  assert.strictEqual(versheid(reg, { wortel: d }).stand, 'actueel');
  fs.writeFileSync(path.join(d, 'LEESMIJ.md'), 'y\n');
  git('commit', '-qam', 'document');
  assert.strictEqual(versheid(reg, { wortel: d }).stand, 'actueel', 'een document bepaalt geen relatie');
  fs.writeFileSync(path.join(d, 'test', 'a.test.js'), '2\n');
  git('commit', '-qam', 'toets');
  const v = versheid(reg, { wortel: d });
  assert.strictEqual(v.stand, 'mogelijk-verouderd');
  assert.ok(v.geraakt.includes('test/a.test.js'));
  assert.strictEqual(versheid({ rondes: [] }, { wortel: d }).stand, 'onbekend');
  assert.strictEqual(versheid({ rondes: [{ commit: 'deadbee' }] }, { wortel: d }).stand, 'onbekend');
});
