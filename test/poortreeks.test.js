/* DE POORTREEKS -- de kiezer onder trio-wees, tls-boot, chaos, spreidingsproef
   en de stagingrepetitie, beproefd op wat de machine van CI NIET heeft.

   test/trio-wees.test.js toets 0 meet de kiezer tegen de ECHTE kernellezing, en
   dat is precies zijn blinde vlek: geeft efemeerBereik() bij een geldige lezing
   stil de standaard terug, dan liggen reeks en bereik nog steeds netjes uit
   elkaar -- in de meting, niet op de machine. De reviewronde van 24 september
   2026 vond dat de grens `lo > 1024` de gangbare tuning "1024 65535" (1024 is
   het laagste dat de kernel toestaat) als leesfout behandelde. Daarom hier een
   voorgelegde lezing in plaats van de eigen /proc.

   MUTATIES (LAT.md regel 2), elk gezien zakken voor deze toets erin ging:
     - `lo >= 1` terug naar `lo > 1024`             -> toets 1 zakt op "1024 65535"
     - `lo >= 1` naar `lo >= 1024`                   -> toets 1 zakt op "1 65535"
     - het venster boven het bereik weghalen        -> toets 3 zakt: reeks komt niet
     - de weigering zonder venster weghalen         -> toets 3 zakt op rejects */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { efemeerBereik, vrijePoortReeks } = require('./helper');

const STANDAARD = [32768, 60999];

test('1. een geldige lezing wordt overgenomen, ook op de kernelgrens 1024', () => {
  assert.deepEqual(efemeerBereik(() => '1024\t65535\n'), [1024, 65535]);
  assert.deepEqual(efemeerBereik(() => '1024 61000'), [1024, 61000]);
  assert.deepEqual(efemeerBereik(() => '32768\t60999\n'), STANDAARD);
  assert.deepEqual(efemeerBereik(() => '49152 65535'), [49152, 65535]);
  // wat de kernel aanneemt is echt: met ip_unprivileged_port_start op 0 mag lo tot 1
  assert.deepEqual(efemeerBereik(() => '1 65535'), [1, 65535]);
});

test('2. onzin, een omgekeerd bereik, nul, een breuk en geen /proc geven de Linux-standaard', () => {
  assert.deepEqual(efemeerBereik(() => 'onzin'), STANDAARD);
  assert.deepEqual(efemeerBereik(() => ''), STANDAARD);
  assert.deepEqual(efemeerBereik(() => '60999 32768'), STANDAARD);
  assert.deepEqual(efemeerBereik(() => '0 65535'), STANDAARD);
  assert.deepEqual(efemeerBereik(() => '1.5 65535'), STANDAARD);
  assert.deepEqual(efemeerBereik(() => '1024 70000'), STANDAARD);
  assert.deepEqual(efemeerBereik(() => { throw new Error('ENOENT'); }), STANDAARD);
});

test('3. zonder ruimte onder het bereik gaat de reeks erboven; zonder ruimte aan beide kanten weigert hij met de reden', async () => {
  const boven = await vrijePoortReeks(4, { bereik: [1024, 61000] });
  assert.equal(boven.length, 4);
  for (let i = 1; i < 4; i++) assert.equal(boven[i], boven[0] + i, 'aaneengesloten: ' + boven.join(','));
  for (const p of boven) assert.ok(p > 61000 && p <= 65535, 'poort ' + p + ' ligt niet boven 61000');

  await assert.rejects(vrijePoortReeks(4, { bereik: [1024, 65535] }),
    /1024-65535 laat geen 4 poorten buiten het efemere bereik over/);
});

test('4. met de Linux-standaard ligt de reeks buiten 32768-60999 en is elke poort bindbaar op beide hosts', async () => {
  const reeks = await vrijePoortReeks(3, { bereik: STANDAARD });
  for (const p of reeks) {
    assert.ok(p < STANDAARD[0] || p > STANDAARD[1], 'poort ' + p + ' ligt in ' + STANDAARD.join('-'));
    assert.ok(p >= 20000, 'poort ' + p + ' ligt onder de vaste diensten');
    for (const host of ['127.0.0.1', '0.0.0.0']) {
      const s = net.createServer();
      await new Promise((r, x) => { s.on('error', x); s.listen(p, host, r); });
      await new Promise(r => s.close(r));
    }
  }
});
