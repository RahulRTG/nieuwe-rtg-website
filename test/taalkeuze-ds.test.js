'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../public/shared/i18n.js'), 'utf8');
function laag(ds) {
  const styles = [], timers = [], attrs = {}, nodes = new Map();
  const document = { readyState: 'loading', head: { appendChild: n => { styles.push(n); nodes.set(n.id, n); } },
    documentElement: { hasAttribute: n => n === 'data-ds' && ds, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; } },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, getElementById: id => nodes.get(id), createElement: tag => ({ tag }) };
  const window = { document, addEventListener() {}, dispatchEvent() {}, RTGAutoVertaling: { apply() {} } };
  vm.runInNewContext(bron, { window, document, navigator: { language: 'nl' }, location: { origin: 'https://rtg.invalid' },
    localStorage: { setItem() {} }, setTimeout: fn => timers.push(fn), clearTimeout() {},
    CustomEvent: class {}, fetch: async () => { throw Error('geen netwerk in deze ontwikkelproef'); } });
  return { api: window.RTGi18n, styles, nodes, timers, attrs };
}
test('taalkeuze: DS injecteert niets dubbel; legacy laadt exact hetzelfde DS-component', () => {
  const ds = laag(true); ds.api.injectStyles(); ds.api.injectStyles(); assert.equal(ds.styles.length, 0);
  const oud = laag(false); oud.api.injectStyles(); oud.api.injectStyles(); assert.equal(oud.styles.length, 1);
  assert.equal(oud.styles[0].id, 'rtg-i18n-styles');
  assert.equal(oud.styles[0].tag, 'link'); assert.equal(oud.styles[0].rel, 'stylesheet');
  assert.equal(oud.styles[0].href, '/ds/taalkeuze-standalone.css');
  const stijl = fs.readFileSync(path.join(__dirname, '../public/ds/taalkeuze-standalone.css'), 'utf8');
  assert.match(stijl, /@import url\("tokens\.css"\)/);
  assert.match(stijl, /@import url\("componenten\/taalkeuze\.css"\)/);
  assert.doesNotMatch(stijl, /!important|#[\da-f]{3,8}\b/);
});
test('taalkeuze: alle 114 registercodes blijven vindbaar via dezelfde matcher', () => {
  const { TALEN } = require('../server/talen'), { api } = laag(true); api._lijst = TALEN;
  assert.equal(TALEN.length, 114);
  for (const t of TALEN) assert.equal(api.zoekTaal(t.code).code, t.code);
  assert.equal(api.zoekTaal('nederland').code, 'nl'); assert.equal(api.zoekTaal('日本語').code, 'ja');
});
test('taalkeuze: sluiten sluit de native laag en herstelt uitsluitend verbonden focus', () => {
  for (const verbonden of [true, false]) {
    const f = laag(true); let closed = 0, focused = 0, removed = 0;
    f.nodes.set('rtg-lang-modal', { tagName: 'DIALOG', open: true, classList: { remove: () => removed++ }, close: () => closed++ });
    f.api._taalTerug = { isConnected: verbonden, focus: () => focused++ };
    f.api.closeModal(); f.timers.forEach(fn => fn());
    assert.equal(closed, 1); assert.equal(removed, 1); assert.equal(focused, verbonden ? 1 : 0);
  }
});
test('taalkeuze: bundel, canonieke component en semantische tokens sluiten', () => {
  assert.equal(bron, require('../scripts/bundel').bundel('shared/i18n.js').toString('utf8'));
  const ds = path.join(__dirname, '../public/ds'), css = fs.readFileSync(path.join(ds, 'componenten/taalkeuze.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(ds, 'tokens.css'), 'utf8');
  for (const m of css.matchAll(/var\((--ds-[\w-]+)\)/g)) assert.ok(tokens.includes(m[1] + ':'), m[1]);
  assert.deepEqual(require('../scripts/ontwerpsysteem').contractFouten({ paginas: {} }).filter(f => f.includes('componenten/taalkeuze.css')), []);
  assert.ok(JSON.parse(fs.readFileSync(path.join(ds, 'contract.json'), 'utf8')).componenten.includes('taalkeuze'));
  assert.match(fs.readFileSync(path.join(ds, 'bediening.css'), 'utf8') + fs.readFileSync(path.join(ds, 'rtg-ds.css'), 'utf8'), /@import url\("componenten\/taalkeuze\.css"\)/);
  assert.match(bron, /createElement\('dialog'\)/);
  assert.match(bron, /className = 'rtg-lang-scrim ds-taalkeuze'/);
});
