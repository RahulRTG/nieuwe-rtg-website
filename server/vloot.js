/* ================= RTG VLOOT: elke app zijn eigen proces =================

   Start het platform als een vloot van losse processen achter de poortwachter,
   zodat een bug of crash in de ene app de andere apps NIET raakt:

     poortwachter (RTG_POORT) -> groep "leden"      auth,member,social,zakelijk
                              -> groep "partners"   supplier,staff
                              -> groep "kantoor"    office,techniek
                              -> groep "rtf"        (alleen kern + foundation)

   Elk groepsproces draait server.js met RTG_DOMAINS=<domeinen> op een eigen
   poort. Sterft er een (bug, crash, geheugenlek), dan geeft de poortwachter
   alleen voor DAT padprefix een 502 en herstart de vloot hem automatisch met
   oplopende wachttijd; de rest van het platform draait gewoon door.

   Indeling aanpassen kan met RTG_VLOOT_GROEPEN, bijv.:
     RTG_VLOOT_GROEPEN='leden:auth,member,social,zakelijk|partners:supplier,staff|kantoor:office,techniek|rtf:-'
   ('-' = geen domeinmodules: alleen de kern en de foundation-mount.)

   BELANGRIJK voor productie: losse schrijvende processen delen de data alleen
   veilig via PostgreSQL (DATABASE_URL) en de Redis-bus; zonder die twee werkt
   de vloot wel (demo/test), maar heeft elk proces zijn eigen snapshot.

   Draai: npm run vloot   (of: node server/vloot.js)                        */

const { spawn } = require('child_process');
const path = require('path');

const BASIS = Number(process.env.RTG_VLOOT_BASIS || 3010); // eerste groepspoort
const POORT = Number(process.env.RTG_POORT || 3000);       // de gateway zelf
const STANDAARD = 'leden:auth,member,social,zakelijk|partners:supplier,staff|kantoor:office,techniek|rtf:-';

// 'naam:domein1,domein2|naam2:...' -> [{ naam, domeinen, poort }]
const GROEPEN = (process.env.RTG_VLOOT_GROEPEN || STANDAARD).split('|').map((deel, i) => {
  const [naam, domeinen] = deel.split(':');
  return { naam: naam.trim(), domeinen: (domeinen || '-').trim(), poort: BASIS + i };
});

// welk domein hoort bij welke upstream-variabele van de poortwachter
const UP_VAN_DOMEIN = {
  auth: 'RTG_UP_AUTH', member: 'RTG_UP_MEMBER', social: 'RTG_UP_SOCIAL', zakelijk: 'RTG_UP_ZAKELIJK',
  supplier: 'RTG_UP_SUPPLIER', staff: 'RTG_UP_STAFF', office: 'RTG_UP_OFFICE', techniek: 'RTG_UP_TECHNIEK'
};

if (!process.env.DATABASE_URL) {
  console.warn('[vloot] LET OP: geen DATABASE_URL. Elke groep heeft dan zijn eigen data-snapshot;');
  console.warn('[vloot] prima voor demo en test, maar zet voor productie PostgreSQL en de Redis-bus aan.');
}

const kinderen = new Map(); // naam -> { child, backoffMs, gestartOp }
let stoppen = false;

function start(naam, maak) {
  const info = kinderen.get(naam) || { backoffMs: 1000 };
  info.gestartOp = Date.now();
  info.child = maak();
  kinderen.set(naam, info);
  info.child.on('exit', (code) => {
    if (stoppen) return;
    // draaide hij al even stabiel, dan begint de wachttijd opnieuw bij 1s
    if (Date.now() - info.gestartOp > 60000) info.backoffMs = 1000;
    console.warn(`[vloot] ${naam} stopte (code ${code}); herstart over ${info.backoffMs / 1000}s. De rest draait door.`);
    setTimeout(() => { if (!stoppen) start(naam, maak); }, info.backoffMs);
    info.backoffMs = Math.min(info.backoffMs * 2, 30000);
  });
}

// 1. de groepsprocessen
for (const g of GROEPEN) {
  const domeinen = g.domeinen === '-' ? '-' : g.domeinen; // '-' = alleen kern+foundation
  start('groep ' + g.naam, () => {
    console.log(`[vloot] groep ${g.naam} (${domeinen === '-' ? 'kern+foundation' : domeinen}) op poort ${g.poort}`);
    return spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: String(g.poort), RTG_DOMAINS: domeinen },
      stdio: ['ignore', 'inherit', 'inherit']
    });
  });
}

// 2. de poortwachter, met per domein de upstream van zijn groep
const upstreams = {};
for (const g of GROEPEN) {
  const url = 'http://127.0.0.1:' + g.poort;
  if (g.domeinen === '-') { upstreams.RTG_UP_FOUNDATION = url; continue; }
  for (const d of g.domeinen.split(',')) {
    const env = UP_VAN_DOMEIN[d.trim()];
    if (env) upstreams[env] = url;
  }
}
upstreams.RTG_UP_DEFAULT = 'http://127.0.0.1:' + GROEPEN[0].poort; // statisch + restpaden
start('poortwachter', () => spawn(process.execPath, [path.join(__dirname, 'poort.js')], {
  env: { ...process.env, RTG_POORT: String(POORT), ...upstreams },
  stdio: ['ignore', 'inherit', 'inherit']
}));

console.log(`[vloot] ${GROEPEN.length} groepen + poortwachter; buitenwereld op http://localhost:${POORT}`);

function stop() {
  stoppen = true;
  for (const { child } of kinderen.values()) { try { child.kill('SIGTERM'); } catch (e) {} }
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
