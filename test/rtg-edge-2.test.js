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
const CSS_PATH = path.join(ROOT, 'public/shared/rtg-edge-2.css');
const MAIN = fs.readFileSync(MAIN_PATH, 'utf8');
const CONTEXT = fs.readFileSync(CONTEXT_PATH, 'utf8');
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
  assert.match(CSS, /data-rtg-edge-2-state="compact"\] \.rtg-edge-bottom[^}]*transform:none!important/);
  assert.match(CSS, /data-rtg-edge-2-state="focus"\] \.rtg-edge-bottom[^}]*visibility:hidden/);
  assert.doesNotMatch(CSS, /data-rtg-edge-2-state="compact"\] \.rtg-edge-2-reveal/);
  assert.match(CSS, /@media\(max-width:767px\)[\s\S]*\.rtg-edge-side\{display:none!important\}/);
  assert.match(CSS, /data-rtg-edge-2-rendered="true"[\s\S]*wereldtabs:not\(\[data-rtg-edge-2-contextual\]\)/);
  assert.doesNotMatch(CSS, /\.rtg-edge-chrome\s*\{[^}]*display:none/);
});

test('iedere wereld bezit de volledige goedgekeurde Edge-materiaalset', () => {
  const paletten = {
    living: ['#f4f0e8', '#fbf8f2', '#211e19', '#675f54', 'rgba(33,30,25,.16)', '#b89545', 'rgba(184,149,69,.14)', '#745718'],
    travel: ['#14090e', '#231016', '#f7f0e6', '#c2b2aa', 'rgba(247,240,230,.16)', '#7f1634', 'rgba(127,22,52,.22)', '#d0b77b'],
    work: ['#0c1112', '#141b1c', '#f0f2ec', '#aab6b2', 'rgba(240,242,236,.15)', '#75b8b1', 'rgba(117,184,177,.16)', '#c1a45f'],
    foundation: ['#071522', '#0b2032', '#f2f2ea', '#aebccc', 'rgba(242,242,234,.16)', '#d0b66e', 'rgba(208,182,110,.16)', '#d0b66e']
  };
  for (const [wereld, waarden] of Object.entries(paletten)) {
    const blok = CSS.match(new RegExp('data-rtg-world="' + wereld + '"\\]\\{([^}]+)\\}'));
    assert.ok(blok, wereld + ' heeft geen Edge-palet');
    for (const waarde of waarden) assert.ok(blok[1].includes(waarde), wereld + ' mist ' + waarde);
    for (const rol of ['bg', 'panel', 'copy', 'dim', 'line', 'accent', 'accent-soft', 'metal']) {
      assert.ok(blok[1].includes('--edge2-' + rol + ':'), wereld + ' mist rol ' + rol);
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
