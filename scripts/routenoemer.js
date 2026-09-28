#!/usr/bin/env node
/* ============================================================================
   DE NOEMERWAARHEID -- waarom zeggen de registers elk een ander aantal routes?

   WAAROM DIT ER IS, EN WAAROM HET VOOR DE ROUTEVERSHEID KOMT

   Wie vertrouwen per route gaat rekenen, moet eerst weten over WELKE routes hij
   praat. Op 28 september 2026 liepen er zeven getallen rond die allemaal "het
   aantal routes" heetten:

     5168  de router op HEAD                      (en MUTATIEINVENTARIS.route)
     5102  ROUTEBRON.json
     4972  IDEMPROEF.json en EXECUTION_MAP.json
     4971  BEWIJSMATRIX.json
     4747  OUTPUTPROEF.json
     4738  VERTROUWEN.json
     5207  genoemd in een voorstel -- en in GEEN register te vinden

   scripts/mutatieinventaris.js heeft dit al eens opgelost voor de
   MUTATIEladder (vijf inventarissen uit een bron, elke trede met een reden).
   Dit script doet hetzelfde over de REGISTERS: per register de definitie
   waarmee het telt en de commit waarop het telde, en dan de vraag of dat getal
   te REPRODUCEREN is. Dat gaat zo: zet de boom in een wegwerp-worktree op de
   meetcommit van het register, laat daar de router zijn routes opsommen
   (scripts/routekaart.js --json, dezelfde bron die de bewijsmatrix gebruikt),
   pas de definitie toe, en vergelijk.

   DRIE SOORTEN VERSCHIL, en ze worden nooit opgeteld

     leeftijd     de route bestond op de meetcommit niet, of niet meer. Het
                  register is niet fout, het is OUD. Een route weghalen om de
                  cijfers gelijk te krijgen zou dit verschil onzichtbaar maken en
                  de achterstand niet inlopen.
     definitie    het register telt met opzet iets anders: alleen /api/, alleen
                  POST, alleen wat de idemproef kon aanroepen, alleen wat in het
                  routejournaal langskwam. Dat is een BEGRIP en geen fout, en het
                  blijft zichtbaar.
     onverklaard  wat na die twee overblijft. Dit getal hoort nul te zijn; is
                  het dat niet, dan staan de routes er met naam bij.

   CANONIEK PER BEGRIP, niet een canoniek getal. "Hoeveel routes" is geen vraag;
   "hoeveel routes BESTAAN er" (de router op HEAD), "over hoeveel routes wordt
   bewijs geboekt" (de bewijsmatrixdefinitie op HEAD) en "hoeveel routes heeft
   de idemproef bereikt" (IDEMPROEF) zijn er drie, en ze horen elk hun eigen
   noemer te hebben.

   Dit script SCHRIJFT NIETS. Het is een meting die op HEAD geldt; een
   ingecheckte uitslag zou bij de volgende commit al over het verleden gaan.

   Draai:  npm run routenoemer            (ongeveer een halve minuut per commit)
           npm run routenoemer -- --json
   UITGANG 0 alles verklaard, 1 er is iets onverklaard, 2 niet vast te stellen
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const lees = (n) => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8')); } catch (e) { return null; } };
const kort = (c) => String(c || '').slice(0, 8);

/* De router als lijst sleutels "METHODE /pad", met ALL als POST -- exact de
   vertaling van routetabel() in scripts/bewijsmatrix.js. */
function sleutelsUitKaart(kaart) {
  const uit = [];
  for (const r of kaart.routes || []) {
    for (const m of (r.methoden && r.methoden.length ? r.methoden : ['POST'])) {
      uit.push((m === 'ALL' ? 'POST' : m).toUpperCase() + ' ' + r.pad);
    }
  }
  return new Set(uit);
}

/* DE DEFINITIES. Elke definitie is een filter op de router; `null` betekent
   dat het register zijn eigen lijst draagt en er geen filter is om te
   reproduceren (dan wordt die lijst vergeleken met de router op zijn commit). */
const isApi = (k) => k.split(' ')[1].startsWith('/api/');
const DEFINITIES = {
  router: { filter: () => true, uitleg: 'alles wat de router kent, elk werkwoord' },
  api: { filter: isApi, uitleg: 'de router, alleen /api/ (routetabel() in scripts/bewijsmatrix.js)' },
  aangeroepen: { filter: null, uitleg: 'wat de idemproef werkelijk aanriep: POST onder /api/, zonder de ' +
    'paden die hij niet kan aanroepen (parameters, schakelkast) -- zie scripts/mutatieinventaris.js' },
  waargenomen: { filter: null, uitleg: 'wat in het routejournaal van een toetsronde langskwam' }
};

/* DE REGISTERS. `commit` en `telling` komen uit het register zelf; `sleutels`
   alleen waar het register zijn routes met naam draagt. */
const REGISTERS = [
  { naam: 'MUTATIEINVENTARIS.json', definitie: 'router',
    telling: (j) => j.inventarissen && j.inventarissen.route, sleutels: null },
  { naam: 'ROUTEBRON.json', definitie: 'router',
    telling: (j) => (j.alleRoutes || []).length, sleutels: (j) => j.alleRoutes },
  { naam: 'BEWIJSMATRIX.json', definitie: 'api', telling: (j) => j.routes, sleutels: null },
  { naam: 'VERTROUWEN.json', definitie: 'api', telling: (j) => j.routes,
    sleutels: (j) => Object.keys(j.perRoute || {}),
    /* VERTROUWEN.json draagt geen eigen routelijst-commit: hij rekent over
       bouw() van de bewijsmatrix op het moment van vastleggen. */ },
  { naam: 'IDEMPROEF.json', definitie: 'aangeroepen',
    telling: (j) => (j.perRoute || []).length,
    sleutels: (j) => (j.perRoute || []).map((r) => r.methode + ' ' + r.pad) },
  { naam: 'EXECUTION_MAP.json', definitie: 'aangeroepen', afgeleidVan: 'IDEMPROEF.json',
    telling: (j) => (j.capabilities || []).length,
    sleutels: (j) => (j.capabilities || []).map((c) => 'POST ' + c.pad) },
  { naam: 'OUTPUTPROEF.json', definitie: 'waargenomen',
    telling: (j) => j.routes, sleutels: (j) => Object.keys(j.perRoute || {}) }
];

function commitVan(j) {
  const s = j && (j.stempel || (j.gemeten && j.gemeten.op ? j.gemeten : null));
  return s && s.commit ? String(s.commit) : null;
}

/* Waarom een aangeroepen-register een route van de router NIET heeft: de twee
   uitsluitingen die de idemproef zelf opschrijft. Wat daar niet onder valt,
   wordt niet verzonnen. */
function waaromNietAangeroepen(k, isSchakel) {
  const [m, p] = k.split(' ');
  if (!p.startsWith('/api/')) return 'buiten /api/';
  if (m !== 'POST') return 'geen POST';
  if (p.includes(':')) return 'pad met parameter';
  if (isSchakel && isSchakel(p)) return 'schakelkast';
  return null;
}

/* Routes die alleen onder NODE_ENV=test bestaan (server/server.js: /api/test/bug
   en /api/test/crash). De router in gewone stand kent ze niet, een toetsronde
   wel -- dus een register dat uit een toetsronde komt draagt ze. Zelfde grens
   als BUITEN in server/kern/routedekking.js. */
const alleenToetsstand = (k) => String(k.split(' ')[1] || '').startsWith('/api/test/');

/* DE KERN, als pure functie: deel het verschil tussen een register en de
   canonieke noemer op HEAD in. `opCommit` is de router op de meetcommit (of
   null als die niet te reconstrueren was), `opHead` de router op HEAD.

   Terug: { gereproduceerd, leeftijd: {nieuw, verdwenen}, definitie: {..},
            onverklaard: [..] } */
function deelIn({ register, telling, sleutels, opCommit, opHead, definitie, isSchakel }) {
  const def = DEFINITIES[definitie];
  const uit = { register, telling, definitie, uitleg: def.uitleg };
  if (!opCommit) {
    return { ...uit, vastTeStellen: false, reden: 'de router op de meetcommit is niet te reconstrueren' };
  }
  const opDeCommit = def.filter ? new Set([...opCommit].filter(def.filter)) : null;
  const eigen = sleutels ? new Set(sleutels) : null;

  /* 1. Reproduceert het getal op zijn eigen commit? */
  if (opDeCommit) {
    uit.gereproduceerd = opDeCommit.size === telling;
    uit.opCommit = opDeCommit.size;
    if (eigen) {
      uit.alleenRegister = [...eigen].filter((k) => !opDeCommit.has(k) && !alleenToetsstand(k)).sort();
      uit.alleenRouter = [...opDeCommit].filter((k) => !eigen.has(k)).sort();
    }
  } else {
    /* een eigen lijst: elke route van de router op die commit die er NIET in
       staat, moet een uitsluiting hebben die het register zelf kent */
    const eigenLijst = eigen || new Set();
    const mist = [...opCommit].filter((k) => !eigenLijst.has(k));
    const redenen = {};
    const zonder = [];
    for (const k of mist) {
      const w = definitie === 'aangeroepen' ? waaromNietAangeroepen(k, isSchakel) : null;
      if (w) redenen[w] = (redenen[w] || 0) + 1; else zonder.push(k);
    }
    if (definitie === 'waargenomen' && zonder.length) {
      redenen['niet waargenomen in de toetsronde'] = zonder.length;
      zonder.length = 0;
    }
    const toets = [...eigenLijst].filter((k) => !opCommit.has(k) && alleenToetsstand(k));
    if (toets.length) redenen['alleen onder NODE_ENV=test'] = toets.length;
    uit.opCommit = opCommit.size;
    uit.buitenDefinitie = redenen;
    uit.nietWaargenomen = zonder.sort();
    uit.alleenRegister = [...eigenLijst].filter((k) => !opCommit.has(k) && !alleenToetsstand(k)).sort();
    uit.gereproduceerd = uit.alleenRegister.length === 0 &&
      (definitie !== 'aangeroepen' || zonder.length === 0);
  }

  /* 2. Leeftijd: wat de router tussen meetcommit en HEAD won of verloor,
        binnen de definitie van dit register. */
  const f = def.filter || ((k) => (definitie === 'aangeroepen' ? !waaromNietAangeroepen(k, isSchakel) : true));
  const h = new Set([...opHead].filter(f));
  const c = new Set([...opCommit].filter(f));
  uit.leeftijd = {
    nieuwSindsMeting: [...h].filter((k) => !c.has(k)).length,
    verdwenenSindsMeting: [...c].filter((k) => !h.has(k)).length
  };
  /* 3. Definitie: wat de router op HEAD kent en dit begrip met opzet niet telt. */
  uit.definitieVerschil = opHead.size - h.size;

  /* 4. Onverklaard. Bij een eigen lijst: routes in het register die de router
        op zijn eigen commit niet kende (dat kan geen leeftijd zijn), plus bij
        een aangeroepen-register routes zonder uitsluitingsreden. Bij een
        filterdefinitie: het getal reproduceert niet. */
  const onverklaard = [...(uit.alleenRegister || [])];
  if (definitie === 'aangeroepen') onverklaard.push(...(uit.nietWaargenomen || []));
  if (def.filter && !uit.gereproduceerd && !eigen) onverklaard.push('telling ' + telling + ' tegen ' + uit.opCommit);
  if (def.filter && eigen) onverklaard.push(...uit.alleenRouter);
  uit.onverklaard = onverklaard;
  uit.vastTeStellen = true;
  return uit;
}

/* De router op een commit, via een wegwerp-worktree. HEAD gebruikt de boom zelf. */
function routerOp(commit, cache) {
  if (cache.has(commit)) return cache.get(commit);
  let dir = WORTEL, weg = null;
  if (commit !== 'HEAD') {
    try { execFileSync('git', ['cat-file', '-e', commit + '^{commit}'], { cwd: WORTEL, stdio: 'ignore' }); }
    catch (e) { cache.set(commit, null); return null; }
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routenoemer-'));
    weg = dir;
    execFileSync('git', ['worktree', 'add', '-q', '--detach', dir, commit], { cwd: WORTEL, stdio: 'ignore' });
    fs.symlinkSync(path.join(WORTEL, 'node_modules'), path.join(dir, 'node_modules'));
  }
  let set = null;
  try {
    const rauw = execFileSync(process.execPath, [path.join(dir, 'scripts/routekaart.js'), '--json'],
      { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000, stdio: ['ignore', 'pipe', 'ignore'] });
    set = sleutelsUitKaart(JSON.parse(rauw));
  } catch (e) { set = null; }
  if (weg) {
    try { execFileSync('git', ['worktree', 'remove', '--force', weg], { cwd: WORTEL, stdio: 'ignore' }); } catch (e) { /* opruimen mag falen */ }
  }
  cache.set(commit, set);
  return set;
}

function meet() {
  const { isSchakel } = require('./lib/routes');
  const cache = new Map();
  const opHead = routerOp('HEAD', cache);
  if (!opHead) return { vastTeStellen: false, reden: 'de router op HEAD viel om' };
  const rijen = [];
  for (const r of REGISTERS) {
    const j = lees(r.naam);
    if (!j) { rijen.push({ register: r.naam, vastTeStellen: false, reden: 'register ontbreekt' }); continue; }
    const commit = commitVan(j) || (r.afgeleidVan ? commitVan(lees(r.afgeleidVan)) : null);
    const opCommit = commit ? routerOp(commit, cache) : null;
    const rij = deelIn({ register: r.naam, telling: r.telling(j), sleutels: r.sleutels ? r.sleutels(j) : null,
      opCommit, opHead, definitie: r.definitie, isSchakel });
    rij.commit = kort(commit) || null;
    if (r.afgeleidVan) rij.afgeleidVan = r.afgeleidVan;
    if (!commit) { rij.vastTeStellen = false; rij.reden = 'het register draagt geen commit in zijn stempel'; }
    rijen.push(rij);
  }
  const canoniek = {
    bestaat: { noemer: opHead.size, bron: 'de router op HEAD (scripts/routekaart.js)' },
    onderBewijs: { noemer: [...opHead].filter(isApi).length,
      bron: 'de router op HEAD, alleen /api/ -- de definitie van BEWIJSMATRIX.json en VERTROUWEN.json' },
    aangeroepen: { noemer: [...opHead].filter((k) => !waaromNietAangeroepen(k, isSchakel)).length,
      bron: 'POST onder /api/ zonder parameter of schakelkast -- wat de idemproef KAN aanroepen' }
  };
  const onverklaard = rijen.reduce((n, r) => n + ((r.onverklaard && r.onverklaard.length) || 0), 0);
  return { vastTeStellen: true, head: opHead.size, canoniek, rijen, onverklaard };
}

function main() {
  const u = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); return u.vastTeStellen ? (u.onverklaard ? 1 : 0) : 2; }
  console.log('\n  DE NOEMERWAARHEID -- per register: definitie, meetcommit, en wat het verschil met HEAD is\n');
  if (!u.vastTeStellen) { console.log('  niet vast te stellen: ' + u.reden + '\n'); return 2; }
  console.log('  canoniek per begrip (op HEAD):');
  for (const [k, v] of Object.entries(u.canoniek)) console.log('    ' + k.padEnd(12) + String(v.noemer).padStart(6) + '  ' + v.bron);
  console.log('');
  for (const r of u.rijen) {
    console.log('  ' + r.register.padEnd(24) + String(r.telling == null ? '?' : r.telling).padStart(6) +
      '  ' + (r.definitie || '').padEnd(12) + ' op ' + (r.commit || '?'));
    if (!r.vastTeStellen) { console.log('      niet vast te stellen: ' + r.reden); continue; }
    console.log('      gereproduceerd op zijn eigen commit: ' + (r.gereproduceerd ? 'ja' : 'NEE') +
      ' (router daar: ' + r.opCommit + ')');
    if (r.buitenDefinitie && Object.keys(r.buitenDefinitie).length) {
      console.log('      buiten de definitie: ' + Object.entries(r.buitenDefinitie).map(([k, v]) => k + ' ' + v).join(', '));
    }
    console.log('      leeftijd: +' + r.leeftijd.nieuwSindsMeting + ' nieuw, -' + r.leeftijd.verdwenenSindsMeting +
      ' verdwenen sinds de meting; definitie laat op HEAD ' + r.definitieVerschil + ' routes buiten');
    if (r.onverklaard.length) {
      console.log('      ONVERKLAARD ' + r.onverklaard.length + ': ' + r.onverklaard.slice(0, 6).join(' | ') +
        (r.onverklaard.length > 6 ? ' ...' : ''));
    }
  }
  console.log('\n  onverklaard in totaal: ' + u.onverklaard + '\n');
  return u.onverklaard ? 1 : 0;
}

module.exports = { deelIn, alleenToetsstand, sleutelsUitKaart, waaromNietAangeroepen, DEFINITIES, REGISTERS };

if (require.main === module) process.exitCode = main();
