/* ============================================================================
   HET INVOERSPOOR -- wat las een generator WERKELIJK? (ARCHITECTOPDRACHT.md,
   fase 2)

   Draai een generator met deze preload ervoor:

     node -r ./scripts/lib/invoerspoor-preload.js scripts/symbolen.js

   en hij noteert, terwijl de generator draait, welke bestanden er gelezen
   worden, welke mappen er worden opgesomd, van welke paden alleen het BESTAAN
   wordt gevraagd, welke omgevingsvariabelen er worden gelezen, en welke
   subprocessen er starten. Het spoor zelf zet niets op schijf: de generator
   neemt het op in zijn stempel met `blok()` uit ./invoerspoor.js.

   WAAROM METEN EN NIET VERKLAREN. Een met de hand getypte invoerlijst is een
   tweede waarheid naast de code, en een te smalle lijst maakt een verouderde
   meting "actueel" -- de duurste fout die deze laag kan maken. Wat de generator
   leest, ziet hij hier zelf.

   WAT HIER NIET TE ZIEN IS, en daarom met naam wordt genoteerd in plaats van
   weggelaten: een subproces leest buiten dit proces om (een server, `git log`,
   `git ls-files`). Zo'n aanroep komt in `onwaarneembaar`, en dan is de versheid
   van die meting `onbekend` tot hij zijn invoer langs een andere weg aantoont.
   Alleen git-aanroepen die over de commit zelf gaan (rev-parse, status,
   cat-file) zijn geen invoer: dat is het stempel, niet de meting.

   Zonder deze preload verandert er niets: ./invoerspoor.js geeft dan `undefined`
   en het stempel blijft zoals het was.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const WORTEL = path.resolve(process.env.RTG_INVOER_WORTEL || path.join(__dirname, '..', '..'));

const spoor = {
  wortel: WORTEL,
  lees: new Set(),
  bestaat: new Set(),
  mappen: new Map(),        // pad -> recursief (boolean)
  schrijf: new Set(),
  omgeving: new Map(),      // naam -> gezet (boolean)
  onwaarneembaar: new Set(),
};

/* Een pad binnen de wortel, relatief en met voorwaartse streepjes. node_modules
   is geen bron van deze boom: wat daar staat volgt uit de pakketlijst, dus een
   lezing daaruit wordt een afhankelijkheid van package-lock.json. */
function rel(p) {
  if (p == null) return null;
  if (typeof p === 'number') return null;               // een bestandsdescriptor
  let s;
  try { s = p instanceof URL ? p.pathname : String(p); } catch (e) { return null; }
  if (Buffer.isBuffer(p)) s = p.toString();
  const abs = path.resolve(s);
  const r = path.relative(WORTEL, abs).replace(/\\/g, '/');
  if (!r || r.startsWith('..') || path.isAbsolute(r)) return null;
  if (r === '.git' || r.startsWith('.git/')) return null;
  if (r === 'node_modules' || r.startsWith('node_modules/')) return 'package-lock.json';
  return r;
}

function noteer(set, p) { const r = rel(p); if (r) set.add(r); }

function omhul(doel, naam, fn) {
  const orig = doel[naam];
  if (typeof orig !== 'function') return;
  doel[naam] = function (...args) { try { fn(args); } catch (e) { /* het spoor mag de generator nooit breken */ } return orig.apply(this, args); };
}

const LEES = ['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open'];
const BESTAAT = ['existsSync', 'statSync', 'lstatSync', 'accessSync', 'stat', 'lstat', 'access', 'realpathSync'];
const SCHRIJF = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream'];

for (const n of LEES) omhul(fs, n, (a) => {
  /* openSync met een schrijfvlag is een schrijfactie, geen lezing. */
  if ((n === 'openSync' || n === 'open') && a[1] && /[wa+]/.test(String(a[1]))) return noteer(spoor.schrijf, a[0]);
  noteer(spoor.lees, a[0]);
});
for (const n of BESTAAT) omhul(fs, n, (a) => noteer(spoor.bestaat, a[0]));
for (const n of SCHRIJF) omhul(fs, n, (a) => noteer(spoor.schrijf, a[0]));
for (const n of ['renameSync', 'rename', 'copyFileSync', 'copyFile']) omhul(fs, n, (a) => noteer(spoor.schrijf, a[1]));
for (const n of ['readdirSync', 'readdir', 'opendirSync', 'opendir']) omhul(fs, n, (a) => {
  const r = rel(a[0]);
  if (r) spoor.mappen.set(r, spoor.mappen.get(r) || !!(a[1] && typeof a[1] === 'object' && a[1].recursive));
});
if (fs.promises) {
  omhul(fs.promises, 'readFile', (a) => noteer(spoor.lees, a[0]));
  omhul(fs.promises, 'readdir', (a) => {
    const r = rel(a[0]);
    if (r) spoor.mappen.set(r, spoor.mappen.get(r) || !!(a[1] && typeof a[1] === 'object' && a[1].recursive));
  });
  for (const n of ['stat', 'lstat', 'access']) omhul(fs.promises, n, (a) => noteer(spoor.bestaat, a[0]));
  for (const n of ['writeFile', 'appendFile']) omhul(fs.promises, n, (a) => noteer(spoor.schrijf, a[0]));
}

/* Subprocessen. Alleen git over de commit zelf is geen invoer, en die draait
   STIL: zo'n aanroep geeft de hele omgeving door aan git, en zonder deze stilte
   zou elke variabele die er toevallig staat als "gelezen" tellen. */
const GIT_METADATA = new Set(['rev-parse', 'status', 'cat-file']);
function isMetadata(bestand, args) {
  const lijst = Array.isArray(args) ? args.map(String) : [];
  return path.basename(String(bestand || '')) === 'git' &&
    GIT_METADATA.has(lijst.find((x) => !x.startsWith('-')) || '');
}
function noteerSub(bestand, args) {
  const lijst = Array.isArray(args) ? args.map(String) : [];
  /* Een absoluut pad binnen de wortel wordt relatief: het pad van deze machine
     hoort niet in een register, en het maakt twee machines ongelijk. */
  const kort = lijst.slice(0, 3).map((x) => (path.isAbsolute(x) && rel(x) ? rel(x) : x));
  spoor.onwaarneembaar.add((path.basename(String(bestand || '')) + ' ' + kort.join(' ')).trim());
}
function omhulSub(naam, ontleed) {
  const orig = cp[naam];
  if (typeof orig !== 'function') return;
  cp[naam] = function (...a) {
    let meta = false;
    try { const [b, args] = ontleed(a); meta = isMetadata(b, args); if (!meta) noteerSub(b, args); } catch (e) { /* nooit breken */ }
    /* Ook een subproces dat WEL invoer is, draait stil voor de omgeving: het
       krijgt de hele omgeving mee, en dat is geen lezing door de generator.
       Zo'n meting is al onbekend door `onwaarneembaar`, en de namen van alle
       variabelen van de machine horen niet in een register. */
    spoor.stil = (spoor.stil || 0) + 1;
    try { return orig.apply(this, a); } finally { spoor.stil -= 1; }
  };
}
const viaShell = (a) => { const d = String(a[0] || '').trim().split(/\s+/); return [d[0], d.slice(1)]; };
for (const n of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) omhulSub(n, (a) => [a[0], a[1]]);
for (const n of ['exec', 'execSync']) omhulSub(n, viaShell);
omhulSub('fork', (a) => ['node', [a[0]].concat(Array.isArray(a[1]) ? a[1] : [])]);

/* Omgevingsvariabelen: alleen de NAAM en of hij gezet was. Een waarde kan een
   geheim zijn en hoort nooit in een register. */
try {
  const echt = process.env;
  process.env = new Proxy(echt, {
    /* Wie de omgeving OPSOMT (`{ ...process.env }`, Object.keys), kopieert hem
       in zijn geheel -- meestal om hem aan een subproces mee te geven. Dat is
       een feit, geen lijst namen: de namen van alle variabelen van een machine
       horen niet in een register. De lezingen die er direct op volgen, horen
       bij die kopie en worden niet los geteld. */
    ownKeys(doel) {
      if (!spoor.stil) {
        spoor.omgevingGekopieerd = true;
        spoor.stil = (spoor.stil || 0) + 1;
        process.nextTick(() => { spoor.stil -= 1; });
      }
      return Reflect.ownKeys(doel);
    },
    get(doel, sleutel) {
      if (typeof sleutel === 'string' && !spoor.stil) spoor.omgeving.set(sleutel, spoor.omgeving.get(sleutel) || (doel[sleutel] !== undefined && doel[sleutel] !== ''));
      return doel[sleutel];
    },
  });
} catch (e) { spoor.onwaarneembaar.add('omgeving: niet waar te nemen'); }

global.__rtgInvoerspoor = spoor;
