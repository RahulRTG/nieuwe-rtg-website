/* DE DREMPELS VAN DE GEBAREN STAAN OP EEN PLEK (EDGE.md par. 11, ronde 1).

   Lang drukken was 480 ms in de balk en de orb en 620 ms in de adaptieve balk --
   de balk die een lid op app.html echt gebruikt. Omhoog trekken begon daar op
   36 px, terwijl GRAMMATICA.md 44 px zegt. Zes herkenners hadden elk een eigen
   getal, en de Edge 2-lader een kopie van de gebaarversheid. Nu staat er een
   tabel, `DREMPELS` in shared/adaptief/grammatica.js, en elke herkenner leest
   hem op het moment dat het gebaar begint.

   ZONDER TABEL IS HET GEBAAR UIT, en nergens een kopie van het getal. Een
   kopie is precies hoe deze vijf getallen uit elkaar gingen lopen. De tik, de ⋯
   en het toetsenbord blijven werken; vasthouden om te bevestigen bevestigt dan
   nooit.

   DE MUTATIES, elk nagetrokken: zet `}, 620);` terug in de invoerlaag (de
   777-proef zakt), zet in balkknop.js weer `480` (idem), haal de grammatica-regel
   uit index.html (de structuurtoets zakt), laat vasthoud.js zonder tabel een
   vaste duur nemen (de vasthoudtoets zakt), en zet `var LANG = 480;` terug in
   orb.js (de bronscan zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const gram = require('../public/shared/adaptief/grammatica.js');

test('DREMPELS is een gesloten tabel, en de getallen zijn die van GRAMMATICA.md', () => {
  assert.deepEqual(Object.keys(gram.DREMPELS).sort(),
    ['diep', 'herbevestig', 'lang', 'omhoog', 'poging', 'sluit', 'stil', 'veeg']);
  for (const [k, v] of Object.entries(gram.DREMPELS)) assert.equal(typeof v, 'number', k);
  const doc = lees('GRAMMATICA.md');
  assert.match(doc, new RegExp('Drempels: ' + gram.DREMPELS.omhoog + 'px en ' + gram.DREMPELS.diep + 'px'),
    'omhoog en diep horen de getallen van GRAMMATICA.md te zijn');
  assert.equal(gram.DREMPELS.herbevestig, 4000, 'GRAMMATICA.md: "vier seconden geldig"');
  assert.ok(gram.DREMPELS.lang < gram.VASTHOUD.zwaar, 'uitleggen hoort sneller te gaan dan bevestigen');
});

/* Een kleine nep-omgeving die onthoudt met welke tijd een timer werd gezet. */
function klokken() {
  const gezet = [];
  return { gezet, setTimeout: (f, ms) => { gezet.push(ms); return gezet.length; }, clearTimeout() {} };
}
const metLang = (ms) => Object.assign({}, gram, { DREMPELS: Object.assign({}, gram.DREMPELS, { lang: ms }) });

test('de adaptieve balk en de balkknop lezen lang drukken uit de tabel (777-proef)', () => {
  /* Met 777 in de tabel moet de timer op 777 staan: zo bewijst de toets dat het
     getal gelezen wordt, en niet toevallig hetzelfde is. */
  const k = klokken(), luister = {};
  const bar = { addEventListener: (n, f) => { luister[n] = f; }, setPointerCapture() {}, style: { setProperty() {}, removeProperty() {} } };
  const win = { RTGGrammatica: metLang(777), setTimeout: k.setTimeout, clearTimeout: k.clearTimeout, addEventListener() {}, scrollY: 0 };
  const window = { navigator: {} };
  vm.runInNewContext(lees('public/shared/rtg-adaptive-edge-input.js'), { window, document: {} });
  window.RTGAdaptiveEdgeInput.bind({ win, doc: { addEventListener() {} }, bar }, { deck() {}, state() {}, rahul() {} });
  luister.pointerdown({ pointerType: 'touch', clientX: 0, clientY: 0 });
  assert.deepEqual(k.gezet, [777], 'de adaptieve balk hoort lang drukken uit DREMPELS te lezen');

  const k2 = klokken(), knoppen = [];
  const el = () => { const e = { luister: {}, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, appendChild() {}, addEventListener(n, f) { this.luister[n] = f; } }; knoppen.push(e); return e; };
  const w2 = { RTGGrammatica: metLang(777), setTimeout: k2.setTimeout, clearTimeout: k2.clearTimeout, console: { warn() {} } };
  vm.runInNewContext(lees('public/shared/adaptief/balkknop.js'), { window: w2, document: { createElement: el, createTextNode: () => ({}) } });
  const b = w2.RTGAdaptiefBalkKnoppen({ items: () => [], titel: () => '' }).knop({ id: 'x', naam: 'X', label: 'X' });
  b.luister.pointerdown({});
  assert.deepEqual(k2.gezet, [777], 'de balkknop hoort lang drukken uit DREMPELS te lezen');
});

test('zonder tabel is het gebaar uit: geen timer op de balk, en vasthouden bevestigt nooit', () => {
  const k = klokken(), luister = {};
  const bar = { addEventListener: (n, f) => { luister[n] = f; }, setPointerCapture() {}, style: { setProperty() {}, removeProperty() {} } };
  const win = { setTimeout: k.setTimeout, clearTimeout: k.clearTimeout, addEventListener() {}, scrollY: 0 };
  const window = { navigator: {} };
  vm.runInNewContext(lees('public/shared/rtg-adaptive-edge-input.js'), { window, document: {} });
  window.RTGAdaptiveEdgeInput.bind({ win, doc: { addEventListener() {} }, bar }, { deck() {}, state() {}, rahul() {} });
  luister.pointerdown({ pointerType: 'touch', clientX: 0, clientY: 0 });
  assert.deepEqual(k.gezet, [], 'zonder drempels hoort de balk geen gebaar te meten');

  let klaar = 0;
  const el = () => ({ luister: {}, style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {},
    addEventListener(n, f) { this.luister[n] = f; } });
  const w3 = { console: { warn() {} }, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {} };
  vm.runInNewContext(lees('public/shared/adaptief/vasthoud.js'), { window: w3, document: { createElement: el } });
  const knop = w3.RTGVasthoud({ klaar: () => { klaar++; } });
  assert.equal(knop.disabled, true, 'zonder drempels hoort de bevestigknop uit te staan');
  for (const n of ['pointerdown', 'click', 'keydown']) if (knop.luister[n]) knop.luister[n]({ key: 'Enter', preventDefault() {} });
  assert.equal(klaar, 0, 'en hij bevestigt nooit');
});

test('geen herkenner draagt nog een eigen getal', () => {
  const code = (p) => zonderCommentaar(lees(p));
  assert.doesNotMatch(code('public/shared/rtg-adaptive-edge-input.js'), /\}, 6?[248]0\);|dy < -36|> 36\)/, 'de invoerlaag hoort de tabel te lezen');
  assert.doesNotMatch(code('public/shared/adaptief/balkknop.js'), /\}, 480\);/);
  assert.doesNotMatch(code('public/shared/adaptief/orb.js'), /LANG = 480/);
  assert.doesNotMatch(code('public/shared/adaptief/diepte.js'), /EERSTE = 44|TWEEDE = 150|GRIJP = 8/);
  assert.doesNotMatch(code('public/shared/adaptief/lagen.js'), /y > 90\)/);
  assert.doesNotMatch(code('public/shared/adaptief/vasthoud.js'), /HERBEVESTIG|<= 0\.15/);
  assert.doesNotMatch(code('public/shared/rtg-edge-2-loader.js'), /GESTURE_MS/, 'de gebaarversheid heeft een eigenaar: rtg-edge-2-context.js');
});

test('elke pagina die de invoerlaag zelf laadt, laadt eerst de grammatica', () => {
  /* De lader brengt de grammatica mee, maar de landing en de negen sitepagina's
     laden de invoerlaag rechtstreeks. Zonder deze regel vallen de gebaren daar
     stil weg (ontwerpronde 1, V7). */
  const paginas = [];
  (function loop(map) {
    for (const e of fs.readdirSync(path.join(WORTEL, map), { withFileTypes: true })) {
      const p = map ? map + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(e.name) && !p.startsWith('server')) loop(p); }
      else if (p.endsWith('.html')) paginas.push(p);
    }
  })('public');
  paginas.push('index.html');
  const laden = paginas.filter((p) => /rtg-adaptive-edge-input\.js/.test(lees(p)));
  assert.ok(laden.length >= 10, 'de meting hoort de pagina\'s te vinden die de invoerlaag laden (gevonden: ' + laden.length + ')');
  const zonder = laden.filter((p) => {
    const s = lees(p), g = s.search(/adaptief\/grammatica\.js/), i = s.search(/rtg-adaptive-edge-input\.js/);
    return g < 0 || g > i;
  });
  assert.deepEqual(zonder, [], 'deze pagina\'s laden de invoerlaag zonder eerst de grammatica');
});
