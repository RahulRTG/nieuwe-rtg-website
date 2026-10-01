'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../scripts/lib/outputbinding');
const pass = { toetsen: 3, overgeslagen: 0, gezakt: 0, status: 0, signal: null, error: null, tijdout: false };
test('only an actually completed passing baseline belongs to its candidate', () => {
  assert.equal(B.currentBaseline({ binding: 'candidate-a', staat: 'groen', execution: pass }, 'candidate-a'), true);
  assert.equal(B.currentBaseline({ binding: 'candidate-a', staat: 'groen', execution: pass }, 'candidate-b'), false);
  assert.equal(B.currentBaseline('groen', 'candidate-a'), false);
  assert.equal(B.currentBaseline({ binding: 'candidate-a', staat: 'groen' }, 'candidate-a'), false);
});
test('timeout, skips, zero tests, process crashes and failed cleanup cannot become output proof', () => {
  for (const patch of [{ tijdout: true }, { signal: 'SIGKILL' }, { error: 'ENOENT' },
    { toetsen: 0 }, { overgeslagen: 1 }, { status: null }, { status: 2 }, { status: 1 }]) {
    assert.equal(B.complete({ ...pass, ...patch }), false, JSON.stringify(patch));
    assert.equal(B.green({ ...pass, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(B.green({ ...pass, status: 1 }), false);
  assert.equal(B.green({ ...pass, gezakt: 1, status: 1 }), false);
  assert.equal(B.complete({ ...pass, gezakt: 1, status: 1 }), true);
});
