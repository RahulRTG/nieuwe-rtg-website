'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { beoordeel, beoordeelPromotiepad, PROMOTIEPAD, SCHAKELS } = require('../scripts/releaseketenwacht');

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
    'artefact-vastgelegd': t => t.replace(/artefactketen\.js gebouwd/g, 'x'),
    'test-op-digest': t => t.replace(/artefactketen\.js testen/g, 'x'),
    'ketenbewijs-bewaard': t => t.replace(/artefactketen\.json/g, 'x'),
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
});

test('mutatie: een build NA de test op het digest laat de wacht zakken (gepromoveerd is niet wat getest is)', () => {
  const u = beoordeel(echt + '\n      - run: docker build --tag x .\n');
  assert.ok(!u.rond); assert.ok(u.verboden.some(v => v.id === 'geen-bouw-na-test'));
});

const wortel = path.join(__dirname, '..');
const leesEcht = b => fs.readFileSync(path.join(wortel, b), 'utf8');

test('het echte promotie- en rollbackpad bouwt niets en vraagt overal de artefactketen', () => {
  const u = beoordeelPromotiepad(leesEcht);
  assert.deepStrictEqual(u.problemen, []);
  assert.ok(u.rond);
});

test('mutatie: elke poort in het promotiepad die verdwijnt, en elke build die erin sluipt, laat de wacht zakken', () => {
  const ids = [];
  for (const { bestand, eist } of PROMOTIEPAD) for (const [id, re] of eist) {
    ids.push(id);
    const kapot = b => b === bestand ? leesEcht(b).split('\n').filter(r => !re.test(r)).join('\n') : leesEcht(b);
    const u = beoordeelPromotiepad(kapot);
    assert.ok(u.problemen.some(p => p.id === id), id + ' hoort te zakken');
  }
  assert.ok(ids.length >= 8, 'alle poorten zijn beproefd: ' + ids.join(','));
  for (const bouw of ['docker build --tag x .', 'docker buildx build .', 'docker compose up --build app', 'docker compose build app', 'kaniko']) {
    const u = beoordeelPromotiepad(b => b === 'scripts/docker/live.sh' ? leesEcht(b) + '\n' + bouw + '\n' : leesEcht(b));
    assert.ok(u.problemen.some(p => p.id === 'bouw-in-promotiepad'), bouw);
  }
  // --no-build is juist de bedoeling en mag blijven
  assert.ok(beoordeelPromotiepad(leesEcht).rond);
  const weg = beoordeelPromotiepad(b => { if (b === 'scripts/live-vrijgave.js') throw new Error('weg'); return leesEcht(b); });
  assert.ok(weg.problemen.some(p => p.id === 'bestand-ontbreekt'));
});
