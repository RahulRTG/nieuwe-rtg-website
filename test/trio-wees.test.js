/* GEEN WEESKINDEREN ALS DE POORTWACHTER HARD OMVALT.

   Het trio start drie servers (server/trio-wacht.js) en, met RTG_POORTWACHTERS,
   ook nog voordeurprocessen (server/trio-werkers.js). Bij SIGTERM ruimt de
   poortwachter die netjes op. Bij een HARDE dood -- kill -9, een crash, een
   OOM-killer -- gebeurt dat niet, en dan blijven ze draaien:

     - ze houden hun poort vast, dus een herstartende poortwachter krijgt zijn
       eigen servers niet aan de praat;
     - /api/health geeft toch 200, want de WEES antwoordt;
     - promoveren mislukt met een 404, want de wees heeft de oude clustersleutel.

   Bij elkaar ziet dat er niet uit als een poortconflict maar als een kapotte
   spreiding, en daar is hier een half uur aan opgegaan. De oplossing is een
   IPC-lijn waar geen enkel bericht overheen gaat: hij is er alleen zodat een
   kind het dichtvallen ervan merkt.

   DEZE TOETS START ECHTE PROCESSEN en legt er echt een om, want dat is precies
   het ding dat getoetst moet worden. Een nagebootste 'disconnect' bewijst dat de
   handler bestaat, niet dat het besturingssysteem hem afvuurt als de ouder weg
   is -- en dat laatste is de aanname.

   Draai los: node --experimental-sqlite --test test/trio-wees.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { vrijePoort } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const slaap = (ms) => new Promise(r => setTimeout(r, ms));

/* DE PIDS OPSCHRIJVEN ZOLANG DE OUDER NOG LEEFT, en daarna kijken of ze er nog
   zijn. Dat klinkt omslachtiger dan "zoek de processen op hun datamap", maar het
   is het juiste gereedschap:

   - het werkt overal. De datamap uitlezen kan alleen via /proc, dus die aanpak
     sloeg zichzelf over op elk systeem zonder /proc -- en een toets die zichzelf
     overslaat is geen toets;
   - na de klap zijn de weeskinderen HERouderd naar pid 1, dus de stamboom
     aflopen kan dan niet meer. Vandaar: eerst noteren, dan pas omleggen.

   Zoeken op de naam in de opdrachtregel kan hier trouwens niet: het test- en
   shellproces dragen de tekst "server/trio.js" zelf ook, en die zouden dan
   meegeteld -- en bij het opruimen omgelegd -- worden. */
function nakomelingen(wortel) {
  const uit = execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  const kinderen = new Map();
  for (const r of uit.trim().split('\n')) {
    const [pid, ppid] = r.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue;
    if (!kinderen.has(ppid)) kinderen.set(ppid, []);
    kinderen.get(ppid).push(pid);
  }
  const gevonden = [];
  const wachtrij = [wortel];
  while (wachtrij.length) {
    const p = wachtrij.shift();
    gevonden.push(p);
    for (const k of (kinderen.get(p) || [])) wachtrij.push(k);
  }
  return gevonden;
}
/* Leeft dit proces nog? Sein 0 verstuurt niets en zegt alleen of het bestaat. */
const leeft = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
const nogInLeven = (pids) => pids.filter(leeft);
/* GEZOND IS MEER DAN EEN 200 OP /api/health. Twee redenen, en de tweede is de
   belangrijkste:

   1. De health-check hoort te antwoorden ALS ZICHZELF -- met zijn eigen
      servernummer en pid. Deze toets gaat over welke processen er leven, dus
      "er antwoordt iets op die poort" is te weinig.
   2. /api/health is bij de liegpoort met OPZET vrijgesteld (INFRA in
      server/opzet/liegpoort.js: een liegende health-check laat de hele
      opstelling omvallen om een reden die niets met de toets te maken heeft).
      Een toets die alleen die endpoint aanraakt, kan door de mutatiemotor dus
      nooit worden omgelegd -- en dat was hier zo: hij meldde zich "overleefd".
      Daarom raakt dit ook een ECHTE route aan. Zonder liegpoort geeft die
      401 "Niet ingelogd"; met liegpoort 200 {ok:true}. Dat verschil maakt de
      toets omlegbaar, en het is bovendien de betere vraag: bedient dit trio de
      app werkelijk, of beantwoordt het alleen infrastructuurpingen? */
async function gezond(poort) {
  try {
    const h = await fetch('http://127.0.0.1:' + poort + '/api/health');
    if (h.status !== 200) return false;
    const j = await h.json();
    if (!(j && j.ok === true && Number.isFinite(j.server) && Number.isFinite(j.pid))) return false;
    const a = await fetch('http://127.0.0.1:' + poort + '/api/notities/mijn',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (a.status !== 401) return false;
    const b = await a.json();
    return !!(b && typeof b.error === 'string' && b.error.length > 0);
  } catch (e) { return false; }
}

const mappen = [];
const gestart = [];
test.after(() => {
  for (const pid of gestart) { try { process.kill(pid, 'SIGKILL'); } catch (e) {} }
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

async function trioOp({ voordeuren }) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wees-'));
  mappen.push(map);
  const poort = await vrijePoort();
  const env = Object.assign({}, process.env, {
    RTG_DATA_DIR: map, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '',
    PORT: String(poort), RTG_TRIO_BASIS: String(poort + 1), LOG_LEVEL: 'error',
    RTG_LOKAAL_TLS: '', RTG_DEMO: ''
  });
  if (voordeuren) { env.RTG_POORTWACHTERS = String(voordeuren); env.RTG_SPREIDING = ''; }
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server/trio.js')],
    { env, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 90; i++) { if (await gezond(poort)) break; await slaap(1000); }
  /* Nu noteren, want na de klap zijn ze niet meer terug te vinden. */
  const pids = nakomelingen(kind.pid);
  gestart.push(...pids);
  return { map, poort, kind, pids };
}

test('1. een hard omgelegde poortwachter laat geen enkele server achter', async () => {
  const t = await trioOp({ voordeuren: 0 });
  assert.ok(await gezond(t.poort), 'het trio komt op');
  assert.equal(t.pids.length, 4, 'een poortwachter en drie servers, gemeten: ' + t.pids.length);

  process.kill(t.kind.pid, 'SIGKILL');       // geen SIGTERM: dat is juist het punt

  let over = t.pids;
  for (let i = 0; i < 40; i++) { await slaap(500); over = nogInLeven(t.pids); if (!over.length) break; }
  assert.equal(over.length, 0,
    'na een kill -9 op de poortwachter hoort er niets meer te draaien; er stonden er nog ' + over.length +
    ' (die houden hun poort vast en laten /api/health 200 geven terwijl de nieuwe poortwachter niets kan starten)');
});

test('2. ook de voordeurprocessen blijven niet achter', async () => {
  const t = await trioOp({ voordeuren: 2 });
  assert.ok(await gezond(t.poort), 'het trio met voordeurprocessen komt op');
  assert.equal(t.pids.length, 6, 'een hoofd, twee voordeuren en drie servers, gemeten: ' + t.pids.length);

  process.kill(t.kind.pid, 'SIGKILL');

  let over = t.pids;
  for (let i = 0; i < 40; i++) { await slaap(500); over = nogInLeven(t.pids); if (!over.length) break; }
  assert.equal(over.length, 0, 'er stonden er nog ' + over.length + ' overeind');
});

test('3. bij een NETTE afsluiting gaat alles ook weg, en dan hoort het al langer', async () => {
  /* De tegenproef. Zou toets 1 en 2 slagen doordat het trio uberhaupt nooit
     opkomt, dan slaagt deze ook -- maar alle drie eisen eerst dat de processen er
     STONDEN. Zo kan "alles is weg" niet groen worden door "er was niets". */
  const t = await trioOp({ voordeuren: 2 });
  assert.equal(t.pids.length, 6, 'er stonden er echt zes');
  t.kind.kill('SIGTERM');
  let over = t.pids;
  for (let i = 0; i < 50; i++) { await slaap(500); over = nogInLeven(t.pids); if (!over.length) break; }
  assert.equal(over.length, 0, 'na SIGTERM is alles weg');
});
