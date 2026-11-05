'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { dsBereik, telInjectie } = require('../scripts/ontwerpsysteem');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const bron = lees('public/shared/rahul-tab/style-base.js');
function host(volledig) {
  const nodes = [], klassen = new Set(); let eigenaar = false, ctx;
  const document = {
    body: { classList: { add: k => klassen.add(k) } },
    documentElement: { hasAttribute: n => volledig && n === "data-ds" },
    querySelectorAll: () => volledig ? [{ getAttribute: () => "/ds/rtg-ds.css" }] : [],
    querySelector: q => q === 'link[href="/ds/rtg-ds.css"]' ? (volledig ? {} : null)
      : q === '.rtg-rahul-page' && eigenaar ? {} : null,
    getElementById: id => nodes.find(n => n.id === id),
    createElement: tag => ({ tag }), head: { appendChild: n => {
      nodes.push(n);
      if (n.tag === 'script') vm.runInContext(lees('public' + n.src), ctx);
    } }
  };
  const window = {}; ctx = vm.createContext({ document, window });
  return { nodes, window, klassen, eigenaar: () => { eigenaar = true; }, laad: () => vm.runInContext(bron, ctx), twin: () => vm.runInContext(lees('public/shared/rahul-tab/style-twin.js'), ctx) };
}
test('zonder Rahul-owner blijft legacybediening zichtbaar; late owner laadt oorspronkelijke presentatie eenmaal', () => {
  const h = host(false); h.laad(); h.twin(); h.laad();
  assert.equal(h.nodes.length, 0, 'standalone handenvrij krijgt geen Rahul-presentation of suppression');
  h.eigenaar(); h.laad(); h.laad(); h.twin();
  assert.equal(h.nodes.filter(n => n.tag === 'link').length, 0, 'geen extra canonieke laag bovenop legacy');
  assert.equal(h.nodes.filter(n => n.tag === 'script').length, 1);
  assert.equal(h.nodes.filter(n => n.tag === 'style').length, 2);
  const base = h.nodes.find(n => n.id === 'rtgRahulTabBasisStijl').textContent;
  const twin = h.nodes.find(n => n.id === 'rtgRahulTabTwinStijl').textContent;
  assert.match(base, /\.rtg-command-grid\{/);
  assert.match(base, /\.rtg-rahul-tab\{min-height:44px!important;min-width:44px!important\}/);
  assert.match(base, /\.rtg-rahul-tab\[hidden\]\{display:none!important\}/);
  assert.match(twin, /\.rtg-twin\{/);
});
test('DS krijgt geen stijlinjectie; alleen een echte owner activeert canonieke vervanging', () => {
  const h = host(true); h.laad(); h.twin();
  assert.equal(h.nodes.length, 0);
  assert.equal(h.klassen.has('ds-rahul-eigenaar'), false);
  h.window.__rahulTabDialoog = {}; h.laad(); h.twin(); h.laad();
  assert.equal(h.nodes.length, 0);
  assert.equal(h.klassen.has('ds-rahul-eigenaar'), true);
  assert.equal(h.nodes.filter(n => n.id === 'rtgRahulTabTwinStijl').length, 0);
});
test('DS behoudt canonieke componenten zonder reset in de deelentry', () => {
  const deel = lees('public/ds/bediening.css');
  assert.doesNotMatch(deel, /@import[^;]*(?:reset|schermen\/|rtg-ds)/);
  for (const naam of ['rahul', 'samen', 'handenvrij']) {
    assert.ok(deel.includes('componenten/' + naam + '.css'));
    assert.ok(JSON.parse(lees('public/ds/contract.json')).componenten.includes(naam));
  }
  assert.ok(lees('public/ds/rtg-ds.css').includes('@import url("bediening.css")'));
});
test('een componentimport promoveert geen legacy-host tot DS-scherm', () => {
  const bladen = ['public/ds/bediening.css', 'public/ds/componenten/rahul.css'];
  assert.deepEqual(dsBereik('<link href="/shared/rtg-ui.css" rel="stylesheet">', bladen), { ds: false, dsDeel: true });
  assert.deepEqual(dsBereik('<link href="/ds/bediening.css" rel="stylesheet">', bladen), { ds: false, dsDeel: true });
  assert.deepEqual(dsBereik('<link href="/ds/rtg-ds.css" rel="stylesheet">', bladen), { ds: true, dsDeel: false });
  assert.deepEqual(dsBereik('', []), { ds: false, dsDeel: false });
});

test('bestaande per-bestand injectieratels blijven ongewijzigd gehaald', () => {
  for (const naam of ['style-base', 'style-twin']) {
    assert.equal(telInjectie(lees('public/shared/rahul-tab/' + naam + '.js')), 1, naam);
  }
});
