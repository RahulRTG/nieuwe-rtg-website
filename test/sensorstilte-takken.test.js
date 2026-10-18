/* DE STILLE SENSOR OP ZIJN RANDEN (kern/command/sensorstilte.js en
   sensorstilte-koppelingen.js), aanvulling op test/sensorstilte.test.js.

   De stille sensor is De Wacht over de wachters: hij ziet een tikker die
   ophoudt met rondes maken, een schild dat geen verkeer meer ziet en een
   noodrem die niet te lezen is. Op de randen beslist hij of iets "levend",
   "uit" of "stil" heet -- en een verkeerd "levend" is precies het gat waar een
   aanval doorheen loopt zonder dat iemand het merkt.

   Wat hier niet mag sneuvelen:
   1. een tikker die zich aanmeldt maar nooit een starttijd of ronde kreeg is
      STIL, niet levend;
   2. een tikker die bewust uit staat is "uit" en staat als zodanig in de
      stand -- niet stil (geen valse alarmen) en niet levend;
   3. een fout zonder message (een gegooide string, of niets) wordt toch
      geteld en draagt een leesbare reden;
   4. tellers van schild of meting die niet te lezen zijn, maken het schild
      STIL, met de reden erbij.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in oordeel() `sinds !== null && sinds < venster` vervangen door
     `sinds === null || sinds < venster` -> "1. nooit gestart" ZAKT (RAAK)
   - in schildOordeel() de catch-tak `stil: true` vervangen door `stil: false`
     -> "4. onleesbare tellers" ZAKT (RAAK)

   Draai: node --test test/sensorstilte-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const stilte = require('../server/kern/command/sensorstilte');

test.beforeEach(() => stilte._wis());
test.after(() => stilte._wis());
const rij = (naam, schuif) => stilte.oordeel({ schuif }).find(r => r.naam === naam);

test('1. aangemeld maar nooit gestart en nooit een ronde: stil', () => {
  stilte.aangemeld('alarm');
  const r = rij('alarm');
  assert.equal(r.stand, 'stil');
  assert.equal(r.reden, 'gestart, nog geen ronde');
  assert.match(stilte.bevinding(), /alarm: gestart, nog geen ronde/);
  stilte.gestart('canary');
  assert.equal(rij('canary').stand, 'levend', 'met een starttijd binnen het venster wel levend');
});

test('2. bewust uit staat als uit in de stand, niet als stil', () => {
  stilte.aangemeld('auditwacht', { uit: true });
  const s = stilte.stand();
  assert.deepEqual(s.uit, ['auditwacht']);
  assert.ok(!s.stil.includes('auditwacht'));
  assert.equal(s.sensoren.find(r => r.naam === 'auditwacht').reden, 'bewust niet gestart (meetserver of toets)');
});

test('3. een fout zonder message wordt geteld met een leesbare reden', () => {
  stilte.gestart('wacht');
  stilte.fout('wacht', 'socket dicht');
  stilte.fout('wacht');
  const r = rij('wacht');
  assert.equal(r.fouten, 2);
  assert.equal(r.laatsteFout.reden, 'onbekend');
  assert.match(r.reden, /2 mislukte rondes en nog geen geslaagde/);
  stilte.fout('wacht', { message: 'x'.repeat(500) });
  assert.equal(rij('wacht').laatsteFout.reden.length, 160, 'begrensd');
  stilte.fout('wacht', 'een tekst');
  assert.equal(rij('wacht').laatsteFout.reden, 'een tekst');
});

test('4. onleesbare tellers maken het schild stil, met reden', () => {
  stilte.koppelSchild({ schildVerzoeken: () => { throw new Error('teller weg'); }, metingVerzoeken: () => 5 });
  assert.equal(rij('schild').stand, 'levend', 'een lezing zonder weging geeft het laatste oordeel: nog niet gewogen');
  const r = rij('schild', true);
  assert.equal(r.stand, 'stil');
  assert.equal(r.reden, 'de tellers van schild of meting konden niet worden gelezen: teller weg');
  assert.equal(rij('schild').stand, 'stil', 'en een gewone lezing ziet dat oordeel daarna ook');
});
