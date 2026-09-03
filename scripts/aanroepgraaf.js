#!/usr/bin/env node
/* WIE ROEPT WIE AAN -- de symbool-naar-symboolgraaf.

   SYMBOLEN.json legde vast welke functie waar woont en welk bestand van welk
   bestand afhangt. Wat daar met opzet NIET in stond is de aanroep zelf: een
   naam in aanroeppositie is een naam en geen verwijzing, en twee bestanden
   mogen allebei een `bouw()` hebben. Die stap is nu wel verantwoord, want de
   require-kanten en de uitvoernamen staan er -- en daarmee is een aanroep af te
   LEIDEN in plaats van te raden.

   DE REGEL DIE ALLES DRAAGT: liever geen kant dan een verzonnen kant. Een
   aanroepgraaf met gokwerk erin is erger dan geen aanroepgraaf, want hij ziet er
   even compleet uit en wijst je naar de verkeerde plek. Elke kant hier draagt
   daarom HOE hij is afgeleid, en wat niet af te leiden viel staat in de uitslag
   met een reden -- niet weggelaten.

   VIER MANIEREN WAAROP EEN KANT ONTSTAAT, van hard naar zacht:

     lokaal      `bouw()` en `bouw` staat in ditzelfde bestand
     ingevoerd   `const { bouw } = require('./x')` -- de naam komt aantoonbaar
                 uit x, en x kent hem ook echt
     lid         `const m = require('./x'); m.bouw()` -- zelfde, via het object
     (geen)      al het andere: een globale functie, een naam uit een parameter,
                 een methode op een waarde die hier niet te volgen is

   Die laatste is geen mislukking maar de eerlijke uitkomst van statisch lezen.
   Dit huis geeft zijn modules bovendien vaak NIET via require door maar via een
   contextobject dat in server/opzet/ wordt samengesteld (zie de kop van
   scripts/schrijfanalyse.js); `k.instantMutate()` is daardoor principieel niet
   te herleiden zonder de opbouw na te spelen. Dat is hier zichtbaar als
   onopgeloste kanten en wordt niet met een gok gevuld.

   EN EEN KANT WORDT ALLEEN GELEGD ALS HET DOEL BESTAAT. Wijst een ingevoerde
   naam naar een bestand dat dat symbool niet kent, dan is dat geen kant maar een
   BEVINDING (`doelOnbekend`) -- ofwel de invoer klopt niet meer, ofwel het
   symbool is hernoemd.

   Draaien: npm run aanroepgraaf -> AANROEPGRAAF.json */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('./ast/parser');
const { loop } = require('./ast/walk');

const WORTEL = path.join(__dirname, '..');
const isFunctie = n => n && /FunctionExpression|ArrowFunctionExpression|FunctionDeclaration/.test(n.type);

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
  if (!doel.startsWith('.')) return null;
  let p = path.normalize(path.join(path.dirname(vanaf), doel));
  if (!p.endsWith('.js')) p += '.js';
  if (fs.existsSync(path.join(WORTEL, p))) return p;
  const idx = p.replace(/\.js$/, '/index.js');
  return fs.existsSync(path.join(WORTEL, idx)) ? idx : null;
}

/* De naam van de functie waar deze knoop IN staat. Een declarator telt alleen
   mee als er ook echt een functie in zit -- `const X = Object.freeze({...})` is
   geen scope maar een waarde, en een aanroep daarbinnen hoort bij de module. */
/* Elke naam die een patroon bindt, hoe diep ook genest. Alle vier de vormen
   tellen mee -- de eerste versie kende alleen een kale naam en een object, en
   miste daardoor `([teken, wie]) => ...`, waar een ARRAY-patroon de
   modulebinding `wie` overschaduwt. Gevolg was een kant naar wie.js#includes,
   oftewel een aanroep die nergens bestaat. */
function patroonNamen(knoop, uit) {
  if (!knoop || typeof knoop !== 'object') return uit;
  switch (knoop.type) {
    case 'Identifier': if (knoop.name) uit.add(knoop.name); break;
    case 'ObjectPattern':
      for (const p of knoop.properties || []) {
        if (p.type === 'RestElement') patroonNamen(p.argument, uit);
        else patroonNamen(p.value || p.key, uit);
      }
      break;
    case 'ArrayPattern': for (const el of knoop.elements || []) patroonNamen(el, uit); break;
    case 'AssignmentPattern': patroonNamen(knoop.left, uit); break;
    case 'RestElement': patroonNamen(knoop.argument, uit); break;
    default: break;
  }
  return uit;
}

function omhullende(pad) {
  for (let i = pad.length - 1; i >= 0; i--) {
    const p = pad[i];
    if (p.type === 'FunctionDeclaration' && p.id) return p.id.name;
    if (p.type === 'MethodDefinition' && p.key && p.key.name) return p.key.name;
    if (p.type === 'VariableDeclarator' && p.id && p.id.name && isFunctie(p.init)) return p.id.name;
  }
  return null;                                        // op moduleniveau
}

/* DE HERKOMST VAN DE ZAK (KERNHERKOMST.json). Zonder dit register is een
   aanroep als `save(...)` -- uit `const { save } = kern` -- een naam zonder
   plaats, en belandt hij in de post `contextobject`. Mét dit register weten we
   welk bestand die naam in de zak heeft gelegd, en wordt het een kant.

   TWEE VOORWAARDEN, en ze zijn er allebei omdat een verkeerde kant erger is dan
   geen kant:

     - alleen bij PRECIES EEN herkomst. Draagt een naam er twee, dan is niet te
       zeggen welke deze aanroep bedoelt;
     - het SYMBOOL is een tweede vraag. Een fabriek mag `{ walletVoeg: voeg }`
       teruggeven: de zaknaam is dan `walletVoeg` en het symbool heet `voeg`.
       Bestaat de zaknaam niet als symbool in dat bestand, dan wijst de kant naar
       het BESTAND en blijft het symbool leeg -- dat is wat we weten, en niet
       meer. */
let kernherkomst = new Map();
/* Welke FABRIEKEN vullen de zak, en in welk bestand staan ze? Dat weet
   KERNHERKOMST.json (`hoe: 'fabriek maakHandelsketen'`), en het is precies wat
   nodig is om de laatste vorm te herkennen:

     function maakHandelsketen({ db, save, crypto }) { ... save() ... }

   Hier komt `save` niet uit `const { save } = kern` en ook niet uit de parameter
   van `module.exports`, maar uit de parameter van een BENOEMDE fabriek. Dat is
   dezelfde zak, en we weten dat het die zak is omdat dit register zegt dat juist
   deze functie de kern vult. Geen heuristiek op de naam `save`: een parameter
   heet hier pas een kernnaam als het register die fabriek aanwijst. */
const kernfabrieken = new Map();               // bestand -> Set(fabrieksnamen)
try {
  const kh = JSON.parse(fs.readFileSync(path.join(WORTEL, 'KERNHERKOMST.json'), 'utf8'));
  for (const rij of kh.perNaam || []) {
    const bestanden = [...new Set((rij.herkomsten || []).map(h => h.bestand))];
    if (bestanden.length === 1) kernherkomst.set(rij.naam, bestanden[0]);
    for (const h of rij.herkomsten || []) {
      const m = /^fabriek (.+)$/.exec(String(h.hoe || ''));
      if (!m || !h.bestand) continue;
      if (!kernfabrieken.has(h.bestand)) kernfabrieken.set(h.bestand, new Set());
      kernfabrieken.get(h.bestand).add(m[1]);
    }
  }
} catch (e) { /* geen register: dan blijft alles zoals het was, en dat staat in de uitslag */ }

const BOMEN = ['server'];
const lijst = BOMEN.flatMap(bestanden);

/* Ronde 1: per bestand de symbolen en de invoerbindingen. */
const bomen = new Map(), symbolenVan = new Map(), invoer = new Map(), uitvoerVan = new Map(), fabrieksparams = new Map(),
  contextnamen = new Map(), lokaleWaarden = new Map(), externeModules = new Map(), uitgepakt = new Map(), nietGelezen = [];
for (const rel of lijst) {
  let ast;
  try { ast = parse(fs.readFileSync(path.join(WORTEL, rel), 'utf8'), {}); }
  catch (e) { nietGelezen.push({ bestand: rel, fout: String(e.message).slice(0, 90) }); continue; }
  bomen.set(rel, ast);
  const sym = new Set(), bind = new Map(), uitvoerNamen = new Set(), schaduw = new Set();
  const externBind = new Set(), uitObjectBind = new Set();
  let uitvoerVorm = null;
  loop(ast, n => {
    /* `module.exports.zin = function ...` -- een expressie, geen declaratie.
       Zonder deze tak meldde deze meter 587 keer dat een ingevoerde naam niet
       bestond, terwijl hij gewoon zo geschreven was. */
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression') {
      const o = n.left.object, p = n.left.property;
      const lid = o && o.type === 'MemberExpression' && o.object && o.object.name === 'module' &&
        o.property && o.property.name === 'exports' && p && p.name;
      if (lid) { uitvoerNamen.add(p.name); if (uitvoerVorm !== 'onvolledig') uitvoerVorm = 'object'; if (isFunctie(n.right)) sym.add(p.name); }
      else if (o && o.name === 'module' && p && p.name === 'exports') {
        if (n.right && n.right.type === 'ObjectExpression') {
          /* Een spread voegt namen toe die hier niet te zien zijn; de lijst is
             dan onvolledig en mag niet als volledig gelden. */
          const spread = (n.right.properties || []).some(prop => prop.type === 'SpreadElement');
          uitvoerVorm = spread ? 'onvolledig' : (uitvoerVorm === 'onvolledig' ? 'onvolledig' : 'object');
          for (const prop of n.right.properties || []) if (prop.key && prop.key.name) uitvoerNamen.add(prop.key.name);
        } else if (uitvoerVorm !== 'object' && uitvoerVorm !== 'onvolledig') uitvoerVorm = 'anders';
      }
    }
    /* Object.assign(module.exports, require('./x')) mengt een ander bestand bij. */
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' &&
        n.callee.object && n.callee.object.name === 'Object' && n.callee.property && n.callee.property.name === 'assign') {
      const doel = (n.arguments || [])[0];
      if (doel && doel.type === 'MemberExpression' && doel.object && doel.object.name === 'module' &&
          doel.property && doel.property.name === 'exports') uitvoerVorm = 'onvolledig';
    }
    /* SCHADUW: elke naam die ergens in dit bestand een parameter of een lokale
       verklaring is. Een modulebinding `s` en een parameter `s` zien er in de
       aanroep identiek uit, en dan is `s.includes(...)` geen aanroep op die
       module. Dit is grof (het hele bestand, niet de scope) en met opzet: de
       regel hier is liever geen kant dan een verzonnen kant. */
    if (isFunctie(n) || n.type === 'MethodDefinition') {
      const fn = n.type === 'MethodDefinition' ? n.value : n;
      for (const par of (fn && fn.params) || []) patroonNamen(par, schaduw);
    }
    if (n.type === 'VariableDeclarator' && n.id && n.id.name &&
        !(n.init && n.init.type === 'CallExpression' && n.init.callee && n.init.callee.name === 'require')) {
      schaduw.add(n.id.name);
    }
    if (n.type === 'FunctionDeclaration' && n.id) sym.add(n.id.name);
    else if (n.type === 'MethodDefinition' && n.key && n.key.name) sym.add(n.key.name);
    else if (n.type === 'VariableDeclarator') {
      if (n.id && n.id.name && isFunctie(n.init)) sym.add(n.id.name);
      /* require-bindingen: los (`const m = require(x)`) en uitgepakt
         (`const { a, b: c } = require(x)`). */
      const init = n.init;
      /* Een require die NIET naar dit huis wijst: node zelf of een pakket. */
      if (init && init.type === 'CallExpression' && init.callee && init.callee.name === 'require' && n.id && n.id.name) {
        const a0 = (init.arguments || [])[0];
        const padTekst = a0 && a0.type === 'Literal' && a0.kind === 'string'
          ? String(a0.raw).replace(/^['"`]|['"`]$/g, '') : null;
        if (padTekst && !padTekst.startsWith('.')) externBind.add(n.id.name);
      }
      /* `const { a, b } = eenObject` -- uitgepakt uit iets dat hier staat. */
      /* UITGEPAKT UIT EEN FABRIEK-AANROEP: een module die met een relatief pad
         wordt opgehaald, meteen wordt aangeroepen, en waarvan het resultaat
         wordt uitgepakt -- of hetzelfde met een fabriek uit dit bestand:
           const { nu, vandaag, id } = maakHulp({ db, save, crypto })
         Dat is een van de gewoonste vormen in dit huis en hij stond volledig in
         de restbak. De namen komen aantoonbaar uit dat ENE bestand; welk symbool
         het daar is, is een tweede vraag (een fabriek mag `{ publiek: maakBeeld }`
         teruggeven), dus bij twijfel wijst de kant het bestand aan. */
      if (init && init.type === 'CallExpression' && n.id && n.id.type === 'ObjectPattern') {
        const c0 = init.callee;
        let fabriekBestand = null;
        if (c0 && c0.type === 'CallExpression' && c0.callee && c0.callee.name === 'require') {
          const a1 = (c0.arguments || [])[0];
          const pd = a1 && a1.type === 'Literal' && a1.kind === 'string' ? String(a1.raw).replace(/^['"`]|['"`]$/g, '') : null;
          fabriekBestand = pd ? losOp(rel, pd) : null;
        } else if (c0 && c0.type === 'MemberExpression' && c0.object && c0.object.type === 'CallExpression' &&
          c0.object.callee && c0.object.callee.name === 'require') {
          const a1 = (c0.object.arguments || [])[0];
          const pd = a1 && a1.type === 'Literal' && a1.kind === 'string' ? String(a1.raw).replace(/^['"`]|['"`]$/g, '') : null;
          fabriekBestand = pd ? losOp(rel, pd) : null;
        }
        if (fabriekBestand) for (const pp of n.id.properties || []) {
          const nm = (pp.value && pp.value.name) || (pp.key && pp.key.name);
          if (nm) bind.set(nm, { bestand: fabriekBestand, soort: 'uitFabriek', doelNaam: (pp.key && pp.key.name) || nm });
        }
      }
      const uitBron = init && init.type === 'LogicalExpression' ? init.left : init;
      if (uitBron && uitBron.type === 'Identifier' && n.id && n.id.type === 'ObjectPattern') {
        for (const pp of n.id.properties || []) {
          const nm = (pp.value && pp.value.name) || (pp.key && pp.key.name);
          if (nm) uitObjectBind.add(nm);
        }
      }
      if (init && init.type === 'CallExpression' && init.callee && init.callee.name === 'require') {
        /* De parser zet een stringliteraal in `raw` MET zijn aanhalingstekens
           (kind: 'string'); er is geen `value`. Dat verschil kostte hier een
           hele ronde: `arg.value` was overal undefined, dus er ontstond geen
           enkele invoerbinding en de graaf leek 100% lokaal. Een graaf die er
           compleet uitziet en het niet is, is precies de faalvorm waar deze
           meter tegen zou moeten beschermen. */
        const arg = (init.arguments || [])[0];
        const doel = arg && arg.type === 'Literal' && arg.kind === 'string'
          ? String(arg.raw).replace(/^['"`]|['"`]$/g, '') : null;
        const bestand = doel ? losOp(rel, doel) : null;
        if (!bestand) return;
        if (n.id && n.id.name) bind.set(n.id.name, { bestand, soort: 'module' });
        else if (n.id && n.id.type === 'ObjectPattern') {
          for (const p of n.id.properties || []) {
            const uitNaam = p.key && p.key.name, alsNaam = (p.value && p.value.name) || uitNaam;
            if (uitNaam && alsNaam) bind.set(alsNaam, { bestand, soort: 'ingevoerd', doelNaam: uitNaam });
          }
        }
      }
    }
  });
  /* Een binding die ook als parameter of lokale naam voorkomt, is niet
     betrouwbaar te volgen -- die valt eruit. */
  for (const naam of [...bind.keys()]) if (schaduw.has(naam)) bind.delete(naam);
  /* De parameters van de fabrieksfunctie die dit bestand exporteert. Dit huis
     geeft zijn modules vaak NIET via require door maar via zo'n contextobject
     (zie de kop van scripts/schrijfanalyse.js); `k.instantMutate()` is daardoor
     principieel niet te herleiden zonder de opbouw na te spelen. Dat is een
     eigenschap van deze architectuur en geen tekort van de meter -- maar dan
     moet het wel als zodanig geteld worden. */
  const params = new Set(), uitContextVooraf = new Set(), uitvoerParamPatronen = [];
  loop(ast, n => {
    if (n.type !== 'AssignmentExpression' || !n.left || n.left.type !== 'MemberExpression') return;
    const o = n.left.object, p2 = n.left.property;
    if (!(o && o.name === 'module' && p2 && p2.name === 'exports')) return;
    if (isFunctie(n.right)) for (const par of n.right.params || []) uitvoerParamPatronen.push(par);
    if (isFunctie(n.right)) for (const par of n.right.params || []) patroonNamen(par, params);
  });
  fabrieksparams.set(rel, params);
  /* DE ZAK WORDT VAAK AL IN DE PARAMETER UITGEPAKT:
       module.exports = ({ app, auth, save }) => { ... }
     Dat is dezelfde herkomst als `const { save } = kern`, alleen een regel
     eerder. Zonder deze tak bleef `save` -- 1206 aanroepen, en met een bekende
     herkomst -- in de restbak zitten. */
  if (uitvoerParamPatronen.length) for (const par of uitvoerParamPatronen) {
    if (par && par.type === 'ObjectPattern') patroonNamen(par, uitContextVooraf);
  }
  /* En de benoemde fabrieken die dit bestand aan de kern levert. */
  const fabrieken = kernfabrieken.get(rel);
  if (fabrieken && fabrieken.size) loop(ast, n => {
    let naam = null, fn = null;
    if (n.type === 'FunctionDeclaration' && n.id) { naam = n.id.name; fn = n; }
    else if (n.type === 'VariableDeclarator' && n.id && n.id.name && isFunctie(n.init)) { naam = n.id.name; fn = n.init; }
    if (!naam || !fabrieken.has(naam)) return;
    for (const par of (fn && fn.params) || []) if (par && par.type === 'ObjectPattern') patroonNamen(par, uitContextVooraf);
  });
  /* En de namen die UIT dat contextobject worden gehaald:
       module.exports = (kern) => { const { app, auth, save } = kern; ... }
     Dat is dezelfde herkomst als `kern.save()`, alleen uitgepakt. Zonder deze
     tak vielen save (3023x), schoon (2268x) en nu (1516x) in de restbak, en
     dan verklaart de grootste post van de meting niets. */
  const uitContext = new Set(uitContextVooraf);
  if (params.size) loop(ast, n => {
    if (n.type !== 'VariableDeclarator' || !n.id || n.id.type !== 'ObjectPattern') return;
    if (!n.init || n.init.type !== 'Identifier' || !params.has(n.init.name)) return;
    patroonNamen(n.id, uitContext);
  });
  contextnamen.set(rel, uitContext);
  /* Namen die hier lokaal een WAARDE zijn (geen functie, geen module): een
     aanroep als `uit.push(...)` of `eigen.bak(...)` is een methode op zo'n
     waarde en geen aanroep van eigen code. */
  lokaleWaarden.set(rel, schaduw);
  externeModules.set(rel, externBind);
  uitgepakt.set(rel, uitObjectBind);
  symbolenVan.set(rel, sym); invoer.set(rel, bind);
  uitvoerVan.set(rel, uitvoerVorm === 'object' ? uitvoerNamen : null);
}

/* WAAROM IETS ONOPGELOST BLIJFT. Zonder deze indeling is "18% opgelost" een
   alarmerend getal, terwijl het merendeel van wat overblijft helemaal geen
   aanroep van eigen code IS: `res.json()`, `String()`, `Object.freeze()`. Een
   percentage zonder noemer nodigt uit tot de verkeerde reparatie -- iemand gaat
   de resolver "verbeteren" tot hij res.json aan een bestand knoopt. */
const INGEBOUWD = new Set(['String', 'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'Promise', 'RegExp',
  'isFinite', 'Infinity', 'globalThis', 'AbortSignal', 'WeakSet', 'TextEncoder', 'TextDecoder', 'Function',
  'Map', 'Set', 'WeakMap', 'Error', 'Symbol', 'BigInt', 'parseInt', 'parseFloat', 'isNaN', 'require', 'setTimeout',
  'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask', 'structuredClone', 'encodeURIComponent',
  'decodeURIComponent', 'fetch', 'console', 'process', 'Buffer', 'URL', 'AbortController', 'Intl', 'Reflect', 'Proxy']);
const KADER = new Set(['res', 'req', 'app', 'next', 'router', 'express', 'db', 'console', 'process']);
const soorten = { ingebouwd: 0, externeModule: 0, kader: 0, contextobject: 0, uitgepaktObject: 0, lokaleWaarde: 0, methodeOpWaarde: 0, overig: 0 };
function soortVanOnopgeloste(c, rel) {
  if (c.type === 'Identifier') {
    if (INGEBOUWD.has(c.name)) return 'ingebouwd';
    if ((contextnamen.get(rel) || EMPTY).has(c.name)) return 'contextobject';
    /* UITGEPAKT UIT EEN OBJECT DAT GEEN KERN IS. `const { H, heleCenten } =
       horeca` en `const { db, save, nu } = ctx`: een domein geeft zijn eigen
       deelmodules een eigen zak mee. Dezelfde VORM als het contextobject, maar
       het IS de kern niet -- en die twee door elkaar halen zou de post
       `contextobject` laten groeien met iets waar KERNHERKOMST.json niets over
       kan zeggen. Ze stonden tot 3 september in de restbak, en dan lijkt die een
       verzameling raadsels terwijl het een bekende vorm is. */
    if ((externeModules.get(rel) || EMPTY).has(c.name)) return 'externeModule';
    if ((uitgepakt.get(rel) || EMPTY).has(c.name)) return 'uitgepaktObject';
    if ((lokaleWaarden.get(rel) || EMPTY).has(c.name)) return 'lokaleWaarde';
    return 'overig';
  }
  if (c.type === 'MemberExpression' && c.object && c.object.name) {
    const o = c.object.name;
    if (INGEBOUWD.has(o)) return 'ingebouwd';
    /* `path.join()`, `fs.readFileSync()`: een module van buiten dit huis. Geen
       eigen code, dus geen kant -- maar ook geen raadsel. */
    if ((externeModules.get(rel) || EMPTY).has(o)) return 'externeModule';
    if (KADER.has(o)) return 'kader';
    if ((fabrieksparams.get(rel) || EMPTY).has(o) || (contextnamen.get(rel) || EMPTY).has(o)) return 'contextobject';
    if ((uitgepakt.get(rel) || EMPTY).has(o)) return 'uitgepaktObject';
    if ((lokaleWaarden.get(rel) || EMPTY).has(o)) return 'lokaleWaarde';
    return 'overig';
  }
  return 'methodeOpWaarde';                     // iets.iets().nogwat() -- geen naam om op te lossen
}
const EMPTY = new Set();

/* DE BRUG ROUTE -> SYMBOOL. ROUTEBRON.json legt route -> bestand en
   SYMBOLEN.json legt bestand -> symbolen; wat ontbrak is welk symbool IN dat
   bestand de route afhandelt. Dat is hier af te leiden zonder tweede resolver:
   de functie die aan `app.post('/pad', ..., handler)` wordt meegegeven IS de
   afhandeling, en alles wat daarbinnen wordt aangeroepen loopt al langs de
   resolver hierboven. De handler krijgt daarom een eigen naam --
   `route:POST /api/x` -- en verschijnt als gewone knoop in de graaf.

   Wat dit NIET doet: beweren dat de handler een symboolnaam heeft. Meestal is
   het een anonieme functie ter plekke, en die verzinnen we geen naam voor. */
const METHODEN = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
function routehandlers(ast) {
  const per = new Map();                          // functieknoop -> "METHODE /pad"
  loop(ast, n => {
    if (n.type !== 'CallExpression' || !n.callee || n.callee.type !== 'MemberExpression') return;
    const obj = n.callee.object && n.callee.object.name, prop = n.callee.property && n.callee.property.name;
    if (!obj || !prop || !METHODEN.has(prop)) return;
    if (obj !== 'app' && obj !== 'router') return;
    const eerste = (n.arguments || [])[0];
    if (!eerste || eerste.type !== 'Literal' || eerste.kind !== 'string') return;
    const pad = String(eerste.raw).replace(/^['"`]|['"`]$/g, '');
    if (!pad.startsWith('/')) return;
    const laatste = (n.arguments || [])[n.arguments.length - 1];
    if (isFunctie(laatste)) per.set(laatste, prop.toUpperCase() + ' ' + pad);
  });
  return per;
}

/* Ronde 2: de aanroepen. */
const kanten = [], onopgelost = new Map(), doelOnbekend = [];
const routeKanten = [], perSoort = new Map(), overigWaar = new Map();
let calls = 0, doelNietVastTeStellen = 0;
for (const [rel, ast] of bomen) {
  const eigen = symbolenVan.get(rel), bind = invoer.get(rel);
  const handlers = routehandlers(ast);
  const gezien = new Set();
  loop(ast, (n, pad) => {
    if (n.type !== 'CallExpression' || !n.callee) return;
    calls++;
    /* Staat deze aanroep binnen een routehandler? Dan is DAT de herkomst, ook
       als er nog een naamloze functie tussen zit. De dichtstbijzijnde
       omhullende naam wint alleen als hij dieper ligt dan de handler. */
    let route = null, routeDiepte = -1;
    for (let i = pad.length - 1; i >= 0; i--) if (handlers.has(pad[i])) { route = handlers.get(pad[i]); routeDiepte = i; break; }
    const naam = omhullende(pad);
    let naamDiepte = -1;
    if (naam) for (let i = pad.length - 1; i >= 0; i--) {
      const q = pad[i];
      if ((q.type === 'FunctionDeclaration' && q.id) || (q.type === 'MethodDefinition' && q.key) ||
          (q.type === 'VariableDeclarator' && q.id && q.id.name && isFunctie(q.init))) { naamDiepte = i; break; }
    }
    const van = (route && naamDiepte < routeDiepte) ? 'route:' + route : (naam || (route ? 'route:' + route : '(module)'));
    const c = n.callee;
    let doelBestand = null, doelNaam = null, hoe = null, ruw = null;

    if (c.type === 'Identifier') {
      ruw = c.name;
      if (eigen.has(c.name)) { doelBestand = rel; doelNaam = c.name; hoe = 'lokaal'; }
      else if (bind.has(c.name)) {
        const b = bind.get(c.name);
        if (b.soort === 'ingevoerd') { doelBestand = b.bestand; doelNaam = b.doelNaam; hoe = 'ingevoerd'; }
        else if (b.soort === 'uitFabriek') {
          doelBestand = b.bestand; hoe = 'uitFabriek';
          const daar = symbolenVan.get(b.bestand);
          doelNaam = daar && daar.has(b.doelNaam) ? b.doelNaam : null;
        }
        /* Een module die ZELF de functie is: opgehaald met een relatief pad en
           meteen aangeroepen. Welk symbool dat is staat er niet bij (een
           naamloze export), dus dit wijst het BESTAND aan en niet de functie.
           Dat is wat we weten. (Geen voorbeeld met een letterlijk modulepad in
           dit commentaar: keuringsregel 22 leest dat als een echte import van
           DIT bestand, en dan is het een kapot pad. Twee keer gebeurd.) */
        else if (b.soort === 'module') { doelBestand = b.bestand; doelNaam = null; hoe = 'moduleAlsFunctie'; }
      }
      /* Uit de zak gehaald, en de zak weet wie hem gevuld heeft. */
      else if ((contextnamen.get(rel) || EMPTY).has(c.name) && kernherkomst.has(c.name)) {
        doelBestand = kernherkomst.get(c.name); doelNaam = c.name; hoe = 'viaKern';
      }
    } else if (c.type === 'MemberExpression' && c.object && c.object.name && c.property && c.property.name) {
      ruw = c.object.name + '.' + c.property.name;
      const b = bind.get(c.object.name);
      if (b && b.soort === 'module') { doelBestand = b.bestand; doelNaam = c.property.name; hoe = 'lid'; }
      /* Een naam die uitgepakt uit een eigen module komt, met een methode
         erop (`log.warn`). De naam komt aantoonbaar uit ons eigen bestand, de
         METHODE erop is daar geen symbool. Bestand wel, functie niet. */
      else if (b && b.soort === 'ingevoerd') { doelBestand = b.bestand; doelNaam = null; hoe = 'lidOpInvoer'; }
      /* `k.instantMutate()` -- de zak zelf, met de naam erop. Zelfde herkomst
         als de uitgepakte vorm hierboven; alleen de schrijfwijze verschilt. */
      else if (((fabrieksparams.get(rel) || EMPTY).has(c.object.name) || (contextnamen.get(rel) || EMPTY).has(c.object.name)) &&
        kernherkomst.has(c.property.name)) {
        doelBestand = kernherkomst.get(c.property.name); doelNaam = c.property.name; hoe = 'viaKern';
      }
    } else {
      ruw = c.type;
    }

    if (!doelBestand) {
      const sleutel = ruw || '?';
      onopgelost.set(sleutel, (onopgelost.get(sleutel) || 0) + 1);
      const soort = soortVanOnopgeloste(c, rel);
      soorten[soort]++;
      /* Per soort apart bijhouden, want alleen zo is de RESTBAK te lezen. In
         een gezamenlijke lijst wordt `overig` (2,3%) volledig overstemd door
         String() en res.json(), en dan is de enige post die nog een vraag
         bevat, de enige die je niet ziet. */
      if (!perSoort.has(soort)) perSoort.set(soort, new Map());
      const m = perSoort.get(soort);
      m.set(sleutel, (m.get(sleutel) || 0) + 1);
      if (soort === 'overig') {
        if (!overigWaar.has(sleutel)) overigWaar.set(sleutel, new Set());
        const w = overigWaar.get(sleutel);
        if (w.size < 3) w.add(rel + ':' + n.lijn);
      }
      return;
    }
    /* Bestaat het doel echt? DRIE uitkomsten, want twee zijn er te weinig:

         het doelbestand kent de naam            -> een kant
         het kent hem niet, en zijn uitvoer is
         wel af te leiden                        -> een BEVINDING
         zijn uitvoer is NIET af te leiden
         (module.exports = een functie)          -> niet vast te stellen

       Die derde als bevinding tellen zou een fabriekmodule beschuldigen van
       een ontbrekend symbool dat statisch nooit zichtbaar kan zijn. */
    const daar = symbolenVan.get(doelBestand);
    const uitDaar = uitvoerVan.get(doelBestand);
    /* Een kant die met OPZET alleen een bestand aanwijst (`moduleAlsFunctie`,
       `lidOpInvoer`) draagt geen symbool. Die door de bestaanscontrole halen
       maakte er 303 "bevindingen" van: de meter beschuldigde de code van een
       ontbrekend symbool dat hij zelf niet had ingevuld. */
    if (doelNaam == null) { /* bestand bekend, functie niet -- niets te toetsen */ }
    else if (daar && !daar.has(doelNaam) && !(uitDaar && uitDaar.has(doelNaam))) {
      /* Een zaknaam hoeft niet de symboolnaam te zijn (`{ walletVoeg: voeg }`).
         Dan weten we het BESTAND en niet de functie, en dat is wat er komt te
         staan -- geen gok naar een symbool dat er niet is. */
      if (hoe === 'viaKern') doelNaam = null;
      else if (uitDaar === null || uitDaar === undefined) { doelNietVastTeStellen++; return; }
      else { doelOnbekend.push({ van: rel + '#' + van, naar: doelBestand + '#' + doelNaam, hoe, lijn: n.lijn }); return; }
    }
    const sleutel = rel + '#' + van + ' -> ' + doelBestand + '#' + doelNaam;
    if (gezien.has(sleutel)) return;
    gezien.add(sleutel);
    kanten.push({ vanBestand: rel, van, naarBestand: doelBestand, naar: doelNaam, hoe, lijn: n.lijn });
    if (van.startsWith('route:')) routeKanten.push({ route: van.slice(6), bestand: rel, naarBestand: doelBestand, naar: doelNaam, hoe });
  });
}

/* De omgekeerde kant: wie roept dit symbool aan. */
const aanroepersVan = new Map();
for (const k of kanten) {
  const sleutel = k.naarBestand + '#' + k.naar;
  if (!aanroepersVan.has(sleutel)) aanroepersVan.set(sleutel, []);
  aanroepersVan.get(sleutel).push(k.vanBestand + '#' + k.van);
}

const onopgelostGesorteerd = [...onopgelost].sort((a, b) => b[1] - a[1]);
const onopgelostTotaal = onopgelostGesorteerd.reduce((n, [, a]) => n + a, 0);
let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const uit = {
  /* Wat voor SOORT bewering doet dit register? `index` = structuur en
     relaties (waar woont wat, wat hangt met wat samen). `meting` = een
     uitspraak over gedrag (schrijft het, klopt het, is het bewezen). Het
     verschil is niet cosmetisch: een index noemt bijna alles en maakt elke
     dekkingsvraag triviaal waar, dus scripts/codewereld.js telt hem apart. */
  soort: 'index',
  uitleg: 'De symbool-naar-symboolgraaf van server/: welke functie roept welke functie aan. Elke kant draagt HOE hij is afgeleid (lokaal, ingevoerd, lid). Wat niet af te leiden viel staat als onopgelost in de uitslag, met aantallen -- niet weggelaten.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  grens: 'Liever geen kant dan een verzonnen kant. Er wordt geen kant gelegd op naamgelijkenis alleen: een aanroep telt pas als de naam lokaal bestaat of aantoonbaar uit een require komt, EN het doelbestand dat symbool ook echt kent.',
  gemeten: {
    bestanden: bomen.size,
    nietGelezen: nietGelezen.length,
    aanroepen: calls,
    kanten: kanten.length,
    kantenLokaal: kanten.filter(k => k.hoe === 'lokaal').length,
    kantenIngevoerd: kanten.filter(k => k.hoe === 'ingevoerd').length,
    kantenLid: kanten.filter(k => k.hoe === 'lid').length,
    kantenViaKern: kanten.filter(k => k.hoe === 'viaKern').length,
    kantenModuleAlsFunctie: kanten.filter(k => k.hoe === 'moduleAlsFunctie').length,
    kantenLidOpInvoer: kanten.filter(k => k.hoe === 'lidOpInvoer').length,
    kantenUitFabriek: kanten.filter(k => k.hoe === 'uitFabriek').length,
    /* Geteld over de ONTDUBBELDE kanten, niet over de voorvallen. De eerste
       versie telde elke aanroep en meldde er daardoor meer "zonder symbool" dan
       er kanten waren -- een getal dat zichzelf tegenspreekt is erger dan geen
       getal. */
    kantenViaKernZonderSymbool: kanten.filter(k => k.hoe === 'viaKern' && !k.naar).length,
    kernherkomstGelezen: kernherkomst.size,
    onopgelosteAanroepen: onopgelostTotaal,
    onopgelosteNamen: onopgelost.size,
    onopgelostNaarSoort: soorten,
    opgelostPct: calls ? Math.round((calls - onopgelostTotaal) / calls * 1000) / 10 : 0,
    doelOnbekend: doelOnbekend.length,
    doelNietVastTeStellen: doelNietVastTeStellen,
    symbolenMetAanroeper: aanroepersVan.size,
    routesMetSymbool: new Set(routeKanten.map(r => r.route)).size,
    routeSymboolKanten: routeKanten.length
  },
  routeNaarSymbool: [...routeKanten.reduce((m, r) => {
    if (!m.has(r.route)) m.set(r.route, { route: r.route, bestand: r.bestand, symbolen: [] });
    const x = m.get(r.route), sleutel = r.naarBestand + '#' + r.naar;
    if (!x.symbolen.includes(sleutel)) x.symbolen.push(sleutel);
    return m;
  }, new Map()).values()].sort((a, b) => b.symbolen.length - a.symbolen.length),
  onopgelostTop: onopgelostGesorteerd.slice(0, 40).map(([naam, aantal]) => ({ naam, aantal })),
  onopgelostPerSoort: [...perSoort].map(([soort, m]) => ({
    soort,
    namen: [...m].sort((a, b) => b[1] - a[1]).slice(0, soort === 'overig' ? 120 : 15)
      .map(([naam, aantal]) => ({ naam, aantal, waar: soort === 'overig' ? [...(overigWaar.get(naam) || [])] : undefined }))
  })),
  doelOnbekend: doelOnbekend.slice(0, 40),
  nietGelezen,
  kanten
};

fs.writeFileSync(path.join(WORTEL, 'AANROEPGRAAF.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten;
console.log('AANROEPGRAAF.json geschreven');
console.log('  bestanden   ', g.bestanden, '| aanroepen gezien:', g.aanroepen);
console.log('  kanten      ', g.kanten, '(lokaal', g.kantenLokaal + ', ingevoerd', g.kantenIngevoerd + ', lid', g.kantenLid + ', viaKern', g.kantenViaKern + ')');
console.log('    viaKern   ', g.kantenViaKern, 'kanten uit de zak, waarvan', g.kantenViaKernZonderSymbool, 'alleen naar het BESTAND (zaknaam != symboolnaam)');
console.log('  onopgelost  ', g.onopgelosteAanroepen, 'aanroepen over', g.onopgelosteNamen, 'namen -> opgelost:', g.opgelostPct + '%');
console.log('    waarvan   ', Object.entries(soorten).map(([k, v]) => k + ': ' + v).join(', '));
console.log('  doelOnbekend', g.doelOnbekend, '(ingevoerde naam die het doelbestand niet kent -- een BEVINDING) |',
  g.doelNietVastTeStellen, 'niet vast te stellen (module.exports is geen object)');
console.log('  symbolen met een aanroeper:', g.symbolenMetAanroeper);
console.log('  brug route -> symbool:', g.routesMetSymbool, 'routes met minstens een symbool,', g.routeSymboolKanten, 'kanten');
console.log('\n  meest onopgelost:', onopgelostGesorteerd.slice(0, 8).map(([n, a]) => n + ' (' + a + ')').join(', '));
