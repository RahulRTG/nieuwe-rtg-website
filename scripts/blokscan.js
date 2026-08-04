#!/usr/bin/env node
/* ============================================================================
   DE BLOKSCAN -- wat gaat er in een stuk code, wat komt eruit, en welke draden
   lopen er terug?

   WAAROM DIT ER IS

   server/server.js wordt op zijn naden opgeknipt. Voor de eerste vier sneden
   ging dat op het oog: knip, draai, lees de foutmelding, voeg een naam toe,
   herhaal. Bij het vijfde blok liep dat vast. Dat blok gebruikt zesendertig
   namen die het zelf niet maakt en levert er vierenvijftig op, en met een
   serverstart van veertig seconden per poging kost elke ontbrekende naam een
   minuut. Erger: op het oog zie je de DERDE soort niet -- een naam die het blok
   TOEWIJST terwijl hij ergens anders gedeclareerd staat. Zo'n draad terug breekt
   pas als je verplaatst, en dan lijkt het of de code stuk is.

   Dus wordt het uitgerekend, met de AST-gereedschappen van dit huis zelf
   (scripts/ast/). Drie lijsten, in een keer:

     NODIG    namen die het blok gebruikt maar niet zelf declareert. Dat is de
              parameterlijst van de module die je ervan maakt.
     ERUIT    namen die het blok declareert en die ERBUITEN nog gebruikt worden.
              Dat is de return-lijst. Niet alles wat het declareert: wat alleen
              binnen leeft, hoort ook binnen te blijven.
     DRADEN   namen die het blok toewijst maar die buiten gedeclareerd zijn.
              Die moet je met de hand omdraaien -- bouwen binnen, zetten buiten.

   WAT DIT NIET IS. Geen scope-analyse tot in de hoeken: een naam die binnen een
   functie in het blok wordt geschaduwd, telt hier als gedeclareerd. Voor het
   doel (welke namen moeten door de deur) is dat de goede kant om te missen: je
   krijgt hooguit een naam te weinig in NODIG, en dat merk je meteen bij de
   eerste start. Andersom -- een naam te weinig in DRADEN -- kan niet, want die
   lijst komt uit toewijzingen en niet uit gebruik.

   DRAAIEN

     node scripts/blokscan.js server/server.js 773 1040
     node scripts/blokscan.js server/server.js 773 1040 --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { parse } = require('./ast/parser');

/* Eigen wandeling in plaats van ast/walk.js: die geeft de voorouders mee maar
   niet onder WELKE sleutel een knoop hangt, en juist dat verschil bepaalt of
   een Identifier een naam is of een eigenschap. `obj.notify` en `notify()`
   zien er in de boom hetzelfde uit tot je weet dat de eerste onder `property`
   van een niet-berekende MemberExpression hangt. Zonder dat onderscheid stond
   de halve standaardbibliotheek in de lijst. */
function wandel(node, bezoek, ouder, sleutel, diepte) {
  diepte = diepte || 0;
  if (Array.isArray(node)) { for (const x of node) wandel(x, bezoek, ouder, sleutel, diepte); return; }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  bezoek(node, ouder, sleutel, diepte);
  /* Elke functie is een nieuwe laag. De diepte telt mee omdat een `const req`
     BINNEN een handler iets anders is dan een `const notify` op het niveau van
     het blok: alleen die tweede hoort straks door de deur. Zonder dit onderscheid
     stonden req, res, next, err en een stuk of vijftien andere lusvariabelen in
     de return-lijst -- allemaal namen die buiten ook bestaan, en die dus
     "gedeclareerd binnen, gebruikt buiten" leken. */
  const dieper = /Function/.test(node.type) ? diepte + 1 : diepte;
  for (const k in node) {
    if (k === 'start' || k === 'end' || k === 'lijn' || k === 'type') continue;
    const v = node[k];
    if (v && typeof v === 'object') wandel(v, bezoek, node, k, dieper);
  }
}

/* Een bindingspatroon kan een naam zijn, of een uitgepakt object/array. */
function namenUit(p, uit) {
  if (!p) return uit;
  if (p.type === 'Identifier') uit.add(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties || []) namenUit(q.value || q.key || q, uit);
  else if (p.type === 'ArrayPattern') for (const q of p.elements || []) namenUit(q, uit);
  else if (p.type === 'AssignmentPattern') namenUit(p.left, uit);
  else if (p.type === 'RestElement') namenUit(p.argument, uit);
  else if (p.type === 'Property') namenUit(p.value || p.key, uit);
  return uit;
}

/* Is deze Identifier een NAAM (een verwijzing naar een binding), of staat hij
   er als eigenschap/sleutel? */
function isVerwijzing(node, ouder, sleutel) {
  if (!ouder) return true;
  if (ouder.type === 'MemberExpression' && sleutel === 'property' && !ouder.computed) return false;
  if (ouder.type === 'Property' && sleutel === 'key' && !ouder.computed && !ouder.shorthand) return false;
  if (ouder.type === 'MethodDefinition' && sleutel === 'key' && !ouder.computed) return false;
  /* Een functienaam en parameters zijn declaraties, geen verwijzingen; die
     komen al via namenUit() binnen. */
  if (/Function/.test(ouder.type) && (sleutel === 'id' || sleutel === 'params')) return false;
  if (ouder.type === 'VariableDeclarator' && sleutel === 'id') return false;
  if (ouder.type === 'ClassDeclaration' && sleutel === 'id') return false;
  return true;
}

function analyseer(bron) {
  const boom = parse('(function(){\n' + bron + '\n})();');
  const gedeclareerd = new Set(), gebruikt = new Set(), toegewezen = new Set();
  const bovenste = new Set();   // alleen wat op het niveau van het blok zelf staat
  wandel(boom, (n, ouder, sleutel, diepte) => {
    const top = diepte <= 1;    // 1 = de omhullende functie die parse() eromheen zet
    if (/Function/.test(n.type)) {
      if (n.id && n.id.name) { gedeclareerd.add(n.id.name); if (top) bovenste.add(n.id.name); }
      for (const p of (n.params || [])) namenUit(p, gedeclareerd);
    }
    if (n.type === 'VariableDeclarator') { namenUit(n.id, gedeclareerd); if (top) namenUit(n.id, bovenste); }
    if (n.type === 'ClassDeclaration' && n.id) { gedeclareerd.add(n.id.name); if (top) bovenste.add(n.id.name); }
    if (n.type === 'CatchClause' && n.param) namenUit(n.param, gedeclareerd);
    /* Een toewijzing aan een KALE naam (niet aan een eigenschap): dat is de
       vorm die een draad terug maakt. `x = 1` telt, `x.y = 1` niet. */
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'Identifier') {
      toegewezen.add(n.left.name);
    }
    if (n.type === 'Identifier' && isVerwijzing(n, ouder, sleutel)) gebruikt.add(n.name);
  });
  return { gedeclareerd, gebruikt, toegewezen, bovenste };
}

const GLOBAAL = new Set(['require', 'module', 'exports', 'process', 'console', 'JSON', 'Math', 'Date',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet',
  'Error', 'TypeError', 'RangeError', 'RegExp', 'Symbol', 'Proxy', 'Reflect', 'Intl', 'BigInt',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask',
  'Buffer', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'AbortController', 'AbortSignal',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'undefined', 'NaN', 'Infinity', 'globalThis', 'structuredClone',
  '__dirname', '__filename', 'arguments', 'this']);

function main() {
  const [bestand, van, tot] = process.argv.slice(2);
  const jsonUit = process.argv.includes('--json');
  if (!bestand || !van || !tot) {
    console.error('gebruik: node scripts/blokscan.js <bestand> <eersteRegel> <laatsteRegel> [--json]');
    return 2;
  }
  const vol = path.isAbsolute(bestand) ? bestand : path.join(WORTEL, bestand);
  const regels = fs.readFileSync(vol, 'utf8').split('\n');
  const a = Number(van) - 1, b = Number(tot);
  /* Een leeg blok is geen "niets nodig" maar een kapotte opgave (LAT.md regel
     3). Zonder deze regel geeft een verkeerd regelnummer een keurig leeg
     rapport, en dat leest als goed nieuws. */
  if (!(a >= 0 && b > a && b <= regels.length)) {
    console.error('regelbereik valt buiten het bestand (' + regels.length + ' regels).');
    return 2;
  }
  const binnen = regels.slice(a, b).join('\n');
  const buiten = regels.slice(0, a).concat(regels.slice(b)).join('\n');
  if (!binnen.trim()) { console.error('het blok is leeg; dat is geen meting.'); return 2; }

  const bi = analyseer(binnen);
  const bu = analyseer(buiten);

  const nodig = [...bi.gebruikt].filter(n => !bi.gedeclareerd.has(n) && !GLOBAAL.has(n)).sort();
  const eruit = [...bi.bovenste].filter(n => bu.gebruikt.has(n)).sort();
  const draden = [...bi.toegewezen].filter(n => !bi.gedeclareerd.has(n) && bu.gedeclareerd.has(n)).sort();
  /* Wat het blok declareert en buiten NIET gebruikt wordt: dat hoeft niet mee
     naar buiten. Het staat er als aparte lijst omdat het de return korter maakt
     en laat zien wat echt van het blok zelf is. */
  const intern = [...bi.bovenste].filter(n => !bu.gebruikt.has(n)).sort();

  if (jsonUit) { console.log(JSON.stringify({ nodig, eruit, draden, intern }, null, 2)); return 0; }
  const toon = (kop, lijst, uitleg) => {
    console.log('\n  \x1b[1m' + kop + '\x1b[0m \x1b[2m(' + lijst.length + ') -- ' + uitleg + '\x1b[0m');
    if (!lijst.length) { console.log('    \x1b[2m(geen)\x1b[0m'); return; }
    let r = '   ';
    for (const n of lijst) { if ((r + n).length > 96) { console.log(r); r = '   '; } r += ' ' + n; }
    console.log(r);
  };
  console.log('\n\x1b[1mBLOKSCAN\x1b[0m \x1b[2m-- ' + bestand + ' r' + van + '-' + tot + ' (' + (b - a) + ' regels)\x1b[0m');
  toon('NODIG', nodig, 'de parameterlijst van de nieuwe module');
  toon('ERUIT', eruit, 'de return-lijst: hier gemaakt, buiten gebruikt');
  toon('DRADEN', draden, 'hier toegewezen, BUITEN gedeclareerd -- met de hand omdraaien');
  toon('intern', intern, 'blijft binnen; hoeft niet mee naar buiten');
  console.log('');
  return draden.length ? 1 : 0;   // draden zijn geen fout, wel iets om te zien
}

if (require.main === module) process.exit(main());
module.exports = { analyseer };
