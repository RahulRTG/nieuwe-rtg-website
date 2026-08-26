/* DE SUITE IN DELEN, EN DE VLOER DAAROVERHEEN.

   Sinds de CI de unit-suite en de schermtoetsen over vier runners verdeelt,
   hangen er twee nieuwe manieren aan waarop deze keten stil minder kan gaan
   toetsen dan hij belooft:

   1. EEN BESTAND DAT IN GEEN ENKEL DEEL VALT. Vier groene delen, en niemand die
      merkt dat toets 700 nergens meer draait. Daarom: de delen samen zijn de
      hele lijst, en ze overlappen nergens.
   2. EEN VLOER DIE PER DEEL REKENT. --test-coverage-lines rekent per proces; met
      vier delen haalt geen enkel deel de vloer, en wie hem dan verlaagt tot een
      kwart hem haalt, heeft een vloer die niets meer bewaakt.
      scripts/dekkingsvloer.js telt de delen eerst op. Hier staat dat hij dat
      echt doet -- en dat hij weigert te oordelen als er niets te tellen valt.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - `i % totaal === nr - 1` veranderd in `i % totaal === nr`
     -> "de delen samen zijn de hele lijst" ZAKT (RAAK)
   - in voegSamen() de DA-teller laten overschrijven in plaats van optellen
     -> "een regel die in het ene deel geraakt is, telt" ZAKT (RAAK)
   - de lege-invoer-controle uit dekkingsvloer.js gehaald
     -> "geen lcov is geen honderd procent" ZAKT (RAAK)

   Los: node --test test/delen.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ontleedDeel, verdeel } = require('../scripts/lib/delen');
const vloer = require('../scripts/dekkingsvloer');

test('--deel neemt alleen N/M met 1 <= N <= M', () => {
  assert.deepEqual(ontleedDeel('2/4'), { nr: 2, totaal: 4 });
  assert.equal(ontleedDeel('0/4'), null);
  assert.equal(ontleedDeel('5/4'), null);
  assert.equal(ontleedDeel('2'), null);
  assert.equal(ontleedDeel(''), null);
  assert.equal(ontleedDeel('2/4 '), null);
});

test('de delen samen zijn de hele lijst, en ze overlappen nergens', () => {
  for (const totaal of [2, 3, 4, 7]) {
    for (const lengte of [0, 1, 5, 139, 973]) {
      const lijst = Array.from({ length: lengte }, (_, i) => 'toets-' + i + '.test.js');
      const delen = [];
      for (let nr = 1; nr <= totaal; nr++) delen.push(verdeel(lijst, { nr, totaal }));
      const samen = delen.flat();
      assert.equal(samen.length, lengte, `${lengte} bestanden over ${totaal} delen: er raakt er een kwijt`);
      assert.equal(new Set(samen).size, lengte, 'geen enkel bestand hoort in twee delen');
      assert.deepEqual([...samen].sort(), [...lijst].sort());
      /* En evenwichtig: het grootste en het kleinste deel schelen hoogstens een. */
      const maten = delen.map(d => d.length);
      assert.ok(Math.max(...maten) - Math.min(...maten) <= 1, 'de delen lopen te ver uiteen: ' + maten.join('/'));
    }
  }
});

test('zonder --deel draait alles, en de lijst blijft ongemoeid', () => {
  const lijst = ['a', 'b', 'c'];
  assert.deepEqual(verdeel(lijst, null), lijst);
  assert.notEqual(verdeel(lijst, null), lijst, 'een kopie, zodat de aanroeper niet per ongeluk de bron sorteert');
});

/* Twee kleine lcov-bestanden die dezelfde bron uit twee delen beschrijven: in
   deel 1 is regel 10 geraakt en regel 11 niet, in deel 2 andersom. Samen is dat
   twee van de twee, en dat is precies wat er vroeger in een proces gebeurde. */
const DEEL_EEN = ['TN:', 'SF:server/proef.js', 'FN:10,alfa', 'FN:20,beta',
  'FNDA:3,alfa', 'FNDA:0,beta', 'DA:10,3', 'DA:11,0',
  'BRDA:10,0,0,1', 'BRDA:10,0,1,-', 'end_of_record'].join('\n');
const DEEL_TWEE = ['TN:', 'SF:server/proef.js', 'FN:10,alfa', 'FN:20,beta',
  'FNDA:0,alfa', 'FNDA:5,beta', 'DA:10,0', 'DA:11,7',
  'BRDA:10,0,0,-', 'BRDA:10,0,1,2', 'end_of_record'].join('\n');

test('een regel die in het ene deel geraakt is, telt ook als het andere deel hem miste', () => {
  const kaart = vloer.voegSamen(new Map(), DEEL_EEN);
  vloer.voegSamen(kaart, DEEL_TWEE);
  const uit = vloer.tel(kaart);
  assert.equal(uit.bestanden, 1, 'hetzelfde bronbestand uit twee delen is een bestand');
  assert.deepEqual(uit.ruw.regels, [2, 2], 'beide regels geraakt, elk in een ander deel');
  assert.deepEqual(uit.ruw.functies, [2, 2], 'beide functies aangeroepen, elk in een ander deel');
  assert.deepEqual(uit.ruw.takken, [2, 2], 'beide takken genomen, elk in een ander deel');
  assert.equal(uit.regels, 100);
});

test('een deel alleen haalt de honderd niet -- dat is het hele punt', () => {
  const alleen = vloer.tel(vloer.voegSamen(new Map(), DEEL_EEN));
  assert.equal(alleen.regels, 50);
  assert.equal(alleen.functies, 50);
});

test('geen lcov is geen honderd procent maar een fout', () => {
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'vloer-leeg-'));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'dekkingsvloer.js'), leeg],
      { encoding: 'utf8' });
    assert.equal(r.status, 1, 'een lege map hoort te zakken, niet te slagen');
    assert.match(r.stderr, /Geen lcov-gegevens/);
  } finally {
    fs.rmSync(leeg, { recursive: true, force: true });
  }
});

test('de vloeren staan waar de meting ze zette', () => {
  assert.deepEqual(vloer.VLOER, { regels: 78, takken: 78, functies: 65 });
});
