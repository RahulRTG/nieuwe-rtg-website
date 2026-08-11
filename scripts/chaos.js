/* DE CHAOSPROEF -- een server omleggen en METEN of de rest het overneemt.

   Het failover-trio (server/trio.js) belooft iets: valt de actieve server uit,
   dan neemt een standby het over. Dat stond in de documentatie en was nooit
   gemeten. Een failover die nooit is uitgeprobeerd, is een aanname met een
   diagram eromheen.

   WAT DIT SCRIPT DOET:
     1 een EIGEN trio starten, op een eigen poort en met een EIGEN datamap;
     2 wachten tot de voordeur antwoordt;
     3 elke 25 ms een verzoek doen en de uitslag opschrijven;
     4 de ACTIEVE server omleggen (SIGKILL, geen nette afsluiting --
       een nette afsluiting bewijst niets over een crash);
     5 doormeten, en uitrekenen hoe lang het duurde voor er weer iets lukte.

   HET RAAKT NOOIT PRODUCTIE. Het start zijn eigen trio met een verse
   RTG_DATA_DIR in een tijdelijke map, en praat alleen met die installatie. Er
   is geen vlag om hem op een echte omgeving te richten, en die hoort er ook
   niet te komen: chaos op productie is een besluit met een draaiboek en geen
   commandoregel.

   SIGKILL EN NIET SIGTERM, en dat is het hele punt. Bij SIGTERM ruimt de server
   netjes op en sluit hij zijn poort; dan bewijs je dat een gepland onderhoud
   werkt. Een storing kondigt zich niet aan.

   Draai: node scripts/chaos.js [--seconden=20] [--uit=pad.json]
   Uitslag: exitcode 0 als er hersteld is, 1 als dat niet gebeurde. */
'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const { meet } = require('./lib/chaosmeet');

const args = process.argv.slice(2);
const getal = (naam, standaard) => {
  const a = args.find(x => x.startsWith('--' + naam + '='));
  return a ? Number(a.split('=')[1]) : standaard;
};
const SECONDEN = Math.max(6, Math.min(getal('seconden', 20), 120));
const UIT = (args.find(x => x.startsWith('--uit=')) || '').slice(6) || null;
const TIK_MS = 25;   // fijn genoeg om een korte onderbreking te zien

const slaap = (ms) => new Promise(k => setTimeout(k, ms));

function vrijePoort() {
  return new Promise((klaar, fout) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => klaar(p)); });
    s.on('error', fout);
  });
}

/* /api/health draagt de PID van de server die dit verzoek afhandelde. Dat is
   precies wat deze proef nodig heeft: de poortwachter stuurt naar de ACTIEVE
   server, dus die pid is de actieve server. Een standby omleggen zou niets
   bewijzen -- dan meet je vooral dat een reserve gemist kan worden. */
async function klopt(basis) {
  try {
    const r = await fetch(basis + '/api/health', { signal: AbortSignal.timeout(2000) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.status === 200, status: r.status, pid: d.pid || null, server: d.server || null };
  } catch (e) {
    return { ok: false, status: 0, reden: String(e.message || e).slice(0, 60) };
  }
}

(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-chaos-'));
  const poort = await vrijePoort();
  const basis = 'http://127.0.0.1:' + poort;
  console.log('Chaosproef op een EIGEN trio, poort ' + poort + ', datamap ' + TMP + '.\n');

  const trio = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'trio.js')], {
    env: Object.assign({}, process.env, { PORT: String(poort), RTG_DATA_DIR: TMP, SMTP_URL: '' }),
    stdio: ['ignore', 'ignore', 'ignore']
  });

  const opruimen = () => {
    try { trio.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  };
  process.on('exit', opruimen);

  /* Wachten tot de voordeur antwoordt. Duurt dat te lang, dan is er niets te
     beproeven en zeggen we dat in plaats van een lege uitslag te maken. */
  let op = false;
  for (let i = 0; i < 100 && !op; i++) { op = (await klopt(basis)).ok; if (!op) await slaap(300); }
  if (!op) {
    console.error('Het trio kwam niet op binnen 30 seconden; er valt niets te beproeven.');
    opruimen();
    process.exit(2);
  }
  console.log('Het trio staat. Meten begint.\n');

  const monsters = [];
  let draait = true;
  const meten = (async () => {
    while (draait) {
      const t = Date.now();
      const r = await klopt(basis);
      monsters.push({ at: t, ok: r.ok, status: r.status });
      await slaap(TIK_MS);
    }
  })();

  /* Een derde van de tijd rustig meten, dan de klap. */
  await slaap((SECONDEN * 1000) / 3);

  let kinderen = [];
  try {
    kinderen = String(execFileSync('pgrep', ['-P', String(trio.pid)], { encoding: 'utf8' }))
      .trim().split('\n').filter(Boolean).map(Number);
  } catch (e) { kinderen = []; }
  if (!kinderen.length) {
    draait = false; await meten;
    console.error('De kinderen van het trio zijn niet gevonden (pgrep). Zonder een proces om te leggen ' +
      'is er niets gemeten; dit is geen geslaagde proef.');
    opruimen();
    process.exit(2);
  }

  /* WELKE server omleggen: de ACTIEVE. Die vraag stellen we aan de voordeur
     zelf, want de poortwachter stuurt het verkeer naar de actieve server en
     /api/health draagt de pid van wie het afhandelde. Zonder deze stap zou de
     proef net zo goed een standby kunnen omleggen, en dan bewijst een groene
     uitslag alleen dat een reserve gemist kan worden. */
  const wie = await klopt(basis);
  const slachtoffer = wie.pid && kinderen.includes(wie.pid) ? wie.pid : null;
  if (!slachtoffer) {
    draait = false; await meten;
    console.error('De actieve server is niet aan te wijzen (pid ' + wie.pid + ' zit niet bij de kinderen ' +
      kinderen.join(', ') + '). Een willekeurige omleggen zou niets bewijzen, dus stoppen we.');
    opruimen();
    process.exit(2);
  }
  const klapAt = Date.now();
  console.log('Omleggen: SIGKILL op de ACTIEVE server ' + wie.server + ' (pid ' + slachtoffer +
    ', van ' + kinderen.length + ' processen).');
  try { process.kill(slachtoffer, 'SIGKILL'); } catch (e) {
    console.error('Kon dat proces niet omleggen: ' + e.message);
  }

  await slaap((SECONDEN * 1000 * 2) / 3);
  draait = false;
  await meten;

  const uitslag = meet(monsters, klapAt);
  console.log('\n' + uitslag.verzoeken + ' verzoeken, ' + uitslag.mislukt + ' mislukt (' +
    Math.round((uitslag.deelGelukt || 0) * 1000) / 10 + '% gelukt).');
  console.log('Oordeel: ' + uitslag.oordeel +
    (uitslag.hersteltijdMs != null ? ', hersteltijd ' + uitslag.hersteltijdMs + ' ms' : '') + '.');
  if (uitslag.meetvertragingMs != null) {
    console.log('Tussen de klap en het eerste gemiste verzoek zat ' + uitslag.meetvertragingMs +
      ' ms; dat is de meetafstand en zegt niets over de failover.');
  }
  if (uitslag.let) console.log('\nLet op: ' + uitslag.let);

  if (UIT) {
    fs.writeFileSync(UIT, JSON.stringify(Object.assign({ gemetenOp: new Date().toISOString(),
      seconden: SECONDEN, tikMs: TIK_MS }, uitslag), null, 2));
    console.log('\nUitslag weggeschreven naar ' + UIT + '.');
  }

  opruimen();
  process.exit(uitslag.oordeel === 'niet hersteld' ? 1 : 0);
})();
