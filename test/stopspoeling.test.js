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

test('4. de crashweg loopt langs dezelfde spoeling en eindigt nooit met exitcode 0', () => {
  const h = handlerVan(code('server/server.js'), "process.on('uncaughtException'");
  assert.match(h, /maakStopspoeling\(/, 'de crashweg hoort de gedeelde stopspoeling te gebruiken');
  assert.match(h, /\.spoelSynchroon\(\)/);
  assert.match(h, /\.spoelAsynchroon\(\)/, 'ook de write-behind hoort bij een crash geprobeerd te worden');
  assert.doesNotMatch(h, /process\.exit\(\s*0\s*\)/, 'een crash mag nooit als nette afsluiting eindigen');
  assert.doesNotMatch(h, /\.unref\(\)/, 'een unref\'d timer houdt het proces niet wakker');
});

test('5. de SIGTERM-weg gebruikt dezelfde spoeling', () => {
  const l = code('server/opzet/luister.js');
  assert.match(l, /maakStopspoeling\(/);
  assert.match(l, /\.spoelSynchroon\(\)/);
  assert.match(l, /\.spoelAsynchroon\(\)/);
});
