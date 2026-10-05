/* ============================================================================
   DE STOPSPOELING -- regressie voor RTG-V1-RELEASE D1.

   DE FOUT: twee afsluitwegen die uit elkaar groeiden. SIGTERM spoelde journaal,
   vertaalkast en write-behind; een crash (uncaughtException) deed alleen
   save(). Juist bij een crash -- waar incidentreconstructie op leunt -- gingen
   gebufferde auditregels en een write-behind-venster verloren.

   DE FIX: server/opzet/stopspoeling.js is de ene lijst, en BEIDE wegen roepen
   hem aan. Deze toets houdt twee dingen vast:
   - de lijst zelf: alle stappen draaien, ook als er een faalt, en de
     asynchrone helft verwerpt nooit;
   - de bedrading: de crashweg in server.js en de SIGTERM-weg in luister.js
     lopen er allebei langs (in CODE, niet in commentaar), en de crashweg
     eindigt nooit met exitcode 0.

   Draai los: node --test test/stopspoeling.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakStopspoeling } = require('../server/opzet/stopspoeling');
const journaal = require('../server/kern/journaalbestand');
const vertaalkast = require('../server/lib/vertaalkast');

function metSpionnen(fn) {
  const oud = { j: journaal.spoelAlle, v: vertaalkast.spoelAlle };
  const geroepen = [];
  journaal.spoelAlle = () => { geroepen.push('journaal'); return 0; };
  vertaalkast.spoelAlle = () => { geroepen.push('vertaalkast'); return 0; };
  return Promise.resolve(fn(geroepen)).finally(() => {
    journaal.spoelAlle = oud.j; vertaalkast.spoelAlle = oud.v;
  });
}

test('1. de synchrone helft: save, journaal en vertaalkast', () => metSpionnen((geroepen) => {
  const s = maakStopspoeling({ save: () => geroepen.push('save') });
  s.spoelSynchroon();
  assert.deepEqual(geroepen, ['save', 'journaal', 'vertaalkast']);
}));

test('2. een falende save houdt de rest van de spoeling niet tegen', () => metSpionnen((geroepen) => {
  const s = maakStopspoeling({ save: () => { throw new Error('schijf vol'); } });
  s.spoelSynchroon();
  assert.deepEqual(geroepen, ['journaal', 'vertaalkast'], 'journaal en vertaalkast horen alsnog te spoelen');
}));

test('3. de asynchrone helft spoelt beide write-behinds en verwerpt nooit', async () => {
  const geroepen = [];
  const s = maakStopspoeling({ save: () => {},
    flushBijAfsluiten: () => { geroepen.push('db'); return Promise.reject(new Error('pg weg')); },
    accounts: { flushBijAfsluiten: () => { geroepen.push('accounts'); throw new Error('sync fout'); } } });
  const uit = await s.spoelAsynchroon();
  assert.deepEqual(geroepen.sort(), ['accounts', 'db']);
  assert.equal(uit.length, 2);
  assert.ok(uit.every(r => r.status === 'rejected'), 'fouten worden gemeld in de uitslag, niet gegooid');
});

/* Commentaar eruit, zodat een belofte in een kop de toets niet kan halen
   (BEWIJSMACHINE.md par. 6a). */
const code = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function handlerVan(bron, kop) {
  const i = bron.indexOf(kop);
  assert.ok(i >= 0, 'handler niet gevonden: ' + kop);
  let diepte = 0, start = bron.indexOf('{', i);
  for (let j = start; j < bron.length; j++) {
    if (bron[j] === '{') diepte++;
    else if (bron[j] === '}' && --diepte === 0) return bron.slice(start, j + 1);
  }
  throw new Error('handler niet gesloten: ' + kop);
}

test('4. de crashweg in server.js geeft de crash door aan bijCrash (in code, niet in commentaar)', () => {
  const h = handlerVan(code('server/server.js'), "process.on('uncaughtException'");
  assert.match(h, /\.bijCrash\(/, 'de crashweg hoort de gedeelde stopspoeling te gebruiken');
  assert.match(h, /bijCrash\(\{[^}]*\binBundel\b/, 'de crashweg hoort te weten of er een bundel open staat (toets 4g)');
  assert.doesNotMatch(h, /process\.exit\(\s*0\s*\)/, 'een crash mag nooit als nette afsluiting eindigen');
});

test('4b. bijCrash spoelt alles en stopt met exitcode 1', async () => {
  const { bijCrash } = require('../server/opzet/stopspoeling');
  await metSpionnen(async (geroepen) => {
    const begin = Date.now();
    const code = await new Promise((klaar) => bijCrash({
      save: () => geroepen.push('save'),
      flushBijAfsluiten: async () => { geroepen.push('db'); },
      accounts: { flushBijAfsluiten: async () => { geroepen.push('accounts'); } },
      exit: klaar, graceMs: 2000 }));
    assert.equal(code, 1, 'een crash eindigt met exitcode 1');
    assert.deepEqual(geroepen.sort(), ['accounts', 'db', 'journaal', 'save', 'vertaalkast']);
    assert.ok(Date.now() - begin >= 190, 'minstens 200 ms, zodat het log nog wegkomt');
  });
});

test('4c. een write-behind die blijft hangen houdt de crash niet tegen', { timeout: 5000 }, async () => {
  const { bijCrash } = require('../server/opzet/stopspoeling');
  const begin = Date.now();
  const code = await new Promise((klaar) => bijCrash({ save: () => {},
    flushBijAfsluiten: () => new Promise(() => {}), exit: klaar, graceMs: 300 }));
  assert.equal(code, 1);
  assert.ok(Date.now() - begin < 2000, 'de genadetermijn begrenst het wachten');
});

test('4d. bijCrash eindigt nooit met 0 en zet zijn timers niet op unref', () => {
  const s = code('server/opzet/stopspoeling.js');
  assert.doesNotMatch(s, /exit\(\s*0\s*\)|stopMet\(\s*0\s*\)/);
  assert.doesNotMatch(s, /\.unref\(\)/, 'een unref\'d timer houdt het proces niet wakker');
});

test('4e. een crash MIDDEN IN een bundel flusht de opslag niet (anders ligt er een halve mutatie op schijf)', async () => {
  const { bijCrash } = require('../server/opzet/stopspoeling');
  for (const [naam, inBundel, verwachtFlush] of [
    ['buiten een bundel', () => false, true],
    ['binnen een bundel', () => true, false],
    ['bundelvraag gooit', () => { throw new Error('kapot'); }, false]]) {
    const geroepen = [];
    const code = await new Promise((klaar) => bijCrash({ save: () => geroepen.push('save'),
      flushBijAfsluiten: async () => { geroepen.push('db'); },
      accounts: { flushBijAfsluiten: async () => { geroepen.push('accounts'); } },
      inBundel, exit: klaar, graceMs: 2000 }));
    assert.equal(code, 1, naam + ': altijd exitcode 1');
    assert.ok(geroepen.includes('save'), naam + ': save() loopt altijd (binnen een bundel zet die alleen een vlag)');
    assert.equal(geroepen.includes('db'), verwachtFlush, naam + ': write-behind ' + (verwachtFlush ? 'wel' : 'NIET') + ' flushen');
    assert.equal(geroepen.includes('accounts'), verwachtFlush, naam + ': accounts ' + (verwachtFlush ? 'wel' : 'NIET') + ' flushen');
  }
});

test('4f. de genadetermijn is begrensd en valt bij onzin terug op 5 s', () => {
  const { genadeVan } = require('../server/opzet/stopspoeling');
  assert.equal(genadeVan(1000), 1000);
  assert.equal(genadeVan(50), 200, 'minstens 200 ms voor het log');
  assert.equal(genadeVan(10 ** 12), 60000, 'een getal boven 2^31 zou de timer laten overlopen naar ~1 ms');
  assert.equal(genadeVan('abc'), 5000, 'NaN zou beide timers meteen laten afgaan');
  assert.equal(genadeVan(-5), 5000);
});

test('4g. ECHTE opslag: een crash midden in een geldbundel laat de bundel atomair', { timeout: 30000 }, () => {
  const { spawnSync } = require('child_process');
  const os = require('os');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-crashbundel-'));
  const env = { ...process.env, RTG_STORE: 'sqlite', RTG_DATA_DIR: map, NODE_ENV: 'test' };
  delete env.DATABASE_URL; delete env.REDIS_URL;
  const fixture = path.join(__dirname, 'fixtures', 'crashbundel.js');
  const draai = (modus) => spawnSync(process.execPath, [fixture, modus], { env, encoding: 'utf8', timeout: 20000 });
  try {
    assert.equal(draai('zaai').status, 0, 'zaaien lukt');
    const crash = draai('crash-in-bundel');
    assert.equal(crash.status, 1, 'de crash eindigt met exitcode 1: ' + crash.stderr.slice(-300));
    const lees = draai('lees');
    assert.deepEqual(JSON.parse(lees.stdout), { X: 100, Y: 0 },
      'op schijf hoort de bundel heel of helemaal niet te staan; {X:50,Y:0} is 50 die nergens aankomt');
  } finally { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }
});

test('5. de SIGTERM-weg gebruikt dezelfde spoeling', () => {
  const l = code('server/opzet/luister.js');
  assert.match(l, /maakStopspoeling\(/);
  assert.match(l, /\.spoelSynchroon\(\)/);
  assert.match(l, /\.spoelAsynchroon\(\)/);
});
