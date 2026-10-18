/* De Workspace Identity Runtime geeft modules alleen een continuiteitsvraag.
   Het credential zelf blijft binnen de bestaande hostgrens. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('sessiecontinuiteit verandert bij accountwissel zonder credentialprojectie', () => {
  const opslag = new Map([['rtg_member_token', 'sessie-a']]);
  const window = { localStorage: { getItem: k => opslag.get(k) || null }, navigator: { onLine: true },
    addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/interface/workspace-session.js'), 'utf8'), { window });
  const identity = window.RTGIdentityRuntime();
  assert.equal(identity.authenticated(), true);
  assert.equal(identity.sameSession(), true);
  assert.deepEqual(Object.keys(identity).sort(), ['actor', 'authenticated', 'headers', 'sameSession']);
  opslag.set('rtg_member_token', 'sessie-b');
  assert.equal(identity.authenticated(), true);
  assert.equal(identity.sameSession(), false);
  assert.doesNotMatch(JSON.stringify(identity), /sessie-[ab]/);
});
