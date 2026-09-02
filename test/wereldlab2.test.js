/* De livinglab-wereld: een veldnaam, drie betekenissen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { ID_BETEKENIS, idVoor } = require('../scripts/lib/wereld-lab2');

test('elk deelgebied wijst naar een ding dat de wereld ook maakt', () => {
  const gemaakt = new Set(['lab', 'studie', 'apparaat', 'labpas']);
  for (const [sub, wat] of Object.entries(ID_BETEKENIS)) {
    assert.ok(sub.startsWith('/api/lab2/'), sub);
    assert.ok(gemaakt.has(wat), sub + ' wijst naar "' + wat + '", en dat maakt de wereld niet');
  }
});

/* DE KERN VAN DEZE WERELD. Een enkel `id` zou in twee van de vier gevallen
   het verkeerde ding aanwijzen; een eerste versie deed dat en leverde 3
   routes op in plaats van 21. */
test('hetzelfde veld krijgt per deelgebied een ander ding', () => {
  const extra = { lab: 'L1', studie: 'S1', apparaat: 'A1', labpas: 'P1' };
  assert.deepEqual(idVoor(extra, '/api/lab2/bewijs/conclusie'), { id: 'S1' });
  assert.deepEqual(idVoor(extra, '/api/lab2/app/lijst'), { id: 'A1' });
  assert.deepEqual(idVoor(extra, '/api/lab2/lab/budget'), { id: 'L1' });
  assert.deepEqual(idVoor(extra, '/api/lab2/mijn/observatie'), { id: 'P1' });
});

/* Een deelgebied dat er niet in staat krijgt GEEN id. Een gok zou hier een
   404 vervangen door een stille meting op het verkeerde ding. */
test('een onbekend deelgebied krijgt niets mee', () => {
  const extra = { lab: 'L1', studie: 'S1' };
  assert.deepEqual(idVoor(extra, '/api/lab2/onbekend/iets'), {});
  assert.deepEqual(idVoor(extra, '/api/mall/bestel'), {});
});

/* En een ding dat de wereld niet heeft kunnen maken, wordt niet verzonnen. */
test('zonder het ding komt er geen id', () => {
  assert.deepEqual(idVoor({ lab: 'L1' }, '/api/lab2/bewijs/conclusie'), {});
});
