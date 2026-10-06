'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const maakEvidence = require('../server/kern/experience/broker-evidence');

function preview() {
  return { id:'xpv_test', intent:'network.plan.save', version:1, world:'living', objectRef:null,
    fingerprint:'f'.repeat(64), policyDecision: { policyId:'policy:own-network-list',
      policyVersion:'v1', decision:'ALLOW_WITH_CONFIRMATION' } };
}

test('brokerbewijs behoudt preview en uitvoering zonder de idempotencysleutel te lekken', () => {
  const gezien = [], evidence = maakEvidence({ crypto,
    opslag:{ actor:key => 'actor-' + key }, trustPlane:{ observe:waarde => gezien.push(waarde) } });
  const p = preview(), objectRef = { domain:'mall', type:'lijst', id:'lijst-1' };
  evidence.preview('alice', p);
  evidence.execute('alice', p, objectRef, 'network-http-001');
  assert.equal(gezien.length, 2);
  assert.equal(gezien[0].predicate, 'experience.preview.allowed');
  assert.deepEqual(gezien[0].subjectRef, { domain:'experience', type:'preview', id:p.id });
  assert.equal(gezien[1].predicate, 'experience.action.executed');
  assert.deepEqual(gezien[1].subjectRef, objectRef);
  assert.equal(gezien[1].boundary, 'actor:actor-alice');
  assert.match(gezien[1].evidence.idempotencyKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(gezien).includes('network-http-001'), false);
});

test('shadowbewijs kan preview noch domeincommit laten falen', () => {
  const evidence = maakEvidence({ crypto, opslag:{ actor() { throw new Error('opslag stuk'); } },
    trustPlane:{ observe() { throw new Error('plane stuk'); } } });
  assert.doesNotThrow(() => evidence.preview('alice', preview()));
  assert.doesNotThrow(() => evidence.execute('alice', preview(), null, 'network-http-001'));
  const afwezig = maakEvidence({ crypto, opslag:{ actor:() => 'actor' }, trustPlane:null });
  assert.doesNotThrow(() => afwezig.preview('alice', preview()));
});
