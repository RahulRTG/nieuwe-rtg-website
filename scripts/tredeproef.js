#!/usr/bin/env node
/* ============================================================================
   DE TREDEPROEF -- kan een trede zelfstandig bestaan?

   WAAROM DIT ER IS

   Stap 7 van de keten. LAUNCH.md zet de livegang als trap: zeven treden, elk
   een klik, en die treden staan machineleesbaar in server/functies/register
   (FASES) met drie eigen controles erop. Wat er niet stond is de PROEF: zet
   trede 0 aan, de rest uit, en kijk of er dan werkelijk niets anders openstaat.

   Dat is een andere vraag dan die van de schakelkast. De kast zegt wat er
   volgens de configuratie uit staat; deze proef vraagt of dat ook zo is.

   TWEE UITSLAGEN, EN ZE WORDEN NOOIT OPGETELD

     ZUIVER      over ALLE routes, zonder een verzoek te sturen: zegt de
                 schakelkast nee voor elk pad buiten de trede? Dat is de
                 beslissing zelf (functies.padGeblokkeerd), compleet en in
                 milliseconden.
     BEPROEFD    een steekproef die ECHT aanklopt over HTTP en 503 moet
                 terugkrijgen. Dat is de bedrading: staat de poort werkelijk op
                 dit pad, of wordt de beslissing wel genomen en niet gebruikt?

   De eerste kan compleet zijn en bewijst de bedrading niet; de tweede bewijst
   de bedrading en kan niet compleet zijn (4748 routes echt aankloppen kost tijd
   en heeft bijwerkingen). Wie ze optelt tot een percentage, krijgt een getal dat
   geen van beide vragen beantwoordt.

   DE DERDE UITSLAG: DE RONDGANG

   Zuiver en beproefd bewijzen allebei dat er niets ANDERS opengaat. Ze zeggen
   niets over de vraag of de trede zelf WERKT -- en een trede waarop niemand kan
   inloggen scoort op die twee vlekkeloos. Daarom loopt de proef ook een echte
   ingelogde reis langs wat trede 0 belooft: binnenkomen, je gegevens beheren,
   je aanmelden voor een pas, de leden-app en De Salon.

   De stappen zijn niet verzonnen maar per stuk GEKOPPELD aan de functie van de
   trede die zij beproeven, en test/tredeproef.test.js zakt zodra een stap een
   functie noemt die niet in trede 0 zit. Een rondgang die iets beproeft wat de
   trede niet belooft, meet de verkeerde trede.

   Wat de rondgang nog steeds NIET doet: bestellen, betalen en een bevestiging.
   Die horen bij hogere treden en vragen een zaak, een kassa en een betaalrail.

   En hij ziet alleen wat over HTTP binnenkomt. Een cron, de bus of een
   AI-gereedschap kan werk beginnen zonder ooit langs een route te komen; die
   kant is stap 6 en met deze proef niet te halen.

   ALLE TREDEN ACHTER ELKAAR (--alle) draait deze proef per trede in een EIGEN
   PROCES. Dat is geen omslachtigheid: de app wordt een keer geladen en houdt
   dan zijn routers, zijn poort en zijn modulecache vast; een tweede trede in
   hetzelfde proces zou de stand van de eerste meedragen en dus meten wat er
   niet staat.

   Draai: npm run tredeproef              (trede 0)
          npm run tredeproef -- --trede bestellen
          npm run tredeproef -- --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };

/* DE UITSLAG VAN EEN KIND GAAT NIET DOOR DE PIJP MAAR NAAR EEN BESTAND (--uit).

   Twee pogingen gingen hier mis en allebei op dezelfde aanname: dat stdout van
   ons is. Eerst mengden de opstartregels van de app door de JSON ("Unexpected
   token 'R'"); daarna, met de console de hele rit gesmoord, deed de LOGGER het
   opnieuw -- die schrijft rechtstreeks naar process.stdout en trekt zich van
   console niets aan.

   Een uitslag naar een eigen bestand kan door geen enkele meelezer worden
   vervuild. Dat is ook waarom de smoring hieronder blijft staan maar niet meer
   het mechanisme IS: zij maakt de uitvoer rustig, het bestand maakt hem juist. */
const JSONUIT = process.argv.includes('--json') || process.argv.includes('--uit');

/* WAT VOOR DE SCHAKELAAR HANGT, EN WAAROM.

   De eerste ronde van deze proef vond er een: POST /api/betaal/webhook gaf 200
   terwijl de functie `betalen` uit stond. De zuivere kant zei dat hij dicht
   hoorde te zijn; de bedrading deed het niet. Dat is precies het verschil
   waarvoor die twee uitslagen apart staan.

   De oorzaak is structureel en geen bug: server/opzet/verzoekketen.js hangt de
   webhooks op als stap 8 (VOOR express.json(), want een handtekening wordt over
   de RAUWE body berekend), en de functieschakelaars komen pas daarna. Een
   webhook komt dus nooit langs de kast.

   Of dat MAG is een andere vraag dan of het zo IS, en deze proef beantwoordt
   alleen de tweede. server/opzet/webhooks.js schrijft over dezelfde afweging bij
   de hoofdzekering: "die zet het platform uit; een webhook vertelt ons over iets
   dat AL is gebeurd". Dezelfde redenering past hier, en betalen heeft bovendien
   zijn EIGEN stop die wel vóór de body-parser hangt (./betaalstop, RTG_BETALEN_UIT).

   Ze staan hier dus met naam en reden, en niet weggelaten: een uitzondering die
   je niet ziet, is een lek. Wat er niet op staat en toch antwoordt, laat de
   proef zakken. */
const VOOR_DE_SCHAKELAAR = [
  ['POST /api/betaal/webhook',
   'hangt in verzoekketen stap 8, voor express.json() en dus voor de schakelkast; betalen heeft een eigen stop (RTG_BETALEN_UIT) die daar wel voor hangt'],
  ['POST /api/betaal/webhook/mollie', 'zelfde reden als /api/betaal/webhook'],
  ['POST /api/munt/webhook', 'zelfde reden: rauwe body, handtekening, en de munt-aanbieder meldt iets dat al gebeurd is']
];
const isVoorDeSchakelaar = r => VOOR_DE_SCHAKELAAR.some(x => x[0] === r);

/* DE RONDGANG VAN TREDE 0, stap voor stap, met per stap de functie die hij
   beproeft. `wat` is wat een mens doet, niet wat de route heet -- als die twee
   uit elkaar lopen, beproeft de rondgang iets anders dan de belofte.

   De inlog gebruikt dezelfde weg als scripts/lib/proefsleutels.js
   (POST /api/login {tier}), zodat er geen tweede manier ontstaat om aan een
   sessie te komen. */
const RONDGANG = [
  { wat: 'binnenkomen', route: 'POST /api/login', functie: 'tg-inlog', lijf: { tier: 'rtg' }, levertToken: true },
  /* HIER STOND /api/ik, EN DAT WAS EEN VERKEERD GEKOZEN STAP. Die route eist een
     EIGEN ACCOUNT (`uid(req) == null` -> 403), en de korte inlog geeft een
     pas-sessie zonder account -- inlog-pas.js zegt dat in zijn eerste zin. De
     403 was dus juist, en de rondgang meldde een gebrek dat er niet was.
     /api/state hoort bij dezelfde functie (kern-state) en is wat een
     pas-sessie werkelijk opvraagt. Wat een eigen account eist, dekt deze
     rondgang niet; dat staat in de uitslag. */
  { wat: 'zien wat ik mag', route: 'POST /api/state', functie: 'kern-state' },
  { wat: 'mijn gegevens beheren', route: 'POST /api/gegevens/nodig', functie: 'tg-gegevens' },
  { wat: 'me aanmelden voor een pas', route: 'POST /api/aanmeld/start', functie: 'tg-aanmeld' },
  { wat: 'de leden-app openen', route: 'POST /api/member/apps', functie: 'member' },
  { wat: 'De Salon lezen', route: 'POST /api/salon/feed', functie: 'salon' }
];

/* Hoeveel routes er ECHT worden aangeklopt, per soort. Een steekproef en geen
   volledigheid: zie de kop. Het getal staat hier zodat het in de uitslag mee
   kan, want een steekproef zonder omvang is een anekdote. */
const STEEKPROEF = Number(process.env.RTG_TREDEPROEF_N || 60);

/* ------------------------------------------------------------- de indeling -- */

/* Puur: verdeelt de routes over de drie soorten die deze proef kent. Los
   getoetst, want dit is waar een fout stil zou blijven -- een route die in de
   verkeerde bak valt, wordt nooit beproefd. */
function indeling({ routes, functieVoorPad, aan }) {
  const inTrede = [], buiten = [], zonderFunctie = [];
  for (const r of routes) {
    const f = functieVoorPad(r.pad);
    if (!f) { zonderFunctie.push(r); continue; }
    (aan.has(f.id) ? inTrede : buiten).push({ ...r, functie: f.id });
  }
  return { inTrede, buiten, zonderFunctie };
}

/* Een gespreide steekproef: niet de eerste N (dan komt alles uit hetzelfde
   domein, want de routelijst is op pad gesorteerd) maar gelijkmatig over de
   lijst. */
function steekproef(lijst, n) {
  if (lijst.length <= n) return lijst.slice();
  const stap = lijst.length / n;
  const uit = [];
  for (let i = 0; i < n; i++) uit.push(lijst[Math.floor(i * stap)]);
  return uit;
}

/* --------------------------------------------------------------- de proef -- */

async function meet(tredeId) {
  const poort = vrijePoort();
  process.env.PORT = String(poort);
  process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tredeproef-'));
  process.env.SMTP_URL = '';
  process.env.STUN_UIT = '1';
  /* RTG_DEMO=1 IS HIER GEEN VERSOEPELING MAAR DEKKING, en die afweging staat al
     uitgeschreven in scripts/lib/proefserver.js: zonder die vlag bestaat de
     korte inlog (`POST /api/login {tier}`) niet en geeft de eerste stap van de
     rondgang 403 -- waarna alle stappen erna 401 geven en de proef vijf keer
     "zakt" meldt over iets dat helemaal niet stuk is.

     Wat de vlag NIET doet is een deur openzetten: elke poort blijft staan, en de
     schakelkast helemaal -- die is juist wat hier gemeten wordt. De zuivere en
     beproefde kant veranderen er dan ook niet van. Hij staat in de uitslag
     (`demoModus`), zodat niemand deze proef voor een productiemeting aanziet. */
  process.env.RTG_DEMO = '1';
  /* En NODE_ENV=test erbij, want testomgeving.actief() eist ALLEBEI (r.17):
     RTG_DEMO alleen doet niets, en dat kostte een ronde waarin de proef vijf
     zakkende stappen meldde over iets dat niet stuk was. Zelfde paar als in
     scripts/lib/proefserver.js r.32-33. */
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.ANTHROPIC_API_KEY = '';

  const functies = require(path.join(WORTEL, 'server', 'functies'));
  const trede = functies.FASES.find(f => f.id === tredeId);
  if (!trede) throw new Error('onbekende trede: ' + tredeId + ' (' + functies.FASES.map(f => f.id).join(', ') + ')');
  /* Trede 6 zet alles open; `aan: null` betekent daar de hele catalogus. */
  const aan = new Set(trede.aan || functies.FUNCTIES.map(f => f.id));

  const echt = { log: console.log, warn: console.warn, info: console.info };
  console.log = console.warn = console.info = () => {};
  let app, db;
  try {
    app = require(path.join(WORTEL, 'server', 'server')).app;
    db = require(path.join(WORTEL, 'server', 'db'));
  } finally { if (!JSONUIT) Object.assign(console, echt); }

  /* DE STAND ZETTEN ZOALS DE BOARDROOM HEM ZET, en niet met een eigen vlag: als
     deze proef zijn eigen weg neemt om iets uit te zetten, bewijst hij niets
     over de weg die de eigenaar gebruikt. */
  db.db.data.techniek = db.db.data.techniek || {};
  const stand = {};
  for (const f of functies.FUNCTIES) if (!aan.has(f.id)) stand[f.id] = { aan: false };
  db.db.data.techniek.functies = stand;
  db.save();

  /* ONTDUBBELEN OP METHODE+PAD. app._routes() geeft LAGEN terug: elke bewaker
     voor een route is een eigen regel. Zonder deze stap meldde de proef 9167
     routes waar het er 4748 zijn, en dan telt een zwaar bewaakte route zwaarder
     mee dan een onbewaakte -- precies omgekeerd. */
  const gezien = new Set();
  const routes = app._routes().filter(r => {
    if (!r.pad || !r.pad.startsWith('/api/')) return false;
    const s = (r.methode || 'ALL') + ' ' + r.pad;
    if (gezien.has(s)) return false;
    gezien.add(s);
    return true;
  });
  const d = indeling({ routes, functieVoorPad: functies.functieVoorPad, aan });

  /* ---- ZUIVER: de beslissing zelf, over alles ---- */
  const lek = [];
  for (const r of d.buiten) {
    if (!functies.padGeblokkeerd(r.pad, stand, {})) lek.push(r.methode + ' ' + r.pad + '  [' + r.functie + ']');
  }
  const dichtInTrede = [];
  for (const r of d.inTrede) {
    if (functies.padGeblokkeerd(r.pad, stand, {})) dichtInTrede.push(r.methode + ' ' + r.pad + '  [' + r.functie + ']');
  }

  /* ---- BEPROEFD: echt aankloppen ---- */
  const geraakt = new Set();
  const routing = require(path.join(WORTEL, 'server', 'web', 'routing.js'));
  if (typeof routing.opPatroon === 'function') routing.opPatroon((m, p) => geraakt.add(m + ' ' + p));

  const klop = async (r) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2000);
    try {
      const res = await fetch('http://127.0.0.1:' + poort + r.pad.replace(/:[A-Za-z0-9_]+/g, '1'),
        { method: r.methode === 'ALL' ? 'GET' : r.methode, signal: ac.signal,
          headers: { 'content-type': 'application/json' },
          body: ['GET', 'HEAD'].includes(r.methode) ? undefined : '{}' });
      return res.status;
    } catch (e) { return null; }
    finally { clearTimeout(t); }
  };

  const buitenProef = [], binnenProef = [];
  for (const r of steekproef(d.buiten, STEEKPROEF)) {
    const status = await klop(r);
    buitenProef.push({ route: r.methode + ' ' + r.pad, functie: r.functie, status });
  }
  for (const r of steekproef(d.inTrede, Math.round(STEEKPROEF / 2))) {
    const status = await klop(r);
    binnenProef.push({ route: r.methode + ' ' + r.pad, functie: r.functie, status });
  }

  /* ---- DE RONDGANG: werkt de trede zelf? ---- */
  let token = null;
  const rondgang = [];
  for (const stap of RONDGANG) {
    const [methode, pad] = stap.route.split(' ');
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    let status = null, data = null;
    try {
      const res = await fetch('http://127.0.0.1:' + poort + pad, {
        method: methode, signal: ac.signal,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(stap.lijf || {})
      });
      status = res.status;
      try { data = await res.json(); } catch (e) { data = null; }
    } catch (e) { status = null; }
    finally { clearTimeout(t); }
    if (stap.levertToken && data && (data.token || (data.sessie && data.sessie.token))) {
      token = data.token || data.sessie.token;
    }
    /* GESLAAGD IS STRENG: onder de 400. Een 401 op een stap die na de inlog komt
       betekent dat de sessie niet werkt, en dat is precies wat deze rondgang
       hoort te vangen -- niet iets om als "de route bestaat" weg te schrijven. */
    rondgang.push({ ...stap, status, geslaagd: status !== null && status < 400 });
  }

  /* Een route buiten de trede hoort 503 te geven. Een ANDER antwoord is de
     bevinding -- ook een 404 of een 401: dan is de poort niet gepasseerd maar
     omzeild, en dat wil je weten. Een null (tijd om, verbinding weg) is geen
     bewijs van iets en telt apart. */
  const buitenNiet503 = buitenProef.filter(x => x.status !== 503 && x.status !== null && !isVoorDeSchakelaar(x.route));
  const buitenVerklaard = buitenProef.filter(x => x.status !== 503 && x.status !== null && isVoorDeSchakelaar(x.route));
  const buitenGeenAntwoord = buitenProef.filter(x => x.status === null);
  const binnen503 = binnenProef.filter(x => x.status === 503);

  return {
    gemetenOp: new Date().toISOString().slice(0, 10),
    trede: trede.id, tredeNaam: trede.naam,
    demoModus: true,
    demoWaarom: 'RTG_DEMO=1 geeft de korte inlog waarmee de rondgang een sessie krijgt (zie scripts/lib/proefserver.js); geen enkele poort gaat erdoor open, en de schakelkast al helemaal niet',
    functiesAan: aan.size, functiesTotaal: functies.FUNCTIES.length,
    routes: routes.length,
    routesInTrede: d.inTrede.length,
    routesBuitenTrede: d.buiten.length,
    routesZonderFunctie: d.zonderFunctie.length,
    zuiverLekken: lek.length, zuiverLekLijst: lek.slice(0, 40),
    zuiverDichtInTrede: dichtInTrede.length, zuiverDichtLijst: dichtInTrede.slice(0, 40),
    steekproefBuiten: buitenProef.length,
    beproefdNiet503: buitenNiet503.length,
    beproefdNiet503Lijst: buitenNiet503.slice(0, 20),
    beproefdGeenAntwoord: buitenGeenAntwoord.length,
    beproefdVoorDeSchakelaar: buitenVerklaard.length,
    beproefdVoorDeSchakelaarLijst: buitenVerklaard.map(x => x.route + ' (' + x.status + ')'),
    voorDeSchakelaar: VOOR_DE_SCHAKELAAR.map(([r, reden]) => ({ route: r, reden })),
    steekproefBinnen: binnenProef.length,
    beproefdBinnen503: binnen503.length, beproefdBinnen503Lijst: binnen503.slice(0, 20),
    rondgangStappen: rondgang.length,
    rondgangGezakt: rondgang.filter(r => !r.geslaagd).length,
    rondgangLijst: rondgang.map(r => ({ wat: r.wat, route: r.route, functie: r.functie, status: r.status, geslaagd: r.geslaagd })),
    rondgangKreegSessie: !!token,
    routesGeraakt: geraakt.size,
    rondgangDektNiet: 'alles wat een EIGEN ACCOUNT eist. De korte inlog geeft een pas-sessie zonder account, dus routes als /api/ik weigeren terecht met 403 -- die zijn met deze rondgang niet te beproeven.',
    watDitNietDoet: 'de rondgang loopt niet door bestellen, betalen en een bevestiging -- die horen bij hogere treden en vragen een zaak, een kassa en een betaalrail. En alles hier is HTTP: cron, bus en AI-gereedschap komen er niet langs.'
  };
}

function vrijePoort() {
  const uit = require('child_process').execFileSync(process.execPath, ['-e',
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{" +
    "process.stdout.write(String(s.address().port));s.close();});"], { encoding: 'utf8', timeout: 10000 });
  const n = Number(String(uit).trim());
  if (!(n > 1024 && n < 65536)) throw new Error('geen vrije poort gekregen');
  return n;
}

/* ---------------------------------------------------------------- rapport -- */

function rapport(r) {
  const L = [];
  L.push('DE TREDEPROEF -- ' + r.tredeNaam + ' (' + r.gemetenOp + ')');
  L.push('');
  L.push(`  ${r.functiesAan} van de ${r.functiesTotaal} functies staan aan.`);
  L.push(`  ${r.routes} API-routes: ${r.routesInTrede} in de trede, ${r.routesBuitenTrede} erbuiten, ` +
    `${r.routesZonderFunctie} zonder functie (de bediening).`);
  L.push('');
  L.push('  ZUIVER -- de beslissing zelf, over ALLE routes');
  L.push(`    ${r.zuiverLekken} routes buiten de trede die de schakelkast NIET dichtzet.` +
    (r.zuiverLekken ? '  <-- dit hoort nul te zijn' : ''));
  for (const x of r.zuiverLekLijst.slice(0, 10)) L.push('      ' + x);
  L.push(`    ${r.zuiverDichtInTrede} routes IN de trede die toch dicht staan.` +
    (r.zuiverDichtInTrede ? '  <-- de trede werkt dan niet' : ''));
  for (const x of r.zuiverDichtLijst.slice(0, 10)) L.push('      ' + x);
  L.push('');
  L.push('  BEPROEFD -- werkelijk aangeklopt over HTTP (steekproef)');
  L.push(`    ${r.steekproefBuiten} routes buiten de trede aangeklopt: ${r.beproefdNiet503} gaven iets anders dan 503` +
    `, ${r.beproefdGeenAntwoord} gaven geen antwoord.`);
  if (r.beproefdVoorDeSchakelaar) {
    L.push(`    ${r.beproefdVoorDeSchakelaar} daarvan hangt VOOR de schakelkast en is als zodanig verklaard:`);
    for (const x of r.beproefdVoorDeSchakelaarLijst) L.push('      ' + x);
    L.push('      (de reden per route staat in de uitslag onder voorDeSchakelaar)');
  }
  for (const x of r.beproefdNiet503Lijst.slice(0, 10)) L.push(`      ${x.status}  ${x.route}  [${x.functie}]`);
  L.push(`    ${r.steekproefBinnen} routes binnen de trede aangeklopt: ${r.beproefdBinnen503} kregen 503 (hoort nul te zijn).`);
  for (const x of r.beproefdBinnen503Lijst.slice(0, 10)) L.push(`      ${x.route}  [${x.functie}]`);
  L.push('');
  L.push('  DE RONDGANG -- werkt de trede zelf?');
  for (const st of r.rondgangLijst)
    L.push(`    ${st.geslaagd ? 'ok  ' : 'ZAKT'}  ${String(st.status).padStart(3)}  ${st.wat.padEnd(28)} ${st.route}  [${st.functie}]`);
  L.push('    (dekt niet: ' + r.rondgangDektNiet.split('.')[0].toLowerCase() + ')');
  L.push(`    ${r.rondgangGezakt} van de ${r.rondgangStappen} stappen zakt` +
    (r.rondgangKreegSessie ? '' : '  <-- en er kwam geen sessie tot stand, dus alles erna zegt niets'));
  L.push('');
  L.push(`  ${r.routesGeraakt} verschillende routes zijn tijdens de proef werkelijk aangeraakt.`);
  L.push('');
  L.push('  WAT DEZE PROEF NIET DOET: ' + r.watDitNietDoet);
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

/* ---------------------------------------------------------- alle treden -- */

/* Per trede een eigen proces; zie de kop waarom. De uitslag van trede 0 blijft
   de hoofduitslag (daar hangt de meter aan); de rest komt eronder te staan. */
function alleTreden() {
  const cp = require('child_process');
  const { FASES } = require(path.join(WORTEL, 'server', 'functies', 'register'));
  const uit = [];
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-treden-'));
  try {
    for (const f of FASES) {
      const doel = path.join(map, f.id + '.json');
      cp.execFileSync(process.execPath, [__filename, '--trede', f.id, '--uit', doel],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: 'ignore',
          env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } });
      uit.push(JSON.parse(fs.readFileSync(doel, 'utf8')));
    }
  } finally { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }
  return uit;
}

function tabel(treden) {
  const L = [];
  L.push('ALLE TREDEN -- wat staat er open, en lekt er iets');
  L.push('');
  L.push('  trede                              functies   routes open   dicht   zuiver   beproefd  rondgang');
  for (const t of treden) {
    L.push('    ' + t.tredeNaam.padEnd(32) +
      String(t.functiesAan + '/' + t.functiesTotaal).padStart(9) +
      String(t.routesInTrede).padStart(13) +
      String(t.routesBuitenTrede).padStart(8) +
      String(t.zuiverLekken).padStart(9) +
      String(t.beproefdNiet503).padStart(11) +
      String(t.rondgangGezakt).padStart(10));
  }
  L.push('');
  L.push('  zuiver = routes buiten de trede die de schakelkast niet dichtzet (alle routes).');
  L.push('  beproefd = daarvan werkelijk aangeklopt en toch een ander antwoord dan 503');
  L.push('  (steekproef; wat voor de schakelaar hangt staat apart en verklaard).');
  return L.join('\n');
}

if (require.main === module && process.argv.includes('--alle')) {
  const treden = alleTreden();
  const hoofd = treden.find(t => t.trede === 'start') || treden[0];
  const uit = { ...hoofd, treden: treden.map(t => ({
    trede: t.trede, naam: t.tredeNaam, functiesAan: t.functiesAan,
    routesInTrede: t.routesInTrede, routesBuitenTrede: t.routesBuitenTrede,
    zuiverLekken: t.zuiverLekken, beproefdNiet503: t.beproefdNiet503,
    rondgangGezakt: t.rondgangGezakt,
    beproefdVoorDeSchakelaar: t.beproefdVoorDeSchakelaar })) };
  fs.writeFileSync(path.join(WORTEL, 'TREDEPROEF.json'), JSON.stringify(uit, null, 2) + '\n');
  process.stdout.write(rapport(hoofd) + '\n\n' + tabel(treden) + '\n\nVastgelegd in TREDEPROEF.json\n');
  process.exit(treden.some(t => t.zuiverLekken || t.beproefdNiet503 || t.rondgangGezakt) ? 1 : 0);
} else if (require.main === module) {
  meet(arg('--trede', 'start')).then(r => {
    const uitPad = arg('--uit', null);
    if (uitPad) fs.writeFileSync(uitPad, JSON.stringify(r, null, 2) + '\n');
    else if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(path.join(WORTEL, 'TREDEPROEF.json'), JSON.stringify(r, null, 2) + '\n');
      process.stdout.write(rapport(r) + '\n\nVastgelegd in TREDEPROEF.json\n');
    } else process.stdout.write(rapport(r) + '\n');
    process.exit(r.zuiverLekken || r.beproefdNiet503 || r.rondgangGezakt ? 1 : 0);
  }).catch(e => { process.stderr.write('de tredeproef kon niet draaien: ' + (e && e.stack || e) + '\n'); process.exit(2); });
}

module.exports = { meet, rapport, tabel, indeling, steekproef, VOOR_DE_SCHAKELAAR, isVoorDeSchakelaar, RONDGANG };
