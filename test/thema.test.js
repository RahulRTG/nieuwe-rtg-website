/* De themalaag: de afspraak uit shared/rtg-themas.css, machinaal gehandhaafd.

   Er is EEN fout die deze laag telkens opnieuw maakt, en hij heeft twee
   spiegelbeelden: een vlak schildert zijn grond hard en haalt zijn inkt uit het
   thema, of een vlak schildert zijn inkt hard en haalt zijn grond uit het thema.
   Allebei zijn onzichtbaar zolang alle thema's donker zijn. Champagne is licht,
   en toen die erbij kwam gaf het op 19 augustus 2026 116 stukken tekst die
   letterlijk onzichtbaar waren -- tot 1,01:1.

   De a11y-poort vangt het gevolg (npm run a11y keurt alle vier de thema's over
   alle schermen). Deze toets vangt de OORZAAK, zonder browser, in twee vormen
   die allebei uit een echte fout komen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const THEMAS = fs.readFileSync(path.join(WORTEL, 'public/shared/rtg-themas.css'), 'utf8');
const UI = fs.readFileSync(path.join(WORTEL, 'public/shared/rtg-ui.css'), 'utf8');

/* De vier materiaalblokken plus het "altijd onyx"-eiland. Wie een token in een
   van deze blokken zet, moet hem in alle zetten -- dat is precies wat er misging. */
function blok(kop) {
  const i = THEMAS.indexOf(kop);
  assert.ok(i >= 0, 'blok niet gevonden: ' + kop);
  const j = THEMAS.indexOf('}', i);
  return THEMAS.slice(i, j);
}
const BLOKKEN = {
  champagne: blok(':root[data-rtg-thema="champagne"]{'),
  onyx: blok(':root[data-rtg-thema="onyx"]{'),
  bordeaux: blok(':root[data-rtg-thema="bordeaux"]{'),
  royal: blok(':root[data-rtg-thema="royal"]{'),
  'altijd-onyx': blok(':root[data-rtg-thema]:has(> body[data-rtg-eigenvlak="onyx"]){')
};

/* Tokens die BEWUST niet per materiaal verschillen: maten, en kleuren die hun
   eigen betekenis dragen los van de grond (het accent ademt met de dagkleur mee,
   groen is goed en rood is fout in elk materiaal). Wie hier iets bijzet, zegt
   daarmee: dit token betekent in alle vier de materialen hetzelfde. */
const MATERIAALVRIJ = new Set([
  '--rtg-rond', '--rtg-rond-klein', '--rtg-acc', '--rtg-acc-inkt',
  '--rtg-groen', '--rtg-rood'
]);

test('elk materiaaltoken uit de basis staat in ALLE vier de thema-blokken', () => {
  /* --rtg-card2 stond in de basis (#1B1817, bijna zwart) en in geen enkel
     themablok. Op vijftien schermen is dat het vlak van de meldingsstrook, met
     tekst uit --rtg-txt -- die WEL meethemaat. Onder champagne: 1,01:1. */
  const basis = UI.slice(UI.indexOf(':root{'), UI.indexOf('}', UI.indexOf(':root{')));
  const tokens = Array.from(basis.matchAll(/(--rtg-[\w-]+)\s*:/g), (m) => m[1])
    .filter((t) => !MATERIAALVRIJ.has(t));
  assert.ok(tokens.length >= 6, 'de basis hoort materiaaltokens te zetten, gevonden: ' + tokens.length);
  const ontbreekt = [];
  for (const t of tokens) {
    for (const [naam, b] of Object.entries(BLOKKEN)) {
      if (!new RegExp('\\' + t + '\\s*:').test(b)) ontbreekt.push(naam + ' mist ' + t);
    }
  }
  assert.deepEqual(ontbreekt, [],
    'een materiaaltoken dat maar in EEN materiaal staat, houdt in de andere drie de basiswaarde -- ' +
    'en die is voor onyx gekozen:\n  ' + ontbreekt.join('\n  '));
});

test('geen verloop mengt een thema-stop met een harde bijna-zwarte stop', () => {
  /* `linear-gradient(180deg,var(--bg),rgba(12,12,11,.86))` stond op 89 plekken:
     de eerste stop themaat mee, de tweede niet. Op champagne loopt zo'n kopbalk
     van parelmoer naar bijna-zwart terwijl de tekst erin licht blijft. De
     vertaling is color-mix(in srgb,var(--bg) 86%,transparent) -- dat zegt
     hetzelfde, en op onyx komt er exact dezelfde kleur uit. */
  const fout = [];
  (function loop(map) {
    for (const n of fs.readdirSync(map)) {
      const p = path.join(map, n);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!/\.(html|css|js)$/.test(n)) continue;
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/(?:linear|radial)-gradient\([^;{}]*?var\(--(?:bg|rtg-bg|rtg-grond|card|rtg-card)\)[^;{}]*?\)/g)) {
        if (/rgba?\(\s*(?:[0-9]|1[0-9]|2[0-9])\s*,\s*(?:[0-9]|1[0-9]|2[0-9])\s*,\s*(?:[0-9]|1[0-9]|2[0-9])\s*[,)]/.test(m[0]))
          fout.push(path.relative(WORTEL, p) + ': ' + m[0].slice(0, 90));
      }
    }
  })(path.join(WORTEL, 'public'));
  assert.deepEqual(fout, [],
    'een verloop dat EEN kant aan het thema geeft, is halverwege blijven staan:\n  ' + fout.join('\n  '));
});

test('het altijd-onyx-eiland zet zijn tokens op :root en niet op de body', () => {
  /* Ze stonden eerst op body[data-rtg-eigenvlak="onyx"]. Een pagina schrijft
     `:root{--txt:var(--rtg-txt)}` en die verwijzing wordt opgelost OP :root --
     dus een waarde die pas op de body staat, komt er nooit in. Op navigatie.html
     bleef daardoor elke knop de champagne-inkt houden terwijl de grond al onyx
     was: acht keer donker op donker. */
  assert.match(THEMAS, /:root\[data-rtg-thema\]:has\(> body\[data-rtg-eigenvlak="onyx"\]\)\{/,
    'de tokens van het altijd-onyx-eiland horen op :root te staan (via :has), niet op de body');
  const opBody = /body\[data-rtg-eigenvlak="onyx"\]\{([^}]*)\}/.exec(THEMAS);
  assert.ok(opBody, 'de body-regel van het eiland hoort te bestaan (grond en inkt)');
  assert.ok(!/--rtg-[\w-]+\s*:/.test(opBody[1]),
    'op de body horen alleen background en color te staan; tokens daar zijn onzichtbaar voor :root{--txt:var(--rtg-txt)}');
});
