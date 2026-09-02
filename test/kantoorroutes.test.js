/* De kantoorroutes: officeAuth laat door, de handeling vraagt wie er zit. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { VOORVOEGSELS, dektPad, kantoorRolVoor } = require('../scripts/lib/kantoorroutes');

test('elk voorvoegsel draagt een meting en een reden', () => {
  for (const v of VOORVOEGSELS) {
    assert.ok(v.pad.startsWith('/api/'), v.pad);
    assert.ok(Number.isInteger(v.gemeten) && v.gemeten > 0);
    assert.ok((v.waarom || '').length >= 30, 'de reden bij ' + v.pad);
  }
});

test('het voorvoegsel dekt op een padgrens', () => {
  assert.equal(dektPad('/api/rtfos/stad/maak'), true);
  assert.equal(dektPad('/api/rtfoster/x'), false);
  assert.equal(dektPad('/api/rtf/koppel'), false);
});

test('alleen een kantoorsessie wordt verfijnd', () => {
  assert.equal(kantoorRolVoor('office', '/api/rtfos/stad').rol, 'kantoor-op-naam');
  for (const rol of ['member', 'boardroom', 'supplier', 'kantoor-op-naam']) {
    assert.equal(kantoorRolVoor(rol, '/api/rtfos/stad').rol, null, rol);
  }
});
