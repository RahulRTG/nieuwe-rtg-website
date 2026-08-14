const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const functies = require('../server/functies');
const maakScanner = require('../server/kern/magnaat-capabilities');

const root = path.join(__dirname, '..');

test('de Capability Graph leest apps, routes, werkprocessen en kantoren rechtstreeks uit de RTG-code', () => {
  const graph = maakScanner({ root, functies }).scan();
  assert.ok(graph.cijfers.apps >= 150, 'alle echte app-pagina’s worden gevonden');
  assert.ok(graph.cijfers.apiActies >= 1500, 'de echte API-deuren worden gevonden');
  assert.ok(graph.cijfers.werkprocessen >= 500, 'routes worden tot procesfamilies gebundeld');
  assert.ok(graph.cijfers.kantoren >= 29, 'afdelingen en specialistische kamers worden gevonden');
  assert.ok(graph.cijfers.ongedekteApiActies >= 400, 'de scanner toont wat het oude functieregister mist');
  assert.ok(graph.cijfers.controlepunten >= 2500, 'iedere API, app, functie en procesfamilie krijgt een controlepunt');
  assert.equal(graph.apps.some(a => a.pad === '/apps/kantoren.html'), true);
  assert.equal(graph.kantoren.some(k => k.id === 'klantenservice'), true);
  assert.equal(graph.workflows.some(w => w.familie === '/api/office/bank' && w.actieAantal >= 20), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/bank' && p.kantoor.id === 'bank'), true);
  assert.equal(graph.controlepunten.some(p => p.route === '/api/office/redactie' && p.kantoor.id === 'redactie'), true);
});

test('dezelfde code levert een stabiele vingerafdruk en geen dynamische nepkamer op', () => {
  const scanner = maakScanner({ root, functies });
  const a = scanner.scan();
  const b = scanner.scan();
  assert.equal(a.vingerafdruk, b.vingerafdruk);
  assert.equal(a.kantoren.some(k => /esc\(|[+'$]/.test(k.naam)), false);
});
