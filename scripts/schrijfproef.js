#!/usr/bin/env node
/* ============================================================================
   DE SCHRIJFPROEF -- wat een geldroute ANTWOORDT als zijn schrijfactie
   bevestigd wordt en verdwijnt.

   WAAROM DIT NAAST DE CRASHPROEF STAAT EN ER NIET IN ZIT. scripts/crashproef.js
   meet drie CRASHGRENZEN: het proces sterft op een bepaald moment en de vraag
   is wat er van de uitkomst overblijft. Dat is de gesloten lijst van
   ./lib/crashtaxonomie.js, en `schrijf-verloren` hoort daar niet in -- er sterft
   niets. De opslag bevestigt de schrijfactie, gooit hem weg, en de route loopt
   vrolijk door. Wie dat als vierde crashgrens zou opnemen, zou de taxonomie
   oprekken tot "alles wat mis kan gaan" en daarmee onbruikbaar maken.

   EN HET IS DE VRAAG DIE DE MEERDERHEID RAAKT. De crashproef vond 87 van de 135
   rijen op GEEN_DUURZAME_WEG: die routes komen langs geen enkel injectiepunt
   omdat ze met de gewone write-behind save() schrijven. Dat leest als "geen
   crashgrens, dus hier valt niets te halen" -- en het tegendeel is waar. Juist
   die routes kunnen niet merken dat hun schrijfactie is verdwenen, want save()
   belooft niets en geeft niets terug.

   DE MEETVRAAG IS DAAROM PRECIES EEN: krijgt de aanroeper een SUCCES te zien
   terwijl er aantoonbaar niets is bewaard? Dat is `geenVals` uit het
   overlevingscontract van de crashproef, hier op een andere oorzaak. Een 2xx
   over een lege opslag is een vals succes, en op een geldroute is dat de duurste
   leugen die dit huis kan vertellen: de klant denkt dat hij betaald heeft.

   DE CONTROLE ZIT IN DE PROEF ZELF, en zonder die controle meet hij niets. Een
   proef die alleen maar "200 en niets bewaard" kan rapporteren, is niet te
   onderscheiden van een kapotte proef. /api/pay/saldo loopt WEL langs de
   duurzame commit en antwoordt onder ditzelfde verraad met 503: hij WEIGERT in
   plaats van te liegen. Zolang die rij `WEIGERT` blijft, weten we dat de proef
   verschil ziet; slaat hij om naar `VALS_SUCCES`, dan is er of een echte
   regressie of een kapotte opstelling -- en allebei horen ze rood te zijn.

   WAT DEZE PROEF NIET ZEGT. Hij velt geen oordeel over write-behind als
   ontwerp. `save()` belooft geen duurzaamheid en doet dat met opzet; de vraag of
   elke geldroute langs de duurzame commit MOET, is een architectuurbesluit van
   de eigenaar en geen uitkomst van een meting. Deze proef telt alleen hoeveel
   routes vandaag een succes melden over een schrijfactie die er niet is.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('./lib/wegwerpserver.js');
const { haalSleutels } = require('./lib/proefsleutels.js');
const { stempel, eisSchoneBoom } = require('./lib/stempel.js');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const vastleggen = argv.includes('--vastleggen');
const jsonUit = argv.includes('--json');
const alleenPad = (argv.find(a => a.startsWith('--pad=')) || '').slice(6) || null;
const maxRoutes = Number((argv.find(a => a.startsWith('--routes=')) || '').slice(9)) || 0;

const OFFICE = 'RTG-OFFICE-PROEF';
const OMGEVING = { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: OFFICE };
/* De controleroute: de enige die aantoonbaar langs de duurzame commit loopt
   (CRASHPROEF.json, de enige PROVEN). Zie de kop. */
const CONTROLE = '/api/pay/saldo';

/* DE STANDEN, gesloten. `ONBEREIKT` is met opzet geen `VEILIG`: een route die de
   proef niet aan het werk kreeg, heeft niets bewezen. */
const STANDEN = Object.freeze({
  VALS_SUCCES: 'de aanroeper kreeg een 2xx terwijl de opslag aantoonbaar onveranderd bleef',
  WEIGERT: 'de route gaf een fout toen de opslag niet kon bevestigen -- de aanroeper hoort de waarheid',
  SCHREEF_TOCH: 'de opslag veranderde alsnog; deze route raakt het verraadpunt niet op dit pad',
  ONBEREIKT: 'de proef kreeg de route niet aan het werk (geen lijf, geen wereld, of de deur bleef dicht)'
});

async function post(basis, pad, lijf, tok) {
  try {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(lijf || {}) });
    const tekst = await r.text();
    let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
    return { status: r.status, data };
  } catch (e) { return { status: 0, data: String(e.message) }; }
}

/* De opslag als BEELD en niet als inhoud: deze proef vraagt alleen of er iets
   is bewaard, niet wat. Grootte plus wijzigingstijd per bestand is daarvoor
   genoeg, en het scheelt een tweede lezer van de opslag naast droogloop.js. */
function beeld(map) {
  const uit = {};
  for (const f of fs.readdirSync(map)) {
    try { const st = fs.statSync(path.join(map, f)); if (st.isFile()) uit[f] = st.size + ':' + st.mtimeMs; }
    catch (e) { /* een bestand dat tijdens het lezen verdwijnt telt als veranderd */ }
  }
  return JSON.stringify(uit);
}

/* De uitslag van EEN route. Drie feiten (status, opslag bewoog, kwam de route
   aan het werk) en pas daarna een stand -- dezelfde volgorde als in de
   crashproef, en om dezelfde reden: een conclusie uit een enkel negatief
   signaal is hoe je de proef de schuld van de route laat dragen. */
function weeg({ status, opslagBewoog }) {
  if (status === 0) return { stand: 'ONBEREIKT', reden: 'de verbinding brak; er is geen antwoord om te wegen' };
  if (status >= 200 && status < 300) return opslagBewoog
    ? { stand: 'SCHREEF_TOCH', reden: 'de opslag veranderde ondanks het verraad -- deze route raakt ' +
        'het injectiepunt niet op dit pad, dus hier is niets bewezen' }
    : { stand: 'VALS_SUCCES', reden: 'de aanroeper kreeg ' + status + ' terwijl er niets is bewaard' };
  if (status >= 500) return { stand: 'WEIGERT', reden: 'de route gaf ' + status + ': de opslag kon niet ' +
    'bevestigen en dat is aan de aanroeper verteld in plaats van verzwegen' };
  return { stand: 'ONBEREIKT', reden: 'de route wees het verzoek af met ' + status +
    ' voordat hij aan het schrijven toekwam' };
}

async function meetRoute(route) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schrijfproef-'));
  let srv = null;
  try {
    srv = await W.start({ datamap: map, env: OMGEVING });
    const p = (pad, lijf, tok) => post(srv.basis, pad, lijf, tok);
    const bos = await haalSleutels({ post: p });
    const { zetWereldKlaar, gedeeldLijf, voorzieningVoor } = require('./lib/idemwereld.js');
    const w = await zetWereldKlaar({ post: p, tokens: bos.tokens, datamap: map });
    const lijf = { ...((w.perRoute || {})[route.pad] || gedeeldLijf(w.wereld)) };
    const tok = bos.tokenVoor ? bos.tokenVoor(route.rol) : null;
    const maak = voorzieningVoor(route.pad);
    if (maak) {
      try {
        const v = await maak({ post: p, tokenVoor: bos.tokenVoor, rol: route.rol, w: w.wereld });
        if (v && !v.fout && typeof v === 'object') Object.assign(lijf, v);
      } catch (e) { /* een omgevallen voorziening laat de route op zijn eigen hindernis stranden */ }
    }
    /* Het verraad gaat pas AAN bij de volgende start, om dezelfde reden als in
       de crashproef: de opstelling schrijft zelf, en met de modus vanaf het
       begin scherp meet de ronde de opstelling in plaats van de geldroute. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: { ...OMGEVING, RTG_VERRAAD: 'schrijf-verloren' } });
    const voor = beeld(map);
    const r = await post(srv.basis, route.pad, lijf, tok);
    const na = beeld(map);
    const opslagBewoog = voor !== na;
    const u = weeg({ status: r.status, opslagBewoog });
    return { ...u, status: r.status, opslagBewoog };
  } catch (e) {
    return { stand: 'ONBEREIKT', reden: 'de ronde brak af: ' + String(e.message).slice(0, 120),
      status: null, opslagBewoog: null };
  } finally {
    try { if (srv && srv.kind) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

function geldroutes() {
  const g = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GELDDEKKING.json'), 'utf8'));
  let r = (g.rijen || []).filter(x => (x.collecties || []).length);
  if (alleenPad) r = r.filter(x => x.pad === alleenPad);
  if (maxRoutes) r = r.slice(0, maxRoutes);
  return r;
}

async function meet() {
  const routes = geldroutes();
  if (!jsonUit) console.log('\n\x1b[1mDE SCHRIJFPROEF OVER DE GELDROUTES\x1b[0m \x1b[2m(' +
    routes.length + ' route(s), modus schrijf-verloren)\x1b[0m\n');
  const per = [];
  for (const route of routes) {
    const u = await meetRoute(route);
    per.push({ methode: route.methode, pad: route.pad, rol: route.rol,
      collecties: route.collecties, ...u });
    if (!jsonUit) console.log('  ' + u.stand.padEnd(14) + route.pad);
  }
  const telling = {};
  for (const r of per) telling[r.stand] = (telling[r.stand] || 0) + 1;
  const controle = per.find(r => r.pad === CONTROLE) || null;
  return { per, telling, routes: routes.length, controle };
}

function schrijf(u) {
  const reg = {
    soort: 'meting',
    uitleg: 'per geldroute: wat de aanroeper te zien krijgt als de opslag zijn schrijfactie ' +
      'bevestigt en weggooit (verraad `schrijf-verloren`). De vraag is of een 2xx wordt ' +
      'gegeven over een opslag die aantoonbaar onveranderd bleef.',
    grens: 'Deze proef velt GEEN oordeel over write-behind als ontwerp. save() belooft geen ' +
      'duurzaamheid en doet dat met opzet; of elke geldroute langs de duurzame commit MOET is ' +
      'een architectuurbesluit van de eigenaar. Hier wordt alleen geteld hoeveel routes vandaag ' +
      'een succes melden over een schrijfactie die er niet is. En hij zegt niets over crashes: ' +
      'dat is scripts/crashproef.js, met een eigen gesloten lijst momenten.',
    controle: u.controle
      ? { pad: CONTROLE, stand: u.controle.stand,
          waarom: 'de enige route die aantoonbaar langs de duurzame commit loopt. Blijft hij ' +
            'WEIGERT, dan ziet deze proef verschil; slaat hij om naar VALS_SUCCES, dan is er een ' +
            'regressie of een kapotte opstelling en hoort deze ronde rood te zijn.' }
      : { pad: CONTROLE, stand: null, waarom: 'de controleroute zat niet in deze selectie -- een ' +
            'deelronde bewijst daarmee niets over het onderscheidend vermogen van de proef' },
    standen: STANDEN,
    stempel: stempel(),
    telling: u.telling,
    routes: u.routes,
    per: u.per
  };
  fs.writeFileSync(path.join(WORTEL, 'SCHRIJFPROEF.json'), JSON.stringify(reg, null, 2) + '\n');
  return reg;
}

/* ACHTER require.main, net als crashproef.js en gelddekking.js. Zonder die
   grendel draait een `require('./schrijfproef.js')` de hele ronde -- en juist de
   toets die zijn weegfunctie beproeft, doet precies dat. Eerst geschreven
   zonder, en meteen een hangende opdracht opgeleverd. */
if (require.main === module) (async () => {
  if (vastleggen) eisSchoneBoom('de schrijfproef');
  const u = await meet();
  if (jsonUit) { console.log(JSON.stringify({ ...u, standen: STANDEN }, null, 2)); return; }
  console.log('\n  \x1b[1muitslag\x1b[0m');
  for (const [k, v] of Object.entries(u.telling).sort((a, b) => b[1] - a[1]))
    console.log('    ' + k.padEnd(16) + v);
  if (u.controle) console.log('\n  \x1b[2mcontrole ' + CONTROLE + ': ' + u.controle.stand +
    (u.controle.stand === 'WEIGERT' ? ' (de proef ziet verschil)' : ' -- LET OP: de controle is omgeslagen') + '\x1b[0m');
  if (vastleggen) { schrijf(u); console.log('\n  SCHRIJFPROEF.json geschreven.'); }
})();

module.exports = { weeg, STANDEN, CONTROLE };
