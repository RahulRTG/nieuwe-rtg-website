#!/usr/bin/env node
/* WIE HEEFT `kern.save` ERIN GEZET -- de herkomst van het contextobject.

   CONTEXTPROEF.json (de runtime-meting) liet zien dat het contextobject vooral
   bij het BEDRADEN wordt gelezen: 2222 namen bij het ophangen tegenover 78
   tijdens een verzoek. Het gat van 20.961 statisch onherleidbare aanroepen is
   daarmee geen runtime-raadsel maar een statische vraag die nog niemand stelde:
   welke module heeft die naam in de zak gelegd?

   Zonder dat antwoord blijft een aanroep als `save(...)` -- afkomstig uit
   `const { save } = kern` -- een naam zonder plaats. Mét dat antwoord is het een
   kant in de aanroepgraaf.

   DRIE MANIEREN WAAROP EEN NAAM IN DE ZAK KOMT, en alle drie zijn ze te lezen:

     basis        `const kern = { app, express, db, save, ... }`
     toewijzing   `kern.zaakBoard = ...`
     samenvoeging `Object.assign(kern, require('../kern/wallet').maakWallet({...}))`

   Die derde is de talrijkste (201 plekken) en de enige die werk kost: de namen
   staan niet op de aanroepplek maar in wat de FABRIEK teruggeeft. Die wordt hier
   gelezen als het laatste `return { ... }` op het EIGEN niveau van die functie --
   niet in een genest functietje, want `return { status: 200 }` in een handler
   binnenin is geen uitvoer van de fabriek.

   WAT HIJ NIET DOET. Hij raadt niet. Een samenvoeging waarvan de uitdrukking
   niet te volgen is (een variabele van elders, een fabriek zonder letterlijke
   return, een spread) levert geen namen maar een REGEL in `onopgelost`, met de
   reden erbij. Een herkomstregister dat gaten dichtgokt, wijst je naar de
   verkeerde module -- en dat is erger dan geen herkomst, want je gelooft het.

   Draaien: npm run kernherkomst -> KERNHERKOMST.json */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('./ast/parser');
const { loop } = require('./ast/walk');

const WORTEL = path.join(__dirname, '..');
const isFunctie = n => n && /FunctionExpression|ArrowFunctionExpression|FunctionDeclaration/.test(n.type);
const tekstVan = n => (n && n.type === 'Literal' && n.kind === 'string') ? String(n.raw).replace(/^['"`]|['"`]$/g, '') : null;

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
function losOp(vanaf, doel) {
  if (!doel || !doel.startsWith('.')) return null;
  let p = path.normalize(path.join(path.dirname(vanaf), doel));
  if (!p.endsWith('.js')) p += '.js';
  if (fs.existsSync(path.join(WORTEL, p))) return p;
  const idx = p.replace(/\.js$/, '/index.js');
  return fs.existsSync(path.join(WORTEL, idx)) ? idx : null;
}

const bomen = new Map();
for (const rel of bestanden('server')) {
  try { bomen.set(rel, parse(fs.readFileSync(path.join(WORTEL, rel), 'utf8'), {})); } catch (e) { /* zie SYMBOLEN.json */ }
}

/* De namen die een FUNCTIE teruggeeft: het laatste `return { ... }` op het eigen
   niveau. Nested functies worden overgeslagen -- daar staat de uitvoer van iets
   anders. */
function returnNamen(fn) {
  if (!isFunctie(fn)) return null;
  let gevonden = null, onvolledig = false;
  (function daal(knoop, diepte) {
    if (!knoop || typeof knoop !== 'object') return;
    if (Array.isArray(knoop)) { for (const k of knoop) daal(k, diepte); return; }
    if (typeof knoop.type !== 'string') return;
    if (diepte > 0 && (isFunctie(knoop) || knoop.type === 'MethodDefinition')) return;   // niet in een geneste functie
    if (knoop.type === 'ReturnStatement' && knoop.argument && knoop.argument.type === 'ObjectExpression') {
      const namen = [];
      for (const p of knoop.argument.properties || []) {
        if (p.type === 'SpreadElement') { onvolledig = true; continue; }
        if (p.key && p.key.name) namen.push(p.key.name);
      }
      gevonden = namen;                                    // de laatste wint
    }
    for (const sleutel in knoop) {
      if (sleutel === 'start' || sleutel === 'end' || sleutel === 'lijn') continue;
      const v = knoop[sleutel];
      if (v && typeof v === 'object') daal(v, diepte + 1);
    }
  })(fn.body, 0);
  /* Een pijlfunctie met een object als lijf: `deps => ({ a, b })` */
  if (!gevonden && fn.body && fn.body.type === 'ObjectExpression') {
    gevonden = (fn.body.properties || []).filter(p => p.key && p.key.name).map(p => p.key.name);
    onvolledig = (fn.body.properties || []).some(p => p.type === 'SpreadElement');
  }
  return gevonden ? { namen: gevonden, onvolledig } : null;
}

/* De functie met deze naam in dit bestand -- als declaratie, als const, of als
   lid van module.exports. */
function functieIn(rel, naam) {
  const ast = bomen.get(rel);
  if (!ast) return null;
  let uit = null;
  loop(ast, n => {
    if (uit) return;
    if (naam == null) {
      if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' &&
          n.left.object && n.left.object.name === 'module' && n.left.property && n.left.property.name === 'exports' &&
          isFunctie(n.right)) uit = n.right;
      return;
    }
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === naam) uit = n;
    else if (n.type === 'VariableDeclarator' && n.id && n.id.name === naam && isFunctie(n.init)) uit = n.init;
    else if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' &&
      n.left.property && n.left.property.name === naam && isFunctie(n.right)) uit = n.right;
  });
  return uit;
}

/* Wat levert deze uitdrukking aan namen op? Geeft {bestand, namen, hoe} of een
   reden waarom het niet te volgen is. */
function namenUit(expr, rel, bindingen, diepte) {
  if (!expr || diepte > 4) return { reden: 'te diep genest om te volgen' };
  if (expr.type === 'ObjectExpression') {
    const namen = [], spread = [];
    for (const p of expr.properties || []) {
      if (p.type === 'SpreadElement') { spread.push(p); continue; }
      if (p.key && p.key.name) namen.push(p.key.name);
    }
    return { bestand: rel, namen, hoe: 'letterlijk object', onvolledig: spread.length > 0 };
  }
  if (expr.type === 'Identifier') {
    const b = bindingen.get(expr.name);
    if (!b) return { reden: 'de naam "' + expr.name + '" is in dit bestand niet te herleiden' };
    return namenUit(b, rel, bindingen, diepte + 1);
  }
  if (expr.type === 'CallExpression') {
    const c = expr.callee;
    /* De twee vormen: een require-aanroep die meteen wordt uitgevoerd, en een
       require gevolgd door een fabrieksnaam. Hieronder als AST gelezen en niet
       als tekst -- een voorbeeld in commentaar met een kaal modulepad erin laat
       keuringsregel 24 terecht zakken (dat is hier gebeurd). */
    let doelBestand = null, fnNaam = null;
    if (c.type === 'CallExpression' && c.callee && c.callee.name === 'require') {
      doelBestand = losOp(rel, tekstVan((c.arguments || [])[0]));
    } else if (c.type === 'MemberExpression' && c.object && c.object.type === 'CallExpression' &&
      c.object.callee && c.object.callee.name === 'require') {
      doelBestand = losOp(rel, tekstVan((c.object.arguments || [])[0]));
      fnNaam = c.property && c.property.name;
    } else if (c.type === 'Identifier') {
      const b = bindingen.get(c.name);
      if (b && b.__require) { doelBestand = b.__require; fnNaam = b.__naam || null; }
    } else if (c.type === 'MemberExpression' && c.object && c.object.name) {
      const b = bindingen.get(c.object.name);
      if (b && b.__require) { doelBestand = b.__require; fnNaam = c.property && c.property.name; }
    }
    if (!doelBestand) return { reden: 'de fabriek is geen require die hier te volgen is' };
    const fn = functieIn(doelBestand, fnNaam);
    if (!fn) return { reden: 'in ' + doelBestand + ' is ' + (fnNaam ? 'functie ' + fnNaam : 'de uitvoer-functie') + ' niet gevonden' };
    const r = returnNamen(fn);
    if (!r) return { reden: doelBestand + (fnNaam ? '#' + fnNaam : '') + ' geeft geen letterlijk object terug' };
    return { bestand: doelBestand, namen: r.namen, hoe: 'fabriek' + (fnNaam ? ' ' + fnNaam : ''), onvolledig: r.onvolledig };
  }
  return { reden: 'uitdrukking van het type ' + expr.type + ' is niet te volgen' };
}

/* Per bestand de bindingen: een module die los wordt opgehaald en een die
   uitgepakt wordt opgehaald, krijgen allebei een merkteken, zodat namenUit() de
   fabriek erachter kan vinden. */
function bindingenVan(rel) {
  const ast = bomen.get(rel), uit = new Map();
  if (!ast) return uit;
  loop(ast, n => {
    if (n.type !== 'VariableDeclarator' || !n.init) return;
    const init = n.init;
    if (init.type === 'CallExpression' && init.callee && init.callee.name === 'require') {
      const doel = losOp(rel, tekstVan((init.arguments || [])[0]));
      if (!doel) return;
      if (n.id && n.id.name) { const merk = { __require: doel }; uit.set(n.id.name, merk); }
      else if (n.id && n.id.type === 'ObjectPattern') {
        for (const p of n.id.properties || []) {
          const uitNaam = p.key && p.key.name, alsNaam = (p.value && p.value.name) || uitNaam;
          if (uitNaam && alsNaam) uit.set(alsNaam, { __require: doel, __naam: uitNaam });
        }
      }
      return;
    }
    if (n.id && n.id.name) uit.set(n.id.name, init);
  });
  return uit;
}

const perNaam = new Map();                     // kernnaam -> [{bestand, hoe, via}]
const onopgelost = [];
let basisNamen = 0, plekken = 0;

function noteer(naam, herkomst) {
  if (!perNaam.has(naam)) perNaam.set(naam, []);
  const lijst = perNaam.get(naam);
  if (!lijst.some(x => x.bestand === herkomst.bestand && x.hoe === herkomst.hoe)) lijst.push(herkomst);
}

for (const [rel, ast] of bomen) {
  const bindingen = bindingenVan(rel);
  loop(ast, n => {
    /* 1) het basisobject */
    if (n.type === 'VariableDeclarator' && n.id && n.id.name === 'kern' && n.init && n.init.type === 'ObjectExpression') {
      plekken++;
      for (const p of n.init.properties || []) {
        if (p.type === 'SpreadElement') { onopgelost.push({ bestand: rel, lijn: n.lijn, vorm: 'basis', reden: 'een spread in het basisobject' }); continue; }
        if (p.key && p.key.name) { noteer(p.key.name, { bestand: rel, hoe: 'basisobject' }); basisNamen++; }
      }
      return;
    }
    /* 2) kern.NAAM = ... */
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' &&
        n.left.object && n.left.object.name === 'kern' && n.left.property && n.left.property.name) {
      plekken++;
      noteer(n.left.property.name, { bestand: rel, hoe: 'toewijzing' });
      return;
    }
    /* 3) Object.assign(kern, ...) */
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' &&
        n.callee.object && n.callee.object.name === 'Object' && n.callee.property && n.callee.property.name === 'assign') {
      const doel = (n.arguments || [])[0];
      if (!doel || doel.name !== 'kern') return;
      plekken++;
      for (const bron of (n.arguments || []).slice(1)) {
        const r = namenUit(bron, rel, bindingen, 0);
        if (r.reden) { onopgelost.push({ bestand: rel, lijn: n.lijn, vorm: 'Object.assign', reden: r.reden }); continue; }
        for (const naam of r.namen) noteer(naam, { bestand: r.bestand, hoe: r.hoe, via: rel });
        if (r.onvolledig) onopgelost.push({ bestand: rel, lijn: n.lijn, vorm: 'Object.assign', reden: 'de bron draagt een spread, dus deze lijst is onvolledig' });
      }
    }
  });
}

let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const meerdere = [...perNaam].filter(([, l]) => l.length > 1);
const uit = {
  soort: 'index',
  uitleg: 'Welke module heeft welke naam op het contextobject gezet. Drie vormen: het basisobject, een directe toewijzing, en Object.assign met een fabriek -- die laatste gelezen uit het laatste letterlijke return-object van die fabriek.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  grens: 'Er wordt niet geraden. Een samenvoeging die niet te volgen is levert geen naam maar een regel in `onopgelost`, met de reden. Een herkomst die je naar de verkeerde module wijst is erger dan geen herkomst.',
  gemeten: {
    namen: perNaam.size,
    vulplekken: plekken,
    basisNamen,
    namenMetMeerdereHerkomsten: meerdere.length,
    onopgelost: onopgelost.length
  },
  meerdereHerkomsten: meerdere.slice(0, 30).map(([naam, l]) => ({ naam, herkomsten: l })),
  onopgelost: onopgelost.slice(0, 60),
  perNaam: [...perNaam].sort((a, b) => a[0].localeCompare(b[0])).map(([naam, herkomsten]) => ({ naam, herkomsten }))
};

fs.writeFileSync(path.join(WORTEL, 'KERNHERKOMST.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten;
console.log('KERNHERKOMST.json geschreven');
console.log('  kernnamen met een herkomst', g.namen, '| vulplekken:', g.vulplekken, '| uit het basisobject:', g.basisNamen);
console.log('  meer dan een herkomst     ', g.namenMetMeerdereHerkomsten);
console.log('  onopgelost                ', g.onopgelost, '(vulplekken die niet te volgen zijn -- met reden)');
for (const o of onopgelost.slice(0, 6)) console.log('   ', o.bestand + ':' + o.lijn, '--', o.reden);
