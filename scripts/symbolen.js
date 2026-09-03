#!/usr/bin/env node
/* DE SYMBOOLAS -- welke functie woont waar, en wie hangt van wie af.

   CODEWERELD.json wees uit dat de registers van dit huis samen een ruggengraat
   hebben op de as ROUTE, en dat de as SYMBOOL leeg is: geen enkel register kent
   een functienaam met een plaats. Daardoor kan geen enkele vraag over CODE
   beantwoord worden zonder een bestand te openen -- "wie roept dit aan", "wat
   raakt deze wijziging", "waar staat dit gedrag".

   Dit register vult die as. Het leest de bron deterministisch met de eigen
   parser in scripts/ast/ (geen model, geen dependency) en schrijft wat er
   feitelijk staat.

   DRIE DINGEN DIE HET MET OPZET NIET DOET.

   1. Het raadt geen aanroeper. Een naam in aanroeppositie is een NAAM, niet een
      verwijzing: twee bestanden mogen allebei een `bouw()` hebben. De kanten
      die hier staan zijn require-kanten -- die zijn hard, want ze wijzen naar
      een bestand op schijf. De symbool-naar-symboolgraaf is een volgende stap
      en staat hier niet als halve waarheid.
   2. Het slaat niets stil over. Wat de parser niet aankan, komt in de lijst
      `nietGelezen` MET de reden. De bundeldelen in public/apps/<naam>/ zijn
      daarvan de grootste groep, en dat is geen gebrek van de parser: die
      bestanden zijn fragmenten die middenin een functie beginnen en pas
      samengevoegd een programma vormen (scripts/bundel.js). Een register dat
      ze weglaat, laat 303 bestanden onzichtbaar verdwijnen.
   3. Het beweert niets over routes. De brug route -> bestand woont in
      SCHRIJFANALYSE.json; welke van de symbolen IN dat bestand de route
      afhandelt, is hier niet gemeten en wordt dus niet gesuggereerd.

   Draaien: npm run symbolen -> SYMBOLEN.json */
'use strict';

/* DE WACHT. Dit script rekent en SCHRIJFT bij het laden: er is geen meet()
   die je los kunt aanroepen, alles staat op het hoogste niveau. Een enkele
   laadcontrole (node -e "require('./scripts/symbolen')") zou het register dus
   overschrijven met wat die aanroep toevallig meet -- exact de fout waarmee
   ROLPROEF.json van 3377 beproefde routes terugviel naar 292, en het register
   zag er daarna volkomen normaal uit. Vandaar dat requiren hier niets doet.
   Wie de uitslag in code nodig heeft, leest het register. */
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('./ast/parser');
const { loop } = require('./ast/walk');

const WORTEL = path.join(__dirname, '..');
const BOMEN = ['server', 'public'];

/* De delen van een bundel zijn geen zelfstandige bestanden. Ze worden hier
   benoemd in plaats van stil overgeslagen, zodat het verschil tussen "kon niet"
   en "hoort niet" in de uitslag staat. */
let BUNDELDELEN = new Set();
try {
  const { bundels } = require('./bundel');
  for (const map of Object.values(bundels)) BUNDELDELEN.add('public/' + map);
} catch (e) { /* geen bundelregister: dan is elk fragment gewoon een leesfout */ }
const isBundeldeel = rel => [...BUNDELDELEN].some(m => rel.startsWith(m + '/'));

function bestanden(map) {
  const uit = [];
  (function lees(d) {
    for (const e of fs.readdirSync(path.join(WORTEL, d), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'data' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const rel = d + '/' + e.name;
      if (e.isDirectory()) lees(rel); else if (e.name.endsWith('.js')) uit.push(rel);
    }
  })(map);
  return uit;
}

/* Wat `module.exports` naar buiten brengt -- in DRIE standen, want twee zijn er
   te weinig. Een bestand dat `module.exports = (kern) => {...}` doet, exporteert
   wel degelijk iets, maar zonder namen. Als dat als een lege lijst in het
   register komt, leest het als "exporteert niets", en dat is onwaar voor 2036
   bestanden hier. De vorm staat er daarom bij:

     null                          geen module.exports gevonden
     { vorm: 'functie'|'anders' }  exporteert iets, namen niet af te leiden
     { vorm: 'object', namen: [] } exporteert deze namen

   Bij de eerste twee blijft `geexporteerd` per symbool ONBEKEND in plaats van
   vals nee -- dat verschil is de hele reden dat deze functie bestaat. */
function uitvoer(ast) {
  let gevonden = null, bijgemengd = false;
  loop(ast, n => {
    /* `Object.assign(module.exports, require('./x'))` mengt een heel ander
       bestand bij. Wat daaruit komt is hier niet te zien, dus de lijst is
       vanaf dat moment onvolledig. */
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' &&
        n.callee.object && n.callee.object.name === 'Object' && n.callee.property && n.callee.property.name === 'assign') {
      const doel = (n.arguments || [])[0];
      if (doel && doel.type === 'MemberExpression' && doel.object && doel.object.name === 'module' &&
          doel.property && doel.property.name === 'exports') bijgemengd = true;
    }
    if (n.type !== 'AssignmentExpression' || !n.left || n.left.type !== 'MemberExpression') return;
    const o = n.left.object, p = n.left.property;
    const isModuleExports = o && o.name === 'module' && p && p.name === 'exports';
    const isModuleExportsLid = o && o.type === 'MemberExpression' && o.object && o.object.name === 'module' &&
      o.property && o.property.name === 'exports';
    if (!isModuleExports && !isModuleExportsLid) return;
    /* module.exports.NAAM = ... voegt een naam TOE aan de uitvoer; het vervangt
       de uitvoer niet. */
    if (n.left.object && n.left.object.type === 'MemberExpression' &&
        n.left.object.object && n.left.object.object.name === 'module' &&
        n.left.object.property && n.left.object.property.name === 'exports' &&
        n.left.property && n.left.property.name) {
      const namen = new Set(gevonden && gevonden.namen ? gevonden.namen : []);
      namen.add(n.left.property.name);
      gevonden = { vorm: 'object', namen: [...namen] };
      return;
    }
    if (n.right && n.right.type === 'ObjectExpression') {
      /* Een SPREAD maakt de lijst ONVOLLEDIG: `module.exports = { a, ...users }`
         exporteert meer dan hier staat, en wat erbij komt is statisch niet te
         zien. Een onvolledige lijst als volledig noteren is erger dan geen
         lijst -- daarop meldde de aanroepgraaf tientallen symbolen als
         "bestaat niet" die gewoon via de spread naar buiten komen. */
      const heeftSpread = (n.right.properties || []).some(prop => prop.type === 'SpreadElement');
      const namen = new Set(gevonden && gevonden.namen ? gevonden.namen : []);
      for (const prop of n.right.properties || []) if (prop.key && prop.key.name) namen.add(prop.key.name);
      gevonden = heeftSpread
        ? { vorm: 'object-onvolledig', namen: [...namen], reden: 'een spread (...) voegt namen toe die hier niet te zien zijn' }
        : { vorm: 'object', namen: [...namen] };
    } else if (!gevonden) {
      gevonden = { vorm: /Function|Arrow/.test(n.right && n.right.type || '') ? 'functie' : 'anders', namen: null };
    }
  });
  if (gevonden && bijgemengd && gevonden.vorm === 'object') {
    gevonden = { vorm: 'object-onvolledig', namen: gevonden.namen, reden: 'Object.assign(module.exports, ...) mengt namen bij die hier niet te zien zijn' };
  }
  return gevonden;
}

function symbolenVan(ast) {
  const uit = [];
  loop(ast, (n, pad) => {
    const inKlasse = pad.some(p => p.type === 'ClassDeclaration' || p.type === 'ClassExpression');
    /* `module.exports.zin = function zin(sql) {...}` is een EXPRESSIE en geen
       declaratie; zonder deze tak mist het register zulke functies volledig.
       Gevonden doordat de aanroepgraaf 587 keer meldde dat een ingevoerde naam
       niet bestond -- terwijl hij gewoon zo geschreven was. */
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' &&
        n.left.object && n.left.object.type === 'MemberExpression' &&
        n.left.object.object && n.left.object.object.name === 'module' &&
        n.left.object.property && n.left.object.property.name === 'exports' &&
        n.left.property && n.left.property.name && /Function|Arrow/.test(n.right && n.right.type || '')) {
      uit.push({ naam: n.left.property.name, soort: 'uitvoerfunctie', lijn: n.lijn });
      return;
    }
    if (n.type === 'FunctionDeclaration' && n.id) uit.push({ naam: n.id.name, soort: 'functie', lijn: n.lijn });
    else if (n.type === 'ClassDeclaration' && n.id) uit.push({ naam: n.id.name, soort: 'klasse', lijn: n.lijn });
    else if (n.type === 'MethodDefinition' && n.key && n.key.name) uit.push({ naam: n.key.name, soort: inKlasse ? 'methode' : 'methode', lijn: n.lijn });
    else if (n.type === 'VariableDeclarator' && n.id && n.id.name && n.init && /Function|Arrow/.test(n.init.type))
      uit.push({ naam: n.id.name, soort: n.init.type === 'ArrowFunctionExpression' ? 'pijl' : 'functie', lijn: n.lijn });
  });
  return uit;
}

/* require-kanten: hard, want ze wijzen naar een bestand dat bestaat. Een
   require die nergens heen wijst (een pakket, een dynamisch pad) wordt niet
   als kant geteld en ook niet verzwegen -- hij telt mee als `extern`. */
function kanten(src, rel) {
  const naar = [], extern = [];
  for (const m of src.matchAll(/require\((["'])([^"']+)\1\)/g)) {
    const doel = m[2];
    if (!doel.startsWith('.')) { extern.push(doel); continue; }
    let p = path.normalize(path.join(path.dirname(rel), doel));
    if (!p.endsWith('.js')) p += '.js';
    if (fs.existsSync(path.join(WORTEL, p))) naar.push(p);
    else {
      const idx = p.replace(/\.js$/, '/index.js');
      if (fs.existsSync(path.join(WORTEL, idx))) naar.push(idx); else extern.push(doel);
    }
  }
  return { naar: [...new Set(naar)].sort(), extern: [...new Set(extern)].sort() };
}

const t0 = Date.now();
const perBestand = [], nietGelezen = [];
let totaalSymbolen = 0;
for (const boom of BOMEN) {
  for (const rel of bestanden(boom)) {
    const src = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    let ast;
    try { ast = parse(src, {}); }
    catch (e) {
      nietGelezen.push({ bestand: rel,
        reden: isBundeldeel(rel) ? 'bundeldeel: begint middenin een programma en is pas samengevoegd te lezen (scripts/bundel.js)' : 'parsefout',
        melding: String(e.message).slice(0, 120) });
      continue;
    }
    const sym = symbolenVan(ast), ex = uitvoer(ast), k = kanten(src, rel);
    const namen = ex && ex.vorm === 'object' ? new Set(ex.namen) : null;   // onvolledig telt niet als lijst
    totaalSymbolen += sym.length;
    perBestand.push({ bestand: rel,
      symbolen: sym.map(s => ({ ...s, geexporteerd: namen ? namen.has(s.naam) : 'onbekend' })),
      uitvoer: ex ? { vorm: ex.vorm, namen: ex.namen ? [...ex.namen].sort() : null } : null,
      requires: k.naar, extern: k.extern });
  }
}

/* Wie hangt er van mij af: de omgekeerde require-graaf. Die kant is duurder om
   met de hand te zoeken dan de heenweg, en is precies wat een impactvraag
   nodig heeft. */
const aanroepers = new Map();
for (const b of perBestand) for (const doel of b.requires) {
  if (!aanroepers.has(doel)) aanroepers.set(doel, []);
  aanroepers.get(doel).push(b.bestand);
}
for (const b of perBestand) b.gebruiktDoor = (aanroepers.get(b.bestand) || []).sort();

const bundeldelen = nietGelezen.filter(x => x.reden.startsWith('bundeldeel')).length;
let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const uit = {
  /* Wat voor SOORT bewering doet dit register? `index` = structuur en
     relaties (waar woont wat, wat hangt met wat samen). `meting` = een
     uitspraak over gedrag (schrijft het, klopt het, is het bewezen). Het
     verschil is niet cosmetisch: een index noemt bijna alles en maakt elke
     dekkingsvraag triviaal waar, dus scripts/codewereld.js telt hem apart. */
  soort: 'index',
  uitleg: 'De symboolas van de Codewereld: welke benoemde functie, klasse of methode op welke regel woont, wat een bestand uitvoert, en de require-graaf heen en terug. Deterministisch gelezen met scripts/ast/ -- geen model.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  grens: 'Dit register kent GEEN symbool-naar-symboolaanroepen: een naam in aanroeppositie is geen verwijzing. De kanten hier zijn require-kanten, en die wijzen naar een bestand dat bestaat.',
  gemeten: {
    bestandenGezien: perBestand.length + nietGelezen.length,
    gelezen: perBestand.length,
    nietGelezen: nietGelezen.length,
    waarvanBundeldeel: bundeldelen,
    waarvanParsefout: nietGelezen.length - bundeldelen,
    symbolen: totaalSymbolen,
    bestandenMetUitvoer: perBestand.filter(b => b.uitvoer).length,
    uitvoerMetNamen: perBestand.filter(b => b.uitvoer && b.uitvoer.vorm === 'object').length,
    uitvoerOnvolledig: perBestand.filter(b => b.uitvoer && b.uitvoer.vorm === 'object-onvolledig').length,
    uitvoerZonderNamen: perBestand.filter(b => b.uitvoer && !b.uitvoer.namen).length,
    zonderUitvoer: perBestand.filter(b => !b.uitvoer).length,
    requireKanten: perBestand.reduce((n, b) => n + b.requires.length, 0),
    seconden: Math.round((Date.now() - t0) / 100) / 10
  },
  nietGelezen,
  perBestand
};

fs.writeFileSync(path.join(WORTEL, 'SYMBOLEN.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten;
console.log('SYMBOLEN.json geschreven');
console.log('  gelezen     ', g.gelezen + '/' + g.bestandenGezien, 'bestanden,', g.symbolen, 'symbolen,', g.requireKanten, 'require-kanten in', g.seconden + 's');
console.log('  niet gelezen', g.nietGelezen, '(' + g.waarvanBundeldeel, 'bundeldelen,', g.waarvanParsefout, 'parsefouten)');
console.log('  uitvoer     ', g.uitvoerMetNamen, 'met een volledige namenlijst,', g.uitvoerOnvolledig, 'onvolledig (spread of Object.assign),',
  g.uitvoerZonderNamen, 'zonder namen,', g.zonderUitvoer, 'geen module.exports');
if (g.waarvanParsefout > 0) {
  console.log('\n  Een parsefout buiten een bundeldeel is een BEVINDING, geen ruis:');
  for (const x of nietGelezen.filter(y => !y.reden.startsWith('bundeldeel')).slice(0, 10)) console.log('   ', x.bestand, '--', x.melding);
  process.exitCode = 1;
}
