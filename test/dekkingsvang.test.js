/* DE DEKKINGSVANG (test/lib/dekkingsvang.js, test/lib/dekkingsvang-kind.js).

   stop() doodt een toetsserver met SIGKILL, en zo'n proces schrijft zijn
   V8-dekking nooit weg. In dekkingsmodus (NODE_V8_COVERAGE gezet) laat stop()
   de server daarom eerst op SIGUSR2 zijn dekking wegschrijven, wacht begrensd
   op de bevestiging, en doodt hem daarna gewoon met SIGKILL.

   Wat hier niet mag sneuvelen:
   1. in dekkingsmodus ligt er na stop() een dekkingsbestand van de server, met
      server/server.js erin -- en de server stierf nog steeds aan SIGKILL;
   2. zonder dekkingsmodus krijgt de server geen --require en geen luisteraar
      (SIGUSR2 doodt hem, zoals bij elk proces zonder handler), en stop() is
      gewoon SIGKILL;
   3. een server die niet bevestigt houdt stop() niet langer op dan de grens,
      en wordt daarna alsnog met SIGKILL gestopt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in stop() de regel `dekkingsvang.vang(kind);` weggehaald
     -> 1 ZAKT (RAAK): er lag geen enkel dekkingsbestand; en 3 ZAKT: stop()
     wachtte niet meer op de grens.
   - in dekkingsvang-kind.js `require('node:v8').takeCoverage()` weggehaald
     -> 1 ZAKT (RAAK): de bevestiging kwam wel, de dekking niet.
   - in plan() `if (!actief(env)) return null;` vervangen door `if (false) ...`
     -> 2 ZAKT (RAAK): plan() gaf ook zonder dekkingsmodus een vang mee.

   Draai: node --test test/dekkingsvang.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { startServer, stop } = require('./helper');
const vang = require('./lib/dekkingsvang');

const weg = (kind) => kind.exitCode != null || kind.signalCode != null
  ? Promise.resolve() : once(kind, 'exit');

test('1. in dekkingsmodus schrijft een met stop() gestopte server zijn dekking weg', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vangtoets-'));
  try {
    const srv = await startServer({ env: { NODE_V8_COVERAGE: map } });
    assert.ok(srv.child.spawnargs.includes(vang.KIND), 'de server kreeg de vang mee');
    const t = Date.now();
    stop(srv);
    const duur = Date.now() - t;
    await weg(srv.child);
    assert.equal(srv.child.signalCode, 'SIGKILL', 'stop() blijft een harde stop');
    assert.ok(duur < vang.GRENS_MS, 'een bevestigende server wacht niet de hele grens uit (' + duur + ' ms)');
    const eigen = fs.readdirSync(map).filter((n) => n.startsWith('coverage-' + srv.child.pid + '-'));
    assert.ok(eigen.length >= 1, 'er ligt een dekkingsbestand van de server');
    const urls = JSON.parse(fs.readFileSync(path.join(map, eigen[0]), 'utf8')).result.map((r) => r.url);
    assert.ok(urls.some((u) => u.endsWith('/server/server.js')), 'server/server.js staat in de dekking');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('2. zonder dekkingsmodus: geen handler, en stop() is gewoon SIGKILL', async () => {
  assert.equal(vang.plan({}), null);
  assert.equal(vang.plan({ NODE_V8_COVERAGE: '' }), null);
  const [a, b] = await Promise.all([
    startServer({ env: { NODE_V8_COVERAGE: '' } }),
    startServer({ env: { NODE_V8_COVERAGE: '' } })]);
  try {
    for (const s of [a, b]) {
      assert.ok(!s.child.spawnargs.includes('--require'), 'geen --require zonder dekkingsmodus');
    }
    // geen luisteraar: SIGUSR2 doet wat het bij elk proces zonder handler doet
    a.child.kill('SIGUSR2');
    await weg(a.child);
    assert.equal(a.child.signalCode, 'SIGUSR2', 'de server had een SIGUSR2-luisteraar');
    assert.equal(vang.vang(b.child), null, 'er valt zonder dekkingsmodus niets te vangen');
    stop(b);
    await weg(b.child);
    assert.equal(b.child.signalCode, 'SIGKILL');
  } finally { stop(a); stop(b); }
});

test('3. een server die niet bevestigt houdt stop() niet langer op dan de grens', async () => {
  const kind = spawn(process.execPath, ['-e',
    "process.on('SIGUSR2', () => {}); setInterval(() => {}, 1e6); process.stdout.write('klaar\\n')"],
  { stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await once(kind.stdout, 'data');
    const p = vang.plan({ NODE_V8_COVERAGE: os.tmpdir() });
    vang.onthoud(kind, p);
    const t = Date.now();
    stop(kind);
    const duur = Date.now() - t;
    await weg(kind);
    assert.equal(kind.signalCode, 'SIGKILL', 'na de grens volgt alsnog de SIGKILL');
    assert.ok(duur >= vang.GRENS_MS - 20, 'stop() wachtte wel op de bevestiging (' + duur + ' ms)');
    assert.ok(duur < vang.GRENS_MS + 1500, 'stop() bleef niet hangen (' + duur + ' ms)');
    assert.ok(!fs.existsSync(p.bevestig), 'geen bevestigingsbestand achtergelaten');
  } finally { try { kind.kill('SIGKILL'); } catch (e) { /* al weg */ } }
});
