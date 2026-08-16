/* Bewijs dat de automatische routefabriek iedere gevonden codefamilie omzet
   in een startbaar, synthetisch en schermgebonden trainingsdossier. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const functies = require('../server/functies');
const scanner = require('../server/kern/magnaat-capabilities')({ functies });
const fabriek = require('../server/kern/magnaat-werkroutefabriek');

test('iedere ontdekte procesfamilie krijgt exact één volledige veilige werkroute', () => {
  const basis = scanner.scan();
  const routes = fabriek.bouw(basis.workflows);
  assert.equal(routes.length, basis.workflows.length);
  assert.equal(new Set(routes.map(r => r.id)).size, routes.length);

  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i], workflow = basis.workflows[i];
    assert.equal(route.id, workflow.id);
    assert.deepEqual(route.codeFamilies, [workflow.familie]);
    assert.equal(route.automatisch, true);
    assert.equal(route.stappen.length, 5);
    assert.equal(route.stappen[0].soort, 'software');
    assert.equal(route.stappen[0].schermPad, workflow.app.pad);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', route.stappen[0].schermPad)));
    const codeactie = route.stappen[2].velden.find(v => v.id === 'codeactie');
    assert.ok(codeactie && codeactie.opties.length >= 1);
    assert.ok(route.stappen[2].velden.some(v => v.id === 'synthetisch' && v.type === 'vink' && v.verplicht));
    assert.match(route.briefing, /synthetisch/i);
    assert.doesNotMatch(route.briefing, /productie-endpoint aanroepen/i);
  }
});

test('de scanner accepteert alleen valide fabrieksroutes als dekkingsbewijs', () => {
  const graph = require('../server/kern/magnaat-capabilities')({
    functies,
    werkrouteFabriek: workflows => fabriek.bouw(workflows).concat({
      id: 'onveilig', codeFamilies: ['/api/onveilig'], stappen: []
    })
  }).scan();
  assert.equal(graph.automatischeWerkprocessen.length, graph.workflows.length);
  assert.equal(graph.dekkingsmatrix.percentage, 100);
  assert.equal(graph.dekkingsmatrix.metGaten, 0);
  assert.equal(graph.dekkingsmatrix.dimensies.find(d => d.id === 'werkroute').percentage, 100);
});
