/* De gedeelde publicatieregel van Krant en Saloon (public/apps/redactie/publicatie.js).

   DE FRAGILITEIT (melding Centraal, 19 oktober 2026). RTGPublicatieInfo las
   `a.correcties` zonder te kijken of er een artikel was; krant.html en
   saloon/lezer.js roepen hem ongeguard aan. Zonder artikel gooide hij een
   TypeError in plaats van een lege regel te geven.

   Draai los: node --test test/publicatie-info.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function laad() {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/apps/redactie/publicatie.js'), 'utf8'),
    { window: w, document: { documentElement: { lang: 'nl-NL' } } });
  return w.RTGPublicatieInfo;
}
const esc = (s) => String(s);

test('zonder artikel geeft de publicatieregel geen fout', () => {
  const info = laad();
  assert.doesNotThrow(() => info(undefined, esc));
  assert.equal(typeof info(null, esc), 'string');
});

test('een artikel met correcties toont ze nog steeds', () => {
  const uit = laad()({ versie: 2, correcties: [{ at: '2026-10-19T10:00:00Z', toelichting: 'Datum rechtgezet' }] }, esc);
  assert.match(uit, /Correcties en actualiseringen/);
  assert.match(uit, /Datum rechtgezet/);
  assert.match(uit, /Editie 2/);
});
