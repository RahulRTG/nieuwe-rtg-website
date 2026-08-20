/* WELKE NAMEN PLUKT DIT BESTAND UIT EEN BEREIK DAT HET NIET HEEFT?

   WAAR DIT UIT KOMT, EN WAAROM HET DRIE KEER MOEST GEBEUREN VOOR HET ER STOND.

   Een groot bestand opknippen ziet er onschuldig uit: je verplaatst regels en
   de code is woord voor woord dezelfde. Maar een blok dat in zijn oude bestand
   een naam uit het OMRINGENDE bereik plukte, vindt die na de knip niet meer --
   en JavaScript zegt dat pas als de regel echt draait. Op 19 augustus 2026 ging
   dat op EEN dag drie keer mis, en alle drie op dezelfde manier stil:

     server/routes/werkplek-bureaus-b.js  `kies` en `BUREAUS` bleven in het
       eerste deel. /api/werkplek/bureaus gooide een ReferenceError, die de
       try/catch eromheen omzette in een 500 met "Er ging iets mis". Voor ELK
       huis kapot; gevonden door CI, twee dagen na de knip.

     server/routes/rtmail-lid.js  `klokNu` bleef in rtmail.js. De tak die hem
       gebruikt (een agenda-actie ZONDER datum) werd door geen enkele toets
       aangeraakt, dus niets werd rood.

     server/opzet/leverancierpoort.js  `grootSupplierSync` bleef in server.js,
       en een require-pad klopte niet meer vanuit een map dieper. Allebei op een
       pad dat een gewone ronde nooit raakt: een opzoeking in de GROTE kast, en
       het noodpad van de persoonseis.

   Wat geen van drieen betrapte: `node --check` (het is geldige syntaxis),
   scripts/routekaart.js (die START de server, hij doet geen verzoek) en de
   keuring (die leest tekst). Vandaar deze.

   HOE HIJ MEET, EN WAAR HIJ MET OPZET VOORZICHTIG IS.

   Elke Identifier die als WAARDE wordt gelezen telt mee; wat niet meetelt is een
   eigenschapsnaam (`a.b`), een sleutel in een object-literal, een label, en de
   naam die zelf wordt gebonden. Daarna gaat er af: alles wat dit bestand ERGENS
   bindt (waar dan ook, hoe diep dan ook) en alles wat globaal bestaat.

   DAT "WAAR DAN OOK" IS EEN BEWUSTE OVERSCHATTING. Een echte scope-analyse zou
   ook betrappen dat een naam wel gebonden is maar in een ANDER bereik. Die
   nauwkeurigheid kost hoisting, blokbereik, TDZ en met-clausules, en elke fout
   daarin is een vals alarm op een regel die verder klopt. Een vals alarm in een
   harde poort is duurder dan een gemist geval: het eerste kost vertrouwen in
   alle regels, het tweede kost dit ene geval. Dus liever te weinig melden dan
   te veel -- en dat staat hier, zodat niemand denkt dat de nul een garantie is.

   Alle drie de gevallen hierboven worden wel gezien; test/vrijenamen.test.js
   bouwt ze na. */
'use strict';
const { parse } = require('../ast/parser');
const { loop } = require('../ast/walk');

/* Wat een browser of Node zelf al meebrengt. Node's eigen lijst plus de namen
   die een CommonJS-module om zich heen krijgt; de browserkant staat erbij omdat
   public/ dezelfde scanner gebruikt. */
const GLOBAAL = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  'require', 'module', 'exports', '__dirname', '__filename', 'arguments',
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'localStorage',
  'sessionStorage', 'fetch', 'Headers', 'Request', 'Response', 'FormData', 'Blob', 'File',
  'FileReader', 'Image', 'Audio', 'Worker', 'MutationObserver', 'IntersectionObserver',
  'ResizeObserver', 'CustomEvent', 'Event', 'Node', 'NodeFilter', 'Element', 'HTMLElement', 'DOMParser',
  'XMLHttpRequest', 'WebSocket', 'RTCPeerConnection', 'SpeechRecognition',
  'webkitSpeechRecognition', 'AudioContext', 'webkitAudioContext', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'alert', 'confirm', 'prompt',
  'self', 'top', 'parent', 'frames', 'caches', 'indexedDB', 'crypto', 'performance'
]);

/* De namen die een knoop BINDT. Een patroon (destructuring, rest, standaard)
   kan er meer dan een bevatten, dus dit loopt erdoorheen. */
function bindingenUit(knoop, uit) {
  if (!knoop || typeof knoop !== 'object') return;
  switch (knoop.type) {
    case 'Identifier': uit.add(knoop.name); return;
    case 'ObjectPattern':
      for (const p of knoop.properties || []) bindingenUit(p.value || p.argument || p, uit);
      return;
    case 'ArrayPattern':
      for (const e of knoop.elements || []) bindingenUit(e, uit);
      return;
    case 'AssignmentPattern': bindingenUit(knoop.left, uit); return;
    case 'RestElement': bindingenUit(knoop.argument, uit); return;
    case 'Property': bindingenUit(knoop.value, uit); return;
    default: return;
  }
}

/* Staat deze Identifier op een plek waar hij een NAAM is en geen verwijzing? */
function isGeenVerwijzing(knoop, ouder) {
  if (!ouder) return false;
  // a.b -- `b` is een eigenschap, geen naam uit het bereik (a[b] wel: computed)
  if (ouder.type === 'MemberExpression' && ouder.property === knoop && !ouder.computed) return true;
  // { b: 1 } -- `b` is een sleutel. { [b]: 1 } wel, en { b } is shorthand: dan
  // is de waarde WEL een verwijzing, en die staat als eigen knoop in de boom.
  if (ouder.type === 'Property' && ouder.key === knoop && !ouder.computed && !ouder.shorthand) return true;
  if (ouder.type === 'MethodDefinition' && ouder.key === knoop && !ouder.computed) return true;
  if (ouder.type === 'PropertyDefinition' && ouder.key === knoop && !ouder.computed) return true;
  // label: en break/continue label
  if (ouder.type === 'LabeledStatement' && ouder.label === knoop) return true;
  if ((ouder.type === 'BreakStatement' || ouder.type === 'ContinueStatement') && ouder.label === knoop) return true;
  return false;
}

function vrijeNamen(bron) {
  let boom;
  try { boom = parse(String(bron)); }
  catch (e) { return { fout: (e && e.message) || String(e), namen: [] }; }

  const gebonden = new Set();
  const gelezen = new Map();     // naam -> eerste regelnummer

  loop(boom, (knoop, pad) => {
    const ouder = pad.length ? pad[pad.length - 1] : null;
    switch (knoop.type) {
      case 'VariableDeclarator': bindingenUit(knoop.id, gebonden); break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (knoop.id) bindingenUit(knoop.id, gebonden);
        for (const p of knoop.params || []) bindingenUit(p, gebonden);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (knoop.id) bindingenUit(knoop.id, gebonden);
        break;
      case 'CatchClause': if (knoop.param) bindingenUit(knoop.param, gebonden); break;
      case 'ImportSpecifier':
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
        if (knoop.local) bindingenUit(knoop.local, gebonden); break;
      case 'Identifier':
        if (!isGeenVerwijzing(knoop, ouder) && !gelezen.has(knoop.name)) {
          gelezen.set(knoop.name, knoop.lijn || 0);
        }
        break;
      default: break;
    }
  });

  const namen = [...gelezen.keys()]
    .filter((n) => !gebonden.has(n) && !GLOBAAL.has(n))
    .sort();
  return { fout: null, namen, regelVan: (n) => gelezen.get(n) || 0 };
}

module.exports = { vrijeNamen, GLOBAAL };
