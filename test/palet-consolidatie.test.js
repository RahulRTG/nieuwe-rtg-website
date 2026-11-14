'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ontwerp = require('../scripts/ontwerpsysteem');
const bron = fs.readFileSync('public/shared/palet.js', 'utf8');

function omgeving(sprong) {
  const listeners = {};
  const document = { addEventListener(type, handler) { listeners[type] = handler; } };
  const window = { RTGSprong: sprong };
  vm.runInNewContext(bron, { window, document, Object });
  return { window, listeners };
}

test('het voormalige palet is alleen een compatibiliteitsingang naar Sprong', () => {
  const calls = [];
  const { window } = omgeving({ open() { calls.push('open'); }, sluit() { calls.push('sluit'); } });
  assert.equal(window.RTGPalet.open(), true);
  assert.equal(window.RTGPalet.sluit(), true);
  assert.deepEqual(calls, ['open', 'sluit']);
  assert.equal(Object.isFrozen(window.RTGPalet), true);
  for (const verwijderd of ['rosPalet', 'rtg_palet_recent', '/shared/rosapps.js', 'location.href', 'style.cssText'])
    assert.equal(bron.includes(verwijderd), false, verwijderd + ' hoort niet meer bij de adapter');
});

test('Ctrl of Cmd plus Spatie opent dezelfde Sprong en voorkomt browsergedrag', () => {
  let geopend = 0, voorkomen = 0;
  const { listeners } = omgeving({ open() { geopend++; }, sluit() {} });
  listeners.keydown({ ctrlKey: true, metaKey: false, code: 'Space', preventDefault() { voorkomen++; } });
  listeners.keydown({ ctrlKey: false, metaKey: true, code: 'Space', preventDefault() { voorkomen++; } });
  listeners.keydown({ ctrlKey: true, metaKey: false, code: 'KeyK', preventDefault() { voorkomen++; } });
  assert.equal(geopend, 2);
  assert.equal(voorkomen, 2);
});

test('zonder Sprong faalt de adapter dicht en blijft de laadgraaf schoon', () => {
  const { window } = omgeving(null);
  assert.equal(window.RTGPalet.open(), false);
  assert.equal(window.RTGPalet.sluit(), false);
  const analyse = ontwerp.scriptLaadAnalyse(bron, { ds: false });
  assert.deepEqual(analyse.onzeker, []);
  assert.deepEqual(analyse.verwijzingen, []);
  assert.equal(analyse.injecties + analyse.mogelijkeInjecties, 0);
});
