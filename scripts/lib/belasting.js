/* ============================================================================
   BELASTING METEN: CPU, EVENT-LOOP, DATABASE -- EN HET HERSTEL DAARNA.

   De Beproeving mat tot nu toe latentie, doorvoer en geheugen. Dat zegt WAT er
   gebeurde, maar niet WAAROM en niet WAAR de grens ligt. Misschien blijft de CPU
   rustig en loopt de databasepool vol. Misschien is de latentie prima en staat
   de event-loop periodiek een halve seconde stil, zodat een kleine groep
   gebruikers extreem lang wacht terwijl het gemiddelde er goed uitziet.

   En het stuk dat volledig ontbrak: wat gebeurt er NADAT de storm stopt. Een
   server die de aanval overleeft maar er niet meer uitkomt, is in productie net
   zo stuk als een server die omvalt. Wachtrijen moeten leeglopen, het geheugen
   moet zakken, de foutpercentages moeten herstellen, en een gewone gebruiker
   moet zijn oorspronkelijke snelheid terugkrijgen.

   ALLES BEST-EFFORT, EN NOOIT STIL. Elke meter geeft null als hij niet kan
   meten, en nooit nul: nul is een meetwaarde en "ik weet het niet" is dat niet.
   Dat onderscheid is de reden dat deze module bestaat in plaats van vier regels
   in het harnas.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

/* ---------- CPU ----------
   /proc/<pid>/stat velden 14 en 15 zijn utime en stime in klok-ticks. Het
   verschil over een venster, gedeeld door de verstreken tijd, is het
   CPU-gebruik van het proces. Boven de 100% betekent: meer dan een kern (Node
   heeft naast de lus ook een threadpool voor bestands- en crypto-werk). */
let CLK = 100;
try { CLK = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim()) || 100; } catch (e) { /* 100 */ }

function cpuTicks(pid) {
  try {
    const s = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    // de naam tussen haakjes kan spaties bevatten; knip er daarom vanaf de sluithaak
    const na = s.slice(s.lastIndexOf(')') + 2).split(' ');
    return Number(na[11]) + Number(na[12]);   // utime, stime (0-gebaseerd na de knip)
  } catch (e) { return null; }
}

function cpuMeter(pid) {
  let t0 = null, tick0 = null, piek = 0, som = 0, n = 0;
  return {
    start() { t0 = Date.now(); tick0 = cpuTicks(pid); piek = 0; som = 0; n = 0; },
    /* Tussentijds bemonsteren: elke aanroep meet het venster sinds de vorige.
       Zo komt er ook een PIEK uit en niet alleen een gemiddelde -- een server die
       gemiddeld 40% doet maar drie keer op 400% piekt, is een ander verhaal. */
    monster() {
      if (t0 == null || tick0 == null) return null;
      const t1 = Date.now(), tick1 = cpuTicks(pid);
      if (tick1 == null || t1 <= t0) return null;
      const p = ((tick1 - tick0) / CLK) / ((t1 - t0) / 1000) * 100;
      t0 = t1; tick0 = tick1;
      if (p > piek) piek = p;
      som += p; n++;
      return p;
    },
    lees() { return n ? { gemiddeld: Number((som / n).toFixed(1)), piek: Number(piek.toFixed(1)), monsters: n } : null; }
  };
}

/* ---------- EVENT-LOOP, uit de server zelf ----------
   De meter zit in server/meting-lus.js en komt naar buiten op /api/metrics. We
   lezen hem van BUITEN, want dat is de enige manier om te zien wat de server
   zelf ervaart terwijl wij hem bestoken. Kaal draaiend en vanaf 127.0.0.1 staat
   die deur open; zit hij dicht, dan geeft dit null en dat is geen fout. */
function lusVanServer(host, port) {
  return new Promise((klaar) => {
    const req = http.request({ host, port, path: '/api/metrics', method: 'GET', timeout: 4000 }, (res) => {
      let t = '';
      res.on('data', c => { t += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return klaar(null);
        const uit = {};
        for (const soort of ['gemiddeld', 'p50', 'p99', 'max']) {
          const m = t.match(new RegExp('rtg_eventloop_vertraging_seconden\\{soort="' + soort + '"\\}\\s+([0-9.eE+-]+)'));
          if (m) uit[soort] = Number((Number(m[1]) * 1000).toFixed(2));   // seconden -> ms
        }
        klaar(Object.keys(uit).length ? uit : null);
      });
    });
    req.on('error', () => klaar(null));
    req.on('timeout', () => { req.destroy(); klaar(null); });
    req.end();
  });
}

/* ---------- DATABASE ----------
   Wat "belasting" betekent verschilt per opslag, en daarom staat het hier per
   stand en niet als een getal dat overal hetzelfde heet.

   sqlite: de bestanden op schijf, inclusief de WAL. Een WAL die tijdens de storm
   groeit en daarna niet inklapt, is precies het soort langzaam oplopende wachtrij
   waar een korte test overheen kijkt.

   postgres: het aantal verbindingen (loopt de pool vol?) en de transactie-
   tellers. Via psql, want dit script heeft geen driver -- lukt dat niet, dan
   null en geen verzinsel. */
function dbBelasting(dataDir, pgUrl) {
  const uit = { stand: pgUrl ? 'postgres' : 'sqlite' };
  try {
    let bytes = 0; const delen = {};
    for (const f of fs.readdirSync(dataDir)) {
      if (!/\.db($|-wal$|-shm$)|\.json$/.test(f)) continue;
      const st = fs.statSync(path.join(dataDir, f));
      bytes += st.size;
      delen[f] = Math.round(st.size / 1024);
    }
    uit.schijfKB = Math.round(bytes / 1024);
    uit.delenKB = delen;
  } catch (e) { uit.schijfKB = null; }

  if (pgUrl) {
    try {
      const q = "SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),"
        + "(SELECT xact_commit FROM pg_stat_database WHERE datname=current_database()),"
        + "(SELECT xact_rollback FROM pg_stat_database WHERE datname=current_database()),"
        + "(SELECT setting FROM pg_settings WHERE name='max_connections')";
      const r = execFileSync('psql', [pgUrl, '-t', '-A', '-F', '|', '-c', q], { encoding: 'utf8', timeout: 15000 }).trim().split('|');
      uit.verbindingen = Number(r[0]); uit.commits = Number(r[1]);
      uit.rollbacks = Number(r[2]); uit.maxVerbindingen = Number(r[3]);
    } catch (e) { uit.verbindingen = null; }
  }
  return uit;
}

/* ---------- HERSTEL NA DE STORM ----------
   Meet hoe lang het duurt voordat een GEWONE aanvraag weer net zo snel is als
   voor de storm. Niet "is de server nog wakker" -- dat weet je al -- maar: krijgt
   een normale gebruiker zijn oorspronkelijke snelheid terug, en hoe snel.

   De drempel is een factor op de basislijn en geen vast getal, want de basislijn
   verschilt per machine. Herstelt hij niet binnen het venster, dan komt dat er
   als hersteld:false uit en dat hoort een oordeel te zakken -- een server die
   traag blijft nadat de last weg is, heeft iets vast (een wachtrij, een lek, een
   pool die niet vrijgeeft) en dat merk je in productie pas op het slechtste
   moment.

   `meet` doet een enkele gewone aanroep en geeft { ms, status } terug. De STATUS
   hoort erbij: mijn eerste versie gaf alleen de duur en meldde bij een afwijzing
   "afgewezen" zonder meer. Toen de eerste run niet herstelde, kon ik dus niet
   zien of dat een 429 was (last afwerpen), een 503 (functie uit) of een 401 (het
   token was verlopen) -- drie totaal verschillende conclusies. Een meter die een
   probleem aanwijst maar niet welk, dwingt je tot gokken. */
async function herstelNaStorm({ meet, basisMs, factor, venesterMs, stapMs }) {
  const grens = basisMs * (factor || 2);
  const venster = venesterMs || 60000;
  const stap = stapMs || 1000;
  const begin = Date.now();
  const verloop = [];
  let hersteldNa = null;
  const statussen = new Map();
  while (Date.now() - begin < venster) {
    const { ms, status } = await meet();
    statussen.set(status, (statussen.get(status) || 0) + 1);
    verloop.push({ tSec: Math.round((Date.now() - begin) / 1000), ms, status });
    /* TWEE metingen achter elkaar onder de grens. Met een enkele zou een
       toevallig snelle aanroep midden in een trage periode al "hersteld"
       melden. */
    const n = verloop.length;
    if (n >= 2 && verloop[n - 1].ms <= grens && verloop[n - 2].ms <= grens) { hersteldNa = Date.now() - begin; break; }
    await new Promise(r => setTimeout(r, stap));
  }
  return {
    hersteld: hersteldNa != null,
    naSeconden: hersteldNa != null ? Number((hersteldNa / 1000).toFixed(1)) : null,
    grensMs: Number(grens.toFixed(1)),
    // welke antwoorden er kwamen, aflopend: dat is het verschil tussen
    // "de server werpt last af" en "de server is stuk"
    statussen: [...statussen.entries()].sort((a, b) => b[1] - a[1]),
    verloop
  };
}

module.exports = { cpuMeter, lusVanServer, dbBelasting, herstelNaStorm };
