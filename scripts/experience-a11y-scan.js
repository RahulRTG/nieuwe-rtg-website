#!/usr/bin/env node
'use strict';

/* DEZELFDE A11Y-METING, OP TWEE LOKALE PROCESSEN.

   EXPERIENCEWERKT draaide alle 317 routes achter elkaar in een unit-scherf en
   raakte daardoor na 42 minuten zijn procesdeadline. De bestaande a11y-meter
   kan al veilig delen meten en scripts/a11y-oordeel.js kan die delen al
   fail-closed samenvoegen. Deze adapter verbindt alleen die twee bestaande
   verantwoordelijkheden: drie metingen tegelijk, daarna precies een oordeel.

   Drie is bewust. Twee scherven bereikten op de volledige 316-routevoorraad de
   harde uurgrens voordat zij een oordeel konden teruggeven. Vier lokale
   Chromium-processen maakten de runner niet sneller maar veroorzaakten
   30-secondennavigatietime-outs. Drie houdt dezelfde routevoorraad en hetzelfde
   eindoordeel, met voldoende ruimte voor een expliciete fail-closed uitslag.

   Dit is geen tweede meter. Een ontbrekend deel, dubbele route, afwijkende
   browser, schermgat of globale budgetoverschrijding laat het oordeel zakken en
   er wordt dan geen samengevoegde Experience-meting geschreven. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const metingUit = (argv.find(arg => arg.startsWith('--meting=')) || '').slice(9);
const DELEN = 3;

if (!metingUit) {
  console.error('[experience-a11y] --meting=<bestand> is verplicht.');
  process.exit(2);
}

const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-experience-a11y-delen-'));
const kinderen = new Set();
let afsluiten = false;

function staart(bestand, regels = 80) {
  try { return fs.readFileSync(bestand, 'utf8').split('\n').slice(-regels).join('\n'); }
  catch (_) { return ''; }
}

function stopKinderen(signaal = 'SIGTERM') {
  for (const kind of kinderen) {
    try { kind.kill(signaal); } catch (_) { /* proces was al klaar */ }
  }
}

for (const signaal of ['SIGTERM', 'SIGINT']) process.on(signaal, () => {
  if (afsluiten) return;
  afsluiten = true;
  stopKinderen(signaal);
  process.exit(1);
});

function meet(nummer) {
  const meting = path.join(map, `deel-${nummer}.json`);
  const log = path.join(map, `deel-${nummer}.log`);
  const fd = fs.openSync(log, 'w');
  return new Promise(resolve => {
    let klaar = false;
    const rondAf = resultaat => {
      if (klaar) return;
      klaar = true;
      kinderen.delete(kind);
      fs.closeSync(fd);
      resolve(resultaat);
    };
    const kind = cp.spawn(process.execPath,
      ['scripts/a11y.js', `--deel=${nummer}/${DELEN}`, `--meting=${meting}`], {
        cwd: ROOT,
        env: { ...process.env, A11Y_STRICT: '1' },
        stdio: ['ignore', fd, fd]
      });
    kinderen.add(kind);
    kind.on('error', fout => {
      rondAf({ nummer, status: 1, fout, log, meting });
    });
    kind.on('close', status => {
      rondAf({ nummer, status: status ?? 1, log, meting });
    });
  });
}

(async () => {
  const resultaten = await Promise.all(Array.from({ length: DELEN }, (_, i) => meet(i + 1)));
  const mislukt = resultaten.filter(resultaat => resultaat.status !== 0 || !fs.existsSync(resultaat.meting));
  if (mislukt.length) {
    for (const resultaat of mislukt) {
      console.error(`[experience-a11y] deel ${resultaat.nummer}/${DELEN} faalde (status ${resultaat.status}).`);
      if (resultaat.fout) console.error(resultaat.fout.message);
      const log = staart(resultaat.log);
      if (log) console.error(log);
    }
    process.exitCode = 1;
    return;
  }

  const oordeel = cp.spawnSync(process.execPath,
    ['scripts/a11y-oordeel.js', map, `--delen=${DELEN}`, `--meting=${metingUit}`], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
    });
  if (oordeel.stdout) process.stdout.write(oordeel.stdout);
  if (oordeel.stderr) process.stderr.write(oordeel.stderr);
  if (oordeel.error) console.error(oordeel.error.message);
  if (oordeel.status !== 0 || !fs.existsSync(metingUit)) process.exitCode = 1;
})().catch(fout => {
  stopKinderen();
  console.error('[experience-a11y] fout:', fout);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(map, { recursive: true, force: true });
});
