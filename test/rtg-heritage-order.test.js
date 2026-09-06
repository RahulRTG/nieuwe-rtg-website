'use strict';
/* Dynamisch bijgeladen scherm-CSS mag de centrale materiaaltaal niet per
   ongeluk achter zich laten. Dezelfde link wordt na nieuwe stijlen gezet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const order = require('../public/shared/rtg-heritage-order.js');

const ROOT = path.join(__dirname, '..');

function omgeving() {
  const heritage = { tagName: 'LINK', rel: 'stylesheet', id: 'rtgHeritageCss', parentNode: null };
  const scherm = { tagName: 'LINK', rel: 'stylesheet', parentNode: null };
  const script = { tagName: 'SCRIPT', parentNode: null };
  const kinderen = [heritage, script, scherm];
  const head = {
    querySelectorAll() { return kinderen.filter(e => e.tagName === 'STYLE' || e.rel === 'stylesheet'); },
    appendChild(e) {
      const i = kinderen.indexOf(e); if (i >= 0) kinderen.splice(i, 1);
      kinderen.push(e); e.parentNode = this; return e;
    }
  };
  kinderen.forEach(e => { e.parentNode = head; });
  const doc = {
    head,
    getElementById(id) { return id === 'rtgHeritageCss' ? heritage : null; },
    querySelector() { return null; }
  };
  return { doc, head, heritage, scherm, script, kinderen };
}

test('de bestaande Heritage-link verhuist achter een later schermblad', () => {
  const o = omgeving();
  assert.equal(order.ensureLast(o.doc), true);
  assert.strictEqual(o.kinderen.at(-1), o.heritage);
  assert.equal(o.kinderen.filter(e => e === o.heritage).length, 1);
  assert.equal(order.ensureLast(o.doc), false, 'een tweede controle verandert niets');
});

test('scripts na Heritage veranderen de CSS-cascade niet', () => {
  const o = omgeving();
  o.kinderen.splice(o.kinderen.indexOf(o.scherm), 1);
  o.kinderen.splice(o.kinderen.indexOf(o.heritage), 1);
  o.kinderen.unshift(o.heritage);
  assert.strictEqual(order.lastStyle(o.head), o.heritage);
  assert.equal(order.ensureLast(o.doc), false);
});

test('basis laadt de kleine ordehelper exact één keer', () => {
  const deel = fs.readFileSync(path.join(ROOT, 'public/shared/basis/basis-01ab-heritage-order.js'), 'utf8');
  assert.match(deel, /RTGHeritageOrder/);
  assert.match(deel, /rtg-heritage-order\.js/);
  assert.ok(fs.statSync(path.join(ROOT, 'public/shared/rtg-heritage-order.js')).size < 10 * 1024);
});
