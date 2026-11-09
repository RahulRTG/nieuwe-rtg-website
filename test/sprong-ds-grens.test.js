/* Werkelijke canonieke Sprong-bron: bestaande DS-guard is onveranderlijk
   vastgelegd vóór eigen documentaliassen. Onbekende navigatie blijft rood. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { bundel } = require('../scripts/bundel');
const { scriptLaadAnalyse, telInjectie } = require('../scripts/ontwerpsysteem');

test('Sprong heeft bewezen DS-stijlgrens zonder een uitzondering voor onbekende URL-navigatie', () => {
  const bron = bundel('shared/sprong.js').toString('utf8');
  const ds = scriptLaadAnalyse(bron, { ds: true }), oud = scriptLaadAnalyse(bron, { ds: false });
  assert.equal(ds.injecties + ds.mogelijkeInjecties, 0);
  assert.ok(!ds.onzeker.some(x => x.includes('Stijlinjectie')));
  assert.deepEqual(ds.onzeker, [], 'interne Sprong-navigatie en de DS-stijlgrens zijn beide bewezen');
  assert.equal(oud.injecties + oud.mogelijkeInjecties, 0);
  assert.equal(telInjectie(bron), 1, 'de centrale DS-root blijft voor oudere hosts zichtbaar');
  assert.ok(oud.verwijzingen.some(x => x.href === '/ds/rtg-ds.css' && x.soort === 'dom'));
  const zonderBeideGrenzen = bron.replace(
    "if (dsBijStart || document.documentElement.hasAttribute('data-ds')) return;",
    "if (false || document.documentElement.hasAttribute('andere-marker')) return;"
  );
  assert.ok(scriptLaadAnalyse(zonderBeideGrenzen, { ds: true }).verwijzingen
    .some(x => x.href === '/ds/rtg-ds.css'),
    'zonder vroege én actuele DS-grens blijft de centrale DS-root aantoonbaar bereikbaar');
  assert.doesNotMatch(bron, /sprong-legacy\.css/);
});

test('Sprong accepteert alleen gegenereerde interne app-routes', () => {
  const bron = bundel('shared/sprong.js').toString('utf8');
  assert.match(bron, /\^\\\/apps\\\//);
  const intern = /^\/apps\/(?!\.{1,2}(?:\/|[?#]|$))(?!.*\/\.{1,2}(?:\/|[?#]|$))[A-Za-z0-9_.\/-]+(?:[?#][^\s]*)?$/;
  for (const pad of ['public/shared/sprongindex.json', 'public/shared/handelingindex.json']) {
    const index = require('../' + pad);
    for (const rij of index.items.filter(r => r.url))
      assert.match(rij.url, intern, pad + ': ' + rij.url);
  }
  for (const onveilig of ['javascript:alert(1)', 'https://example.test/apps/x', '//example.test/x', '/site/x', '/apps/../secret'])
    assert.doesNotMatch(onveilig, intern, onveilig);
});
