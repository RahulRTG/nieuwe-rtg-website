'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bron = fs.readFileSync('public/shared/toegang.js', 'utf8');

function omgeving({ ds = false, loading = false } = {}) {
  let marker = ds;
  const stijlen = [];
  const documentElement = {
    hasAttribute(naam) { return naam === 'data-ds' && marker; },
    appendChild(node) { stijlen.push(node); }
  };
  const head = { appendChild(node) { stijlen.push(node); } };
  const body = { getAttribute() { return null; } };
  const document = {
    documentElement, head, body,
    readyState: loading ? 'loading' : 'complete',
    title: 'RTG',
    createElement(tag) { return { tagName: tag }; },
    getElementById(id) { return stijlen.find(node => node.id === id) || null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener(type, handler) { this[type] = handler; }
  };
  const window = { document, location: { pathname: '/apps/app.html' }, setTimeout(handler) { handler(); } };
  const context = vm.createContext({ window, document, MutationObserver: undefined });
  vm.runInContext(bron, context);
  return { document, stijlen, marker(value) { marker = value; } };
}

test('legacy toegang laadt exact één bestaand stylesheet', () => {
  const e = omgeving();
  assert.equal(e.stijlen.length, 1);
  assert.equal(e.stijlen[0].tagName, 'link');
  assert.equal(e.stijlen[0].id, 'rtg-toegang-stijl');
  assert.equal(e.stijlen[0].rel, 'stylesheet');
  assert.equal(e.stijlen[0].href, '/shared/toegang.css');
});

test('DS en een vóór DOMContentLoaded gezette DS-marker laden geen legacy toegangsstijl', () => {
  assert.equal(omgeving({ ds: true }).stijlen.length, 0);
  const laat = omgeving({ loading: true });
  laat.marker(true);
  laat.document.DOMContentLoaded();
  assert.equal(laat.stijlen.length, 0);
});
