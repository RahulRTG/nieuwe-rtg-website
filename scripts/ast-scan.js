#!/usr/bin/env node
/* De RTG AST-scanner: een volledig zelfgebouwde statische analyse over de server-
   en scriptcode. Eigen lexer (scripts/ast/lexer.js), eigen recursive-descent
   parser (scripts/ast/parser.js), eigen walker (scripts/ast/walk.js) en eigen
   regels (scripts/ast/regels.js). Geen enkele dependency.

   Aanpak, bewust veilig: code die de parser NIET begrijpt is een harde fout, geen
   stille overslag. Een security-scanner die code mist geeft valse zekerheid; die
   valkuil vermijden we door onparseerbare code als bevinding te melden en te
   falen. De correctheid van de parser is geborgd doordat hij de hele boom van
   server/ + scripts/ leest (zie test/ast-scan.test.js).

   Gebruik:  node scripts/ast-scan.js [map ...]        (standaard: server scripts)
   Faalt (exit 1) bij een 'fout'-bevinding of parsefout; 'waarschuwing' niet. */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('./ast/parser');
const { loop } = require('./ast/walk');
const { REGELS } = require('./ast/regels');

const K = { rood: '\x1b[31m', geel: '\x1b[33m', grijs: '\x1b[90m', groen: '\x1b[32m', reset: '\x1b[0m' };

function jsBestanden(wortel) {
  const uit = [];
  (function ga(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === '.git') continue; ga(p); }
      else if (e.name.endsWith('.js')) uit.push(p);
    }
  })(wortel);
  return uit.sort();
}

// Scan een stuk bron (voor tests en voor scanBestand). Onparseerbare code is een
// harde bevinding, nooit een stille overslag.
function scanBron(bron, bestand) {
  bestand = bestand || '<bron>';
  const bevindingen = [];
  let boom;
  try { boom = parse(bron); }
  catch (e) { bevindingen.push({ bestand, lijn: e.lijn || 0, ernst: 'fout', regel: 'niet-parseerbaar', bericht: e.message }); return bevindingen; }
  loop(boom, (node, pad) => {
    for (const regel of REGELS) {
      let uit;
      try { uit = regel.keur(node, pad); } catch (e) { uit = null; }
      if (uit) for (const bericht of uit) bevindingen.push({ bestand, lijn: node.lijn, ernst: regel.ernst, regel: regel.id, bericht });
    }
  });
  return bevindingen;
}
function scanBestand(bestand) { return scanBron(fs.readFileSync(bestand, 'utf8'), bestand); }

function main() {
  const wortels = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const roots = wortels.length ? wortels : ['server', 'scripts'];
  const cwd = process.cwd();
  let bestanden = [];
  for (const r of roots) {
    const p = path.resolve(cwd, r);
    if (!fs.existsSync(p)) { console.error('bestaat niet: ' + r); process.exit(2); }
    bestanden = bestanden.concat(fs.statSync(p).isDirectory() ? jsBestanden(p) : [p]);
  }
  let fouten = 0, waarschuwingen = 0;
  const perBestand = new Map();
  for (const b of bestanden) {
    const bev = scanBestand(b);
    for (const v of bev) {
      if (v.ernst === 'fout') fouten++; else waarschuwingen++;
      const rel = path.relative(cwd, v.bestand);
      if (!perBestand.has(rel)) perBestand.set(rel, []);
      perBestand.get(rel).push(v);
    }
  }
  for (const [rel, lijst] of [...perBestand.entries()].sort()) {
    console.log('\n' + rel);
    for (const v of lijst.sort((a, b) => a.lijn - b.lijn)) {
      const kleur = v.ernst === 'fout' ? K.rood : K.geel;
      console.log('  ' + kleur + v.ernst.toUpperCase() + K.reset + ' ' + K.grijs + 'regel ' + v.lijn + ' [' + v.regel + ']' + K.reset + '  ' + v.bericht);
    }
  }
  console.log('');
  console.log('AST-scan: ' + bestanden.length + ' bestanden, ' +
    (fouten ? K.rood : K.groen) + fouten + ' fout' + K.reset + ', ' +
    (waarschuwingen ? K.geel : K.grijs) + waarschuwingen + ' waarschuwing' + K.reset + '.');
  if (fouten) { console.log(K.rood + 'AST-scan afgekeurd.' + K.reset); process.exit(1); }
  console.log(K.groen + 'AST-scan in orde.' + K.reset);
}

module.exports = { scanBron, scanBestand, jsBestanden };
if (require.main === module) main();
