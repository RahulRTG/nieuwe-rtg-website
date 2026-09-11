/* Edge 2.0 bestuurt het bestaande casco. Deze toets borgt dat er geen tweede
   balkenstelsel, netwerklaag of onbegrensde contextselectie ontstaat. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const edge = require('../public/shared/rtg-edge-2.js');

const ROOT = path.join(__dirname, '..');
const MAIN_PATH = path.join(ROOT, 'public/shared/rtg-edge-2.js');
const CONTEXT_PATH = path.join(ROOT, 'public/shared/rtg-edge-2-context.js');
const REVEAL_PATH = path.join(ROOT, 'public/shared/rtg-edge-2-reveal.js');
const CSS_PATH = path.join(ROOT, 'public/shared/rtg-edge-2.css');
const MAIN = fs.readFileSync(MAIN_PATH, 'utf8');
const CONTEXT = fs.readFileSync(CONTEXT_PATH, 'utf8');
const REVEAL = fs.readFileSync(REVEAL_PATH, 'utf8');
const CSS = fs.readFileSync(CSS_PATH, 'utf8');

test('het declaratieve contract en de drie renderstates zijn vast', () => {
  assert.deepEqual(edge.CONTRACT, {
    optin: 'data-rtg-edge-2',
    ready: 'data-rtg-edge-ready',
    state: 'data-rtg-edge-2-state',
    auto: 'data-rtg-edge-2-auto',
    context: 'data-rtg-edge-2-context',
    rendered: 'data-rtg-edge-2-rendered',
    storage: 'rtg.edge2.state.v1'
  });
  assert.deepEqual(edge.STATES, ['overview', 'compact', 'focus']);
  assert.equal(edge.normalizeState('compact'), 'compact');
  assert.equal(edge.normalizeState('onbekend'), 'overview');
  assert.equal(edge.nextState('overview'), 'compact');
  assert.equal(edge.nextState('compact'), 'focus');
  assert.equal(edge.nextState('focus'), 'overview');
});

test('auto gebruikt richting en hysterese maar overschrijft Focus of rust niet', () => {
  assert.equal(edge.autoState('overview', 20, false), 'compact');
  assert.equal(edge.autoState('compact', -20, false), 'overview');
  assert.equal(edge.autoState('overview', 8, false), 'overview');
  assert.equal(edge.autoState('overview', 40, true), 'overview');
  assert.equal(edge.autoState('focus', -40, false), 'focus');
  assert.match(CONTEXT, /INPUT\|TEXTAREA\|SELECT/);
  assert.match(CONTEXT, /isContentEditable/);
  assert.match(CONTEXT, /dialog\[open\]/);
  assert.match(CONTEXT, /data-rtg-edge-2-context-open/);
  assert.match(MAIN, /dragstart/);
  assert.match(MAIN, /source==='edge'.*toonStand\(actief,stand,'start'\)/,
    'een randtik herstelt zonder de automatische scrollstand vast te zetten');
});

test('auto luistert alleen naar een scroll van de mens, niet naar een scroll van de software', () => {
  /* De scroll-gebeurtenis zegt niet wie hem veroorzaakte. Een wiel, een vinger
     of een scrolltoets wel. Een scroll die de software zelf maakt
     (scrollIntoView, een anker, een focusverplaatsing) laat de stand staan:
     anders klapt de bovenrand in of uit, verschuift de body een knophoogte, en
     landt een tik die net op een knop mikte op wat eronder stond --
     test/appstore.e2e.js zag precies dat gebeuren. Een tik is met opzet GEEN
     gebaar: de software scrolt vaak vlak na een tik, en dat is de gevaarlijke
     volgorde. */
  const ev = (type, extra) => Object.assign({ type, key: '', target: null }, extra);
  assert.equal(edge.scrollGesture(ev('wheel')), true);
  assert.equal(edge.scrollGesture(ev('touchmove')), true);
  assert.equal(edge.scrollGesture(ev('keydown', { key: 'PageDown' })), true);
  assert.equal(edge.scrollGesture(ev('keydown', { key: ' ' })), true);
  assert.equal(edge.scrollGesture(ev('keydown', { key: 'a' })), false, 'typen is geen scrollen');
  assert.equal(edge.scrollGesture(ev('keydown', { key: ' ', target: { tagName: 'INPUT' } })), false,
    'een spatie in een veld scrolt niet');
  assert.equal(edge.scrollGesture(ev('keydown', { key: 'Tab', target: { tagName: 'INPUT' } })), true,
    'Tab verplaatst de focus, ook vanuit een veld');
  assert.equal(edge.scrollGesture(ev('scroll')), false, 'de scroll zelf zegt niet wie hem veroorzaakte');
  assert.equal(edge.scrollGesture(ev('pointerdown')), false, 'een tik is geen scroll');
  assert.equal(edge.scrollGesture(null), false);
  assert.ok(edge.GESTURE_MS >= 1000 && edge.GESTURE_MS <= 3000,
    'het venster dekt de uitloop van een veeg, zonder een minuut later nog te gelden');
  // en de bediening vraagt het ook echt: de scroll-luisteraar van het venster gaat langs de gebaartijd
  assert.match(CONTEXT, /\['wheel','touchmove','keydown'\]\.forEach/);
  assert.match(MAIN, /gebaarBind\(rt,rt\.win\);/);
  assert.match(MAIN, /if\(!gebaarVers\(rt\)\)return;/);
  // het venster loopt mee met een veeg die uitloopt: een geaccepteerde scroll verlengt het
  const rt = { gebaarTijd: Date.now() };
  assert.equal(edge.gestureFresh(rt), true);
  assert.equal(edge.gestureFresh({ gebaarTijd: 0 }), false, 'zonder gebaar is de scroll van de software');
  assert.equal(edge.gestureFresh({}), false);
});

test('alleen de gesloten lijst contexttokens wordt geaccepteerd', () => {
  assert.deepEqual(Object.keys(edge.CONTEXT).sort(), [
    'duimbalk', 'hoofdtabs', 'living-bank', 'living-top', 'native-header',
    'rtgdeel-balk', 'travel-header', 'wereldapps', 'wereldtabs', 'work-bank',
    'work-top', 'world-shell'
  ]);
  assert.deepEqual(edge.parseContext('work-bank,work-top').tokens, ['work-bank', 'work-top']);
  assert.equal(edge.parseContext('auto').auto, true);
  assert.deepEqual(edge.parseContext('none').tokens, []);
  assert.equal(edge.parseContext('#willekeurig,body').ok, false);
  assert.equal(edge.CONTEXT['travel-header'], '.reisapp > .prestatiekop');
});

function element(classes = [], attrs = {}) {
  return {
    classList: { contains: name => classes.includes(name) },
    getAttribute: name => Object.hasOwn(attrs, name) ? attrs[name] : null
  };
}

test('elk embedcontract tekent niets', () => {
  const maak = ({ frame = false, search = '', htmlClasses = [], htmlAttrs = {}, bodyClasses = [] } = {}) => {
    const win = { location: { search } };
    win.self = frame ? {} : win;
    win.top = frame ? {} : win;
    return {
      win,
      doc: { documentElement: element(htmlClasses, htmlAttrs), body: element(bodyClasses) }
    };
  };
  for (const invoer of [
    { frame: true }, { search: '?embed=1' }, { htmlClasses: ['rtg-command-blad'] },
    { htmlAttrs: { 'data-rtg-oppervlak': '1' } }, { bodyClasses: ['rtg-edge-embed'] }
  ]) {
    const { doc, win } = maak(invoer);
    assert.equal(edge.isEmbedded(doc, win), true);
    assert.equal(edge.start(doc, win), null);
  }
  const normaal = maak();
  assert.equal(edge.isEmbedded(normaal.doc, normaal.win), false);
});

test('lokale voorkeur is begrensd, valide en faalt veilig', () => {
  const calls = [];
  const storage = {
    value: 'compact',
    getItem(key) { calls.push(['get', key]); return this.value; },
    setItem(key, value) { calls.push(['set', key, value]); this.value = value; },
    removeItem(key) { calls.push(['remove', key]); this.value = null; }
  };
  assert.equal(edge.readPreference(storage), 'compact');
  assert.equal(edge.writePreference(storage, 'overview'), true);
  assert.equal(edge.writePreference(storage, 'niet-toegestaan'), false);
  assert.ok(calls.every(call => call[1] === edge.CONTRACT.storage));
  assert.ok(calls.filter(call => call[0] === 'set').every(call => call[2].length <= 8));
  const kapot = new Proxy({}, { get() { throw new Error('opslag uit'); } });
  assert.equal(edge.readPreference(kapot), null);
  assert.equal(edge.writePreference(kapot, 'focus'), false);
});

test('renderen vereist exact een bestaande top, side, bottom en merk', () => {
  const root = { contains: node => node !== buiten };
  const top = {}, side = {}, bottom = {}, mark = {}, buiten = {};
  const body = { getAttribute: name => name === edge.CONTRACT.ready ? 'true' : null };
  const waarden = {
    '.rtg-edge-chrome': [root], '.rtg-edge-top': [top], '.rtg-edge-side': [side],
    '.rtg-edge-bottom': [bottom], '.rtg-edge-mark': [mark]
  };
  const doc = { body, querySelectorAll: selector => waarden[selector] || [] };
  assert.deepEqual(edge.inspectChrome(doc), { root, top, side, bottom, mark });
  waarden['.rtg-edge-top'] = [top, buiten];
  assert.equal(edge.inspectChrome(doc), null);
  waarden['.rtg-edge-top'] = [top];
  waarden['.rtg-edge-mark'] = [];
  assert.equal(edge.inspectChrome(doc), null);
});

test('Edge 2 maakt geen bars, stylesheet of netwerkverkeer', () => {
  const code = MAIN + '\n' + CONTEXT;
  assert.doesNotMatch(code, /fetch\s*\(|XMLHttpRequest|sendBeacon|\/api\//);
  assert.doesNotMatch(code, /createElement\(['"](?:header|aside|footer|link)['"]\)/);
  assert.doesNotMatch(code, /stylesheet|\.href\s*=|\.src\s*=/);
  assert.doesNotMatch(code, /className\s*=\s*['"]rtg-edge-(?:top|side|bottom|chrome)/);
  assert.match(MAIN, /inspecteerChrome\(doc\)/);
});

test('vier expliciete keuzes en contextbediening zijn toetsenbordtoegankelijk', () => {
  for (const label of ['Overzicht', 'Compact', 'Automatisch', 'Focus']) assert.ok(MAIN.includes(label));
  assert.match(MAIN, /setAttribute\('role',\s*'group'\)/);
  assert.match(MAIN, /setAttribute\('aria-pressed'/);
  assert.match(MAIN, /setAttribute\('aria-expanded'/);
  assert.match(MAIN, /setAttribute\('aria-controls'/);
  assert.match(MAIN, /e\.key\s*!==\s*'Escape'/);
  assert.match(CSS, /\.rtg-edge-2-mode:focus-visible/);
  assert.match(CSS, /min-height:44px/);
  assert.equal((MAIN.match(/Volledige bediening tonen/g) || []).length, 1);
  assert.match(MAIN, /rtg-edge-2-reveal rtg-edge2-reveal/);
});

test('de marker volgt pas na volledige bereikbaarheid en verwijdering herstelt bronnen', () => {
  const check = MAIN.search(/throw new Error\('Edge niet volledig bereikbaar'\)/);
  const marker = MAIN.search(/body\.setAttribute\(CONTRACT\.rendered,\s*'true'\)/);
  assert.ok(check >= 0 && marker > check);
  assert.match(CONTEXT, /body\.removeAttribute\(CONTRACT\.rendered\)/);
  assert.match(CONTEXT, /ouder\.insertBefore|ouder\.appendChild/);
  assert.match(MAIN, /CONTRACT\.ready/);
});

test('CSS toont per state alleen de bedoelde bestaande randen', () => {
  assert.match(CSS, /data-rtg-edge-2-state="overview"\] \.rtg-edge-top[^}]*transform:none!important/);
  assert.match(CSS, /data-rtg-edge-2-state="compact"\] \.rtg-edge-top[^}]*visibility:hidden/);
  assert.match(CSS, /data-rtg-edge-2-state="compact"\] \.rtg-edge-bottom[^}]*visibility:hidden/);
  assert.match(CSS, /data-rtg-edge-2-state="focus"\] \.rtg-edge-bottom[^}]*visibility:hidden/);
  assert.doesNotMatch(CSS, /data-rtg-edge-2-state="compact"\] \.rtg-edge-2-reveal/);
  assert.match(CSS, /data-rtg-edge-2-state="compact"\] \.rtg-edge-2-edge-reveal\{display:block\}/);
  assert.match(CSS, /@media\(max-width:767px\)[\s\S]*\.rtg-edge-side\{display:none!important\}/);
  assert.match(CSS, /data-rtg-edge-2-rendered="true"[\s\S]*wereldtabs:not\(\[data-rtg-edge-2-contextual\]\)/);
  assert.doesNotMatch(CSS, /\.rtg-edge-chrome\s*\{[^}]*display:none/);
});

test('boven- en onderbalk delen één wereldmateriaal en compact kan via beide randen terug', () => {
  for (const wereld of ['living', 'travel', 'work', 'foundation']) {
    const blok = CSS.match(new RegExp('data-rtg-world="' + wereld + '"\\]\\{([^}]+)\\}'));
    assert.ok(blok && blok[1].includes('--edge-bar-bg:#'), wereld + ' mist een eigen balkkleur');
  }
  assert.match(CSS, /\.rtg-edge-top,[\s\S]*\.rtg-edge-bottom\{[\s\S]*background:var\(--edge-bar-bg\)!important/);
  assert.equal((REVEAL
    .match(/rtg-edge-2-edge-reveal--/g) || []).length, 1,
  'de herstelmodule bouwt de twee kanten uit één begrensde lus');
  assert.match(REVEAL, /RTGEdge2\.setState\('overview', \{ source: 'edge' \}\)/);
});

test('iedere wereld laat Edge dezelfde centrale Heritage-tokens consumeren', () => {
  const rollen = {
    bg: 'bg', panel: 'card', copy: 'ink', dim: 'muted', line: 'line',
    accent: 'signature', 'accent-soft': 'signature-soft', metal: 'metal'
  };
  for (const wereld of ['living', 'travel', 'work', 'foundation']) {
    const blok = CSS.match(new RegExp('data-rtg-world="' + wereld + '"\\]\\{([^}]+)\\}'));
    assert.ok(blok, wereld + ' heeft geen Edge-palet');
    for (const [rol, token] of Object.entries(rollen)) {
      assert.ok(blok[1].includes('--edge2-' + rol + ':'), wereld + ' mist rol ' + rol);
      assert.ok(blok[1].includes('var(--rtg-world-' + token + ','),
        wereld + ' laat Edge-' + rol + ' niet uit de centrale wereldrol erven');
    }
  }
  const chrome = CSS.match(/\.rtg-edge-chrome\{([^}]+)\}/)[1];
  for (const rol of ['bg', 'panel', 'copy', 'dim', 'line', 'accent', 'accent-soft', 'metal']) {
    assert.ok(chrome.includes('--edge-' + rol + ':var(--edge2-' + rol + ')'), 'chrome erft ' + rol + ' niet');
  }
});

test('beide browsermodules blijven onder de productlimiet', () => {
  assert.ok(fs.statSync(MAIN_PATH).size < 10 * 1024, 'hoofdmodule is te groot');
  assert.ok(fs.statSync(CONTEXT_PATH).size < 10 * 1024, 'contextmodule is te groot');
});
