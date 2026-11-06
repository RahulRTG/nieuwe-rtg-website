/* DRIE EIGENAARSBOOTSTRAPS OP DEZELFDE ACCOUNTDATABASE.

   De vloot start meerdere processen op dezelfde database. Alle drie kunnen
   tegelijk zien dat het eigenaarsaccount ontbreekt en het proberen te maken.
   De bootstrap is idempotent bedoeld: exact één proces wint de INSERT; de
   andere processen herkennen uitsluitend die unieke-sleutelrace en lezen
   opnieuw.

   Deze proef start bewust NIET drie volledige RTG-platformen. Dat oude
   experiment vermengde de accountbewerking met honderden ongerelateerde
   opstartmodules en bleef onder V8-dekking soms vijf minuten op een derde
   server wachten. De volledige vlootstart heeft zijn eigen integratieproef in
   test/vloot.test.js. Hier draaien drie echte Node-processen tegen de echte
   accountslaag en de echte demo-eigenaarmodule, met een startbarriere zodat de
   race aantoonbaar wordt uitgelokt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const migraties = require('../server/migraties');

const WORTEL = path.join(__dirname, '..');
const HOEVEEL = 3;
const WACHT_MS = 30000;
const KIND = `
const path = require('node:path');
const wortel = process.env.RTG_TOETS_WORTEL;
const accounts = require(path.join(wortel, 'server/accounts'));
const eigenaar = require(path.join(wortel, 'server/eigenaar'));
accounts.init();
const rollen = {};
const zet = require(path.join(wortel, 'server/opzet/demo-eigenaar'))({
  accounts, eigenaar, save() {}, env: process.env,
  rollenVoor(id) {
    const sleutel = 'user-' + id;
    if (!Array.isArray(rollen[sleutel])) rollen[sleutel] = [];
    return rollen[sleutel];
  },
  zaakVoor() { return null; },
  demoLidInhoud: () => ({ invoices: [], trip: null, creatorCredit: 0, creatorLikes: 0 })
});
process.stdout.write('READY\\n');
process.stdin.resume();
process.stdin.once('data', () => {
  try {
    zet();
    const u = accounts.findByLogin(eigenaar.OWNER_EMAIL);
    if (!u) throw new Error('eigenaarsaccount ontbreekt na bootstrap');
    process.stdout.write('OK ' + u.id + '\\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e && e.stack || e));
    process.exit(3);
  }
});
`;

function begrensd(p, boodschap) {
  let wekker;
  const grens = new Promise((_, verwerp) => {
    wekker = setTimeout(() => verwerp(new Error(boodschap)), WACHT_MS);
  });
  return Promise.race([p, grens]).finally(() => clearTimeout(wekker));
}

function startKind(map) {
  const kind = spawn(process.execPath, ['--experimental-sqlite', '-e', KIND], {
    env: { ...process.env, NODE_ENV: 'test', RTG_DEMO: '1', RTG_DATA_DIR: map,
      RTG_OWNER_EMAIL: 'eigenaar-wedloop@rtg.test', DEMO_PASS: 'wedloop-wachtwoord',
      RTG_TOETS_WORTEL: WORTEL, SMTP_URL: '' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const staat = { kind, uit: '', fout: '', gereedGezien: false, id: null };
  let maakGereed, weigerGereed, maakKlaar;
  staat.gereed = new Promise((resolve, reject) => { maakGereed = resolve; weigerGereed = reject; });
  staat.klaar = new Promise((resolve) => { maakKlaar = resolve; });
  kind.stdout.on('data', bytes => {
    staat.uit = (staat.uit + bytes.toString()).slice(-2000);
    if (!staat.gereedGezien && /(^|\n)READY\n/.test('\n' + staat.uit)) {
      staat.gereedGezien = true; maakGereed();
    }
    const m = /(^|\n)OK (\d+)\n/.exec('\n' + staat.uit);
    if (m) staat.id = Number(m[2]);
  });
  kind.stderr.on('data', bytes => { staat.fout = (staat.fout + bytes.toString()).slice(-4000); });
  kind.on('exit', code => {
    if (!staat.gereedGezien) {
      weigerGereed(new Error('accountproces stopte voor de startbarriere: ' +
        JSON.stringify({ code, uit: staat.uit, fout: staat.fout })));
    }
    maakKlaar({ code, uit: staat.uit, fout: staat.fout, id: staat.id });
  });
  return staat;
}

test('drie processen maken gelijktijdig precies één eigenaarsaccount', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eigenaar-wedloop-'));
  const kinderen = Array.from({ length: HOEVEEL }, () => startKind(map));
  try {
    await begrensd(Promise.all(kinderen.map(k => k.gereed)),
      'niet alle accountprocessen bereikten de startbarriere');
    /* Pas als alle drie accounts.init() hebben afgerond, krijgen ze tegelijk
       toestemming. Zo meten we de eigenaarsrace en niet toevallige opstartvolgorde. */
    for (const k of kinderen) k.kind.stdin.end('GA');
    const uitkomsten = await begrensd(Promise.all(kinderen.map(k => k.klaar)),
      'niet alle accountprocessen rondden de eigenaarsbootstrap af');
    assert.deepEqual(uitkomsten.map(u => u.code), [0, 0, 0],
      'een verloren race mag geen proces omwerpen: ' + JSON.stringify(uitkomsten));
    assert.equal(new Set(uitkomsten.map(u => u.id)).size, 1,
      'alle processen horen hetzelfde duurzame eigenaarsaccount terug te lezen');

    const database = new DatabaseSync(path.join(map, 'rtg.db'), { readOnly: true });
    try {
      const rijen = database.prepare("SELECT id, username, tier, verified FROM users WHERE lower(username) = 'rahul'").all();
      assert.equal(rijen.length, 1, 'de race heeft meer dan één Rahul-account gemaakt');
      assert.equal(rijen[0].tier, 'business');
      assert.equal(rijen[0].verified, 'verified');
      const nummers = migraties.gedraaid(database).map(r => r.n);
      assert.equal(new Set(nummers).size, nummers.length, 'iedere migratie staat precies één keer in het grootboek');
      assert.equal(migraties.stand(database), migraties.hoogsteBekend(),
        'de gedeelde accountdatabase staat op de hoogste bekende schemaversie');
    } finally { database.close(); }
  } finally {
    for (const k of kinderen) if (k.kind.exitCode == null) try { k.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
});
