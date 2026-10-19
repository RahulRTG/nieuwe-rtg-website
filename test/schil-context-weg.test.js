/* "Context weg" bereikt de luisteraars en de surfaces van de schil
   (public/shared/rtg-schil/05-context.js). context(null) keerde terug vóór de
   rondzending: een app die zijn keuze losliet, liet de andere surfaces op de
   oude verwijzing staan (gevonden door scripts/samenproef.js, keten
   context-naar-agenda, 19 oktober 2026).

   Draai los: node --test test/schil-context-weg.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BRON = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'rtg-schil', '05-context.js'), 'utf8');

/* Alleen de functie context() zelf, met een schil die luisteraars en een
   surface met een frame heeft. */
function maakContext() {
  const begin = BRON.indexOf('function context(ref)');
  let diepte = 0, eind = BRON.indexOf('{', begin);
  for (let i = eind; i < BRON.length; i++) {
    if (BRON[i] === '{') diepte++;
    if (BRON[i] === '}' && --diepte === 0) { eind = i + 1; break; }
  }
  const gehoord = [], gepost = [];
  const kopie = (x) => JSON.parse(JSON.stringify(x)); // de vm geeft objecten uit een ander rijk
  const schil = { huidigeContext: null, luisteraars: [(c) => gehoord.push(kopie(c))],
    surfaces: [{ el: { querySelector: () => ({ contentWindow: { postMessage: (m) => gepost.push(kopie(m)) } }) } }] };
  const zandbak = { schil, tekenConsole() {}, location: { origin: 'http://x' } };
  vm.runInNewContext(BRON.slice(begin, eind) + '; this.context = context;', zandbak);
  return { context: zandbak.context, schil, gehoord, gepost };
}

test('een verwijzing gaat rond naar luisteraars en frames, zonder gegevens', () => {
  const t = maakContext();
  t.context({ soort: 'reis', id: 'r1', label: 'Lissabon', geheim: 'nee' });
  assert.deepEqual(t.gehoord.at(-1), { soort: 'reis', id: 'r1', label: 'Lissabon' });
  assert.deepEqual(t.gepost.at(-1), { rtg: 'context', ref: { soort: 'reis', id: 'r1', label: 'Lissabon' } });
});

test('context weg (null) bereikt ook de luisteraars en de frames', () => {
  const t = maakContext();
  t.context({ soort: 'reis', id: 'r1', label: 'Lissabon' });
  t.context(null);
  assert.equal(t.schil.huidigeContext, null);
  assert.equal(t.gehoord.at(-1), null, 'een luisteraar hoort dat de context weg is');
  assert.deepEqual(t.gepost.at(-1), { rtg: 'context', ref: null }, 'een surface hoort dat de context weg is');
});

test('de schil neemt een context alleen aan van een open surface, net als de andere berichten', () => {
  const start = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'rtg-schil', '07-start.js'), 'utf8');
  const bewaker = start.indexOf('surfaceVanVenster(e.source)');
  const ctx = start.indexOf("e.data.rtg === 'context'");
  assert.ok(bewaker > 0 && ctx > 0, 'de berichtafhandeling is niet te vinden');
  assert.ok(ctx > bewaker, 'een context van een venster dat geen surface is, mag niet meetellen');
});
