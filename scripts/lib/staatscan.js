/* WELKE TOESTAND BESTAAT ER EIGENLIJK, EN WIE IS ERVAN?

   Dit is fase A van de verificatie-runtime: de runtime ZICHTBAAR maken. Nog
   niets versnellen. De aanleiding is een getal: 647 serverstarts kosten 35% van
   alle toetstijd, en dat wordt pas minder als servers hergebruikt kunnen worden.
   Hergebruik mag alleen als je van elke muteerbare wortel weet wie hem bezit en
   of hij aantoonbaar terug kan naar zijn beginstand. Zolang er ook maar EEN
   onbekende singleton is, kan die honderd keurig geisoleerde toetsen waardeloos
   maken -- en dat merk je niet, want een gedeelde server die lekt geeft geen
   fout maar een verkeerd antwoord.

   Dus eerst tellen wat er is. Dit bestand doet dat en niets anders.

   WAT TELT ALS EEN MUTEERBARE WORTEL. Een binding op MODULEniveau die na het
   laden nog kan veranderen:

     - `let` of `var`               -- altijd, die zijn per definitie herbindbaar
     - `const` op een Map/Set/WeakMap/WeakSet, een array of een object,
       MAAR alleen als er in dat bestand ook echt in geschreven wordt

   Dat tweede onderscheid is de hele precisie van deze scanner. Zonder die eis
   telde hij 1123 wortels, want `const LANDEN = [...]` en `const TARIEVEN = {}`
   staan hier bij honderden. Dat zijn vaste tabellen en geen toestand; ze in een
   register zetten maakt het register onbruikbaar en daarmee de ratel zinloos.
   Met de eis blijven er 143 over, en dat is een lijst waar een mens iets mee kan.

   WAT DEZE SCANNER NIET ZIET, en dat hoort erbij:

     - toestand achter een fabrieksfunctie (maak...() met een eigen sluiting).
       Die is per aanroep vers, dus meestal juist GOED -- maar wie zo'n fabriek
       een keer aanroept en het resultaat op moduleniveau vasthoudt, heeft weer
       een wortel, en die ziet deze scanner wel via de binding.
     - toestand in een ander proces (Postgres, Redis) -- die heeft een eigen
       levensduur en hoort in het register met de hand.
     - `globalThis.x = ...` binnen een functie.

   Dat zijn geen omissies om weg te poetsen maar de rand van wat statisch te
   zien is; het register (STATE.json) is de plek waar zulke wortels met de hand
   bij komen, en het veld `bron` zegt dan `hand` in plaats van `scan`.

   DE KLOKCENSUS ZIT ER OOK IN, en om een reden. `new Date()` zonder argument
   LEEST de klok; `new Date(x)` construeert een datum uit iets dat er al was.
   Wie die twee op een hoop gooit telt hier 1788 kloklezingen waar er 1297 zijn,
   en dan meet je bij elke reparatie het verkeerde getal. Datzelfde geldt voor
   Date.now(), process.hrtime() en performance.now().

   Puur eigen werk: de AST-laag in scripts/ast/ (lexer, parser, walk), geen
   npm-pakket. Handhaver: test/staatregister.test.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('../ast/parser.js');
const { loop } = require('../ast/walk.js');

const OVERSLAAN = new Set(['node_modules', '.git', 'data', 'dist', 'coverage']);

/* De methoden die een container ECHT muteren. `get`, `has` en `size` staan er
   met opzet niet bij: lezen maakt van een tabel geen toestand. */
const MUTMETHODE = /^(set|add|delete|clear|push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)$/;
const CONTAINER = /^(Map|Set|WeakMap|WeakSet)$/;

function bestandenOnder(map, uit) {
  uit = uit || [];
  let items;
  try { items = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const it of items) {
    if (OVERSLAAN.has(it.name)) continue;
    const p = path.join(map, it.name);
    if (it.isDirectory()) bestandenOnder(p, uit);
    else if (p.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Staat deze knoop binnen een functie? Een timer of listener op MODULEniveau
   draait bij het laden en leeft dus zo lang als het proces; dezelfde aanroep
   binnen een routehandler hoort bij een verzoek en is een heel ander ding. */
function inFunctie(pad) {
  return pad.some(x => /Function/.test(x.type) || x.type === 'MethodDefinition');
}

function scanBestand(bron, relPad) {
  const boom = parse(bron);
  const kandidaat = new Map();
  for (const k of boom.body) {
    if (k.type !== 'VariableDeclaration') continue;
    for (const d of k.declarations || []) {
      if (!d.id || d.id.type !== 'Identifier') continue;
      if (k.kind === 'let' || k.kind === 'var') {
        kandidaat.set(d.id.name, { soort: 'binding', kind: k.kind, lijn: k.lijn, altijd: true });
        continue;
      }
      const init = d.init;
      if (!init) continue;
      if (init.type === 'NewExpression' && CONTAINER.test((init.callee || {}).name || '')) {
        kandidaat.set(d.id.name, { soort: init.callee.name.toLowerCase(), lijn: k.lijn });
      } else if (init.type === 'ArrayExpression') kandidaat.set(d.id.name, { soort: 'array', lijn: k.lijn });
      else if (init.type === 'ObjectExpression') kandidaat.set(d.id.name, { soort: 'object', lijn: k.lijn });
    }
  }

  /* Twee verzamelingen en niet een: waar wordt er geschreven?

     Een wortel die alleen TIJDENS HET LADEN wordt geschreven -- op moduleniveau,
     dus voordat er ook maar iets van de server draait -- staat daarna vast. Dat
     is geen aanname maar een eigenschap van de code, en hij is statisch te zien.
     Zulke wortels zijn `bootvast`: ze kosten geen serverstart, want er valt niets
     te herstellen. Wordt er ook binnen een functie geschreven, dan kan het na de
     boot nog bewegen en moet een mens zeggen wat dat betekent. */
  const gemuteerd = new Set();
  const gemuteerdNaLaden = new Set();
  const klok = { datumLezing: 0, datumBouw: 0, dateNow: 0, hrtime: 0, perf: 0 };
  const willekeur = { math: 0, crypto: 0 };
  let timers = 0, listeners = 0, envSchrijf = 0, globalSchrijf = 0;

  loop(boom, (n, pad) => {
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression') {
      const o = n.callee.object, pr = n.callee.property || {};
      if (o && o.type === 'Identifier' && MUTMETHODE.test(pr.name || '')) {
        gemuteerd.add(o.name);
        if (inFunctie(pad)) gemuteerdNaLaden.add(o.name);
      }
      /* Object.assign(doel, ...) muteert zijn EERSTE argument; dat is een
         schrijfactie die je anders mist omdat er geen puntmethode op staat. */
      if (o && o.type === 'Identifier' && o.name === 'Object' && pr.name === 'assign') {
        const eerste = (n.arguments || [])[0];
        if (eerste && eerste.type === 'Identifier') {
          gemuteerd.add(eerste.name);
          if (inFunctie(pad)) gemuteerdNaLaden.add(eerste.name);
        }
      }
      const on = (o || {}).name;
      if (on === 'Date' && pr.name === 'now') klok.dateNow++;
      if (on === 'process' && pr.name === 'hrtime') klok.hrtime++;
      if (on === 'performance' && pr.name === 'now') klok.perf++;
      if (on === 'Math' && pr.name === 'random') willekeur.math++;
      if (on === 'crypto' && /^(randomBytes|randomUUID|randomInt|randomFillSync)$/.test(pr.name || '')) willekeur.crypto++;
    }
    if (n.type === 'AssignmentExpression' && n.left) {
      const l = n.left;
      if (l.type === 'Identifier') {
        gemuteerd.add(l.name);
        if (inFunctie(pad)) gemuteerdNaLaden.add(l.name);
      }
      if (l.type === 'MemberExpression' && l.object) {
        if (l.object.type === 'Identifier') {
          gemuteerd.add(l.object.name);
          if (inFunctie(pad)) gemuteerdNaLaden.add(l.object.name);
        }
        const o = l.object;
        const pad2 = o.type === 'MemberExpression'
          ? ((o.object || {}).name || '') + '.' + ((o.property || {}).name || '') : (o.name || '');
        if (pad2 === 'process.env') envSchrijf++;
        if (pad2 === 'globalThis' || pad2 === 'global') globalSchrijf++;
      }
    }
    if (n.type === 'UpdateExpression' && n.argument && n.argument.type === 'Identifier') {
      gemuteerd.add(n.argument.name);
      if (inFunctie(pad)) gemuteerdNaLaden.add(n.argument.name);
    }

    /* new Date() LEEST de klok; new Date(x) bouwt er een uit iets bestaands.
       Dat verschil is de helft van de census. */
    if (n.type === 'NewExpression' && n.callee && n.callee.name === 'Date') {
      if ((n.arguments || []).length) klok.datumBouw++; else klok.datumLezing++;
    }
    if (!inFunctie(pad) && n.type === 'CallExpression' && n.callee) {
      const c = n.callee;
      const naam = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' ? ((c.property || {}).name || '') : '');
      if (/^(setInterval|setTimeout)$/.test(naam)) timers++;
      if (/^(on|once|addListener)$/.test(naam)) listeners++;
    }
  });

  const wortels = [];
  for (const [naam, info] of kandidaat) {
    if (!info.altijd && !gemuteerd.has(naam)) continue;   // vaste tabel, geen toestand
    wortels.push({
      id: relPad + '#' + naam,
      bestand: relPad,
      naam,
      soort: info.soort === 'binding' ? 'binding-' + info.kind : info.soort,
      lijn: info.lijn || 0,
      /* Alleen bij het laden geschreven = na de boot vast. Dat is bewijs uit de
         code en geen classificatie door een mens; scripts/staat.js mag hem
         daarom vanzelf op `bootvast` zetten. */
      naLaden: gemuteerdNaLaden.has(naam),
      bron: 'scan'
    });
  }
  return { wortels, klok, willekeur, timers, listeners, envSchrijf, globalSchrijf };
}

/* De hele boom. Een bestand dat de eigen parser niet leest is GEEN nul: dat
   wordt geteld en genoemd, want een scanner die stil overslaat meet niets
   (LAT-regel 3). */
function scan({ wortel, mappen } = {}) {
  wortel = wortel || path.join(__dirname, '..', '..');
  mappen = mappen || ['server'];
  const uit = {
    wortels: [], onleesbaar: [], bestanden: 0,
    klok: { datumLezing: 0, datumBouw: 0, dateNow: 0, hrtime: 0, perf: 0 },
    willekeur: { math: 0, crypto: 0 }, timers: 0, listeners: 0, envSchrijf: 0, globalSchrijf: 0
  };
  for (const map of mappen) {
    for (const p of bestandenOnder(path.join(wortel, map)).sort()) {
      const rel = path.relative(wortel, p).split(path.sep).join('/');
      uit.bestanden++;
      let bron;
      try { bron = fs.readFileSync(p, 'utf8'); } catch (e) { uit.onleesbaar.push(rel); continue; }
      let deel;
      try { deel = scanBestand(bron, rel); } catch (e) { uit.onleesbaar.push(rel); continue; }
      uit.wortels.push(...deel.wortels);
      for (const k of Object.keys(uit.klok)) uit.klok[k] += deel.klok[k];
      uit.willekeur.math += deel.willekeur.math;
      uit.willekeur.crypto += deel.willekeur.crypto;
      uit.timers += deel.timers;
      uit.listeners += deel.listeners;
      uit.envSchrijf += deel.envSchrijf;
      uit.globalSchrijf += deel.globalSchrijf;
    }
  }
  uit.wortels.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  /* De ECHTE kloklezingen: alles wat de wandklok of een teller AFLEEST. Een
     new Date(x) hoort daar niet bij en zit daarom apart in `datumBouw`. */
  uit.klokLezingen = uit.klok.datumLezing + uit.klok.dateNow + uit.klok.hrtime + uit.klok.perf;
  return uit;
}

/* De eigenaar is standaard de map waarin de wortel woont. Dat is geen
   verzinsel maar de enige verdedigbare standaard: wie hem declareert bezit hem,
   tot een mens iets anders opschrijft. Twee mappen diep, want `server/kern` en
   `server/db` zeggen iets en `server` alleen niet. */
function eigenaarVan(relPad) {
  const delen = relPad.split('/');
  return delen.slice(0, Math.min(2, delen.length - 1)).join('/') || 'server';
}

module.exports = { scan, scanBestand, bestandenOnder, eigenaarVan, MUTMETHODE };
