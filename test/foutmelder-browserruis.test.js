'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { meldingen } = require('../scripts/lib/browserruis');

function laad() {
  const handlers = {}, verstuurd = [];
  const window = { addEventListener: (naam, fn) => { handlers[naam] = fn; } };
  const context = { window, location: { pathname: '/apps/test.html' },
    localStorage: { getItem: () => null }, document: { addEventListener() {}, readyState: 'loading' },
    navigator: { sendBeacon: (pad, lijf) => { verstuurd.push({ pad, lijf }); return true; } },
    Blob: class Blob { constructor(delen, opties) { this.delen = delen; this.opties = opties; } },
    fetch: () => Promise.resolve() };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/foutmelder.js'), 'utf8'), context);
  return { handlers, verstuurd };
}

test('de clientmelder negeert alleen de bekende browserovergangsruis', () => {
  const { handlers, verstuurd } = laad();
  for (const melding of meldingen) {
    handlers.unhandledrejection({ reason: Object.assign(new Error(melding), { name: 'InvalidStateError' }) });
    handlers.error({ message: melding, filename: '', lineno: 0 });
  }
  assert.equal(verstuurd.length, 0, 'browserruis vervuilt de operationele foutstroom');
  handlers.unhandledrejection({ reason: new TypeError('echte applicatiefout') });
  assert.equal(verstuurd.length, 1, 'een echte applicatiefout wordt verborgen');
});
