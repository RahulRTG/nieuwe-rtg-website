/* HET SCHEMA VAN store.db ONDER GELIJKTIJDIGE OPSTART.

   sqliteInit() keek met PRAGMA table_info of kv de kolom `deleted` al had, en
   voegde hem anders toe. Dat is kijken-en-dan-doen over processen heen: twee
   servers die tegelijk opkomen op een gedeelde database zien allebei "nog
   niet", en de tweede ALTER TABLE valt om met "duplicate column name: deleted".
   Zo zakte test/eigenaar-wedloop.test.js in CI (#631, run 38400432054), op een
   regel die niets met het eigenaarsaccount te maken had.

   Hier twaalf processen die op precies dezelfde milliseconde (een gedeelde
   starttijd, bezig-wachten tot dan) het schema op een verse database zetten,
   tien keer. Op de oude vorm viel lokaal in 2 van de 10 rondes een proces om
   met precies die melding; de schemastap hoort in een schrijftransactie
   (BEGIN IMMEDIATE), zoals server/migraties/index.js het al doet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');

const MODULE = path.join(__dirname, '..', 'server', 'db', 'sqlite.js');
/* Het kindproces krijgt de module als argument: dezelfde server/db/sqlite.js,
   zonder dat het pad in de broncode als losse modulenaam staat. */
const KIND = 'const t = Number(process.env.RTG_TOETS_START); while (Date.now() < t) {}\n' +
  'try { require(process.argv[1]).loadSqlite(); process.exit(0); }\n' +
  'catch (e) { process.stderr.write(String(e && e.message)); process.exit(3); }';

function ronde(aantal) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-storeschema-'));
  const start = Date.now() + 1500;
  return Promise.all(Array.from({ length: aantal }, () => new Promise((klaar) => {
    const p = spawn(process.execPath, ['-e', KIND, MODULE], {
      env: { ...process.env, NODE_ENV: 'test', RTG_DATA_DIR: map, RTG_TOETS_START: String(start) },
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let fout = '';
    p.stderr.on('data', (d) => { fout += d; });
    p.on('exit', (code) => klaar({ code, fout: fout.trim().slice(0, 160) }));
  }))).finally(() => { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} });
}

test('twaalf processen die tegelijk het schema van store.db zetten, vallen geen van alle om', { timeout: 120000 }, async () => {
  const omgevallen = [];
  for (let r = 1; r <= 10; r++) {
    for (const u of await ronde(12)) if (u.code !== 0) omgevallen.push('ronde ' + r + ': ' + u.fout);
  }
  assert.deepEqual(omgevallen, [], 'een gelijktijdige opstart hoort het schema niet te laten botsen:\n  ' + omgevallen.join('\n  '));
});
