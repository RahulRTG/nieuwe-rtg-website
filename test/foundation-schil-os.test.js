'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bron = fs.readFileSync('public/apps/foundation/schil-os.js', 'utf8');

function laad(pathname, bestaand = [], ds = false) {
  const nodes = [];
  const document = {
    documentElement: { hasAttribute(naam) { return naam === 'data-ds' && ds; } },
    head: { appendChild(node) { nodes.push(node); return node; } },
    createElement(tag) { return { tagName: tag.toUpperCase() }; },
    querySelector(selector) { return bestaand.includes(selector) ? {} : null; }
  };
  const window = { document, location: { pathname } };
  vm.runInContext(bron, vm.createContext({ window, document }));
  return { wereld: window.RTGWereld, nodes };
}

test('Foundation-kantoorschermen krijgen één kantoorwereld en drie statische eigenaren', () => {
  const f = laad('/apps/foundation/os-bestuur.html');
  assert.equal(f.wereld.sleutel, 'rtf-os');
  assert.deepEqual(f.nodes.map(n => n.href || n.src),
    ['/shared/wereldschil.css', '/shared/wereldschil.js', '/shared/glyf.js']);
});

test('DS-kantoorschermen gebruiken de centrale wereldnavigatie zonder legacy-presentatie', () => {
  const f = laad('/apps/foundation/os-bestuur.html', [], true);
  assert.equal(f.wereld.sleutel, 'rtf-os');
  assert.deepEqual(f.nodes.map(n => n.href || n.src),
    ['/shared/wereldschil.js', '/shared/glyf.js']);
});

test('deelnemers krijgen uitsluitend het portaal en bestaande eigenaren worden niet gedupliceerd', () => {
  const f = laad('/apps/foundation/os-deelnemer.html', ['link[href="/shared/wereldschil.css"]', 'script[src="/shared/glyf.js"]']);
  assert.equal(f.wereld.sleutel, 'rtf-portaal');
  assert.deepEqual(f.nodes.map(n => n.href || n.src), ['/shared/wereldschil.js']);
  assert.ok(!f.wereld.bestemmingen.some(x => x.id === 'bestuur'));
});

test('een onbekend Foundation-scherm krijgt geen verzonnen wereld', () => {
  const f = laad('/apps/foundation/onbekend.html');
  assert.equal(f.wereld, undefined); assert.deepEqual(f.nodes, []);
});
