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

   DE POORTEN KOMEN UIT EEN REEKS, NIET UIT EEN POORT. Deze toets zakte in CI
   met "5 !== 6" (24 september 2026) terwijl hij lokaal groen was, en de oorzaak
   zat niet in het trio maar in deze fixture: hij vroeg EEN vrije poort en
   leidde er drie uit af (poort+1..+3) die niemand controleerde. Op Linux geeft
   bind(0) oneven poorten en krijgt een uitgaande connect() even bronpoorten,
   dus poort+1 -- de poort van server 1 -- lag in de bronpoortruimte van elke
   fetch() van elke toets die tegelijk draaide. Stond daar nog een clientsocket
   (open keep-alive, of 60 s TIME_WAIT), dan zakte de listen van server 1 met
   EADDRINUSE, herstartte de hoofd hem om de 2 s op dezelfde poort en wachtte
   30 + 10 s voordat hij servers 2 en 3 en de werkers startte; gezond() werd
   dan na ~46 s waar via server 2 en de telling viel in of buiten het
   herstartgat van server 1: 6 of 5. Drie keer onafhankelijk gereproduceerd,
   met de assert gezien zakkend, en de CI-duur van 48 s (tegen 11 s lokaal)
   is er de vingerafdruk van. Vandaar vrijePoortReeks(4) uit test/helper.js:
   vier aaneengesloten poorten buiten het efemere bereik, waar die klasse
   botsingen niet bestaat. En vandaar dat de hoofd hier niet meer zwijgt: zijn
   laatste regels staan in elke foutmelding, want de regel "poort ... is al in
   gebruik" had dit in vijf minuten verklaard en stond in CI nergens.

   Draai los: node --test test/trio-wees.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { vrijePoortReeks, efemeerBereik } = require('./helper');
const { reusePortBeschikbaar } = require('../server/trio-werkers');

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
   meegeteld -- en bij het opruimen omgelegd -- worden. De opdrachtregel wordt
   wel GELEZEN, per gevonden nakomeling, zodat een foutmelding zegt WELKE rol
   ontbreekt ("2 servers, 2 voordeuren") in plaats van alleen een getal. */
function stamboom(wortel) {
  const uit = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' });
  const kinderen = new Map();
  const opdracht = new Map();
  for (const r of uit.trim().split('\n')) {
    const m = r.trim().match(/^(\d+)\s+(\d+)\s*(.*)$/);
    if (!m) continue;
    const pid = Number(m[1]), ppid = Number(m[2]);
    opdracht.set(pid, m[3] || '');
    if (!kinderen.has(ppid)) kinderen.set(ppid, []);
    kinderen.get(ppid).push(pid);
  }
  const pids = [];
  const rollen = { hoofd: 0, servers: 0, voordeuren: 0, anders: 0 };
  const wachtrij = [wortel];
  while (wachtrij.length) {
    const p = wachtrij.shift();
    pids.push(p);
    const args = opdracht.get(p) || '';
    if (p === wortel) rollen.hoofd++;
    else if (/server\.js/.test(args)) rollen.servers++;
    else if (/trio\.js/.test(args)) rollen.voordeuren++;
    else rollen.anders++;
    for (const k of (kinderen.get(p) || [])) wachtrij.push(k);
  }
  return { pids, rollen };
}
const nakomelingen = (wortel) => stamboom(wortel).pids;
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
      app werkelijk, of beantwoordt het alleen infrastructuurpingen?

   Geeft de pid terug die antwoordde, of null. Die pid wordt hieronder tegen
   de stamboom gehouden: een VREEMDE RTG-server die toevallig op onze poort
   luistert, antwoordt hier ook keurig -- en is geen nakomeling. */
async function gezond(poort) {
  try {
    const h = await fetch('http://127.0.0.1:' + poort + '/api/health');
    if (h.status !== 200) return null;
    const j = await h.json();
    if (!(j && j.ok === true && Number.isFinite(j.server) && Number.isFinite(j.pid))) return null;
    const a = await fetch('http://127.0.0.1:' + poort + '/api/notities/mijn',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (a.status !== 401) return null;
    const b = await a.json();
    return (b && typeof b.error === 'string' && b.error.length > 0) ? j.pid : null;
  } catch (e) { return null; }
}
/* De pid van de server die rechtstreeks op zijn eigen poort antwoordt. Geen
   echte route erbij: dit gaat alleen om WIE er luistert, niet om wat hij doet. */
async function serverPid(poort) {
  try {
    const h = await fetch('http://127.0.0.1:' + poort + '/api/health');
    if (h.status !== 200) return null;
    const j = await h.json();
    return (j && j.ok === true && Number.isFinite(j.pid)) ? j.pid : null;
  } catch (e) { return null; }
}

const mappen = [];
const gestart = [];
test.after(() => {
  for (const pid of gestart) { try { process.kill(pid, 'SIGKILL'); } catch (e) {} }
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

/* OPGEKOMEN IS: DE HELE OPSTELLING, NIET DE EERSTE 200. Het telmoment van
   voorheen was "zodra iets op PORT antwoordt", en dat is precies het moment
   waarop een server in een herstartlus onzichtbaar kan zijn. Nu moet elke van
   de drie servers op zijn eigen poort antwoorden met een pid uit de stamboom
   van de hoofd (drie verschillende), en moet ook het antwoord via PORT van een
   nakomeling komen. Dat is een STRENGERE voorwaarde, geen lossere: een server
   die niet aan zijn listen toekomt, antwoordt nooit, en dan zakt de toets op
   "komt op" -- met de reden van de hoofd erbij in plaats van met een getal. */
async function trioOp({ voordeuren }) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wees-'));
  mappen.push(map);
  const [poort, basis] = await vrijePoortReeks(4);   // PORT, en basis..basis+2 voor de drie servers
  const serverpoorten = [basis, basis + 1, basis + 2];
  const env = Object.assign({}, process.env, {
    RTG_DATA_DIR: map, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '',
    PORT: String(poort), RTG_TRIO_BASIS: String(basis), LOG_LEVEL: 'error',
    RTG_LOKAAL_TLS: '', RTG_DEMO: ''
  });
  if (voordeuren) { env.RTG_POORTWACHTERS = String(voordeuren); env.RTG_SPREIDING = ''; }
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server/trio.js')],
    { env, stdio: ['ignore', 'pipe', 'pipe'] });
  /* De laatste regels van de hoofd, voor in de foutmelding. Hij geeft de uitvoer
     van zijn servers en voordeuren gemerkt door, dus "[server 1] [start] poort
     ... is al in gebruik" komt hier ook langs. */
  const logboek = [];
  const vang = d => { for (const r of String(d).split('\n')) if (r.trim()) { logboek.push(r); if (logboek.length > 60) logboek.shift(); } };
  kind.stdout.on('data', vang);
  kind.stderr.on('data', vang);
  const t0 = Date.now();
  let op = false;
  let stand = null;
  for (let i = 0; i < 90 && !op; i++) {
    const viaPoort = await gezond(poort);
    const eigen = await Promise.all(serverpoorten.map(serverPid));
    stand = stamboom(kind.pid);
    op = viaPoort !== null && eigen.every(p => p !== null && stand.pids.includes(p)) &&
      new Set(eigen).size === 3 && stand.pids.includes(viaPoort);
    if (!op) await slaap(1000);
  }
  /* Nu noteren, want na de klap zijn ze niet meer terug te vinden. */
  const { pids, rollen } = stamboom(kind.pid);
  gestart.push(...pids);
  const uitleg = () => ' [poort ' + poort + ', servers ' + serverpoorten.join('/') + '; ' +
    (op ? 'opgekomen' : 'NIET opgekomen') + ' na ' + Math.round((Date.now() - t0) / 1000) + ' s; rollen ' +
    JSON.stringify(rollen) + '; laatste regels van de hoofd:\n  ' + (logboek.join('\n  ') || '(niets)') + ']';
  return { map, poort, kind, pids, op, uitleg };
}

test('0. de poortreeks ligt buiten het efemere bereik en is bindbaar', async () => {
  /* De grond onder de drie toetsen hieronder (zie de kop). Zou de helper weer
     een basis uit het efemere bereik geven, dan liggen de serverpoorten weer in
     de bronpoortruimte van elke fetch() en is dit bestand weer een flake. */
  const [lo, hi] = efemeerBereik();
  const reeks = await vrijePoortReeks(4);
  assert.equal(reeks.length, 4);
  for (let i = 1; i < 4; i++) assert.equal(reeks[i], reeks[0] + i, 'aaneengesloten: ' + reeks.join(','));
  for (const p of reeks) {
    assert.ok(p < lo || p > hi, 'poort ' + p + ' ligt in het efemere bereik ' + lo + '-' + hi);
    for (const host of ['127.0.0.1', '0.0.0.0']) {
      const s = net.createServer();
      await new Promise((r, x) => { s.on('error', x); s.listen(p, host, r); });
      await new Promise(r => s.close(r));
    }
  }
});

test('1. een hard omgelegde poortwachter laat geen enkele server achter', async () => {
  const t = await trioOp({ voordeuren: 0 });
  assert.ok(t.op, 'het trio komt op' + t.uitleg());
  assert.equal(t.pids.length, 4, 'een poortwachter en drie servers, gemeten: ' + t.pids.length + t.uitleg());
  process.kill(t.kind.pid, 'SIGKILL');       // geen SIGTERM: dat is juist het punt

  let over = t.pids;
  for (let i = 0; i < 40; i++) { await slaap(500); over = nogInLeven(t.pids); if (!over.length) break; }
  assert.equal(over.length, 0,
    'na een kill -9 op de poortwachter hoort er niets meer te draaien; er stonden er nog ' + over.length +
    ' (die houden hun poort vast en laten /api/health 200 geven terwijl de nieuwe poortwachter niets kan starten)');
});

test('2. ook de voordeurprocessen blijven niet achter of vallen draagbaar terug', async () => {
  const t = await trioOp({ voordeuren: 2 });
  assert.ok(t.op, 'het trio met de gevraagde voordeurprocessen komt op' + t.uitleg());
  const verwacht = reusePortBeschikbaar() ? 6 : 4;
  assert.equal(t.pids.length, verwacht,
    'voordeurprocessen waar SO_REUSEPORT bestaat, anders de draagbare hoofdpoort: ' + t.pids.length + t.uitleg());

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
  assert.ok(t.op, 'het trio komt op' + t.uitleg());
  const verwacht = reusePortBeschikbaar() ? 6 : 4;
  assert.equal(t.pids.length, verwacht, 'alle ondersteunde processen stonden er echt (' + verwacht + ')' + t.uitleg());
  t.kind.kill('SIGTERM');
  let over = t.pids;
  for (let i = 0; i < 50; i++) { await slaap(500); over = nogInLeven(t.pids); if (!over.length) break; }
  assert.equal(over.length, 0, 'na SIGTERM is alles weg');
});
