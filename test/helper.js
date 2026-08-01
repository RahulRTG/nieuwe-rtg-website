/* Gedeeld testgereedschap: start een echte server op een GEGARANDEERD vrije
   poort en wacht robuust tot hij gezond is. Zo botsen parallelle of snel
   opeenvolgende tests niet meer op dezelfde poort (de oude oorzaak van
   sporadische "fetch failed"), en kan de suite weer met concurrency draaien. */
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

// Een vrije poort van het besturingssysteem: bind op 0, lees de toegewezen
// poort, laat hem meteen weer los en geef hem door aan de kindserver.
function vrijePoort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

/* Start server/server.js (of een ander script) en wacht tot hij gezond is.
   Geeft { child, base, port } terug. Gooit als de server niet gezond wordt.

   Belangrijk: tussen het vrijgeven van de poort en het binden door de kindserver
   zit een gaatje waarin een parallelle test dezelfde poort kan krijgen. Dan
   antwoordt op onze poort de server van een ANDERE test (met andere env!) en
   crasht ons eigen kind op EADDRINUSE. Daarom checken we via /api/health dat de
   pid van de antwoordende server echt ons kind is, en proberen we bij een
   verloren poort gewoon opnieuw op een verse poort. */
async function startServer(opts = {}) {
  let laatste;
  for (let poging = 0; poging < 3; poging++) {
    try { return await startEens(opts); }
    catch (e) {
      laatste = e;
      if (!/stopte tijdens opstarten/.test(e.message)) throw e; // echte startfout: niet maskeren
    }
  }
  throw laatste;
}

/* Strenge poort: een geslaagde test mag de server nooit een echte fout laten
   loggen -- een uncaughtException, een niet-opgevangen belofte (unhandledRejection),
   of een onverwachte 5xx uit een route (een geworpen fout -> 500). Die glippen
   anders stil door, want de test checkt alleen zijn eigen verzoeken. We lezen de
   stderr van elke kind-server mee, tonen hem gewoon, en onthouden zulke regels.
   Aan het eind van de testrun faalt het proces (exit 1) als er ook maar één is
   geweest. Client-invoerfouten (400/413 via de express error-middleware) tellen
   NIET mee -- die markeert de server niet als serverfout -- zodat normale negatieve
   tests gewoon blijven werken. */
const serverUitzonderingen = [];
const FATAAL = /"bron":"(uncaughtException|unhandledRejection)"|"serverfout":true/;
let poortGewapend = false;
function wapenStrengePoort() {
  if (poortGewapend) return;
  poortGewapend = true;
  process.on('exit', () => {
    if (!serverUitzonderingen.length) return;
    process.stderr.write('\n[31mSTRENGE POORT: ' + serverUitzonderingen.length +
      ' server-uitzondering(en) tijdens de tests (uncaught/unhandled). De run faalt.[0m\n');
    for (const r of serverUitzonderingen.slice(0, 10)) process.stderr.write('  - ' + r + '\n');
    if (!process.exitCode) process.exitCode = 1;
  });
}
function luisterOpFouten(child) {
  wapenStrengePoort();
  let rest = '';
  child.stderr.on('data', (buf) => {
    process.stderr.write(buf); // gewoon tonen, net als 'inherit'
    rest += buf.toString();
    const regels = rest.split('\n'); rest = regels.pop();
    for (const regel of regels) if (FATAAL.test(regel)) serverUitzonderingen.push(regel.trim().slice(0, 300));
  });
}

async function startEens(opts) {
  const script = opts.script || path.join(__dirname, '..', 'server', 'server.js');
  // Standaard wachten op /api/ready, niet alleen /api/health: sinds de
  // opslag-poortwachter geeft de server 503 op alle API's tot de opslag echt
  // geladen is (belangrijk in Postgres-modus), en een test die meteen na
  // "gezond" een API aanroept zou daarop stranden.
  const wachtPad = opts.wachtPad || '/api/ready';
  /* HOE LANG WACHTEN WE, EN WAT ZEGGEN WE ALS HET NIET LUKT.

     Deze grens is al twee keer opgehoogd (15s -> 25s) en werd allebei de keren
     opgehoogd om dezelfde reden: onder volle belasting boot een server trager
     dan de teller toestond. Dat is geen defect maar drukte, en toch stond er dan
     "server werd niet gezond" -- een zin die leest als "de server is stuk". Die
     ene zin heeft in deze codebase inmiddels meer dan een uur zoekwerk gekost
     naar een fout die er niet was.

     Twee dingen zijn daarom veranderd. Het geduld schaalt nu mee met de
     belasting van de machine: op een rustige machine blijft het 25 seconden, op
     een machine die al vol staat wordt het ruimer. En als het dan alsnog niet
     lukt, ZEGT de fout wat er aan de hand was -- leefde het kindproces nog, hoe
     lang is er gewacht, en hoe zwaar stond de machine. Een levend kind plus een
     hoge belasting is drukte; een gestopt kind is een echt defect. Dat verschil
     hoort in de melding te staan en niet in het hoofd van wie hem leest. */
  const kernen = Math.max(1, os.cpus().length);
  const druk = os.loadavg()[0] / kernen;                       // 1 = precies vol
  const extra = Math.min(4, Math.max(1, Math.round(druk)));    // hooguit vier keer zo geduldig
  const pogingen = opts.pogingen || 250 * extra;
  const gestart = Date.now();
  const port = await vrijePoort();
  const base = 'http://127.0.0.1:' + port;
  // Zonder eigen stderr-optie vangen we de stderr op (pipe) om de strenge poort te
  // voeden; met een expliciete optie (een test die stderr zelf inspecteert) blijft
  // het gedrag ongewijzigd.
  const eigenStderr = opts.stderr && opts.stderr !== 'inherit';
  const child = spawn(process.execPath, ['--experimental-sqlite', script], {
    env: { ...process.env, NODE_ENV: 'test', ...(opts.env || {}), PORT: String(port) },
    stdio: ['ignore', 'ignore', eigenStderr ? opts.stderr : 'pipe']
  });
  if (!eigenStderr) luisterOpFouten(child);
  for (let i = 0; i < pogingen; i++) {
    if (child.exitCode != null) throw new Error('server stopte tijdens opstarten (exit ' + child.exitCode + ')');
    try {
      const r = await fetch(base + '/api/health', { headers: { 'X-Forwarded-Proto': 'https' } });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (d.pid === child.pid) {
          // echt onze server; eventueel nog even wachten op het gevraagde pad
          if (wachtPad !== '/api/health') {
            for (let j = 0; j < 50; j++) {
              const w = await fetch(base + wachtPad, { headers: { 'X-Forwarded-Proto': 'https' } }).catch(() => null);
              if (w && w.ok) break;
              await new Promise(r2 => setTimeout(r2, 100));
            }
          }
          return { child, base, port };
        }
        // een vreemde server op onze poort: ons kind gaat zo op EADDRINUSE af,
        // de exitCode-check hierboven vangt dat en we beginnen op een verse poort
      }
    } catch (e) { /* nog niet op; opnieuw proberen */ }
    await new Promise(r => setTimeout(r, 100));
  }
  const leefde = child.exitCode == null;
  const seconden = Math.round((Date.now() - gestart) / 1000);
  const nu1 = (os.loadavg()[0] / kernen).toFixed(1);
  try { child.kill('SIGKILL'); } catch (e) {}
  throw new Error('server werd niet gezond op ' + base
    + ' na ' + seconden + 's; het kindproces ' + (leefde ? 'LEEFDE nog' : 'was al gestopt')
    + ', belasting ' + nu1 + 'x de kernen'
    + (leefde && Number(nu1) > 1
      ? ' -- dit ziet eruit als DRUKTE, niet als een defect: draai deze toets los om het te bevestigen.'
      : ''));
}

function stop(child) { if (child) try { child.kill('SIGKILL'); } catch (e) {} }

/* Een NETTE stop: SIGTERM, en wachten tot het proces echt weg is.

   Het verschil met stop() is geen detail. SIGKILL is een stroomstoring: de
   server krijgt geen kans zijn write-behind te spoelen. SIGTERM is een DEPLOY:
   hij hoort zijn laatste staat weg te schrijven voordat hij afsluit. Wie het
   verschil niet maakt, toetst met een stroomstoring een garantie die alleen
   over herstarts gaat -- of andersom, en dan slaagt de toets om de verkeerde
   reden.

   Wacht ten hoogste `ms` en pakt daarna alsnog door met SIGKILL, zodat een
   hangende afsluiting de suite niet laat staan. */
function stopNet(child, ms) {
  return new Promise(resolve => {
    if (!child || child.exitCode != null) return resolve();
    let klaar = false;
    const af = () => { if (!klaar) { klaar = true; resolve(); } };
    child.on('exit', af);
    try { child.kill('SIGTERM'); } catch (e) { return af(); }
    setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) {} af(); }, ms || 15000).unref();
  });
}

/* Een lid optillen naar Lifestyle/Business langs de ENIGE geldige weg: zelf
   registreren geeft altijd hooguit RTG, dus dienen we met het ledentoken een
   aanvraag in (dat koppelt het account) en laten RTG-personeel die accepteren.
   `approverToken` is een office- of eigenaars-token (beide komen door officeAuth).
   Handig voor tests die een echt Business/Lifestyle-lid nodig hebben. */
async function elevateTier(base, memberToken, pas, approverToken) {
  const post = (pad, body, tok) => fetch(base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(r => r.json());
  const aanvraag = await post('/api/aanmelding/aanvraag', { pas, naam: 'Test ' + pas, contact: pas + '@test.example' }, memberToken);
  const id = aanvraag.aanmelding && aanvraag.aanmelding.id;
  if (!id) throw new Error('elevateTier: aanvraag mislukt (' + JSON.stringify(aanvraag).slice(0, 120) + ')');
  const besluit = await post('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' }, approverToken);
  if (!besluit.aanmelding || besluit.aanmelding.status !== 'geaccepteerd')
    throw new Error('elevateTier: beslis mislukt (' + JSON.stringify(besluit).slice(0, 120) + ')');
  return besluit;
}

/* Paginafouten verzamelen, zonder de ruis van de browser zelf.

   De site zet zachte overgangen tussen pagina's aan met @view-transition in
   shared/rtg-uniform.css. Die overgang maakt de BROWSER; wij krijgen hem pas
   te zien in het pagereveal-event, en dat vuurt voordat ons eerste script
   draait. Slaat de browser zo'n overgang over -- een tweede navigatie er
   meteen achteraan, of een tabblad dat niet zichtbaar is -- dan verwerpt de
   ready-promise van die overgang met "Transition was skipped". Niemand van
   ons heeft die promise gemaakt, dus niemand kan hem opvangen, en Playwright
   meldt hem als paginafout.

   Het is geen fout. De navigatie is gewoon gebeurd; alleen de animatie viel
   weg. Het is bovendien een race: welke test erop struikelt verschilt per
   run. Hem meetellen als "JS-fout op de pagina" maakt de tests onbetrouwbaar
   zonder ook maar iets te bewaken. Alles wat WEL uit onze code komt telt
   onverkort mee -- dit filter noemt precies een bericht, geen patroon. */
const BROWSERRUIS = ['Transition was skipped'];
function letOpFouten(page, bak) {
  page.on('pageerror', (e) => {
    const bericht = String((e && e.message) || e);
    if (!BROWSERRUIS.includes(bericht)) bak.push(bericht);
  });
  return bak;
}

module.exports = { vrijePoort, startServer, stop, stopNet, elevateTier, letOpFouten,
  // testhaken om de strenge poort zelf te kunnen verifiëren
  _poort: { luisterOpFouten, serverUitzonderingen, isFataal: (r) => FATAAL.test(r) } };
