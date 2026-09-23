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
   orb.js (de bronscan zakt).

   RONDE 2: DE GEBAARLAAG VAN DE LIJSTEN (shared/gebaar/) stond er nog buiten,
   met 520 ms en 8 px van zichzelf. Hij leest nu DREMPELS.lang en .stil bij het
   neerdrukken en brengt de grammatica zelf mee. De mutaties: zet `}, 520);`
   terug in gebaar-03b.js (de 777-proef en de verbodslijst zakken), zet de
   stilgrens terug op 8 (de stilproef zakt), en laad de grammatica altijd,
   zonder te kijken of hij er al is (de proef op het zachte laden zakt). */
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
  /* De gebaarlaag van de lijsten sinds ronde 2. gebaar-02.js staat er met opzet
     NIET bij: RICHTING (8 px voor veeg of scroll) en STIL (6 px voor de klik
     erna) zijn andere gebaren dan lang drukken, en die vragen een eigen meting
     voordat ze naar de tabel mogen (EDGE.md par. 11). Tot dan is gebaar-02.js
     eerlijk een tweede beslisser over gebaar-drempel op de kaart. */
  assert.doesNotMatch(code('public/shared/gebaar/gebaar-03b.js'), /\}, 520\);|< 8 &&|< 8\)/,
    'lang drukken en stilstaan van de gebaarlaag horen de tabel te lezen');
});

/* DE GEBAARLAAG IN EEN KALE OMGEVING. De bundel shared/gebaar.js draait hier in
   een vm met net genoeg document om een regel aan te melden en een aanwijzer neer
   te zetten; de timers worden onthouden in plaats van gezet. Zo meet de proef wat
   de laag MET de tabel doet, en niet of een browser op tijd was. */
function gebaarlaag(tabel, alGeladen) {
  const luister = {}, gezet = [], gewist = [], kinderen = [];
  const el = (tag) => ({
    tagName: String(tag).toUpperCase(), attrs: {}, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; }, appendChild(n) { kinderen.push(n); return n; },
    addEventListener() {}, querySelectorAll() { return []; }, isConnected: true,
    get src() { return this.attrs.src; }, set src(v) { this.attrs.src = v; }
  });
  const document = {
    head: el('head'), body: el('body'), documentElement: el('html'), createElement: el,
    getElementById: () => null, dispatchEvent() {},
    addEventListener: (n, f) => { (luister[n] = luister[n] || []).push(f); },
    /* Alleen de twee vragen die de laag stelt: staat het blad er al, en is de
       grammatica al onderweg. */
    querySelector: (k) => {
      const m = /^(link|script)\[(href|src)(\*?)="([^"]+)"\]$/.exec(k);
      return m ? kinderen.find((n) => n.tagName === m[1].toUpperCase() &&
        (m[3] ? String(n.attrs[m[2]] || '').includes(m[4]) : n.attrs[m[2]] === m[4])) || null : null;
    }
  };
  /* Een scripttag die de pagina zelf al zette maar die nog niet draaide (defer),
     en dan met het RELATIEVE adres dat negen schermen gebruiken. */
  if (alGeladen) { const s = el('script'); s.src = alGeladen; kinderen.push(s); }
  const window = { RTGGrammatica: tabel };
  vm.runInNewContext(lees('public/shared/gebaar.js'), {
    window, document, navigator: {}, location: { href: '' }, localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: false }), addEventListener() {}, WeakMap, CustomEvent: function () {},
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    setTimeout: (f, ms) => { gezet.push(ms); return gezet.length; }, clearTimeout: (id) => { if (id) gewist.push(id); },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, performance: { now: () => 0 }, getComputedStyle: () => ({})
  });
  const rij = el('div');
  rij.closest = (k) => (k === '.gb-rij' ? rij : null);
  rij.matches = () => false;
  const stuur = (n, e) => (luister[n] || []).forEach((f) => f(Object.assign({ target: rij, button: 0, pointerId: 1 }, e)));
  return { window, gezet, gewist, rij, stuur,
    grammaticaTags: () => kinderen.filter((n) => n.tagName === 'SCRIPT' && /\/shared\/adaptief\/grammatica\.js/.test(n.attrs.src || '')) };
}
const EEN_ACTIE = { rechts: [{ naam: 'Openen', doe() {} }] };

test('de gebaarlaag leest lang drukken en stilstaan uit de tabel (777-proef), en zonder tabel loopt er geen timer', () => {
  const L = gebaarlaag(Object.assign({}, gram, { DREMPELS: Object.assign({}, gram.DREMPELS, { lang: 777, stil: 5 }) }));
  assert.equal(L.window.RTGGebaar.zet(L.rij, EEN_ACTIE), true, 'de proef heeft een aangemelde regel nodig');
  L.stuur('pointerdown', { clientX: 100, clientY: 100 });
  assert.deepEqual(L.gezet, [777], 'lang drukken hoort zijn tijd uit DREMPELS.lang te lezen');
  /* Zes pixels opzij: binnen de oude 8, buiten de 5 van de tabel. Dan hoort de
     timer weg te zijn -- dit is geen vasthouden meer. */
  L.stuur('pointermove', { clientX: 106, clientY: 100 });
  assert.deepEqual(L.gewist, [1], 'wie verder schuift dan DREMPELS.stil, houdt niet meer vast');

  const Z = gebaarlaag(undefined);
  Z.window.RTGGebaar.zet(Z.rij, EEN_ACTIE);
  Z.stuur('pointerdown', { clientX: 100, clientY: 100 });
  assert.deepEqual(Z.gezet, [], 'zonder tabel hoort er geen timer te lopen, en nergens een eigen getal');
});

test('de gebaarlaag laadt de grammatica zacht: een keer, en niet als hij er al is', () => {
  const Z = gebaarlaag(undefined);
  assert.equal(Z.grammaticaTags().length, 0, 'in rust hoort de laag niets te laden');
  Z.window.RTGGebaar.zet(Z.rij, EEN_ACTIE);
  Z.window.RTGGebaar.lijst(Z.rij, '.x', () => EEN_ACTIE);
  Z.window.RTGGebaar.zet(Z.rij, EEN_ACTIE);
  assert.deepEqual(Z.grammaticaTags().map((n) => [n.attrs.src, n.async]), [['/shared/adaptief/grammatica.js', true]],
    'bij de eerste zet() of lijst() hoort er EEN scripttag te komen, zacht, en geen tweede erna');

  const tabel = Object.assign({}, gram);
  const M = gebaarlaag(tabel);
  M.window.RTGGebaar.zet(M.rij, EEN_ACTIE);
  M.window.RTGGebaar.lijst(M.rij, '.x', () => EEN_ACTIE);
  assert.equal(M.grammaticaTags().length, 0, 'staat de grammatica er al, dan hoort de laag hem niet nog eens te laden');
  assert.equal(M.window.RTGGrammatica, tabel, 'en blijft het dezelfde globale -- een tweede lading maakt een tweede tabel');

  const O = gebaarlaag(undefined, '../../shared/adaptief/grammatica.js');
  O.window.RTGGebaar.zet(O.rij, EEN_ACTIE);
  assert.equal(O.grammaticaTags().length, 1,
    'staat hij al onderweg (een uitgestelde tag met een relatief adres), dan hoort er geen tweede bij te komen');
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
