/* DE SPRONG OP EEN DOCUMENT ZONDER BODY (public/shared/sprong.js).

   De sprong wordt op elke pagina met `defer` ingevoegd
   (server/middleware/kopinjectie.js), ook op een omleidingspagina als
   /apps/logboek.html die in de kop location.replace() aanroept. WebKit, de
   motor van Safari, stopt dan met parsen; de deferred laag loopt alsnog, op
   een document zonder body, en greepje() gooide
   "null is not an object (evaluating 'd.body.appendChild')" (de WebKit-job
   van run 38331448632, test/rahulscherm.e2e.js). Chromium parst door en kwam
   er nooit.

   Draai los: node --test test/sprong-zonderbody.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BRON = fs.readFileSync(path.join(__dirname, '../public/shared/sprong.js'), 'utf8');

function element() {
  const kinderen = [];
  return { kinderen, style: {}, classList: { add() {} }, setAttribute() {}, addEventListener() {},
    appendChild: k => { kinderen.push(k); return k; } };
}

function laad(body) {
  const document = {
    readyState: 'interactive', body, head: element(),
    createElement: element, getElementById: () => null, addEventListener() {}
  };
  const window = { localStorage: { getItem: () => 'tok' } };
  window.top = window; window.self = window;
  const ctx = { window, document, localStorage: window.localStorage, location: { pathname: '/apps/logboek.html' },
    fetch: () => Promise.resolve({ ok: false }), setTimeout: () => 0, console };
  vm.runInNewContext(BRON, ctx);
  return { window, document };
}

test('zonder body loopt de sprong stil voorbij in plaats van te gooien', () => {
  const { window } = laad(null);
  assert.equal(typeof window.RTGSprong.open, 'function', 'de laag staat er, alleen zonder greep');
});

test('met een body zet hij zijn greep er gewoon in', () => {
  const body = element();
  laad(body);
  assert.equal(body.kinderen.length, 1, 'de greep hangt in de body');
});
