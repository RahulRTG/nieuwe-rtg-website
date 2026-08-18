/* EEN WEGWERPSERVER VOOR EEN ZWARE PROEF.

   scripts/ladder.js en scripts/rolronde.js hebben allebei hetzelfde nodig: een
   echte server, op een eigen poort, met een wegwerpdatamap, en klaar om
   beproefd te worden. Twee kopieen van die startregels lopen uiteen -- en dan
   draait de ene proef tegen een installatie met een demo-zaak en de andere niet,
   waarna hun uitslagen niet meer vergelijkbaar zijn zonder dat iemand weet
   waarom (LAT.md regel 4).

   RTG_DEMO=1 IS HIER GEEN VERSOEPELING MAAR DEKKING. Zonder die vlag start er
   een installatie zonder demo-zaak en zonder betaalrail, en dan kan een proef
   een flink deel van zijn werk niet doen -- bij de ladder probeerde de
   insider-trede daardoor NUL dingen. Wat de vlag NIET doet is een deur
   openzetten: elke poort (auth, rolscheiding, horizontale scheiding,
   tokenvervalsing) blijft precies zoals hij is. De sessie is juist het
   gereedschap waarmee de proef zijn werk kan doen.

   Voor productie geldt onverkort dat RTG_DEMO uit hoort te staan; daar gaat
   scripts/golive.js over. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const WORTEL = path.join(__dirname, '..', '..');

function start({ poort, merk }) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-' + (merk || 'proef') + '-'));
  const child = spawn(process.execPath, ['--experimental-sqlite', 'server/server.js'], {
    cwd: WORTEL,
    env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: TMP, NODE_ENV: 'test',
      SMTP_URL: '', ANTHROPIC_API_KEY: '', RTG_DEMO: '1' },
    stdio: ['ignore', 'ignore', 'ignore']
  });
  return { child, base: 'http://127.0.0.1:' + poort, TMP };
}

function stop(srv) {
  if (!srv) return;
  try { srv.child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(srv.TMP, { recursive: true, force: true }); } catch (e) {}
}

/* Wachten tot hij gezond is. Geeft false in plaats van te gooien, want de
   aanroeper weet beter wat "de server kwam niet op" voor zijn proef betekent --
   en dat hoort een zichtbare uitkomst te zijn en geen stille nul. */
async function wachtGezond(vraag, pogingen) {
  for (let i = 0; i < (pogingen || 200); i++) {
    const r = await vraag('GET', '/api/ready', null, null, { timeout: 3000 }).catch(() => ({ status: 0 }));
    if (r.status === 200) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

module.exports = { start, stop, wachtGezond, WORTEL };
