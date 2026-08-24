#!/usr/bin/env node
/* ============================================================================
   HET LEESSPOOR SAMENVOEGEN -- wat een toets leest en de graaf niet weet.

   scripts/lib/leesspoor.js schrijft tijdens een ronde op welk bestand onder deze
   repo er is gelezen en door welke toets. Dit script legt dat naast de statische
   afhankelijkheidsgraaf en bewaart alleen het VERSCHIL: de bestanden die een
   toets aantoonbaar heeft gelezen terwijl geen enkele require ernaartoe wees.

   Waarom alleen het verschil. De meeste toetsen starten een server, en die leest
   dezelfde ~3400 modules die de graaf al kent uit server/server.js. Dat allemaal
   opschrijven zou een register van miljoenen regels geven waarin de vijf regels
   die er toe doen niet te vinden zijn. Wat overblijft is precies de blinde vlek:
   test/ast-grens.test.js leest 90+ bestanden onder server/routes/ waar geen
   enkele require naartoe wijst, en een wijziging in zo'n route zou die toets dus
   nooit selecteren.

   HET IS EEN ONDERGRENS EN GEEN WAARHEID. Wat deze ronde is gelezen kan volgende
   ronde weer worden gelezen; wat NIET is gelezen kan volgende ronde alsnog
   worden gelezen. Daarom voegt het register alleen KANTEN TOE en haalt het er
   nooit een weg, en daarom groeit het over rondes heen in plaats van te worden
   overschreven. De planner kiest er dus MEER van, nooit minder.

   Draai:
     node scripts/leesspoor.js --spoor /pad/spoor.jsonl      voeg een ronde toe
     node scripts/leesspoor.js                                toon het register
     node scripts/leesspoor.js --vergeet                      begin opnieuw
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'LEESSPOOR.json');
const argv = process.argv.slice(2);
const spoorArg = (() => { const i = argv.indexOf('--spoor'); return i >= 0 ? argv[i + 1] : null; })();

function leesRegister() {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
    return (r && typeof r.toetsen === 'object') ? r : null;
  } catch (e) { return null; }
}

/* Wat de statische graaf al weet, per toets. Zonder deze aftrek zou het register
   miljoenen regels worden; met de aftrek staan er alleen de kanten in die er
   werkelijk bij komen. */
function statischPerToets() {
  const { graaf } = require('./lib/bewijsgraaf.js');
  const g = graaf({ zonderSpoor: true });
  const uit = new Map();
  if (!g) return uit;
  for (const [naam, d] of g.perToets) {
    const set = new Set();
    for (const f of d.bestanden) set.add(path.relative(WORTEL, f).split(path.sep).join('/'));
    uit.set(naam, set);
  }
  return uit;
}

/* WAT EEN KALE SERVERBOOT LEEST, EEN KEER GEMETEN.

   De eerste versie hiervan schreef 749.950 kanten over 546 toetsen: een register
   van 27 megabyte waarin 1360 paden 546 keer staan. Dat komt niet door een fout
   in de meting maar doordat de meting KLOPT: elke server scant bij het opstarten
   public/ (ui-bronnen, de capability-graaf) en tientallen kernmappen, en elke
   toets die een server start leest dus diezelfde 1360 bestanden.

   Die verzameling hoort een keer opgeschreven te worden en niet 546 keer. Ze
   wordt hier GEMETEN -- een kale server booten met de voorlader aan -- en niet
   geraden met een drempel ("paden die meer dan de helft van de toetsen leest").
   Een drempel zou bij een andere samenstelling van de suite iets anders
   betekenen; een gemeten boot betekent altijd hetzelfde.

   De sleutel eronder is dezelfde vorm als bij de gietvorm: verandert er iets in
   server/ of public/, dan wordt hij opnieuw gemeten. */
async function meetServerboot() {
  const { spawn } = require('child_process');
  const net = require('net');
  const os = require('os');
  const kas = require('../server/lib/bronkas');
  const sleutel = kas.sleutelUit([
    kas.manifestVan(path.join(WORTEL, 'server'), (p) => p.endsWith('.js'), 'spoorboot', { vers: true }),
    kas.manifestVan(path.join(WORTEL, 'public'), () => true, 'spoorbootpub', { vers: true }),
    'node=' + process.versions.node, 'v1'
  ]).slice(0, 16);

  const spoor = path.join(os.tmpdir(), 'rtg-serverboot-' + process.pid + '.jsonl');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spoorboot-'));
  const poort = await new Promise((res, rej) => {
    const s = net.createServer(); s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
  const kind = spawn(process.execPath,
    ['--experimental-sqlite', '--require', path.join(__dirname, 'lib', 'leesspoor.js'),
      path.join(WORTEL, 'server', 'server.js')],
    { cwd: WORTEL, stdio: ['ignore', 'ignore', 'ignore'],
      env: Object.assign({}, process.env, { NODE_ENV: 'test', RTG_DEMO: '1', RTG_DEV_LINKS: '1',
        SMTP_URL: '', RTG_DATA_DIR: map, PORT: String(poort),
        RTG_LEESSPOOR: spoor, RTG_TOETS: 'zz-serverboot.test.js' }) });
  const tot = Date.now() + 120000;
  try {
    for (;;) {
      if (kind.exitCode != null) throw new Error('de server stopte tijdens het meten (exit ' + kind.exitCode + ')');
      if (Date.now() > tot) throw new Error('de server werd niet klaar binnen 120 s');
      const r = await fetch('http://127.0.0.1:' + poort + '/api/ready',
        { headers: { 'X-Forwarded-Proto': 'https' } }).catch(() => null);
      if (r && r.ok) break;
      await new Promise(x => setTimeout(x, 100));
    }
    await new Promise(res => { kind.once('exit', res); kind.kill('SIGTERM');
      setTimeout(() => { try { kind.kill('SIGKILL'); } catch (e) {} res(); }, 20000).unref(); });
  } finally {
    try { kind.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
  let paden = [];
  try {
    paden = [...new Set(fs.readFileSync(spoor, 'utf8').split('\n').filter(Boolean)
      .map(r => { try { return JSON.parse(r).p; } catch (e) { return null; } })
      .filter(p => p && /^(server|scripts|public|test)\//.test(p)))].sort();
  } finally { try { fs.unlinkSync(spoor); } catch (e) {} }
  /* Een lege of belachelijk korte lijst is geen "de server leest niets" maar een
     kapotte meting; die hoort niet als waarheid het register in (LAT-regel 3). */
  if (paden.length < 100) throw new Error('een kale serverboot las maar ' + paden.length
    + ' bestanden; dat is geen meting maar een storing');
  return { sleutel, paden };
}

/* HEEFT DEZE TOETS EEN SERVER GEDRAAID?

   Niet "leest hij de helft van de bootlijst" -- dat was de eerste versie en die
   herkende er twee van de 546. De bootlijst telt 3511 bestanden; wat een toets
   ERBOVENOP leest is er hooguit een paar honderd. De vraag is dus andersom: valt
   wat deze toets las grotendeels BINNEN de bootlijst?

   Zit hij er ten onrechte bij, dan krijgt hij de bootpaden erbij van de graaf en
   worden zijn afhankelijkheden groter -- de planner kiest hem dan vaker. Dat is
   de goede kant om fout te zitten, en de reden dat deze drempel mag bestaan. */
function heeftGeboot(overlap, eigenAantal) {
  if (!eigenAantal || overlap < 100) return false;
  return overlap >= eigenAantal * 0.6;
}

async function voegToe(spoorPad) {
  let regels = [];
  try { regels = fs.readFileSync(spoorPad, 'utf8').split('\n').filter(Boolean); }
  catch (e) { console.error('[leesspoor] geen spoor te lezen op ' + spoorPad + ': ' + e.message); process.exit(1); }
  /* Een LEEG spoor is geen "niets gelezen" maar een kapotte meting: dan stond de
     voorlader niet aan, en het register stilletjes ongewijzigd laten zou de
     volgende lezer laten denken dat er gemeten is (LAT-regel 3). */
  if (!regels.length) { console.error('[leesspoor] het spoor is leeg; er is niets gemeten.'); process.exit(1); }

  const waargenomen = new Map();
  let stuk = 0;
  for (const r of regels) {
    let o; try { o = JSON.parse(r); } catch (e) { stuk++; continue; }
    if (!o || !o.t || !o.p) { stuk++; continue; }
    if (!/\.(test|e2e)\.js$/.test(o.t)) continue;     // niet aan een toets toe te schrijven
    if (!waargenomen.has(o.t)) waargenomen.set(o.t, new Set());
    waargenomen.get(o.t).add(o.p);
  }

  const statisch = statischPerToets();
  const oud = leesRegister();

  /* DE KALE SERVERBOOT ERUIT. Opnieuw meten als de sleutel niet meer klopt --
     dan is er iets in server/ of public/ veranderd en zegt de oude lijst niets
     meer. Lukt het meten niet, dan gaat het GEEN stilte worden: dan valt hij
     terug op de vorige lijst en zegt hij dat erbij. */
  let serverboot = (oud && oud.serverboot) || { sleutel: null, paden: [] };
  try {
    const vers = await meetServerboot();
    if (vers.sleutel !== serverboot.sleutel) {
      console.log('[leesspoor] kale serverboot opnieuw gemeten: ' + vers.paden.length + ' bestanden');
    }
    serverboot = vers;
  } catch (e) {
    console.error('[leesspoor] de kale serverboot kon NIET gemeten worden (' + e.message + '); ' +
      'de vorige lijst van ' + serverboot.paden.length + ' bestanden blijft staan. Het register wordt ' +
      'daardoor groter, niet onjuist.');
  }
  const bootSet = new Set(serverboot.paden);

  const toetsen = Object.assign({}, oud ? oud.toetsen : {});
  const bootToetsen = new Set((oud && oud.serverbootVoor) || []);
  let nieuweKanten = 0;
  for (const [toets, gelezen] of waargenomen) {
    const bekend = statisch.get(toets) || new Set();
    /* Heeft deze toets een server gestart? Dan erft hij de kale-bootlijst en
       hoeven die 1360 paden niet nog een keer bij hem te staan. Herkenbaar aan
       een ruime overlap met die lijst -- een toets die er de helft van leest,
       heeft een server aan gehad. */
    let overlap = 0;
    for (const p of gelezen) if (bootSet.has(p)) overlap++;
    const startteServer = heeftGeboot(overlap, gelezen.size);
    if (startteServer) bootToetsen.add(toets);

    const extra = new Set(toetsen[toets] || []);
    for (const p of gelezen) {
      if (bekend.has(p) || extra.has(p)) continue;
      if (startteServer && bootSet.has(p)) continue;
      /* Alleen bestanden die de planner ook KAN wegen: bron, geen uitvoer. */
      if (!/^(server|scripts|public|test)\//.test(p)) continue;
      extra.add(p); nieuweKanten++;
    }
    if (extra.size) toetsen[toets] = [...extra].sort();
  }
  /* En wat er al in het register stond en nu in de bootlijst zit, mag daar weg:
     dat is geen kant die verdwijnt maar dezelfde kant op een plek waar hij een
     keer staat in plaats van 546 keer. */
  for (const toets of Object.keys(toetsen)) {
    if (!bootToetsen.has(toets)) continue;
    const zonder = toetsen[toets].filter(p => !bootSet.has(p));
    if (zonder.length) toetsen[toets] = zonder; else delete toetsen[toets];
  }

  const stand = {
    uitleg: 'Bestanden die een toets aantoonbaar HEEFT GELEZEN terwijl geen enkele require ernaartoe ' +
      'wijst. Gemeten door scripts/lib/leesspoor.js tijdens een echte ronde. Dit is een ONDERGRENS: ' +
      'het register groeit over rondes heen en er wordt nooit iets uit weggehaald, zodat de planner ' +
      'er meer van kiest en nooit minder.',
    hoe: 'node scripts/leesspoor.js --spoor <spoor.jsonl>',
    gemetenOp: new Date().toISOString(),
    rondes: (oud && Number(oud.rondes) || 0) + 1,
    gemeten: { toetsenMetExtra: Object.keys(toetsen).length,
      kantenTotaal: Object.values(toetsen).reduce((n, l) => n + l.length, 0),
      nieuweKantenDezeRonde: nieuweKanten,
      serverbootPaden: serverboot.paden.length, toetsenMetServerboot: bootToetsen.size },
    serverboot,
    serverbootVoor: [...bootToetsen].sort(),
    toetsen
  };
  fs.writeFileSync(REGISTER, JSON.stringify(stand, null, 1) + '\n');
  console.log('[leesspoor] ronde ' + stand.rondes + ' toegevoegd: ' + nieuweKanten + ' nieuwe kanten, '
    + stand.gemeten.kantenTotaal + ' eigen kanten over ' + stand.gemeten.toetsenMetExtra + ' toetsen, plus '
    + serverboot.paden.length + ' kale-bootpaden voor ' + bootToetsen.size + ' toetsen'
    + (stuk ? '  (' + stuk + ' onleesbare regels overgeslagen)' : ''));
}

/* HERSCHIKKEN ZONDER NIEUWE RONDE. Het register van voor de kale-bootlijst had
   749.950 kanten en 27 megabyte, met 1360 paden 546 keer opgeschreven. Dat hoeft
   geen nieuwe ronde van achttien minuten te kosten om recht te zetten: de paden
   staan er al, ze staan alleen op de verkeerde plek. Deze stap meet de kale boot
   en haalt hem uit de toetsen die hem aantoonbaar hebben gedraaid.

   Er verdwijnt geen enkele KANT: wat uit een toetslijst gaat, komt in de
   gedeelde lijst terug, en scripts/lib/bewijsgraaf.js voegt die er weer bij. */
async function herschik() {
  const oud = leesRegister();
  if (!oud) { console.error('[leesspoor] er is geen register om te herschikken.'); process.exit(1); }
  const serverboot = await meetServerboot();
  const bootSet = new Set(serverboot.paden);
  const toetsen = {}; const bootToetsen = new Set((oud.serverbootVoor || []));
  for (const [toets, lijst] of Object.entries(oud.toetsen || {})) {
    const overlap = lijst.filter(p => bootSet.has(p)).length;
    const startteServer = heeftGeboot(overlap, lijst.length);
    if (startteServer) bootToetsen.add(toets);
    const eigen = startteServer ? lijst.filter(p => !bootSet.has(p)) : lijst;
    if (eigen.length) toetsen[toets] = eigen;
  }
  const stand = Object.assign({}, oud, {
    gemetenOp: new Date().toISOString(),
    gemeten: { toetsenMetExtra: Object.keys(toetsen).length,
      kantenTotaal: Object.values(toetsen).reduce((n, l) => n + l.length, 0),
      nieuweKantenDezeRonde: 0,
      serverbootPaden: serverboot.paden.length, toetsenMetServerboot: bootToetsen.size },
    serverboot, serverbootVoor: [...bootToetsen].sort(), toetsen
  });
  fs.writeFileSync(REGISTER, JSON.stringify(stand, null, 1) + '\n');
  console.log('[leesspoor] herschikt: ' + stand.gemeten.kantenTotaal + ' eigen kanten over '
    + stand.gemeten.toetsenMetExtra + ' toetsen, plus ' + serverboot.paden.length
    + ' kale-bootpaden voor ' + bootToetsen.size + ' toetsen');
}

if (argv.includes('--herschik')) {
  herschik().then(() => process.exit(0))
    .catch(e => { console.error('[leesspoor] herschikken mislukt: ' + e.message); process.exit(1); });
  return;
}

if (argv.includes('--vergeet')) {
  try { fs.unlinkSync(REGISTER); console.log('[leesspoor] register weg.'); } catch (e) { console.log('[leesspoor] er was niets.'); }
  process.exit(0);
}
if (spoorArg) {
  voegToe(spoorArg).then(() => process.exit(0))
    .catch(e => { console.error('[leesspoor] samenvoegen mislukt: ' + e.message); process.exit(1); });
  return;
}

const r = leesRegister();
if (!r) { console.log('Nog geen LEESSPOOR.json. Draai een ronde en voeg het spoor toe met --spoor.'); process.exit(0); }
console.log('\n=== HET LEESSPOOR ===\n');
console.log('  gemeten over rondes : ' + r.rondes);
console.log('  toetsen met extra   : ' + r.gemeten.toetsenMetExtra);
console.log('  kanten totaal       : ' + r.gemeten.kantenTotaal);
console.log('\n  de toetsen die het meest buiten hun requires lezen:');
Object.entries(r.toetsen).sort((a, b) => b[1].length - a[1].length).slice(0, 15)
  .forEach(([t, l]) => console.log('    ' + String(l.length).padStart(4) + '  ' + t));
