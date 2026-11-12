/* De lokale paid/punten-commit wordt nooit door later nevenwerk gered.
   Echte autolaad/Pay/Trust/SQLite, SIGKILL op de savegrens, nieuw proces en
   herhaalde betaling plus tweemaal dezelfde provider-webhook. Dit bewijst
   behoud van geld en lokale toestand, niet herstel van factuur/keuken/seinen:
   die liggen na deze killgrens en zijn hier bewust nog niet uitgevoerd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const soort of ['order', 'rit']) for (const tegoed of [0, 500]) {
  test(soort + ': kill direct na lokale betaalcommit, met ' + tegoed + ' cent oud tegoed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidbetaling-crash-'));
    try {
      const env = { ...process.env, RTG_STORE: 'sqlite', RTG_DATA_DIR: dir,
        NODE_ENV: 'test', NODE_NO_WARNINGS: '1' };
      delete env.RTG_MOTOR_GELD; delete env.RTG_MOTOR_GELD_URL;
      const kind = path.join(__dirname, 'lib', 'lidbetaling-crashkind.js');
      const draai = fase => spawnSync(process.execPath, [kind, soort, fase, String(tegoed)],
        { env, encoding: 'utf8', timeout: 20000 });
      const lees = uit => JSON.parse(uit.stdout.trim().split('\n').pop());
      const heen = draai('heen');
      assert.equal(heen.signal, 'SIGKILL', heen.stdout + heen.stderr);
      const crash = lees(heen);
      assert.equal(crash.grens, 'direct-na-lid-save');
      assert.equal(crash.providerAanroepen, 1);
      assert.equal(crash.nevenwerk, 0);
      assert.ok(crash.commits.length > 0, 'echte duurzame betaalcommit waargenomen');
      for (const commit of crash.commits) {
        assert.ok(commit.fullCommits > 0, 'PRAGMA synchronous=FULL bij de COMMIT');
        assert.equal(commit.duurzaam, true);
      }
      const terug = draai('terug');
      assert.equal(terug.status, 0, terug.stdout + terug.stderr);
      const herstart = lees(terug);
      assert.deepEqual(herstart.voor, crash.vast, 'de exacte toestand overleeft kill -9');
      assert.equal(herstart.providerAanroepen, 0);
      assert.equal(herstart.nevenwerk, 0);
      assert.equal(herstart.lidStatus, 409);
      assert.equal(herstart.payHerhaald, true);
      assert.deepEqual(herstart.naHerhaling, herstart.voor,
        'ook herhalen van de interne financiële opdracht boekt niets opnieuw');
      assert.equal(Object.keys(herstart.inboxVoor).length, 0, 'geen webhook vóór de kill');
      assert.equal(Object.keys(herstart.inboxNa).length, 1, 'dubbele webhook levert één ontvangst');
      for (const key of ['saldi', 'boekingen', 'ontvangsten', 'afdrukken', 'economisch', 'onderwerp', 'puntenstand']) {
        assert.deepEqual(herstart.naWebhooks[key], herstart.voor[key], key + ' blijft na de webhooks intact');
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

