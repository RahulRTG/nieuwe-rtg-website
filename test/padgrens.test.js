/* Een voorvoegsel dekt een pad op een PADgrens, niet op een woordgrens. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { dekt, ligtBinnen } = require('../scripts/lib/padgrens');

test('een voorvoegsel dekt zichzelf en wat eronder hangt', () => {
  assert.equal(dekt('/api/ik', '/api/ik'), true);
  assert.equal(dekt('/api/ik/geloof', '/api/ik'), true);
  assert.equal(dekt('/api/staff/pauze', '/api/staff/'), true);
});

/* De fout waar dit bestand voor bestaat. */
test('een woordgrens is geen padgrens', () => {
  assert.equal(dekt('/api/ikea/bestel', '/api/ik'), false);
  assert.equal(dekt('/api/staffing/x', '/api/staff/'), false);
});

test('een leeg voorvoegsel dekt niets', () => {
  assert.equal(dekt('/api/ik', ''), false);
  assert.equal(dekt('/api/ik', null), false);
});

test('ligtBinnen is niet waar voor zichzelf', () => {
  assert.equal(ligtBinnen('/api/ik', '/api/ik'), false);
  assert.equal(ligtBinnen('/api/ik/geloof', '/api/ik'), true);
});
