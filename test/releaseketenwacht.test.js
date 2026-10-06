'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { beoordeel, SCHAKELS } = require('../scripts/releaseketenwacht');

const echt = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'release-image.yml'), 'utf8');

test('het echte releaseworkflow heeft alle schakels en doet niets verbodens', () => {
  const u = beoordeel(echt);
  assert.deepStrictEqual(u.schakels.filter(s => !s.staat), []);
  assert.deepStrictEqual(u.verboden, []);
  assert.ok(u.rond);
});

test('mutatie: elke schakel die verdwijnt laat de wacht zakken, met zijn naam', () => {
  const weg = {
    'exacte-commit': t => t.replace(/RTG_RELEASE_COMMIT=\$GITHUB_SHA/g, 'X'),
    'onveranderlijke-tag': t => t.replace(/candidate-\$\{GITHUB_SHA::12\}-\$\{GITHUB_RUN_ID\}/g, 'candidate'),
    'volledige-tests': t => t.replace(/npm run afbouw:software/g, 'true'),
    'digest-binding': t => t.replace(/--binden/g, '--x'),
    'digest-controle': t => t.replace(/--controle --eis-kandidaat/g, '--x'),
    sbom: t => t.replace(/imageherkomst\.js --sbom/g, 'x'),
    'ondertekening-vooraf': t => t.replace(/--sleutelcontrole/g, '--x'),
    'tests-op-imagebytes': t => t.replace(/--fase=na/g, '--x'),
    'kandidaat-is-gekwalificeerd': t => t.replace(/--image-id=/g, '--x='),
  };
  assert.deepStrictEqual(Object.keys(weg).sort(), SCHAKELS.map(s => s.id).sort());
  for (const [id, f] of Object.entries(weg)) {
    const u = beoordeel(f(echt));
    assert.ok(!u.rond, id + ' hoort de wacht te laten zakken');
    assert.ok(u.schakels.some(s => s.id === id && !s.staat), id);
  }
});

test('mutatie: een uitrol- of latest-stap laat de wacht zakken', () => {
  assert.ok(!beoordeel(echt + '\n      - run: docker push ghcr.io/x:latest\n').rond);
  assert.ok(!beoordeel(echt + '\n      - run: kubectl apply -f x\n').rond);
  // de oude vorm: na de afbouw opnieuw bouwen
  assert.ok(!beoordeel(echt + '\n      - run: docker build --tag x .\n').rond);
});
