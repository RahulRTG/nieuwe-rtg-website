/* ============================================================================
   EEN BEZETTE POORT IS EEN STARTFOUT, GEEN SERVERFOUT.

   app.listen meldt een mislukking (EADDRINUSE als de poort bezet is) via een
   'error'-gebeurtenis op de server. Daar luisterde niemand, dus viel hij door
   naar het uncaughtException-vangnet.

   Ik had opgeschreven dat de server dan bleef hangen. Nagemeten klopte dat
   niet: hij stopte gewoon, met exitcode 1. Wat er wél misging zit in de
   BENOEMING, en dat raakt uitgerekend deze testsuite. De regel in het log
   draagt "bron":"uncaughtException" en "fataal":true, en test/helper.js
   rekent precies dat patroon af als een serverfout die de HELE run laat
   falen (de strenge poort). De helper weet dat een poort-race voorkomt --
   dat staat in zijn eigen commentaar, en hij probeert er netjes opnieuw om --
   maar de geslaagde herkansing nam de valse "server-uitzondering" niet meer
   weg. Een groene testrun kon dus rood worden door een botsing die keurig was
   opgevangen.

   Deze test bezet een poort, laat de server erbovenop starten, en eist drie
   dingen: hij stopt, hij stopt met een foutcode, en hij noemt het een
   startfout in plaats van een uncaughtException.

   Draai los: node --experimental-sqlite --test test/poortrace.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('fs');
const os = require('os');
const path = require('path');

// hetzelfde patroon als de strenge poort in test/helper.js: wat hier matcht,
// laat daar de hele testrun falen
const FATAAL = /"bron":"(uncaughtException|unhandledRejection)"|"serverfout":true/;

test('een bezette poort: de server stopt met een foutcode en noemt het een startfout', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-poort-'));
  // 1) zelf de poort bezetten en vasthouden
  const bezetter = net.createServer();
  const poort = await new Promise((res, rej) => {
    bezetter.on('error', rej);
    bezetter.listen(0, '127.0.0.1', () => res(bezetter.address().port));
  });

  try {
    // 2) de echte server erbovenop starten
    const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
      env: Object.assign({}, process.env, { PORT: String(poort), RTG_BIND: '127.0.0.1',
        RTG_DATA_DIR: TMP, SMTP_URL: '' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let uit = '';
    kind.stdout.on('data', d => { uit += d; });
    kind.stderr.on('data', d => { uit += d; });

    /* 3) hij moet uit zichzelf stoppen. Twintig seconden is ruim: het opstarten
       duurt onder normale belasting een seconde of acht (SQLite, seed,
       sleutels) en de listen-fout komt daar meteen achteraan. Blijft hij
       langer leven, dan maken we er zelf een einde aan zodat de testrun niet
       blijft staan. */
    const afloop = await Promise.race([
      new Promise(res => kind.on('exit', (code, sig) => res({ code, sig }))),
      new Promise(res => setTimeout(() => res(null), 20000))
    ]);
    if (!afloop) { try { kind.kill('SIGKILL'); } catch (e) {} }

    assert.ok(afloop, 'de server bleef draaien op een poort die hij nooit kreeg');
    assert.notEqual(afloop.code, 0,
      'een mislukte start mag niet als exitcode 0 eindigen -- dan herstart geen enkele proces-manager hem (kreeg: ' + JSON.stringify(afloop) + ')');
    assert.match(uit, /in gebruik|EADDRINUSE/i,
      'en hij zegt waarom, zodat de beheerder het in het log ziet staan');

    /* DE ASSERTIE DIE ERTOE DOET. Geen enkele logregel van deze mislukte start
       mag eruitzien als een server-uitzondering, want dan laat de strenge poort
       in test/helper.js een verder groene run alsnog falen. */
    const valsAlarm = uit.split('\n').filter(r => FATAAL.test(r));
    assert.deepEqual(valsAlarm, [],
      'een poortbotsing is een startfout en mag niet als uncaughtException in het log komen');
  } finally {
    await new Promise(res => bezetter.close(res));
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
