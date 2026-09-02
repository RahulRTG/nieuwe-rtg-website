#!/usr/bin/env node
/* ============================================================================
   DE VERSTRENGELING -- welke delen van RTG kunnen elkaar wakker maken, en
   hoeveel daarvan is VERKLAARD.

   WAAROM DIT ER IS

   RTG gaat in treden online (LAUNCH.md). Een trede aanzetten is alleen een
   kleine handeling als achter die trede ook werkelijk weinig wakker wordt. De
   buitenpoort is er al -- server/functies/toegang.js schakelt per functie op zes
   assen plus een canary -- maar zodra een verzoek die poort voorbij is, staat
   heel server/ voor hem open. Er is geen binnenpoort.

   Voordat er een binnenpoort komt, hoort de vraag beantwoord: hoe verstrengeld
   is dit huis eigenlijk? Dezelfde volgorde als bij OBJECTMODEL.json (waar `Asset`
   sneuvelde) en SEMANTIEK.json (waar VERMOGENS sneuvelde): eerst meten, dan pas
   een laag verzinnen.

   DE FOUT DIE DE EERSTE VERSIE MAAKTE, EN WAAROM HIJ HIER STAAT

   Een eerste ronde nam het eerste padsegment als domein en meldde als zwaarste
   verstrengeling `supplier -> horeca` (37 randen). Dat is geen verstrengeling:
   het is server/routes/supplier dat server/kern/horeca aanroept -- een INGANG
   die zijn eigen domein gebruikt. Precies waar een ingang voor is.

   Een knoop is hier daarom altijd LAAG + DOMEIN, nooit domein alleen. Wie de
   laag weglaat, meet de architectuur weg die er al is en gaat daarna spaghetti
   opruimen die niet bestaat.

     ingang    server/routes/<rol>/...   waar de buitenwereld binnenkomt
     domein    server/kern/<domein>/...  waar de bedrijfslogica woont
     motor     server/<naam>.js, lib/    de machine eronder (ai, betaal, db, mail)
     opzet     server/opzet/...          de ophanglijsten; volgorde IS de inhoud

   Daaruit volgt de richting die deugt (omlaag: ingang -> domein -> motor) en de
   richting die niet deugt (omhoog: een domein dat een ingang nodig heeft). Die
   tweede hoort nul te zijn en is een eigen uitslag, geen voetnoot.

   WAT ER GEMETEN WORDT EN WAT NIET

   Gemeten wordt de STATISCHE require-graaf. Dat is met opzet de ondergrens en
   niet de waarheid: een aanroep via de bus (kern/envelop.js), via een cron of
   via een AI-gereedschap staat er niet in. Zo'n rand is onzichtbaar voor deze
   meter, en daarom draagt de uitslag `randenGemeten: 'require'` -- wie hier
   "RTG is verstrengeld voor N randen" van maakt, telt de gevaarlijkste soort
   niet mee. Die tweede helft is stap 6 van de keten (activering), niet deze.

   DE SOORTEN, EN WELKE DAARVAN EEN MACHINE MAG TOEKENNEN

   Elke rand krijgt een soort. Drie ervan zijn AFLEIDBAAR met een grond die je
   kunt nalezen; de rest is een menselijk oordeel en wordt daarom NOOIT door dit
   script geraden -- die komen uit scripts/lib/verstrengeling-verklaringen.js of
   ze heten ONBEKEND.

     LAAGRAND            afgeleid  de laag onder je aanroepen; waar lagen voor zijn
     EIGEN_DATA          afgeleid  <domein> -> <domein>-data / -rijen / -lijst
     GEDEELDE_PRIMITIEF  afgeleid  het doel wordt door >= DREMPEL domeinen gebruikt
     ORKESTRATIE         afgeleid  bron is server/opzet: een ophanglijst
     DOMEINRELATIE       verklaard twee domeinen die elkaar echt nodig hebben
     PRESENTATIE         verklaard
     BELEID              verklaard
     BEWIJS              verklaard
     LEGACY              verklaard  bekend, fout, en niet vandaag op te lossen
     ONBEKEND            de restpost

   ONBEKEND is het getal dat naar nul moet. NIET het aantal kruisdomeinranden --
   een huis waarin domeinen elkaar nooit nodig hebben, is geen huis maar een map
   met losse programma's. Hetzelfde onderscheid als bij MUTATIECONTRACT.md:
   100% geclassificeerd, niet 100% idempotent.

   GEDEELDE_PRIMITIEF IS EEN METING EN GEEN PROMOTIE

   Een doel dat door veel domeinen wordt gebruikt, KRIJGT hier die soort omdat
   het meetbaar zo is -- niet omdat iemand het core heeft genoemd. Het is een
   kandidaatstatus: SEMANTIEK.json laat zien dat hetzelfde woord op drie plekken
   nog geen gedeelde betekenis is. Promoveren naar een echte kern is een besluit
   met meer eisen (stap 9 van de keten) en gebeurt niet in deze meter.

   DE TWEE VLAGGEN DIE ERTOE DOEN

     lek         een gemeten primitief die een gewoon domein nodig heeft. Iets
                 dat door twintig domeinen wordt gebruikt en er zelf een nodig
                 heeft, sleept dat domein overal mee naartoe.
     wederkerig  A -> B en B -> A. Twee knopen die niet los te trekken zijn,
                 en dus voor een trede altijd samen aan of samen uit.

   DE OMGEKEERDE VRAAG STAAT ER OOK IN, en die is voor een trede de
   belangrijkste. Niet "wat heeft dit domein nodig" maar: WAT BREEKT ALS DIT
   DOMEIN ER NIET IS. Dat is de transitieve terugwaartse bereikbaarheid, en hij
   is hard: een require naar een module die er niet is, faalt bij het LADEN --
   niet bij het aanroepen. Een domein dat door tweehonderd knopen bereikt wordt,
   is geen domein meer maar een verborgen kern, en dat is een besluit (zeg dat
   het kern is) of werk (breng de koppelingen terug).

   Wat deze omkering NIET dekt: de kern-tas. Een route die zijn domein via de
   tas krijgt, laadt gewoon en valt pas om bij de eerste aanroep. Die kant staat
   in ACTIVERING.json onder `perDomein` -- welke FUNCTIES een domein in hun
   envelop hebben. Twee soorten breuk, twee registers, met opzet niet opgeteld.

   Draai: npm run verstrengeling            (rapport)
          npm run verstrengeling:vast       (schrijft VERSTRENGELING.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const BRON = path.join(WORTEL, 'server');

/* Vanaf hoeveel GEBRUIKENDE domeinen heet een doel een gedeelde primitief.
   Drie is de ondergrens waarop "gedeeld" iets anders betekent dan "twee modules
   die toevallig samenwerken"; dezelfde drempel als de core-kandidaat in de
   keten. Hij staat hier als constante zodat een toets hem kan bewegen en zien
   wat er dan verschuift. */
const PRIMITIEF_VANAF = 3;

/* De mappen onder server/ die geen code van dit huis zijn. */
const OVERSLAAN = new Set(['data', 'node_modules']);

/* ------------------------------------------------------------- de knopen -- */

/* Laag + domein van een bestand, of null als het niet meetelt. De volgorde van
   deze takken is de hele afspraak: kern en routes worden op hun TWEEDE segment
   benoemd, al het andere op zijn eerste. */
function knoopVan(rel) {
  const d = rel.replace(/\\/g, '/').split('/');
  if (d[0] !== 'server') return null;
  const seg = d.slice(1);
  if (!seg.length) return null;
  if (OVERSLAAN.has(seg[0])) return null;
  const kaal = s => s.replace(/\.js$/, '');
  if (seg[0] === 'opzet') return { laag: 'opzet', domein: 'opzet' };
  /* server.js is geen module maar de bedrading van de hele app -- scripts/check.js
     regel 396 zegt dat met zoveel woorden. Wie hem als motor telt, krijgt 93
     uitgaande randen die allemaal 'onverklaard' heten terwijl bedraden precies
     zijn taak is, plus een valse rand OMHOOG naar opzet. */
  if (seg.length === 1 && seg[0] === 'server.js') return { laag: 'opzet', domein: 'server.js' };
  if (seg[0] === 'routes') return seg.length > 1 ? { laag: 'ingang', domein: kaal(seg[1]) } : null;
  if (seg[0] === 'kern') return seg.length > 1 ? { laag: 'domein', domein: kaal(seg[1]) } : null;
  const dom = kaal(seg[0]);
  return { laag: LAAGCORRECTIE[dom] || 'motor', domein: dom };
}

/* DE LAAG VAN EEN MAP BUITEN kern/ EN routes/ IS NIET AF TE LEIDEN.

   server/school/ (59 bestanden), server/bedrijf/ (45) en server/foundation/ (21)
   zijn domeinen: bedrijfslogica die alleen niet in server/kern/ woont. Het pad
   zegt dat niet, en raden zou hier 40 valse randen OMHOOG opleveren -- een
   domein dat een ander domein aanroept ziet er dan uit als een motor die
   omhoog grijpt.

   Daarom een tabel met een reden per regel, en geen heuristiek. Wie hier een
   map bij zet, doet een uitspraak die je kunt nalezen. */
const LAAGCORRECTIE = {
  school: 'domein',      // 59 bestanden bedrijfslogica van RTG School; woont buiten kern/
  bedrijf: 'domein',     // 45 bestanden zakelijke logica; woont buiten kern/
  foundation: 'domein'   // 21 bestanden RTFoundation-logica; woont buiten kern/
};

const id = k => k.laag + ':' + k.domein;

/* De lagen van boven naar beneden. Een rand omlaag of opzij is normaal; een
   rand OMHOOG is de bevinding. */
const HOOGTE = { opzet: 0, ingang: 1, domein: 2, motor: 3 };

/* --------------------------------------------------------------- de randen -- */

function bestanden(map, uit = []) {
  for (const e of fs.readdirSync(map, { withFileTypes: true })) {
    if (OVERSLAAN.has(e.name)) continue;
    const p = path.join(map, e.name);
    if (e.isDirectory()) bestanden(p, uit);
    else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Leest alle relatieve requires uit server/ en levert ruwe randen: van welk
   BESTAND naar welk BESTAND. De vertaling naar knopen gebeurt pas in analyse(),
   zodat een toets die vertaling los kan voeden. */
function lees(wortel = BRON) {
  const randen = [];
  for (const f of bestanden(wortel)) {
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const doelPad = path.normalize(path.join(path.dirname(f), m[1]));
      randen.push({ van: rel, naar: path.relative(WORTEL, doelPad).replace(/\\/g, '/') });
    }
  }
  return randen;
}

/* ------------------------------------------------------------- de analyse -- */

function analyse(ruweRanden, verklaringen = []) {
  /* De verklaringen op sleutel, zodat een dubbele regel opvalt in plaats van
     stil de vorige te overschrijven. */
  const verklaard = new Map();
  const dubbeleVerklaringen = [];
  for (const v of verklaringen) {
    const sleutel = v.van + ' -> ' + v.naar;
    if (verklaard.has(sleutel)) dubbeleVerklaringen.push(sleutel);
    verklaard.set(sleutel, v);
  }

  /* Ronde 1: randen tussen knopen, ontdubbeld op knooppaar maar met het aantal
     bestandsverwijzingen erbij (een rand van 37 bestanden is iets anders dan
     een rand van 1). */
  const paren = new Map();
  let binnenKnoop = 0, buitenBereik = 0;
  for (const r of ruweRanden) {
    const a = knoopVan(r.van), b = knoopVan(r.naar);
    if (!a || !b) { buitenBereik++; continue; }
    const va = id(a), vb = id(b);
    if (va === vb) { binnenKnoop++; continue; }
    const sleutel = va + ' -> ' + vb;
    const bestaand = paren.get(sleutel);
    if (bestaand) { bestaand.gewicht++; if (bestaand.voorbeeld.length < 3) bestaand.voorbeeld.push(r.van); continue; }
    paren.set(sleutel, { van: va, naar: vb, vanLaag: a.laag, naarLaag: b.laag,
      vanDomein: a.domein, naarDomein: b.domein, gewicht: 1, voorbeeld: [r.van] });
  }

  /* Ronde 2: hoeveel DOMEINEN gebruiken elk doel? Dat getal maakt een doel een
     gemeten primitief, en het moet dus vaststaan voordat er iets ingedeeld
     wordt -- daarom een eigen ronde en geen tussenstand in ronde 1. */
  const gebruikers = new Map();
  for (const p of paren.values()) {
    if (!gebruikers.has(p.naar)) gebruikers.set(p.naar, new Set());
    gebruikers.get(p.naar).add(p.van);
  }
  const fanIn = k => (gebruikers.get(k) ? gebruikers.get(k).size : 0);
  const isPrimitief = k => fanIn(k) >= PRIMITIEF_VANAF;

  /* Ronde 3: de indeling. Elke rand krijgt een soort EN een grond -- een soort
     zonder grond is een mening. */
  const randen = [];
  for (const p of paren.values()) {
    const sleutel = p.van + ' -> ' + p.naar;
    const omhoog = HOOGTE[p.naarLaag] < HOOGTE[p.vanLaag];
    /* EIGEN DATA IS EEN FAMILIEVRAAG EN GEEN ACHTERVOEGSELVRAAG. De eerste
       versie zocht <domein>-data en miste daardoor leerstof-bibliotheek ->
       leerstof-data (14x, de zwaarste onverklaarde rand van de eerste ronde):
       twee delen van EEN domein dat in stukken is geknipt omdat een bestand
       anders over de 10 KB van keuringsregel 13 ging. Die knip is een
       bestandsgrens, geen domeingrens.

       De familie is het stuk voor het eerste koppelteken. Hier stond eerst een
       extra voorwaarde (een van beide moet een koppelteken dragen) met als
       uitleg dat `bank` anders familie van `bankregie` zou zijn. Die uitleg was
       fout en de voorwaarde was dode code: bij `bank` en `bankregie` verschilt
       de familie al, want `bankregie` heeft geen koppelteken om op te knippen.
       Een mutatietoets vond hem -- de regel weghalen liet geen enkele toets
       zakken. Een voorwaarde die nooit iets tegenhoudt, stelt alleen gerust.

       Wat de regel WEL doet: hij trekt korte stammen samen. `ai`, `ai-kort` en
       `ai-budget` heten hier een familie. Dat klopt voor dit huis (het is de
       AI-machine, in stukken geknipt) maar het is de plek waar deze meter het
       meest kan overschatten; daarom staat de familie in de grond van elke
       rand, zodat je hem kunt nalezen in plaats van geloven. */
    const familie = n => n.split('-')[0];
    const eigenData = p.vanLaag === p.naarLaag &&
      familie(p.vanDomein) === familie(p.naarDomein);

    let soort = null, grond = null;
    const v = verklaard.get(sleutel);
    if (v) { soort = v.soort; grond = 'verklaard: ' + v.reden; }
    else if (p.vanLaag === 'opzet') { soort = 'ORKESTRATIE'; grond = 'bron is server/opzet: een ophanglijst, geen module (scripts/check.js noemt kernlaag*.js zo)'; }
    else if (eigenData) { soort = 'EIGEN_DATA'; grond = `zelfde familie ${familie(p.vanDomein)}-*: een bestandsgrens (keuringsregel 13), geen domeingrens`; }
    else if (!omhoog && HOOGTE[p.naarLaag] > HOOGTE[p.vanLaag]) { soort = 'LAAGRAND'; grond = `${p.vanLaag} gebruikt de laag eronder (${p.naarLaag})`; }
    else if (isPrimitief(p.naar)) { soort = 'GEDEELDE_PRIMITIEF'; grond = `${p.naar} wordt door ${fanIn(p.naar)} knopen gebruikt (drempel ${PRIMITIEF_VANAF})`; }
    else { soort = 'ONBEKEND'; grond = 'niemand heeft deze rand verklaard'; }

    randen.push({ ...p, soort, grond, omhoog,
      lek: isPrimitief(p.van) && !isPrimitief(p.naar) && p.vanLaag === p.naarLaag });
  }

  /* Ronde 4: wederkerigheid. Twee knopen die elkaar aanroepen zijn voor een
     trede altijd samen aan of samen uit; dat hoort bij de rand te staan en niet
     in een aparte lijst die niemand naast de eerste legt. */
  const bestaat = new Set(randen.map(r => r.van + ' -> ' + r.naar));
  for (const r of randen) r.wederkerig = bestaat.has(r.naar + ' -> ' + r.van);

  return { randen, fanIn: k => fanIn(k), dubbeleVerklaringen, binnenKnoop, buitenBereik, gebruikers };
}

/* ------------------------------------------------------------------ meten -- */

function meet(wortel = BRON, verklaringen) {
  if (verklaringen === undefined) {
    try { verklaringen = require('./lib/verstrengeling-verklaringen'); }
    catch { verklaringen = []; }
  }
  const a = analyse(lees(wortel), verklaringen);
  const randen = a.randen;

  const perSoort = {};
  for (const r of randen) perSoort[r.soort] = (perSoort[r.soort] || 0) + 1;

  /* Per knoop: hoe breed reikt hij, en hoeveel reikt er naar hem. Die tweede is
     de uitneembaarheidsvraag in het klein -- wie veel gebruikers heeft, gaat
     niet uit zonder gevolgen. */
  const knopen = new Map();
  const knoop = k => { if (!knopen.has(k)) knopen.set(k, { id: k, uit: new Set(), in: new Set(), onbekend: 0 }); return knopen.get(k); };
  for (const r of randen) {
    knoop(r.van).uit.add(r.naar);
    knoop(r.naar).in.add(r.van);
    if (r.soort === 'ONBEKEND') knoop(r.van).onbekend++;
  }

  /* WAT BREEKT ALS DIT ER NIET IS. Terugwaartse sluiting per knoop: wie kan hem
     transitief bereiken. Een eigen ronde omdat het een andere vraag is dan
     'breedte' -- en omdat een knoop die niemand bereikt (uitneembaar) er precies
     zo uit hoort te zien als een knoop die iedereen bereikt (kern), namelijk met
     zijn getal erbij. */
  const terug = new Map();
  for (const r of randen) {
    if (!terug.has(r.naar)) terug.set(r.naar, new Set());
    terug.get(r.naar).add(r.van);
  }
  const uitneembaar = [];
  for (const k of knopen.keys()) {
    const gezien = new Set();
    const rij = [k];
    while (rij.length) {
      const n = rij.pop();
      for (const v of terug.get(n) || []) if (!gezien.has(v)) { gezien.add(v); rij.push(v); }
    }
    gezien.delete(k);
    /* DE EIGEN INGANG TELT NIET ALS SCHADE, en dat is geen versoepeling maar de
       vraag scherp stellen. Wie horeca uitzet, zet de horeca-routes mee uit --
       dat is de bedoeling en geen breuk. De vraag van een trede is welke ANDERE
       domeinen omvallen. Zonder dat onderscheid meldde deze meter dat 542 van de
       544 domeinen iets meeslepen, en dat leest als "niets is uit te nemen"
       terwijl het "elk domein heeft een ingang" betekent.

       Beide getallen blijven staan: `geraakt` is alles, `geraakteDomeinen` is
       wat de trede aangaat. Ze mogen niet door elkaar lopen. */
    const domeinen = [...gezien].filter(x => x.startsWith('domein:'));
    uitneembaar.push({ id: k, direct: (terug.get(k) || new Set()).size, geraakt: gezien.size,
      geraakteDomeinen: domeinen.length, welke: domeinen.sort().slice(0, 25),
      pct: knopen.size ? Math.round((1 - gezien.size / knopen.size) * 100) : 100 });
  }
  uitneembaar.sort((a, b) => b.geraakteDomeinen - a.geraakteDomeinen || b.geraakt - a.geraakt);

  const domeinranden = randen.filter(r => r.vanLaag === 'domein' && r.naarLaag === 'domein');
  const omhoog = randen.filter(r => r.omhoog);

  return {
    gemetenOp: new Date().toISOString().slice(0, 10),
    randenGemeten: 'require',
    randenNietGemeten: 'bus/envelop, cron, AI-gereedschap, webhook -- die staan niet in de require-graaf en zijn hier onzichtbaar',
    primitiefVanaf: PRIMITIEF_VANAF,
    knopen: knopen.size,
    randen: randen.length,
    randenBinnenKnoop: a.binnenKnoop,
    randenBuitenBereik: a.buitenBereik,
    perSoort,
    onbekend: perSoort.ONBEKEND || 0,
    onbekendPct: randen.length ? Math.round((perSoort.ONBEKEND || 0) / randen.length * 100) : 0,
    domeinranden: domeinranden.length,
    domeinrandenOnbekend: domeinranden.filter(r => r.soort === 'ONBEKEND').length,
    randenOmhoog: omhoog.length,
    omhoogLijst: omhoog.map(r => ({ van: r.van, naar: r.naar, gewicht: r.gewicht, voorbeeld: r.voorbeeld[0] }))
      .sort((x, y) => y.gewicht - x.gewicht),
    lekken: randen.filter(r => r.lek).length,
    wederkerig: randen.filter(r => r.wederkerig).length / 2,
    dubbeleVerklaringen: a.dubbeleVerklaringen,
    primitieven: [...a.gebruikers].map(([k, s]) => ({ id: k, gebruikers: s.size }))
      .filter(p => p.gebruikers >= PRIMITIEF_VANAF).sort((x, y) => y.gebruikers - x.gebruikers),
    breedste: [...knopen.values()].map(k => ({ id: k.id, uit: k.uit.size, in: k.in.size, onbekend: k.onbekend }))
      .sort((x, y) => y.uit - x.uit).slice(0, 20),
    domeinknopen: uitneembaar.filter(u => u.id.startsWith('domein:')).length,
    volledigUitneembaar: uitneembaar.filter(u => u.id.startsWith('domein:') && u.geraakteDomeinen === 0).length,
    uitneembaarUitleg: 'geraakt = knopen die dit transitief via require bereiken; die falen bij het LADEN als het er niet is. De kern-tas staat hier niet in -- zie ACTIVERING.json perDomein.',
    uitneembaar,
    werkvoorraad: randen.filter(r => r.soort === 'ONBEKEND')
      .sort((x, y) => y.gewicht - x.gewicht)
      .map(r => ({ van: r.van, naar: r.naar, gewicht: r.gewicht, wederkerig: r.wederkerig, lek: r.lek, voorbeeld: r.voorbeeld })),
    alle: randen.map(r => ({ van: r.van, naar: r.naar, soort: r.soort, grond: r.grond,
      gewicht: r.gewicht, omhoog: r.omhoog, lek: r.lek, wederkerig: r.wederkerig }))
  };
}

/* ---------------------------------------------------------------- rapport -- */

function rapport(r) {
  const L = [];
  L.push('DE VERSTRENGELING -- ' + r.gemetenOp);
  L.push('');
  L.push(`  ${r.knopen} knopen (laag+domein), ${r.randen} randen ertussen.`);
  L.push(`  ${r.randenBinnenKnoop} requires blijven binnen hun eigen knoop en tellen niet mee.`);
  L.push('');
  L.push('  PER SOORT');
  for (const [s, n] of Object.entries(r.perSoort).sort((a, b) => b[1] - a[1]))
    L.push(`    ${String(n).padStart(5)}  ${s}`);
  L.push('');
  L.push(`  ONBEKEND: ${r.onbekend} van ${r.randen} (${r.onbekendPct}%). DIT is het getal dat naar nul moet --`);
  L.push('  niet het aantal randen. Een huis waarin domeinen elkaar nooit nodig hebben,');
  L.push('  is geen huis maar een map met losse programma\'s.');
  L.push('');
  L.push(`  Domein -> domein: ${r.domeinranden} randen, waarvan ${r.domeinrandenOnbekend} onverklaard.`);
  L.push(`  Randen OMHOOG (een laag die zijn eigen aanroeper nodig heeft): ${r.randenOmhoog}. Hoort nul te zijn.`);
  for (const o of r.omhoogLijst.slice(0, 10)) L.push(`      ${o.van} -> ${o.naar}  (${o.gewicht}x, bv. ${o.voorbeeld})`);
  L.push(`  Lekken (een gemeten primitief die een gewoon domein nodig heeft): ${r.lekken}.`);
  L.push(`  Wederkerige paren (altijd samen aan of samen uit): ${r.wederkerig}.`);
  L.push('');
  L.push(`  GEMETEN PRIMITIEVEN (>= ${r.primitiefVanaf} gebruikers). Dit is een KANDIDAATSTATUS en`);
  L.push('  geen promotie tot kern -- zie SEMANTIEK.json voor waarom dat verschil bestaat.');
  for (const p of r.primitieven.slice(0, 15)) L.push(`      ${String(p.gebruikers).padStart(4)}  ${p.id}`);
  L.push('');
  L.push('  BREEDSTE KNOPEN (uit = hoeveel andere knopen hij nodig heeft)');
  for (const k of r.breedste.slice(0, 12))
    L.push(`      ${k.id.padEnd(28)} uit ${String(k.uit).padStart(3)}   in ${String(k.in).padStart(3)}   onverklaard ${k.onbekend}`);
  L.push('');
  L.push('  WAT BREEKT ALS DIT ER NIET IS (transitief, via require; laadtijd)');
  L.push('  De twaalf die het meest meesleuren -- een domein bovenaan deze lijst is geen');
  L.push('  domein meer maar een verborgen kern, en dat is een besluit of werk.');
  for (const u of r.uitneembaar.slice(0, 12))
    L.push(`      ${u.id.padEnd(28)} ${String(u.geraakteDomeinen).padStart(3)} andere domeinen  (${u.geraakt} knopen in totaal)`);
  L.push(`  En de andere kant: ${r.volledigUitneembaar} van de ${r.domeinknopen} domeinen sleept GEEN ANDER DOMEIN mee.`);
  L.push('  Dat is de kant die een trede mogelijk maakt -- maar alleen via require:');
  L.push('  wat een functie via de kern-tas aanroept, breekt pas bij de aanroep (ACTIVERING.json).');
  L.push('');
  L.push('  ZWAARSTE ONVERKLAARDE RANDEN (de werkvoorraad, zwaarste eerst)');
  for (const w of r.werkvoorraad.slice(0, 20))
    L.push(`      ${String(w.gewicht).padStart(3)}x  ${w.van} -> ${w.naar}${w.wederkerig ? '   [wederkerig]' : ''}${w.lek ? '   [lek]' : ''}`);
  if (r.dubbeleVerklaringen.length) {
    L.push('');
    L.push('  LET OP -- dubbele verklaringen (de laatste won, dat hoort niet):');
    for (const d of r.dubbeleVerklaringen) L.push('      ' + d);
  }
  L.push('');
  L.push('  Wat deze meter NIET ziet: ' + r.randenNietGemeten);
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

if (require.main === module) {
  const args = process.argv.slice(2);
  const r = meet();
  if (args.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else if (args.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'VERSTRENGELING.json'), JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(rapport(r) + '\n\nVastgelegd in VERSTRENGELING.json\n');
  } else process.stdout.write(rapport(r) + '\n');
}

module.exports = { lees, analyse, meet, rapport, knoopVan, HOOGTE, PRIMITIEF_VANAF, LAAGCORRECTIE };
