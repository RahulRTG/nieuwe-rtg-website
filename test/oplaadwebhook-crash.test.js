/* G3: EEN CRASH MIDDEN IN DE WEBHOOK SCHRIJFT EEN OPLADING GEEN TWEE KEER BIJ.

   Het JS-grootboek (geen motor), SQLite. De betaalwaarheid zegt in zijn kop dat
   het bewijs `w.geboekt` met dezelfde save meegaat als de boeking -- maar
   kern/pay/opslag.js schrijft alleen de pay-collecties, dus de bijschrijving
   en de afhandeling committen apart. Een `kill -9` tussen die twee, en de
   aanbieder levert de webhook opnieuw: de bijschrijving liep nog een keer,
   want boek() gooide de economische sleutel weg die oplaadwaarheid meegaf.
   Het lid kreeg 50 euro voor een betaling van 25.

   De reparatie zit niet in de betaalwaarheid maar in het grootboek: een boeking
   MET sleutel commit die sleutel in dezelfde SQLite-transactie als de saldi
   (db/economische-boeking-sqlite.js), dus na een herstart is er beide of geen
   van beide, en een herhaling krijgt het eerste antwoord terug. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

test('kill -9 na de bijschrijving en voor de afhandeling, dan de webhook opnieuw: een keer 25 euro', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-g3-'));
  try {
    const env = Object.assign({}, process.env, { RTG_STORE: 'sqlite', RTG_DATA_DIR: dir, NODE_ENV: 'test',
      NODE_NO_WARNINGS: '1' });
    delete env.RTG_MOTOR_GELD; delete env.RTG_MOTOR_GELD_URL;
    const kind = path.join(__dirname, 'lib', 'geld-crashkind.js');
    const heen = spawnSync(process.execPath, [kind, 'js-webhook', 'heen'], { env, encoding: 'utf8' });
    assert.equal(heen.signal, 'SIGKILL', 'de kill moet echt gevallen zijn: ' + heen.stdout + heen.stderr);
    const terug = spawnSync(process.execPath, [kind, 'js-webhook', 'terug'], { env, encoding: 'utf8' });
    assert.equal(terug.status, 0, terug.stdout + terug.stderr);
    const uit = JSON.parse(terug.stdout.trim().split('\n').pop());
    /* Eerst vaststellen dat de crash op de bedoelde naad viel: het geld stond
       er na de herstart al, de afhandeling niet. Anders meet deze toets niets. */
    assert.equal(uit.naHerstart, 2500, 'de bijschrijving was al duurzaam: ' + JSON.stringify(uit));
    assert.equal(uit.afgehandeldNaHerstart, false, 'de afhandeling was nog niet vastgelegd');
    assert.equal(uit.naHerhaling, 2500, 'de herhaalde webhook schrijft niets meer bij');
    assert.equal(uit.oplaadregels, 1);
    assert.equal(uit.afgehandeld, true, 'de herhaling sluit de betaling wel af');
    assert.equal(uit.sluit, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
