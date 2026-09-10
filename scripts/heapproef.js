#!/usr/bin/env node
/* ============================================================================
   DE HEAPPROEF -- HOUDT DEZE SERVER GEHEUGEN VAST, EN HOE ZEKER WETEN WE DAT?

   WAAROM DIT NAAST FASE F STAAT. FASE F van de beproeving trok een rechte lijn
   door drie vloeren en noemde de steilheid een lek. Drie 100M-rondes gaven
   +638, +897 en -55 MB/min bij een drempel van 40, met stiltecontroles van
   +131, 0,0 en -115. Die spreiding is een veelvoud van de drempel: de meter kon
   een lek niet van zijn eigen ruis onderscheiden, maar gaf wel een getal. Een
   getal dat je niet kunt vertrouwen is erger dan geen getal, want er wordt op
   gestuurd.

   VIER DINGEN DIE HIER ANDERS ZIJN, en ze zijn alle vier nodig:

     1. VERWEVEN EN NIET NA ELKAAR. De blokken lopen A B B A: verkeer, stilte,
        stilte, verkeer. Alles wat in de tijd oploopt -- een cache die vult, een
        poel die groeit -- raakt beide condities dan even hard en valt weg in
        het verschil. FASE F deed eerst alle stiltes en daarna al het verkeer;
        daar landde elke drift volledig op het verkeer.
     2. LANGERE VENSTERS MET EEN WEGGEGOOIDE AANLOOP. Elk blok duurt standaard
        90 s en de eerste 20 s tellen niet mee. We meten de stabiele toestand,
        niet de opstartpiek van de eerste verzoeken.
     3. HERHALINGEN. Vier eenheden van A B B A geven acht verkeersblokken en
        acht stilteblokken. Uit die spreiding komt een interval, en pas een
        interval maakt "stabiel" een bewering in plaats van een indruk.
     4. EEN VAST MEETPUNT. Elke vloer wordt op exact dezelfde manier bepaald:
        verkeer stoppen, vaste bezinktijd, vast aantal geforceerde GC's, en dan
        de MEDIAAN van de metingen (./lib/heapstat.js legt uit waarom geen
        minimum). Het meetpunt hoort bij de meting; verschuift het per conditie,
        dan meet je het meetpunt.

   DE UITSLAG KENT DRIE STANDEN, en de derde is de reden dat dit instrument
   bestaat: STABIEL, LEK en NIET_VAST_TE_STELLEN. Die laatste zegt dat de proef
   het niet weet, en dat is iets anders dan "in orde" (BESTUUR.md).

   DE IJKING IS NIET OPTIONEEL. Met --ijk=<MB/min> houdt de server bewust dat
   tempo aan geheugen vast (via de test-preload, niet via productiecode). Een
   meter die een bekend lek niet vindt, is geen meter. `npm run heapproef:ijk`
   draait die controle en eindigt met een foutcode als de proef het lek mist.

   Draai:  node scripts/heapproef.js                    (huidige opslag)
           node scripts/heapproef.js --pg=postgres://... (postgres)
           node scripts/heapproef.js --ijk=120           (zelfcontrole)
           --blok=90 --eenheden=4 --aanloop=20 --drempel=40
   ========================================================================== */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { start: wegwerp } = require('./lib/wegwerpserver');
const { haalSessies } = require('./lib/proefsessies');
const { tempos, oordeel } = require('./lib/heapstat');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const vlag = (n, d) => { const a = argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const getal = (n, d) => Number(vlag(n, d));

const BLOK_MS = getal('blok', 90) * 1000;
const AANLOOP_MS = getal('aanloop', 20) * 1000;
const EENHEDEN = getal('eenheden', 4);
const DREMPEL = getal('drempel', 40);
const IJK = getal('ijk', 0);
const PG = vlag('pg', process.env.DATABASE_URL || '');
const PORT = getal('poort', 3401);
const WERKERS = getal('werkers', 24);
const UIT = vlag('uit', path.join(WORTEL, 'HEAPPROEF.json'));

/* Een eenheid is A B B A. Verkeer staat op plek 1 en 4, stilte op 2 en 3, dus
   een rechte drift binnen de eenheid telt voor beide condities even zwaar. */
const EENHEID = ['verkeer', 'stilte', 'stilte', 'verkeer'];

let TMP = null, GC_OUT = null;
const BASIS = 'http://127.0.0.1:' + PORT;
let child = null;

function verzoek(method, pad, token, body) {
  return new Promise(res => {
    const data = body === null ? null : Buffer.from(JSON.stringify(body || {}));
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: pad, timeout: 15000,
      headers: Object.assign({ 'content-type': 'application/json' },
        data ? { 'content-length': data.length } : {},
        token ? { authorization: 'Bearer ' + token } : {}) },
    r => { r.resume(); r.on('end', () => res(r.statusCode)); });
    req.on('error', () => res(0)); req.on('timeout', () => { req.destroy(); res(0); });
    if (data) req.write(data); req.end();
  });
}

/* HET VASTE MEETPUNT. Bezinken, dan vijf keer een volledige GC afdwingen en de
   heap uitlezen, dan de mediaan. Identiek na elk blok, in beide condities --
   dat "identiek" is de hele reden dat dit een functie is en geen losse regels:
   verschuift het meetpunt per conditie, dan meet het verschil het meetpunt. */
async function vloer() {
  await new Promise(r => setTimeout(r, 3000));
  const monsters = [];
  for (let i = 0; i < 5; i++) {
    let voor = 0; try { voor = fs.statSync(GC_OUT).mtimeMs; } catch (e) {}
    try { process.kill(child.pid, 'SIGUSR2'); } catch (e) {}
    for (let w = 0; w < 40; w++) {
      await new Promise(r => setTimeout(r, 100));
      try {
        const st = fs.statSync(GC_OUT);
        if (st.mtimeMs > voor) { monsters.push(JSON.parse(fs.readFileSync(GC_OUT, 'utf8')).heapUsed / 1048576); break; }
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 700));
  }
  if (!monsters.length) return null;
  const s = monsters.slice().sort((a, b) => a - b);
  /* HIER AFRONDEN EN NERGENS ANDERS. Het verslag bewaart de vloeren op een
     decimaal, en toets 7 rekent het oordeel daaruit opnieuw uit. Rondde het
     verslag pas bij het wegschrijven af, dan is het oordeel gerekend op andere
     getallen dan die er staan, en verschilt de nabereking op de laatste
     decimaal -- precies wat er op 9 september 2026 gebeurde (133,4 tegen
     133,3). Een register dat zichzelf niet kan narekenen is een tekstbestand. */
  return Math.round(s[s.length >> 1] * 10) / 10;
}

const PADEN = [
  { m: 'POST', p: '/api/state', rol: 'lid' }, { m: 'GET', p: '/api/notifications', rol: 'lid' },
  { m: 'POST', p: '/api/verkoop/mijn', rol: 'lid' }, { m: 'POST', p: '/api/boekingen/mijn', rol: 'lid' },
  { m: 'POST', p: '/api/pay/overzicht', rol: 'lid' }, { m: 'POST', p: '/api/office/state', rol: 'kantoor' },
  { m: 'POST', p: '/api/supplier/backoffice', rol: 'zaak' }
];

/* Een blok is: aanloop, meetpunt, stabiel venster, meetpunt. Het TEMPO gaat
   alleen over het stabiele venster -- de aanloop is gedraaid maar telt niet mee.
   De stilte krijgt exact dezelfde tijdsopbouw; zou zij de aanloop overslaan,
   dan verschilt zij van het verkeer in de VORM van de meting en niet alleen in
   de belasting, en dan meet het verschil deels het meetschema zelf. */
async function draaiBlok(soort, tok, telling) {
  const draai = (ms) => soort === 'stilte'
    ? new Promise(r => setTimeout(r, ms))
    : belast(ms, tok, telling);
  await draai(AANLOOP_MS);
  const begin = await vloer();
  await draai(BLOK_MS);
  const eind = await vloer();
  return { soort, begin, eind };
}

function belast(ms, tok, telling) {
  const eind = Date.now() + ms;
  const werker = async () => {
    while (Date.now() < eind) {
      const r = PADEN[(Math.random() * PADEN.length) | 0];
      const t = tok[r.rol] || tok.lid;
      const st = await verzoek(r.m, r.p, t, r.m === 'GET' ? null : {});
      telling.n++;
      if (st >= 500 && st !== 503) { telling.s5xx++; telling.paden[r.p] = (telling.paden[r.p] || 0) + 1; }
      await new Promise(res => setTimeout(res, 1 + ((Math.random() * 4) | 0)));
    }
  };
  return Promise.all(Array.from({ length: WERKERS }, werker));
}

/* Antwoordt er AL iets op de poort voordat wij onze server starten, dan is dat
   een achtergebleven server van een eerdere (afgebroken) ronde. Onze eigen
   server valt dan stil om op de bezette poort, terwijl de gereedheidspoll het
   antwoord van die OUDE server krijgt -- en dan meten we een half uur lang het
   geheugen van een proces dat we niet gestart zijn. Deze wacht staat in
   scripts/beproeving.js om precies dezelfde reden; hij hoort hier ook. */
async function poortVrij() {
  const st = await verzoek('GET', '/api/ready', null, null);
  if (st > 0) throw new Error('poort ' + PORT + ' is al bezet (waarschijnlijk een achtergebleven ' +
    'server van een eerdere ronde). Ruim die eerst op, bijv.: pkill -f "gc-hook.js"');
}

async function main() {
  await poortVrij();
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-heapproef-'));
  GC_OUT = path.join(TMP, 'gc.json');
  const env = { NODE_ENV: 'test', ANTHROPIC_API_KEY: '', RTG_ENC_KEY: '', DEMO_SUPPLIER: 'KIKUNOI',
    RTG_DEMO: '1', LOG_LEVEL: 'error', RTG_GC_OUT: GC_OUT, NODE_OPTIONS: '--max-old-space-size=8192' };
  if (PG) { env.DATABASE_URL = PG; env.RTG_STORE = 'postgres'; }
  if (IJK > 0) env.RTG_LEK_MBMIN = String(IJK);   // zelfcontrole: een BEKEND lek
  const bundel = await wegwerp({ naam: 'heapproef', poort: PORT, datamap: TMP, gereed: 'ready',
    nodeArgs: ['--expose-gc', '-r', path.join(__dirname, 'gc-hook.js')], env, wachtMs: 120000 });
  child = bundel.kind;

  const { sessies, overgeslagen } = await haalSessies(BASIS, ['lid', 'zaak', 'kantoor']);
  const tok = {};
  for (const [naam, s] of Object.entries(sessies)) tok[naam] = typeof s.waarde === 'string' ? s.waarde : (s.waarde && s.waarde.token);
  if (!tok.lid) throw new Error('geen lid-sessie: zonder verkeer meet deze proef niets');

  const blokken = [], telling = { n: 0, s5xx: 0, paden: {} };
  console.log('\nDE HEAPPROEF -- ' + (PG ? 'postgres' : 'lokale opslag') +
    (IJK ? '  \x1b[33m[IJKING: ' + IJK + ' MB/min ingebouwd lek]\x1b[0m' : '') +
    '\n  ' + EENHEDEN + ' eenheden A B B A, blok ' + (BLOK_MS / 1000) + ' s, drempel ' + DREMPEL + ' MB/min');
  if (overgeslagen.length) for (const o of overgeslagen) console.log('  \x1b[2moverslagen rol ' + o.rol + ': ' + o.reden + '\x1b[0m');

  for (let e = 0; e < EENHEDEN; e++) {
    for (const soort of EENHEID) {
      const b = await draaiBlok(soort, tok, telling);
      blokken.push(b);
      const tempo = (Number.isFinite(b.begin) && Number.isFinite(b.eind))
        ? (b.eind - b.begin) / (BLOK_MS / 60000) : null;
      console.log('  ' + String(e + 1) + '.' + soort.padEnd(9) + '  ' +
        (b.begin === null ? '  ?  ' : b.begin.toFixed(0).padStart(5)) + ' -> ' +
        (b.eind === null ? '  ?  ' : b.eind.toFixed(0).padStart(5)) + ' MB' +
        (tempo === null ? '   \x1b[33mniet gemeten\x1b[0m'
          : '   \x1b[2m' + (tempo >= 0 ? '+' : '') + tempo.toFixed(0) + ' MB/min\x1b[0m'));
    }
  }

  const per = tempos(blokken, BLOK_MS / 60000);
  const uit = oordeel({ verkeer: per.verkeer || [], stilte: per.stilte || [], drempel: DREMPEL });
  const kleurVan = (st) => st === 'STABIEL' ? '32' : st === 'LEK' ? '31' : '33';
  const regel = (naam, d, uitleg) => console.log('  ' + naam.padEnd(12) +
    '\x1b[' + kleurVan(d.stand) + 'm' + d.stand.padEnd(21) + '\x1b[0m' +
    String(d.tempo).padStart(7) + ' MB/min   90%-interval [' + d.laag + ', ' + d.hoog + ']' +
    '\n              \x1b[2m' + uitleg + '\x1b[0m');
  console.log('\n  verkeer   mediaan ' + uit.verkeerMediaan + ' MB/min  (spreiding ' + uit.verkeerSpreiding + ', n=' + uit.metingen.verkeer + ')');
  console.log('  stilte    mediaan ' + uit.stilteMediaan + ' MB/min  (spreiding ' + uit.stilteSpreiding + ', n=' + uit.metingen.stilte + ')\n');
  regel('verkeerslek', uit.verkeerslek, 'groeit hij HARDER doordat hij verzoeken afhandelt? (verkeer min stilte)');
  regel('grondlek', uit.grondlek, 'groeit hij AL als hij niets doet? (de stilte op zichzelf)');
  console.log('\n  oplossend vermogen van DEZE ronde: ' + uit.oplossing + ' MB/min  (drempel ' + DREMPEL + ')');
  console.log('  \x1b[' + kleurVan(uit.stand) + 'm' + uit.stand + '\x1b[0m -- de strengste van de twee');
  console.log('  verkeer: ' + telling.n + ' calls, ' + telling.s5xx + ' onverwachte 5xx' +
    (telling.s5xx ? ' \x1b[31m' + JSON.stringify(telling.paden) + '\x1b[0m' : ''));

  const verslag = { stempel: stempel(),
    uitleg: 'Verweven verkeer/stilte-blokken (A B B A) met een vast post-GC meetpunt. ' +
      'Er staan TWEE vragen naast elkaar en de strengste telt: het VERKEERSLEK (verkeer min ' +
      'stilte -- groeit hij harder door verzoeken?) en het GRONDLEK (de stilte op zichzelf -- ' +
      'groeit hij al als hij niets doet?). Alleen het verschil beoordelen laat een lek in de ' +
      'achtergrond door; dat is bij de ijking van 9 september 2026 werkelijk gebeurd. ' +
      'NIET_VAST_TE_STELLEN betekent dat de ruis van deze ronde groter is dan de drempel.',
    opstelling: { store: PG ? 'postgres' : 'lokaal', blokSeconden: BLOK_MS / 1000, aanloopSeconden: AANLOOP_MS / 1000,
      eenheden: EENHEDEN, werkers: WERKERS, drempelMBPerMin: DREMPEL, ijkLekMBPerMin: IJK || null,
      machine: { kernen: os.cpus().length, geheugenGB: Math.round(os.totalmem() / 1e9), node: process.version } },
    /* Onbewerkt overgenomen: vloer() heeft al afgerond, en een tweede
       afronding hier zou het oordeel weer los van zijn invoer zetten. */
    blokken: blokken.map(b => ({ soort: b.soort, beginMB: b.begin, eindMB: b.eind })),
    tempos: { verkeer: (per.verkeer || []).map(x => Number(x.toFixed(1))), stilte: (per.stilte || []).map(x => Number(x.toFixed(1))) },
    verkeer: { calls: telling.n, onverwachte5xx: telling.s5xx, paden: telling.paden },
    overgeslagenRollen: overgeslagen, oordeel: uit };
  fs.writeFileSync(UIT, JSON.stringify(verslag, null, 2) + '\n');
  console.log('  verslag: ' + path.relative(WORTEL, UIT) + '\n');

  /* DE IJKING KEERT DE VERWACHTING OM. Met een ingebouwd lek MOET de proef LEK
     zeggen; zegt hij iets anders, dan is de meter blind en is dat de fout. */
  if (IJK > 0) return uit.stand === 'LEK' ? 0 : 1;
  return uit.stand === 'LEK' ? 1 : 0;
}

if (require.main === module) main().then(code => { try { child && child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exit(code); })
  .catch(e => { console.error('\n  \x1b[31mheapproef gestrand:\x1b[0m ' + (e && e.message || e) + '\n');
    try { child && child.kill('SIGKILL'); } catch (x) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (x) {}
    process.exit(2); });
