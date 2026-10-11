/* DE INFRASTRUCTUURPOORT VAN DE TOETSEN (test/infra.js).

   Lokaal mag een toets zich overslaan als er een database, Redis of een
   browser ontbreekt -- met een etiket dat de draaier telt. In CI en bij een
   release eist RTG_EIS_INFRA die infrastructuur, en dan zakt zo'n toets in
   plaats van stil "geslaagd" te heten. Hier beproefd: de regel zelf, de vangrail
   van de draaier, en een ECHT toetsbestand in een echt node --test-proces, met en
   zonder de schakelaar.

   Draai los: node --test test/infra.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { vereist, vereistAlle, eisen, infraOordeel, SOORTEN } = require('./infra');

test('1. zonder schakelaar: aanwezig is false, ontbrekend is een reden MET etiket', () => {
  const env = {};
  assert.equal(vereist('pg', true, 'x', env), false);
  assert.equal(vereist('pg', false, 'geen DATABASE_URL', env), '[infra:pg] geen DATABASE_URL');
  assert.match(vereist('browser', false, undefined, env), /^\[infra:browser\] .+ontbreekt$/);
  assert.throws(() => vereist('pq', false, 'tikfout', env), /onbekende soort/, 'een onbekende soort is een fout');
});

test('2. met de schakelaar: een GEEISTE soort die ontbreekt zakt, een andere blijft een skip', () => {
  const env = { RTG_EIS_INFRA: 'pg, redis-server' };
  assert.throws(() => vereist('pg', false, 'geen DATABASE_URL', env), /\[infra:pg\] deze omgeving eist .*geen DATABASE_URL/);
  assert.throws(() => vereist('redis-server', false, 'niet geinstalleerd', env), /redis-server/);
  assert.equal(vereist('pg', true, 'x', env), false, 'aanwezig blijft gewoon aanwezig');
  assert.equal(vereist('browser', false, 'geen chromium', env), '[infra:browser] geen chromium', 'niet geeist: skip');
  for (const alles of ['1', 'alles']) {
    for (const s of Object.keys(SOORTEN)) assert.throws(() => vereist(s, false, 'weg', { RTG_EIS_INFRA: alles }), /RTG_EIS_INFRA/, s);
  }
  assert.equal(eisen({ RTG_EIS_INFRA: '0' }).size, 0);
});

test('3. een tikfout in de schakelaar zet niets stil uit maar zakt', () => {
  assert.throws(() => eisen({ RTG_EIS_INFRA: 'pg,redis-sever' }), /onbekende soort: redis-sever/);
  assert.throws(() => vereist('pg', true, 'x', { RTG_EIS_INFRA: 'brouwser' }), /onbekende soort/);
});

test('4. vereistAlle toetst ELKE soort: een niet-geeiste eerste soort verbergt een geeiste tweede niet', () => {
  const paren = [['pg', false], ['redis', false]];
  assert.equal(vereistAlle(paren, 'twee instances', {}), '[infra:pg] twee instances');
  assert.throws(() => vereistAlle(paren, 'twee instances', { RTG_EIS_INFRA: 'redis' }), /\[infra:redis\]/);
  assert.equal(vereistAlle([['pg', true], ['redis', true]], 'x', { RTG_EIS_INFRA: 'alles' }), false);
});

test('5. het oordeel van de draaier: alleen een infra-skip van een geeiste soort laat de ronde zakken', () => {
  const tap = [
    { test: 'a', reden: '[infra:pg] geen DATABASE_URL' },
    { test: 'b', reden: '[infra:browser] geen chromium' },
    { test: 'c', reden: 'een gelijktijdige afbouw staat in de weg' },
    { test: 'd', reden: null }
  ];
  const lokaal = infraOordeel(tap, {});
  assert.deepEqual(lokaal.infra.map(o => o.soort), ['pg', 'browser'], 'beide infra-skips worden genoemd');
  assert.equal(lokaal.zakt, false, 'lokaal is een skip een skip');
  const ci = infraOordeel(tap, { RTG_EIS_INFRA: 'pg' });
  assert.equal(ci.zakt, true);
  assert.deepEqual(ci.geweigerd.map(o => o.test), ['a']);
});

/* ---------------- een echt toetsbestand in een echt node --test-proces ------ */

const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-infra-'));
test.after(() => fs.rmSync(MAP, { recursive: true, force: true }));
const BESTAND = path.join(MAP, 'proef.test.js');
fs.writeFileSync(BESTAND, "const test = require('node:test');\n" +
  "const { vereist } = require(" + JSON.stringify(path.join(__dirname, 'infra')) + ");\n" +
  "test('heeft redis nodig', { skip: vereist('redis-server', false, 'redis-server is niet geinstalleerd') }, () => {});\n");
/* Zonder NODE_TEST_CONTEXT: binnen node --test zet Node die voor elk kind, en
   dan praat een genest node --test een intern protocol in plaats van TAP. */
const schoon = () => { const e = Object.assign({}, process.env); delete e.NODE_TEST_CONTEXT; return e; };
const draai = (env) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', BESTAND],
  { encoding: 'utf8', env: Object.assign(schoon(), { RTG_EIS_INFRA: '' }, env) });

test('6. zonder schakelaar slaat het bestand over, met het etiket in de TAP-regel', () => {
  const r = draai({});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /# SKIP \[infra:redis-server\] redis-server is niet geinstalleerd/);
  assert.match(r.stdout, /# skipped 1/);
});

test('7. met RTG_EIS_INFRA zakt hetzelfde bestand, met de reden', () => {
  const r = draai({ RTG_EIS_INFRA: 'redis-server' });
  assert.notEqual(r.status, 0, 'een geeiste maar ontbrekende redis-server mag niet groen zijn');
  assert.match(r.stdout + r.stderr, /deze omgeving eist het programma redis-server/);
  assert.doesNotMatch(r.stdout, /# skipped 1/);
});

test('8. de browserzoektocht van test/helper.js gaat langs dezelfde poort', () => {
  const code = "const h = require(" + JSON.stringify(path.join(__dirname, 'helper')) + ");" +
    "try { console.log(JSON.stringify({ reden: h.geenBrowser(null) })); } catch (e) { console.log(JSON.stringify({ fout: e.message })); }";
  const los = JSON.parse(spawnSync(process.execPath, ['-e', code], { encoding: 'utf8',
    env: Object.assign({}, process.env, { RTG_EIS_INFRA: '' }) }).stdout.trim().split('\n').pop());
  assert.match(los.reden, /^\[infra:browser\] playwright niet beschikbaar/);
  const streng = JSON.parse(spawnSync(process.execPath, ['-e', code], { encoding: 'utf8',
    env: Object.assign({}, process.env, { RTG_EIS_INFRA: 'browser' }) }).stdout.trim().split('\n').pop());
  assert.match(streng.fout || '', /deze omgeving eist Playwright met een startbare Chromium/);
});
