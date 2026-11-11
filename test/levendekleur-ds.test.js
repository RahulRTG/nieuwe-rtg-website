'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bron = fs.readFileSync('public/shared/levendekleur.js', 'utf8');

function omgeving({ ds = false, rustig = false } = {}) {
  const stijlen = [], attrs = new Map(ds ? [['data-ds', '1']] : []), vars = new Map();
  const html = {
    style: { setProperty(naam, waarde) { vars.set(naam, waarde); } },
    hasAttribute(naam) { return attrs.has(naam); },
    getAttribute(naam) { return attrs.get(naam) ?? null; },
    setAttribute(naam, waarde) { attrs.set(naam, String(waarde)); }
  };
  const body = { setAttribute() {} };
  const document = {
    documentElement: html, body, readyState: 'complete',
    head: { appendChild(node) { stijlen.push(node); return node; } },
    createElement(tag) { return { tagName: tag.toUpperCase() }; },
    getElementById(id) { return stijlen.find(node => node.id === id) || null; },
    querySelector() { return null; }, addEventListener() {}
  };
  const opslag = new Map(), localStorage = {
    getItem(naam) { return opslag.get(naam) ?? null; },
    setItem(naam, waarde) { opslag.set(naam, String(waarde)); }
  };
  let frame;
  const window = {
    document, location: { pathname: '/apps/app.html', search: '' },
    performance: { now: () => 1000 },
    matchMedia: () => ({ matches: rustig }),
    addEventListener() {}, requestAnimationFrame(fn) { frame = fn; return 1; }
  };
  vm.runInContext(bron, vm.createContext({ window, document, localStorage, URLSearchParams, Date, Math }));
  return { window, stijlen, attrs, vars, frame, opslag };
}

for (const ds of [false, true]) test((ds ? 'DS' : 'legacy') + ' gebruikt dezelfde canonieke levende-kleurpresentatie', () => {
  const e = omgeving({ ds });
  assert.equal(e.stijlen.length, 1);
  assert.deepEqual({ tag: e.stijlen[0].tagName, id: e.stijlen[0].id, rel: e.stijlen[0].rel, href: e.stijlen[0].href },
    { tag: 'LINK', id: 'levendegrond-stijl', rel: 'stylesheet', href: '/ds/levendekleur.css' });
  assert.equal(typeof e.window.RTGLevend.palet, 'function');
  assert.equal(typeof e.window.RTGBeweging.zet, 'function');
});

test('bewegingsvoorkeur en paletlogica blijven onderdeel van de bestaande motor', () => {
  const e = omgeving({ rustig: true });
  assert.equal(e.attrs.get('data-beweging'), 'rustig');
  assert.equal(e.vars.get('--beweging'), '0.200');
  const p = e.window.RTGLevend.palet('pastel', new Date(2026, 6, 19, 12), 1, 0);
  assert.match(p.top, /^rgba\(/); assert.match(p.onder, /^rgba\(/); assert.match(p.basis, /^rgba\(/);
  e.window.RTGBeweging.zet(100);
  assert.equal(e.opslag.get('rtg_beweging'), '100');
  assert.equal(e.attrs.get('data-beweging'), 'levendig');
});

test('de canonieke presentatie bevat adaptieve beweging en de drie geregistreerde kleuren', () => {
  const css = fs.readFileSync('public/ds/levendekleur.css', 'utf8');
  for (const naam of ['--levend-top', '--levend-onder', '--levend-basis']) assert.match(css, new RegExp('@property ' + naam));
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /\[data-levendegrond\]/);
  assert.match(css, /\[data-levendegrond\]::before/);
  assert.doesNotMatch(css, /!important/);
});

test('alleen de transparante Command-schil onderdrukt zijn levende pseudo-laag', () => {
  const css = fs.readFileSync('public/ds/levendekleur.css', 'utf8');
  const grond = css.match(/(?:^|\n)\s*\[data-levendegrond\]::before\s*\{([^}]+)\}/);
  assert.ok(grond, 'echte levende grondvlakken houden hun centrale presentatie');
  assert.match(grond[1], /content\s*:\s*["']["']\s*;/,
    'de gewone levende grond blijft een pseudo-laag schilderen');
  assert.match(css, /body\.rtg-command\s+#shell\[data-levendegrond\]::before\s*\{\s*content\s*:\s*none\s*;\s*\}/,
    'de hogere Command-ladehouder blijft transparant, voor en na het inloggen');
});
