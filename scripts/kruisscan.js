/* Kruis-slice-scan: vangt de klasse fouten die ontstaat bij het opknippen van een
   monoliet in een map met slices (X/index.js + zusjes). In het oude bestand deelden
   functies top-level locals; na het splitsen woont zo'n naam nog maar in EEN slice.
   Verwijst een ander slice er dan kaal naar (niet gedeclareerd, niet gerequired, geen
   global), dan is dat een ReferenceError die pas op runtime knalt -- vaak op een pad
   dat de tests (demo-modus) niet raken, net als de kapotte require-paden die eerder
   boven water kwamen. `node --check` ziet het niet: elk bestand compileert prima los.

   Aanpak, bewust conservatief (liever een gemist geval dan vals alarm in CI):
   - een "groep" is elke map met een index.js; de slices zijn de .js ERNAAST (niet
     recursief -- geneste submappen zijn hun eigen groep);
   - per bestand verzamelen we ALLE bindingen (requires, const/let/var incl. destructuring,
     functies, klassen, parameters, catch) -- ruim, want overschatten onderdrukt hooguit
     een melding, het veroorzaakt er nooit een;
   - per bestand verzamelen we de top-level declaraties (inspring 0 of 2: de modulescope
     en de factory-body `(ctx) => { ... }`), want dat zijn de namen die een zuster kaal
     kan raken;
   - meldt: een naam die in slice A top-level bestaat, in slice B gebruikt wordt, maar in
     B nergens binnenkomt en geen global is.

   Zo blijft vals alarm onwaarschijnlijk: de naam moet toevallig exact een top-level
   binding van een zuster-slice zijn EN in het gebruikende bestand nergens gedeclareerd. */
'use strict';
const fs = require('fs');
const path = require('path');

// Globals + sleutelwoorden die als kale identifier voorbij kunnen komen maar nooit
// een kruis-slice-verwijzing zijn. Ruim genomen; een gemiste global geeft hooguit een
// extra kandidaat die alsnog door de zuster-match valt (die naam moet dan ook nog een
// zuster-top-level zijn), dus geen vals alarm in de praktijk.
const GLOBALS = new Set([
  'undefined', 'NaN', 'Infinity', 'globalThis', 'global', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Symbol', 'BigInt', 'Math', 'JSON', 'Date', 'RegExp', 'Error',
  'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Proxy', 'Reflect', 'Function',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'escape', 'unescape', 'ArrayBuffer', 'SharedArrayBuffer',
  'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array',
  'BigUint64Array', 'Atomics', 'structuredClone', 'queueMicrotask', 'atob', 'btoa',
  // Node
  'require', 'module', 'exports', '__dirname', '__filename', 'process', 'Buffer', 'console',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate',
  'clearImmediate', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'AbortController',
  'AbortSignal', 'Event', 'EventTarget', 'MessageChannel', 'MessagePort', 'performance',
  'crypto', 'fetch', 'Headers', 'Request', 'Response', 'Blob', 'FormData', 'WebSocket',
  'ReadableStream', 'WritableStream', 'TransformStream',
  // sleutelwoorden (crude tokenizer kan ze als identifier zien)
  'this', 'super', 'arguments', 'let', 'const', 'var', 'function', 'return', 'if', 'else',
  'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'delete', 'typeof',
  'instanceof', 'in', 'of', 'void', 'yield', 'await', 'async', 'class', 'extends', 'throw',
  'try', 'catch', 'finally', 'default', 'export', 'import', 'from', 'as', 'static', 'get',
  'set', 'true', 'false', 'null', 'with', 'debugger'
]);

/* Vervang commentaar, strings, template-literals en (heuristisch) regex-literals door
   spaties, met behoud van newlines en dus inspringing. Zo bevatten de scans hieronder
   geen tekst uit strings/commentaar, terwijl de kolomstructuur intact blijft. */
function strip(src) {
  let out = '';
  const n = src.length;
  const OPENERS = new Set(['=', '(', ',', ':', ';', '!', '&', '|', '?', '{', '}', '[',
    '<', '>', '+', '-', '*', '%', '^', '~', 'r'/* return */]);
  let i = 0, prev = '';
  const pushSpaces = (from, to) => { for (let k = from; k < to; k++) out += (src[k] === '\n' ? '\n' : ' '); };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = i + 2; while (j < n && src[j] !== '\n') j++; pushSpaces(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = i + 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++; j = Math.min(n, j + 2); pushSpaces(i, j); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; } j++; pushSpaces(i, Math.min(n, j)); i = Math.min(n, j); prev = ' '; continue; }
    if (c === '`') { let j = i + 1; while (j < n && src[j] !== '`') { if (src[j] === '\\') j++; j++; } j++; pushSpaces(i, Math.min(n, j)); i = Math.min(n, j); prev = ' '; continue; }
    if (c === '/' && OPENERS.has(prev)) { // regex-literal (heuristiek op vorige betekenisvolle char)
      let j = i + 1, inClass = false, ok = false;
      while (j < n) { const ch = src[j]; if (ch === '\\') { j += 2; continue; } if (ch === '\n') break; if (ch === '[') inClass = true; else if (ch === ']') inClass = false; else if (ch === '/' && !inClass) { ok = true; j++; break; } j++; }
      if (ok) { while (j < n && /[a-z]/i.test(src[j])) j++; pushSpaces(i, j); i = j; prev = ' '; continue; }
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

const identsIn = str => str.match(/[A-Za-z_$][\w$]*/g) || [];

/* Alle namen die IN dit bestand in scope komen (ruim genomen). */
function bindings(s) {
  const D = new Set();
  const add = str => { for (const x of identsIn(str)) D.add(x); };
  let m;
  // const/let/var met destructuring: pak het patroon tot de sluit-bracket
  let re = /\b(?:const|let|var)\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/g;
  while ((m = re.exec(s))) add(m[1]);
  // const/let/var met een enkele naam
  re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(s))) D.add(m[1]);
  // functiedeclaraties/-expressies + hun parameters
  re = /\bfunction\s*(\*?\s*[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
  while ((m = re.exec(s))) { if (m[1]) add(m[1]); add(m[2]); }
  // arrow-parameters tussen haakjes:  (a, {b}) =>
  re = /\(([^()]*)\)\s*=>/g;
  while ((m = re.exec(s))) add(m[1]);
  // arrow met een enkele kale parameter:  x =>
  re = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = re.exec(s))) D.add(m[1]);
  // methode-/property-functies:  naam(params) {   -- alleen de params zijn bindingen
  re = /[A-Za-z_$][\w$]*\s*\(([^()]*)\)\s*\{/g;
  while ((m = re.exec(s))) add(m[1]);
  // klassenamen
  re = /\bclass\s+([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(s))) D.add(m[1]);
  // catch-parameter
  re = /\bcatch\s*\(([^)]*)\)/g;
  while ((m = re.exec(s))) add(m[1]);
  return D;
}

/* De top-level declaraties: inspring 0 (modulescope) of 2 (factory-body). Dit zijn de
   namen die een zuster-slice kaal kan raken. Waarde-kant wordt niet meegepakt (we lezen
   de LHS tot de eerste `=`), zodat er geen namen uit de initializer insluipen. */
function topDecls(s) {
  const namen = new Set();
  const re = /^( {0,2})(const|let|var|function|class)\b([^\n]*)/gm;
  let m;
  while ((m = re.exec(s))) {
    const rest = m[3];
    if (m[2] === 'function' || m[2] === 'class') {
      const nm = rest.match(/^\s*\*?\s*([A-Za-z_$][\w$]*)/);
      if (nm) namen.add(nm[1]);
      continue;
    }
    // const/let/var: neem de LHS tot de eerste top-level `=` (of einde regel)
    let lhs = rest;
    const eq = rest.search(/=(?!=)/);
    if (eq >= 0) lhs = rest.slice(0, eq);
    else if (/[{[]/.test(rest) && !/[}\]]/.test(rest)) {
      // meerregelige destructuring: pak door tot de sluit-bracket verderop
      const start = m.index + m[0].length;
      const staart = s.slice(start, start + 600);
      const tot = staart.search(/=(?!=)/);
      lhs = rest + (tot >= 0 ? staart.slice(0, tot) : staart);
    }
    for (const x of identsIn(lhs)) namen.add(x);
  }
  return namen;
}

const gebruikt = (s, naam) => new RegExp('(?<![.\\w$])' + naam + '(?![\\w$])(?!\\s*:)').test(s);

/* Doorzoek de hele boom onder `root`. Retourneert een lijst bevindingen:
   { bestand, naam, zuster } -- allemaal repo-relatieve paden. */
function scan(root) {
  const bevindingen = [];
  function bezoek(dir) {
    const namen = fs.readdirSync(dir);
    for (const naam of namen) {
      const vol = path.join(dir, naam);
      if (fs.statSync(vol).isDirectory()) { if (!/node_modules|\.git|data|dist/.test(naam)) bezoek(vol); }
    }
    if (!namen.includes('index.js')) return;
    const slices = namen.filter(n => n.endsWith('.js')).map(n => path.join(dir, n));
    if (slices.length < 2) return;
    const info = slices.map(f => { const s = strip(fs.readFileSync(f, 'utf8')); return { f, s, D: bindings(s), top: topDecls(s) }; });
    for (const F of info) {
      const gemeld = new Set();
      for (const S of info) {
        if (S === F) continue;
        for (const naam of S.top) {
          if (gemeld.has(naam) || F.D.has(naam) || GLOBALS.has(naam)) continue;
          if (gebruikt(F.s, naam)) {
            gemeld.add(naam);
            bevindingen.push({ bestand: path.relative(root, F.f), naam, zuster: path.relative(root, S.f) });
          }
        }
      }
    }
  }
  bezoek(root);
  return bevindingen;
}

module.exports = { scan, strip, bindings, topDecls };
