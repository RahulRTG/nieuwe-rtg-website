#!/usr/bin/env node
/* ============================================================================
   DE SPREIDINGSPROEF -- waar zit het plafond op DEZE machine?

   WAAROM DIT BESTAAT. De poortwachter kan verkeer over drie servers verdelen
   (RTG_SPREIDING=1) en zichzelf over meer processen (RTG_POORTWACHTERS=N). Of
   dat iets oplevert hangt volledig af van de machine, en het antwoord was op de
   ontwikkelmachine niet wat iedereen verwachtte: spreiding alleen gaf 1,4%,
   omdat de POORTWACHTER op 90% van een kern zat terwijl de drie servers op de
   helft stonden. Zie docs/meerkernig.md.

   Die meting stond in wegwerpscripts. Dat is precies een meting te weinig: wie
   dit op de doelmachine wil weten moet hem kunnen DRAAIEN, en hem niet hoeven
   nabouwen uit een tabel in een markdownbestand.

   HET OORDEEL IS NIET "SNELLER" MAAR "WAAR KLEMT HET". Een doorvoergetal alleen
   zegt niets: 1,4% winst kan betekenen dat spreiding niet werkt, dat de voordeur
   vol is, dat de machine vol is, of dat de belastingsgenerator vol is -- en die
   vier vragen elk een andere reparatie. Daarom meet dit script per PROCES de
   rekentijd in het meetvenster. Een proces dat een hele kern trekt terwijl de
   rest op een derde staat IS het plafond; daar is geen redenering voor nodig.

   HET RAAKT NOOIT PRODUCTIE. Eigen poort, eigen RTG_DATA_DIR in een tijdelijke
   map, en er is geen vlag om hem ergens anders op te richten -- net als
   scripts/chaos.js. Belasting op een echte omgeving is een besluit met een
   draaiboek, geen commandoregel.

   EXITCODE 1 ALS DE METING ZICHZELF NIET VERTROUWT: de belastingsgenerator zat
   zelf aan zijn plafond, of er kwam geen server op. Een cijfer waar niemand iets
   aan heeft hoort niet als geslaagd te eindigen.

   Draai: node scripts/spreidingsproef.js [--seconden=20] [--clients=2]
                                          [--voordeuren=N] [--uit=pad.json]
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const arg = (naam, standaard) => {
  const m = process.argv.find(a => a.startsWith('--' + naam + '='));
  return m ? m.slice(naam.length + 3) : standaard;
};

/* ================= de client, in ditzelfde bestand =================
   Zelf-forkend, zodat de proef een bestand blijft. Elke werker draagt zijn EIGEN
   Authorization-kop: zonder token is er geen kleefsleutel en stuurt de
   poortwachter alles naar de leider -- dan meet je met spreiding aan precies
   dezelfde opstelling als met spreiding uit en zie je nul verschil om de
   verkeerde reden. De tokens zijn verzonnen; elk verzoek loopt tot en met de
   sessieopzoeking en komt daarna op een 401 uit, en dat is in beide standen
   hetzelfde werk. Gemeten wordt een VERHOUDING, geen absoluut getal. */
async function draaiClient() {
  const poort = Number(process.argv[3]), GELIJK = Number(process.argv[4]);
  const ms = Number(process.argv[5]), merk = process.argv[6];
  const paden = fs.readFileSync(process.argv[7], 'utf8').trim().split('\n').filter(Boolean);
  const agent = new http.Agent({ keepAlive: true, maxSockets: GELIJK + 8 });
  const tijden = [];
  let stop = false, teller = 0, fouten = 0;
  const een = (wie) => new Promise(res => {
    const regel = paden[(teller++) % paden.length];
    const sp = regel.indexOf(' ');
    const t0 = process.hrtime.bigint();
    const r = http.request({ host: '127.0.0.1', port: poort, method: regel.slice(0, sp),
      path: regel.slice(sp + 1), agent, timeout: 30000,
      headers: { 'content-type': 'application/json', 'content-length': 2,
        authorization: 'Bearer lid-' + merk + '-' + wie + '-0123456789abcdef' } }, s => {
      s.resume();
      s.on('end', () => { tijden.push(Number(process.hrtime.bigint() - t0) / 1e6); res(); });
    });
    r.on('error', () => { fouten++; res(); });
    r.on('timeout', () => { r.destroy(); fouten++; res(); });
    r.end('{}');
  });
  for (let i = 0; i < 300; i++) await een(i % GELIJK);   // opwarmen: JIT en de routerindex
  tijden.length = 0; fouten = 0;
  const cpu0 = process.cpuUsage();
  setTimeout(() => { stop = true; }, ms);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: GELIJK }, (_, i) =>
    (async () => { while (!stop) await een(i); })()));
  const sec = (Date.now() - t0) / 1000;
  const cpu = process.cpuUsage(cpu0);
  tijden.sort((a, b) => a - b);
  const p = q => tijden[Math.min(tijden.length - 1, Math.floor(tijden.length * q))] || 0;
  process.stdout.write(JSON.stringify({
    n: tijden.length, fouten, perSec: Math.round(tijden.length / sec),
    p50: +p(0.5).toFixed(2), p99: +p(0.99).toFixed(2),
    /* De client meet zijn EIGEN rekentijd. Zit hij zelf tegen een hele kern aan,
       dan is de meting van de server waardeloos en zegt dit script dat. */
    kern: +((cpu.user + cpu.system) / 1e6 / sec).toFixed(2)
  }));
}

/* ================= rekentijd van een ander proces =================
   Op Linux uit /proc (10 ms nauwkeurig). Elders via `ps -o time=`, dat op de
   meeste systemen centiseconden geeft maar soms alleen hele seconden -- dan
   staat er een ruimere marge op. Lukt geen van beide, dan zegt de uitslag dat
   de toewijzing ONBEKEND is; een verzonnen nul zou hier het hele oordeel
   omdraaien. */
const HZ = 100;
function rekentijd(pid) {
  try {
    const st = fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(' ');
    return (Number(st[13]) + Number(st[14])) / HZ;
  } catch (e) { /* geen /proc: hieronder verder */ }
  try {
    const t = execFileSync('ps', ['-p', String(pid), '-o', 'time='], { encoding: 'utf8' }).trim();
    const d = t.split('-');
    const stukken = d[d.length - 1].split(':').map(Number);
    let sec = stukken.pop() || 0;
    if (stukken.length) sec += (stukken.pop() || 0) * 60;
    if (stukken.length) sec += (stukken.pop() || 0) * 3600;
    if (d.length > 1) sec += Number(d[0]) * 86400;
    return sec;
  } catch (e) { return null; }
}
const som = (pids) => {
  let t = 0;
  for (const p of pids) { const s = rekentijd(p); if (s === null) return null; t += s; }
  return t;
};

/* ================= de opstelling ================= */
const KERNEN = os.cpus().length;
const SECONDEN = Number(arg('seconden', 20));
const CLIENTS = Number(arg('clients', 2));
const GELIJK = Number(arg('gelijk', 24));
const UIT = arg('uit', null);
/* Standaard evenveel voordeuren als kernen min een: de hoofd bewaakt alleen en
   de servers moeten er ook nog bij. Nooit minder dan 2, want met 1 valt er niets
   te vergelijken. */
const VOORDEUREN = Number(arg('voordeuren', Math.max(2, Math.min(8, KERNEN - 1))));
const POORT = 39000 + (process.pid % 900);
const REDIS = process.env.REDIS_URL || null;
/* PAS AANMAKEN IN hoofd(), niet hier. Dit bestand wordt ook als CLIENT geladen
   (--client, zie boven), en dan zou elk clientproces een eigen tijdelijke map
   aanmaken en laten staan. Bij twee clients en drie standen zijn dat zes mappen
   die niemand meer opruimt -- gezien, en het waren er precies zes. */
let MAP = null;

const zeg = (s) => console.log(s);
const slaap = (ms) => new Promise(r => setTimeout(r, ms));

/* Alle node-processen die bij ONZE opstelling horen. Op naam zoeken kan niet:
   het shell-proces dat dit script startte draagt de tekst "server/trio.js" in
   zijn eigen argv en zou dan meegeteld -- en bij het opruimen omgelegd -- worden.
   Dat is hier een keer echt gebeurd. Daarom op de datamap in de omgeving. */
function onzeProcessen() {
  const uit = { voordeuren: [], servers: [] };
  let pids = [];
  try { pids = fs.readdirSync('/proc').filter(n => /^\d+$/.test(n)); }
  catch (e) { return null; }   // geen /proc: geen toewijzing, en dat zeggen we
  for (const pid of pids) {
    let omg = '', cmd = '';
    try {
      omg = fs.readFileSync('/proc/' + pid + '/environ', 'utf8');
      cmd = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
    } catch (e) { continue; }
    if (!omg.includes('RTG_DATA_DIR=' + MAP + '\0')) continue;
    if (cmd.includes('server/trio.js')) uit.voordeuren.push(pid);
    else if (cmd.includes('server/server.js')) uit.servers.push(pid);
  }
  return uit;
}

/* WACHTEN TOT DE VORIGE STAND ECHT WEG IS. Doorstarten terwijl er nog processen
   van de vorige opstelling leven, geeft geen foutmelding maar iets veel ergers:
   de nieuwe servers kunnen hun poort niet binden, terwijl /api/health toch 200
   geeft omdat de OUDE server antwoordt. De nieuwe poortwachter promoveert dan
   niets (die weeskindjes hebben een andere clustersleutel en geven 404) en de
   stand meldt zich als "kwam niet op". Dat is hier gebeurd, en het zag er precies
   uit als een kapotte spreiding. */
async function ruimOp(trio) {
  try { trio.kind.kill('SIGTERM'); } catch (e) {}
  for (let i = 0; i < 30; i++) {
    await slaap(500);
    const p = onzeProcessen();
    if (!p) break;                                   // geen /proc: we kunnen niet tellen
    if (!p.voordeuren.length && !p.servers.length) return;
    if (i === 6) { try { trio.kind.kill('SIGKILL'); } catch (e) {} }
    if (i >= 20) for (const pid of p.voordeuren.concat(p.servers)) { try { process.kill(Number(pid), 'SIGKILL'); } catch (e) {} }
  }
  await slaap(1000);
}

function startTrio({ spreiding, voordeuren }) {
  const env = Object.assign({}, process.env, {
    RTG_DATA_DIR: MAP, RTG_STORE: process.env.DATABASE_URL ? '' : 'sqlite',
    SMTP_URL: '', PORT: String(POORT), RTG_TRIO_BASIS: String(POORT + 1),
    LOG_LEVEL: 'error', RTG_LOKAAL_TLS: '', RTG_DEMO: ''
  });
  if (spreiding) env.RTG_SPREIDING = '1'; else delete env.RTG_SPREIDING;
  if (voordeuren > 0) env.RTG_POORTWACHTERS = String(voordeuren); else delete env.RTG_POORTWACHTERS;
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server/trio.js')],
    { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const regels = [];
  kind.stdout.on('data', d => regels.push(String(d)));
  kind.stderr.on('data', d => regels.push(String(d)));
  return { kind, regels };
}

const gezond = (poort) => new Promise(res => {
  const r = http.request({ host: '127.0.0.1', port: poort, path: '/api/health', timeout: 2000 },
    s => { s.resume(); res(s.statusCode === 200); });
  r.on('error', () => res(false));
  r.on('timeout', () => { r.destroy(); res(false); });
  r.end();
});

async function wachtTotKlaar(trio, spreiding) {
  for (let i = 0; i < 90; i++) {
    if (await gezond(POORT)) break;
    await slaap(1000);
  }
  if (!await gezond(POORT)) return false;
  if (!spreiding) return true;
  /* Wachten tot de poortwachter ZELF meldt dat de meelopers er zijn. Meten
     voordat dat gebeurd is, geeft de stand "alles naar de leider" -- en dat is
     een meting van iets anders dan waar je naar keek. Dat ging hier een keer mis
     en het zag er precies uit als een regressie. */
  for (let i = 0; i < 60; i++) {
    const n = (trio.regels.join('').match(/loopt mee en neemt verkeer aan/g) || []).length;
    if (n >= 2) return true;
    await slaap(1000);
  }
  return false;
}

function belasting(padenBestand) {
  const kinderen = [];
  for (let i = 0; i < CLIENTS; i++) {
    kinderen.push(spawn(process.execPath, [__filename, '--client', String(POORT), String(GELIJK),
      String(SECONDEN * 1000), 'c' + i, padenBestand], { stdio: ['ignore', 'pipe', 'ignore'] }));
  }
  return Promise.all(kinderen.map(k => new Promise(res => {
    let t = '';
    k.stdout.on('data', d => t += d);
    k.on('exit', () => { try { res(JSON.parse(t)); } catch (e) { res(null); } });
  })));
}

async function stand(naam, opties, padenBestand) {
  const trio = startTrio(opties);
  const klaar = await wachtTotKlaar(trio, opties.spreiding);
  if (!klaar) {
    /* MET DE REDEN, en niet alleen "kwam niet op". Dat kostte hier een half uur:
       de melding zei niets, terwijl de laatste regels van de poortwachter er
       gewoon stonden. Een harnas dat zwijgt over waarom het faalde, is zelf de
       storing. */
    const staart = trio.regels.join('').trim().split('\n').slice(-4).join(' / ').slice(0, 400);
    await ruimOp(trio);
    return { naam, mislukt: 'de opstelling kwam niet op. Laatste regels: ' + (staart || '(niets gelogd)') };
  }
  const proc = onzeProcessen();
  const voor = proc ? { vd: som(proc.voordeuren), be: som(proc.servers) } : null;
  const t0 = Date.now();
  const uitslagen = (await belasting(padenBestand)).filter(Boolean);
  const sec = (Date.now() - t0) / 1000;
  const na = proc ? { vd: som(proc.voordeuren), be: som(proc.servers) } : null;
  await ruimOp(trio);

  const doorvoer = uitslagen.reduce((a, u) => a + u.perSec, 0);
  const med = (v) => { const a = uitslagen.map(u => u[v]).sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
  const kernen = (voor && na && voor.vd !== null && na.vd !== null)
    ? { voordeur: +((na.vd - voor.vd) / sec).toFixed(2), servers: +((na.be - voor.be) / sec).toFixed(2) }
    : null;
  return {
    naam, doorvoer, p50: med('p50'), p99: med('p99'),
    fouten: uitslagen.reduce((a, u) => a + u.fouten, 0),
    clientKern: +Math.max(...uitslagen.map(u => u.kern || 0)).toFixed(2),
    kernen, processen: proc ? { voordeuren: proc.voordeuren.length, servers: proc.servers.length } : null
  };
}

/* De routes die de server ECHT registreert, via scripts/routekaart.js -- de
   enige plek die dat eerlijk kan (zie de uitleg daar). Lukt dat niet, dan een
   kleine vaste lijst met de reden erbij: een proef die stilletjes op drie paden
   terugvalt meet iets anders dan hij zegt. */
function padenBestand() {
  const doel = path.join(MAP, 'paden.txt');
  let regels = [];
  try {
    const uit = execFileSync(process.execPath,
      [path.join(WORTEL, 'scripts/routekaart.js'), '--json'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const kaart = JSON.parse(uit);
    for (const r of kaart.routes || []) {
      if (r.pad.includes(':') || r.pad.includes('*')) continue;    // parameters kunnen we niet invullen
      for (const m of r.methoden || []) if (m === 'POST' || m === 'GET') regels.push(m + ' ' + r.pad);
    }
  } catch (e) { regels = []; }
  if (regels.length < 50) {
    zeg('  LET OP: de routekaart gaf niets bruikbaars; er wordt op een kleine vaste lijst gemeten.');
    regels = ['GET /api/health', 'POST /api/notities/mijn', 'POST /api/pay/overzicht', 'POST /api/account/start'];
  }
  fs.writeFileSync(doel, regels.join('\n') + '\n');
  return { doel, aantal: regels.length };
}

function regel(r) {
  if (r.mislukt) return '  ' + r.naam.padEnd(30) + ' MISLUKT: ' + r.mislukt;
  const k = r.kernen ? '   voordeur ' + r.kernen.voordeur.toFixed(2) + ' kern   servers ' + r.kernen.servers.toFixed(2) + ' kern' : '   (rekentijd per proces niet te bepalen op dit systeem)';
  return '  ' + r.naam.padEnd(30) + ' ' + String(r.doorvoer).padStart(6) + '/s   p50 ' +
    r.p50.toFixed(2) + ' ms   p99 ' + r.p99.toFixed(1) + ' ms' + k;
}

/* HET OORDEEL. Dit is het punt van het hele script: niet "sneller of langzamer"
   maar wie het tegenhoudt. De drempels zijn ruim en met opzet grof -- ze hoeven
   alleen een verzadigd proces van een half bezet proces te onderscheiden. */
function oordeel(rijen, omgeving) {
  /* De machinegegevens komen BINNEN en worden hier niet gelezen: een oordeel dat
     stiekem van os.cpus() afhangt, is op een andere machine een ander oordeel en
     in een toets niet vast te zetten. */
  const KERNEN = (omgeving && omgeving.kernen) || os.cpus().length;
  const CLIENTS = (omgeving && omgeving.clients) || 1;
  const beste = rijen.filter(r => !r.mislukt).sort((a, b) => b.doorvoer - a.doorvoer)[0];
  const meldingen = [];
  if (!beste) return { regels: ['Geen enkele opstelling kwam op.'], bruikbaar: false };
  let bruikbaar = true;
  if (beste.clientKern >= 0.9) {
    meldingen.push('DE METING DEUGT NIET: de belastingsgenerator zat zelf op ' + beste.clientKern +
      ' kern. Wat u ziet is zijn plafond, niet dat van de server. Draai hem op een andere machine.');
    bruikbaar = false;
  }
  /* DE JUISTE TWEE NAAST ELKAAR. `/1 voordeur/` matcht ook de eerste rij, en
     `find` geeft dan die -- waarna "meer voordeuren levert X% op" in werkelijkheid
     TWEE dingen tegelijk vergelijkt (spreiding aan EN meer voordeuren) en dus
     niets zegt over voordeuren. Daarom op de volledige naam, en de winst van
     spreiding apart. */
  const bij = (naam) => rijen.find(r => r.naam === naam && !r.mislukt);
  const uitRij = bij('spreiding uit, 1 voordeur');
  const een = bij('spreiding aan, 1 voordeur');
  const meer = rijen.find(r => /\d+ voordeuren$/.test(r.naam) && !r.mislukt);
  if (een && een.kernen) {
    if (een.kernen.voordeur >= 0.75 && een.kernen.servers / Math.max(1, een.processen.servers) < een.kernen.voordeur) {
      meldingen.push('HET PLAFOND IS DE POORTWACHTER: hij trok ' + een.kernen.voordeur +
        ' kern terwijl de servers samen op ' + een.kernen.servers + ' kern zaten. Zet RTG_POORTWACHTERS.');
    }
  }
  /* DE MACHINE, en op de BESTE rij -- niet op de eerste. Dat is de rij met de
     meeste processen, dus daar is de bezetting het hoogst. En de formulering
     doet ertoe: hier stond "meer processen kan niets meer opleveren", pal naast
     een regel die +30% van meer voordeuren meldde. Twee zinnen die elkaar
     tegenspreken maken een uitslag onbruikbaar. Wat er WEL uit volgt is dat de
     gemeten winst een ONDERGRENS is: op een ruimere machine kan er meer in
     zitten, en dat is precies wat een lezer moet weten. */
  if (beste.kernen) {
    const totaal = beste.kernen.voordeur + beste.kernen.servers + beste.clientKern * CLIENTS;
    if (totaal > KERNEN * 0.85) {
      meldingen.push('DEZE MACHINE ZIT VOL: alles samen ' + totaal.toFixed(1) + ' van ' + KERNEN +
        ' kernen, de belastingsgenerator meegerekend. Wat hierboven staat is dus een ONDERGRENS van ' +
        'wat de software kan -- op een ruimere machine kan er meer in zitten, en dat valt hier niet te zien.');
    }
  }
  if (!meldingen.length) meldingen.push('Geen enkel proces zat aan zijn plafond; het plafond ligt ergens anders.');
  const pct = (a, b) => { const w = ((b / a - 1) * 100).toFixed(0); return (w >= 0 ? '+' : '') + w + '%'; };
  const winst = [];
  if (uitRij && een) winst.push('SPREIDING ALLEEN levert ' + pct(uitRij.doorvoer, een.doorvoer) +
    ' op (' + uitRij.doorvoer + ' -> ' + een.doorvoer + '/s).');
  if (een && meer) winst.push('MEER VOORDEUREN levert daar bovenop ' + pct(een.doorvoer, meer.doorvoer) +
    ' op (' + een.doorvoer + ' -> ' + meer.doorvoer + '/s).');
  if (uitRij && meer) winst.push('SAMEN ' + pct(uitRij.doorvoer, meer.doorvoer) + ' tegenover de standaardstand.');
  return { regels: winst.concat(meldingen), bruikbaar };
}

async function hoofd() {
  zeg('');
  MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spreiding-'));
  zeg('DE SPREIDINGSPROEF op een EIGEN trio, poort ' + POORT + ', datamap ' + MAP + '.');
  zeg('  ' + KERNEN + ' kernen, ' + CLIENTS + ' clientproces(sen) van ' + GELIJK +
      ' gelijktijdig, ' + SECONDEN + ' s per stand.');
  if (!REDIS) zeg('  LET OP: geen REDIS_URL. Spreiding wordt dan NIET aangezet (de processen zouden geen sessies delen),');
  if (!REDIS) zeg('          dus de standen met spreiding meten hier hetzelfde als de eerste. Zet REDIS_URL voor een echte proef.');
  const paden = padenBestand();
  zeg('  ' + paden.aantal + ' echte routes.');
  zeg('');

  const rijen = [];
  rijen.push(await stand('spreiding uit, 1 voordeur', { spreiding: false, voordeuren: 0 }, paden.doel));
  zeg(regel(rijen[rijen.length - 1]));
  rijen.push(await stand('spreiding aan, 1 voordeur', { spreiding: true, voordeuren: 0 }, paden.doel));
  zeg(regel(rijen[rijen.length - 1]));
  rijen.push(await stand('spreiding aan, ' + VOORDEUREN + ' voordeuren', { spreiding: true, voordeuren: VOORDEUREN }, paden.doel));
  zeg(regel(rijen[rijen.length - 1]));

  const o = oordeel(rijen, { kernen: KERNEN, clients: CLIENTS });
  zeg('');
  for (const r of o.regels) zeg('  ' + r);
  zeg('');
  if (UIT) {
    fs.writeFileSync(UIT, JSON.stringify({ kernen: KERNEN, clients: CLIENTS, gelijk: GELIJK,
      seconden: SECONDEN, redis: !!REDIS, rijen, oordeel: o.regels }, null, 2) + '\n');
    zeg('  Uitslag in ' + UIT);
  }
  try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {}
  process.exit(o.bruikbaar ? 0 : 1);
}

/* Het oordeel is het PRODUCT van dit script -- de rest is meetgereedschap. Dus
   is het te toetsen zonder een trio te starten: test/spreidingsoordeel.test.js
   voert er standen doorheen die hier echt gemeten zijn. Zonder dat kan de
   uitspraak "het plafond is de poortwachter" stilletjes onwaar worden. */
module.exports = { oordeel, autoRegel: regel };

/* ALLEEN ALS DIT BESTAND DE OPDRACHT IS. Hier stond `if (require.main !== module)
   {} else if ... else ...` -- een omgekeerde vergelijking met een lege tak. De
   mutatiemotor draaide hem om en NIETS werd rood: bij `===` begint een simpele
   require() de hele proef, die dan op de achtergrond trio's staat te starten
   terwijl de toets al lang geslaagd is. Een constructie die bij een omgedraaid
   teken stilletjes een meetopstelling opstart, hoort er niet te staan; dit is de
   gewone vorm en die kan die kant niet op. */
if (require.main === module) {
  if (process.argv.includes('--client')) draaiClient();
  else hoofd().catch(e => { console.error(e); if (MAP) try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (x) {} process.exit(1); });
}
